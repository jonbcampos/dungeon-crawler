/**
 * Title, pick-your-trick-or-treater, street select, the street's goal card, pause, "Boo! Try again",
 * and the candy-bowl celebration.
 *
 * Buttons are big, and each says what it does with a word and a picture,
 * because the players can't all read yet. Each screen's buttons come from one
 * function of state, so drawing and tapping can never disagree.
 */

import type { Save } from '../core/save';
import { SCREEN } from '../game/config';
import { CHARACTERS, characterById, type CharacterId } from '../game/content';
import type { GameState } from '../game/state';
import { STREETS, isStreetUnlocked } from '../game/streets';
import { PALETTE, alpha } from '../render/palette';
import { drawCat, drawGoalIcon, drawNight, drawKidPortrait, type GoalIcon } from '../render/scene';
import { sprite } from '../render/sprites';
import { drawText } from './text';

export interface Button {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  locked?: boolean;
  small?: boolean;
  primary?: boolean;
}

export function hitTest(buttons: readonly Button[], x: number, y: number): Button | null {
  for (const b of buttons) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  return null;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawButton(ctx: CanvasRenderingContext2D, b: Button, time = 0): void {
  const pulse = b.primary ? Math.sin(time * 4) * 1.5 : 0;
  const x = b.x - pulse;
  const y = b.y - pulse;
  const w = b.w + pulse * 2;
  const h = b.h + pulse * 2;
  ctx.fillStyle = alpha('#000000', 0.35);
  roundRect(ctx, x + 2, y + 3, w, h, 9);
  ctx.fill();
  ctx.fillStyle = b.locked ? PALETTE.locked : b.primary ? PALETTE.button : PALETTE.panel;
  roundRect(ctx, x, y, w, h, 9);
  ctx.fill();
  ctx.strokeStyle = b.locked ? alpha('#ffffff', 0.2) : alpha(PALETTE.panelEdge, 0.85);
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 9);
  ctx.stroke();
  drawText(ctx, b.label, x + w / 2, y + h / 2 + (b.sub ? -6 : 0), {
    size: b.small ? 9 : 13,
    color: b.locked ? '#9a90b8' : '#ffffff',
    align: 'center',
  });
  if (b.sub) drawText(ctx, b.sub, x + w / 2, y + h / 2 + 9, { size: 8, color: alpha('#ffffff', 0.8), align: 'center' });
}

function backdrop(ctx: CanvasRenderingContext2D, time: number, dim: number): void {
  const art = sprite('title');
  if (art) {
    const k = Math.max(SCREEN.w / art.width, SCREEN.h / art.height);
    const smoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(art, (SCREEN.w - art.width * k) / 2, (SCREEN.h - art.height * k) / 2, art.width * k, art.height * k);
    ctx.imageSmoothingEnabled = smoothing;
  } else {
    drawNight(ctx, time, [PALETTE.skyTop, PALETTE.skyBottom]);
  }
  if (dim > 0) {
    ctx.fillStyle = alpha('#000000', dim);
    ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  }
}

function muteButton(muted: boolean): Button {
  return { id: 'mute', x: SCREEN.w - 46, y: 8, w: 38, h: 26, label: muted ? 'off' : 'on', small: true };
}

// --- Title -------------------------------------------------------------------------------

export function titleButtons(muted: boolean): Button[] {
  return [
    { id: 'play', x: SCREEN.w / 2 - 70, y: SCREEN.h - 64, w: 140, h: 44, label: "Let's go!", primary: true },
    muteButton(muted),
  ];
}

