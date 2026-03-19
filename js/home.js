// ═══════════════════════════════════════════════
// GAMEZONE — HOME PAGE
// Banners + Categories + Coin chip realtime
// ═══════════════════════════════════════════════

import { requireAuth, getTotalCoins }
  from './auth.js';
import { listenToBanners,
  listenToCategories }
  from './rtdb.js';
import { listenToUser }
  from './firestore.js';
import { hidePageLoader, showToast }
  from './utils.js';

// ── DOM refs ──────────────────────────────────
const greetingEl =
  document.getElementById('greeting');
const coinChipEl =
  document.getElementById('coin-chip');
const bannerSlider =
  document.getElementById('banner-slider');
const bannerDots =
  document.getElementById('banner-dots');
const categoriesGrid =
  document.getElementById(
    'categories-grid');

// ── State ─────────────────────────────────────
let bannerList = [];
let currentBanner = 0;
let bannerInterval = null;
let unsubUser = null;
let unsubBanners = null;
let unsubCategories = null;

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════

async function init() {
  try {
    const userData = await requireAuth();
    hidePageLoader();
    setupGreeting(userData);
    setupCoinChip(userData);
    listenUserRealtime(userData.uid);
    loadBanners();
    loadCategories();
  } catch (err) {
    // requireAuth handles redirect
  }
}

// ════════════════════════════════════════════
// GREETING + COIN CHIP
// ════════════════════════════════════════════

function setupGreeting(userData) {
  const name =
    userData.firstName || 'Player';
  const hour = new Date().getHours();
  let prefix = 'Hey';
  if (hour >= 5 && hour < 12)
    prefix = 'Good morning,';
  else if (hour >= 12 && hour < 17)
    prefix = 'Good afternoon,';
  else if (hour >= 17 && hour < 21)
    prefix = 'Good evening,';
  else
    prefix = 'Hey,';

  if (greetingEl) {
    greetingEl.textContent =
      `${prefix} ${name} 👋`;
  }
}

function setupCoinChip(userData) {
  const total = getTotalCoins(userData);
  if (coinChipEl) {
    coinChipEl.textContent =
      `🪙 ${total.toLocaleString('en-IN')}`;
  }
}

function listenUserRealtime(uid) {
  unsubUser = listenToUser(uid,
    (userData) => {
      setupCoinChip(userData);
    });
}

// ════════════════════════════════════════════
// BANNERS
// ════════════════════════════════════════════

function loadBanners() {
  unsubBanners = listenToBanners(
    (banners) => {
      bannerList = banners;
      renderBanners(banners);
    });
}

function renderBanners(banners) {
  if (!bannerSlider || !bannerDots) return;

  if (!banners.length) {
    bannerSlider.innerHTML = `
      <div class="banner-slide" style="
        background: linear-gradient(
          135deg, #0C0C2A, #6A0DAD22);
        display: flex;
        align-items: center;
        justify-content: center;">
        <div class="banner-content"
          style="text-align:center">
          <div class="banner-title">
            ⚔️ GAMEZONE
          </div>
          <div class="banner-subtitle">
            Tournaments coming soon!
          </div>
        </div>
      </div>`;
    bannerDots.innerHTML = '';
    return;
  }

  // Render slides
  bannerSlider.innerHTML =
    banners.map((b, i) => `
      <div class="banner-slide"
        style="background-image:
          url('${b.imageUrl || ''}');
          background-color: #101035;">
        <div class="banner-content">
          <div class="banner-title">
            ${escapeHtml(b.title || '')}
          </div>
          ${b.subtitle ? `
            <div class="banner-subtitle">
              ${escapeHtml(b.subtitle)}
            </div>` : ''}
        </div>
      </div>
    `).join('');

  // Render dots
  bannerDots.innerHTML =
    banners.map((_, i) => `
      <div class="banner-dot
        ${i === 0 ? 'active' : ''}"
        onclick="goToBanner(${i})">
      </div>
    `).join('');

  // Start auto-advance
  startBannerAuto();

  // Sync dots on manual scroll
  bannerSlider.addEventListener(
    'scroll', onBannerScroll, {
      passive: true });
}

function startBannerAuto() {
  if (bannerInterval) {
    clearInterval(bannerInterval);
  }
  if (bannerList.length <= 1) return;

  bannerInterval = setInterval(() => {
    currentBanner =
      (currentBanner + 1) %
      bannerList.length;
    scrollToBanner(currentBanner);
  }, 3000);
}

function scrollToBanner(index) {
  if (!bannerSlider) return;
  const slideWidth =
    bannerSlider.offsetWidth;
  bannerSlider.scrollTo({
    left: slideWidth * index,
    behavior: 'smooth'
  });
  updateDots(index);
}

window.goToBanner = function(index) {
  currentBanner = index;
  scrollToBanner(index);
  // Reset timer
  startBannerAuto();
};

function onBannerScroll() {
  if (!bannerSlider) return;
  const slideWidth =
    bannerSlider.offsetWidth;
  if (!slideWidth) return;
  const index = Math.round(
    bannerSlider.scrollLeft / slideWidth);
  if (index !== currentBanner) {
    currentBanner = index;
    updateDots(index);
  }
}

function updateDots(activeIndex) {
  if (!bannerDots) return;
  bannerDots.querySelectorAll(
    '.banner-dot'
  ).forEach((dot, i) => {
    dot.classList.toggle(
      'active', i === activeIndex);
  });
}

// ════════════════════════════════════════════
// CATEGORIES
// ════════════════════════════════════════════

function loadCategories() {
  unsubCategories = listenToCategories(
    (cats) => {
      renderCategories(cats);
    });
}

function renderCategories(cats) {
  if (!categoriesGrid) return;

  if (!cats.length) {
    categoriesGrid.innerHTML = `
      <div style="
        grid-column: 1/-1;
        padding: 40px 0;
        text-align: center;
        font-family: var(--font-ghost);
        font-size: 13px;
        color: var(--twilight);
        letter-spacing: 1px;">
        No categories yet
      </div>`;
    return;
  }

  categoriesGrid.innerHTML =
    cats.map(cat => `
      <div class="category-card"
        style="background-image:
          url('${cat.imageUrl || ''}');"
        onclick="openCategory(
          '${cat.id}',
          '${escapeHtml(cat.title || 'Category')}')">
        <div class="category-title">
          ${escapeHtml(cat.title || '')}
        </div>
      </div>
    `).join('');
}

window.openCategory = function(
  id, title
) {
  window.location.href =
    `matches.html?cat=${
      encodeURIComponent(id)
    }&title=${
      encodeURIComponent(title)}`;
};

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Cleanup on page unload ────────────────────
window.addEventListener('pagehide', () => {
  if (unsubUser) unsubUser();
  if (unsubBanners) unsubBanners();
  if (unsubCategories) unsubCategories();
  if (bannerInterval) {
    clearInterval(bannerInterval);
  }
});

// ── Start ─────────────────────────────────────
init();