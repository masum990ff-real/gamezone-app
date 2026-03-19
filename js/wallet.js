// ═══════════════════════════════════════════════
// GAMEZONE — WALLET PAGE
// ═══════════════════════════════════════════════

import { auth } from
  './firebase-config.js';
import {
  requireAuth,
  getTotalCoins
} from './auth.js';
import {
  listenToUser,
  listenToTransactions,
  checkUTRExists,
  createDepositRequest,
  listenToDepositRequest,
  createWithdrawal,
  getAppSettings
} from './firestore.js';
import {
  hidePageLoader,
  showToast,
  openSheet,
  closeSheet,
  setButtonLoading,
  isValidUPI,
  getTxIcon,
  getTxLabel,
  isCredit,
  formatDateTime,
  timeAgo
} from './utils.js';
import {
  updateBalanceDisplays,
  runCoinAddAnimation
} from './coins.js';

// ── State ─────────────────────────────────────
let userData = null;
let appSettings = null;
let selectedAmount = 0;
let selectedApp = '';
let depositTimerInterval = null;
let depositRequestId = null;
let depositUnsub = null;
let unsubUser = null;
let unsubTx = null;
let prevTotal = 0;

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════

async function init() {
  try {
    userData = await requireAuth();
    hidePageLoader();
    prevTotal = getTotalCoins(userData);
    updateBalanceDisplays(userData);

    // Load settings
    appSettings = await getAppSettings();
    renderAmountGrid();

    // Available win coins
    updateAvailableWin();

    // Listen realtime
    unsubUser = listenToUser(
      userData.uid, (u) => {
        const newTotal =
          getTotalCoins(u);
        const added =
          newTotal - prevTotal;
        if (added > 0) {
          const totalEl =
            document.getElementById(
              'total-coins');
          runCoinAddAnimation(
            added, totalEl, newTotal);
        } else {
          updateBalanceDisplays(u);
        }
        prevTotal = newTotal;
        userData = {
          ...userData, ...u };
        updateAvailableWin();
      });

    // Listen transactions
    unsubTx = listenToTransactions(
      userData.uid, renderTransactions);

  } catch (err) {
    // requireAuth redirects
  }
}

// ════════════════════════════════════════════
// BALANCE DISPLAY
// ════════════════════════════════════════════

function updateAvailableWin() {
  const el = document.getElementById(
    'available-win');
  if (el) {
    el.textContent =
      `🪙 ${(userData?.winCoins || 0)
        .toLocaleString('en-IN')}`;
  }
}

// ════════════════════════════════════════════
// DEPOSIT SHEET
// ════════════════════════════════════════════

window.openDepositSheet = function() {
  // Reset state
  selectedAmount = 0;
  selectedApp = '';
  goToDepositStep(1);
  openSheet('deposit-sheet');
};

window.closeDepositSheet = function() {
  closeSheet('deposit-sheet');
  stopDepositTimer();
  if (depositUnsub) {
    depositUnsub();
    depositUnsub = null;
  }
  depositRequestId = null;
};

// ── Render amount grid ─────────────────────────
function renderAmountGrid() {
  const grid =
    document.getElementById('amount-grid');
  if (!grid) return;
  const amounts =
    appSettings?.depositAmounts ||
    [20, 50, 100, 200];

  grid.innerHTML = amounts.map(n => `
    <div class="amount-card"
      data-amount="${n}"
      onclick="selectAmount(${n})">
      <div class="amount-coin">
        🪙 ${n}
      </div>
      <div class="amount-rupee">
        Pay ₹${n}
      </div>
    </div>
  `).join('');
}

window.selectAmount = function(n) {
  selectedAmount = n;
  document.querySelectorAll(
    '.amount-card'
  ).forEach(c => {
    c.classList.toggle(
      'selected',
      parseInt(c.dataset.amount) === n);
  });
  checkStep1Ready();
};

window.selectApp = function(app) {
  selectedApp = app;
  document.querySelectorAll(
    '.app-chip'
  ).forEach(c => {
    c.classList.toggle(
      'selected',
      c.dataset.app === app);
  });
  checkStep1Ready();
};

function checkStep1Ready() {
  const btn =
    document.getElementById('step1-next');
  if (btn) {
    btn.disabled =
      !selectedAmount || !selectedApp;
  }
}

// ── Step navigation ────────────────────────────
function goToDepositStep(step) {
  [1, 2, 3].forEach(n => {
    const el = document.getElementById(
      `deposit-step-${n}`);
    if (el) {
      el.classList.toggle(
        'active', n === step);
    }
    const dot = document.getElementById(
      `step${n}-dot`);
    if (dot) {
      dot.classList.toggle(
        'active', n === step);
      dot.classList.toggle(
        'done', n < step);
    }
    if (n < 3) {
      const line =
        document.getElementById(
          `step${n}-line`);
      if (line) {
        line.classList.toggle(
          'done', n < step);
      }
    }
  });
}

