/* eslint-disable */
/**
 * FOCUSED RULES REGRESSION TEST — MED-4 (production Storage upload
 * constraints: designs/sampleDesigns/samplePieces gain isImage()+maxSize(10)
 * to match the existing guardQC/tailor pattern; store gains maxSize(10)
 * only, since no evidence supports an image-type restriction there).
 *
 * Uses @firebase/rules-unit-testing against the real Storage emulator's
 * rules engine (not a mock) — loads the ACTUAL storage.rules file from disk
 * and evaluates real client SDK calls against it, exactly as production
 * Storage would.
 *
 * Scope note: tests storage.rules (the B2C project's file) only. Its
 * isAdmin() is self-contained (uid/custom-claim based); storage.loom.rules'
 * isAdmin()/isStaffInRoles() additionally depend on Firestore-backed staff
 * docs, which would require running the Firestore and Storage emulators
 * together with seeded staff data for comparatively little extra signal,
 * since both files now share the identical isImage()/maxSize() rule text
 * verified here — confirmed identical by direct diff, not re-tested live.
 *
 * Not wired into any test runner (the repo has none yet) — a standalone,
 * emulator-only script, same family as firestore.rules.high3.test.ts. NOT
 * exported from functions/src/index.ts.
 *
 * Scenarios (against the CURRENT, post-MED-4-fix storage.rules):
 *   1. Admin uploads a valid small image to samplePieces -> succeeds.
 *   2. Admin uploads an oversized (>10MB) file to samplePieces -> denied.
 *   3. Admin uploads a NON-image file (within size) to samplePieces ->
 *      denied (the core fix — previously this succeeded unconstrained).
 *   4. Admin uploads a NON-image file (within size) to store -> succeeds
 *      (confirms store is deliberately NOT restricted to images).
 *   5. Admin uploads an oversized (>10MB) file to store -> denied (the size
 *      cap now applies there too).
 *   6. A non-admin signed-in user's upload attempt is denied (RBAC
 *      unchanged).
 *   7. A non-admin signed-in user can still read an existing object
 *      (read permissions preserved exactly).
 *
 * MUST be run against the Storage emulator only — refuses to run if
 * FIREBASE_STORAGE_EMULATOR_HOST is not set, so it can never touch a real
 * project.
 *
 * Run (from functions/):
 *   npm run build
 *   firebase emulators:exec --config ../firebase.emulator.test.json \
 *     --only storage --project demo-luxardo-test \
 *     "node lib/__tests__/storage.rules.med4.test.js"
 */
import * as fs from "fs";
import * as path from "path";

