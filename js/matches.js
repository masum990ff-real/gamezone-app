// ═══════════════════════════════════════════════
// GAMEZONE — MATCHES PAGE
// ═══════════════════════════════════════════════

import { auth } from
  './firebase-config.js';
import {
  requireAuth,
  getTotalCoins
} from './auth.js';
import {
  listenToMatchesByCategory,
  getMatchPlayer,
  getMatchPlayers,
  joinMatchTransaction,
  listenToUser
} from './firestore.js';
import {
  hidePageLoader,
  showToast,
  openSheet,
  closeSheet,
  openModal,
  closeModal,
  setButtonLoading,
  copyToClipboard,
  formatScheduledTime,
  getUrlParam,
  showConfirm
} from './utils.js';
import {
  checkCoinSufficiency,
  formatCoinBreakdown
} from './coins.js';

// ── URL params ────────────────────────────────
const catId =
  getUrlParam('cat') || '';
const catTitle =
  getUrlParam('title') || 'MATCHES';

// ── DOM refs ──────────────────────────────────
const pageTitleEl =
  document.getElementById('page-title');
const coinChipEl =
  document.getElementById('coin-chip');

// ── State ─────────────────────────────────────
let userData = null;
let currentTab = 'upcoming';
let selectedMatch = null;
let selectedPlayerCount = 1;
let unsubUser = null;
let unsubMatches = {
  upcoming: null,
  live: null,
  completed: null
};

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════

async function init() {
  try {
    userData = await requireAuth();
    hidePageLoader();

    // Set page title
    if (pageTitleEl) {
      pageTitleEl.textContent =
        catTitle.toUpperCase();
    }

    // Coin chip
    updateCoinChip();

    // Listen user realtime
    unsubUser = listenToUser(
      userData.uid, (u) => {
        userData = {
          ...userData, ...u };
        updateCoinChip();
      });

    // Load all tabs
    loadTab('upcoming');
    loadTab('live');
    loadTab('completed');

  } catch (err) {
    // requireAuth redirects
  }
}

function updateCoinChip() {
  if (!coinChipEl || !userData) return;
  const total = getTotalCoins(userData);
  coinChipEl.textContent =
    `🪙 ${total.toLocaleString('en-IN')}`;
}

// ════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════

window.switchTab = function(tab) {
  currentTab = tab;

  // Update tab UI
  document.querySelectorAll('.tab-item')
    .forEach(t => {
      t.classList.toggle(
        'active',
        t.dataset.tab === tab);
    });

  // Show/hide lists
  ['upcoming', 'live', 'completed']
    .forEach(t => {
      const el =
        document.getElementById(
          `${t}-list`);
      if (el) {
        el.style.display =
          t === tab ? 'flex' : 'none';
      }
    });
};

function loadTab(status) {
  if (!catId) {
    renderEmpty(status,
      'No category selected');
    return;
  }

  unsubMatches[status] =
    listenToMatchesByCategory(
      catId, status,
      async (matches) => {
        await renderMatches(
          matches, status);
      });
}

// ════════════════════════════════════════════
// RENDER MATCHES
// ════════════════════════════════════════════

async function renderMatches(
  matches, status
) {
  const listEl =
    document.getElementById(
      `${status}-list`);
  if (!listEl) return;

  if (!matches.length) {
    renderEmpty(status,
      `No ${status} matches`);
    return;
  }

  // Check joined status for each match
  const uid = userData?.uid;
  const joinedMap = {};
  if (uid) {
    await Promise.all(
      matches.map(async (m) => {
        const p = await getMatchPlayer(
          m.id, uid);
        joinedMap[m.id] = !!p;
      })
    );
  }

  listEl.innerHTML = matches.map(
    (m, i) => buildMatchCard(
      m, joinedMap[m.id] || false, i)
  ).join('');
}

