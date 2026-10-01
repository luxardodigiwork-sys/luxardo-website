/* eslint-disable */
/**
 * FOCUSED REGRESSION TEST — HIGH-2 (approveTailorRequest stuck-PENDING /
 * orphaned-provisioning fix).
 *
 * Not wired into any test runner (the repo has none yet) — same standalone,
 * emulator-only approach as labour.f2/f3.test.ts and production.crit1.test.ts.
 * NOT exported from functions/src/index.ts, so it is never bundled/deployed.
 *
 * Scenarios:
 *   1. Normal approve: PENDING -> APPROVED, Tailor Auth user + staff/{uid}
 *      created, createdTailorUid recorded.
 *   2. Idempotent re-approve: calling approve again on an already-APPROVED
 *      request (with createdTailorUid already set) returns the same
 *      tailorUid and creates NO second Auth user.
 *   3. HIGH-2 core fix — self-heal from the exact broken intermediate state
 *      the original bug produced: a tailorRequests doc stuck at
 *      status "APPROVED" with createdTailorUid still null, but a REAL
 *      Tailor Auth user (+ staff/{uid}) already provisioned for that email
 *      (simulating "provisioning succeeded, the bookkeeping write failed").
 *      Calling approveTailorRequest again must: succeed, return the EXISTING
 *      uid (not create a second Auth user), and backfill createdTailorUid —
 *      never rolling the request back to PENDING.
 *   4. Non-regression: provisionStaffAccount itself failing (email already
 *      registered before any approval) still correctly rolls the request
 *      back to PENDING for a clean retry — the original, still-correct path.
 *
 * MUST be run against the Firestore + Auth emulators only — refuses to run
 * if FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST are not set, so
 * it can never touch a real project.
 *
 * Run (from functions/):
 *   npm run build
 *   firebase emulators:exec --only firestore,auth --project demo-luxardo-test \
 *     "node lib/__tests__/tailorRequests.high2.test.js"
 */
import * as admin from "firebase-admin";

