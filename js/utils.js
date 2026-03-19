// ═══════════════════════════════════════════════
// GAMEZONE — UTILITY FUNCTIONS
// Toast + Bottom Sheet + Helpers + Formatting
// ═══════════════════════════════════════════════

// ════════════════════════════════════════════
// TOAST SYSTEM
// ════════════════════════════════════════════

let _toastContainer = null;

function getToastContainer() {
  if (!_toastContainer) {
    _toastContainer =
      document.getElementById('toast-container');
    if (!_toastContainer) {
      _toastContainer =
        document.createElement('div');
      _toastContainer.id = 'toast-container';
      _toastContainer.className =
        'toast-container';
      document.body.appendChild(
        _toastContainer);
    }
  }
  return _toastContainer;
}

/**
 * Show a toast notification
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} duration ms
 */
export function showToast(
  message,
  type = 'info',
  duration = 3000
) {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Vibrate on Android
  if (window.AndroidBridge) {
    window.AndroidBridge.vibrate(30);
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// ════════════════════════════════════════════
// BOTTOM SHEET SYSTEM
// ════════════════════════════════════════════

/**
 * Open a bottom sheet
 * @param {string} sheetId - element id
 */
export function openSheet(sheetId) {
  const sheet = document.getElementById(sheetId);
  const overlay = document.getElementById(
    sheetId + '-overlay') ||
    document.getElementById('sheet-overlay');
  if (!sheet) return;
  sheet.classList.add('open');
  if (overlay) overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Vibrate
  if (window.AndroidBridge) {
    window.AndroidBridge.vibrate(20);
  }
}

/**
 * Close a bottom sheet
 * @param {string} sheetId - element id
 */
export function closeSheet(sheetId) {
  const sheet = document.getElementById(sheetId);
  const overlay = document.getElementById(
    sheetId + '-overlay') ||
    document.getElementById('sheet-overlay');
  if (!sheet) return;
  sheet.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  document.body.style.overflow = '';
}

/**
 * Open a modal overlay
 * @param {string} modalId
 */
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

/**
 * Close a modal overlay
 * @param {string} modalId
 */
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

// ════════════════════════════════════════════
// FORMATTING HELPERS
// ════════════════════════════════════════════

/**
 * Format coin amount with 🪙 prefix
 */
export function formatCoins(amount) {
  const n = Math.floor(amount || 0);
  return `🪙 ${n.toLocaleString('en-IN')}`;
}

/**
 * Format number with Indian locale
 */
export function formatNumber(n) {
  return Math.floor(n || 0)
    .toLocaleString('en-IN');
}

/**
 * Format date from Firestore timestamp
 */
export function formatDate(timestamp) {
  if (!timestamp) return '—';
  const date = timestamp.toDate
    ? timestamp.toDate()
    : new Date(timestamp);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Format time from Firestore timestamp
 */
export function formatTime(timestamp) {
  if (!timestamp) return '—';
  const date = timestamp.toDate
    ? timestamp.toDate()
    : new Date(timestamp);
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format date + time together
 */
export function formatDateTime(timestamp) {
  if (!timestamp) return '—';
  return `${formatDate(timestamp)}, ${formatTime(timestamp)}`;
}

/**
 * Format ISO date string for display
 */
export function formatScheduledTime(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Time ago string
 */
export function timeAgo(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate
    ? timestamp.toDate()
    : new Date(timestamp);
  const seconds = Math.floor(
    (Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60)
    return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ════════════════════════════════════════════
// COPY TO CLIPBOARD
// ════════════════════════════════════════════

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied! ✅', 'success', 2000);
    return true;
  } catch (err) {
    // Fallback for older browsers
    try {
      const ta =
        document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('Copied! ✅', 'success', 2000);
      return true;
    } catch (e) {
      showToast('Copy failed', 'error');
      return false;
    }
  }
}

// ════════════════════════════════════════════
// SHARE
// ════════════════════════════════════════════

export async function shareContent(
  title, text, url = ''
) {
  // Android native share
  if (window.AndroidBridge) {
    window.AndroidBridge.shareText(
      `${text}${url ? '\n' + url : ''}`);
    return;
  }
  // Web Share API
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
    } catch (err) {
      // User cancelled — ignore
    }
  } else {
    // Fallback: copy to clipboard
    await copyToClipboard(
      `${text}${url ? '\n' + url : ''}`);
  }
}

// ════════════════════════════════════════════
// LOADING STATES
// ════════════════════════════════════════════

export function setButtonLoading(
  btn, loading, originalText = null
) {
  if (!btn) return;
  if (loading) {
    btn.dataset.originalText =
      btn.textContent;
    btn.classList.add('btn-loading');
    btn.textContent = '';
    btn.disabled = true;
  } else {
    btn.classList.remove('btn-loading');
    btn.textContent =
      originalText ||
      btn.dataset.originalText ||
      btn.textContent;
    btn.disabled = false;
  }
}

export function showPageLoader() {
  const loader =
    document.getElementById('page-loader');
  if (loader) loader.classList.remove('hide');
}

export function hidePageLoader() {
  const loader =
    document.getElementById('page-loader');
  if (loader) loader.classList.add('hide');
}

// ════════════════════════════════════════════
// NAVIGATION HELPERS
// ════════════════════════════════════════════

/**
 * Set active nav item
 * @param {string} page - 'home'|'matches'|
 *   'wallet'|'refer'|'profile'
 */
export function setActiveNav(page) {
  document.querySelectorAll('.nav-item')
    .forEach(item => {
      item.classList.toggle(
        'active',
        item.dataset.page === page
      );
    });
}

// ════════════════════════════════════════════
// VALIDATION HELPERS
// ════════════════════════════════════════════

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email);
}

export function isValidUPI(upi) {
  return /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/
    .test(upi);
}

export function isValidUTR(utr) {
  return /^[A-Z0-9]{6,22}$/i.test(utr);
}

export function isValidReferralCode(code) {
  return /^FF[A-Z0-9]{6}$/i.test(code);
}

// ════════════════════════════════════════════
// MISC HELPERS
// ════════════════════════════════════════════

export function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export function generateId(length = 8) {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() *
      chars.length)]
  ).join('');
}