export function drawTitle(ctx: CanvasRenderingContext2D, muted: boolean, time: number): void {
  backdrop(ctx, time, 0.1);
  const bounce = Math.sin(time * 3) * 3;
  drawText(ctx, 'Trick or Treat!', SCREEN.w / 2 + 2, 42 + bounce + 2, { size: 30, color: PALETTE.hudShadow, align: 'center' });
  drawText(ctx, 'Trick or Treat!', SCREEN.w / 2, 42 + bounce, { size: 30, color: PALETTE.pumpkin, align: 'center' });
  // The three of them, side by side, waiting to go.
  const n = CHARACTERS.length;
  CHARACTERS.forEach((ch, i) => {
    const x = SCREEN.w / 2 + (i - (n - 1) / 2) * 90;
    drawKidPortrait(ctx, ch, x, SCREEN.h / 2 + 18 + Math.sin(time * 2 + i) * 2, 92, i === 0 ? 1 : 0);
  });
  // Hocus and Pocus, sitting with them.
  const floor = SCREEN.h / 2 + 52;
  drawCat(ctx, { name: 'Hocus', pose: Math.floor(time / 3) % 3 === 2 ? 'meow' : 'sit', fx: 1, moving: false }, SCREEN.w / 2 - 158, floor, time, 34, true);
  drawCat(ctx, { name: 'Pocus', pose: Math.floor(time / 3 + 1) % 3 === 2 ? 'meow' : 'sit', fx: -1, moving: false }, SCREEN.w / 2 + 158, floor, time, 34, true);
  for (const b of titleButtons(muted)) drawButton(ctx, b, time);
}

// --- Pick a trick-or-treater ------------------------------------------------------------------

export function pickButtons(): Button[] {
  const w = 120;
  const gap = 14;
  const n = CHARACTERS.length;
  const x0 = (SCREEN.w - (w * n + gap * (n - 1))) / 2;
  const buttons: Button[] = CHARACTERS.map((ch, i) => ({
    id: `kid:${ch.id}`,
    x: x0 + i * (w + gap),
    y: 46,
    w,
    h: 190,
    label: ch.name,
    sub: ch.costume,
  }));
  buttons.push({ id: 'back', x: 10, y: 8, w: 64, h: 26, label: 'Back', small: true });
  return buttons;
}

export function drawPick(ctx: CanvasRenderingContext2D, chosen: CharacterId, time: number): void {
  backdrop(ctx, time, 0.45);
  drawText(ctx, 'Who are you?', SCREEN.w / 2, 24, { size: 18, color: PALETTE.gold, align: 'center' });
  drawText(ctx, 'with Hocus & Pocus', SCREEN.w / 2, 254, { size: 9, color: '#ffffff', align: 'center' });
  drawCat(ctx, { name: 'Hocus', pose: 'sit', fx: 1, moving: false }, SCREEN.w / 2 - 82, 256, time, 28, true);
  drawCat(ctx, { name: 'Pocus', pose: 'sit', fx: -1, moving: false }, SCREEN.w / 2 + 82, 256, time, 28, true);
  for (const b of pickButtons()) {
    if (b.id === 'back') {
      drawButton(ctx, b);
      continue;
    }
    const ch = characterById(b.id.slice(4) as CharacterId);
    const on = ch.id === chosen;
    ctx.fillStyle = alpha(on ? PALETTE.button : PALETTE.panel, on ? 0.9 : 0.75);
    roundRect(ctx, b.x, b.y, b.w, b.h, 12);
    ctx.fill();
    ctx.strokeStyle = on ? PALETTE.gold : alpha(PALETTE.panelEdge, 0.8);
    ctx.lineWidth = on ? 3 : 1.5;
    roundRect(ctx, b.x, b.y, b.w, b.h, 12);
    ctx.stroke();
    drawKidPortrait(ctx, ch, b.x + b.w / 2, b.y + 78 + (on ? Math.sin(time * 6) * 2 : 0), 120, on ? 1 : 0);
    drawText(ctx, ch.name, b.x + b.w / 2, b.y + b.h - 32, { size: 15, color: '#ffffff', align: 'center' });
    drawText(ctx, ch.costume, b.x + b.w / 2, b.y + b.h - 15, { size: 8, color: alpha('#ffffff', 0.8), align: 'center' });
  }
}

// --- Streets --------------------------------------------------------------------------------

export function streetButtons(save: Save): Button[] {
  const n = STREETS.length;
  const gap = n > 3 ? 8 : 14;
  const w = Math.min(128, Math.floor((SCREEN.w - 20 - gap * (n - 1)) / n));
  const x0 = (SCREEN.w - (w * n + gap * (n - 1))) / 2;
  const buttons: Button[] = STREETS.map((s, i) => ({
    id: `street:${s.id}`,
    x: x0 + i * (w + gap),
    y: 84,
    w,
    h: 104,
    label: s.name,
    sub: save.candy[s.id] ? `${save.candy[s.id]} candy` : isStreetUnlocked(save.candy, s.id) ? 'Go!' : 'locked',
    locked: !isStreetUnlocked(save.candy, s.id),
  }));
  buttons.push({ id: 'back', x: 10, y: 8, w: 64, h: 26, label: 'Back', small: true });
  return buttons;
}