async function main(): Promise<void> {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is not set — refusing to run against a real " +
      "project. Run this via `firebase emulators:exec --only firestore,auth ...`."
    );
  }
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error(
      "FIREBASE_AUTH_EMULATOR_HOST is not set — refusing to run against a " +
      "real project. Run this via `firebase emulators:exec --only " +
      "firestore,auth ...`."
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const testEnv = require("firebase-functions-test")({ projectId: "demo-luxardo-test" });

  admin.initializeApp();
  const db = admin.firestore();
  const auth = admin.auth();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { approveTailorRequest } = require("../tailorRequests");
  const wrappedApprove = testEnv.wrap(approveTailorRequest);

  const runId = String(Date.now());
  let pass = true;
  const fail = (msg: string) => {
    console.error(`FAIL: ${msg}`);
    pass = false;
  };

  async function seedReviewer(): Promise<string> {
    const uid = `test-owner-${runId}-${Math.random().toString(36).slice(2, 8)}`;
    await db.doc(`staff/${uid}`).set({ role: "owner", active: true, displayName: "Test Owner" });
    return uid;
  }

  async function seedRequest(id: string, email: string, overrides: Record<string, unknown> = {}): Promise<void> {
    await db.doc(`tailorRequests/${id}`).set({
      id, name: "Test Tailor", email, reason: "test",
      status: "PENDING",
      requestedByUid: "dispatch-uid", requestedByName: "Test Dispatch", requestedAt: new Date().toISOString(),
      reviewedByUid: null, reviewedByName: null, reviewedAt: null,
      createdTailorUid: null, createdTailorName: null, rejectionReason: null,
      ...overrides,
    });
  }

  // ── Scenario 1: normal approve ─────────────────────────────────────────
  {
    const reviewerUid = await seedReviewer();
    const requestId = `TR-H2TEST-NORMAL-${runId}`;
    const email = `tailor-normal-${runId}@example.test`;
    await seedRequest(requestId, email);

    try {
      const result: any = await wrappedApprove({ data: { requestId }, auth: { uid: reviewerUid, token: {} } });
      console.log(`[1] approve result: ${JSON.stringify(result)}`);
      const snap = await db.doc(`tailorRequests/${requestId}`).get();
      const d = snap.data();
      if (d?.status !== "APPROVED") fail(`[1] expected status APPROVED, got "${d?.status}".`);
      if (!d?.createdTailorUid) fail(`[1] expected createdTailorUid to be set.`);
      const userRec = await auth.getUserByEmail(email).catch(() => null);
      if (!userRec) fail(`[1] expected a real Auth user to have been created for ${email}.`);
    } catch (err: any) {
      fail(`[1] expected approve to succeed, but it threw: ${err?.code ?? err}`);
    }
  }

  // ── Scenario 2: idempotent re-approve (already has createdTailorUid) ───
  {
    const reviewerUid = await seedReviewer();
    const requestId = `TR-H2TEST-IDEMPOTENT-${runId}`;
    const email = `tailor-idempotent-${runId}@example.test`;
    await seedRequest(requestId, email);

    const first: any = await wrappedApprove({ data: { requestId }, auth: { uid: reviewerUid, token: {} } });
    const second: any = await wrappedApprove({ data: { requestId }, auth: { uid: reviewerUid, token: {} } });
    console.log(`[2] first: ${JSON.stringify(first)}, second: ${JSON.stringify(second)}`);

    if (second?.tailorUid !== first?.tailorUid) {
      fail(`[2] expected the second approve to return the SAME tailorUid, got "${second?.tailorUid}" vs "${first?.tailorUid}".`);
    }
    if (!second?.alreadyApproved) {
      fail(`[2] expected the second approve to report alreadyApproved: true.`);
    }
  }

  // ── Scenario 3: HIGH-2 core fix — self-heal from stuck-APPROVED/null-uid ──
  {
    const reviewerUid = await seedReviewer();
    const requestId = `TR-H2TEST-STUCK-${runId}`;
    const email = `tailor-stuck-${runId}@example.test`;

    // Simulate "provisionStaffAccount already fully succeeded on a prior
    // attempt, but the trailing tailorRequests bookkeeping write failed" —
    // exactly the intermediate state the original HIGH-2 bug produced.
    const preExisting = await auth.createUser({ email, displayName: "Test Tailor", password: "irrelevant123" });
    await db.doc(`staff/${preExisting.uid}`).set({
      uid: preExisting.uid, displayName: "Test Tailor", email, role: "tailor",
      active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: reviewerUid,
    });
    await seedRequest(requestId, email, {
      status: "APPROVED",
      reviewedByUid: reviewerUid, reviewedByName: "Test Owner", reviewedAt: new Date().toISOString(),
      createdTailorUid: null, createdTailorName: null,
    });

    try {
      const result: any = await wrappedApprove({ data: { requestId }, auth: { uid: reviewerUid, token: {} } });
      console.log(`[3] self-heal result: ${JSON.stringify(result)}`);

      if (result?.tailorUid !== preExisting.uid) {
        fail(`[3] expected self-heal to return the EXISTING uid "${preExisting.uid}", got "${result?.tailorUid}".`);
      }

      const snap = await db.doc(`tailorRequests/${requestId}`).get();
      const d = snap.data();
      if (d?.status !== "APPROVED") {
        fail(`[3] expected request to remain APPROVED (never rolled back to PENDING), got "${d?.status}".`);
      }
      if (d?.createdTailorUid !== preExisting.uid) {
        fail(`[3] expected createdTailorUid to be backfilled to "${preExisting.uid}", got "${d?.createdTailorUid}".`);
      }

      // Confirm NO second Auth user was created for this email.
      const userRec = await auth.getUserByEmail(email);
      if (userRec.uid !== preExisting.uid) {
        fail(`[3] expected exactly one Auth user for ${email}, but getUserByEmail returned a different uid.`);
      }
    } catch (err: any) {
      fail(`[3] expected self-heal to succeed, but it threw: ${err?.code ?? err?.message ?? err}`);
    }
  }

  // ── Scenario 4: non-regression — provisioning failure still rolls back to PENDING ──
  {
    const reviewerUid = await seedReviewer();
    const requestId = `TR-H2TEST-PROVISIONFAIL-${runId}`;
    const email = `tailor-conflict-${runId}@example.test`;

    // Pre-create a real Auth user for this email BEFORE any approval attempt,
    // so provisionStaffAccount's own createUser() call fails with
    // already-exists — the ORIGINAL, still-intended rollback path.
    await auth.createUser({ email, displayName: "Unrelated Existing User", password: "irrelevant123" });
    await seedRequest(requestId, email);

    try {
      await wrappedApprove({ data: { requestId }, auth: { uid: reviewerUid, token: {} } });
      fail(`[4] expected approve to fail when the email is already registered, but it succeeded.`);
    } catch (err: any) {
      console.log(`[4] approve correctly failed with code "${err?.code}": ${err?.message ?? err}`);
    }

    const snap = await db.doc(`tailorRequests/${requestId}`).get();
    const d = snap.data();
    if (d?.status !== "PENDING") {
      fail(`[4] expected request to roll back to PENDING after a genuine provisioning failure, got "${d?.status}".`);
    }
    if (d?.reviewedByUid !== null) {
      fail(`[4] expected reviewedByUid to be cleared back to null after rollback, got "${d?.reviewedByUid}".`);
    }
  }

  if (!pass) {
    console.error("HIGH-2 REGRESSION TEST: FAIL");
    process.exitCode = 1;
    return;
  }

  console.log(
    "HIGH-2 REGRESSION TEST: PASS — normal approve, idempotent re-approve, " +
    "stuck-request self-heal (no duplicate account, no PENDING rollback), " +
    "and genuine-provisioning-failure rollback all behave correctly."
  );
}

main().catch((err) => {
  console.error("HIGH-2 regression test crashed:", err);
  process.exitCode = 1;
});
