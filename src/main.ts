import { Audio } from './core/audio';
import { Input, type QueuedPointer } from './core/input';
import { startLoop } from './core/loop';
import { loadSave, recordBowl, recordLoss, writeSave } from './core/save';
import { Viewport } from './core/viewport';
import { WakeLock } from './core/wakelock';
import { SCREEN, STICK } from './game/config';
import { characterById, type CharacterId } from './game/content';
import { GameState, type GameEvent } from './game/state';
import { STREETS, isStreetUnlocked, streetById } from './game/streets';
import { PALETTE } from './render/palette';
import { Particles } from './render/particles';
import { MONSTER_FRAMES, drawHud, drawPlay, drawStick, kick, updateCamera } from './render/scene';
import { loadSprites } from './render/sprites';
import {
  bowlButtons,
  drawBowl,
  drawHudButtons,
  drawIntro,
  drawLost,
  drawPause,
  drawPick,
  drawStreets,
  drawTitle,
  hitTest,
  hudButtons,
  pauseButtons,
  pickButtons,
  streetButtons,
  titleButtons,
} from './ui/screens';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvas) throw new Error('#game canvas missing');

const viewport = new Viewport(canvas);
const input = new Input(viewport);
const state = new GameState();
const particles = new Particles();
const audio = new Audio();
const wakeLock = new WakeLock();

// Generated art, voices and music, all optional (scripts/generate-*.mjs).
loadSprites(import.meta.env.BASE_URL);
audio.loadRecorded(import.meta.env.BASE_URL);
const save = loadSave();
audio.muted = save.muted;
state.character = save.character;

let realTime = 0;
/** The joystick: where the finger went down, and whether it's still down. */
const drag = { active: false, baseX: 0, baseY: 0 };
/** Seconds since the last voice line of each kind, so nothing is said too often. */
const said = new Map<string, number>();

function chance(key: string, gap: number, p: number): boolean {
  if (realTime - (said.get(key) ?? -99) < gap || Math.random() > p) return false;
  said.set(key, realTime);
  return true;
}

/** The current kid says a line: `e.candy`, `a.candy` or `j.candy`. */
function kidSays(line: string, delay = 0): void {
  audio.say([`${characterById(state.character).voice}.${line}`], { delay });
}

function startStreet(id: number): void {
  state.help = save.struggle[id] ?? 0;
  state.load(streetById(id), state.character);
  particles.clear();
  drag.active = false;
  // The card says what to do, and so does she: "Let's find the candy bowl!"
  kidSays('find', 0.4);
}

/** The card's been seen: off she goes. */
function beginStreet(): void {
  audio.play('select');
  state.begin();
  drag.active = false;
  kidSays('trick', 0.2);
}

function toggleMute(): void {
  audio.setMuted(!audio.muted);
  save.muted = audio.muted;
  writeSave(save);
}

function pick(id: CharacterId): void {
  state.character = id;
  save.character = id;
  writeSave(save);
}

function nextStreet(): number | null {
  const next = STREETS.find((s) => s.id === state.street.id + 1);
  return next && isStreetUnlocked(save.candy, next.id) ? next.id : null;
}

// --- Input -----------------------------------------------------------------------------

