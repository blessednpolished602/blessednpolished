/**
 * One-time cleanup: delete known test booking records from Firestore.
 *
 * Matches documents in /bookings where ANY of:
 *   - name  === "Likwit Devs"
 *   - email === "likwitdevs@gmail.com"
 *   - notes includes "Testing"
 *
 * Usage (from repo root):
 *   Dry run:  SERVICE_ACCOUNT_PATH=./serviceAccount.json node functions/deleteTestBookings.js
 *   Delete:   SERVICE_ACCOUNT_PATH=./serviceAccount.json node functions/deleteTestBookings.js --delete
 *
 * To get serviceAccount.json:
 *   Firebase Console → Project Settings → Service accounts → Generate new private key
 *   Save as serviceAccount.json in the repo root (do NOT commit it — it's in .gitignore).
 */

"use strict";

const path = require("path");
const admin = require("firebase-admin");

// ── Init ──────────────────────────────────────────────────────────────────────

const saPath = process.env.SERVICE_ACCOUNT_PATH
  ? path.resolve(process.env.SERVICE_ACCOUNT_PATH)
  : path.resolve(__dirname, "../serviceAccount.json");

let serviceAccount;
try {
  const raw = require("fs").readFileSync(saPath, "utf8");
  serviceAccount = JSON.parse(raw);
} catch (e) {
  console.error(`ERROR: Could not load service account from ${saPath}`);
  console.error(`  Reason: ${e.message}`);
  console.error("Download it from: Firebase Console → Project Settings → Service accounts → Generate new private key");
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const DRY_RUN = !process.argv.includes("--delete");

// ── Match logic ───────────────────────────────────────────────────────────────

function isTestBooking(data) {
  if (data.name === "Likwit Devs") return true;
  if (data.email === "likwitdevs@gmail.com") return true;
  if (typeof data.notes === "string" && data.notes.includes("Testing")) return true;
  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log("Fetching all bookings...");
  const snap = await db.collection("bookings").get();
  console.log(`Total booking docs: ${snap.size}`);

  const toDelete = snap.docs.filter(d => isTestBooking(d.data()));

  if (toDelete.length === 0) {
    console.log("\nNo test bookings found. Nothing to do.");
    return;
  }

  console.log(`\nTest bookings matched (${toDelete.length}):\n`);
  for (const doc of toDelete) {
    const d = doc.data();
    console.log(`  [${doc.id}]  name="${d.name}"  email="${d.email || ""}"  date=${d.date}  status=${d.status}`);
  }

  if (DRY_RUN) {
    console.log("\n─── DRY RUN — nothing deleted. ───");
    console.log("Re-run with --delete to permanently remove these docs:");
    console.log("  SERVICE_ACCOUNT_PATH=./serviceAccount.json node functions/deleteTestBookings.js --delete\n");
    return;
  }

  console.log("\nDeleting...");
  for (const doc of toDelete) {
    await db.collection("bookings").doc(doc.id).delete();
    console.log(`  Deleted ${doc.id}`);
  }
  console.log(`\nDone. ${toDelete.length} record(s) permanently deleted.`);
}

run().catch(err => {
  console.error("Fatal error:", err.message || err);
  process.exit(1);
});
