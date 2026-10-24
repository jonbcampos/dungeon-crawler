/**
 * Every colour the drawn art uses: a friendly Halloween night. Deep purple sky,
 * moonlit grass, warm pumpkin orange, and candy colours for everything good.
 */

export const PALETTE = {
  overlay: '#120a24',
  skyTop: '#1a1033',
  skyBottom: '#3b1f5c',
  moon: '#fff4c2',

  grassA: '#2f5a3a',
  grassB: '#346442',
  grassDot: '#3f7550',
  path: '#8a7a6a',
  pathEdge: '#6e6052',
  porch: '#a0703c',
  porchLine: '#7a5228',
  hedge: '#1f3f2a',
  hedgeLight: '#2e5a3c',
  trunk: '#5a3a24',
  treeTop: '#3a2a4a',
  fence: '#d9cdb8',
  fenceDark: '#9a8c74',
  wall: '#4a3a5c',
  wallLight: '#5c4a70',
  window: '#ffcf5c',
  stone: '#8a8fa0',
  stoneDark: '#5c6070',
  pumpkin: '#ff8c1a',
  pumpkinDark: '#c25a0a',
  stem: '#4a6a2a',
  leaves: '#c96a1e',
  leavesB: '#e09a2a',
  web: '#e8e8f0',
  hay: '#e2c15a',
  hayDark: '#b08a2a',
  gate: '#3a3048',
  gateLight: '#6a5a80',
  chest: '#9a5a2a',
  chestBand: '#ffd23f',

  gold: '#ffd23f',
  /** Hocus's pink collar and Pocus's blue one, for their name tags. */
  hocus: '#ff8fc8',
  pocus: '#6fb6ff',
  candyPink: '#ff6fb5',
  candyGreen: '#7cf29a',
  candyBlue: '#6fc8ff',
  heart: '#ff4d6d',
  key: '#ffd23f',
  orb: '#b98cff',
  seed: '#fff0c2',

  flame: '#ffb347',
  boom: '#ff7a1a',
  hudText: '#fff4e0',
  hudShadow: '#1a0f2e',
  panel: '#2a1a46',
  panelEdge: '#c9a6ff',
  button: '#ff8c1a',
  locked: '#3a3050',
  shadow: 'rgba(0, 0, 0, 0.35)',
} as const;

/** A `#rrggbb` colour at an opacity. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`;
}