function onPointer(p: QueuedPointer): void {
  const phase = state.phase;
  if (p.kind === 'up') {
    drag.active = false;
    return;
  }
  if (phase === 'title') {
    const hit = hitTest(titleButtons(audio.muted), p.x, p.y);
    if (hit?.id === 'mute') toggleMute();
    else if (hit?.id === 'play') {
      audio.play('select');
      state.phase = 'pick';
    }
    return;
  }
  if (phase === 'pick') {
    const hit = hitTest(pickButtons(), p.x, p.y);
    if (!hit) return;
    audio.play('select');
    if (hit.id === 'back') state.phase = 'title';
    else {
      pick(hit.id.slice(4) as CharacterId);
      audio.say([`${characterById(state.character).voice}.yay`], { interrupt: true });
      state.phase = 'streets';
    }
    return;
  }
  if (phase === 'streets') {
    const hit = hitTest(streetButtons(save), p.x, p.y);
    if (!hit) return;
    if (hit.id === 'back') {
      audio.play('select');
      state.phase = 'pick';
    } else if (hit.locked) {
      audio.play('deny');
    } else {
      audio.play('select');
      startStreet(Number(hit.id.slice(7)));
    }
    return;
  }
  if (phase === 'intro') {
    // A beat before a tap counts, so the tap that picked the street doesn't skip the card.
    if (state.phaseTime > 0.8) beginStreet();
    return;
  }
  if (phase === 'paused') {
    const hit = hitTest(pauseButtons(audio.muted), p.x, p.y);
    if (!hit) return;
    audio.play('select');
    if (hit.id === 'resume') state.phase = state.pausedFrom;
    else if (hit.id === 'streets') state.phase = 'streets';
    else if (hit.id === 'kids') state.phase = 'pick';
    else if (hit.id === 'mute') toggleMute();
    return;
  }
  if (phase === 'bowl') {
    if (state.phaseTime < 1.2) return;
    const next = nextStreet();
    const hit = hitTest(bowlButtons(next !== null), p.x, p.y);
    if (!hit) return;
    audio.play('select');
    if (hit.id === 'next' && next !== null) startStreet(next);
    else state.phase = 'streets';
    return;
  }
  if (phase === 'play' || phase === 'slide') {
    if (hitTest(hudButtons(), p.x, p.y)) {
      audio.play('select');
      state.pausedFrom = phase;
      state.phase = 'paused';
      drag.active = false;
      return;
    }
    drag.active = true;
    drag.baseX = p.x;
    drag.baseY = p.y;
  }
}

/** The stick, from the finger (or the arrow keys): -1..1 each way, with a dead zone. */
function steer(): void {
  let sx = 0;
  let sy = 0;
  if (drag.active && input.pointer.down) {
    const dx = input.pointer.x - drag.baseX;
    const dy = input.pointer.y - drag.baseY;
    const d = Math.hypot(dx, dy);
    if (d > STICK.dead) {
      const k = Math.min(1, (d - STICK.dead) / (STICK.full - STICK.dead)) / d;
      sx = dx * k;
      sy = dy * k;
    }
    // A finger that has wandered far from where it went down drags the centre
    // along behind it, so changing direction never needs a long way back.
    if (d > STICK.drawR * 1.6) {
      drag.baseX = input.pointer.x - (dx / d) * STICK.drawR * 1.6;
      drag.baseY = input.pointer.y - (dy / d) * STICK.drawR * 1.6;
    }
  }
  const h = input.held;
  const kx = (h.right ? 1 : 0) - (h.left ? 1 : 0);
  const ky = (h.down ? 1 : 0) - (h.up ? 1 : 0);
  if (kx || ky) {
    const d = Math.hypot(kx, ky);
    sx = kx / d;
    sy = ky / d;
  }
  state.setStick(sx, sy);
}

// --- Events -> sound, voices and sparkle ---------------------------------------------------

