// ═══════════════════════════════════════════════
// GAMEZONE — AUTH FUNCTIONS
// ═══════════════════════════════════════════════

import { auth, db } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// ── Current user cache ────────────────────────
let _currentUser = null;
let _currentUserData = null;
let _authListeners = [];

// ── Require auth — redirect if not logged in ──
export function requireAuth() {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth,
      async (user) => {
        unsub();
        if (!user) {
          window.location.href = 'index.html';
          reject('not_authenticated');
          return;
        }
        try {
          const snap = await getDoc(
            doc(db, 'users', user.uid));
          if (!snap.exists()) {
            await firebaseSignOut(auth);
            window.location.href = 'index.html';
            reject('no_user_doc');
            return;
          }
          const data = snap.data();
          if (data.status === 'banned') {
            await firebaseSignOut(auth);
            window.location.href =
              'index.html?banned=1';
            reject('banned');
            return;
          }
          _currentUser = user;
          _currentUserData = {
            uid: user.uid, ...data };
          resolve(_currentUserData);
        } catch (err) {
          window.location.href = 'index.html';
          reject(err);
        }
      }
    );
  });
}

// ── Get current user data ─────────────────────
export function getCurrentUser() {
  return _currentUserData;
}

// ── Get current Firebase user ─────────────────
export function getFirebaseUser() {
  return _currentUser;
}

// ── Listen to auth state changes ──────────────
export function onUserDataChange(callback) {
  _authListeners.push(callback);
  if (_currentUserData) {
    callback(_currentUserData);
  }
}

// ── Sign out ──────────────────────────────────
export async function signOut() {
  try {
    await firebaseSignOut(auth);
    _currentUser = null;
    _currentUserData = null;
    window.location.href = 'index.html';
  } catch (err) {
    console.error('Sign out error:', err);
  }
}

// ── Refresh user data ─────────────────────────
export async function refreshUserData() {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const snap = await getDoc(
      doc(db, 'users', user.uid));
    if (snap.exists()) {
      _currentUserData = {
        uid: user.uid, ...snap.data() };
      _authListeners.forEach(cb =>
        cb(_currentUserData));
      return _currentUserData;
    }
  } catch (err) {
    console.error('Refresh error:', err);
  }
  return null;
}

// ── Get total coins ───────────────────────────
export function getTotalCoins(userData) {
  if (!userData) return 0;
  return (userData.depositCoins || 0) +
         (userData.winCoins || 0) +
         (userData.bonusCoins || 0);
}

// ── Format user display name ──────────────────
export function getDisplayName(userData) {
  if (!userData) return 'Player';
  return userData.firstName ||
    userData.email?.split('@')[0] || 'Player';
}

// ── Check if user is admin ────────────────────
export function isAdmin(userData) {
  return userData?.role === 'admin';
}

// ── Save FCM token to Firestore ───────────────
export async function saveFCMToken(token) {
  const user = auth.currentUser;
  if (!user || !token) return;
  try {
    const { updateDoc, doc: fsDoc } =
      await import(
        'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'
      );
    await updateDoc(
      fsDoc(db, 'users', user.uid),
      { fcmToken: token }
    );
  } catch (err) {
    // Silent fail — non-critical
  }
}

// ── FCM token injection from Android ─────────
window.onFCMTokenReceived = async (token) => {
  if (token) {
    await saveFCMToken(token);
  }
};