/* eslint-disable */
/**
 * FOCUSED REGRESSION TEST — MED-2 (dispatchAssignTailor authoritative
 * in-transaction tailor validation).
 *
 * Not wired into any test runner (the repo has none yet) — same standalone,
 * emulator-only approach as the other functions/src/__tests__ scripts. NOT
 * exported from functions/src/index.ts, so it is never bundled/deployed.
 *
 * Scenarios:
 *   1. Valid assignment (active tailor, DISPATCH_READY piece) succeeds.
 *   2. Stale-data / TOCTOU: the pre-transaction fast-fail check passes (the
 *      tailor is active when first read), but the tailor is deactivated
 *      BEFORE the transaction's own read of staff/{tailorUid} resolves.
 *      Real concurrent requests cannot reliably land inside this narrow
 *      window on demand, so this is reproduced deterministically by
 *      monkey-patching Transaction.prototype.get (the actual method
 *      transaction.get() calls — it does NOT delegate to
 *      DocumentReference.get(), confirmed by reading
 *      @google-cloud/firestore's transaction.js) to perform the
 *      deactivation write immediately before it resolves the read of that
 *      one specific staff document. This proves the TRANSACTION's own
 *      re-check is what rejects the call, not merely the earlier pre-check.
 *   3. After the stale-data rejection, the piece document is completely
 *      unmutated (still DISPATCH_READY, no assignedTailorUid) — confirming
 *      no partial/inconsistent write occurred.
 *
 * MUST be run against the Firestore emulator only — refuses to run if
 * FIRESTORE_EMULATOR_HOST is not set, so it can never touch a real project.
 *
 * Run (from functions/):
 *   npm run build
 *   firebase emulators:exec --only firestore --project demo-luxardo-test \
 *     "node lib/__tests__/dispatch.med2.test.js"
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
  const db = admin.firestore();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { dispatchAssignTailor } = require("../dispatch");
  const wrappedAssign = testEnv.wrap(dispatchAssignTailor);

  const runId = String(Date.now());
  let pass = true;
  const fail = (msg: string) => {
    console.error(`FAIL: ${msg}`);
    pass = false;
  };

  async function seedDispatch(): Promise<string> {
    const uid = `test-dispatch-${runId}-${Math.random().toString(36).slice(2, 8)}`;
    await db.doc(`staff/${uid}`).set({ role: "dispatch", active: true, displayName: "Test Dispatch" });
    return uid;
  }

  async function seedTailor(active: boolean): Promise<string> {
    const uid = `test-tailor-${runId}-${Math.random().toString(36).slice(2, 8)}`;
    await db.doc(`staff/${uid}`).set({ role: "tailor", active, displayName: "Test Tailor" });
    return uid;
  }

  async function seedPiece(pieceId: string): Promise<void> {
    await db.doc(`pieces/${pieceId}`).set({
      id: pieceId, stage: "DISPATCH_READY", status: "active",
      assignedTailorUid: null, assignedTailorName: null,
      totalLabourMinutes: 0, totalLabourCost: 0,
    });
  }

  // ── Scenario 1: valid assignment succeeds ──────────────────────────────
  {
    const dispatchUid = await seedDispatch();
    const tailorUid = await seedTailor(true);
    const pieceId = `PIECE-MED2TEST-VALID-${runId}`;
    await seedPiece(pieceId);

    try {
      const result: any = await wrappedAssign({ data: { pieceId, tailorUid }, auth: { uid: dispatchUid, token: {} } });
      const snap = await db.doc(`pieces/${pieceId}`).get();
      const d = snap.data();
      console.log(`[1] valid assignment result: ${JSON.stringify(result)}, piece stage now "${d?.stage}".`);
      if (d?.stage !== "TAILOR_ASSIGNED") fail(`[1] expected stage TAILOR_ASSIGNED, got "${d?.stage}".`);
      if (d?.assignedTailorUid !== tailorUid) fail(`[1] expected assignedTailorUid "${tailorUid}", got "${d?.assignedTailorUid}".`);
    } catch (err: any) {
      fail(`[1] expected a valid assignment to succeed, but it threw: ${err?.code ?? err}`);
    }
  }

  // ── Scenario 2 & 3: stale-data TOCTOU — tailor deactivated between the
  // pre-check and the transaction's own read ─────────────────────────────
  {
    const dispatchUid = await seedDispatch();
    const tailorUid = await seedTailor(true); // active at pre-check time
    const pieceId = `PIECE-MED2TEST-STALE-${runId}`;
    await seedPiece(pieceId);
    const staffPath = `staff/${tailorUid}`;

    // Capture the real Transaction prototype (transaction.get() is
    // implemented directly on this class — it does NOT call
    // DocumentReference.get() — so this is the correct interception point).
    let transactionProto: any = null;
    await db.runTransaction(async (tx) => {
      transactionProto = Object.getPrototypeOf(tx);
    });
    const originalGet = transactionProto.get;
    transactionProto.get = function (refOrQuery: any) {
      if (refOrQuery && typeof refOrQuery.path === "string" && refOrQuery.path === staffPath) {
        // Simulate a concurrent Admin staffUpdate landing in the window
        // between the pre-check (already completed) and this transaction's
        // own read of the same document.
        return db.doc(staffPath).update({ active: false })
          .then(() => originalGet.call(this, refOrQuery));
      }
      return originalGet.call(this, refOrQuery);
    };

    try {
      try {
        await wrappedAssign({ data: { pieceId, tailorUid }, auth: { uid: dispatchUid, token: {} } });
        fail(`[2] expected the transaction's authoritative re-check to reject a tailor deactivated mid-flight, but the call succeeded.`);
      } catch (err: any) {
        const code = err?.code ?? "unknown";
        console.log(`[2] stale-data assignment correctly rejected with code "${code}": ${err?.message ?? err}`);
        if (code !== "failed-precondition") fail(`[2] expected rejection code "failed-precondition", got "${code}".`);
      }
    } finally {
      transactionProto.get = originalGet;
    }

    const snap = await db.doc(`pieces/${pieceId}`).get();
    const d = snap.data();
    console.log(`[3] piece after rejected stale assignment: stage "${d?.stage}", assignedTailorUid "${d?.assignedTailorUid}".`);
    if (d?.stage !== "DISPATCH_READY") fail(`[3] expected piece to remain DISPATCH_READY, got "${d?.stage}".`);
    if (d?.assignedTailorUid !== null) fail(`[3] expected assignedTailorUid to remain null, got "${d?.assignedTailorUid}".`);
  }

  if (!pass) {
    console.error("MED-2 REGRESSION TEST: FAIL");
    process.exitCode = 1;
    return;
  }

  console.log(
    "MED-2 REGRESSION TEST: PASS — valid assignment succeeds, and a tailor " +
    "deactivated between the fast-fail pre-check and the transaction's own " +
    "read is correctly rejected by the transaction's authoritative " +
    "re-check, leaving the piece completely unmutated."
  );
}

main().catch((err) => {
  console.error("MED-2 regression test crashed:", err);
  process.exitCode = 1;
});