function onEvent(e: GameEvent): void {
  // Events are in room pixels; particles draw in the same space (scene.ts translates).
  switch (e.kind) {
    case 'shoot':
      audio.play('zap', 0.25);
      break;
    case 'hit':
      particles.sparks(e.x, e.y, 4, '#ffffff', 60);
      audio.play('bonk', 0.3);
      break;
    case 'boo': {
      const kind = e.tag as keyof typeof MONSTER_FRAMES;
      particles.starBurst(e.x, e.y, 12, 90);
      particles.happy(e.x, e.y, MONSTER_FRAMES[kind] ?? 0);
      audio.play('boo');
      if (kind === 'raccoon' && chance('r.mine', 6, 0.7)) audio.say(['r.mine', 'r.nofair'], { delay: 0.1 });
      else if (kind === 'ghost' && chance('g.boo', 6, 0.5)) audio.say(['g.happy'], { delay: 0.1 });
      else if (chance('kid.boo', 5, 0.35)) kidSays('boo', 0.15);
      break;
    }
    case 'break':
      particles.puff(e.x, e.y, 14, e.tag === 'w' ? '#ffffff' : e.tag === 'h' ? PALETTE.hay : PALETTE.leaves, 0.6);
      particles.sparks(e.x, e.y, 10, e.tag === 'l' ? PALETTE.leavesB : '#ffffff', 80);
      audio.play('pop', 0.6);
      break;
    case 'chest':
      particles.starBurst(e.x, e.y, 16, 100);
      audio.play('powerup');
      if (e.tag === 'key') particles.popup(e.x, e.y - 18, 'A key!', PALETTE.key, 12, 1.2);
      break;
    case 'pickup':
      if (e.tag === 'candy') {
        audio.play('candy', 0.6);
        if (e.value % 25 === 0 && e.value > 0) {
          particles.popup(e.x, e.y - 14, `${e.value} candy!`, PALETTE.gold, 11, 1);
          if (chance('kid.candy', 8, 1)) kidSays('candy');
        }
      } else if (e.tag === 'heart') {
        audio.play('heart');
        particles.sparks(e.x, e.y, 8, PALETTE.heart, 60);
      } else {
        audio.play('powerup');
        particles.starBurst(e.x, e.y, 10, 70);
        kidSays('key');
      }
      break;
    case 'gate':
      audio.play('gate');
      particles.starBurst(e.x, e.y, 14, 90);
      kidSays('gate', 0.3);
      break;
    case 'locked':
      audio.play('deny');
      particles.popup(e.x, e.y - 18, 'Find the key!', PALETTE.key, 11, 1.4);
      if (chance('kid.need', 6, 1)) kidSays('need', 0.1);
      break;
    case 'nudge':
      break;
    case 'spooked':
      audio.play('hurt');
      kick(0.4);
      particles.ring(e.x, e.y, 26, PALETTE.heart, 0.4);
      if (e.value > 0 && chance('kid.spooky', 5, 0.6)) kidSays('spooky');
      if (e.tag === 'raccoon' && chance('r.tease', 6, 0.6)) audio.say(['r.hehe'], { delay: 0.6 });
      break;
    case 'lost':
      state.help = recordLoss(save, state.street.id);
      audio.play('lose');
      kidSays('oops', 0.2);
      break;
    case 'respawn':
      particles.starBurst(e.x, e.y, 12, 60);
      break;
    case 'tease':
      if (chance('r.tease', 6, 0.5)) audio.say(['r.hehe', 'r.mine'], { gain: 0.8 });
      break;
    case 'boss-enter':
      audio.play('alarm');
      audio.say([`${bossVoice(e.tag)}.hello`], { delay: 0.8 });
      break;
    case 'boss-attack':
      if (e.tag === 'swoop') particles.popup(e.x, e.y - 34, 'Look out!', PALETTE.heart, 11, 0.8);
      if (e.tag === 'vanish') audio.play('warp', 0.5);
      else audio.play('pop', 0.4);
      break;
    case 'boss-hit':
      particles.sparks(e.x, e.y, 3, PALETTE.gold, 60);
      break;
    case 'boss-boo':
      kick(0.8, 0.6);
      audio.play('bigboom');
      particles.explosion(e.x, e.y, 1.2);
      particles.starBurst(e.x, e.y, 30, 140);
      particles.popup(e.x, e.y - 40, 'BOO!', PALETTE.gold, 22, 1.4);
      audio.say([`${bossVoice(e.tag)}.lose`], { delay: 0.6 });
      kidSays('yay', 2);
      break;
    case 'bowl':
      recordBowl(save, state.street.id, e.value);
      audio.play('win');
      particles.starBurst(e.x, e.y, 40, 160);
      kidSays('happy', 0.4);
      break;
    case 'room':
      break;
    case 'meow':
      // Hocus (a girl) meows a touch higher than Pocus (a boy), so they sound like two cats.
      audio.play('meow', e.tag === 'Hocus' ? 1.12 : 0.88);
      particles.popup(e.x, e.y - 24, e.tag === 'Pocus' ? 'Over here!' : 'This way!', e.tag === 'Hocus' ? PALETTE.hocus : PALETTE.pocus, 8, 0.9);
      break;
  }
}

