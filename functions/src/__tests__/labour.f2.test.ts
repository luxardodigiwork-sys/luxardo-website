/* eslint-disable */
/**
 * FOCUSED REGRESSION TEST — F2 (duplicate open labour session protection).
 *
 * Not wired into any test runner (the repo has none yet) — this is a
 * standalone, emulator-only script per the F2 task's instruction to add a
 * focused regression test "without building a large test framework yet".
 * It is NOT exported from functions/src/index.ts, so it is never bundled or
 * deployed as a Cloud Function.
 *
 * Fires two concurrent labourStart calls for the SAME (pieceId, karigarId)
 * against a real Firestore emulator and asserts exactly one succeeds, the
 * other is rejected with "already-exists", and exactly one open
 * pieceWorkSessions document exists afterward.
 *
 * MUST be run against the Firestore emulator only — refuses to run if
 * FIRESTORE_EMULATOR_HOST is not set, so it can never touch a real project.
 *
 * Run (from functions/):
 *   npm run build
 *   firebase emulators:exec --only firestore --project demo-luxardo-test \
 *     "node lib/__tests__/labour.f2.test.js"
 */
import * as admin from "firebase-admin";

async function main(): Promise<void> {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is not set — refusing to run against a real " +
      "project. Run this via `firebase emulators:exec --only firestore ...`."
    );
  }

  // 1) Prime FIREBASE_CONFIG/GCLOUD_PROJECT for a throwaway test project —
  //    must happen BEFORE admin.initializeApp() below.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const testEnv = require("firebase-functions-test")({ projectId: "demo-luxardo-test" });

  // 2) Initialize the default app now, while FIRESTORE_EMULATOR_HOST is set —
  //    this must happen BEFORE requiring "../labour" below, since that
  //    module's dependency chain calls admin.firestore() at load time.
  admin.initializeApp();
  const db = admin.firestore();

  // 3) Only now require the module under test.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { labourStart } = require("../labour");

  const suffix = String(Date.now());
  const pieceId = `PIECE-F2TEST-${suffix}`;
  const karigarId = `K-F2TEST-${suffix}`;
  const testUid = `test-pm-${suffix}`;

  await db.doc(`staff/${testUid}`).set({
    role: "pm", active: true, displayName: "Test PM",
  });
  await db.doc(`karigars/${karigarId}`).set({
    name: "Test Karigar", hourlyRate: 100, active: true,
  });
  await db.doc(`pieces/${pieceId}`).set({
    id: pieceId, status: "active", stage: "OPEN",
    assignedKarigars: [karigarId], lastKarigarIds: [],
    totalLabourMinutes: 0, totalLabourCost: 0,
  });

  const wrappedStart = testEnv.wrap(labourStart);
  const callData = { data: { pieceId, karigarId }, auth: { uid: testUid, token: {} } };

  const results = await Promise.allSettled([
    wrappedStart(callData),
    wrappedStart(callData),
  ]);

  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

  const sessionsSnap = await db.collection("pieceWorkSessions")
    .where("pieceId", "==", pieceId)
    .where("karigarId", "==", karigarId)
    .get();
  const openSessions = sessionsSnap.docs.filter((d: admin.firestore.QueryDocumentSnapshot) => d.data().endedAt === null);

  console.log(`Concurrent labourStart results: ${fulfilled.length} fulfilled, ${rejected.length} rejected.`);
  console.log(`pieceWorkSessions docs total: ${sessionsSnap.size}, open: ${openSessions.length}`);

  let pass = true;

  if (fulfilled.length !== 1) {
    console.error(`FAIL: expected exactly 1 successful labourStart, got ${fulfilled.length}.`);
    pass = false;
  }

  if (rejected.length !== 1) {
    console.error(`FAIL: expected exactly 1 rejected labourStart, got ${rejected.length}.`);
    pass = false;
  } else {
    const err: any = rejected[0].reason;
    const code = err?.code ?? "unknown";
    console.log(`Rejected call code: ${code}, message: ${err?.message ?? err}`);
    if (code !== "already-exists") {
      console.error(`FAIL: expected rejection code "already-exists", got "${code}".`);
      pass = false;
    }
  }

  if (openSessions.length !== 1) {
    console.error(`FAIL: expected exactly 1 open pieceWorkSessions doc, found ${openSessions.length}.`);
    pass = false;
  }

  if (!pass) {
    console.error("F2 REGRESSION TEST: FAIL");
    process.exitCode = 1;
    return;
  }

  console.log(
    "F2 REGRESSION TEST: PASS — duplicate concurrent labourStart correctly " +
    "rejected; exactly one open session exists for (pieceId, karigarId)."
  );
}

main().catch((err) => {
  console.error("F2 regression test crashed:", err);
  process.exitCode = 1;
});
