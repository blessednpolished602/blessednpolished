const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { Resend } = require("resend");

const resendApiKey = defineSecret("RESEND_API_KEY");
const resendFromEmail = defineSecret("RESEND_FROM_EMAIL");

admin.initializeApp();
const db = admin.firestore();

const SLOT_SIZE_MIN = 30;
const TIMEZONE = "America/Phoenix";
const DOW_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Returns { startMin, endMin } for dateStr given the hours config from site/settings,
 * null if explicitly closed, or undefined if not configured.
 */
function hoursForDate(hours, dateStr) {
  if (!hours) return undefined;
  const [y, mo, d] = dateStr.split("-").map(Number);
  const dow = DOW_KEYS[new Date(y, mo - 1, d).getDay()];
  const override = hours.byDay?.[dow];
  if (override === null) return null;            // explicitly closed
  return override ?? hours.default ?? undefined; // custom | default | unset
}

/**
 * Returns all slot startMin values a booking occupies.
 * e.g. startMin=540, durationMin=60, slotSizeMin=30 → [540, 570]
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

// ── Email helpers ───────────────────────────────────────────────────────────────

function formatTime(startMin) {
  const h = Math.floor(startMin / 60);
  const m = startMin % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDate(dateStr) {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function escHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendConfirmationEmail({ apiKey, fromEmail, to, clientName, serviceName, techName, date, startMin, bookingId }) {
  const name = escHtml(clientName);
  const svc  = escHtml(serviceName);
  const tech = escHtml(techName);
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: fromEmail,
    to,
    subject: `Booking Confirmed – ${serviceName} on ${formatDate(date)}`,
    html: `
      <p>Hi ${name},</p>
      <p>Your appointment has been confirmed. Here are your booking details:</p>
      <ul>
        <li><strong>Service:</strong> ${svc}</li>
        <li><strong>Technician:</strong> ${tech}</li>
        <li><strong>Date:</strong> ${formatDate(date)}</li>
        <li><strong>Time:</strong> ${formatTime(startMin)} (${TIMEZONE})</li>
        <li><strong>Booking ID:</strong> ${bookingId}</li>
      </ul>
      <p>If you need to make changes, please contact us directly.</p>
      <p>We look forward to seeing you!</p>
    `,
  });
}

function tryEmail(secretKey, secretFrom, client, serviceName, result, date, startMin) {
  if (!client.email) return;
  const apiKey = secretKey.value();
  const fromEmail = secretFrom.value();
  if (!apiKey || !fromEmail) {
    console.warn("RESEND_API_KEY or RESEND_FROM_EMAIL not set — skipping confirmation email");
    return;
  }
  sendConfirmationEmail({
    apiKey, fromEmail,
    to: client.email,
    clientName: client.name.trim(),
    serviceName,
    techName: result.techName,
    date,
    startMin,
    bookingId: result.bookingId,
  }).catch((err) => console.error("Confirmation email failed:", err));
}

/**
 * Core transaction: read lock docs, abort if any exist, then write locks + booking.
 * Throws plain Error("SLOT_TAKEN") on conflict so callers can retry with another tech.
 */