function bossVoice(kind: string): string {
  return kind === 'pumpkin-king' ? 'pk' : kind === 'big-boo' ? 'bb' : 'rc';
}

// --- Loop -------------------------------------------------------------------------------------

function update(dt: number): void {
  realTime += dt;
  if (input.consumeAnyPress()) {
    audio.unlock();
    wakeLock.arm();
  }
  input.drainKeys((k) => {
    if (k === 'pause') {
      if (state.phase === 'paused') state.phase = state.pausedFrom;
      else if (state.phase === 'play') {
        state.pausedFrom = 'play';
        state.phase = 'paused';
      }
    } else if (k === 'confirm') {
      if (state.phase === 'title') state.phase = 'pick';
      else if (state.phase === 'pick') state.phase = 'streets';
      else if (state.phase === 'streets') startStreet(STREETS[0]!.id);
      else if (state.phase === 'intro' && state.phaseTime > 0.8) beginStreet();
    }
  });
  input.drainPointer(onPointer);
  steer();

  const menu = state.phase === 'title' || state.phase === 'pick' || state.phase === 'streets';
  const boss = state.boss.phase === 'fight' || state.boss.phase === 'intro';
  audio.setMusic(menu || state.phase === 'bowl' ? 'music.title' : boss ? 'music.boss' : 'music.street');
  audio.updateMusic();
  updateCamera(dt);

  if (state.phase === 'paused' || menu) return;
  state.update(dt);
  state.drainEvents(onEvent);
  particles.update(dt);
}

function render(alphaT: number): void {
  const ctx = viewport.ctx;
  ctx.fillStyle = PALETTE.overlay;
  ctx.fillRect(-SCREEN.w, -SCREEN.h, SCREEN.w * 3, SCREEN.h * 3);
  switch (state.phase) {
    case 'title':
      drawTitle(ctx, audio.muted, realTime);
      return;
    case 'pick':
      drawPick(ctx, state.character, realTime);
      return;
    case 'streets':
      drawStreets(ctx, save, realTime);
      return;
  }
  drawPlay(ctx, state, particles, alphaT, realTime);
  drawHud(ctx, state, realTime);
  drawHudButtons(ctx);
  if (drag.active && input.pointer.down && state.phase === 'play') {
    drawStick(ctx, drag.baseX, drag.baseY, input.pointer.x - drag.baseX, input.pointer.y - drag.baseY);
  }
  if (state.phase === 'paused') drawPause(ctx, audio.muted, realTime);
  else if (state.phase === 'lost') drawLost(ctx, state);
  else if (state.phase === 'intro') drawIntro(ctx, state, realTime);
  else if (state.phase === 'bowl') drawBowl(ctx, state, nextStreet() !== null, realTime);
}

startLoop({ update, render });

// Offline play: the service worker caches every picture and sound on the first
// visit, so it works in the car. Production only (it would fight Vite's reloads).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch((error) => console.warn('[sw] registration failed', error));
  });
}

if (import.meta.env.DEV) {
  void Promise.all([import('./dev/verify'), import('./dev/art')]).then(([{ verify }, { checkArt }]) => {
    (window as unknown as Record<string, unknown>).__game = {
      state,
      verify,
      checkArt,
      /** Jump straight into a street. */
      street: (id: number) => startStreet(id),
      /** Run the whole loop for `seconds`, regardless of rAF. */
      advance: (seconds: number) => {
        for (let t = 0; t < seconds; t += 1 / 120) update(1 / 120);
      },
      unlockAll: () => {
        for (const s of STREETS) save.candy[s.id] = Math.max(1, save.candy[s.id] ?? 0);
        writeSave(save);
      },
      invincible: (on = true) => {
        state.invincible = on;
      },
    };
  });
}
