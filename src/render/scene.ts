/**
 * Draws a frame of play: the night sky around the room, the room's tiles, the
 * pickups, monsters, boss, projectiles, the trick-or-treater, and the HUD.
 *
 * The tiles are drawn by code (grass, paths, hedges, fences, house walls) and
 * the things ON the tiles come from the painted sheets when they exist: props
 * (pumpkins, gravestones, trees, leaf piles, cobwebs, hay, chests, the candy
 * bowl), items, the monsters, the bosses and the three kids. Every one of them
 * has a drawn fallback, so the game plays with no art at all.
 */

import {
  BOSSES,
  CATS,
  HUD_H,
  MONSTERS,
  ORB,
  PLAYER,
  ROOM_COLS,
  ROOM_H,
  ROOM_ROWS,
  ROOM_SLIDE,
  ROOM_W,
  SCREEN,
  STICK,
  TILE,
  type MonsterKind,
} from '../game/config';
import { characterById, type Character } from '../game/content';
import type { Cat, GameState, Monster, Thought } from '../game/state';
import { DIRS, roomAt, type Theme } from '../game/streets';
import { PALETTE, alpha } from './palette';
import { drawStar, type Particles } from './particles';
import { drawSprite, frameBounds, sprite, spriteFrames } from './sprites';
import { drawText } from '../ui/text';

/** Where the room sits on screen. */
export function roomOrigin(): { x: number; y: number } {
  return { x: Math.round((SCREEN.w - ROOM_W) / 2), y: HUD_H + Math.round((SCREEN.h - HUD_H - ROOM_H) / 2) };
}

/** Screen shake and a white flash, kicked by main.ts. */
export const camera = { shake: 0, flash: 0 };

export function kick(shake: number, flash = 0): void {
  camera.shake = Math.min(1, camera.shake + shake);
  camera.flash = Math.max(camera.flash, flash);
}

export function updateCamera(dt: number): void {
  camera.shake = Math.max(0, camera.shake - dt * 2.5);
  camera.flash = Math.max(0, camera.flash - dt * 3);
}

/** Order of the monsters in the painted sheet's two rows. */
export const MONSTER_FRAMES: Record<MonsterKind, number> = { ghost: 0, bat: 1, pumpkin: 2, raccoon: 3 };

/** Props sheet cells. */
const PROP = { pumpkin: 0, grave: 1, tree: 2, leaves: 3, web: 4, hay: 5, chest: 6, bowl: 7 } as const;
/** Items sheet cells. */
const ITEM = { key: 0, heart: 1, candyA: 2, candyB: 3, candyC: 4, chestOpen: 5, lollipop: 6, gate: 7 } as const;

/** Draw a painted frame so its content fits a box centred on (x, y), keeping its shape. */
function fit(ctx: CanvasRenderingContext2D, frame: HTMLCanvasElement, x: number, y: number, w: number, h: number, flip = false): void {
  const b = frameBounds(frame);
  const k = Math.min(w / b.w, h / b.h);
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(frame, -(b.x + b.w / 2) * k, -(b.y + b.h / 2) * k, frame.width * k, frame.height * k);
  ctx.restore();
  ctx.imageSmoothingEnabled = smoothing;
}

// --- The night around the room -----------------------------------------------------------

