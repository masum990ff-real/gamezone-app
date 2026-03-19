// ═══════════════════════════════════════════════
// GAMEZONE — INDEX PAGE
// Countdown animation + auth check
// ═══════════════════════════════════════════════

import { auth, db } from
  './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { initParticles } from
  './particles.js';
import { showToast } from './utils.js';

// ── DOM refs ──────────────────────────────────
const countNumber =
  document.getElementById('count-number');
const ringInner =
  document.getElementById('ring-inner');
const getReadyText =
  document.getElementById('get-ready-text');
const choiceContainer =
  document.getElementById('choice-container');

// ── Init particles ─────────────────────────────
initParticles('particle-canvas');

// ── Check if banned param ──────────────────────
const urlParams =
  new URLSearchParams(window.location.search);
if (urlParams.get('banned') === '1') {
  setTimeout(() => {
    showToast(
      '🚫 Your account has been banned',
      'error', 5000);
  }, 3500);
}

// ════════════════════════════════════════════
// COUNTDOWN HELPERS
// ════════════════════════════════════════════

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function showCount(num) {
  return new Promise(async (resolve) => {
    // Reset
    countNumber.classList.remove('animating');
    countNumber.textContent = '';

    await delay(30);

    // Set number
    countNumber.textContent = num;
    countNumber.classList.add('animating');

    // Glow burst on inner circle
    ringInner.classList.remove('burst');
    void ringInner.offsetWidth; // reflow
    ringInner.classList.add('burst');

    // Wait for animation
    const dur = num === '3'
      ? 700 : num === '2' ? 650 : 600;
    await delay(dur);

    countNumber.classList.remove('animating');
    resolve();
  });
}

function showGo() {
  return new Promise(async (resolve) => {
    countNumber.classList.remove('animating');
    countNumber.innerHTML =
      '<span class="count-go">GO!</span>';
    countNumber.classList.add('animating');

    ringInner.classList.remove('burst');
    void ringInner.offsetWidth;
    ringInner.classList.add('burst');

    await delay(600);
    countNumber.classList.remove('animating');
    resolve();
  });
}

// ════════════════════════════════════════════
// AUTH CHECK
// ════════════════════════════════════════════

function checkAuthState() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const snap = await getDoc(
          doc(db, 'users', user.uid));

        if (!snap.exists()) {
          // No user doc — show choice
          showChoiceCards();
          return;
        }

        const data = snap.data();

        // Banned check
        if (data.status === 'banned') {
          await signOut(auth);
          showToast(
            '🚫 Account banned',
            'error', 4000);
          showChoiceCards();
          return;
        }

        // Maintenance mode check
        try {
          const { getDoc: gd, doc: fd } =
            await import(
              'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js'
            );
          const settings = await getDoc(
            doc(db, 'settings', 'app'));
          if (settings.exists() &&
              settings.data()
                .maintenanceMode) {
            await signOut(auth);
            showToast(
              '🔧 App under maintenance',
              'info', 4000);
            showChoiceCards();
            return;
          }
        } catch (e) {
          // Settings fetch failed — continue
        }

        // All good — go to home
        window.location.href = 'home.html';

      } catch (err) {
        console.error('Auth check error:',
          err);
        showChoiceCards();
      }
    } else {
      // Not logged in
      showChoiceCards();
    }
  });
}

// ════════════════════════════════════════════
// SHOW CHOICE CARDS
// ════════════════════════════════════════════

function showChoiceCards() {
  // Hide rings
  const rings =
    document.getElementById(
      'rings-container');
  if (rings) {
    rings.style.transition =
      'opacity 0.4s ease';
    rings.style.opacity = '0';
    setTimeout(() => {
      rings.style.display = 'none';
    }, 400);
  }

  // Hide get ready text
  getReadyText.style.opacity = '0';

  // Show choice cards
  setTimeout(() => {
    choiceContainer.classList.add('show');
  }, 200);
}

// ════════════════════════════════════════════
// MAIN COUNTDOWN SEQUENCE
// ════════════════════════════════════════════

async function runCountdown() {
  // Show "GET READY!"
  getReadyText.classList.add('show');
  await delay(600);

  // 3
  await showCount('3');
  await delay(150);

  // 2
  await showCount('2');
  await delay(150);

  // 1
  await showCount('1');
  await delay(100);

  // GO!
  await showGo();
  await delay(400);

  // Hide number
  countNumber.textContent = '';

  // Check auth state
  checkAuthState();
}

// ── Start countdown on load ───────────────────
window.addEventListener('load', () => {
  runCountdown();
});