async function _bookSpecificTech({
  techId, techName, date, startMin, durationMin, slotSizeMin,
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
      slotSizeMin,
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

exports.createBooking = onCall({ secrets: [resendApiKey, resendFromEmail], invoker: "public" }, async (request) => {
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
  const todayDate = new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  if (date < todayDate) {
    throw new HttpsError("invalid-argument", "Cannot book a date in the past");
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
  if (client.name.trim().length > 200) {
    throw new HttpsError("invalid-argument", "client.name must be 200 characters or fewer");
  }
  if (client.email && (typeof client.email !== "string" || client.email.length > 200)) {
    throw new HttpsError("invalid-argument", "client.email must be a string of 200 characters or fewer");
  }
  if (client.phone && (typeof client.phone !== "string" || client.phone.length > 30)) {
    throw new HttpsError("invalid-argument", "client.phone must be a string of 30 characters or fewer");
  }
  if (client.notes != null) {
    if (typeof client.notes !== "string") {
      throw new HttpsError("invalid-argument", "client.notes must be a string");
    }
    if (client.notes.length > 500) {
      throw new HttpsError("invalid-argument", "client.notes must be 500 characters or fewer");
    }
  }
  if (durationMin > 480) {
    throw new HttpsError("invalid-argument", "durationMin cannot exceed 480 minutes");
  }

  // ── Read site settings (hours + slotSizeMin) ────────────────────────────────
  const settingsSnap = await db.doc("site/settings").get();
  const settingsData = settingsSnap.exists ? settingsSnap.data() : {};
  const rawSlotSize = settingsData.slotSizeMin;
  const slotSizeMin = (Number.isInteger(rawSlotSize) && rawSlotSize > 0) ? rawSlotSize : SLOT_SIZE_MIN;

  const requiredSlots = lockedSlots(startMin, durationMin, slotSizeMin);

  // ── Validate service from Firestore (source of truth for name) ─────────────
  const serviceSnap = await db.doc(`signatureLooks/${serviceId}`).get();
  if (!serviceSnap.exists || serviceSnap.data().enabled === false) {
    throw new HttpsError("not-found", "Service not found or unavailable");
  }
  const resolvedServiceName = serviceSnap.data().title || serviceSnap.data().name || serviceId;

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

    // Validate business hours
    const dayHours = hoursForDate(settingsData.hours, date);
    if (dayHours === null) {
      throw new HttpsError("failed-precondition", "The shop is closed on that day");
    }
    if (dayHours && (startMin < dayHours.startMin || startMin + durationMin > dayHours.endMin)) {
      throw new HttpsError("failed-precondition", "Requested time is outside business hours");
    }

    // Read tech info and optional restriction doc in parallel
    const [techSnap, availSnap] = await Promise.all([
      db.doc(`technicians/${techId}`).get(),
      db.doc(`availability/${techId}_${date}`).get(),
    ]);

    if (!techSnap.exists || techSnap.data().enabled === false) {
      throw new HttpsError("not-found", "Technician not found or unavailable");
    }

    // If restriction doc exists, enforce it; absent → open by default
    if (availSnap.exists) {
      const availSlots = availSnap.data().slots || [];
      const missing = requiredSlots.find((s) => !availSlots.includes(s));
      if (missing !== undefined) {
        throw new HttpsError(
          "failed-precondition",
          "Requested time is not within the technician's available slots"
        );
      }
    }

    const techName = techSnap.data().name || techId;
    let result;
    try {
      result = await _bookSpecificTech({
        techId, techName, date, startMin, durationMin, slotSizeMin,
        requiredSlots, serviceId, serviceName: resolvedServiceName, client,
      });
    } catch (e) {
      if (e.message === "SLOT_TAKEN") {
        console.warn(`Booking SLOT_TAKEN: techId=${techId} date=${date} startMin=${startMin}`);
        throw new HttpsError("aborted", "SLOT_TAKEN");
      }
      console.error(`Booking failed: techId=${techId} serviceId=${serviceId} date=${date} startMin=${startMin}`, e);
      throw new HttpsError("internal", e.message);
    }
    tryEmail(resendApiKey, resendFromEmail, client, resolvedServiceName, result, date, startMin);
    console.log(`Booking created: bookingId=${result.bookingId} techId=${result.techId} serviceId=${serviceId} date=${date} startMin=${startMin}`);
    return result;
  }

  // ── Any available ─────────────────────────────────────────────────────────────
  // Validate business hours
  const anyDayHours = hoursForDate(settingsData.hours, date);
  if (anyDayHours === null) {
    throw new HttpsError("failed-precondition", "The shop is closed on that day");
  }
  if (anyDayHours && (startMin < anyDayHours.startMin || startMin + durationMin > anyDayHours.endMin)) {
    throw new HttpsError("failed-precondition", "Requested time is outside business hours");
  }

  // Check shop-wide block first
  const shopBlock = await db.doc(`blockedDays/all_${date}`).get();
  if (shopBlock.exists) {
    throw new HttpsError("failed-precondition", "The shop is closed that day");
  }

  // Load enabled techs, per-tech blocks, and optional restriction docs in parallel
  const [techsSnap, blockSnaps, availSnaps] = await Promise.all([
    db.collection("technicians").where("enabled", "==", true).get(),
    db.collection("blockedDays").where("date", "==", date).get(),
    db.collection("availability").where("date", "==", date).get(),
  ]);

  const blockedTechIds = new Set(blockSnaps.docs.map((d) => d.data().techId));

  // Build restriction map: techId → slots[] (only for techs with a restriction doc)
  const restrictMap = {};
  availSnaps.docs.forEach((d) => { restrictMap[d.data().techId] = d.data().slots || []; });

  // A tech is a candidate if: not blocked, and passes restriction check (if any)
  const candidates = techsSnap.docs
    .map((d) => ({ techId: d.id, techName: d.data().name || d.id }))
    .filter(({ techId }) => {
      if (blockedTechIds.has(techId)) return false;
      // If restriction doc exists, all required slots must be listed
      if (Object.prototype.hasOwnProperty.call(restrictMap, techId)) {
        return requiredSlots.every((s) => restrictMap[techId].includes(s));
      }
      return true; // no restriction → open by default
    });

  if (candidates.length === 0) {
    throw new HttpsError("not-found", "NO_AVAILABILITY");
  }

  shuffle(candidates);

  for (const cand of candidates) {
    let result;
    try {
      result = await _bookSpecificTech({
        techId: cand.techId,
        techName: cand.techName,
        date,
        startMin,
        durationMin,
        slotSizeMin,
        requiredSlots,
        serviceId,
        serviceName: resolvedServiceName,
        client,
      });
    } catch (e) {
      if (e.message === "SLOT_TAKEN") continue; // race lost — try next candidate
      console.error(`Booking failed: techId=${cand.techId} serviceId=${serviceId} date=${date} startMin=${startMin}`, e);
      throw new HttpsError("internal", e.message);
    }
    tryEmail(resendApiKey, resendFromEmail, client, resolvedServiceName, result, date, startMin);
    console.log(`Booking created: bookingId=${result.bookingId} techId=${result.techId} serviceId=${serviceId} date=${date} startMin=${startMin}`);
    return result;
  }

  throw new HttpsError("resource-exhausted", "ALL_SLOTS_TAKEN");
});

// ── cancelBooking (admin only) ─────────────────────────────────────────────────

exports.cancelBooking = onCall({ invoker: "public" }, async (request) => {
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

  const { techId, date, startMin, durationMin, status, slotSizeMin: savedSlotSize } = bookingSnap.data();
  if (status === "cancelled") {
    throw new HttpsError("failed-precondition", "Booking is already cancelled");
  }

  // Use the slotSizeMin stored at booking time; fall back to default for old records.
  const slotSizeMin = (Number.isInteger(savedSlotSize) && savedSlotSize > 0) ? savedSlotSize : SLOT_SIZE_MIN;
  const slots = lockedSlots(startMin, durationMin, slotSizeMin);

  await db.runTransaction(async (txn) => {
    for (const s of slots) {
      txn.delete(db.doc(`slotLocks/${techId}_${date}_${s}`));
    }
    txn.update(bookingRef, {
      status: "cancelled",
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  console.log(`Booking cancelled: bookingId=${bookingId} techId=${techId} date=${date}`);
  return { ok: true, bookingId };
});