export function drawNight(ctx: CanvasRenderingContext2D, time: number, sky: readonly [string, string]): void {
  const art = sprite('night');
  if (art) {
    const k = Math.max(SCREEN.w / art.width, SCREEN.h / art.height);
    const smoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(art, (SCREEN.w - art.width * k) / 2, (SCREEN.h - art.height * k) / 2, art.width * k, art.height * k);
    ctx.imageSmoothingEnabled = smoothing;
    ctx.fillStyle = alpha('#000000', 0.25);
    ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, SCREEN.h);
  g.addColorStop(0, sky[0]);
  g.addColorStop(1, sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  for (let i = 0; i < 40; i++) {
    const x = (i * 97.3) % SCREEN.w;
    const y = (i * 53.7) % SCREEN.h;
    ctx.fillStyle = alpha('#ffffff', 0.25 + 0.25 * Math.sin(time * 1.5 + i));
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.fillStyle = PALETTE.moon;
  ctx.beginPath();
  ctx.arc(SCREEN.w - 30, 24, 12, 0, Math.PI * 2);
  ctx.fill();
}

// --- Tiles --------------------------------------------------------------------------------

const GROUNDISH = new Set(['.', 'g', 'b', 'p', 'r', 'S', 'Z', 'k', '+', 'c']);

/**
 * Things that stand up: drawn in a second pass, row by row, so a tree's canopy
 * or a bookshelf's top can overhang the tile above it. Jonathan asked for the
 * trees to look "slightly higher quality"; most of that is drawing them bigger
 * than their tile, which only works if what's above is already drawn.
 */
const TALL = new Set(['T', 'J', 'G', '1', '2', '3', '4', '5', '6', '7', '8', 'C', 'Q', 'E', 'Y', 'U', 'A', 'V']);
/** Furniture sheet cells, by map letter (R, the rug, is drawn flat). */
const FURNITURE: Record<string, number> = { C: 0, Q: 1, E: 2, Y: 3, U: 4, A: 5, V: 6, R: 7 };

/** The room being drawn's theme: set by drawRoomTiles, read by the ground painters. */
let theme: Theme = 'yard';
/**
 * False while a room is being drawn into its cache: the things that flicker
 * (jack-o'-lantern candles, lit windows) are left out there and drawn every
 * frame on top instead, by drawRoomLights.
 */
let lights = true;

/** What's under a tile that has something on it: path if it sits in a path, else grass. */
function groundFor(grid: string[][], r: number, c: number): string {
  const t = grid[r]![c]!;
  if (t === ':' || t === ',') return t;
  const near = [grid[r]?.[c - 1], grid[r]?.[c + 1], grid[r - 1]?.[c], grid[r + 1]?.[c]];
  if (t === 'L') return ':';
  if (t === 'B' || t === 'O' || t === 'X') return near.includes(',') ? ',' : near.includes(':') ? ':' : '.';
  return near.filter((n) => n === ':').length >= 2 ? ':' : '.';
}

function drawGround(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, r: number, c: number): void {
  if (theme === 'house' && (kind === '.' || kind === ':' || kind === ',')) {
    // Indoors: warm floorboards, and a red carpet runner where the map has a path.
    ctx.fillStyle = (r + c) % 2 ? '#7a4a2a' : '#80502e';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#5e3820';
    for (let i = 1; i < 3; i++) ctx.fillRect(x, y + (i * TILE) / 3, TILE, 1);
    ctx.fillRect(x + ((r * 9) % TILE), y, 1, TILE / 3);
    if (kind === ':') {
      ctx.fillStyle = '#9a2a3a';
      ctx.fillRect(x + 2, y, TILE - 4, TILE);
      ctx.fillStyle = '#c9a23a';
      ctx.fillRect(x + 4, y, 1, TILE);
      ctx.fillRect(x + TILE - 5, y, 1, TILE);
    }
    return;
  }
  if (theme === 'patch' && kind === '.') {
    // A pumpkin patch: rows of dark soil with a few curly vines.
    ctx.fillStyle = '#4a3222';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#5c4030';
    ctx.fillRect(x, y + 6, TILE, 5);
    ctx.fillRect(x, y + 17, TILE, 5);
    if ((r * 5 + c * 3) % 4 === 0) {
      ctx.strokeStyle = '#4f7a34';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + 9, y + 12, 4, 0, Math.PI * 1.5);
      ctx.stroke();
    }
    return;
  }
  if (theme === 'graveyard' && kind === '.') {
    // Bluer, darker grass with soft drifting mist.
    ctx.fillStyle = (r + c) % 2 ? '#26443e' : '#2a4a44';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#335a52';
    const seed = (r * 31 + c * 17) % 7;
    ctx.fillRect(x + 4 + seed * 2, y + 6 + (seed % 3) * 5, 2, 3);
    ctx.fillStyle = 'rgba(200, 210, 255, 0.07)';
    ctx.beginPath();
    ctx.ellipse(x + TILE / 2, y + TILE / 2, TILE * 0.8, TILE * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (kind === ':') {
    ctx.fillStyle = PALETTE.pathEdge;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = PALETTE.path;
    const h = TILE / 2;
    for (const [ox, oy] of [[0, 0], [h, 0], [0, h], [h, h]] as const) ctx.fillRect(x + ox + 1, y + oy + 1, h - 2, h - 2);
    return;
  }
  if (kind === ',') {
    ctx.fillStyle = PALETTE.porch;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = PALETTE.porchLine;
    for (let i = 1; i < 4; i++) ctx.fillRect(x, y + (i * TILE) / 4, TILE, 1);
    return;
  }
  ctx.fillStyle = (r + c) % 2 ? PALETTE.grassA : PALETTE.grassB;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = PALETTE.grassDot;
  const seed = (r * 31 + c * 17) % 7;
  ctx.fillRect(x + 4 + seed * 2, y + 6 + (seed % 3) * 5, 2, 3);
  ctx.fillRect(x + 16 - seed, y + 17 - (seed % 4), 2, 3);
}

/**
 * One tile. `flicker` makes the jack-o'-lanterns glow unevenly. `damage`
 * 0..1 is how worn a breakable is.
 */
function drawTile(ctx: CanvasRenderingContext2D, grid: string[][], r: number, c: number, x: number, y: number, time: number): void {
  const t = grid[r]![c]!;
  if (GROUNDISH.has(t) || t === ':' || t === ',' || TALL.has(t)) {
    drawGround(ctx, groundFor(grid, r, c), x, y, r, c);
    return;
  }
  if (t === 'R') {
    drawGround(ctx, '.', x, y, r, c);
    return;
  }
  const props = spriteFrames('props.all');
  const items = spriteFrames('items.all');
  const cx = x + TILE / 2;
  const cy = y + TILE / 2;
  switch (t) {
    case '#':
    case 'W':
      if (theme === 'house') {
        // Indoors: striped wallpaper with a wooden rail.
        ctx.fillStyle = '#4a2a4a';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = '#5a3458';
        for (let i = 0; i < TILE; i += 6) ctx.fillRect(x + i, y, 3, TILE);
        ctx.fillStyle = '#6e4428';
        ctx.fillRect(x, y + TILE - 6, TILE, 6);
        ctx.fillStyle = '#8a5a34';
        ctx.fillRect(x, y + TILE - 6, TILE, 1.5);
        return;
      }
      if (t === 'W') break;
      {
      ctx.fillStyle = PALETTE.hedge;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = PALETTE.hedgeLight;
      for (const [ox, oy, rr] of [[7, 8, 7], [18, 9, 6], [12, 18, 7], [21, 20, 5]] as const) {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, rr, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
      }
  }
  switch (t) {
    case 'W': {
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = PALETTE.wallLight;
      for (let i = 0; i < 4; i++) ctx.fillRect(x, y + i * 7, TILE, 1);
      // A lit window every few tiles along the bottom row of the house.
      if (r === 1 && c % 4 === 1) {
        ctx.fillStyle = alpha(PALETTE.window, lights ? 0.85 + 0.15 * Math.sin(time * 2 + c) : 0.85);
        ctx.fillRect(x + 6, y + 6, 14, 12);
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(x + 12, y + 6, 2, 12);
      }
      return;
    }
    case 'F': {
      drawGround(ctx, '.', x, y, r, c);
      if (theme === 'house') {
        // Indoors a fence is a wooden banister.
        ctx.fillStyle = '#6e4428';
        for (let i = 0; i < 3; i++) ctx.fillRect(x + 4 + i * 8, y + 3, 3, TILE - 5);
        ctx.fillStyle = '#8a5a34';
        ctx.fillRect(x, y + 2, TILE, 4);
        ctx.fillRect(x, y + TILE - 5, TILE, 3);
        return;
      }
      ctx.fillStyle = PALETTE.fence;
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(x + 3 + i * 8, y + 4, 5, TILE - 6);
        ctx.beginPath();
        ctx.moveTo(x + 3 + i * 8, y + 4);
        ctx.lineTo(x + 5.5 + i * 8, y + 1);
        ctx.lineTo(x + 8 + i * 8, y + 4);
        ctx.fill();
      }
      ctx.fillStyle = PALETTE.fenceDark;
      ctx.fillRect(x, y + 9, TILE, 3);
      ctx.fillRect(x, y + 18, TILE, 3);
      return;
    }
    case 'L': {
      drawGround(ctx, ':', x, y, r, c);
      ctx.fillStyle = PALETTE.gate;
      ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.fillStyle = PALETTE.gateLight;
      for (let i = 0; i < 4; i++) ctx.fillRect(x + 3 + i * 6, y + 2, 2, TILE - 4);
      ctx.fillStyle = PALETTE.key;
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - 1.5, cy, 3, 6);
      return;
    }
  }
  // Everything else stands on the ground.
  drawGround(ctx, groundFor(grid, r, c), x, y, r, c);
  const cell =
    t === 'J' ? PROP.pumpkin : t === 'G' ? PROP.grave : t === 'T' ? PROP.tree : t === 'l' ? PROP.leaves : t === 'w' ? PROP.web :
    t === 'h' ? PROP.hay : t === 'X' ? PROP.chest : t === 'B' ? PROP.bowl : -1;
  if (t === 'O') {
    const open = items?.[ITEM.chestOpen];
    if (open) fit(ctx, open, cx, cy, TILE * 0.95, TILE * 0.95);
    else drawChestFallback(ctx, cx, cy, true);
    return;
  }
  const frame = cell >= 0 ? props?.[cell] : undefined;
  const big = t === 'T' ? 1.5 : t === 'B' ? 1.35 : 1;
  if (frame) {
    fit(ctx, frame, cx, cy - (big - 1) * TILE * 0.3, TILE * big, TILE * big);
  } else {
    drawPropFallback(ctx, t, cx, cy, time);
  }
  if (t === 'J') {
    // The candle inside flickers.
    ctx.fillStyle = alpha('#ffb347', 0.18 + 0.12 * Math.sin(time * 9 + c * 3) * Math.sin(time * 5.3 + r));
    ctx.beginPath();
    ctx.arc(cx, cy, TILE * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawChestFallback(ctx: CanvasRenderingContext2D, x: number, y: number, open: boolean): void {
  ctx.fillStyle = PALETTE.chest;
  ctx.fillRect(x - 10, y - 4, 20, 13);
  ctx.fillStyle = PALETTE.chestBand;
  ctx.fillRect(x - 10, y + 1, 20, 2);
  ctx.fillStyle = open ? '#2a1a12' : PALETTE.chest;
  ctx.fillRect(x - 10, y - 10, 20, 6);
}

function drawPropFallback(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, time: number): void {
  switch (t) {
    case 'J':
      ctx.fillStyle = PALETTE.pumpkin;
      ctx.beginPath();
      ctx.ellipse(x, y + 2, 11, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.stem;
      ctx.fillRect(x - 1.5, y - 10, 3, 5);
      ctx.fillStyle = alpha('#ffe066', 0.7 + 0.3 * Math.sin(time * 9));
      ctx.fillRect(x - 6, y - 1, 3, 3);
      ctx.fillRect(x + 3, y - 1, 3, 3);
      ctx.fillRect(x - 5, y + 4, 10, 2);
      break;
    case 'G':
      ctx.fillStyle = PALETTE.stoneDark;
      ctx.fillRect(x - 8, y - 4, 16, 15);
      ctx.fillStyle = PALETTE.stone;
      ctx.beginPath();
      ctx.arc(x, y - 4, 8, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x - 8, y - 4, 16, 13);
      ctx.fillStyle = PALETTE.stoneDark;
      ctx.fillRect(x - 1, y - 6, 2, 9);
      ctx.fillRect(x - 4, y - 3, 8, 2);
      break;
    case 'T':
      ctx.fillStyle = PALETTE.trunk;
      ctx.fillRect(x - 3, y - 2, 6, 14);
      ctx.fillStyle = PALETTE.treeTop;
      ctx.beginPath();
      ctx.arc(x, y - 8, 13, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'l':
      ctx.fillStyle = PALETTE.leaves;
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.leavesB;
      for (const [ox, oy] of [[-5, 1], [4, 3], [0, -2], [-1, 6]] as const) ctx.fillRect(x + ox, y + oy, 4, 3);
      break;
    case 'w':
      ctx.strokeStyle = alpha(PALETTE.web, 0.9);
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12);
        ctx.stroke();
      }
      for (const rr of [4, 8, 12]) {
        ctx.beginPath();
        ctx.arc(x, y, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case 'h':
      ctx.fillStyle = PALETTE.hay;
      ctx.fillRect(x - 11, y - 8, 22, 17);
      ctx.fillStyle = PALETTE.hayDark;
      ctx.fillRect(x - 11, y - 3, 22, 2);
      ctx.fillRect(x - 11, y + 4, 22, 2);
      break;
    case 'X':
      drawChestFallback(ctx, x, y, false);
      break;
    case 'B':
      ctx.fillStyle = '#7c3aed';
      ctx.beginPath();
      ctx.ellipse(x, y + 2, 13, 8, 0, 0, Math.PI);
      ctx.fill();
      ctx.fillRect(x - 13, y - 1, 26, 3);
      for (const [ox, col] of [[-7, PALETTE.candyPink], [0, PALETTE.gold], [7, PALETTE.candyGreen]] as const) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x + ox, y - 3, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
  }
}

/** A tall thing standing on tile (r, c): trees, landmarks, furniture, pumpkins, gravestones. */
function drawTall(ctx: CanvasRenderingContext2D, grid: string[][], r: number, c: number, x: number, y: number, time: number): void {
  const t = grid[r]![c]!;
  const cx = x + TILE / 2;
  const bottom = y + TILE;
  const shadow = (w: number): void => {
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(cx, bottom - 3, w / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  /** Fit a frame to a box whose bottom-centre sits at (bx, bottom). */
  const stand = (frame: HTMLCanvasElement, bx: number, w: number, h: number): void => fit(ctx, frame, bx, bottom - h / 2, w, h);
  if (t === 'T') {
    // Eight painted trees, picked by position so a room always looks the same.
    const trees = spriteFrames('trees.all');
    const frame = trees?.[(r * 7 + c * 13 + r * c) % trees.length];
    shadow(TILE * 1.3);
    if (frame) stand(frame, cx, TILE * 1.9, TILE * 2.3);
    else drawPropFallback(ctx, 'T', cx, y + TILE / 2, time);
    return;
  }
  if (t >= '1' && t <= '8') {
    const frame = spriteFrames('yard.all')?.[Number(t) - 1];
    shadow(TILE * 1.1);
    if (frame) stand(frame, cx, TILE * 1.5, TILE * 1.5);
    else drawLandmarkFallback(ctx, cx, y + TILE / 2);
    return;
  }
  if (t in FURNITURE) {
    const frames = spriteFrames('indoor.all');
    // Couches and fireplaces stretch across a run of the same letter.
    if ((t === 'C' || t === 'E') && grid[r]?.[c - 1] === t) return;
    let w = 1;
    if (t === 'C' || t === 'E') while (grid[r]?.[c + w] === t) w++;
    const frame = frames?.[FURNITURE[t]!];
    const bx = x + (w * TILE) / 2;
    const size: Record<string, [number, number]> = {
      C: [w * TILE, TILE * 1.1],
      Q: [TILE * 1.05, TILE * 1.6],
      E: [w * TILE, TILE * 1.5],
      Y: [TILE * 1.2, TILE * 1.1],
      U: [TILE, TILE * 1.8],
      A: [TILE * 1.15, TILE * 1.15],
      V: [TILE * 1.15, TILE * 1.15],
    };
    const [fw, fh] = size[t]!;
    if (frame) fit(ctx, frame, bx, bottom - fh / 2, fw, fh);
    else {
      ctx.fillStyle = '#6e4428';
      ctx.fillRect(bx - fw / 2 + 2, bottom - fh, fw - 4, fh - 2);
    }
    return;
  }
  // Jack-o'-lanterns and gravestones, from the props sheet.
  const props = spriteFrames('props.all');
  const frame = props?.[t === 'J' ? 0 : 1];
  if (frame) fit(ctx, frame, cx, y + TILE / 2, TILE, TILE);
  else drawPropFallback(ctx, t, cx, y + TILE / 2, time);
  if (t === 'J' && lights) drawCandle(ctx, cx, y + TILE / 2, r, c, time);
}

/** A jack-o'-lantern's candle glow, flickering. */
function drawCandle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, c: number, time: number): void {
  ctx.fillStyle = alpha('#ffb347', 0.18 + 0.12 * Math.sin(time * 9 + c * 3) * Math.sin(time * 5.3 + r));
  ctx.beginPath();
  ctx.arc(x, y, TILE * 0.75, 0, Math.PI * 2);
  ctx.fill();
}

function drawLandmarkFallback(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#8a7a6a';
  ctx.fillRect(x - 8, y - 8, 16, 18);
}

/**
 * One rug across a whole block of R tiles, drawn from its top-left tile. In its
 * own pass after the floor: drawn with the floor, the next row's boards covered
 * its bottom half.
 */
function drawRug(ctx: CanvasRenderingContext2D, grid: string[][], r: number, c: number, x: number, y: number): void {
  if (grid[r]?.[c - 1] === 'R' || grid[r - 1]?.[c] === 'R') return;
  let w = 1;
  while (grid[r]?.[c + w] === 'R') w++;
  let h = 1;
  while (grid[r + h]?.[c] === 'R') h++;
  const rug = spriteFrames('indoor.all')?.[FURNITURE.R!];
  if (rug) fit(ctx, rug, x + (w * TILE) / 2, y + (h * TILE) / 2, w * TILE * 1.05, h * TILE * 1.05);
  else {
    ctx.fillStyle = '#c96a1e';
    ctx.beginPath();
    ctx.ellipse(x + (w * TILE) / 2, y + (h * TILE) / 2, (w * TILE) / 2, (h * TILE) / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawRoomTiles(ctx: CanvasRenderingContext2D, grid: string[][], ox: number, oy: number, time: number, roomTheme: Theme = 'yard'): void {
  theme = roomTheme;
  for (let r = 0; r < ROOM_ROWS; r++) {
    for (let c = 0; c < ROOM_COLS; c++) drawTile(ctx, grid, r, c, ox + c * TILE, oy + r * TILE, time);
  }
  for (let r = 0; r < ROOM_ROWS; r++) {
    for (let c = 0; c < ROOM_COLS; c++) if (grid[r]![c] === 'R') drawRug(ctx, grid, r, c, ox + c * TILE, oy + r * TILE);
  }
  for (let r = 0; r < ROOM_ROWS; r++) {
    for (let c = 0; c < ROOM_COLS; c++) {
      if (TALL.has(grid[r]![c]!)) drawTall(ctx, grid, r, c, ox + c * TILE, oy + r * TILE, time);
    }
  }
}

// --- Rooms drawn once -------------------------------------------------------------------------

/**
 * A room, drawn once into an image at the screen's real resolution and copied
 * each frame. Jonathan: "every time she plays on my phone my phone definitely
 * gets hot". Drawing a room tile by tile (grass, paths, and a painted sprite
 * for every tree, landmark and piece of furniture) was most of every frame,
 * about 2 ms of 2.5 on a laptop and many times that on a phone, sixty-plus
 * times a second for a picture that only changes when a leaf pile pops or a
 * gate opens. Now it's redrawn only then (the grid's letters are the key), or
 * when the screen's scale changes, or when a sprite sheet finishes loading.
 */
interface RoomImage {
  canvas: HTMLCanvasElement;
  key: string;
}
const roomImages = new WeakMap<string[][], RoomImage>();
const SHEETS = ['props.all', 'items.all', 'trees.all', 'yard.all', 'indoor.all'] as const;

function drawRoom(ctx: CanvasRenderingContext2D, grid: string[][], ox: number, oy: number, time: number, roomTheme: Theme = 'yard'): void {
  const m = ctx.getTransform();
  // Device pixels per virtual pixel, whichever way the screen is turned.
  const k = Math.round(Math.hypot(m.a, m.b) * 100) / 100;
  let key = `${roomTheme}|${k}|`;
  for (const sheet of SHEETS) key += spriteFrames(sheet) ? '1' : '0';
  for (const row of grid) key += row.join('');
  let image = roomImages.get(grid);
  if (!image || image.key !== key) {
    const canvas = image?.canvas ?? document.createElement('canvas');
    canvas.width = Math.ceil(ROOM_W * k);
    canvas.height = Math.ceil(ROOM_H * k);
    const g = canvas.getContext('2d');
    if (!g) {
      drawRoomTiles(ctx, grid, ox, oy, time, roomTheme);
      return;
    }
    g.setTransform(k, 0, 0, k, 0, 0);
    g.imageSmoothingEnabled = false;
    lights = false;
    drawRoomTiles(g, grid, 0, 0, time, roomTheme);
    lights = true;
    image = { canvas, key };
    roomImages.set(grid, image);
  }
  ctx.drawImage(image.canvas, ox, oy, image.canvas.width / k, image.canvas.height / k);
  drawRoomLights(ctx, grid, ox, oy, time, roomTheme);
}

/** What flickers, on top of the room's image: candles, and lit windows outdoors. */
function drawRoomLights(ctx: CanvasRenderingContext2D, grid: string[][], ox: number, oy: number, time: number, roomTheme: Theme): void {
  for (let r = 0; r < ROOM_ROWS; r++) {
    for (let c = 0; c < ROOM_COLS; c++) {
      const t = grid[r]![c]!;
      const x = ox + c * TILE;
      const y = oy + r * TILE;
      if (t === 'J') drawCandle(ctx, x + TILE / 2, y + TILE / 2, r, c, time);
      else if (t === 'W' && roomTheme !== 'house' && r === 1 && c % 4 === 1) {
        ctx.fillStyle = alpha(PALETTE.window, 0.15 * (0.5 + 0.5 * Math.sin(time * 2 + c)));
        ctx.fillRect(x + 6, y + 6, 6, 12);
        ctx.fillRect(x + 14, y + 6, 6, 12);
      }
    }
  }
}

// --- The cast ---------------------------------------------------------------------------------

function drawMonster(ctx: CanvasRenderingContext2D, m: Monster, time: number): void {
  const spec = MONSTERS[m.kind];
  const frames = spriteFrames('monsters.normal');
  const tease = m.tease > 0 ? spriteFrames('monsters.happy') : null;
  const frame = (tease ?? frames)?.[MONSTER_FRAMES[m.kind]];
  const bob = m.kind === 'ghost' ? Math.sin(time * 3 + m.seed) * 2 : m.kind === 'bat' ? Math.sin(time * 14 + m.seed) * 1.5 : 0;
  const size = spec.r * 2.6;
  ctx.save();
  // A soft shadow on the ground, so flying things read as flying.
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(m.x, m.y + spec.r * 0.9, spec.r * 0.8, spec.r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  const flip = m.dx < 0 || (m.dx === 0 && Math.sin(m.seed) < 0);
  if (frame) fit(ctx, frame, m.x, m.y + bob - (m.kind === 'bat' || m.kind === 'ghost' ? 4 : 0), size, size, flip);
  else drawMonsterFallback(ctx, m.kind, m.x, m.y + bob, spec.r);
  if (m.flash > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = alpha('#ffffff', 0.5);
    ctx.beginPath();
    ctx.arc(m.x, m.y + bob, spec.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMonsterFallback(ctx: CanvasRenderingContext2D, kind: MonsterKind, x: number, y: number, r: number): void {
  if (kind === 'ghost') {
    ctx.fillStyle = '#f4f0ff';
    ctx.beginPath();
    ctx.arc(x, y - 2, r, Math.PI, 0);
    ctx.lineTo(x + r, y + r);
    ctx.lineTo(x - r, y + r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1a0f2e';
    ctx.fillRect(x - 4, y - 4, 2.5, 3.5);
    ctx.fillRect(x + 2, y - 4, 2.5, 3.5);
  } else if (kind === 'bat') {
    ctx.fillStyle = '#2a1a3a';
    ctx.beginPath();
    ctx.moveTo(x - r * 1.4, y - 2);
    ctx.lineTo(x, y - r * 0.4);
    ctx.lineTo(x + r * 1.4, y - 2);
    ctx.lineTo(x, y + r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(x - 3, y - 2, 2, 2);
    ctx.fillRect(x + 1, y - 2, 2, 2);
  } else if (kind === 'pumpkin') {
    drawPropFallback(ctx, 'J', x, y, 0);
  } else {
    ctx.fillStyle = '#8d8f99';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2b33';
    ctx.fillRect(x - r * 0.8, y - 3, r * 1.6, 4);
    ctx.fillStyle = '#ff8c1a';
    ctx.fillRect(x - r, y + r * 0.4, r * 2, 3);
  }
}

function drawBoss(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  const b = state.boss;
  if (!b.kind || b.phase === 'none' || b.phase === 'gone') return;
  const spec = BOSSES[b.kind];
  const art = sprite(`boss.${b.kind}`);
  ctx.save();
  ctx.globalAlpha = b.alpha;
  let y = b.y;
  let spin = 0;
  if (b.phase === 'dying') {
    // Happy at last: it spins, rises and fades.
    const k = b.t / 1.8;
    y -= k * 40;
    spin = k * Math.PI * 4;
    ctx.globalAlpha = 1 - k * 0.8;
  }
  if (b.kind === 'pumpkin-king' && b.hop > 0) y -= Math.sin((b.hop / 0.5) * Math.PI) * 10;
  if (b.swoop === 'wind') ctx.translate(Math.sin(time * 60) * 2, 0);
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(b.x, b.y + spec.r, spec.r, spec.r * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(b.x, y);
  ctx.rotate(spin);
  const flip = state.player.x < b.x;
  if (art) fit(ctx, art, 0, -spec.size * 0.15, spec.size, spec.size, flip);
  else {
    ctx.fillStyle = b.kind === 'pumpkin-king' ? PALETTE.pumpkin : b.kind === 'big-boo' ? '#f4f0ff' : '#5a2a6a';
    ctx.beginPath();
    ctx.arc(0, 0, spec.r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (b.flash > 0 || b.swoop === 'wind') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = alpha(b.swoop === 'wind' ? '#ff3b3b' : '#ffffff', 0.45);
    ctx.beginPath();
    ctx.arc(0, 0, spec.r * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const CAT_POSE = { sit: 0, meow: 1, purr: 2, startled: 3 } as const;

/**
 * Hocus or Pocus. `time` animates the trot. A name tag floats over each for
 * the first moments of a street, so the kids know who's who.
 */
export function drawCat(ctx: CanvasRenderingContext2D, cat: Pick<Cat, 'name' | 'pose' | 'fx' | 'moving'>, x: number, y: number, time: number, h = CATS.h, glow = false): void {
  const id = cat.name.toLowerCase();
  const walk = spriteFrames(`${id}.walk`);
  const poses = spriteFrames(`${id}.poses`);
  const frame = cat.pose === 'walk' && cat.moving ? walk?.[Math.floor(time * 10) % (walk?.length ?? 1)] : poses?.[CAT_POSE[cat.pose === 'walk' ? 'sit' : cat.pose]];
  if (glow) {
    // On the dark menu screens a black cat disappears: a soft moonlit glow behind it.
    const g = ctx.createRadialGradient(x, y - h * 0.2, h * 0.1, x, y - h * 0.2, h * 0.9);
    g.addColorStop(0, alpha(cat.name === 'Hocus' ? PALETTE.hocus : PALETTE.pocus, 0.45));
    g.addColorStop(1, alpha(cat.name === 'Hocus' ? PALETTE.hocus : PALETTE.pocus, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y - h * 0.2, h * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.28, h * 0.45, h * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();
  const hop = cat.pose === 'startled' ? -4 : cat.pose === 'meow' ? -1.5 : 0;
  if (frame) {
    fit(ctx, frame, x, y - h * 0.2 + hop, h * 1.3, h, cat.fx < 0);
    return;
  }
  // Drawn fallback: a little black cat with a coloured collar.
  ctx.fillStyle = '#1c1626';
  ctx.beginPath();
  ctx.ellipse(x, y - 2 + hop, 8, 6, 0, 0, Math.PI * 2);
  ctx.arc(x + cat.fx * 7, y - 8 + hop, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cat.name === 'Hocus' ? PALETTE.hocus : PALETTE.pocus;
  ctx.fillRect(x + cat.fx * 7 - 3, y - 4 + hop, 6, 1.5);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(x + cat.fx * 9 - 1, y - 10 + hop, 1.5, 1.5);
}

/** The trick-or-treater: walking, facing, cheering, or spooked, from her sheet. */
function drawKid(ctx: CanvasRenderingContext2D, state: GameState, ch: Character, x: number, y: number, time: number): void {
  const p = state.player;
  if (p.safe > 0 && Math.floor(time * 12) % 2 === 0 && state.phase === 'play') return;
  const walk = spriteFrames(`${ch.id}.walk`);
  const poses = spriteFrames(`${ch.id}.poses`);
  let frame: HTMLCanvasElement | undefined;
  let flip = p.fx < 0;
  // Walking always wins over a cheer: a kid who's moving should look like she's walking.
  if (p.mood === 'cheer' && (!p.moving || state.phase === 'bowl')) frame = poses?.[1];
  else if (p.mood === 'spooked') frame = poses?.[2];
  else if (p.moving && p.fy < -0.7) {
    frame = poses?.[3];
    flip = Math.floor(time * 6) % 2 === 0;
  } else if (p.moving) frame = walk?.[Math.floor(time * 8) % (walk?.length ?? 1)];
  else frame = poses?.[0];
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(x, y + PLAYER.r, PLAYER.r * 1.2, PLAYER.r * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  const bob = p.moving ? Math.abs(Math.sin(time * 10)) * -1.5 : 0;
  if (frame) fit(ctx, frame, x, y - PLAYER.h * 0.32 + bob, PLAYER.h, PLAYER.h, flip);
  else drawKidFallback(ctx, ch, x, y + bob);
}

export function drawKidFallback(ctx: CanvasRenderingContext2D, ch: Character, x: number, y: number, scale = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = ch.outfit;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(-9, 8);
  ctx.lineTo(9, 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = ch.hair;
  ctx.beginPath();
  ctx.arc(0, -16, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ch.skin;
  ctx.beginPath();
  ctx.arc(0, -15, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ch.shotGlow;
  ctx.beginPath();
  ctx.arc(0, -24, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShot(ctx: CanvasRenderingContext2D, ch: Character, x: number, y: number, vx: number, vy: number, time: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = alpha(ch.shotGlow, 0.35);
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(x, y);
  if (ch.shot === 'star') {
    ctx.rotate(time * 10);
    drawStar(ctx, 0, 0, 6, ch.shotColor);
  } else if (ch.shot === 'sparkle') {
    ctx.rotate(time * 6);
    ctx.fillStyle = ch.shotColor;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(1.6, 2);
      ctx.lineTo(0, 7);
      ctx.lineTo(-1.6, 2);
      ctx.fill();
    }
  } else {
    ctx.rotate(Math.atan2(vy, vx));
    ctx.fillStyle = ch.shotColor;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-1, -4);
    ctx.lineTo(1, -1);
    ctx.lineTo(-7, 0);
    ctx.lineTo(1, 4);
    ctx.lineTo(-1, 1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawPickup(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, t: number, look: number): void {
  const items = spriteFrames('items.all');
  const bob = Math.sin(t * 5 + look) * 1.5;
  const cell = kind === 'key' ? ITEM.key : kind === 'heart' ? ITEM.heart : [ITEM.candyA, ITEM.candyB, ITEM.candyC, ITEM.lollipop][look % 4]!;
  const frame = items?.[cell];
  const size = kind === 'candy' ? 13 : 17;
  if (kind !== 'candy') {
    ctx.fillStyle = alpha(kind === 'key' ? PALETTE.key : PALETTE.heart, 0.25 + 0.1 * Math.sin(t * 6));
    ctx.beginPath();
    ctx.arc(x, y + bob, 12, 0, Math.PI * 2);
    ctx.fill();
  }
  if (frame) {
    fit(ctx, frame, x, y + bob, size, size);
    return;
  }
  if (kind === 'heart') {
    ctx.fillStyle = PALETTE.heart;
    ctx.beginPath();
    ctx.arc(x - 3, y - 2 + bob, 4, 0, Math.PI * 2);
    ctx.arc(x + 3, y - 2 + bob, 4, 0, Math.PI * 2);
    ctx.moveTo(x - 7, y + bob);
    ctx.lineTo(x, y + 7 + bob);
    ctx.lineTo(x + 7, y + bob);
    ctx.fill();
  } else if (kind === 'key') {
    ctx.fillStyle = PALETTE.key;
    ctx.beginPath();
    ctx.arc(x - 4, y + bob, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 1, y - 1 + bob, 9, 2.5);
    ctx.fillRect(x + 5, y + bob, 2, 4);
  } else {
    const col = [PALETTE.candyPink, PALETTE.candyGreen, PALETTE.candyBlue, PALETTE.gold][look % 4]!;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, y + bob, 4.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 4, y + bob);
    ctx.lineTo(x - 8, y - 3 + bob);
    ctx.lineTo(x - 8, y + 3 + bob);
    ctx.moveTo(x + 4, y + bob);
    ctx.lineTo(x + 8, y - 3 + bob);
    ctx.lineTo(x + 8, y + 3 + bob);
    ctx.fill();
  }
}

// --- Goals: the thought bubble and the street's card ------------------------------------------

export type GoalIcon = Thought | 'ghost';

/** A picture of something she's after (the candy bowl, a key, a gate) or a ghost, `size` px across. */
export function drawGoalIcon(ctx: CanvasRenderingContext2D, what: GoalIcon, x: number, y: number, size: number, time: number): void {
  if (what === 'bowl') {
    const frame = spriteFrames('props.all')?.[PROP.bowl];
    if (frame) fit(ctx, frame, x, y, size, size);
    else {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size / 28, size / 28);
      drawPropFallback(ctx, 'B', 0, 0, time);
      ctx.restore();
    }
  } else if (what === 'key') {
    const frame = spriteFrames('items.all')?.[ITEM.key];
    if (frame) fit(ctx, frame, x, y, size, size);
    else {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size / 17, size / 17);
      drawPickup(ctx, 'key', 0, 0, 0, 0);
      ctx.restore();
    }
  } else if (what === 'gate') {
    // The gate tile, drawn by code like the map's.
    const k = size / TILE;
    ctx.save();
    ctx.translate(x - size / 2, y - size / 2);
    ctx.scale(k, k);
    ctx.fillStyle = PALETTE.gate;
    ctx.fillRect(1, 1, TILE - 2, TILE - 2);
    ctx.fillStyle = PALETTE.gateLight;
    for (let i = 0; i < 4; i++) ctx.fillRect(3 + i * 6, 2, 2, TILE - 4);
    ctx.fillStyle = PALETTE.key;
    ctx.beginPath();
    ctx.arc(TILE / 2, TILE / 2 - 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(TILE / 2 - 1.5, TILE / 2, 3, 6);
    ctx.restore();
  } else {
    const frame = spriteFrames('monsters.normal')?.[MONSTER_FRAMES.ghost];
    if (frame) fit(ctx, frame, x, y, size, size);
    else drawMonsterFallback(ctx, 'ghost', x, y, size / 2.6);
  }
}

/**
 * A thought bubble over her head with what she's after in it: the candy bowl
 * as a street starts, a key at a locked gate, whatever's next when she's
 * lingered. Ellie walked up to a tree and said "I found it!"; now she can see
 * what "it" looks like.
 */
function drawThought(ctx: CanvasRenderingContext2D, what: Thought, x: number, y: number, left: number, time: number): void {
  const a = Math.min(1, left / 0.4);
  const R = 16;
  const bx = Math.min(ROOM_W - R - 2, Math.max(R + 2, x + 16));
  const by = Math.max(R + 2, y - PLAYER.h - 14) + Math.sin(time * 3) * 1.5;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = alpha('#ffffff', 0.94);
  ctx.strokeStyle = alpha('#2a1840', 0.5);
  ctx.lineWidth = 1.5;
  // The little trail of puffs from her head up to the bubble.
  for (const [t, r] of [[0.25, 2.2], [0.55, 3.4]] as const) {
    ctx.beginPath();
    ctx.arc(x + (bx - x) * t, y - PLAYER.h * 0.7 + (by + R - (y - PLAYER.h * 0.7)) * t, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // A cloud: a fat circle with bumps.
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const t = (i / 7) * Math.PI * 2;
    ctx.moveTo(bx + Math.cos(t) * R * 0.8 + 7, by + Math.sin(t) * R * 0.62);
    ctx.arc(bx + Math.cos(t) * R * 0.8, by + Math.sin(t) * R * 0.62, 7, 0, Math.PI * 2);
  }
  ctx.moveTo(bx + R, by);
  ctx.arc(bx, by, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fill();
  drawGoalIcon(ctx, what, bx, by, 22, time);
  ctx.restore();
}

// --- A frame of play ----------------------------------------------------------------------------

export function drawPlay(ctx: CanvasRenderingContext2D, state: GameState, particles: Particles, alphaT: number, time: number): void {
  drawNight(ctx, time, state.street.sky);
  const o = roomOrigin();
  ctx.save();
  if (camera.shake > 0) ctx.translate((Math.random() - 0.5) * camera.shake * 6, (Math.random() - 0.5) * camera.shake * 6);
  // Clip to the room, so the slide between rooms doesn't spill over the HUD.
  ctx.beginPath();
  ctx.rect(o.x, o.y, ROOM_W, ROOM_H);
  ctx.clip();

  let ox = o.x;
  let oy = o.y;
  if (state.phase === 'slide') {
    const k = Math.min(1, state.slideFrom.t / ROOM_SLIDE);
    const e = k * k * (3 - 2 * k);
    const [dx, dy] = DIRS[state.slideFrom.dir];
    // The old room slides out one way while the new one slides in behind it.
    const from = state.roomState(state.slideFrom.rx, state.slideFrom.ry);
    drawRoom(ctx, from.grid, o.x - dx * ROOM_W * e, o.y - dy * ROOM_H * e, time, roomAt(state.street, state.slideFrom.rx, state.slideFrom.ry)?.theme);
    ox = o.x + dx * ROOM_W * (1 - e);
    oy = o.y + dy * ROOM_H * (1 - e);
  }
  drawRoom(ctx, state.grid, ox, oy, time, state.room.theme);

  ctx.translate(ox, oy);
  // The boss room's doors are barred while the boss is up.
  if (state.shut) {
    ctx.fillStyle = alpha('#1a0f2e', 0.85);
    const grid = state.grid;
    for (let r = 0; r < ROOM_ROWS; r++) {
      for (let c = 0; c < ROOM_COLS; c++) {
        const edge = r === 0 || c === 0 || r === ROOM_ROWS - 1 || c === ROOM_COLS - 1;
        if (edge && grid[r]![c] === ':') {
          ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
          ctx.fillStyle = PALETTE.gateLight;
          for (let i = 0; i < 4; i++) ctx.fillRect(c * TILE + 3 + i * 6, r * TILE + 2, 2, TILE - 4);
          ctx.fillStyle = alpha('#1a0f2e', 0.85);
        }
      }
    }
  }
  state.pickups.forEach((k, i) => {
    if (k.alive) drawPickup(ctx, k.kind, k.x, k.y, k.t, i);
  });
  for (const m of state.monsters) if (m.alive) drawMonster(ctx, m, time);
  drawBoss(ctx, state, time);
  // Hocus and Pocus, trotting along (drawn behind her when they're above her on screen).
  const ch = characterById(state.character);
  const p = state.player;
  const px = p.prevX + (p.x - p.prevX) * alphaT;
  const py = p.prevY + (p.y - p.prevY) * alphaT;
  const showCats = state.phase !== 'slide';
  const catAt = (c: Cat): [number, number] => [c.prevX + (c.x - c.prevX) * alphaT, c.prevY + (c.y - c.prevY) * alphaT];
  if (showCats) for (const c of state.cats) if (c.y <= p.y) drawCat(ctx, c, ...catAt(c), time);
  if (state.phase !== 'lost' || state.phaseTime < 0.3) drawKid(ctx, state, ch, px, py, time);
  if (showCats) for (const c of state.cats) if (c.y > p.y) drawCat(ctx, c, ...catAt(c), time);
  if (state.thoughtTime > 0 && state.phase === 'play') drawThought(ctx, state.thought, px, py, state.thoughtTime, time);
  // Their names, for the first few seconds of a street.
  if (showCats && state.time < 4) {
    for (const [i, c] of state.cats.entries()) {
      const [cx, cy] = catAt(c);
      const fade = Math.min(1, (4 - state.time) / 0.6);
      ctx.globalAlpha = fade;
      // Staggered, so the two names don't overlap while the cats walk close together.
      drawText(ctx, c.name, cx, cy - CATS.h - 4 - i * 10, { size: 8, color: c.name === 'Hocus' ? PALETTE.hocus : PALETTE.pocus, align: 'center' });
      ctx.globalAlpha = 1;
    }
  }
  for (const s of state.shots) if (s.alive) drawShot(ctx, ch, s.x, s.y, s.vx, s.vy, time);
  for (const orb of state.orbs) {
    if (!orb.alive) continue;
    ctx.fillStyle = alpha(orb.kind === 'seed' ? PALETTE.seed : PALETTE.orb, 0.3);
    ctx.beginPath();
    ctx.arc(orb.x, orb.y, ORB.drawR * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = orb.kind === 'seed' ? PALETTE.seed : PALETTE.orb;
    ctx.beginPath();
    if (orb.kind === 'seed') ctx.ellipse(orb.x, orb.y, ORB.drawR * 0.7, ORB.drawR, Math.atan2(orb.vy, orb.vx) + Math.PI / 2, 0, Math.PI * 2);
    else ctx.arc(orb.x, orb.y, ORB.drawR, 0, Math.PI * 2);
    ctx.fill();
  }
  particles.draw(ctx);
  ctx.restore();

  if (camera.flash > 0) {
    ctx.fillStyle = alpha('#ffffff', camera.flash * 0.5);
    ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  }
}

/** The joystick ring under her finger while she drags. */
export function drawStick(ctx: CanvasRenderingContext2D, baseX: number, baseY: number, dx: number, dy: number): void {
  ctx.strokeStyle = alpha('#ffffff', 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(baseX, baseY, STICK.drawR, 0, Math.PI * 2);
  ctx.stroke();
  const d = Math.hypot(dx, dy);
  const k = d > STICK.drawR ? STICK.drawR / d : 1;
  ctx.fillStyle = alpha('#ffffff', 0.45);
  ctx.beginPath();
  ctx.arc(baseX + dx * k, baseY + dy * k, 10, 0, Math.PI * 2);
  ctx.fill();
}

/** Hearts, keys, candy and the street's name across the top. */
export function drawHud(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  const p = state.player;
  const o = roomOrigin();
  const y = o.y / 2;
  for (let i = 0; i < p.maxHearts; i++) {
    const on = i < p.hearts;
    const x = o.x + 10 + i * 17;
    const pulse = on && p.hearts === 1 ? 1 + 0.15 * Math.sin(time * 10) : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = on ? PALETTE.heart : alpha('#ffffff', 0.18);
    ctx.beginPath();
    ctx.arc(-3, -2, 4, 0, Math.PI * 2);
    ctx.arc(3, -2, 4, 0, Math.PI * 2);
    ctx.moveTo(-7, 0);
    ctx.lineTo(0, 7);
    ctx.lineTo(7, 0);
    ctx.fill();
    ctx.restore();
  }
  // Keys she's carrying.
  for (let i = 0; i < p.keys; i++) drawPickup(ctx, 'key', o.x + 10 + p.maxHearts * 17 + 14 + i * 16, y, 0, 0);
  const b = state.boss;
  if (b.kind && (b.phase === 'intro' || b.phase === 'fight' || b.phase === 'dying')) {
    // The boss's name and a health bar, in place of the street's name.
    const w = 110;
    const x = SCREEN.w / 2 - w / 2;
    ctx.fillStyle = alpha('#000000', 0.5);
    ctx.fillRect(x - 1, y + 2, w + 2, 7);
    ctx.fillStyle = PALETTE.pumpkin;
    ctx.fillRect(x, y + 3, w * Math.max(0, b.hp / b.maxHp), 5);
    drawText(ctx, BOSSES[b.kind].name, SCREEN.w / 2, y - 6, { size: 9, color: PALETTE.hudText, align: 'center' });
  } else {
    drawText(ctx, state.street.name, SCREEN.w / 2, y, { size: 10, color: PALETTE.hudText, align: 'center' });
  }
  // Candy, with a little wrapped sweet.
  drawPickup(ctx, 'candy', o.x + ROOM_W - 78, y, 0, 0);
  drawText(ctx, String(p.candy), o.x + ROOM_W - 66, y, { size: 11, color: PALETTE.gold, align: 'left' });
}

/** Drawn on the title and pick screens: a kid big, from her sheet (or the fallback). */
export function drawKidPortrait(ctx: CanvasRenderingContext2D, ch: Character, x: number, y: number, h: number, pose = 0): void {
  const poses = spriteFrames(`${ch.id}.poses`);
  const frame = poses?.[pose];
  if (frame) fit(ctx, frame, x, y, h * 0.8, h);
  else drawKidFallback(ctx, ch, x, y + h * 0.2, h / 30);
}

export { drawSprite, fit };
