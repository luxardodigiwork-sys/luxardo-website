/* eslint-disable */
/**
 * FOCUSED REGRESSION TEST — F3 (labourStart stage-precondition protection),
 * plus a combined regression check that F1 and F2 remain intact.
 *
 * Not wired into any test runner (the repo has none yet) — a standalone,
 * emulator-only script, same approach as labour.f2.test.ts. NOT exported
 * from functions/src/index.ts, so it is never bundled or deployed.
 *
 * Scenarios:
 *   1. labourStart on a valid OPEN piece succeeds (stage -> IN_WORK).
 *   2. labourStart on a valid REWORK piece succeeds (stage -> IN_WORK).
 *   3. labourStart on an invalid stage (DISPATCH_READY) is rejected with
 *      failed-precondition and the piece is left completely untouched.
 *   4. F2 regression: two concurrent labourStart calls for the same
 *      (pieceId, karigarId) still yield exactly 1 success + 1 "already-exists".
 *   5. F1 regression: a normal start -> stop cycle still correctly persists
 *      totalLabourMinutes/totalLabourCost on the piece.
 *
 * MUST be run against the Firestore emulator only — refuses to run if
 * FIRESTORE_EMULATOR_HOST is not set, so it can never touch a real project.
 *
 * Run (from functions/):
 *   npm run build
 *   firebase emulators:exec --only firestore --project demo-luxardo-test \
 *     "node lib/__tests__/labour.f3.test.js"
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
  const { labourStart, labourStop } = require("../labour");
  const wrappedStart = testEnv.wrap(labourStart);
  const wrappedStop = testEnv.wrap(labourStop);

  const runId = String(Date.now());
  let pass = true;
  const fail = (msg: string) => {
    console.error(`FAIL: ${msg}`);
    pass = false;
  };

  async function seedActor(): Promise<string> {
    const uid = `test-pm-${runId}-${Math.random().toString(36).slice(2, 8)}`;
    await db.doc(`staff/${uid}`).set({ role: "pm", active: true, displayName: "Test PM" });
    return uid;
  }

  async function seedKarigar(): Promise<string> {
    const karigarId = `K-F3TEST-${runId}-${Math.random().toString(36).slice(2, 8)}`;
    await db.doc(`karigars/${karigarId}`).set({ name: "Test Karigar", hourlyRate: 120, active: true });
    return karigarId;
  }

  async function seedPiece(pieceId: string, stage: string, status: string, karigarId: string): Promise<void> {
    await db.doc(`pieces/${pieceId}`).set({
      id: pieceId, status, stage,
      assignedKarigars: [karigarId], lastKarigarIds: [],
      totalLabourMinutes: 0, totalLabourCost: 0,
    });
  }

  // ── Scenario 1: valid OPEN -> IN_WORK ──────────────────────────────────
  {
    const uid = await seedActor();
    const karigarId = await seedKarigar();
    const pieceId = `PIECE-F3TEST-OPEN-${runId}`;
    await seedPiece(pieceId, "OPEN", "active", karigarId);

    try {
      await wrappedStart({ data: { pieceId, karigarId }, auth: { uid, token: {} } });
      const snap = await db.doc(`pieces/${pieceId}`).get();
      const stage = snap.data()?.stage;
      console.log(`[1] OPEN start -> stage now "${stage}"`);
      if (stage !== "IN_WORK") fail(`[1] expected piece stage IN_WORK after start from OPEN, got "${stage}".`);
    } catch (err: any) {
      fail(`[1] expected labourStart to succeed from OPEN, but it threw: ${err?.code ?? err}`);
    }
  }

  // ── Scenario 2: valid REWORK -> IN_WORK ─────────────────────────────────
  {
    const uid = await seedActor();
    const karigarId = await seedKarigar();
    const pieceId = `PIECE-F3TEST-REWORK-${runId}`;
    await seedPiece(pieceId, "REWORK", "in_rework", karigarId);

    try {
      await wrappedStart({ data: { pieceId, karigarId }, auth: { uid, token: {} } });
      const snap = await db.doc(`pieces/${pieceId}`).get();
      const stage = snap.data()?.stage;
      console.log(`[2] REWORK start -> stage now "${stage}"`);
      if (stage !== "IN_WORK") fail(`[2] expected piece stage IN_WORK after start from REWORK, got "${stage}".`);
    } catch (err: any) {
      fail(`[2] expected labourStart to succeed from REWORK, but it threw: ${err?.code ?? err}`);
    }
  }

  // ── Scenario 3: invalid stage (DISPATCH_READY) rejected ────────────────
  {
    const uid = await seedActor();
    const karigarId = await seedKarigar();
    const pieceId = `PIECE-F3TEST-DISPATCH-${runId}`;
    await seedPiece(pieceId, "DISPATCH_READY", "active", karigarId);

    try {
      await wrappedStart({ data: { pieceId, karigarId }, auth: { uid, token: {} } });
      fail(`[3] expected labourStart to be rejected from DISPATCH_READY, but it succeeded.`);
    } catch (err: any) {
      const code = err?.code ?? "unknown";
      console.log(`[3] DISPATCH_READY start rejected with code "${code}": ${err?.message ?? err}`);
      if (code !== "failed-precondition") {
        fail(`[3] expected rejection code "failed-precondition", got "${code}".`);
      }
    }
    const snap = await db.doc(`pieces/${pieceId}`).get();
    const stage = snap.data()?.stage;
    if (stage !== "DISPATCH_READY") {
      fail(`[3] expected piece stage to remain DISPATCH_READY after rejected start, got "${stage}".`);
    }
    const sessSnap = await db.collection("pieceWorkSessions").where("pieceId", "==", pieceId).get();
    if (!sessSnap.empty) {
      fail(`[3] expected no pieceWorkSessions doc to be created for a rejected start, found ${sessSnap.size}.`);
    }
  }

  // ── Scenario 4: F2 regression — duplicate concurrent starts still blocked ──
  {
    const uid = await seedActor();
    const karigarId = await seedKarigar();
    const pieceId = `PIECE-F3TEST-F2CHECK-${runId}`;
    await seedPiece(pieceId, "OPEN", "active", karigarId);

    const callData = { data: { pieceId, karigarId }, auth: { uid, token: {} } };
    const results = await Promise.allSettled([wrappedStart(callData), wrappedStart(callData)]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    console.log(`[4] Concurrent duplicate starts: ${fulfilled.length} fulfilled, ${rejected.length} rejected.`);
    if (fulfilled.length !== 1) fail(`[4] expected exactly 1 fulfilled concurrent start, got ${fulfilled.length}.`);
    if (rejected.length !== 1) {
      fail(`[4] expected exactly 1 rejected concurrent start, got ${rejected.length}.`);
    } else {
      const code = (rejected[0].reason as any)?.code ?? "unknown";
      if (code !== "already-exists") fail(`[4] expected rejection code "already-exists", got "${code}".`);
    }
    const sessSnap = await db.collection("pieceWorkSessions")
      .where("pieceId", "==", pieceId).where("karigarId", "==", karigarId).get();
    const open = sessSnap.docs.filter((d: admin.firestore.QueryDocumentSnapshot) => d.data().endedAt === null);
    if (open.length !== 1) fail(`[4] expected exactly 1 open session after duplicate-start race, found ${open.length}.`);
  }

  // ── Scenario 5: F1 regression — start/stop totals still correct ────────
  {
    const uid = await seedActor();
    const karigarId = await seedKarigar();
    const pieceId = `PIECE-F3TEST-F1CHECK-${runId}`;
    await seedPiece(pieceId, "OPEN", "active", karigarId);

    const startResult: any = await wrappedStart({ data: { pieceId, karigarId }, auth: { uid, token: {} } });
    const sessionId = startResult?.sessionId;
    if (!sessionId) {
      fail(`[5] expected labourStart to return a sessionId.`);
    } else {
      const stopResult: any = await wrappedStop({ data: { sessionId }, auth: { uid, token: {} } });
      console.log(`[5] labourStop result: ${JSON.stringify(stopResult)}`);
      const pieceSnap = await db.doc(`pieces/${pieceId}`).get();
      const p = pieceSnap.data();
      console.log(`[5] piece totals after stop: minutes=${p?.totalLabourMinutes}, cost=${p?.totalLabourCost}`);
      if (typeof p?.totalLabourMinutes !== "number" || p.totalLabourMinutes !== stopResult.minutes) {
        fail(`[5] expected piece.totalLabourMinutes to equal the session's minutes (${stopResult.minutes}), got ${p?.totalLabourMinutes}.`);
      }
      if (typeof p?.totalLabourCost !== "number" || p.totalLabourCost !== stopResult.labourCost) {
        fail(`[5] expected piece.totalLabourCost to equal the session's labourCost (${stopResult.labourCost}), got ${p?.totalLabourCost}.`);
      }
    }
  }

  if (!pass) {
    console.error("F3 REGRESSION TEST: FAIL");
    process.exitCode = 1;
    return;
  }

  console.log(
    "F3 REGRESSION TEST: PASS — valid OPEN/REWORK starts succeed, invalid " +
    "stage starts are rejected untouched, and F1/F2 behaviour remain intact."
  );
}

main().catch((err) => {
  console.error("F3 regression test crashed:", err);
  process.exitCode = 1;
});