window.goToStep2 = function() {
  if (!selectedAmount || !selectedApp) {
    showToast(
      'Select amount and app', 'error');
    return;
  }

  // Set QR image
  const qrImg =
    document.getElementById('qr-image');
  const qrApp =
    document.getElementById('qr-app-name');
  const qrAmount =
    document.getElementById('qr-amount');

  if (qrImg) {
    qrImg.src =
      appSettings?.qrCodeImageUrl || '';
  }
  if (qrApp) {
    qrApp.textContent =
      `Open ${selectedApp}`;
  }
  if (qrAmount) {
    qrAmount.textContent =
      `₹${selectedAmount}`;
  }

  goToDepositStep(2);
  startDepositTimer();
};

window.goBackToStep1 = function() {
  stopDepositTimer();
  goToDepositStep(1);
};

window.goToStep3 = function() {
  stopDepositTimer();

  const reminder =
    document.getElementById(
      'step3-reminder');
  if (reminder) {
    reminder.textContent =
      `🪙 ${selectedAmount} for ₹${selectedAmount}`;
  }

  const utrInput =
    document.getElementById('utr-input');
  if (utrInput) {
    utrInput.value = '';
  }
  const submitBtn =
    document.getElementById(
      'submit-utr-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
  }

  goToDepositStep(3);
};

window.goBackToStep2 = function() {
  goToDepositStep(2);
  startDepositTimer();
};

