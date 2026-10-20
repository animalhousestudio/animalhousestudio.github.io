// This module must stay independent of the world, loaders and asset catalog.
export const BOOTH_RETURN_KEY = 'animal-house:booth-return:v1';
export function experienceUrl(href, experience) {
  const url = new URL(href);
  // Keep the same deployed HTML path (template in dev, index in production).
  url.search = ''; url.hash = '';
  if (experience) url.searchParams.set('experience', experience);
  return url;
}
export function validReturnState(value) {
  return value?.version === 1 && Array.isArray(value.position) && value.position.length === 3
    && value.position.every(n => Number.isFinite(n) && Math.abs(n) < 2000)
    && Number.isFinite(value.yaw) && Number.isFinite(value.pitch);
}
export function saveReturnState(storage, state) {
  try { storage.setItem(BOOTH_RETURN_KEY, JSON.stringify({ ...state, version: 1 })); } catch { /* Storage can be disabled. */ }
}
export function takeReturnState(storage) {
  try {
    const raw = storage.getItem(BOOTH_RETURN_KEY);
    storage.removeItem(BOOTH_RETURN_KEY);
    const state = JSON.parse(raw);
    return validReturnState(state) ? state : null;
  } catch { return null; }
}
