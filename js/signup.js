// ═══════════════════════════════════════════════
// GAMEZONE — SIGNUP PAGE
// ═══════════════════════════════════════════════

import { auth, db, getAndroidFCMToken }
  from './firebase-config.js';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { createUserDoc }
  from './firestore.js';
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
const firstNameEl =
  document.getElementById('first-name');
const lastNameEl =
  document.getElementById('last-name');
const emailEl =
  document.getElementById('email');
const passwordEl =
  document.getElementById('password');
const confirmEl =
  document.getElementById(
    'confirm-password');
const signupBtn =
  document.getElementById('signup-btn');
const strengthWrap =
  document.getElementById('strength-wrap');
const strengthLabel =
  document.getElementById('strength-label');
const bar1 =
  document.getElementById('bar1');
const bar2 =
  document.getElementById('bar2');
const bar3 =
  document.getElementById('bar3');
const matchIndicator =
  document.getElementById('match-indicator');

// ════════════════════════════════════════════
// PASSWORD STRENGTH
// ════════════════════════════════════════════

function getPasswordStrength(pass) {
  if (!pass || pass.length < 6)
    return 0; // weak
  let score = 0;
  if (pass.length >= 8) score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;
  if (score <= 1) return 1; // weak
  if (score <= 2) return 2; // fair
  return 3; // strong
}

function updateStrengthUI(pass) {
  if (!pass) {
    strengthWrap.style.display = 'none';
    return;
  }
  strengthWrap.style.display = 'flex';
  const strength = getPasswordStrength(pass);

  // Reset bars
  [bar1, bar2, bar3].forEach(b => {
    b.className = 'strength-bar';
  });
  strengthLabel.className =
    'strength-label';

  if (strength === 1) {
    bar1.classList.add('weak');
    strengthLabel.classList.add('weak');
    strengthLabel.textContent =
      '⚠ Weak password';
  } else if (strength === 2) {
    bar1.classList.add('fair');
    bar2.classList.add('fair');
    strengthLabel.classList.add('fair');
    strengthLabel.textContent =
      '◎ Fair password';
  } else {
    bar1.classList.add('strong');
    bar2.classList.add('strong');
    bar3.classList.add('strong');
    strengthLabel.classList.add('strong');
    strengthLabel.textContent =
      '✓ Strong password';
  }
}

// ════════════════════════════════════════════
// PASSWORD MATCH
// ════════════════════════════════════════════

function updateMatchUI() {
  const pass = passwordEl.value;
  const confirm = confirmEl.value;
  if (!confirm) {
    matchIndicator.textContent = '';
    matchIndicator.className =
      'match-indicator';
    return;
  }
  if (pass === confirm) {
    matchIndicator.textContent =
      '✓ Passwords match';
    matchIndicator.className =
      'match-indicator match';
    confirmEl.classList.remove('error');
    confirmEl.classList.add('success');
  } else {
    matchIndicator.textContent =
      '✗ Passwords do not match';
    matchIndicator.className =
      'match-indicator no-match';
    confirmEl.classList.add('error');
    confirmEl.classList.remove('success');
  }
}

// ── Event listeners ───────────────────────────
passwordEl.addEventListener('input', () => {
  updateStrengthUI(passwordEl.value);
  updateMatchUI();
});

confirmEl.addEventListener('input',
  updateMatchUI);

// Focus styles
[firstNameEl, lastNameEl,
 emailEl, passwordEl, confirmEl
].forEach(el => {
  el.addEventListener('focus', () => {
    el.parentElement.classList
      ?.add('focused');
  });
  el.addEventListener('blur', () => {
    el.parentElement.classList
      ?.remove('focused');
  });
});

// ════════════════════════════════════════════
// TOGGLE PASSWORD VISIBILITY
// ════════════════════════════════════════════

window.togglePassword = function(
  inputId, iconId
) {
  const input =
    document.getElementById(inputId);
  const icon =
    document.getElementById(iconId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.textContent = '🙈';
  } else {
    input.type = 'password';
    if (icon) icon.textContent = '👁️';
  }
};

// ════════════════════════════════════════════
// GENERATE REFERRAL CODE
// ════════════════════════════════════════════

function generateReferralCode(uid) {
  return 'FF' +
    uid.slice(0, 6).toUpperCase();
}

// ════════════════════════════════════════════
// VALIDATION
// ════════════════════════════════════════════

function validateForm() {
  const firstName =
    firstNameEl.value.trim();
  const lastName =
    lastNameEl.value.trim();
  const email =
    emailEl.value.trim();
  const password =
    passwordEl.value;
  const confirm =
    confirmEl.value;

  if (!firstName) {
    showToast(
      'Enter your first name', 'error');
    firstNameEl.classList.add('error');
    firstNameEl.focus();
    return false;
  }
  if (!lastName) {
    showToast(
      'Enter your last name', 'error');
    lastNameEl.classList.add('error');
    lastNameEl.focus();
    return false;
  }
  if (!email || !isValidEmail(email)) {
    showToast(
      'Enter a valid email', 'error');
    emailEl.classList.add('error');
    emailEl.focus();
    return false;
  }
  if (!password || password.length < 6) {
    showToast(
      'Password must be 6+ characters',
      'error');
    passwordEl.classList.add('error');
    passwordEl.focus();
    return false;
  }
  if (password !== confirm) {
    showToast(
      'Passwords do not match', 'error');
    confirmEl.classList.add('error');
    confirmEl.focus();
    return false;
  }
  return true;
}

// ════════════════════════════════════════════
// HANDLE SIGNUP
// ════════════════════════════════════════════

window.handleSignup = async function() {
  // Clear errors
  [firstNameEl, lastNameEl,
   emailEl, passwordEl, confirmEl
  ].forEach(el =>
    el.classList.remove('error'));

  if (!validateForm()) return;

  const firstName =
    firstNameEl.value.trim();
  const lastName =
    lastNameEl.value.trim();
  const email =
    emailEl.value.trim().toLowerCase();
  const password = passwordEl.value;

  setButtonLoading(signupBtn, true);

  try {
    // Create Firebase Auth user
    const cred =
      await createUserWithEmailAndPassword(
        auth, email, password);
    const uid = cred.user.uid;

    // Generate referral code
    const referralCode =
      generateReferralCode(uid);

    // Get FCM token from Android bridge
    const fcmToken = getAndroidFCMToken();

    // Create Firestore user document
    await createUserDoc(uid, {
      firstName,
      lastName,
      email,
      referralCode,
      fcmToken,
      ffUid:        '',
      referralUsedBy: ''
    });

    showToast(
      '✅ Account created!', 'success');
    await delay(800);
    window.location.href = 'home.html';

  } catch (err) {
    setButtonLoading(signupBtn, false);
    let msg = 'Signup failed';
    switch (err.code) {
      case 'auth/email-already-in-use':
        msg = 'Email already registered';
        emailEl.classList.add('error');
        break;
      case 'auth/invalid-email':
        msg = 'Invalid email address';
        emailEl.classList.add('error');
        break;
      case 'auth/weak-password':
        msg = 'Password too weak';
        passwordEl.classList.add('error');
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
    handleSignup();
  }
});