// ── Deposit timer ──────────────────────────────
function startDepositTimer() {
  stopDepositTimer();
  const timeoutMins =
    appSettings?.depositTimeoutMins || 10;
  let remaining = timeoutMins * 60;

  const timerEl =
    document.getElementById(
      'deposit-timer');

  function tick() {
    if (!timerEl) return;
    const mins =
      Math.floor(remaining / 60);
    const secs = remaining % 60;
    timerEl.textContent =
      `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (remaining <= 120) {
      timerEl.className =
        'deposit-timer danger';
    } else if (remaining <= 300) {
      timerEl.className =
        'deposit-timer warning';
    } else {
      timerEl.className =
        'deposit-timer normal';
    }

    if (remaining <= 0) {
      stopDepositTimer();
      timerEl.textContent = 'EXPIRED ⏱';
      showToast(
        'Payment time expired',
        'error');
      closeDepositSheet();
      return;
    }
    remaining--;
  }

  tick();
  depositTimerInterval =
    setInterval(tick, 1000);
}

function stopDepositTimer() {
  if (depositTimerInterval) {
    clearInterval(depositTimerInterval);
    depositTimerInterval = null;
  }
}

// ── UTR input handler ──────────────────────────
window.onUTRInput = function(input) {
  // Uppercase + alphanumeric only
  input.value =
    input.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 22);

  const btn =
    document.getElementById(
      'submit-utr-btn');
  if (btn) {
    btn.disabled =
      input.value.length < 6;
  }
};

// ── Submit UTR ─────────────────────────────────
window.submitUTR = async function() {
  const utrInput =
    document.getElementById('utr-input');
  const utr =
    utrInput?.value.trim().toUpperCase();

  if (!utr || utr.length < 6) {
    showToast(
      'Enter a valid UTR number', 'error');
    return;
  }

  const submitBtn =
    document.getElementById(
      'submit-utr-btn');
  const backBtn =
    document.getElementById('utr-back-btn');
  const loadingEl =
    document.getElementById('utr-loading');

  setButtonLoading(submitBtn, true);
  if (backBtn) backBtn.disabled = true;

  try {
    // Check if UTR already used
    const exists = await checkUTRExists(utr);
    if (exists) {
      showToast(
        '❌ UTR already used', 'error');
      setButtonLoading(submitBtn, false);
      if (backBtn) backBtn.disabled = false;
      return;
    }

    // Create deposit request
    depositRequestId =
      await createDepositRequest(
        userData.uid,
        userData,
        selectedAmount,
        selectedAmount,
        selectedApp,
        utr
      );

    // Show loading
    submitBtn.style.display = 'none';
    if (backBtn) {
      backBtn.style.display = 'none';
    }
    if (loadingEl) {
      loadingEl.classList.remove('hidden');
    }

    // Listen for status change
    depositUnsub =
      listenToDepositRequest(
        depositRequestId,
        (reqData) => {
          if (reqData.status ===
              'verified') {
            if (loadingEl) {
              loadingEl.classList
                .add('hidden');
            }
            showToast(
              `🪙 ${selectedAmount} Coins Added!`,
              'success', 4000);
            closeDepositSheet();
            if (depositUnsub) {
              depositUnsub();
              depositUnsub = null;
            }
          } else if (
            reqData.status === 'rejected'
          ) {
            if (loadingEl) {
              loadingEl.classList
                .add('hidden');
            }
            showToast(
              '❌ Payment rejected',
              'error', 4000);
            closeDepositSheet();
            if (depositUnsub) {
              depositUnsub();
              depositUnsub = null;
            }
          } else if (
            reqData.status === 'expired'
          ) {
            if (loadingEl) {
              loadingEl.classList
                .add('hidden');
            }
            showToast(
              'Deposit request expired',
              'info');
            closeDepositSheet();
            if (depositUnsub) {
              depositUnsub();
              depositUnsub = null;
            }
          }
        }
      );

  } catch (err) {
    setButtonLoading(submitBtn, false);
    if (backBtn) backBtn.disabled = false;
    showToast(
      'Could not submit. Try again.',
      'error');
  }
};

// ════════════════════════════════════════════
// WITHDRAW SHEET
// ════════════════════════════════════════════

window.openWithdrawSheet = function() {
  updateAvailableWin();
  const holderEl =
    document.getElementById('holder-name');
  const upiEl =
    document.getElementById('upi-id');
  const amountEl =
    document.getElementById(
      'withdraw-amount');
  if (holderEl) holderEl.value = '';
  if (upiEl) upiEl.value = '';
  if (amountEl) amountEl.value = '';
  const btn =
    document.getElementById('withdraw-btn');
  if (btn) btn.disabled = true;
  openSheet('withdraw-sheet');
};

window.closeWithdrawSheet = function() {
  closeSheet('withdraw-sheet');
};

window.onWithdrawInput = function() {
  const btn =
    document.getElementById('withdraw-btn');
  const holderEl =
    document.getElementById('holder-name');
  const upiEl =
    document.getElementById('upi-id');
  const amountEl =
    document.getElementById(
      'withdraw-amount');

  if (!btn) return;

  const holder =
    holderEl?.value.trim();
  const upi =
    upiEl?.value.trim();
  const amount =
    parseInt(amountEl?.value) || 0;
  const minCoins =
    appSettings?.withdrawMinCoins || 100;
  const winCoins =
    userData?.winCoins || 0;

  btn.disabled = !(
    holder &&
    upi &&
    isValidUPI(upi) &&
    amount >= minCoins &&
    amount <= winCoins
  );
};

window.submitWithdraw = async function() {
  const holderEl =
    document.getElementById('holder-name');
  const upiEl =
    document.getElementById('upi-id');
  const amountEl =
    document.getElementById(
      'withdraw-amount');

  const holder =
    holderEl?.value.trim();
  const upi =
    upiEl?.value.trim();
  const coins =
    parseInt(amountEl?.value) || 0;
  const minCoins =
    appSettings?.withdrawMinCoins || 100;
  const winCoins =
    userData?.winCoins || 0;

  if (!holder) {
    showToast(
      'Enter account holder name',
      'error');
    return;
  }
  if (!upi || !isValidUPI(upi)) {
    showToast('Enter valid UPI ID', 'error');
    return;
  }
  if (coins < minCoins) {
    showToast(
      `Minimum withdrawal is 🪙 ${minCoins}`,
      'error');
    return;
  }
  if (coins > winCoins) {
    showToast(
      'Insufficient win coins', 'error');
    return;
  }

  const btn =
    document.getElementById('withdraw-btn');
  setButtonLoading(btn, true);

  try {
    await createWithdrawal(
      userData.uid,
      userData,
      holder,
      upi,
      coins,
      coins // 1 coin = 1 rupee
    );

    closeWithdrawSheet();
    showToast(
      '✅ Withdrawal request submitted!',
      'success', 4000);

  } catch (err) {
    setButtonLoading(btn, false);
    let msg = 'Withdrawal failed';
    if (err.message ===
        'Insufficient win coins') {
      msg = '🪙 Not enough win coins';
    }
    showToast(msg, 'error');
  }
};

// ════════════════════════════════════════════
// TRANSACTION HISTORY
// ════════════════════════════════════════════

function renderTransactions(txList) {
  const listEl =
    document.getElementById('tx-list');
  if (!listEl) return;

  if (!txList.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          📋
        </div>
        <div class="empty-state-title">
          No transactions yet
        </div>
      </div>`;
    return;
  }

  listEl.innerHTML = txList.map(tx => {
    const credit = isCredit(tx.type);
    const icon = getTxIcon(tx.type);
    const label = getTxLabel(tx.type);
    const coins =
      Math.abs(tx.coins || 0);
    const time =
      tx.createdAt
        ? timeAgo(tx.createdAt)
        : '—';

    return `
      <div class="tx-row">
        <div class="tx-icon
          ${credit
            ? 'tx-icon-credit'
            : 'tx-icon-debit'}">
          ${icon}
        </div>
        <div class="tx-info">
          <div class="tx-desc">
            ${label}
          </div>
          <div class="tx-date">
            ${time}
          </div>
        </div>
        <div class="tx-amount
          ${credit
            ? 'tx-amount-credit'
            : 'tx-amount-debit'}">
          ${credit ? '+' : '-'}🪙${
            coins.toLocaleString('en-IN')}
        </div>
      </div>`;
  }).join('');
}

// ── Cleanup ───────────────────────────────────
window.addEventListener('pagehide', () => {
  if (unsubUser) unsubUser();
  if (unsubTx) unsubTx();
  if (depositUnsub) depositUnsub();
  stopDepositTimer();
});

// ── Start ─────────────────────────────────────
init();