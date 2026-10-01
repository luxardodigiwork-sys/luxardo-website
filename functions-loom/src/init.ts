/* eslint-disable */
/**
 * Initialize the Firebase Admin SDK BEFORE any module body that constructs a
 * service handle (e.g. `const db = admin.firestore()` in the shared Loom
 * modules). esbuild preserves import order, so THIS module (imported first)
 * runs before the re-exported domain modules.
 *
 * On Cloud Functions the ambient credentials/project config are used. During
 * local analysis / emulator, firebase-tools supplies FIREBASE_CONFIG, which
 * no-arg initializeApp() picks up.
 */
import * as admin from "firebase-admin";

admin.initializeApp();