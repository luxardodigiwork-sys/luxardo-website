/* eslint-disable */
// Firebase Cloud Messaging service worker
// Required by FCM. Receives push notifications when the tab is closed/inactive.

importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

// IMPORTANT: This config must match src/firebase.ts (apiKey can be public — it's not a secret).
firebase.initializeApp({
  apiKey: "AIzaSyAfqktiFGPeb4gxk83SzeEb6XhVGBDwrsY",
  authDomain: "luxardo-fashion-website.firebaseapp.com",
  projectId: "luxardo-fashion-website",
  storageBucket: "luxardo-fashion-website.firebasestorage.app",
  messagingSenderId: "654297681314",
  appId: "1:654297681314:web:64381a856ae8d3f36236fb",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[FCM-SW] Background message:", payload);
  const title = (payload.notification && payload.notification.title) || "LUXARDO FASHION";
  const options = {
    body: (payload.notification && payload.notification.body) || "",
    icon: "/logo.png",
    badge: "/logo.png",
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(clients.openWindow(target));
});
