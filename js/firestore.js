// ═══════════════════════════════════════════════
// GAMEZONE — FIRESTORE CRUD FUNCTIONS
// ═══════════════════════════════════════════════

import { db, auth } from './firebase-config.js';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  FieldValue
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

// ════════════════════════════════════════════
// USER FUNCTIONS
// ════════════════════════════════════════════

export async function getUserDoc(uid) {
  const snap = await getDoc(
    doc(db, 'users', uid));
  return snap.exists()
    ? { uid: snap.id, ...snap.data() }
    : null;
}

export function listenToUser(uid, callback) {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (snap.exists()) {
        callback({ uid: snap.id, ...snap.data() });
      }
    }
  );
}

export async function createUserDoc(
  uid, data
) {
  await setDoc(doc(db, 'users', uid), {
    ...data,
    depositCoins:    0,
    winCoins:        0,
    bonusCoins:      0,
    totalMatches:    0,
    totalWins:       0,
    totalKills:      0,
    totalCoinsEarned: 0,
    totalReferred:   0,
    referralEarned:  0,
    referralRewardGiven: 0,
    role:            'player',
    status:          'active',
    createdAt:       serverTimestamp()
  });
}

export async function updateUserDoc(
  uid, data
) {
  await updateDoc(
    doc(db, 'users', uid), data);
}

// ════════════════════════════════════════════
// MATCH FUNCTIONS
// ════════════════════════════════════════════

export function listenToMatchesByCategory(
  categoryId, status, callback
) {
  let q;
  if (status === 'all') {
    q = query(
      collection(db, 'matches'),
      where('categoryId', '==', categoryId),
      orderBy('scheduledTime', 'desc')
    );
  } else {
    q = query(
      collection(db, 'matches'),
      where('categoryId', '==', categoryId),
      where('status', '==', status),
      orderBy('scheduledTime', 'asc')
    );
  }
  return onSnapshot(q, (snap) => {
    const matches = snap.docs.map(d => ({
      id: d.id, ...d.data() }));
    callback(matches);
  });
}

export async function getMatchDoc(matchId) {
  const snap = await getDoc(
    doc(db, 'matches', matchId));
  return snap.exists()
    ? { id: snap.id, ...snap.data() }
    : null;
}

export async function getMatchPlayer(
  matchId, uid
) {
  const snap = await getDoc(
    doc(db, 'matchPlayers', matchId,
      'players', uid));
  return snap.exists()
    ? { uid: snap.id, ...snap.data() }
    : null;
}

export function listenToMatchPlayer(
  matchId, uid, callback
) {
  return onSnapshot(
    doc(db, 'matchPlayers', matchId,
      'players', uid),
    (snap) => {
      callback(snap.exists()
        ? { uid: snap.id, ...snap.data() }
        : null);
    }
  );
}

export async function getMatchPlayers(matchId) {
  const snap = await getDocs(
    collection(db, 'matchPlayers',
      matchId, 'players'));
  return snap.docs.map(d => ({
    uid: d.id, ...d.data() }));
}

