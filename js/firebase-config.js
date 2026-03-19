// ═══════════════════════════════════════════════
// GAMEZONE — FIREBASE CONFIGURATION
// Firebase JS SDK v10+ modular
// ═══════════════════════════════════════════════

import { initializeApp } from
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore } from
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { getDatabase } from
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';
import { getMessaging,
  isSupported as isFCMSupported } from
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js';

// ════════════════════════════════════════════════
// ← PASTE YOUR FIREBASE CONFIG HERE
// Go to: Firebase Console → Project Settings
// → Your Apps → Web App → SDK setup
// Copy the firebaseConfig object and paste below
// ════════════════════════════════════════════════
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  databaseURL:       "YOUR_PROJECT.firebaseio.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
  measurementId:     "YOUR_MEASUREMENT_ID"
};
// ════════════════════════════════════════════════

// ── Initialize Firebase ──────────────────────
const app = initializeApp(firebaseConfig);

// ── Auth ─────────────────────────────────────
export const auth = getAuth(app);

// ── Firestore ────────────────────────────────
export const db = getFirestore(app);

// ── Realtime Database ─────────────────────────
export const rtdb = getDatabase(app);

// ── FCM (only in supported browsers) ─────────
export let messaging = null;
try {
  const supported = await isFCMSupported();
  if (supported) {
    messaging = getMessaging(app);
  }
} catch (e) {
  // FCM not supported — ignore
}

// ── App version ──────────────────────────────
export const APP_VERSION = '1.0.0';

// ── Helper: is running in Android app ────────
export const isAndroidApp = () => {
  return typeof window.AndroidBridge !== 'undefined';
};

// ── Helper: get FCM token from Android bridge ─
export const getAndroidFCMToken = () => {
  if (isAndroidApp()) {
    return window.AndroidBridge.getFCMToken() || '';
  }
  return '';
};