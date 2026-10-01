/* eslint-disable */
/**
 * FOCUSED RULES REGRESSION TEST — HIGH-3 (B2C firestore.rules direct-write
 * lockdown on tailorSessions / storeOuts / storeOutIssues).
 *
 * Uses @firebase/rules-unit-testing against the real Firestore emulator's
 * rules engine (not a mock) — this loads the ACTUAL firestore.rules file
 * from disk and evaluates real client SDK calls against it, exactly as
 * production Firestore would.
 *
 * Not wired into any test runner (the repo has none yet) — a standalone,
 * emulator-only script, same family as labour.f2/f3, production.crit1, and
 * tailorRequests.high2. NOT exported from functions/src/index.ts.
 *
 * Scenarios (against the CURRENT, post-HIGH-3-fix firestore.rules):
 *   1. A "tailor" staff client can no longer create/update tailorSessions
 *      directly (previously allowed; now must be denied).
 *   2. A "store" staff client can no longer create storeOuts directly
 *      (previously allowed; now must be denied).
 *   3. A "store" staff client can no longer create storeOutIssues directly
 *      (previously allowed; now must be denied).
 *   4. Reads on all three collections for their previously-allowed roles
 *      still succeed — read permissions were NOT changed by this fix.
 *
 * MUST be run against the Firestore emulator only — refuses to run if
 * FIRESTORE_EMULATOR_HOST is not set, so it can never touch a real project.
 *
 * Run (from functions/):
 *   npm run build
 *   firebase emulators:exec --only firestore --project demo-luxardo-test \
 *     "node lib/__tests__/firestore.rules.high3.test.js"
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

    const tailorUid = "rules-test-tailor";
    const storeUid = "rules-test-store";

    // Seed staff identity docs (bypassing rules — this is fixture setup).
    await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
      await ctx.firestore().doc(`staff/${tailorUid}`).set({ role: "tailor", active: true, displayName: "Rules Test Tailor" });
      await ctx.firestore().doc(`staff/${storeUid}`).set({ role: "store", active: true, displayName: "Rules Test Store" });
      // Pre-existing docs to exercise the READ regression checks against.
      await ctx.firestore().doc("tailorSessions/TS-READTEST").set({ id: "TS-READTEST", pieceId: "PIECE-X" });
      await ctx.firestore().doc("storeOuts/SO-READTEST").set({ id: "SO-READTEST", pieceIds: [] });
      await ctx.firestore().doc("storeOutIssues/SOI-READTEST").set({ id: "SOI-READTEST", pieceId: "PIECE-X" });
    });

    const tailorCtx = testEnv.authenticatedContext(tailorUid);
    const storeCtx = testEnv.authenticatedContext(storeUid);

    // ── Scenario 1: tailorSessions direct write must now be DENIED ────────
    try {
      await assertFails(
        setDoc(doc(tailorCtx.firestore(), "tailorSessions/TS-DENYTEST"), { id: "TS-DENYTEST", pieceId: "PIECE-X" })
      );
      console.log("[1] tailorSessions direct create correctly DENIED for tailor role.");
    } catch (err: any) {
      fail(`[1] expected tailorSessions direct create to be denied, but assertFails itself failed: ${err?.message ?? err}`);
    }

    // ── Scenario 2: storeOuts direct write must now be DENIED ─────────────
    try {
      await assertFails(
        setDoc(doc(storeCtx.firestore(), "storeOuts/SO-DENYTEST"), { id: "SO-DENYTEST", pieceIds: [] })
      );
      console.log("[2] storeOuts direct create correctly DENIED for store role.");
    } catch (err: any) {
      fail(`[2] expected storeOuts direct create to be denied, but assertFails itself failed: ${err?.message ?? err}`);
    }

    // ── Scenario 3: storeOutIssues direct write must now be DENIED ────────
    try {
      await assertFails(
        setDoc(doc(storeCtx.firestore(), "storeOutIssues/SOI-DENYTEST"), { id: "SOI-DENYTEST", pieceId: "PIECE-X" })
      );
      console.log("[3] storeOutIssues direct create correctly DENIED for store role.");
    } catch (err: any) {
      fail(`[3] expected storeOutIssues direct create to be denied, but assertFails itself failed: ${err?.message ?? err}`);
    }

    // ── Scenario 4: reads on all three collections still SUCCEED ──────────
    try {
      await assertSucceeds(getDoc(doc(tailorCtx.firestore(), "tailorSessions/TS-READTEST")));
      console.log("[4a] tailorSessions read correctly ALLOWED for tailor role (unchanged).");
    } catch (err: any) {
      fail(`[4a] expected tailorSessions read to remain allowed for tailor role: ${err?.message ?? err}`);
    }
    try {
      await assertSucceeds(getDoc(doc(storeCtx.firestore(), "storeOuts/SO-READTEST")));
      console.log("[4b] storeOuts read correctly ALLOWED for store role (unchanged).");
    } catch (err: any) {
      fail(`[4b] expected storeOuts read to remain allowed for store role: ${err?.message ?? err}`);
    }
    try {
      await assertSucceeds(getDoc(doc(storeCtx.firestore(), "storeOutIssues/SOI-READTEST")));
      console.log("[4c] storeOutIssues read correctly ALLOWED for store role (unchanged).");
    } catch (err: any) {
      fail(`[4c] expected storeOutIssues read to remain allowed for store role: ${err?.message ?? err}`);
    }
  } finally {
    await testEnv.cleanup();
  }

  if (!pass) {
    console.error("HIGH-3 RULES REGRESSION TEST: FAIL");
    process.exitCode = 1;
    return;
  }

  console.log(
    "HIGH-3 RULES REGRESSION TEST: PASS — direct client writes to " +
    "tailorSessions/storeOuts/storeOutIssues are now denied, and existing " +
    "read permissions for tailor/store roles are unchanged."
  );
}

main().catch((err) => {
  console.error("HIGH-3 rules regression test crashed:", err);
  process.exitCode = 1;
});
