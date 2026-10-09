/**
 * Firebase Cloud Messaging (FCM) — browser push notifications.
 *
 * SETUP REQUIRED:
 *   1. Firebase Console → Project Settings → Cloud Messaging → Web configuration
 *      → Generate a new VAPID key pair → copy the public key
 *   2. Add to .env.local:
 *        VITE_FCM_VAPID_KEY=BL-xxxxxxxxxxxxxxxxxxxxxx
 *   3. Ensure public/firebase-messaging-sw.js exists with the same Firebase config
 *   4. Call `initFCM()` from App.tsx mount or after login
 *
 * Tokens are stored in Firestore at `fcmTokens/{token}` so a Cloud Function
 * (or admin script) can fan-out push messages.
 */

import { initializeApp, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;

let initialized = false;

export async function initFCM(): Promise<string | null> {
  if (initialized) return null;
  if (typeof window === "undefined") return null;
  if (!VAPID_KEY) {
    console.warn("[FCM] VITE_FCM_VAPID_KEY missing. Skipping push setup.");
    return null;
  }

  try {
    const supported = await isSupported();
    if (!supported) {
      console.info("[FCM] Browser does not support push notifications.");
      return null;
    }
  } catch {
    return null;
  }

  initialized = true;

  try {
    // Ensure service worker is registered
    if ("serviceWorker" in navigator) {
      try {
        await navigator.serviceWorker.register("/firebase-messaging-sw.js");
      } catch (e) {
        console.warn("[FCM] SW registration failed:", e);
      }
    }

    // Request notification permission (best UX: tied to a user gesture)
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.info("[FCM] Notification permission not granted:", permission);
      return null;
    }

    // Use the same Firebase app instance
    const app = getApp();
    const messaging = getMessaging(app);

    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) {
      console.info("[FCM] No token returned.");
      return null;
    }

    // Persist token in Firestore (linked to uid if signed in, else anonymous device id)
    const ownerId = auth.currentUser?.uid || `anon-${navigator.userAgent.slice(0, 20)}`;
    await setDoc(
      doc(db, "fcmTokens", token),
      {
        token,
        ownerId,
        email: auth.currentUser?.email || null,
        userAgent: navigator.userAgent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Foreground listener — show in-app banner / toast
    onMessage(messaging, (payload) => {
      console.log("[FCM] Foreground message:", payload);
      try {
        const title = payload.notification?.title || "LUXARDO FASHION";
        const body = payload.notification?.body || "";
        if (Notification.permission === "granted") {
          new Notification(title, { body, icon: "/logo.png" });
        }
      } catch {}
    });

    return token;
  } catch (err) {
    console.error("[FCM] init failed:", err);
    return null;
  }
}
