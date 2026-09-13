'use strict';
/* ===========================================================================
 * loom-seed-privileged-staff.cjs
 *
 * Additive Firestore seed for LUXARDO FLOW (Firebase project: luxardo-flow).
 *
 * Makes the two PRIVILEGED Gmail identities carry the intended SERVER-SIDE
 * role (used by firestore.loom.rules isAdmin() and the Cloud Functions
 * requireAdmin / requireStaff) so they can perform admin operations and,
 * later, the "Admin Panel -> Users -> Reset/Change Password" feature. The
 * frontend already recognises them by email (src/utils/loomIdentity.ts); this
 * aligns the server without changing any rule or the permission model.
 *
 *   staff/{SUPER_ADMIN_uid}.role -> 'super_admin'
 *   staff/{ADMIN_uid}.role       -> 'admin'
 *
 * OBSERVED STATE (live luxardo-flow, verified): all 10 staff/{uid} docs
 * already exist. abhijeetra799@gmail.com is already role 'admin' (no-op);
 * luxardodigiwork@gmail.com is currently role 'owner' and gets 'super_admin'.
 *
 * This script touches ONLY those two docs. Every ordinary staff doc —
 * including grade@luxardofashion.com (role "analysis") — is left untouched.
 *
 * SAFETY
 *   - For an EXISTING doc, writes ONLY `role` (+ `active` if it was disabled)
 *     with set(merge) — displayName / email / createdAt / uid are untouched.
 *   - Creates NO Firebase Auth users. Resolves UIDs via getUserByEmail().
 *   - DRY RUN by default. Pass --commit to write. Nothing is deployed.
 *
 * CREDENTIALS (read-only `firebase login` is NOT enough for Firestore writes)
 *   Option A:  gcloud auth application-default login   (then just run this)
 *   Option B:  set GOOGLE_APPLICATION_CREDENTIALS to a service-account key
 *   Option C:  do the same three writes by hand in the Firebase console.
 *
 * RUN  (from the repo root)
 *   node scripts/loom-seed-privileged-staff.cjs            # DRY RUN
 *   node scripts/loom-seed-privileged-staff.cjs --commit   # apply
 * =========================================================================== */

const path = require('path');

const PROJECT = 'luxardo-flow';
const COMMIT = process.argv.includes('--commit');

const SUPER_ADMIN_EMAIL = 'luxardodigiwork@gmail.com';
const ADMIN_EMAIL = 'abhijeetra799@gmail.com';

let admin;
try {
  admin = require(require.resolve('firebase-admin', { paths: [path.join(__dirname, '..', 'functions')] }));
} catch (e) {
  console.error('ABORT: firebase-admin not found. Run `npm i` in ./functions, or run the three writes in the Firebase console.');
  process.exit(2);
}

(async () => {
  console.log(`Mode    : ${COMMIT ? 'COMMIT (will write)' : 'DRY RUN (no writes; pass --commit)'}`);
  console.log(`Project : ${PROJECT}`);

  try {
    admin.initializeApp({ projectId: PROJECT });
  } catch (e) {
    console.error('ABORT: could not initialise Admin SDK.\n' + (e && e.message));
    console.error('Provide credentials: `gcloud auth application-default login` OR GOOGLE_APPLICATION_CREDENTIALS.');
    process.exit(2);
  }

  const auth = admin.auth();
  const db = admin.firestore();
  const now = new Date().toISOString();

  async function uidFor(email) {
    try { return (await auth.getUserByEmail(email)).uid; }
    catch (e) { return null; }
  }

  const plan = [];

  // ── 1 & 2: privileged staff identity docs ──────────────────────────
  for (const [email, role, name] of [
    [SUPER_ADMIN_EMAIL, 'super_admin', 'Super Admin'],
    [ADMIN_EMAIL, 'admin', 'Admin'],
  ]) {
    const uid = await uidFor(email);
    if (!uid) { console.error(`ABORT: no Firebase Auth account for ${email} in ${PROJECT}.`); process.exit(3); }
    const ref = db.doc(`staff/${uid}`);
    const snap = await ref.get();
    const cur = snap.exists ? snap.data() : null;
    // Existing doc: change ONLY the role (+ reactivate if disabled) — every
    // other field (displayName, email, createdAt, ...) is preserved untouched.
    // Missing doc: create the minimal identity doc.
    const desired = snap.exists
      ? { role, updatedAt: now, ...(cur && cur.active === false ? { active: true } : {}) }
      : { uid, email, displayName: name, role, active: true, createdAt: now, createdBy: 'loom-seed-script', updatedAt: now };
    const changed = !cur || cur.role !== role || cur.active === false;
    plan.push({ what: `staff/${uid}`, email, role, exists: snap.exists, currentRole: cur ? cur.role : null, willWrite: changed, ref, desired });
  }

  // No other staff doc is touched. In particular grade@luxardofashion.com
  // keeps its existing role ("analysis" in the live project) — this script
  // never reads or writes it.

  console.log('\n--- Plan ---');
  for (const p of plan) {
    console.log(JSON.stringify({
      target: p.what, email: p.email, exists: p.exists, currentRole: p.currentRole,
      newRole: p.desired && p.desired.role, willWrite: p.willWrite, note: p.note,
    }));
  }

  const toWrite = plan.filter((p) => p.willWrite && p.ref);
  if (!toWrite.length) { console.log('\nNothing to write — already in the desired state.'); process.exit(0); }

  if (!COMMIT) {
    console.log(`\nDRY RUN complete. ${toWrite.length} write(s) pending. Re-run with --commit to apply.`);
    process.exit(0);
  }

  for (const p of toWrite) {
    await p.ref.set(p.desired, { merge: true });
    console.log(`wrote ${p.what}`);
  }

  // verify
  console.log('\n--- Verify ---');
  let ok = true;
  for (const p of toWrite) {
    const after = (await p.ref.get()).data() || {};
    const good = String(after.role || '').toLowerCase() === String(p.desired.role || '').toLowerCase();
    ok = ok && good;
    console.log(JSON.stringify({ target: p.what, role: after.role, active: after.active, ok: good }));
  }
  console.log(ok ? '\nPASS.' : '\nFAIL: review above.');
  process.exit(ok ? 0 : 5);
})().catch((e) => { console.error('ERROR:', e && (e.message || e)); process.exit(1); });
