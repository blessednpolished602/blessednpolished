const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

const SLOT_SIZE_MIN = 30;
const TIMEZONE = "America/Phoenix";

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns all 30-min slot startMin values a booking occupies.
 * e.g. startMin=540, durationMin=60 → [540, 570]
 */
function lockedSlots(startMin, durationMin, slotSizeMin = SLOT_SIZE_MIN) {
  const count = Math.ceil(durationMin / slotSizeMin);
  return Array.from({ length: count }, (_, i) => startMin + i * slotSizeMin);
}

/** Fisher-Yates in-place shuffle */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Core transaction: read lock docs, abort if any exist, then write locks + booking.
 * Throws plain Error("SLOT_TAKEN") on conflict so callers can retry with another tech.
 */
async function _bookSpecificTech({
  techId, techName, date, startMin, durationMin,
  requiredSlots, serviceId, serviceName, client,
}) {
  const bookingRef = db.collection("bookings").doc();
  const lockRefs = requiredSlots.map((s) =>
    db.doc(`slotLocks/${techId}_${date}_${s}`)
  );

  await db.runTransaction(async (txn) => {
    const lockSnaps = await Promise.all(lockRefs.map((r) => txn.get(r)));
    if (lockSnaps.some((snap) => snap.exists)) throw new Error("SLOT_TAKEN");

    for (let i = 0; i < requiredSlots.length; i++) {
      txn.set(lockRefs[i], {
        techId,
        date,
        startMin: requiredSlots[i],
        bookingId: bookingRef.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    txn.set(bookingRef, {
      techId,
      techName,
      serviceId,
      serviceName,
      date,
      startMin,
      durationMin,
      timezone: TIMEZONE,
      name: client.name.trim(),
      email: client.email || null,
      phone: client.phone || null,
      notes: client.notes || null,
      status: "confirmed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      cancelledAt: null,
    });
  });

  return { bookingId: bookingRef.id, techId, techName };
}

// ── createBooking ──────────────────────────────────────────────────────────────

exports.createBooking = onCall(async (request) => {
  const { techId, date, startMin, serviceId, serviceName, durationMin, client } =
    request.data ?? {};

  // ── Input validation ─────────────────────────────────────────────────────────
  if (!client || typeof client.name !== "string" || client.name.trim().length === 0) {
    throw new HttpsError("invalid-argument", "client.name is required");
  }
  if (!client.email && !client.phone) {
    throw new HttpsError("invalid-argument", "client.email or client.phone is required");
  }
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpsError("invalid-argument", "date must be YYYY-MM-DD");
  }
  if (!Number.isInteger(startMin) || startMin < 0 || startMin > 1439) {
    throw new HttpsError("invalid-argument", "startMin must be an integer 0–1439");
  }
  if (!Number.isInteger(durationMin) || durationMin <= 0) {
    throw new HttpsError("invalid-argument", "durationMin must be a positive integer");
  }
  if (!serviceId || typeof serviceId !== "string") {
    throw new HttpsError("invalid-argument", "serviceId is required");
  }
  if (!serviceName || typeof serviceName !== "string") {
    throw new HttpsError("invalid-argument", "serviceName is required");
  }
  if (!techId || typeof techId !== "string") {
    throw new HttpsError("invalid-argument", "techId is required (use 'any' for any available)");
  }

  const requiredSlots = lockedSlots(startMin, durationMin);

  // ── Specific technician ───────────────────────────────────────────────────────
  if (techId !== "any") {
    // Check shop-wide block
    const shopBlock = await db.doc(`blockedDays/all_${date}`).get();
    if (shopBlock.exists) {
      throw new HttpsError("failed-precondition", "The shop is closed that day");
    }
    // Check tech-specific block
    const techBlock = await db.doc(`blockedDays/${techId}_${date}`).get();
    if (techBlock.exists) {
      throw new HttpsError("failed-precondition", "That technician is unavailable that day");
    }

    // Check availability doc exists and contains all required slots
    const availSnap = await db.doc(`availability/${techId}_${date}`).get();
    if (!availSnap.exists) {
      throw new HttpsError("not-found", "No availability for that technician on that date");
    }
    const availSlots = availSnap.data().slots || [];
    const missing = requiredSlots.find((s) => !availSlots.includes(s));
    if (missing !== undefined) {
      throw new HttpsError(
        "failed-precondition",
        "Requested time is not within the technician's available slots"
      );
    }

    const techName = availSnap.data().techName || techId;
    try {
      return await _bookSpecificTech({
        techId, techName, date, startMin, durationMin,
        requiredSlots, serviceId, serviceName, client,
      });
    } catch (e) {
      if (e.message === "SLOT_TAKEN") {
        throw new HttpsError("aborted", "SLOT_TAKEN");
      }
      throw new HttpsError("internal", e.message);
    }
  }

  // ── Any available ─────────────────────────────────────────────────────────────
  // Check shop-wide block first
  const shopBlock = await db.doc(`blockedDays/all_${date}`).get();
  if (shopBlock.exists) {
    throw new HttpsError("failed-precondition", "The shop is closed that day");
  }

  // Collect individually blocked tech IDs for that date
  const blockSnaps = await db.collection("blockedDays").where("date", "==", date).get();
  const blockedTechIds = new Set(blockSnaps.docs.map((d) => d.data().techId));

  // Query availability docs that contain startMin
  const availSnaps = await db
    .collection("availability")
    .where("date", "==", date)
    .where("slots", "array-contains", startMin)
    .get();

  // Filter: tech must have ALL required slots and not be blocked
  const candidates = availSnaps.docs
    .map((d) => d.data())
    .filter((d) => {
      if (blockedTechIds.has(d.techId)) return false;
      return requiredSlots.every((s) => (d.slots || []).includes(s));
    });

  if (candidates.length === 0) {
    throw new HttpsError("not-found", "NO_AVAILABILITY");
  }

  shuffle(candidates);

  for (const avail of candidates) {
    try {
      return await _bookSpecificTech({
        techId: avail.techId,
        techName: avail.techName,
        date,
        startMin,
        durationMin,
        requiredSlots,
        serviceId,
        serviceName,
        client,
      });
    } catch (e) {
      if (e.message === "SLOT_TAKEN") continue; // race lost — try next candidate
      throw new HttpsError("internal", e.message);
    }
  }

  throw new HttpsError("resource-exhausted", "ALL_SLOTS_TAKEN");
});

// ── cancelBooking (admin only) ─────────────────────────────────────────────────

exports.cancelBooking = onCall(async (request) => {
  // Enforce admin custom claim
  if (!request.auth || request.auth.token.admin !== true) {
    throw new HttpsError("permission-denied", "Admin only");
  }

  const { bookingId } = request.data ?? {};
  if (!bookingId || typeof bookingId !== "string") {
    throw new HttpsError("invalid-argument", "bookingId is required");
  }

  const bookingRef = db.doc(`bookings/${bookingId}`);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) {
    throw new HttpsError("not-found", "Booking not found");
  }

  const { techId, date, startMin, durationMin, status } = bookingSnap.data();
  if (status === "cancelled") {
    throw new HttpsError("failed-precondition", "Booking is already cancelled");
  }

  const slots = lockedSlots(startMin, durationMin);

  await db.runTransaction(async (txn) => {
    for (const s of slots) {
      txn.delete(db.doc(`slotLocks/${techId}_${date}_${s}`));
    }
    txn.update(bookingRef, {
      status: "cancelled",
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { ok: true, bookingId };
});
