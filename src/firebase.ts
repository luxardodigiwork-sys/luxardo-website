import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Aapki direct API keys yahan set hain
const firebaseConfig = {
  apiKey: "AIzaSyAfqktiFGPeb4gxk83SzeEb6XhVGBDwrsY",
  authDomain: "LUXARDO FASHION-fashion-website.firebaseapp.com",
  projectId: "LUXARDO FASHION-fashion-website",
  storageBucket: "LUXARDO FASHION-fashion-website.firebasestorage.app",
  messagingSenderId: "654297681314",
  appId: "1:654297681314:web:64381a856ae8d3f36236fb",
  measurementId: "G-4B6F1EXHKT"
};

// Initialize Firebase Tools
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);