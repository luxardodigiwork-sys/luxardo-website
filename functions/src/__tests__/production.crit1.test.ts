/* eslint-disable */
/**
 * FOCUSED REGRESSION TEST — CRIT-1 (nextId authorization gate).
 *
 * Not wired into any test runner (the repo has none yet) — same standalone,
 * emulator-only approach as labour.f2.test.ts / labour.f3.test.ts. NOT
 * exported from functions/src/index.ts, so it is never bundled or deployed.
 *
 * Scenarios:
 *   1. An authenticated caller with NO staff/{uid} doc and no admin-role
 *      customers/{uid} doc (i.e. a plain B2C customer / unrecognised
 *      identity) is rejected with permission-denied.
 *   2. An authenticated caller with a valid canonical staff/{uid} doc
 *      (role: "pm") succeeds and receives a correctly-formatted, incrementing
 *      ID for the requested domain — confirming existing ID-generation
 *      behaviour (prefix, zero-padding, monotonic increment) is unchanged.
 *
 * MUST be run against the Firestore emulator only — refuses to run if
 * FIRESTORE_EMULATOR_HOST is not set, so it can never touch a real project.
 *
 * Run (from functions/):
 *   npm run build
 *   firebase emulators:exec --only firestore --project demo-luxardo-test \
 *     "node lib/__tests__/production.crit1.test.js"
 */
import * as admin from "firebase-admin";

async function main(): Promise<void> {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is not set — refusing to run against a real " +
      "project. Run this via `firebase emulators:exec --only firestore ...`."
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const testEnv = require("firebase-functions-test")({ projectId: "demo-luxardo-test" });

  admin.initializeApp();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { nextId } = require("../production");
  const wrappedNextId = testEnv.wrap(nextId);

  const runId = String(Date.now());
  let pass = true;
  const fail = (msg: string) => {
    console.error(`FAIL: ${msg}`);
    pass = false;
  };

  // ── Scenario 1: unauthorized caller (no staff doc, no admin customer doc) ──
  {
    const uid = `test-customer-${runId}`;
    // Deliberately: no staff/{uid} doc, no customers/{uid} doc at all —
    // mirrors a plain, unrecognised authenticated identity (e.g. a B2C
    // customer or anonymous Firebase Auth session).
    try {
      await wrappedNextId({ data: { domain: "karigar" }, auth: { uid, token: {} } });
      fail("[1] expected nextId to reject an unauthorized caller, but it succeeded.");
    } catch (err: any) {
      const code = err?.code ?? "unknown";
      console.log(`[1] Unauthorized caller rejected with code "${code}": ${err?.message ?? err}`);
      if (code !== "permission-denied") {
        fail(`[1] expected rejection code "permission-denied", got "${code}".`);
      }
    }
  }

  // ── Scenario 2: authorized staff caller succeeds, IDs behave as before ──
  {
    const db = admin.firestore();
    const uid = `test-pm-${runId}`;
    await db.doc(`staff/${uid}`).set({ role: "pm", active: true, displayName: "Test PM" });

    try {
      const r1: any = await wrappedNextId({ data: { domain: "karigar" }, auth: { uid, token: {} } });
      const r2: any = await wrappedNextId({ data: { domain: "karigar" }, auth: { uid, token: {} } });
      console.log(`[2] Authorized calls returned ids: "${r1?.id}", "${r2?.id}"`);

      if (typeof r1?.id !== "string" || !/^K-\d{4}$/.test(r1.id)) {
        fail(`[2] expected first id to match "K-XXXX", got "${r1?.id}".`);
      }
      if (typeof r2?.id !== "string" || !/^K-\d{4}$/.test(r2.id)) {
        fail(`[2] expected second id to match "K-XXXX", got "${r2?.id}".`);
      }
      if (r1?.id && r2?.id) {
        const n1 = parseInt(r1.id.split("-")[1], 10);
        const n2 = parseInt(r2.id.split("-")[1], 10);
        if (n2 !== n1 + 1) {
          fail(`[2] expected the counter to increment by exactly 1 between calls, got ${n1} then ${n2}.`);
        }
      }
    } catch (err: any) {
      fail(`[2] expected nextId to succeed for an authorized staff (pm) caller, but it threw: ${err?.code ?? err}`);
    }
  }

  if (!pass) {
    console.error("CRIT-1 REGRESSION TEST: FAIL");
    process.exitCode = 1;
    return;
  }

  console.log(
    "CRIT-1 REGRESSION TEST: PASS — unauthorized callers are rejected with " +
    "permission-denied, and authorized staff callers still get correctly " +
    "formatted, monotonically incrementing IDs."
  );
}

main().catch((err) => {
  console.error("CRIT-1 regression test crashed:", err);
  process.exitCode = 1;
});
