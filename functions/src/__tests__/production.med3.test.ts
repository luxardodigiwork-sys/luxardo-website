/* eslint-disable */
/**
 * FOCUSED REGRESSION TEST — MED-3 (provisionStaffAccount orphan-cleanup
 * logging when the compensating Auth-user delete also fails).
 *
 * Not wired into any test runner (the repo has none yet) — same standalone,
 * emulator-only approach as the other functions/src/__tests__ scripts. NOT
 * exported from functions/src/index.ts, so it is never bundled/deployed.
 *
 * provisionStaffAccount is a plain exported async function (not an onCall),
 * so it is called directly here — no firebase-functions-test wrap needed.
 *
 * Scenarios:
 *   1. Non-regression: batch-commit fails, but the compensating Auth-user
 *      delete SUCCEEDS — the original (already-correct) silent-but-clean
 *      rollback path. No STAFF_PROVISION_ORPHAN audit entry should be
 *      written in this case (this fix only adds logging for the OTHER,
 *      double-failure branch), and the Auth account must actually be gone.
 *   2. Core fix: batch-commit fails AND the compensating delete ALSO fails.
 *      A STAFF_PROVISION_ORPHAN audit entry must be written referencing the
 *      orphaned uid/email, the original batch-commit error must still be
 *      the one thrown to the caller (not masked), and the orphaned Auth
 *      account genuinely still exists (proving it really is an orphan the
 *      operator needs to find).
 *
 * Both scenarios deterministically simulate the failures via one-shot
 * monkey-patches of db.batch() and admin.auth().deleteUser() (both return
 * process-wide Firestore/Auth singletons, so patching them here reaches the
 * same instances production.ts uses) — restored immediately after use.
 *
 * MUST be run against the Firestore + Auth emulators only — refuses to run
 * if FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST are not set, so
 * it can never touch a real project.
 *
 * Run (from functions/):
 *   npm run build
 *   firebase emulators:exec --only firestore,auth --project demo-luxardo-test \
 *     "node lib/__tests__/production.med3.test.js"
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
  require("firebase-functions-test")({ projectId: "demo-luxardo-test" });

  admin.initializeApp();
  const db = admin.firestore();
  const auth = admin.auth();

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { provisionStaffAccount } = require("../production");

  const runId = String(Date.now());
  let pass = true;
  const fail = (msg: string) => {
    console.error(`FAIL: ${msg}`);
    pass = false;
  };

  function armOneShotBatchFailure(): () => void {
    const originalBatch = db.batch.bind(db);
    let armed = true;
    (db as any).batch = () => {
      const batch = originalBatch();
      if (armed) {
        armed = false;
        batch.commit = async () => {
          throw new Error("SIMULATED_BATCH_FAILURE");
        };
      }
      return batch;
    };
    return () => {
      (db as any).batch = originalBatch;
    };
  }

  function armOneShotDeleteFailure(): () => void {
    const originalDeleteUser = auth.deleteUser.bind(auth);
    let armed = true;
    (auth as any).deleteUser = async (uid: string) => {
      if (armed) {
        armed = false;
        throw new Error("SIMULATED_DELETE_FAILURE");
      }
      return originalDeleteUser(uid);
    };
    return () => {
      (auth as any).deleteUser = originalDeleteUser;
    };
  }

  async function findOrphanAudit(email: string): Promise<admin.firestore.QueryDocumentSnapshot | null> {
    const snap = await db.collection("auditLogs")
      .where("action", "==", "STAFF_PROVISION_ORPHAN")
      .get();
    const match = snap.docs.find((d) => d.data()?.after?.email === email);
    return match || null;
  }

  // ── Scenario 1: batch fails, delete SUCCEEDS — no orphan, no audit entry ──
  {
    const email = `med3-clean-${runId}@example.test`;
    const restoreBatch = armOneShotBatchFailure();
    try {
      await provisionStaffAccount({
        displayName: "Test Tailor Clean", email, role: "tailor", createdByUid: "test-admin-uid",
      });
      fail(`[1] expected provisionStaffAccount to throw when the batch commit fails, but it succeeded.`);
    } catch (err: any) {
      console.log(`[1] provisionStaffAccount correctly threw: ${err?.message ?? err}`);
      if (!String(err?.message ?? err).includes("SIMULATED_BATCH_FAILURE")) {
        fail(`[1] expected the original batch-commit error to propagate, got: ${err?.message ?? err}`);
      }
    } finally {
      restoreBatch();
    }

    const orphanAudit = await findOrphanAudit(email);
    if (orphanAudit) {
      fail(`[1] expected NO STAFF_PROVISION_ORPHAN audit entry when the compensating delete succeeds, but found one: ${JSON.stringify(orphanAudit.data())}`);
    } else {
      console.log(`[1] correctly wrote no STAFF_PROVISION_ORPHAN audit entry (clean rollback).`);
    }

    const stillExists = await auth.getUserByEmail(email).then(() => true).catch(() => false);
    if (stillExists) {
      fail(`[1] expected the Auth user to have been deleted by the successful compensating rollback, but it still exists.`);
    } else {
      console.log(`[1] confirmed the Auth account was correctly cleaned up (no orphan).`);
    }
  }

  // ── Scenario 2: batch fails AND delete ALSO fails — orphan must be logged ──
  {
    const email = `med3-orphan-${runId}@example.test`;
    const restoreBatch = armOneShotBatchFailure();
    const restoreDelete = armOneShotDeleteFailure();
    try {
      await provisionStaffAccount({
        displayName: "Test Tailor Orphan", email, role: "tailor", createdByUid: "test-admin-uid",
      });
      fail(`[2] expected provisionStaffAccount to throw when the batch commit fails, but it succeeded.`);
    } catch (err: any) {
      console.log(`[2] provisionStaffAccount correctly threw: ${err?.message ?? err}`);
      if (!String(err?.message ?? err).includes("SIMULATED_BATCH_FAILURE")) {
        fail(`[2] expected the ORIGINAL batch-commit error to propagate (not masked by the cleanup failure), got: ${err?.message ?? err}`);
      }
    } finally {
      restoreBatch();
      restoreDelete();
    }

    const orphanAudit = await findOrphanAudit(email);
    if (!orphanAudit) {
      fail(`[2] expected a STAFF_PROVISION_ORPHAN audit entry when the compensating delete ALSO fails, but found none.`);
    } else {
      const data = orphanAudit.data();
      console.log(`[2] found STAFF_PROVISION_ORPHAN audit entry: ${JSON.stringify(data)}`);
      if (data.after?.email !== email) fail(`[2] expected audit entry's after.email to be "${email}", got "${data.after?.email}".`);
      if (data.after?.role !== "tailor") fail(`[2] expected audit entry's after.role to be "tailor", got "${data.after?.role}".`);
      if (!data.entityId) fail(`[2] expected audit entry's entityId (the orphaned uid) to be set.`);
    }

    // Confirm the account genuinely IS an orphan (still exists in Auth).
    const orphanUser = await auth.getUserByEmail(email).catch(() => null);
    if (!orphanUser) {
      fail(`[2] expected the orphaned Auth account to still exist (delete failed), but it was not found.`);
    } else {
      console.log(`[2] confirmed the Auth account genuinely remains orphaned (uid: ${orphanUser.uid}).`);
      // Test hygiene: actually clean it up now, using the real deleteUser.
      await auth.deleteUser(orphanUser.uid).catch(() => {});
    }
  }

  if (!pass) {
    console.error("MED-3 REGRESSION TEST: FAIL");
    process.exitCode = 1;
    return;
  }

  console.log(
    "MED-3 REGRESSION TEST: PASS — a clean compensating rollback still " +
    "logs nothing extra, and a double failure (batch commit AND the " +
    "compensating delete) is now recorded as a STAFF_PROVISION_ORPHAN " +
    "audit entry without masking the original error."
  );
}

main().catch((err) => {
  console.error("MED-3 regression test crashed:", err);
  process.exitCode = 1;
});