// ── Join match transaction ─────────────────────
export async function joinMatchTransaction(
  matchId, uid, usernames,
  playerCount, entryCoinsPer
) {
  const totalCoins = playerCount * entryCoinsPer;
  const userRef = doc(db, 'users', uid);
  const matchRef = doc(db, 'matches', matchId);
  const playerRef = doc(
    db, 'matchPlayers', matchId, 'players', uid);
  const txnRef = doc(
    collection(db, 'transactions'));

  await runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    const matchSnap = await tx.get(matchRef);

    if (!userSnap.exists())
      throw new Error('User not found');
    if (!matchSnap.exists())
      throw new Error('Match not found');

    const userData = userSnap.data();
    const matchData = matchSnap.data();

    // Check slots
    if (matchData.filledSlots >=
        matchData.totalSlots) {
      throw new Error('Match is full');
    }
    if (matchData.status !== 'upcoming') {
      throw new Error('Match not joinable');
    }

    // Calculate available coins
    // Deduct order: deposit → bonus → win
    const deposit =
      userData.depositCoins || 0;
    const bonus =
      userData.bonusCoins || 0;
    const win =
      userData.winCoins || 0;
    const total = deposit + bonus + win;

    if (total < totalCoins) {
      throw new Error('Insufficient coins');
    }

    // Deduct in order
    let remaining = totalCoins;
    const updates = {};

    if (remaining > 0 && deposit > 0) {
      const deduct =
        Math.min(remaining, deposit);
      updates.depositCoins =
        increment(-deduct);
      remaining -= deduct;
    }
    if (remaining > 0 && bonus > 0) {
      const deduct =
        Math.min(remaining, bonus);
      updates.bonusCoins =
        increment(-deduct);
      remaining -= deduct;
    }
    if (remaining > 0 && win > 0) {
      const deduct =
        Math.min(remaining, win);
      updates.winCoins =
        increment(-deduct);
      remaining -= deduct;
    }

    // Update user coins
    tx.update(userRef, {
      ...updates,
      totalMatches: increment(1)
    });

    // Update match slots
    tx.update(matchRef, {
      filledSlots: increment(1)
    });

    // Add player record
    tx.set(playerRef, {
      userId:       uid,
      matchId:      matchId,
      gameUsernames: usernames,
      playerCount:  playerCount,
      coinsFeePaid: totalCoins,
      joinedAt:     serverTimestamp(),
      kills:        0,
      coinsWon:     0,
      resultSaved:  false
    });

    // Add debit transaction
    tx.set(txnRef, {
      transactionId: txnRef.id,
      userId:        uid,
      userName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
      type:          'debit_entry',
      coins:         -totalCoins,
      amount:        totalCoins,
      description: `Match entry — ${matchData.title}`,
      createdAt:     serverTimestamp()
    });
  });
}

// ════════════════════════════════════════════
// DEPOSIT FUNCTIONS
// ════════════════════════════════════════════

export async function checkUTRExists(utr) {
  const q = query(
    collection(db, 'depositRequests'),
    where('utrNumber', '==',
      utr.toUpperCase())
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function createDepositRequest(
  uid, userData, coins, amount,
  selectedApp, utrNumber
) {
  const docRef = await addDoc(
    collection(db, 'depositRequests'), {
      userId:      uid,
      userName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
      userEmail:   userData.email || '',
      coins:       coins,
      amount:      amount,
      selectedApp: selectedApp,
      utrNumber:   utrNumber.toUpperCase(),
      status:      'pending',
      createdAt:   serverTimestamp(),
      verifiedAt:  null,
      verifiedBy:  '',
      adminNote:   ''
    });
  return docRef.id;
}

export function listenToDepositRequest(
  requestId, callback
) {
  return onSnapshot(
    doc(db, 'depositRequests', requestId),
    (snap) => {
      if (snap.exists()) {
        callback({ id: snap.id, ...snap.data() });
      }
    }
  );
}

export function listenToUserDeposits(
  uid, callback
) {
  const q = query(
    collection(db, 'depositRequests'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({
      id: d.id, ...d.data() })));
  });
}

// ════════════════════════════════════════════
// WITHDRAWAL FUNCTIONS
// ════════════════════════════════════════════

export async function createWithdrawal(
  uid, userData, holderName,
  upiId, coins, amount
) {
  const userRef = doc(db, 'users', uid);
  const txnRef = doc(
    collection(db, 'transactions'));
  const wdRef = doc(
    collection(db, 'withdrawalRequests'));

  await runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists())
      throw new Error('User not found');
    const uData = userSnap.data();
    if ((uData.winCoins || 0) < coins) {
      throw new Error(
        'Insufficient win coins');
    }

    tx.update(userRef, {
      winCoins: increment(-coins)
    });
    tx.set(wdRef, {
      requestId:   wdRef.id,
      userId:      uid,
      userName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
      userEmail:   userData.email || '',
      holderName:  holderName,
      userUpiId:   upiId,
      coins:       coins,
      amount:      amount,
      status:      'pending',
      createdAt:   serverTimestamp(),
      processedAt: null,
      adminNote:   ''
    });
    tx.set(txnRef, {
      transactionId: txnRef.id,
      userId:        uid,
      userName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
      type:          'debit_withdraw',
      coins:         -coins,
      amount:        amount,
      description:   `Withdrawal to ${upiId}`,
      createdAt:     serverTimestamp()
    });
  });
}

