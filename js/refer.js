// ═══════════════════════════════════════════════
// GAMEZONE — REFER PAGE
// ═══════════════════════════════════════════════

import { requireAuth, getTotalCoins }
  from './auth.js';
import {
  listenToUser,
  getUserByReferralCode,
  checkReferralUsed,
  applyReferralCode,
  getAppSettings
} from './firestore.js';
import {
  hidePageLoader,
  showToast,
  copyToClipboard,
  shareContent,
  setButtonLoading,
  isValidReferralCode
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

    renderPage(userData);

    // Listen realtime
    unsubUser = listenToUser(
      userData.uid, (u) => {
        userData = { ...userData, ...u };
        renderPage(userData);
      });

  } catch (err) {
    // requireAuth redirects
  }
}

// ════════════════════════════════════════════
// RENDER PAGE
// ════════════════════════════════════════════

function renderPage(u) {
  // Coin chip
  const chipEl =
    document.getElementById('coin-chip');
  if (chipEl) {
    chipEl.textContent =
      `🪙 ${getTotalCoins(u)
        .toLocaleString('en-IN')}`;
  }

  // Referral code
  const codeEl =
    document.getElementById(
      'referral-code');
  if (codeEl) {
    codeEl.textContent =
      u.referralCode || '——————';
  }

  // Stats
  const referredEl =
    document.getElementById(
      'total-referred');
  const earnedEl =
    document.getElementById(
      'referral-earned');
  if (referredEl) {
    referredEl.textContent =
      u.totalReferred || 0;
  }
  if (earnedEl) {
    earnedEl.textContent =
      u.referralEarned || 0;
  }

  // Bonus per refer
  const bonusEl =
    document.getElementById(
      'bonus-per-refer');
  if (bonusEl) {
    bonusEl.textContent =
      appSettings?.referralRewardCoins || 5;
  }

  // Reward segments
  renderSegments(u.referralRewardGiven || 0);

  // Hide use code section if already used
  const useCodeCard =
    document.querySelector('.use-code-card');
  if (useCodeCard && u.referralUsedBy) {
    useCodeCard.innerHTML = `
      <div style="
        text-align:center;
        padding:16px 0;
        font-family:var(--font-ghost);
        font-size:13px;
        color:var(--win-green);
        letter-spacing:1px;">
        ✅ Referral code already applied!
      </div>`;
  }
}

// ════════════════════════════════════════════
// REWARD SEGMENTS
// ════════════════════════════════════════════

function renderSegments(filled) {
  const el =
    document.getElementById(
      'reward-segments');
  if (!el) return;
  const max =
    appSettings?.referralMaxUses || 10;

  el.innerHTML = Array.from(
    { length: max }, (_, i) => `
      <div class="reward-segment
        ${i < filled ? 'filled' : ''}"
        data-num="${i + 1}">
      </div>
    `
  ).join('');
}

// ════════════════════════════════════════════
// COPY + SHARE
// ════════════════════════════════════════════

window.copyReferralCode = function() {
  const code = userData?.referralCode;
  if (!code) return;
  copyToClipboard(code);
};

window.shareReferralCode = function() {
  const code = userData?.referralCode;
  const bonus =
    appSettings?.referralRewardCoins || 5;
  if (!code) return;

  const text =
    `⚔️ Join GAMEZONE — Real Money Tournament App!\n\n` +
    `🪙 Play matches, win coins, withdraw real cash!\n` +
    `🎁 Use my referral code and get ${bonus} bonus coins FREE!\n\n` +
    `My Code: ${code}\n\n` +
    `Download now and battle! 🎮`;

  shareContent(
    'Join GAMEZONE!',
    text,
    window.location.origin
  );
};

// ════════════════════════════════════════════
// USE REFERRAL CODE
// ════════════════════════════════════════════

window.onUseCodeInput = function(input) {
  input.value =
    input.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8);

  const btn =
    document.getElementById('use-code-btn');
  const resultEl =
    document.getElementById(
      'use-code-result');

  if (btn) {
    btn.disabled =
      !isValidReferralCode(input.value);
  }
  if (resultEl) {
    resultEl.textContent = '';
    resultEl.className = 'use-code-result';
  }
};

window.applyCode = async function() {
  const input =
    document.getElementById(
      'use-code-input');
  const resultEl =
    document.getElementById(
      'use-code-result');
  const btn =
    document.getElementById('use-code-btn');

  const code =
    input?.value.trim().toUpperCase();

  if (!code ||
      !isValidReferralCode(code)) {
    showToast(
      'Invalid referral code', 'error');
    return;
  }

  // Cannot use own code
  if (code === userData?.referralCode) {
    if (resultEl) {
      resultEl.textContent =
        '❌ Cannot use your own code';
      resultEl.className =
        'use-code-result error';
    }
    return;
  }

  // Already used a code
  if (userData?.referralUsedBy) {
    if (resultEl) {
      resultEl.textContent =
        '❌ Already used a referral code';
      resultEl.className =
        'use-code-result error';
    }
    return;
  }

  setButtonLoading(btn, true);

  try {
    // Check if already used this code
    const alreadyUsed =
      await checkReferralUsed(
        code, userData.uid);
    if (alreadyUsed) {
      if (resultEl) {
        resultEl.textContent =
          '❌ Already used this code';
        resultEl.className =
          'use-code-result error';
      }
      setButtonLoading(btn, false);
      return;
    }

    // Find referrer
    const referrer =
      await getUserByReferralCode(code);
    if (!referrer) {
      if (resultEl) {
        resultEl.textContent =
          '❌ Invalid referral code';
        resultEl.className =
          'use-code-result error';
      }
      setButtonLoading(btn, false);
      return;
    }

    // Cannot refer yourself
    if (referrer.uid === userData.uid) {
      if (resultEl) {
        resultEl.textContent =
          '❌ Cannot use your own code';
        resultEl.className =
          'use-code-result error';
      }
      setButtonLoading(btn, false);
      return;
    }

    const bonusCoins =
      appSettings?.referralRewardCoins
      || 5;

    // Apply referral
    await applyReferralCode(
      code,
      userData.uid,
      userData,
      referrer.uid,
      referrer,
      bonusCoins
    );

    if (resultEl) {
      resultEl.textContent =
        `✅ +🪙${bonusCoins} bonus coins added!`;
      resultEl.className =
        'use-code-result success';
    }
    showToast(
      `🎁 +🪙${bonusCoins} Bonus coins!`,
      'success', 4000);

  } catch (err) {
    setButtonLoading(btn, false);
    if (resultEl) {
      resultEl.textContent =
        '❌ Could not apply code';
      resultEl.className =
        'use-code-result error';
    }
    showToast(
      'Could not apply code', 'error');
  }
};

// ── Cleanup ───────────────────────────────────
window.addEventListener('pagehide', () => {
  if (unsubUser) unsubUser();
});

// ── Start ─────────────────────────────────────
init();