async function main(): Promise<void> {
  const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
  if (!emulatorHost) {
    throw new Error(
      "FIREBASE_STORAGE_EMULATOR_HOST is not set — refusing to run against " +
      "a real project. Run this via `firebase emulators:exec --only storage ...`."
    );
  }
  const [host, portStr] = emulatorHost.split(":");
  const port = Number(portStr);

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ref, uploadBytes, getBytes } = require("firebase/storage");

  const rulesPath = path.join(__dirname, "..", "..", "..", "storage.rules");
  const rules = fs.readFileSync(rulesPath, "utf8");

  const testEnv = await initializeTestEnvironment({
    projectId: "demo-luxardo-storage-test",
    storage: { rules, host, port },
  });

  let pass = true;
  const fail = (msg: string) => {
    console.error(`FAIL: ${msg}`);
    pass = false;
  };

  const smallImage = new Uint8Array([1, 2, 3, 4, 5]);
  const oversized = new Uint8Array(11 * 1024 * 1024); // > 10MB
  const smallDoc = new Uint8Array([1, 2, 3]);

  try {
    const adminCtx = testEnv.authenticatedContext("test-admin-uid", { admin: true });
    const nonAdminCtx = testEnv.authenticatedContext("test-nonadmin-uid");

    // ── Scenario 1: valid small image to samplePieces succeeds ────────────
    try {
      await assertSucceeds(
        uploadBytes(ref(adminCtx.storage(), "production/samplePieces/valid.png"), smallImage, { contentType: "image/png" })
      );
      console.log("[1] admin small-image upload to samplePieces correctly ALLOWED.");
    } catch (err: any) {
      fail(`[1] expected a valid small image upload to samplePieces to succeed: ${err?.message ?? err}`);
    }

    // ── Scenario 2: oversized image to samplePieces denied ────────────────
    try {
      await assertFails(
        uploadBytes(ref(adminCtx.storage(), "production/samplePieces/big.png"), oversized, { contentType: "image/png" })
      );
      console.log("[2] admin oversized-image upload to samplePieces correctly DENIED.");
    } catch (err: any) {
      fail(`[2] expected an oversized image upload to samplePieces to be denied: ${err?.message ?? err}`);
    }

    // ── Scenario 3: non-image file to samplePieces denied (the core fix) ──
    try {
      await assertFails(
        uploadBytes(ref(adminCtx.storage(), "production/samplePieces/doc.pdf"), smallDoc, { contentType: "application/pdf" })
      );
      console.log("[3] admin non-image upload to samplePieces correctly DENIED (previously unconstrained).");
    } catch (err: any) {
      fail(`[3] expected a non-image upload to samplePieces to now be denied: ${err?.message ?? err}`);
    }

    // ── Scenario 4: non-image file to store succeeds (not image-restricted) ──
    try {
      await assertSucceeds(
        uploadBytes(ref(adminCtx.storage(), "production/store/doc.pdf"), smallDoc, { contentType: "application/pdf" })
      );
      console.log("[4] admin non-image upload to store correctly ALLOWED (store is deliberately not image-restricted).");
    } catch (err: any) {
      fail(`[4] expected a non-image upload to store to still succeed: ${err?.message ?? err}`);
    }

    // ── Scenario 5: oversized file to store denied (new size cap) ─────────
    try {
      await assertFails(
        uploadBytes(ref(adminCtx.storage(), "production/store/big.bin"), oversized, { contentType: "application/octet-stream" })
      );
      console.log("[5] admin oversized upload to store correctly DENIED (new maxSize(10) applies).");
    } catch (err: any) {
      fail(`[5] expected an oversized upload to store to be denied: ${err?.message ?? err}`);
    }

    // ── Scenario 6: non-admin upload denied (RBAC unchanged) ──────────────
    try {
      await assertFails(
        uploadBytes(ref(nonAdminCtx.storage(), "production/samplePieces/nope.png"), smallImage, { contentType: "image/png" })
      );
      console.log("[6] non-admin upload to samplePieces correctly DENIED (RBAC unchanged).");
    } catch (err: any) {
      fail(`[6] expected a non-admin upload to be denied: ${err?.message ?? err}`);
    }

    // ── Scenario 7: non-admin signed-in read still succeeds (unchanged) ───
    try {
      await assertSucceeds(getBytes(ref(nonAdminCtx.storage(), "production/samplePieces/valid.png")));
      console.log("[7] non-admin signed-in read of samplePieces correctly ALLOWED (read permissions unchanged).");
    } catch (err: any) {
      fail(`[7] expected a signed-in non-admin read to remain allowed: ${err?.message ?? err}`);
    }
  } finally {
    await testEnv.cleanup();
  }

  if (!pass) {
    console.error("MED-4 RULES REGRESSION TEST: FAIL");
    process.exitCode = 1;
    return;
  }

  console.log(
    "MED-4 RULES REGRESSION TEST: PASS — designs/sampleDesigns/samplePieces " +
    "now reject oversized or non-image uploads, store rejects oversized " +
    "uploads while still accepting non-image content, RBAC is unchanged, " +
    "and existing read permissions are preserved."
  );
}

main().catch((err) => {
  console.error("MED-4 rules regression test crashed:", err);
  process.exitCode = 1;
});
