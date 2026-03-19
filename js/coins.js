// ═══════════════════════════════════════════════
// GAMEZONE — COIN OPERATIONS
// Coin add animation + balance updates
// ═══════════════════════════════════════════════

import { getTotalCoins } from './auth.js';
import { formatCoins } from './utils.js';

// ════════════════════════════════════════════
// COIN ADD ANIMATION
// ════════════════════════════════════════════

/**
 * Trigger coin add animation
 * 8 coin emoji particles fly outward
 * Balance counter rolls up
 * @param {number} coinsAdded
 * @param {Element} balanceEl - element to update
 * @param {number} newTotal - new total amount
 */
export function runCoinAddAnimation(
  coinsAdded,
  balanceEl,
  newTotal
) {
  // 1. Spawn coin particles
  spawnCoinParticles(coinsAdded);

  // 2. Roll up counter
  if (balanceEl) {
    rollUpCounter(balanceEl, newTotal);
  }

  // 3. Float plus text
  if (balanceEl) {
    showFloatPlus(balanceEl, coinsAdded);
  }

  // 4. Pulse card
  const card = balanceEl?.closest(
    '.total-balance-card') ||
    balanceEl?.closest('.glass-card');
  if (card) {
    pulseCard(card);
  }

  // 5. Vibrate
  if (window.AndroidBridge) {
    window.AndroidBridge.vibrate(80);
  }
}

/**
 * Spawn 8 coin emoji particles
 */
function spawnCoinParticles(coinsAdded) {
  let container =
    document.getElementById(
      'coin-anim-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'coin-anim-container';
    container.className =
      'coin-anim-container';
    document.body.appendChild(container);
  }

  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;

  for (let i = 0; i < 8; i++) {
    const particle =
      document.createElement('div');
    particle.className = 'coin-particle';
    particle.textContent = '🪙';

    // Random direction
    const angle =
      (i / 8) * 360 +
      Math.random() * 30;
    const distance =
      80 + Math.random() * 80;
    const rad = (angle * Math.PI) / 180;
    const flyX =
      Math.cos(rad) * distance;
    const flyY =
      Math.sin(rad) * distance;

    particle.style.cssText = `
      left: ${centerX}px;
      top: ${centerY}px;
      --fly-x: ${flyX}px;
      --fly-y: ${flyY}px;
      animation-delay:
        ${i * 60}ms;
      font-size:
        ${20 + Math.random() * 12}px;
    `;

    container.appendChild(particle);
    setTimeout(() =>
      particle.remove(), 1200);
  }
}

/**
 * Roll up counter animation
 */
function rollUpCounter(el, newValue) {
  const duration = 800;
  const start = Date.now();
  const startValue = parseInt(
    el.textContent.replace(/\D/g, ''))
    || 0;
  const diff = newValue - startValue;

  function tick() {
    const elapsed = Date.now() - start;
    const progress = Math.min(
      elapsed / duration, 1);
    // Ease out
    const eased =
      1 - Math.pow(1 - progress, 3);
    const current = Math.floor(
      startValue + diff * eased);

    el.textContent =
      `🪙 ${current.toLocaleString('en-IN')}`;
    el.style.animation =
      'countRoll 0.3s ease both';

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent =
        `🪙 ${newValue.toLocaleString('en-IN')}`;
    }
  }
  requestAnimationFrame(tick);
}

/**
 * Show floating +🪙{n} text
 */
function showFloatPlus(el, coins) {
  const rect = el.getBoundingClientRect();
  const floatEl =
    document.createElement('div');
  floatEl.className = 'float-plus';
  floatEl.textContent =
    `+🪙 ${coins.toLocaleString('en-IN')}`;
  floatEl.style.cssText = `
    position: fixed;
    top: ${rect.top - 10}px;
    left: ${rect.left +
      rect.width / 2}px;
    transform: translateX(-50%);
    font-family: var(--font-ghost);
    font-size: 18px;
    font-weight: 900;
    color: #00E676;
    pointer-events: none;
    z-index: 8001;
    text-shadow:
      0 0 20px rgba(0,230,118,0.6);
    animation: floatPlus 1s ease forwards;
  `;
  document.body.appendChild(floatEl);
  setTimeout(() => floatEl.remove(), 1100);
}

/**
 * Pulse card scale
 */
function pulseCard(card) {
  card.style.transition =
    'transform 0.2s ease';
  card.style.transform = 'scale(1.03)';
  setTimeout(() => {
    card.style.transform = 'scale(1)';
  }, 200);
}

// ════════════════════════════════════════════
// BALANCE DISPLAY HELPERS
// ════════════════════════════════════════════

/**
 * Update all balance displays on page
 */
export function updateBalanceDisplays(
  userData
) {
  const total = getTotalCoins(userData);
  const deposit =
    userData.depositCoins || 0;
  const win =
    userData.winCoins || 0;
  const bonus =
    userData.bonusCoins || 0;

  // Total balance
  const totalEl =
    document.getElementById('total-coins');
  if (totalEl) {
    totalEl.textContent =
      `🪙 ${total.toLocaleString('en-IN')}`;
  }

  // Coin chip in top bar
  const chipEl =
    document.getElementById('coin-chip');
  if (chipEl) {
    chipEl.textContent =
      `🪙 ${total.toLocaleString('en-IN')}`;
  }

  // Individual balances
  const depositEl =
    document.getElementById(
      'deposit-coins');
  if (depositEl) {
    depositEl.textContent =
      deposit.toLocaleString('en-IN');
  }

  const winEl =
    document.getElementById('win-coins');
  if (winEl) {
    winEl.textContent =
      win.toLocaleString('en-IN');
  }

  const bonusEl =
    document.getElementById('bonus-coins');
  if (bonusEl) {
    bonusEl.textContent =
      bonus.toLocaleString('en-IN');
  }
}

/**
 * Animate balance update with coin anim
 */
export function animateBalanceUpdate(
  userData,
  prevTotal,
  coinsAdded
) {
  const newTotal = getTotalCoins(userData);
  const totalEl =
    document.getElementById('total-coins');

  if (coinsAdded > 0 && totalEl) {
    runCoinAddAnimation(
      coinsAdded,
      totalEl,
      newTotal
    );
  } else {
    updateBalanceDisplays(userData);
  }
}

// ════════════════════════════════════════════
// COIN SUFFICIENCY CHECK
// ════════════════════════════════════════════

/**
 * Check if user has enough coins
 * Returns detailed breakdown
 */
export function checkCoinSufficiency(
  userData,
  required
) {
  const deposit =
    userData?.depositCoins || 0;
  const win =
    userData?.winCoins || 0;
  const bonus =
    userData?.bonusCoins || 0;
  const total = deposit + win + bonus;

  return {
    sufficient: total >= required,
    total,
    deposit,
    win,
    bonus,
    shortfall: Math.max(0, required - total)
  };
}

/**
 * Format coin breakdown string
 */
export function formatCoinBreakdown(
  userData
) {
  const d = userData?.depositCoins || 0;
  const w = userData?.winCoins || 0;
  const b = userData?.bonusCoins || 0;
  return `💳 ${d} + 🏆 ${w} + 🎁 ${b}`;
}