export function drawStreets(ctx: CanvasRenderingContext2D, save: Save, time: number): void {
  backdrop(ctx, time, 0.45);
  drawText(ctx, 'Pick a street!', SCREEN.w / 2, 42, { size: 18, color: PALETTE.gold, align: 'center' });
  for (const b of streetButtons(save)) {
    drawButton(ctx, b, time);
    if (b.id.startsWith('street:')) {
      const id = Number(b.id.slice(7));
      // A star on the streets she's finished, the street's number on the ones still to do.
      if (b.locked) continue;
      drawText(ctx, save.candy[id] ? '★' : String(id + 1), b.x + b.w / 2, b.y + 22, {
        size: 16,
        color: save.candy[id] ? PALETTE.gold : '#ffffff',
        align: 'center',
      });
    }
  }
}

// --- The goal card, before every street -------------------------------------------------------

/** How many keys a street needs: chests with keys in them, and keys lying about. */
function keysOn(state: GameState): number {
  return state.street.rooms.reduce((n, r) => n + (r.chest === 'key' ? 1 : 0) + (r.tiles.join('').match(/k/g) ?? []).length, 0);
}

/**
 * "Find the candy bowl!", with the whole street in four pictures: boo the
 * monsters, find the key, open the gate, the candy bowl. They pop up one after
 * another, left to right, so the order reads even to a kid who can't read. Ellie's
 * first play started with "what do I do?"; this is the answer, every street.
 */
export function drawIntro(ctx: CanvasRenderingContext2D, state: GameState, time: number): void {
  const t = state.phaseTime;
  ctx.fillStyle = alpha('#000000', 0.6 * Math.min(1, t / 0.3));
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  const cx = SCREEN.w / 2;
  drawText(ctx, state.street.name, cx, 40, { size: 11, color: PALETTE.hudText, align: 'center' });
  const bounce = Math.sin(time * 4) * 2;
  drawText(ctx, 'Find the candy bowl!', cx + 2, 70 + bounce + 2, { size: 22, color: PALETTE.hudShadow, align: 'center' });
  drawText(ctx, 'Find the candy bowl!', cx, 70 + bounce, { size: 22, color: PALETTE.pumpkin, align: 'center' });
  const keys = keysOn(state);
  const steps: [GoalIcon, string][] = [
    ['ghost', 'Boo!'],
    ['key', keys > 1 ? `Find ${keys} keys` : 'Find the key'],
    ['gate', keys > 1 ? 'Open the gates' : 'Open the gate'],
    ['bowl', 'Candy!'],
  ];
  const span = 100;
  const y = 136;
  steps.forEach(([icon, label], i) => {
    const show = Math.min(1, Math.max(0, (t - 0.3 - i * 0.4) / 0.25));
    if (show <= 0) return;
    const x = cx + (i - 1.5) * span;
    const last = i === steps.length - 1;
    ctx.save();
    ctx.globalAlpha = show;
    // A soft glow behind each picture, golden behind the bowl.
    ctx.fillStyle = alpha(last ? PALETTE.gold : '#ffffff', last ? 0.3 + 0.1 * Math.sin(time * 5) : 0.12);
    ctx.beginPath();
    ctx.arc(x, y, last ? 34 : 26, 0, Math.PI * 2);
    ctx.fill();
    const pop = 0.6 + 0.4 * show + (last ? Math.sin(time * 4) * 0.05 : 0);
    drawGoalIcon(ctx, icon, x, y, (last ? 52 : 36) * pop, time);
    drawText(ctx, label, x, y + 44, { size: last ? 12 : 10, color: last ? PALETTE.gold : '#ffffff', align: 'center' });
    // An arrow on to the next.
    if (!last) drawText(ctx, '→', x + span / 2, y, { size: 16, color: alpha('#ffffff', 0.7), align: 'center' });
    ctx.restore();
  });
  // Hocus and Pocus are coming too.
  drawCat(ctx, { name: 'Hocus', pose: 'sit', fx: 1, moving: false }, 40, SCREEN.h - 16, time, 28, true);
  drawCat(ctx, { name: 'Pocus', pose: Math.floor(time / 2) % 2 ? 'meow' : 'sit', fx: -1, moving: false }, SCREEN.w - 40, SCREEN.h - 16, time, 28, true);
  if (t > 0.8) {
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(time * 5);
    drawText(ctx, 'Tap to go!', cx, SCREEN.h - 30, { size: 14, color: '#ffffff', align: 'center' });
    ctx.globalAlpha = 1;
  }
}

