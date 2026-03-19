// ═══════════════════════════════════════════════
// GAMEZONE — REALTIME DATABASE FUNCTIONS
// Banners + Categories
// ═══════════════════════════════════════════════

import { rtdb } from './firebase-config.js';
import {
  ref,
  onValue,
  get,
  set,
  update,
  remove,
  push,
  orderByChild,
  equalTo,
  query
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js';

// ════════════════════════════════════════════
// BANNERS
// ════════════════════════════════════════════

/**
 * Listen to active banners sorted by order
 * @param {Function} callback - (banners[]) => void
 * @returns unsubscribe function
 */
export function listenToBanners(callback) {
  const bannersRef = ref(rtdb, 'banners');
  return onValue(bannersRef, (snap) => {
    const data = snap.val();
    if (!data) {
      callback([]);
      return;
    }
    const banners = Object.entries(data)
      .map(([id, val]) => ({ id, ...val }))
      .filter(b => b.active !== false)
      .sort((a, b) =>
        (a.order || 0) - (b.order || 0));
    callback(banners);
  });
}

/**
 * Get banners once (no realtime)
 */
export async function getBannersOnce() {
  const snap = await get(ref(rtdb, 'banners'));
  const data = snap.val();
  if (!data) return [];
  return Object.entries(data)
    .map(([id, val]) => ({ id, ...val }))
    .filter(b => b.active !== false)
    .sort((a, b) =>
      (a.order || 0) - (b.order || 0));
}

/**
 * Add a new banner
 */
export async function addBanner(bannerData) {
  const newRef = push(ref(rtdb, 'banners'));
  await set(newRef, {
    ...bannerData,
    active: true,
    order:  bannerData.order || 0
  });
  return newRef.key;
}

/**
 * Update a banner
 */
export async function updateBanner(
  id, data
) {
  await update(ref(rtdb, `banners/${id}`),
    data);
}

/**
 * Delete a banner
 */
export async function deleteBanner(id) {
  await remove(ref(rtdb, `banners/${id}`));
}

/**
 * Toggle banner active state
 */
export async function toggleBanner(
  id, active
) {
  await update(ref(rtdb, `banners/${id}`),
    { active });
}

// ════════════════════════════════════════════
// CATEGORIES
// ════════════════════════════════════════════

/**
 * Listen to active categories sorted by order
 * @param {Function} callback - (cats[]) => void
 * @returns unsubscribe function
 */
export function listenToCategories(callback) {
  const catsRef = ref(rtdb, 'categories');
  return onValue(catsRef, (snap) => {
    const data = snap.val();
    if (!data) {
      callback([]);
      return;
    }
    const cats = Object.entries(data)
      .map(([id, val]) => ({ id, ...val }))
      .filter(c => c.active !== false)
      .sort((a, b) =>
        (a.order || 0) - (b.order || 0));
    callback(cats);
  });
}

/**
 * Get categories once (no realtime)
 */
export async function getCategoriesOnce() {
  const snap = await get(
    ref(rtdb, 'categories'));
  const data = snap.val();
  if (!data) return [];
  return Object.entries(data)
    .map(([id, val]) => ({ id, ...val }))
    .filter(c => c.active !== false)
    .sort((a, b) =>
      (a.order || 0) - (b.order || 0));
}

/**
 * Get single category
 */
export async function getCategoryById(id) {
  const snap = await get(
    ref(rtdb, `categories/${id}`));
  return snap.exists()
    ? { id, ...snap.val() }
    : null;
}

/**
 * Add a new category
 */
export async function addCategory(catData) {
  const newRef = push(
    ref(rtdb, 'categories'));
  await set(newRef, {
    ...catData,
    active: true,
    order:  catData.order || 0
  });
  return newRef.key;
}

/**
 * Update a category
 */
export async function updateCategory(
  id, data
) {
  await update(
    ref(rtdb, `categories/${id}`), data);
}

/**
 * Delete a category
 */
export async function deleteCategory(id) {
  await remove(
    ref(rtdb, `categories/${id}`));
}

/**
 * Toggle category active state
 */
export async function toggleCategory(
  id, active
) {
  await update(
    ref(rtdb, `categories/${id}`),
    { active });
}