export function getUrlParam(key) {
  return new URLSearchParams(
    window.location.search
  ).get(key);
}

export function sanitizeInput(str) {
  return str
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 500);
}

// ── Confirm dialog (custom) ───────────────────
export function showConfirm(
  title, message, onConfirm, onCancel
) {
  const existing =
    document.getElementById('gz-confirm');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'gz-confirm';
  modal.style.cssText = `
    position:fixed;inset:0;
    background:rgba(2,2,8,0.85);
    backdrop-filter:blur(8px);
    z-index:9998;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:20px;
    animation:fadeIn 0.2s ease;
  `;
  modal.innerHTML = `
    <div style="
      background:#0C0C2A;
      border:1.5px solid rgba(106,13,173,0.4);
      border-radius:20px;
      padding:28px 20px;
      max-width:320px;
      width:100%;
      text-align:center;
      animation:scaleIn 0.25s
        cubic-bezier(0.34,1.56,0.64,1);
    ">
      <div style="font-size:36px;
        margin-bottom:12px;"
      >⚠️</div>
      <div style="
        font-family:'Ghost',sans-serif;
        font-size:17px;
        font-weight:900;
        letter-spacing:2px;
        color:#F5F5FF;
        margin-bottom:8px;
        text-transform:uppercase;
      ">${title}</div>
      <div style="
        font-family:'Ghost',sans-serif;
        font-size:13px;
        color:#B8B8E0;
        margin-bottom:24px;
        line-height:1.6;
        letter-spacing:0.5px;
      ">${message}</div>
      <div style="
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:10px;
      ">
        <button id="gz-cancel" style="
          height:48px;
          border-radius:12px;
          background:transparent;
          border:1.5px solid
            rgba(255,255,255,0.12);
          color:#6B6B9A;
          font-family:'Ghost',sans-serif;
          font-size:13px;
          font-weight:700;
          letter-spacing:2px;
          cursor:pointer;
          text-transform:uppercase;
        ">CANCEL</button>
        <button id="gz-ok" style="
          height:48px;
          border-radius:12px;
          background:linear-gradient(
            135deg,#6A0DAD,#00E5FF);
          border:none;
          color:#F5F5FF;
          font-family:'Ghost',sans-serif;
          font-size:13px;
          font-weight:700;
          letter-spacing:2px;
          cursor:pointer;
          text-transform:uppercase;
        ">CONFIRM</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('gz-ok')
    .addEventListener('click', () => {
      modal.remove();
      if (onConfirm) onConfirm();
    });
  document.getElementById('gz-cancel')
    .addEventListener('click', () => {
      modal.remove();
      if (onCancel) onCancel();
    });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
      if (onCancel) onCancel();
    }
  });
}

// ── Transaction type helpers ──────────────────
export function getTxIcon(type) {
  const icons = {
    credit_deposit: '💳',
    credit_win:     '🏆',
    credit_bonus:   '🎁',
    debit_entry:    '⚔️',
    debit_withdraw: '💸',
    admin_credit:   '✨',
    admin_debit:    '🔧'
  };
  return icons[type] || '💫';
}

export function getTxLabel(type) {
  const labels = {
    credit_deposit: 'Wallet Deposit',
    credit_win:     'Match Winnings',
    credit_bonus:   'Referral Bonus',
    debit_entry:    'Match Entry',
    debit_withdraw: 'Withdrawal',
    admin_credit:   'Admin Credit',
    admin_debit:    'Admin Debit'
  };
  return labels[type] || type;
}

export function isCredit(type) {
  return type?.startsWith('credit') ||
    type === 'admin_credit';
}