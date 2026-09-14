/* eslint-disable */
// LUXARDO FLOW (Loom) — placeholder service worker.
//
// FCM / push notifications are NOT currently used by the Loom production
// system (src/utils/fcm.ts is never imported from the Loom route tree, so
// nothing registers a service worker in the Loom app today). This file
// exists purely so that the public path /firebase-messaging-sw.js resolves
// to something harmless on the luxardo-flow deployment instead of the B2C
// service worker (public/firebase-messaging-sw.js), which hardcodes the
// B2C (luxardo-fashion-website) Firebase config.
//
// This file never loads the Firebase SDK and never calls
// firebase.initializeApp() — it cannot connect to ANY Firebase project,
// B2C or Loom.
//
// If LUXARDO FLOW needs FCM in the future, replace this file's contents
// with a real firebase-messaging-compat setup using the luxardo-flow
// config (see .env.loom / src/firebase.ts), mirroring the structure of
// public/firebase-messaging-sw.js but with luxardo-flow's values.
//
// Lives at the repo root (not public/) so Vite's publicDir copy never
// ships it into the B2C build — vite.config.ts's Loom-only plugin places
// it at dist-loom/firebase-messaging-sw.js explicitly, after the build,
// overwriting the B2C variant that publicDir would otherwise have copied.
self.addEventListener('push', () => {});
