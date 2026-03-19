// ═══════════════════════════════════════════════
// GAMEZONE — LOGIN PAGE
// ═══════════════════════════════════════════════

import { auth, db, getAndroidFCMToken }
  from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  doc,
  getDoc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { initParticles }
  from './particles.js';
import {
  showToast,
  setButtonLoading,
  isValidEmail,
  delay
} from './utils.js';

// ── Init particles ─────────────────────────────
initParticles('particle-canvas');

// ── Redirect if already logged in ─────────────
onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = 'home.html';
  }
});

// ── DOM refs ──────────────────────────────────
const emailEl =
  document.getElementById('email');
const passwordEl =
  document.getElementById('password');
const loginBtn =
  document.getElementById('login-btn');

// ════════════════════════════════════════════
// TOGGLE PASSWORD
// ════════════════════════════════════════════

window.togglePassword = function() {
  const icon =
    document.getElementById('toggle-pass');
  if (passwordEl.type === 'password') {
    passwordEl.type = 'text';
    if (icon) icon.textContent = '🙈';
  } else {
    passwordEl.type = 'password';
    if (icon) icon.textContent = '👁️';
  }
};

// ════════════════════════════════════════════
// FORGOT PASSWORD
// ════════════════════════════════════════════

window.handleForgotPassword = async function() {
  const email = emailEl.value.trim();
  if (!email || !isValidEmail(email)) {
    showToast(
      'Enter your email first', 'error');
    emailEl.classList.add('error');
    emailEl.focus();
    return;
  }
  try {
    await sendPasswordResetEmail(
      auth, email);
    showToast(
      '📧 Reset email sent!',
      'success', 4000);
  } catch (err) {
    showToast(
      'Could not send reset email',
      'error');
  }
};

// ════════════════════════════════════════════
// HANDLE LOGIN
// ════════════════════════════════════════════

window.handleLogin = async function() {
  // Clear errors
  emailEl.classList.remove('error');
  passwordEl.classList.remove('error');

  const email =
    emailEl.value.trim().toLowerCase();
  const password = passwordEl.value;

  // Validate
  if (!email || !isValidEmail(email)) {
    showToast('Enter a valid email', 'error');
    emailEl.classList.add('error');
    emailEl.focus();
    return;
  }
  if (!password) {
    showToast('Enter your password', 'error');
    passwordEl.classList.add('error');
    passwordEl.focus();
    return;
  }

  setButtonLoading(loginBtn, true);

  try {
    // Sign in
    const cred =
      await signInWithEmailAndPassword(
        auth, email, password);
    const uid = cred.user.uid;

    // Get user document
    const snap = await getDoc(
      doc(db, 'users', uid));

    if (!snap.exists()) {
      await auth.signOut();
      showToast(
        'Account not found', 'error');
      setButtonLoading(loginBtn, false);
      return;
    }

    const userData = snap.data();

    // Banned check
    if (userData.status === 'banned') {
      await auth.signOut();
      showToast(
        '🚫 Account banned', 'error', 4000);
      setButtonLoading(loginBtn, false);
      return;
    }

    // Maintenance mode
    try {
      const settingsSnap = await getDoc(
        doc(db, 'settings', 'app'));
      if (settingsSnap.exists() &&
          settingsSnap.data()
            .maintenanceMode) {
        await auth.signOut();
        showToast(
          '🔧 App under maintenance',
          'info', 4000);
        setButtonLoading(loginBtn, false);
        return;
      }
    } catch (e) {
      // Settings fetch fail — continue
    }

    // Update FCM token
    const fcmToken = getAndroidFCMToken();
    if (fcmToken) {
      try {
        await updateDoc(
          doc(db, 'users', uid),
          { fcmToken });
      } catch (e) {
        // Non-critical
      }
    }

    showToast('✅ Welcome back!', 'success');
    await delay(600);
    window.location.href = 'home.html';

  } catch (err) {
    setButtonLoading(loginBtn, false);
    let msg = 'Login failed';
    switch (err.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        msg = 'Invalid email or password';
        emailEl.classList.add('error');
        passwordEl.classList.add('error');
        break;
      case 'auth/invalid-email':
        msg = 'Invalid email address';
        emailEl.classList.add('error');
        break;
      case 'auth/too-many-requests':
        msg =
          'Too many attempts. Try later';
        break;
      case 'auth/network-request-failed':
        msg = 'No internet connection';
        break;
      default:
        msg = err.message || msg;
    }
    showToast(msg, 'error');
  }
};

// ── Enter key support ─────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    handleLogin();
  }
});

// ── Focus/blur styles ─────────────────────────
[emailEl, passwordEl].forEach(el => {
  el.addEventListener('focus', () => {
    el.classList.remove('error');
  });
});