/*
 * Build for the Loom-only Cloud Functions bundle (luxardo-flow).
 * Uses esbuild to bundle src/index.ts into a single flat lib/index.js.
 * firebase-admin and firebase-functions stay external (runtime deps);
 * the shared Loom domain modules (../../functions/src/*) are inlined.
 */
const { build } = require("esbuild");

build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: "lib/index.js",
  sourcemap: true,
  external: [
    "firebase-admin",
    "firebase-functions",
    "@google-cloud/firestore",
    "@google-cloud/storage",
    "@google-cloud/logging",
  ],
  logLevel: "info",
}).catch(() => process.exit(1));