function renderEmpty(status, msg) {
  const listEl =
    document.getElementById(
      `${status}-list`);
  if (!listEl) return;
  listEl.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">
        ${status === 'upcoming'
          ? '⏳'
          : status === 'live'
          ? '🔴' : '🏆'}
      </div>
      <div class="empty-state-title">
        ${msg}
      </div>
      <div class="empty-state-subtitle">
        Check back soon!
      </div>
    </div>`;
}

// ════════════════════════════════════════════
// BUILD MATCH CARD HTML
// ════════════════════════════════════════════

function buildMatchCard(
  match, isJoined, index
) {
  const slotsPercent = match.totalSlots
    ? Math.round(
        (match.filledSlots /
         match.totalSlots) * 100)
    : 0;
  const isFull =
    match.filledSlots >= match.totalSlots;
  const delay =
    `animation-delay:${index * 80}ms`;

  // Action button
  let actionBtn = '';
  if (match.status === 'upcoming') {
    if (isFull) {
      actionBtn = `
        <button class="match-action-btn"
          style="opacity:0.5;
          cursor:not-allowed;
          background:var(--bg-nebula);
          color:var(--twilight);">
          FULL 🔒
        </button>`;
    } else if (isJoined) {
      actionBtn = `
        <button class="match-action-btn
          btn-room"
          onclick="openJoinedInfo(
            '${match.id}')">
          JOINED ✅
        </button>`;
    } else {
      actionBtn = `
        <button class="match-action-btn
          btn-join"
          onclick="openJoinSheet(
            '${match.id}')">
          JOIN ⚔️
        </button>`;
    }
  } else if (match.status === 'live') {
    if (isJoined) {
      actionBtn = `
        <button class="match-action-btn
          btn-room"
          onclick="openRoomDetails(
            '${match.id}',
            '${escHtml(
              match.roomId || '')}',
            '${escHtml(
              match.roomPassword || '')}')">
          ROOM 🔑
        </button>`;
    } else {
      actionBtn = `
        <button class="match-action-btn
          btn-live"
          disabled>
          🔴 LIVE
        </button>`;
    }
  } else if (match.status === 'completed') {
    actionBtn = `
      <button class="match-action-btn
        btn-results"
        onclick="openResults(
          '${match.id}',
          '${escHtml(match.title)}')">
        RESULTS 🏆
      </button>`;
  }

  return `
    <div class="match-card"
      style="${delay}">

      <!-- Image -->
      <div class="match-card-image-wrap">
        ${match.imageUrl
          ? `<img src="${
              escHtml(match.imageUrl)}"
              alt="${escHtml(match.title)}"
              loading="lazy" />`
          : `<div style="
              width:100%;height:100%;
              background:linear-gradient(
                135deg,#0C0C2A,#101035);
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:40px;">⚔️</div>`
        }
        <!-- Badges -->
        <div class="match-card-badges">
          <span class="badge
            badge-${match.matchType ||
              'solo'}">
            ${(match.matchType ||
              'SOLO').toUpperCase()}
          </span>
          <span class="badge
            badge-${match.status}">
            ${match.status === 'live'
              ? '🔴 LIVE'
              : match.status === 'completed'
              ? '✅ DONE'
              : '⏳ SOON'}
          </span>
        </div>
      </div>

      <!-- Body -->
      <div class="match-card-body">
        <div class="match-card-title">
          ${escHtml(match.title || '')}
        </div>

        <!-- Info grid -->
        <div class="match-info-grid">
          <div class="match-info-item">
            <span>⏰</span>
            <span class="match-info-value">
              ${formatScheduledTime(
                match.scheduledTime)}
            </span>
          </div>
          <div class="match-info-item">
            <span>🗺️</span>
            <span class="match-info-value">
              ${escHtml(
                match.mapName || '—')}
            </span>
          </div>
          <div class="match-info-item">
            <span>🏆</span>
            <span class="match-info-coin">
              🪙 ${match.totalCoins || 0}
            </span>
          </div>
          ${match.rewardType === 'perKill'
            ? `<div class="match-info-item">
                <span>🎯</span>
                <span
                  class="match-info-coin">
                  🪙 ${
                    match.perKillCoins || 0
                  }/kill
                </span>
               </div>`
            : `<div class="match-info-item">
                <span>💳</span>
                <span
                  class="match-info-value">
                  Entry: 🪙 ${
                    match.entryCoins || 0}
                </span>
               </div>`
          }
        </div>

        <!-- Slots progress -->
        <div class="slots-section">
          <div class="slots-header">
            <span class="slots-label">
              SLOTS
            </span>
            <span class="slots-count">
              ${match.filledSlots || 0} /
              ${match.totalSlots || 0}
            </span>
          </div>
          <div class="slots-bar">
            <div class="slots-fill
              ${isFull ? 'full' : ''}"
              style="width:${
                slotsPercent}%">
            </div>
          </div>
        </div>

        <!-- Action button -->
        ${actionBtn}
      </div>
    </div>`;
}

// ════════════════════════════════════════════
// JOIN SHEET
// ════════════════════════════════════════════

window.openJoinSheet = async function(
  matchId
) {
  // Find match in current lists
  selectedMatch = await findMatch(matchId);
  if (!selectedMatch) return;

  selectedPlayerCount = 1;

  // Populate sheet
  const thumb =
    document.getElementById('join-thumb');
  const titleEl =
    document.getElementById('join-title');
  const entryEl =
    document.getElementById('join-entry');

  if (thumb) {
    thumb.src =
      selectedMatch.imageUrl || '';
    thumb.style.display =
      selectedMatch.imageUrl
        ? 'block' : 'none';
  }
  if (titleEl) {
    titleEl.textContent =
      selectedMatch.title || '';
  }
  if (entryEl) {
    entryEl.textContent =
      `Entry: 🪙 ${
        selectedMatch.entryCoins || 0
      } per player`;
  }

  // Balance check
  updateBalanceCheck();

  // Player count chips
  setupPlayerChips();

  // Username inputs
  updateUsernameInputs();

  // Update total
  updateJoinTotal();

  openSheet('join-sheet');
};

window.closeJoinSheet = function() {
  closeSheet('join-sheet');
  selectedMatch = null;
};

function updateBalanceCheck() {
  const checkEl =
    document.getElementById(
      'balance-check');
  const amountEl =
    document.getElementById(
      'balance-amount');
  const breakdownEl =
    document.getElementById(
      'balance-breakdown');
  if (!checkEl || !userData) return;

  const total = getTotalCoins(userData);
  const required =
    (selectedMatch?.entryCoins || 0) *
    selectedPlayerCount;

  const suf = total >= required;
  checkEl.className =
    `balance-check ${
      suf ? 'sufficient' : 'insufficient'}`;

  if (amountEl) {
    amountEl.textContent =
      `🪙 ${total.toLocaleString('en-IN')}`;
  }
  if (breakdownEl) {
    breakdownEl.textContent =
      formatCoinBreakdown(userData);
  }
}

function setupPlayerChips() {
  if (!selectedMatch) return;
  const wrap =
    document.getElementById(
      'player-count-wrap');
  const chipsEl =
    document.getElementById(
      'player-chips');

  const type =
    selectedMatch.matchType || 'solo';

  if (type === 'solo') {
    selectedPlayerCount = 1;
    if (wrap) wrap.style.display = 'none';
    return;
  }

  if (wrap) wrap.style.display = 'block';

  const maxPlayers =
    type === 'duo' ? 2 : 4;
  const options = [];
  for (let i = 1; i <= maxPlayers; i++) {
    options.push(i);
  }

  if (chipsEl) {
    chipsEl.innerHTML = options.map(n => `
      <div class="player-chip
        ${n === selectedPlayerCount
          ? 'active' : ''}"
        onclick="selectPlayerCount(${n})">
        ${n} Player${n > 1 ? 's' : ''}
      </div>
    `).join('');
  }
}

window.selectPlayerCount = function(n) {
  selectedPlayerCount = n;
  // Update chips
  document.querySelectorAll(
    '.player-chip'
  ).forEach((chip, i) => {
    chip.classList.toggle(
      'active', i + 1 === n);
  });
  updateUsernameInputs();
  updateJoinTotal();
  updateBalanceCheck();
};

function updateUsernameInputs() {
  const wrap =
    document.getElementById(
      'username-inputs');
  if (!wrap) return;

  wrap.innerHTML = Array.from(
    { length: selectedPlayerCount },
    (_, i) => `
      <div class="input-wrap">
        <label class="input-label">
          ${selectedPlayerCount > 1
            ? `Player ${i + 1} `
            : ''}Game Username
        </label>
        <input
          type="text"
          id="username-${i}"
          class="input-field"
          placeholder="In-game username"
          maxlength="30" />
      </div>
    `
  ).join('');
}

function updateJoinTotal() {
  const totalEl =
    document.getElementById(
      'join-total-amount');
  if (!totalEl || !selectedMatch) return;
  const total =
    (selectedMatch.entryCoins || 0) *
    selectedPlayerCount;
  totalEl.textContent =
    `🪙 ${total.toLocaleString('en-IN')}`;
}

// ════════════════════════════════════════════
// CONFIRM JOIN
// ════════════════════════════════════════════

window.confirmJoin = async function() {
  if (!selectedMatch || !userData) return;

  // Collect usernames
  const usernames = [];
  for (let i = 0;
    i < selectedPlayerCount; i++) {
    const val = document.getElementById(
      `username-${i}`)?.value.trim();
    if (!val) {
      showToast(
        `Enter player ${i + 1} username`,
        'error');
      return;
    }
    usernames.push(val);
  }

  const totalCoins =
    (selectedMatch.entryCoins || 0) *
    selectedPlayerCount;
  const userTotal =
    getTotalCoins(userData);

  if (userTotal < totalCoins) {
    showToast(
      '🪙 Insufficient coins', 'error');
    return;
  }

  const btn =
    document.getElementById(
      'confirm-join-btn');
  setButtonLoading(btn, true);

  try {
    await joinMatchTransaction(
      selectedMatch.id,
      userData.uid,
      usernames,
      selectedPlayerCount,
      selectedMatch.entryCoins || 0
    );

    closeJoinSheet();
    showToast(
      '✅ Joined successfully!',
      'success');

    // Refresh match list
    loadTab(currentTab);

  } catch (err) {
    setButtonLoading(btn, false);
    let msg = 'Could not join match';
    if (err.message ===
        'Insufficient coins') {
      msg = '🪙 Not enough coins';
    } else if (err.message ===
        'Match is full') {
      msg = 'Match is full';
    } else if (err.message ===
        'Match not joinable') {
      msg = 'Match is no longer available';
    }
    showToast(msg, 'error');
  }
};

// ════════════════════════════════════════════
// ROOM DETAILS
// ════════════════════════════════════════════

window.openRoomDetails = function(
  matchId, roomId, roomPass
) {
  const roomIdEl =
    document.getElementById('room-id-val');
  const roomPassEl =
    document.getElementById('room-pass-val');

  if (roomIdEl) {
    roomIdEl.textContent =
      roomId || 'Not set yet';
  }
  if (roomPassEl) {
    roomPassEl.textContent =
      roomPass || 'Not set yet';
  }
  openModal('room-modal');
};

window.copyRoomId = function() {
  const val =
    document.getElementById(
      'room-id-val')?.textContent;
  if (val) copyToClipboard(val);
};

window.copyRoomPass = function() {
  const val =
    document.getElementById(
      'room-pass-val')?.textContent;
  if (val) copyToClipboard(val);
};

window.closeRoomModal = function(e) {
  if (!e || e.target.id === 'room-modal'
      || e.target.tagName === 'BUTTON') {
    closeModal('room-modal');
  }
};

window.openJoinedInfo = async function(
  matchId
) {
  const match = await findMatch(matchId);
  if (!match) return;
  if (match.status === 'live' &&
      match.roomId) {
    openRoomDetails(
      matchId,
      match.roomId,
      match.roomPassword);
  } else {
    showToast(
      'Room details not available yet',
      'info');
  }
};

// ════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════

window.openResults = async function(
  matchId, matchTitle
) {
  const nameEl =
    document.getElementById(
      'results-match-name');
  const tableEl =
    document.getElementById(
      'results-table');

  if (nameEl) {
    nameEl.textContent = matchTitle || '';
  }
  if (tableEl) {
    tableEl.innerHTML = `
      <tr><td colspan="4"
        style="text-align:center;
        padding:20px;
        color:var(--twilight);">
        Loading...
      </td></tr>`;
  }

  openModal('results-modal');

  try {
    const players =
      await getMatchPlayers(matchId);
    const uid = userData?.uid;

    // Sort by coinsWon desc
    players.sort((a, b) =>
      (b.coinsWon || 0) -
      (a.coinsWon || 0));

    if (!players.length) {
      if (tableEl) {
        tableEl.innerHTML = `
          <tr><td colspan="4"
            style="text-align:center;
            padding:20px;
            color:var(--twilight);">
            No results yet
          </td></tr>`;
      }
      return;
    }

    const rankEmoji =
      (r) => r === 1
        ? '👑'
        : r === 2
        ? '🥈'
        : r === 3
        ? '🥉'
        : `#${r}`;

    if (tableEl) {
      tableEl.innerHTML = `
        <thead>
          <tr>
            <th>#</th>
            <th>PLAYER</th>
            <th>KILLS</th>
            <th>🪙 WON</th>
          </tr>
        </thead>
        <tbody>
          ${players.map((p, i) => {
            const rank = i + 1;
            const isMe =
              p.uid === uid;
            const rankClass =
              rank === 1
                ? 'rank-1'
                : rank === 2
                ? 'rank-2'
                : rank === 3
                ? 'rank-3' : '';
            return `
              <tr class="
                ${isMe
                  ? 'current-user'
                  : ''}">
                <td class="${rankClass}">
                  ${rankEmoji(rank)}
                </td>
                <td>
                  ${escHtml(
                    (p.gameUsernames?.[0]
                    || 'Player'))}
                  ${isMe
                    ? ' <span style="color:var(--neon-cyan);font-size:10px;">YOU</span>'
                    : ''}
                </td>
                <td>${p.kills || 0}</td>
                <td class="coin-won">
                  ${p.coinsWon > 0
                    ? `🪙 ${p.coinsWon}`
                    : '—'}
                </td>
              </tr>`;
          }).join('')}
        </tbody>`;
    }
  } catch (err) {
    if (tableEl) {
      tableEl.innerHTML = `
        <tr><td colspan="4"
          style="text-align:center;
          padding:20px;
          color:var(--alert-red);">
          Could not load results
        </td></tr>`;
    }
  }
};

window.closeResultsModal = function(e) {
  if (!e ||
      e.target.id === 'results-modal' ||
      e.target.tagName === 'BUTTON') {
    closeModal('results-modal');
  }
};

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════

async function findMatch(matchId) {
  // Search in all rendered lists
  for (const status of
    ['upcoming', 'live', 'completed']) {
    const el =
      document.getElementById(
        `${status}-list`);
    if (!el) continue;
  }
  // Fetch fresh from Firestore
  const { getMatchDoc } =
    await import('./firestore.js');
  return await getMatchDoc(matchId);
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Cleanup ───────────────────────────────────
window.addEventListener('pagehide', () => {
  if (unsubUser) unsubUser();
  Object.values(unsubMatches)
    .forEach(u => u && u());
});

// ── Start ─────────────────────────────────────
init();