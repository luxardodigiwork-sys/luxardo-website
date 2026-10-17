#!/usr/bin/env node
/**
 * Bootstrap / emergency tool: give or remove a staff role without the website.
 * Run in Google Cloud Shell (already signed in as you) from the `functions` folder:
 *   cd functions && npm install --omit=dev
 *   GOOGLE_CLOUD_PROJECT=luxardo-fashion-website node scripts/set-staff-role.js owner@example.com admin
 * Roles: admin | owner | dispatch | none.  (super_admin and analysis do not exist.)
 * The person must have signed in once (Google) so the account exists and the email is verified.
 */
const admin = require("firebase-admin");

const [emailArg, roleArg] = process.argv.slice(2);
const ROLES = ["admin", "owner", "dispatch", "none"];
if (!emailArg || !ROLES.includes(roleArg)) {
  console.error("Usage: node scripts/set-staff-role.js <email> <admin|owner|dispatch|none>");
  process.exit(2);
}
if (!process.env.GOOGLE_CLOUD_PROJECT) {
  console.error("Set GOOGLE_CLOUD_PROJECT first (e.g. GOOGLE_CLOUD_PROJECT=luxardo-fashion-website).");
  process.exit(2);
}
admin.initializeApp({ projectId: process.env.GOOGLE_CLOUD_PROJECT });

(async () => {
  const user = await admin.auth().getUserByEmail(emailArg.trim().toLowerCase());
  if (roleArg !== "none" && !user.emailVerified) {
    throw new Error("Email is not verified. Ask them to sign in with Google first.");
  }
  const claims = { ...(user.customClaims || {}) };
  delete claims.role;
  delete claims.admin;
  if (roleArg !== "none") {
    claims.role = roleArg;
    if (roleArg === "admin") claims.admin = true;
  }
  await admin.auth().setCustomUserClaims(user.uid, Object.keys(claims).length ? claims : null);
  await admin.auth().revokeRefreshTokens(user.uid);
  await admin.firestore().collection("auditLogs").add({ action: "setStaffRole", by: "script", target: user.uid, role: roleArg, at: new Date().toISOString() });
  console.log(`Done: ${emailArg} -> ${roleArg}. They must sign out and sign in again.`);
})().catch((e) => { console.error("Failed:", e.message); process.exit(1); });
