/* eslint-disable */
/**
 * FOCUSED RULES REGRESSION TEST — CRIT-2 (customers/{uid} self-write role
 * lockdown).
 *
 * Uses @firebase/rules-unit-testing against the real Firestore emulator's
 * rules engine (not a mock) — this loads the ACTUAL firestore.rules file
 * from disk and evaluates real client SDK calls against it, exactly as
 * production Firestore would.
 *
 * Not wired into any test runner (the repo has none yet) — a standalone,
 * emulator-only script, same family as firestore.rules.high3.test.ts.
 * NOT exported from functions/src/index.ts.
 *
 * Scenarios (against the CURRENT, post-CRIT-2-fix firestore.rules):
 *   1. A plain signed-in customer can no longer self-elevate role to
 *      'super_admin' on an EXISTING customers/{uid} doc (previously
 *      allowed by an unrestricted self-write rule; now must be denied).
 *   2. The same self-write attempt with role:'admin' is also denied.
 *   3. A brand-new signup create with the legitimate fixed role:'customer'
 *      still succeeds (matches src/pages/LoginPage.tsx createCustomerDoc).
 *   4. A create attempting role:'admin' on signup is denied.
 *   5. A normal self-update that leaves role untouched (e.g. preference
 *      sync) still succeeds — read/update access for non-role fields is
 *      unchanged.
 *   6. Self-read of one's own doc still succeeds (unchanged).
 *
 * MUST be run against the Firestore emulator only — refuses to run if
 * FIRESTORE_EMULATOR_HOST is not set, so it can never touch a real project.
 *
 * Run (from functions/):
 *   npm run build
 *   firebase emulators:exec --only firestore --project demo-luxardo-test \
 *     "node lib/__tests__/firestore.rules.crit2.test.js"
 */
import * as fs from "fs";
import * as path from "path";

async function main(): Promise<void> {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (!emulatorHost) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is not set — refusing to run against a real " +
      "project. Run this via `firebase emulators:exec --only firestore ...`."
    );
  }
  const [host, portStr] = emulatorHost.split(":");
  const port = Number(portStr);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { doc, setDoc, getDoc } = require("firebase/firestore");

  const rulesPath = path.join(__dirname, "..", "..", "..", "firestore.rules");
  const rules = fs.readFileSync(rulesPath, "utf8");

  const testEnv = await initializeTestEnvironment({
    projectId: "demo-luxardo-rules-test",
    firestore: { rules, host, port },
  });

  let pass = true;
  const fail = (msg: string) => {
    console.error(`FAIL: ${msg}`);
    pass = false;
  };

  try {
    await testEnv.clearFirestore();

    const customerUid = "rules-test-customer";
    const newSignupUid = "rules-test-new-signup";
    const updateOnlyUid = "rules-test-update-only";

    // Seed a pre-existing customer doc (bypassing rules — fixture setup).
    await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
      await ctx.firestore().doc(`customers/${customerUid}`).set({
        id: customerUid, name: "Rules Test Customer", email: "rtc@example.test",
        role: "customer", isPrimeMember: false,
      });
      await ctx.firestore().doc(`customers/${updateOnlyUid}`).set({
        id: updateOnlyUid, name: "Rules Test Update Only", email: "rtu@example.test",
        role: "customer", isPrimeMember: false,
      });
    });

    const customerCtx = testEnv.authenticatedContext(customerUid);
    const newSignupCtx = testEnv.authenticatedContext(newSignupUid);
    const updateOnlyCtx = testEnv.authenticatedContext(updateOnlyUid);

    // ── Scenario 1: self-elevation to super_admin on existing doc — DENIED ──
    try {
      await assertFails(
        setDoc(doc(customerCtx.firestore(), `customers/${customerUid}`),
          { role: "super_admin" }, { merge: true })
      );
      console.log("[1] self-elevation to 'super_admin' correctly DENIED.");
    } catch (err: any) {
      fail(`[1] expected self-elevation to super_admin to be denied: ${err?.message ?? err}`);
    }

    // ── Scenario 2: self-elevation to admin on existing doc — DENIED ────────
    try {
      await assertFails(
        setDoc(doc(customerCtx.firestore(), `customers/${customerUid}`),
          { role: "admin" }, { merge: true })
      );
      console.log("[2] self-elevation to 'admin' correctly DENIED.");
    } catch (err: any) {
      fail(`[2] expected self-elevation to admin to be denied: ${err?.message ?? err}`);
    }

    // ── Scenario 3: legitimate signup create (role:'customer') — ALLOWED ────
    try {
      await assertSucceeds(
        setDoc(doc(newSignupCtx.firestore(), `customers/${newSignupUid}`), {
          id: newSignupUid, name: "New Signup", email: "new@example.test",
          role: "customer", isPrimeMember: false,
        })
      );
      console.log("[3] legitimate signup create with role:'customer' correctly ALLOWED.");
    } catch (err: any) {
      fail(`[3] expected legitimate signup create to remain allowed: ${err?.message ?? err}`);
    }

    // ── Scenario 4: signup create attempting role:'admin' — DENIED ──────────
    try {
      await assertFails(
        setDoc(doc(newSignupCtx.firestore(), `customers/rules-test-new-signup-2`), {
          id: "rules-test-new-signup-2", name: "Escalating Signup", email: "esc@example.test",
          role: "admin", isPrimeMember: false,
        })
      );
      console.log("[4] signup create with role:'admin' correctly DENIED.");
    } catch (err: any) {
      fail(`[4] expected escalating signup create to be denied: ${err?.message ?? err}`);
    }

    // ── Scenario 5: self-update leaving role untouched — ALLOWED (unchanged) ─
    try {
      await assertSucceeds(
        setDoc(doc(updateOnlyCtx.firestore(), `customers/${updateOnlyUid}`),
          { isPrimeMember: true, lastUpdated: "2026-09-22" }, { merge: true })
      );
      console.log("[5] self-update without touching role correctly ALLOWED (unchanged).");
    } catch (err: any) {
      fail(`[5] expected non-role self-update to remain allowed: ${err?.message ?? err}`);
    }

    // ── Scenario 6: self-read still ALLOWED (unchanged) ──────────────────────
    try {
      await assertSucceeds(getDoc(doc(customerCtx.firestore(), `customers/${customerUid}`)));
      console.log("[6] self-read correctly ALLOWED (unchanged).");
    } catch (err: any) {
      fail(`[6] expected self-read to remain allowed: ${err?.message ?? err}`);
    }
  } finally {
    await testEnv.cleanup();
  }

  if (!pass) {
    console.error("CRIT-2 RULES REGRESSION TEST: FAIL");
    process.exitCode = 1;
    return;
  }

  console.log(
    "CRIT-2 RULES REGRESSION TEST: PASS — a customer can no longer self-" +
    "elevate role on their own customers/{uid} doc (create or update), " +
    "the legitimate fixed-role signup create still works, and non-role " +
    "self-read/self-update access is unchanged."
  );
}

main().catch((err) => {
  console.error("CRIT-2 rules regression test crashed:", err);
  process.exitCode = 1;
});
