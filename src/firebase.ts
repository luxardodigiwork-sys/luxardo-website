import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { buildFirebaseConfig } from "./utils/firebaseConfig";

// Config comes from VITE_FIREBASE_* env vars (see .env.example). Nothing is hardcoded.
const { config, problems } = buildFirebaseConfig(import.meta.env as Record<string, string | undefined>);

/** Non-empty when the build is missing/has invalid Firebase settings; main.tsx then refuses to start the app. */
export const firebaseConfigProblems: string[] = problems;

// Inert placeholders keep module initialisation from throwing; they are never used when problems exist.
const app = initializeApp(problems.length ? { apiKey: "unset", projectId: "unset", appId: "unset" } : config);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Local end-to-end tests only: a build made with `--mode e2e` and VITE_FIREBASE_EMULATOR=true talks to the local Firestore
// emulator. A normal `vite build` (mode "production") can never connect to an emulator.
if (import.meta.env.VITE_FIREBASE_EMULATOR === "true" && import.meta.env.MODE !== "production") {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
export const storage = getStorage(app);

// Must match `REGION` in functions/src/index.ts.
export const FUNCTIONS_REGION = "asia-south1";
export const functions = getFunctions(app, FUNCTIONS_REGION);
