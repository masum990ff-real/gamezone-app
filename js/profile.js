// ═══════════════════════════════════════════════
// GAMEZONE — PROFILE PAGE
// ═══════════════════════════════════════════════

import { auth } from
  './firebase-config.js';
import {
  requireAuth,
  getTotalCoins,
  signOut
} from './auth.js';
import { listenToUser, getAppSettings }
  from './firestore.js';
import {
  hidePageLoader,
  showToast,
  copyToClipboard,
  shareContent,
  showConfirm,
  openModal,
  closeModal
} from './utils.js';

// ── State ─────────────────────────────────────
let userData = null;
let appSettings = null;
let unsubUser = null;

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════

async function init() {
  try {
    userData = await requireAuth();
    hidePageLoader();

    appSettings = await getAppSettings();
    renderProfile(userData);

    // Platform tag
    const platformEl =
      document.getElementById(
        'platform-tag');
    if (platformEl) {
      platformEl.textContent =
        window.AndroidBridge
          ? `Android v${
              window.AndroidBridge
                .getAppVersion?.()
              || '1.0'}`
          : 'Web';
    }

    // Listen realtime
    unsubUser = listenToUser(
      userData.uid, (u) => {
        userData = { ...userData, ...u };
        renderProfile(userData);
      });

  } catch (err) {
    // requireAuth redirects
  }
}

// ════════════════════════════════════════════
// RENDER PROFILE
// ════════════════════════════════════════════

function renderProfile(u) {
  const name =
    `${u.firstName || ''} ${
      u.lastName || ''}`.trim()
    || 'Player';

  // Avatar
  const avatarEl =
    document.getElementById(
      'avatar-letter');
  if (avatarEl) {
    avatarEl.textContent =
      (u.firstName || 'G')
        .charAt(0).toUpperCase();
  }

  // Name + email
  const nameEl =
    document.getElementById('profile-name');
  const emailEl =
    document.getElementById('profile-email');
  if (nameEl) nameEl.textContent = name;
  if (emailEl) {
    emailEl.textContent =
      u.email || '';
  }

  // Coin chip
  const chipEl =
    document.getElementById('coin-chip');
  if (chipEl) {
    chipEl.textContent =
      `🪙 ${getTotalCoins(u)
        .toLocaleString('en-IN')}`;
  }

  // Stats
  setEl('stat-matches',
    u.totalMatches || 0);
  setEl('stat-wins',
    u.totalWins || 0);
  setEl('stat-kills',
    u.totalKills || 0);
  setEl('stat-earned',
    u.totalCoinsEarned || 0);

  // Balances
  setEl('bal-deposit',
    `🪙 ${(u.depositCoins || 0)
      .toLocaleString('en-IN')}`);
  setEl('bal-win',
    `🪙 ${(u.winCoins || 0)
      .toLocaleString('en-IN')}`);
  setEl('bal-bonus',
    `🪙 ${(u.bonusCoins || 0)
      .toLocaleString('en-IN')}`);

  // Referral code
  setEl('profile-ref-code',
    u.referralCode || '——————');
}

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ════════════════════════════════════════════
// REFERRAL CODE
// ════════════════════════════════════════════

window.copyProfileCode = function() {
  const code = userData?.referralCode;
  if (!code) return;
  copyToClipboard(code);
};

window.shareProfileCode = function() {
  const code = userData?.referralCode;
  const bonus =
    appSettings?.referralRewardCoins || 5;
  if (!code) return;

  const text =
    `⚔️ Join GAMEZONE!\n\n` +
    `🪙 Real money tournament app!\n` +
    `🎁 Use code ${code} for +🪙${bonus} bonus!\n\n` +
    `Battle. Win. Earn. 🎮`;

  shareContent('Join GAMEZONE!', text);
};

// ════════════════════════════════════════════
// ACTION ROWS
// ════════════════════════════════════════════

window.openAction = function(type) {
  switch (type) {

    case 'support': {
      const link =
        appSettings?.supportLink;
      if (link) {
        if (window.AndroidBridge) {
          window.AndroidBridge
            .openUrl(link);
        } else {
          window.open(link, '_blank');
        }
      } else {
        showToast(
          'Support not configured',
          'info');
      }
      break;
    }

    case 'whatsapp': {
      const link =
        appSettings?.whatsappGroupLink;
      if (link) {
        if (window.AndroidBridge) {
          window.AndroidBridge
            .openUrl(link);
        } else {
          window.open(link, '_blank');
        }
      } else {
        showToast(
          'WhatsApp group not set',
          'info');
      }
      break;
    }

    case 'privacy': {
      const text =
        appSettings?.privacyPolicyText;
      showPolicy(
        '🔒 PRIVACY POLICY',
        text || 'Privacy policy not set.'
      );
      break;
    }

    case 'fairplay': {
      const text =
        appSettings?.fairPlayText;
      showPolicy(
        '⚖️ FAIR PLAY POLICY',
        text || 'Fair play policy not set.'
      );
      break;
    }
  }
};

// ── Policy modal ───────────────────────────────
function showPolicy(title, content) {
  const titleEl =
    document.getElementById('policy-title');
  const contentEl =
    document.getElementById('policy-content');
  if (titleEl) titleEl.textContent = title;
  if (contentEl) {
    contentEl.textContent = content;
  }
  openModal('policy-modal');
}

window.closePolicyModal = function(e) {
  if (!e ||
      e.target.id === 'policy-modal' ||
      e.target.tagName === 'BUTTON') {
    closeModal('policy-modal');
  }
};

// ════════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════════

window.handleLogout = function() {
  showConfirm(
    'LOG OUT',
    'Are you sure you want to log out?',
    async () => {
      await signOut();
    }
  );
};

// ── Cleanup ───────────────────────────────────
window.addEventListener('pagehide', () => {
  if (unsubUser) unsubUser();
});

// ── Start ─────────────────────────────────────
init();