// ════════════════════════════════════════════
// TRANSACTION HISTORY
// ════════════════════════════════════════════

export function listenToTransactions(
  uid, callback, limitCount = 50
) {
  const q = query(
    collection(db, 'transactions'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({
      id: d.id, ...d.data() })));
  });
}

// ════════════════════════════════════════════
// REFERRAL FUNCTIONS
// ════════════════════════════════════════════

export async function getUserByReferralCode(
  code
) {
  const q = query(
    collection(db, 'users'),
    where('referralCode', '==',
      code.toUpperCase()),
    limit(1)
  );
  const snap = await getDocs(q);
  return snap.empty
    ? null
    : { uid: snap.docs[0].id,
        ...snap.docs[0].data() };
}

export async function checkReferralUsed(
  code, uid
) {
  const snap = await getDoc(
    doc(db, 'referralUses', code,
      'usedBy', uid));
  return snap.exists();
}

export async function applyReferralCode(
  code, uid, userData,
  referrerUid, referrerData,
  bonusCoins
) {
  const userRef =
    doc(db, 'users', uid);
  const referrerRef =
    doc(db, 'users', referrerUid);
  const useRef =
    doc(db, 'referralUses', code,
      'usedBy', uid);
  const txnRefUser =
    doc(collection(db, 'transactions'));
  const txnRefReferrer =
    doc(collection(db, 'transactions'));

  await runTransaction(db, async (tx) => {
    const referrerSnap =
      await tx.get(referrerRef);
    if (!referrerSnap.exists())
      throw new Error('Referrer not found');

    const rData = referrerSnap.data();
    const rewardsGiven =
      rData.referralRewardGiven || 0;

    // Apply bonus to user
    tx.update(userRef, {
      bonusCoins: increment(bonusCoins),
      referralUsedBy: referrerUid
    });

    // Apply bonus to referrer
    // (max 10 rewards)
    if (rewardsGiven < 10) {
      tx.update(referrerRef, {
        bonusCoins: increment(bonusCoins),
        totalReferred: increment(1),
        referralEarned: increment(bonusCoins),
        referralRewardGiven: increment(1)
      });
      // Referrer transaction
      tx.set(txnRefReferrer, {
        transactionId: txnRefReferrer.id,
        userId:        referrerUid,
        userName: `${referrerData.firstName || ''} ${referrerData.lastName || ''}`.trim(),
        type:          'credit_bonus',
        coins:         bonusCoins,
        amount:        0,
        description: `Referral bonus — ${userData.firstName || 'Player'} joined`,
        createdAt:     serverTimestamp()
      });
    }

    // Mark referral as used
    tx.set(useRef, {
      usedBy:     uid,
      usedAt:     serverTimestamp(),
      bonusGiven: true
    });

    // User bonus transaction
    tx.set(txnRefUser, {
      transactionId: txnRefUser.id,
      userId:        uid,
      userName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim(),
      type:          'credit_bonus',
      coins:         bonusCoins,
      amount:        0,
      description: `Referral bonus — used code ${code}`,
      createdAt:     serverTimestamp()
    });
  });
}

// ════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════

export async function getAppSettings() {
  const snap = await getDoc(
    doc(db, 'settings', 'app'));
  return snap.exists() ? snap.data() : {
    depositAmounts:    [20, 50, 100, 200],
    referralRewardCoins: 5,
    referralMaxUses:   10,
    withdrawMinCoins:  100,
    depositTimeoutMins: 30,
    adminUpiId:        '',
    adminUpiName:      '',
    qrCodeImageUrl:    '',
    maintenanceMode:   false,
    supportLink:       '',
    whatsappGroupLink: '',
    privacyPolicyText: '',
    fairPlayText:      ''
  };
}

export function listenToSettings(callback) {
  return onSnapshot(
    doc(db, 'settings', 'app'),
    (snap) => {
      if (snap.exists()) {
        callback(snap.data());
      }
    }
  );
}