// --- Pause -------------------------------------------------------------------------------------

export function pauseButtons(muted: boolean): Button[] {
  const w = 150;
  const x = (SCREEN.w - w) / 2;
  return [
    { id: 'resume', x, y: 70, w, h: 40, label: 'Keep going', primary: true },
    { id: 'streets', x, y: 120, w, h: 36, label: 'Streets' },
    { id: 'kids', x, y: 166, w, h: 36, label: 'Change kid' },
    muteButton(muted),
  ];
}

export function drawPause(ctx: CanvasRenderingContext2D, muted: boolean, time: number): void {
  ctx.fillStyle = alpha('#000000', 0.55);
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  drawText(ctx, 'Paused', SCREEN.w / 2, 44, { size: 18, color: PALETTE.gold, align: 'center' });
  for (const b of pauseButtons(muted)) drawButton(ctx, b, time);
}

export function hudButtons(): Button[] {
  return [{ id: 'pause', x: SCREEN.w - 40, y: 3, w: 34, h: 24, label: 'II', small: true }];
}

export function drawHudButtons(ctx: CanvasRenderingContext2D): void {
  for (const b of hudButtons()) drawButton(ctx, b);
}

// --- Spooked out of hearts ---------------------------------------------------------------------

export function drawLost(ctx: CanvasRenderingContext2D, state: GameState): void {
  const k = Math.min(1, state.phaseTime / 0.4);
  ctx.fillStyle = alpha('#000000', 0.45 * k);
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  drawText(ctx, 'Boo!', SCREEN.w / 2, SCREEN.h / 2 - 14, { size: 30 * (0.6 + 0.4 * k), color: '#ffffff', align: 'center' });
  drawText(ctx, 'Try again!', SCREEN.w / 2, SCREEN.h / 2 + 18, { size: 14, color: PALETTE.gold, align: 'center' });
}

// --- The candy bowl ------------------------------------------------------------------------------

export function bowlButtons(hasNext: boolean): Button[] {
  const w = 130;
  const out: Button[] = [{ id: 'streets', x: SCREEN.w / 2 - (hasNext ? w + 8 : w / 2), y: SCREEN.h - 62, w, h: 40, label: 'Streets' }];
  if (hasNext) out.push({ id: 'next', x: SCREEN.w / 2 + 8, y: SCREEN.h - 62, w, h: 40, label: 'Next street!', primary: true });
  return out;
}

export function drawBowl(ctx: CanvasRenderingContext2D, state: GameState, hasNext: boolean, time: number): void {
  const k = Math.min(1, state.phaseTime / 0.6);
  ctx.fillStyle = alpha('#000000', 0.45 * k);
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  const bounce = Math.sin(time * 4) * 3;
  drawText(ctx, 'Happy Halloween!', SCREEN.w / 2, 54 + bounce, { size: 24, color: PALETTE.pumpkin, align: 'center' });
  drawText(ctx, `${state.player.candy} candy!`, SCREEN.w / 2, 92, { size: 18, color: PALETTE.gold, align: 'center' });
  drawKidPortrait(ctx, characterById(state.character), SCREEN.w / 2, 150, 80, 1);
  // Hocus and Pocus, dancing round the candy.
  for (const [i, name] of (['Hocus', 'Pocus'] as const).entries()) {
    const meow = Math.floor(time * 2 + i) % 2 === 0;
    drawCat(ctx, { name, pose: meow ? 'meow' : 'sit', fx: i === 0 ? 1 : -1, moving: false }, SCREEN.w / 2 + (i === 0 ? -62 : 62), 182 - (meow ? 3 : 0), time, 30, true);
  }
  if (state.phaseTime > 1.2) for (const b of bowlButtons(hasNext)) drawButton(ctx, b, time);
}
