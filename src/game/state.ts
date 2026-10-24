/**
 * The whole simulation: one trick-or-treater, the room she's in, the monsters,
 * shots, boss projectiles, pickups and the boss.
 *
 * It never touches the screen or the speakers. Everything worth seeing or
 * hearing goes out as a GameEvent, which main.ts drains into particles, sound
 * and voices, as in the siblings. Positions are room pixels: (0, 0) is the top
 * left of the current room.
 *
 * Nobody is hurt. A monster she hits enough is "boo'd": it turns happy, pops
 * into candy and floats away. When a monster touches HER she's "spooked": a
 * heart, a hop backwards, and a moment of blinking safety. Out of hearts, she
 * starts again at the door she came in by, with full hearts and everything
 * she's already cleared still cleared. Monsters come back when she leaves a
 * room and comes back, as in Zelda; leaves, gates and chests stay as she left them.
 */

import { Rng } from '../core/rng';
import {
  BOSS_TOUCH,
  BOSSES,
  BREAKABLE_HP,
  CATS,
  CHEST_HP,
  DASH,
  HELP,
  HOP,
  MONSTERS,
  NUDGE,
  ORB,
  PLAYER,
  POOL,
  ROOM_COLS,
  ROOM_H,
  ROOM_ROWS,
  ROOM_SLIDE,
  ROOM_W,
  SHOT,
  THOUGHT,
  TILE,
  type BossKind,
  type MonsterKind,
} from './config';
import type { CharacterId } from './content';
import { BLOCKS_SHOTS, DIRS, SOLID, buildRoom, roomAt, streetById, type Dir, type RoomSpec, type Street } from './streets';

export type Phase = 'title' | 'pick' | 'streets' | 'intro' | 'play' | 'slide' | 'paused' | 'lost' | 'bowl';

export interface Player {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  /** Which way she's facing, unit vector. */
  fx: number;
  fy: number;
  moving: boolean;
  hearts: number;
  maxHearts: number;
  /** Seconds of blinking safety left. */
  safe: number;
  /** Knockback velocity, decaying. */
  kx: number;
  ky: number;
  fireClock: number;
  keys: number;
  candy: number;
  /** A face to pull, and for how long. */
  mood: 'walk' | 'cheer' | 'spooked';
  moodTime: number;
}

export interface Monster {
  alive: boolean;
  kind: MonsterKind;
  /** Which spawn tile in its room it came from, so a boo'd one stays boo'd. */
  spawn: number;
  x: number;
  y: number;
  hp: number;
  t: number;
  flash: number;
  /** Hopping, dashing or resting: seconds left in the current move. */
  move: number;
  rest: number;
  dx: number;
  dy: number;
  seed: number;
  /** Seconds of teasing pose (raccoons). */
  tease: number;
  /** Summoned by a boss: never remembered. */
  minion: boolean;
}

export interface Shot {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export interface Orb {
  alive: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  kind: 'seed' | 'orb';
}

export type PickupKind = 'candy' | 'heart' | 'key';

export interface Pickup {
  alive: boolean;
  kind: PickupKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  /** A map item (a `k`, `+` or `c` tile): its tile index, so taking it is remembered. */
  tile: number;
}

export interface Boss {
  kind: BossKind | null;
  phase: 'none' | 'intro' | 'fight' | 'dying' | 'gone';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  t: number;
  clock: number;
  attack: number;
  flash: number;
  /** Big Boo fades out and pops up elsewhere: 1 visible, 0 gone. */
  alpha: number;
  vanish: number;
  /** Count Raccula's swoop: telegraph, then a dash. */
  swoop: 'none' | 'wind' | 'dash';
  swoopT: number;
  dx: number;
  dy: number;
  /** Pumpkin King's hop. */
  hop: number;
  /** Seconds she's been crowding Big Boo. */
  crowded: number;
}

export interface Cat {
  name: 'Hocus' | 'Pocus';
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  /** 1 facing right, -1 left. */
  fx: number;
  /** Sideways speed, smoothed, px/s: which way it faces follows this, not every twitch. */
  vx: number;
  moving: boolean;
  /** Following her, or off showing her something. */
  mode: 'follow' | 'guide';
  pose: 'walk' | 'sit' | 'meow' | 'purr' | 'startled';
  /** Seconds a pose like 'meow' or 'startled' holds. */
  poseTime: number;
  /** Seconds standing still. */
  still: number;
  meowClock: number;
  /** Where it's guiding her to, in room pixels. */
  gx: number;
  gy: number;
}

/** What she's done in each room, kept for the whole street. */
interface RoomState {
  grid: string[][];
  /** Hit points left on damaged breakables and chests, by tile index. */
  damage: Map<number, number>;
  /** Monster spawns already boo'd. */
  booed: Set<number>;
  bossBeaten: boolean;
}

export type EventKind =
  | 'shoot'
  | 'hit'
  | 'boo'
  | 'break'
  | 'chest'
  | 'pickup'
  | 'gate'
  | 'locked'
  | 'spooked'
  | 'lost'
  | 'respawn'
  | 'room'
  | 'tease'
  | 'boss-enter'
  | 'boss-attack'
  | 'boss-hit'
  | 'boss-boo'
  | 'bowl'
  | 'meow'
  | 'nudge';

/** What she's thinking of: shown in a bubble over her head. */
export type Thought = 'bowl' | 'key' | 'gate';

export interface GameEvent {
  kind: EventKind;
  x: number;
  y: number;
  tag: string;
  value: number;
}

const MONSTER_LETTERS: Record<string, MonsterKind> = { g: 'ghost', b: 'bat', p: 'pumpkin', r: 'raccoon' };
const ITEM_LETTERS: Record<string, PickupKind> = { k: 'key', '+': 'heart', c: 'candy' };

/** Seconds of "Oh no!" before she starts again at the door. */
const LOST_TIME = 1.6;
/** Seconds the boss waits after she walks in, so she sees it before it moves. */
const BOSS_INTRO = 1.4;
/** Seconds of the boss's happy spin before it floats off. */
const BOSS_DYING = 1.8;

export class GameState {
  phase: Phase = 'title';
  pausedFrom: Phase = 'play';
  character: CharacterId = 'ellie';
  street: Street = streetById(1);
  /** Current room's grid position. */
  rx = 0;
  ry = 0;
  /** The room we slid from, and which way, during a 'slide'. */
  slideFrom: { rx: number; ry: number; dir: Dir; t: number } = { rx: 0, ry: 0, dir: 'e', t: 0 };
  /** Times she's run out of hearts on this street (HELP). Set by main.ts from the save. */
  help = 0;
  /** Seconds into the current phase's animation (lost, bowl). */
  phaseTime = 0;
  /** Where she came into this room, for starting again. */
  entryX = 0;
  entryY = 0;
  /** Doors are shut while a boss is up. */
  shut = false;
  time = 0;
  /** The thought bubble over her head, and seconds left on it. */
  thought: Thought = 'bowl';
  thoughtTime = 0;
  /** Seconds in this room since she came in or last found something (NUDGE). */
  roomTime = 0;
  /** While nudging: where each cat waits (the doorway towards what's next), in room pixels. */
  private nudge: [number, number][] | null = null;
  private nudgeClock = 0;
  private rethinkClock = 0;

  readonly player: Player = {
    x: 0, y: 0, prevX: 0, prevY: 0, fx: 1, fy: 0, moving: false, hearts: PLAYER.hearts, maxHearts: PLAYER.hearts,
    safe: 0, kx: 0, ky: 0, fireClock: 0, keys: 0, candy: 0, mood: 'walk', moodTime: 0,
  };
  readonly monsters: Monster[] = [];
  readonly shots: Shot[] = [];
  readonly orbs: Orb[] = [];
  readonly pickups: Pickup[] = [];
  readonly cats: Cat[] = (['Hocus', 'Pocus'] as const).map((name) => ({
    name, x: 0, y: 0, prevX: 0, prevY: 0, fx: 1, vx: 0, moving: false, mode: 'follow' as const, pose: 'sit' as const,
    poseTime: 0, still: 0, meowClock: 0, gx: 0, gy: 0,
  }));
  readonly boss: Boss = {
    kind: null, phase: 'none', x: 0, y: 0, hp: 0, maxHp: 1, t: 0, clock: 0, attack: 0, flash: 0, alpha: 1, vanish: 0,
    swoop: 'none', swoopT: 0, dx: 0, dy: 0, hop: 0, crowded: 0,
  };

  private rooms = new Map<string, RoomState>();
  private rng = new Rng(1);
  private readonly events: GameEvent[] = [];
  private eventCount = 0;
  /** The stick: -1..1 each way, set by main.ts every tick. */
  private stickX = 0;
  private stickY = 0;
  /** Dev/verify: no spooks. */
  invincible = false;

  constructor() {
    for (let i = 0; i < POOL.monsters; i++) {
      this.monsters.push({
        alive: false, kind: 'ghost', spawn: -1, x: 0, y: 0, hp: 0, t: 0, flash: 0, move: 0, rest: 0, dx: 0, dy: 0,
        seed: 0, tease: 0, minion: false,
      });
    }
    for (let i = 0; i < POOL.shots; i++) this.shots.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0 });
    for (let i = 0; i < POOL.orbs; i++) this.orbs.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, kind: 'orb' });
    for (let i = 0; i < POOL.pickups; i++) {
      this.pickups.push({ alive: false, kind: 'candy', x: 0, y: 0, vx: 0, vy: 0, t: 0, tile: -1 });
    }
    for (let i = 0; i < POOL.events; i++) this.events.push({ kind: 'hit', x: 0, y: 0, tag: '', value: 0 });
  }

  // --- Street and room flow ---------------------------------------------------------

  /** Start a street from its first room, fresh. */
  load(street: Street, character: CharacterId, seed = 0): void {
    this.street = street;
    this.character = character;
    this.rooms.clear();
    this.rng = new Rng(street.id * 7919 + seed * 104729);
    const p = this.player;
    p.keys = 0;
    p.candy = 0;
    p.maxHearts = PLAYER.hearts + HELP.extraHearts[Math.min(this.help, HELP.extraHearts.length - 1)]!;
    p.hearts = p.maxHearts;
    p.safe = 0;
    p.kx = p.ky = 0;
    // A fresh face: the candy bowl's cheer is held for the whole celebration,
    // and used to carry over into the next street (Ellie stuck mid-"yay").
    p.mood = 'walk';
    p.moodTime = 0;
    // The start room is the one with an `S` in it.
    const start = street.rooms.find((r) => r.tiles.some((row) => row.includes('S'))) ?? street.rooms[0]!;
    this.enterRoom(start.at[0], start.at[1]);
    const grid = this.grid;
    for (let r = 0; r < ROOM_ROWS; r++) {
      for (let c = 0; c < ROOM_COLS; c++) {
        if (grid[r]![c] === 'S') {
          grid[r]![c] = ':';
          p.x = (c + 0.5) * TILE;
          p.y = (r + 0.5) * TILE;
        }
      }
    }
    p.prevX = p.x;
    p.prevY = p.y;
    this.entryX = p.x;
    this.entryY = p.y;
    p.fx = 1;
    p.fy = 0;
    this.time = 0;
    this.thoughtTime = 0;
    this.placeCats();
    // The "find the candy bowl" card first; main.ts calls begin() on a tap.
    this.phase = 'intro';
    this.phaseTime = 0;
  }

  /** Off she goes, thinking of the candy bowl. */
  begin(): void {
    this.phase = 'play';
    this.think('bowl', THOUGHT.start);
  }

  think(what: Thought, seconds: number): void {
    this.thought = what;
    this.thoughtTime = seconds;
  }

  /** The cats appear just behind her: on arriving, and after starting again. */
  private placeCats(): void {
    const p = this.player;
    this.cats.forEach((c, i) => {
      // Behind her, but never outside the room (at a street's first door, behind is off the edge).
      const m = TILE * 0.6;
      c.x = c.prevX = Math.min(ROOM_W - m, Math.max(m, p.x - p.fx * CATS.gap * (i + 1)));
      c.y = c.prevY = Math.min(ROOM_H - m, Math.max(m, p.y - p.fy * CATS.gap * (i + 1) + (i ? 8 : -8)));
      c.mode = 'follow';
      c.pose = 'walk';
      c.poseTime = 0;
      c.still = 0;
      c.vx = 0;
      c.meowClock = 1.5;
    });
  }

  get room(): RoomSpec {
    return roomAt(this.street, this.rx, this.ry)!;
  }

  /** The current room's live tiles. */
  get grid(): string[][] {
    return this.roomState(this.rx, this.ry).grid;
  }

  roomState(x: number, y: number): RoomState {
    const key = `${x},${y}`;
    let st = this.rooms.get(key);
    if (!st) {
      const spec = roomAt(this.street, x, y)!;
      st = { grid: buildRoom(this.street, spec), damage: new Map(), booed: new Set(), bossBeaten: false };
      this.rooms.set(key, st);
    }
    return st;
  }

  /** Bring a room to life: its monsters, its items, its boss. */
  private enterRoom(x: number, y: number): void {
    this.rx = x;
    this.ry = y;
    this.roomTime = 0;
    this.nudge = null;
    for (const m of this.monsters) m.alive = false;
    for (const s of this.shots) s.alive = false;
    for (const o of this.orbs) o.alive = false;
    for (const p of this.pickups) p.alive = false;
    const st = this.roomState(x, y);
    const grid = st.grid;
    for (let r = 0; r < ROOM_ROWS; r++) {
      for (let c = 0; c < ROOM_COLS; c++) {
        const ch = grid[r]![c]!;
        const i = r * ROOM_COLS + c;
        const kind = MONSTER_LETTERS[ch];
        if (kind && !st.booed.has(i)) this.spawnMonster(kind, (c + 0.5) * TILE, (r + 0.5) * TILE, i, false);
        const item = ITEM_LETTERS[ch];
        if (item) this.spawnPickup(item, (c + 0.5) * TILE, (r + 0.5) * TILE, 0, 0, i);
      }
    }
    const b = this.boss;
    b.kind = this.room.boss ?? null;
    b.phase = 'none';
    this.shut = false;
    if (b.kind && !st.bossBeaten) {
      const spec = BOSSES[b.kind];
      // The `Z` marks where it waits.
      for (let r = 0; r < ROOM_ROWS; r++) {
        const c = grid[r]!.indexOf('Z');
        if (c >= 0) {
          b.x = (c + 0.5) * TILE;
          b.y = (r + 0.5) * TILE;
        }
      }
      b.phase = 'intro';
      b.t = 0;
      b.hp = b.maxHp = spec.hp;
      b.clock = spec.every;
      b.attack = 0;
      b.flash = 0;
      b.alpha = 1;
      b.vanish = 0;
      b.swoop = 'none';
      b.hop = 0;
      b.crowded = 0;
      this.shut = true;
      this.emit('boss-enter', b.x, b.y, b.kind, 0);
    }
    this.emit('room', x, y, '', 0);
  }

  private spawnMonster(kind: MonsterKind, x: number, y: number, spawn: number, minion: boolean): Monster | null {
    const m = this.monsters.find((o) => !o.alive);
    if (!m) return null;
    m.alive = true;
    m.kind = kind;
    m.spawn = spawn;
    m.x = x;
    m.y = y;
    m.hp = MONSTERS[kind].hp;
    m.t = 0;
    m.flash = 0;
    m.move = 0;
    m.rest = this.rng.range(0.2, 1);
    m.dx = 0;
    m.dy = 0;
    m.seed = this.rng.range(0, Math.PI * 2);
    m.tease = 0;
    m.minion = minion;
    return m;
  }

  private spawnPickup(kind: PickupKind, x: number, y: number, vx: number, vy: number, tile = -1): void {
    const p = this.pickups.find((o) => !o.alive);
    if (!p) return;
    p.alive = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.t = 0;
    p.tile = tile;
  }

  // --- Tiles ----------------------------------------------------------------------------

  tileAt(px: number, py: number): string {
    const c = Math.floor(px / TILE);
    const r = Math.floor(py / TILE);
    if (c < 0 || r < 0 || c >= ROOM_COLS || r >= ROOM_ROWS) return '';
    return this.grid[r]![c]!;
  }

  private solidAt(px: number, py: number): boolean {
    const t = this.tileAt(px, py);
    // Off the edge of the room is open only through a doorway, and a doorway
    // is a walkable tile on the edge: out here is only reached through one.
    if (t === '') return false;
    return SOLID.has(t);
  }

  /** Would a circle of radius r at (x, y) overlap anything solid? */
  private blocked(x: number, y: number, r: number): boolean {
    return (
      this.solidAt(x - r, y - r) || this.solidAt(x + r, y - r) || this.solidAt(x - r, y + r) || this.solidAt(x + r, y + r)
    );
  }

  /** Can a shot fly straight from a to b? Tiles that stop shots (other than the target's own) block it. */
  private clearLine(ax: number, ay: number, bx: number, by: number, targetTile = -1): boolean {
    const d = Math.hypot(bx - ax, by - ay);
    const steps = Math.ceil(d / (TILE / 3));
    for (let i = 1; i < steps; i++) {
      const x = ax + ((bx - ax) * i) / steps;
      const y = ay + ((by - ay) * i) / steps;
      const c = Math.floor(x / TILE);
      const r = Math.floor(y / TILE);
      if (r * ROOM_COLS + c === targetTile) return true;
      if (BLOCKS_SHOTS.has(this.tileAt(x, y))) return false;
    }
    return true;
  }

  // --- Input -----------------------------------------------------------------------------

  setStick(x: number, y: number): void {
    this.stickX = x;
    this.stickY = y;
  }

  // --- Update ----------------------------------------------------------------------------

  update(dt: number): void {
    this.time += dt;
    if (this.phase === 'slide') {
      this.slideFrom.t += dt;
      if (this.slideFrom.t >= ROOM_SLIDE) this.phase = 'play';
      return;
    }
    if (this.phase === 'intro') {
      this.phaseTime += dt;
      for (const c of this.cats) {
        c.prevX = c.x;
        c.prevY = c.y;
        c.pose = 'sit';
      }
      return;
    }
    if (this.phase === 'lost') {
      this.phaseTime += dt;
      if (this.phaseTime >= LOST_TIME) this.respawn();
      return;
    }
    if (this.phase === 'bowl') {
      this.phaseTime += dt;
      this.movePickups(dt);
      // Hocus and Pocus dance round the candy bowl.
      for (const c of this.cats) {
        c.prevX = c.x;
        c.prevY = c.y;
        c.pose = Math.floor(this.phaseTime * 2 + (c.name === 'Pocus' ? 1 : 0)) % 2 ? 'meow' : 'sit';
      }
      return;
    }
    if (this.phase !== 'play') return;

    this.roomTime += dt;
    this.thoughtTime = Math.max(0, this.thoughtTime - dt);
    this.movePlayer(dt);
    if (this.phase !== 'play') return; // walked out of the room
    this.fire(dt);
    this.moveShots(dt);
    this.moveMonsters(dt);
    this.updateBoss(dt);
    this.moveOrbs(dt);
    this.movePickups(dt);
    this.moveCats(dt);
    this.touch();
  }

  private movePlayer(dt: number): void {
    const p = this.player;
    p.prevX = p.x;
    p.prevY = p.y;
    p.safe = Math.max(0, p.safe - dt);
    p.moodTime -= dt;
    if (p.moodTime <= 0) p.mood = 'walk';
    const mag = Math.hypot(this.stickX, this.stickY);
    p.moving = mag > 0.01;
    if (p.moving) {
      p.fx = this.stickX / mag;
      p.fy = this.stickY / mag;
    }
    const k = Math.exp(-6 * dt);
    p.kx *= k;
    p.ky *= k;
    const vx = this.stickX * PLAYER.speed + p.kx;
    const vy = this.stickY * PLAYER.speed + p.ky;
    // Move one axis at a time, so she slides along walls instead of sticking.
    const nx = p.x + vx * dt;
    if (!this.blocked(nx, p.y, PLAYER.r)) p.x = nx;
    else p.kx = 0;
    const ny = p.y + vy * dt;
    if (!this.blocked(p.x, ny, PLAYER.r)) p.y = ny;
    else p.ky = 0;

    // Through a doorway and off the edge: the next room.
    let dir: Dir | null = null;
    if (p.x < 0) dir = 'w';
    else if (p.x > ROOM_W) dir = 'e';
    else if (p.y < 0) dir = 'n';
    else if (p.y > ROOM_H) dir = 's';
    if (!dir) return;
    if (this.shut) {
      p.x = Math.min(ROOM_W - PLAYER.r, Math.max(PLAYER.r, p.x));
      p.y = Math.min(ROOM_H - PLAYER.r, Math.max(PLAYER.r, p.y));
      return;
    }
    const [dx, dy] = DIRS[dir];
    if (!roomAt(this.street, this.rx + dx, this.ry + dy)) {
      p.x = Math.min(ROOM_W, Math.max(0, p.x));
      p.y = Math.min(ROOM_H, Math.max(0, p.y));
      return;
    }
    this.slideFrom = { rx: this.rx, ry: this.ry, dir, t: 0 };
    // Monsters are back in a room she left (Jonathan: "enemies should respawn
    // after you leave an area"). Starting again after a spook doesn't come
    // through here, so that still keeps the ones she'd boo'd.
    this.roomState(this.rx + dx, this.ry + dy).booed.clear();
    this.enterRoom(this.rx + dx, this.ry + dy);
    // Come in just inside the matching doorway.
    const inset = PLAYER.r + 4;
    if (dir === 'e') p.x = inset;
    if (dir === 'w') p.x = ROOM_W - inset;
    if (dir === 's') p.y = inset;
    if (dir === 'n') p.y = ROOM_H - inset;
    p.prevX = p.x;
    p.prevY = p.y;
    p.kx = p.ky = 0;
    this.entryX = p.x;
    this.entryY = p.y;
    this.placeCats();
    this.phase = 'slide';
  }

  /** Is (x, y) in front of her, within SHOT.cone of where she's facing? */
  private ahead(x: number, y: number): boolean {
    const p = this.player;
    const dx = x - p.x;
    const dy = y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    return (dx * p.fx + dy * p.fy) / d >= SHOT.cone;
  }

  /** Auto-aim: the nearest monster in front of her, else the nearest thing in the way in front of her. */
  private fire(dt: number): void {
    const p = this.player;
    p.fireClock -= dt;
    if (p.fireClock > 0) return;
    let tx = 0;
    let ty = 0;
    let best = Infinity;
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d < SHOT.range && d < best && this.ahead(m.x, m.y) && this.clearLine(p.x, p.y, m.x, m.y)) {
        best = d;
        tx = m.x;
        ty = m.y;
      }
    }
    const b = this.boss;
    if (b.phase === 'fight' && b.alpha > 0.5) {
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d < SHOT.range * 1.3 && d < best && this.ahead(b.x, b.y) && this.clearLine(p.x, p.y, b.x, b.y)) {
        best = d;
        tx = b.x;
        ty = b.y;
      }
    }
    if (best === Infinity) {
      // Nothing to boo: shoot what's in the way (leaves, cobwebs, hay, chests).
      const grid = this.grid;
      for (let r = 0; r < ROOM_ROWS; r++) {
        for (let c = 0; c < ROOM_COLS; c++) {
          const t = grid[r]![c]!;
          if (t !== 'l' && t !== 'w' && t !== 'h' && t !== 'X') continue;
          const cx = (c + 0.5) * TILE;
          const cy = (r + 0.5) * TILE;
          const d = Math.hypot(cx - p.x, cy - p.y);
          if (d < SHOT.obstacleRange && d < best && this.ahead(cx, cy) && this.clearLine(p.x, p.y, cx, cy, r * ROOM_COLS + c)) {
            best = d;
            tx = cx;
            ty = cy;
          }
        }
      }
    }
    if (best === Infinity) {
      // Something to boo nearby, but not in front of her: a star straight ahead,
      // so walking towards a monster always shoots at it.
      const near =
        this.monsters.some((m) => m.alive && Math.hypot(m.x - p.x, m.y - p.y) < SHOT.range) ||
        (b.phase === 'fight' && Math.hypot(b.x - p.x, b.y - p.y) < SHOT.range * 1.3);
      if (!near || !p.moving) return;
      tx = p.x + p.fx * SHOT.range;
      ty = p.y + p.fy * SHOT.range;
    }
    const s = this.shots.find((o) => !o.alive);
    if (!s) return;
    p.fireClock = SHOT.every;
    const d = Math.hypot(tx - p.x, ty - p.y) || 1;
    s.alive = true;
    s.x = p.x;
    s.y = p.y;
    s.vx = ((tx - p.x) / d) * SHOT.speed;
    s.vy = ((ty - p.y) / d) * SHOT.speed;
    s.life = SHOT.life;
    // She doesn't turn to follow what she's shooting: which way she faces is hers
    // to choose, or standing still would aim at everything again.
    this.emit('shoot', p.x, p.y, this.character, 0);
  }

  private moveShots(dt: number): void {
    for (const s of this.shots) {
      if (!s.alive) continue;
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life <= 0 || s.x < -10 || s.y < -10 || s.x > ROOM_W + 10 || s.y > ROOM_H + 10) {
        s.alive = false;
        continue;
      }
      // Monsters first.
      let hit = false;
      for (const m of this.monsters) {
        if (!m.alive) continue;
        if (Math.hypot(m.x - s.x, m.y - s.y) > MONSTERS[m.kind].r + SHOT.r) continue;
        s.alive = false;
        hit = true;
        m.hp -= SHOT.damage;
        m.flash = 0.1;
        if (m.hp <= 0) this.booMonster(m);
        else this.emit('hit', s.x, s.y, m.kind, 0);
        break;
      }
      if (hit) continue;
      const b = this.boss;
      if (b.phase === 'fight' && b.alpha > 0.5 && Math.hypot(b.x - s.x, b.y - s.y) < BOSSES[b.kind!].r + SHOT.r) {
        s.alive = false;
        this.damageBoss(s.x, s.y);
        continue;
      }
      // Then whatever tile it flew into.
      const t = this.tileAt(s.x, s.y);
      if (!BLOCKS_SHOTS.has(t)) continue;
      s.alive = false;
      this.shootTile(Math.floor(s.x / TILE), Math.floor(s.y / TILE));
    }
  }

  /** A shot hit a tile: breakables wear down and go; a chest pops open. */
  private shootTile(c: number, r: number): void {
    const grid = this.grid;
    const t = grid[r]![c]!;
    const i = r * ROOM_COLS + c;
    const st = this.roomState(this.rx, this.ry);
    const full = t === 'l' ? BREAKABLE_HP.leaves : t === 'w' ? BREAKABLE_HP.web : t === 'h' ? BREAKABLE_HP.hay : t === 'X' ? CHEST_HP : 0;
    if (!full) return;
    const left = (st.damage.get(i) ?? full) - 1;
    const x = (c + 0.5) * TILE;
    const y = (r + 0.5) * TILE;
    if (left > 0) {
      st.damage.set(i, left);
      this.emit('hit', x, y, t, left / full);
      return;
    }
    st.damage.delete(i);
    if (t === 'X') {
      grid[r]![c] = 'O';
      const what = this.room.chest ?? 'candy';
      this.spawnPickup(what, x, y + 4, 0, 40);
      if (what === 'candy') for (let k = 0; k < 4; k++) this.spawnPickup('candy', x, y, this.rng.range(-50, 50), this.rng.range(-20, 50));
      this.emit('chest', x, y, what, 0);
    } else {
      grid[r]![c] = '.';
      this.emit('break', x, y, t, 0);
    }
  }

  private booMonster(m: Monster): void {
    m.alive = false;
    if (!m.minion) this.roomState(this.rx, this.ry).booed.add(m.spawn);
    const spec = MONSTERS[m.kind];
    for (let k = 0; k < spec.candy; k++) {
      const a = this.rng.range(0, Math.PI * 2);
      this.spawnPickup('candy', m.x, m.y, Math.cos(a) * 45, Math.sin(a) * 45);
    }
    const p = this.player;
    const chance = HELP.heartChance[Math.min(this.help, HELP.heartChance.length - 1)]!;
    if (p.hearts < p.maxHearts && this.rng.next() < chance) this.spawnPickup('heart', m.x, m.y, 0, -30);
    this.emit('boo', m.x, m.y, m.kind, 0);
  }

  // --- Monsters -------------------------------------------------------------------------------

  private moveMonsters(dt: number): void {
    const p = this.player;
    for (const m of this.monsters) {
      if (!m.alive) continue;
      const spec = MONSTERS[m.kind];
      m.t += dt;
      m.flash = Math.max(0, m.flash - dt);
      m.tease = Math.max(0, m.tease - dt);
      const dx = p.x - m.x;
      const dy = p.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      const noticed = d < spec.notice || m.minion;
      let vx = 0;
      let vy = 0;
      switch (m.kind) {
        case 'ghost': {
          // Drift towards her, wobbling; just bob about until she's near.
          const wob = Math.sin(m.t * 2 + m.seed);
          if (noticed) {
            vx = (dx / d) * spec.speed + -dy / d * wob * 12;
            vy = (dy / d) * spec.speed + (dx / d) * wob * 12;
          } else {
            vy = wob * 10;
          }
          break;
        }
        case 'bat': {
          // Zigzag at her.
          const zig = Math.sin(m.t * 6 + m.seed);
          if (noticed) {
            vx = (dx / d) * spec.speed - (dy / d) * zig * 50;
            vy = (dy / d) * spec.speed + (dx / d) * zig * 50;
          } else {
            vx = Math.cos(m.t * 1.5 + m.seed) * 25;
            vy = zig * 25;
          }
          break;
        }
        case 'pumpkin': {
          // Sits, then hops towards her.
          if (m.move > 0) {
            m.move -= dt;
            vx = m.dx * spec.speed;
            vy = m.dy * spec.speed;
          } else {
            m.rest -= dt;
            if (m.rest <= 0 && noticed) {
              m.rest = HOP.every;
              m.move = HOP.time;
              m.dx = dx / d;
              m.dy = dy / d;
            }
          }
          break;
        }
        case 'raccoon': {
          // Dashes at her, then stops and teases.
          if (m.move > 0) {
            m.move -= dt;
            vx = m.dx * spec.speed;
            vy = m.dy * spec.speed;
          } else {
            m.rest -= dt;
            if (m.rest <= 0 && noticed) {
              m.rest = DASH.rest;
              m.move = DASH.time;
              m.dx = dx / d;
              m.dy = dy / d;
            } else if (m.rest > 0.5 && m.tease === 0 && this.rng.next() < dt * 0.6) {
              m.tease = 0.9;
              this.emit('tease', m.x, m.y, 'raccoon', 0);
            }
          }
          break;
        }
      }
      const nx = m.x + vx * dt;
      if (!this.blocked(nx, m.y, spec.r * 0.8) && nx > spec.r && nx < ROOM_W - spec.r) m.x = nx;
      else m.move = 0;
      const ny = m.y + vy * dt;
      if (!this.blocked(m.x, ny, spec.r * 0.8) && ny > spec.r && ny < ROOM_H - spec.r) m.y = ny;
      else m.move = 0;
    }
  }

  // --- The boss -----------------------------------------------------------------------------------

  private updateBoss(dt: number): void {
    const b = this.boss;
    if (!b.kind || b.phase === 'none' || b.phase === 'gone') return;
    const spec = BOSSES[b.kind];
    const p = this.player;
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    if (b.phase === 'intro') {
      if (b.t >= BOSS_INTRO) {
        b.phase = 'fight';
        b.t = 0;
      }
      return;
    }
    if (b.phase === 'dying') {
      if (b.t >= BOSS_DYING) {
        b.phase = 'gone';
        this.shut = false;
        this.roomState(this.rx, this.ry).bossBeaten = true;
        for (let k = 0; k < spec.candy; k++) {
          const a = this.rng.range(0, Math.PI * 2);
          this.spawnPickup('candy', b.x, b.y, Math.cos(a) * this.rng.range(40, 110), Math.sin(a) * this.rng.range(40, 110));
        }
        this.spawnPickup('heart', b.x, b.y, 0, 60);
        this.emit('boss-boo', b.x, b.y, b.kind, 0);
      }
      return;
    }

    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    const angry = b.hp < b.maxHp / 2;

    // Movement.
    if (b.kind === 'pumpkin-king') {
      b.hop -= dt;
      if (b.hop <= -0.9) b.hop = 0.5;
      if (b.hop > 0) this.moveBoss(b, (dx / d) * spec.speed * dt, (dy / d) * spec.speed * dt, spec.r);
    } else if (b.kind === 'big-boo') {
      if (b.vanish > 0) {
        b.vanish -= dt;
        b.alpha = Math.max(0, b.alpha - dt * 3);
        if (b.vanish <= 0) {
          // Pop up somewhere far from her, and burst a ring of orbs.
          for (let tries = 0; tries < 12; tries++) {
            const nx = this.rng.range(2, ROOM_COLS - 2) * TILE;
            const ny = this.rng.range(2, ROOM_ROWS - 2) * TILE;
            if (Math.hypot(nx - p.x, ny - p.y) > 140 && !this.blocked(nx, ny, spec.r * 0.6)) {
              b.x = nx;
              b.y = ny;
              break;
            }
          }
          this.ring(b.x, b.y, angry ? 8 : 6, 'orb');
        }
      } else {
        // Crowded for too long: off he goes, to pop up somewhere else.
        b.crowded = d < BOSS_TOUCH.crowd ? b.crowded + dt : 0;
        if (b.crowded > BOSS_TOUCH.crowdTime && b.phase === 'fight') {
          b.crowded = 0;
          b.vanish = 1.1;
          this.emit('boss-attack', b.x, b.y, 'vanish', 0);
        }
        b.alpha = Math.min(1, b.alpha + dt * 3);
        this.moveBoss(b, (dx / d) * spec.speed * dt, (dy / d) * spec.speed * dt + Math.sin(b.t * 2) * 12 * dt, spec.r);
      }
    } else if (b.kind === 'raccula') {
      if (b.swoop === 'wind') {
        b.swoopT -= dt;
        if (b.swoopT <= 0) {
          b.swoop = 'dash';
          b.swoopT = 0.75;
          b.dx = dx / d;
          b.dy = dy / d;
        }
      } else if (b.swoop === 'dash') {
        b.swoopT -= dt;
        this.moveBoss(b, b.dx * 230 * dt, b.dy * 230 * dt, spec.r);
        if (b.swoopT <= 0) b.swoop = 'none';
      } else {
        // Keep a little distance, drifting side to side.
        const want = d > 120 ? 1 : d < 80 ? -1 : 0;
        this.moveBoss(b, (dx / d) * spec.speed * want * dt + Math.cos(b.t) * 20 * dt, (dy / d) * spec.speed * want * dt, spec.r);
      }
    }

    // Attacks.
    if (b.swoop !== 'none' || b.vanish > 0) return;
    b.clock -= dt * (angry ? 1.3 : 1);
    if (b.clock > 0) return;
    b.clock = spec.every;
    const attack = b.attack++;
    if (b.kind === 'pumpkin-king') {
      this.ring(b.x, b.y, angry ? 10 : 8, 'seed');
      if (angry && attack % 2 === 1 && this.monsters.filter((m) => m.alive).length < 3) {
        this.spawnMonster('pumpkin', b.x - 30, b.y, -1, true);
        this.spawnMonster('pumpkin', b.x + 30, b.y, -1, true);
      }
      this.emit('boss-attack', b.x, b.y, 'seeds', 0);
    } else if (b.kind === 'big-boo') {
      if (attack % 2 === 0) {
        this.aimed(b.x, b.y, angry ? 5 : 3, 0.28, 'orb');
        this.emit('boss-attack', b.x, b.y, 'orbs', 0);
      } else {
        b.vanish = 1.1;
        this.emit('boss-attack', b.x, b.y, 'vanish', 0);
      }
    } else if (b.kind === 'raccula') {
      const move = attack % 3;
      if (move === 0) {
        this.aimed(b.x, b.y, angry ? 5 : 3, 0.3, 'orb');
        this.emit('boss-attack', b.x, b.y, 'orbs', 0);
      } else if (move === 1) {
        b.swoop = 'wind';
        b.swoopT = 0.8;
        this.emit('boss-attack', b.x, b.y, 'swoop', 0);
      } else {
        const bats = this.monsters.filter((m) => m.alive).length;
        for (let k = 0; k < (angry ? 3 : 2) && bats + k < 4; k++) {
          this.spawnMonster('bat', b.x + this.rng.range(-30, 30), b.y + this.rng.range(-20, 20), -1, true);
        }
        this.emit('boss-attack', b.x, b.y, 'bats', 0);
      }
    }
  }

  private moveBoss(b: Boss, mx: number, my: number, r: number): void {
    const nx = b.x + mx;
    if (!this.blocked(nx, b.y, r * 0.6) && nx > r && nx < ROOM_W - r) b.x = nx;
    else if (b.swoop === 'dash') b.swoop = 'none';
    const ny = b.y + my;
    if (!this.blocked(b.x, ny, r * 0.6) && ny > r && ny < ROOM_H - r) b.y = ny;
    else if (b.swoop === 'dash') b.swoop = 'none';
  }

  private damageBoss(x: number, y: number): void {
    const b = this.boss;
    b.hp -= SHOT.damage;
    b.flash = 0.08;
    this.emit('boss-hit', x, y, b.kind!, b.hp / b.maxHp);
    if (b.hp > 0) return;
    b.phase = 'dying';
    b.t = 0;
    b.swoop = 'none';
    for (const o of this.orbs) o.alive = false;
    for (const m of this.monsters) if (m.alive && m.minion) this.booMonster(m);
  }

  /** A ring of projectiles. */
  private ring(x: number, y: number, n: number, kind: Orb['kind']): void {
    const turn = this.rng.next();
    for (let i = 0; i < n; i++) {
      const a = ((i + turn) / n) * Math.PI * 2;
      this.launchOrb(x, y, Math.cos(a) * ORB.speed, Math.sin(a) * ORB.speed, kind);
    }
  }

  /** `n` projectiles fanned around the direction of her. */
  private aimed(x: number, y: number, n: number, spread: number, kind: Orb['kind']): void {
    const p = this.player;
    const base = Math.atan2(p.y - y, p.x - x);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * spread;
      this.launchOrb(x, y, Math.cos(a) * ORB.speed, Math.sin(a) * ORB.speed, kind);
    }
  }

  private launchOrb(x: number, y: number, vx: number, vy: number, kind: Orb['kind']): void {
    const o = this.orbs.find((q) => !q.alive);
    if (!o) return;
    o.alive = true;
    o.x = x;
    o.y = y;
    o.vx = vx;
    o.vy = vy;
    o.life = ORB.life;
    o.kind = kind;
  }

  private moveOrbs(dt: number): void {
    for (const o of this.orbs) {
      if (!o.alive) continue;
      o.life -= dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (o.life <= 0 || BLOCKS_SHOTS.has(this.tileAt(o.x, o.y)) || o.x < 0 || o.y < 0 || o.x > ROOM_W || o.y > ROOM_H) o.alive = false;
    }
  }

  // --- Pickups ---------------------------------------------------------------------------------------

  private movePickups(dt: number): void {
    const p = this.player;
    for (const k of this.pickups) {
      if (!k.alive) continue;
      k.t += dt;
      const damp = Math.exp(-4 * dt);
      k.vx *= damp;
      k.vy *= damp;
      const nx = k.x + k.vx * dt;
      const ny = k.y + k.vy * dt;
      if (!this.solidAt(nx, k.y)) k.x = nx;
      if (!this.solidAt(k.x, ny)) k.y = ny;
      // A gentle pull when she's close: candy she walked near is candy she got.
      const dx = p.x - k.x;
      const dy = p.y - k.y;
      const d = Math.hypot(dx, dy);
      if (d < 46 && k.t > 0.25) {
        k.x += (dx / (d || 1)) * 120 * dt;
        k.y += (dy / (d || 1)) * 120 * dt;
      }
    }
  }

  // --- Hocus and Pocus ---------------------------------------------------------------------------------

  /**
   * Something worth showing her: Pocus looks for a key (lying about, or in a
   * chest that holds one), Hocus for a gate she has a key for. In room pixels,
   * the walkable spot next to it nearest her, or null.
   */
  private guideTarget(cat: Cat): [number, number] | null {
    const grid = this.grid;
    const p = this.player;
    const wants = (t: string): boolean =>
      cat.name === 'Pocus' ? t === 'k' || (t === 'X' && this.room.chest === 'key') : t === 'L' && p.keys > 0;
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (let r = 0; r < ROOM_ROWS; r++) {
      for (let c = 0; c < ROOM_COLS; c++) {
        if (!wants(grid[r]![c]!)) continue;
        // A key on the ground is its own spot; anything solid, the open tile beside it.
        const spots: [number, number][] = grid[r]![c] === 'k' ? [[c, r]] : [[c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1]];
        for (const [sc, sr] of spots) {
          const t = grid[sr]?.[sc];
          if (t === undefined || SOLID.has(t)) continue;
          const x = (sc + 0.5) * TILE;
          const y = (sr + 0.5) * TILE;
          const d = Math.hypot(x - p.x, y - p.y);
          if (d < bestD) {
            bestD = d;
            best = [x, y];
          }
        }
      }
    }
    if (cat.name === 'Pocus') for (const k of this.pickups) if (k.alive && k.kind === 'key') return [k.x, k.y];
    return best;
  }

  /** The next point on a walk (round hedges, not through them) from (x, y) to (gx, gy). */
  private catStep(x: number, y: number, gx: number, gy: number): [number, number] | null {
    const grid = this.grid;
    const start = Math.floor(y / TILE) * ROOM_COLS + Math.floor(x / TILE);
    const goal = Math.floor(gy / TILE) * ROOM_COLS + Math.floor(gx / TILE);
    if (start === goal) return [gx, gy];
    const prev = new Int16Array(ROOM_COLS * ROOM_ROWS).fill(-1);
    prev[start] = start;
    const queue = [start];
    while (queue.length) {
      const i = queue.shift()!;
      if (i === goal) break;
      const c = i % ROOM_COLS;
      const r = (i - c) / ROOM_COLS;
      for (const [dx, dy] of Object.values(DIRS)) {
        const nc = c + dx;
        const nr = r + dy;
        if (nc < 0 || nr < 0 || nc >= ROOM_COLS || nr >= ROOM_ROWS) continue;
        const ni = nr * ROOM_COLS + nc;
        if (prev[ni]! >= 0 || SOLID.has(grid[nr]![nc]!)) continue;
        prev[ni] = i;
        queue.push(ni);
      }
    }
    if (prev[goal]! < 0) return null;
    let step = goal;
    while (prev[step] !== start) step = prev[step]!;
    return [((step % ROOM_COLS) + 0.5) * TILE, (Math.floor(step / ROOM_COLS) + 0.5) * TILE];
  }

  /**
   * The way to whatever she needs next, anywhere on the street: a search over
   * every tile of every room (leaves and cobwebs count as open, since she shoots
   * them; locked gates as closed, unless she has a key, when a gate is what's
   * next). Returns what it found and the last two steps of the way that are
   * still in this room: the doorway out, or the spot beside it if it's here.
   */
  private route(): { what: Thought; spots: [number, number][] } | null {
    const rooms = this.street.rooms;
    const index = new Map(rooms.map((r, i) => [`${r.at[0]},${r.at[1]}`, i]));
    const N = ROOM_COLS * ROOM_ROWS;
    const grids = rooms.map((r) => this.roomState(r.at[0], r.at[1]).grid);
    const here = index.get(`${this.rx},${this.ry}`)!;
    const p = this.player;
    const start = here * N + Math.floor(p.y / TILE) * ROOM_COLS + Math.floor(p.x / TILE);
    const prev = new Int32Array(rooms.length * N).fill(-1);
    prev[start] = start;
    const queue = [start];
    const wanted = (ri: number, t: string): Thought | null => {
      const room = rooms[ri]!;
      if (t === 'k' || (t === 'X' && room.chest === 'key')) return 'key';
      if (t === 'L' && p.keys > 0) return 'gate';
      if (t === 'B') return 'bowl';
      if (t === 'Z' && !this.roomState(room.at[0], room.at[1]).bossBeaten) return 'bowl';
      return null;
    };
    let found = -1;
    let what: Thought = 'bowl';
    for (let q = 0; q < queue.length && found < 0; q++) {
      const i = queue[q]!;
      const ri = Math.floor(i / N);
      const c = i % ROOM_COLS;
      const r = Math.floor((i % N) / ROOM_COLS);
      for (const [dx, dy] of Object.values(DIRS)) {
        let nc = c + dx;
        let nr = r + dy;
        let nri = ri;
        if (nc < 0 || nr < 0 || nc >= ROOM_COLS || nr >= ROOM_ROWS) {
          const at = rooms[ri]!.at;
          const other = index.get(`${at[0] + dx},${at[1] + dy}`);
          if (other === undefined) continue;
          nri = other;
          nc = (nc + ROOM_COLS) % ROOM_COLS;
          nr = (nr + ROOM_ROWS) % ROOM_ROWS;
        }
        const ni = nri * N + nr * ROOM_COLS + nc;
        if (prev[ni]! >= 0) continue;
        const t = grids[nri]![nr]![nc]!;
        const w = wanted(nri, t);
        if (w) {
          found = i;
          what = w;
          break;
        }
        if (SOLID.has(t) && t !== 'l' && t !== 'w' && t !== 'h') continue;
        prev[ni] = i;
        queue.push(ni);
      }
    }
    if (found < 0) return null;
    // Back along the way to the last steps still in this room.
    const path: number[] = [];
    for (let i = found; ; i = prev[i]!) {
      path.push(i);
      if (i === start) break;
    }
    path.reverse();
    // A leaf pile or cobweb in the way is as far as the cats go: they wait by it
    // (and she shoots it), as they can't walk through it.
    const open = (i: number): boolean => !SOLID.has(grids[Math.floor(i / N)]![Math.floor((i % N) / ROOM_COLS)]![i % ROOM_COLS]!);
    let last = 0;
    while (last + 1 < path.length && Math.floor(path[last + 1]! / N) === here && open(path[last + 1]!)) last++;
    const spot = (i: number): [number, number] => [((i % ROOM_COLS) + 0.5) * TILE, (Math.floor((i % N) / ROOM_COLS) + 0.5) * TILE];
    return { what, spots: [spot(path[last]!), spot(path[Math.max(0, last - 1)]!)] };
  }

  private moveCats(dt: number): void {
    const p = this.player;
    // She's been in here a while with nothing found: the cats show her the way on.
    const fighting = this.boss.phase === 'fight' || this.boss.phase === 'intro';
    const nudging = this.roomTime > NUDGE.after && !fighting;
    if (!nudging) this.nudge = null;
    else {
      this.nudgeClock -= dt;
      this.rethinkClock -= dt;
      if (!this.nudge || this.nudgeClock <= 0) {
        this.nudgeClock = NUDGE.reroute;
        const way = this.route();
        if (way && (!this.nudge || this.rethinkClock <= 0)) {
          this.rethinkClock = NUDGE.rethink;
          this.think(way.what, THOUGHT.nudge);
          this.emit('nudge', p.x, p.y, way.what, 0);
        }
        this.nudge = way ? way.spots : null;
      }
    }
    this.cats.forEach((c, i) => {
      c.prevX = c.x;
      c.prevY = c.y;
      c.poseTime = Math.max(0, c.poseTime - dt);
      // Guiding: off to show her the key (Pocus) or the gate (Hocus), or, when
      // she's lingered, both to the way out.
      const target = fighting ? null : this.guideTarget(c) ?? this.nudge?.[i] ?? null;
      if (target) {
        c.mode = 'guide';
        c.gx = target[0];
        c.gy = target[1];
      } else {
        c.mode = 'follow';
      }
      let tx: number;
      let ty: number;
      let speed: number;
      if (c.mode === 'guide') {
        const step = this.catStep(c.x, c.y, c.gx, c.gy);
        [tx, ty] = step ?? [c.gx, c.gy];
        speed = CATS.guideSpeed;
      } else {
        // Trot behind the one in front: her, or the other cat.
        const lead = i === 0 || this.cats[0]!.mode === 'guide' ? p : this.cats[0]!;
        const dx = c.x - lead.x;
        const dy = c.y - lead.y;
        const d = Math.hypot(dx, dy) || 1;
        tx = lead.x + (dx / d) * CATS.gap;
        ty = lead.y + (dy / d) * CATS.gap;
        speed = CATS.speed;
      }
      const dx = tx - c.x;
      const dy = ty - c.y;
      const d = Math.hypot(dx, dy);
      // Following, a cat stays put until it's a few px out of place, and slows as
      // it arrives, rather than darting a px at a time after her. And it turns
      // round only when it's really heading the other way. Jonathan: while she
      // walked, the cats looked "blurry", flipping and stop-starting every frame.
      const arrived = c.mode === 'guide' ? Math.hypot(c.gx - c.x, c.gy - c.y) < 3 : d < (c.moving ? 1 : 6);
      c.moving = !arrived && d > 0.5;
      const was = c.x;
      if (c.moving) {
        const move = Math.min(d, speed * dt, Math.max(30, d * 6) * dt);
        c.x += (dx / d) * move;
        c.y += (dy / d) * move;
        c.still = 0;
      } else {
        c.still += dt;
      }
      c.vx += ((c.x - was) / dt - c.vx) * Math.min(1, dt * 8);
      if (c.vx * c.fx < -25) c.fx = -c.fx;
      if (c.poseTime > 0) return;
      if (c.moving) c.pose = 'walk';
      else if (c.mode === 'guide') {
        // Sitting by what it found, meowing until she comes over.
        c.pose = 'sit';
        c.fx = p.x < c.x ? -1 : 1;
        c.meowClock -= dt;
        if (c.meowClock <= 0 && Math.hypot(p.x - c.x, p.y - c.y) > CATS.near) {
          // Quicker and quicker the longer she stays put, as a real cat at the door would.
          const hurry = Math.max(0, this.roomTime - NUDGE.after) * 0.05;
          c.meowClock = Math.max(NUDGE.meowFastest, CATS.meowEvery - hurry) + (i ? 0.4 : 0);
          c.pose = 'meow';
          c.poseTime = 0.6;
          this.emit('meow', c.x, c.y, c.name, 0);
        }
      } else c.pose = c.still > CATS.purrAfter ? 'purr' : c.still > CATS.sitAfter ? 'sit' : 'walk';
    });
  }

  // --- Touching things ---------------------------------------------------------------------------------

  private touch(): void {
    const p = this.player;
    for (const k of this.pickups) {
      if (!k.alive || k.t < 0.25) continue;
      if (Math.hypot(k.x - p.x, k.y - p.y) > PLAYER.r + 10) continue;
      k.alive = false;
      if (k.tile >= 0) this.grid[Math.floor(k.tile / ROOM_COLS)]![k.tile % ROOM_COLS] = '.';
      if (k.kind === 'candy') p.candy += 1;
      else if (k.kind === 'heart') p.hearts = Math.min(p.maxHearts, p.hearts + 1);
      else {
        p.keys += 1;
        this.roomTime = 0;
        this.thoughtTime = 0;
      }
      if (k.kind !== 'candy') {
        p.mood = 'cheer';
        p.moodTime = 0.8;
      }
      this.emit('pickup', k.x, k.y, k.kind, p.candy);
    }

    // Gates: walk up to one with a key and the whole gate swings open. Generous:
    // standing next to it is enough, no need to press into it (a five-year-old
    // stops a step short and wonders why nothing happens; so did the bot).
    const reach = PLAYER.r + 12;
    for (const [ox, oy] of [[reach, 0], [-reach, 0], [0, reach], [0, -reach]] as const) {
      if (this.tileAt(p.x + ox, p.y + oy) !== 'L') continue;
      const c = Math.floor((p.x + ox) / TILE);
      const r = Math.floor((p.y + oy) / TILE);
      if (p.keys > 0) {
        p.keys -= 1;
        this.roomTime = 0;
        this.thoughtTime = 0;
        this.openGate(c, r);
        this.emit('gate', (c + 0.5) * TILE, (r + 0.5) * TILE, '', 0);
      } else if (this.time - this.lastLocked > 2) {
        this.lastLocked = this.time;
        this.think('key', THOUGHT.locked);
        this.emit('locked', (c + 0.5) * TILE, (r + 0.5) * TILE, '', 0);
      }
      break;
    }

    // The candy bowl: the end of the street.
    const near = PLAYER.r + 12;
    for (const [ox, oy] of [[0, -near], [0, near], [near, 0], [-near, 0]] as const) {
      if (this.tileAt(p.x + ox, p.y + oy) === 'B') {
        this.phase = 'bowl';
        this.phaseTime = 0;
        p.mood = 'cheer';
        p.moodTime = 99;
        // A shower of candy from the bowl.
        const c = Math.floor((p.x + ox) / TILE);
        const r = Math.floor((p.y + oy) / TILE);
        for (let k = 0; k < 20; k++) {
          const a = this.rng.range(0, Math.PI * 2);
          this.spawnPickup('candy', (c + 0.5) * TILE, (r + 0.5) * TILE, Math.cos(a) * 90, Math.sin(a) * 90);
        }
        p.candy += 20;
        this.emit('bowl', (c + 0.5) * TILE, (r + 0.5) * TILE, '', p.candy);
        return;
      }
    }

    if (p.safe > 0 || this.invincible) return;
    for (const m of this.monsters) {
      if (!m.alive) continue;
      if (Math.hypot(m.x - p.x, m.y - p.y) < MONSTERS[m.kind].r + PLAYER.r - 2) {
        this.spook(m.x, m.y, m.kind);
        return;
      }
    }
    for (const o of this.orbs) {
      if (!o.alive) continue;
      if (Math.hypot(o.x - p.x, o.y - p.y) < ORB.r + PLAYER.r - 1) {
        o.alive = false;
        this.spook(o.x, o.y, o.kind);
        return;
      }
    }
    const b = this.boss;
    if (b.phase === 'fight' && b.alpha > 0.5 && Math.hypot(b.x - p.x, b.y - p.y) < BOSSES[b.kind!].r * 0.8 + PLAYER.r) {
      this.spook(b.x, b.y, b.kind!, BOSS_TOUCH.knockback);
    }
  }
  private lastLocked = -10;

  private openGate(c: number, r: number): void {
    const grid = this.grid;
    const stack: [number, number][] = [[c, r]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      if (grid[y]?.[x] !== 'L') continue;
      grid[y]![x] = ':';
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }

  /** Something spooky touched her: a heart, a hop backwards, a moment of safety. */
  private spook(x: number, y: number, by: string, push = 1): void {
    const p = this.player;
    p.hearts -= 1;
    p.safe = PLAYER.safe;
    const dx = p.x - x;
    const dy = p.y - y;
    const d = Math.hypot(dx, dy) || 1;
    p.kx = (dx / d) * PLAYER.knockback * push;
    p.ky = (dy / d) * PLAYER.knockback * push;
    p.mood = 'spooked';
    p.moodTime = 0.8;
    for (const c of this.cats) {
      c.pose = 'startled';
      c.poseTime = 0.7;
    }
    this.emit('spooked', p.x, p.y, by, p.hearts);
    if (p.hearts <= 0) {
      this.phase = 'lost';
      this.phaseTime = 0;
      this.emit('lost', p.x, p.y, '', 0);
    }
  }

  /**
   * Out of hearts: start again at the door she came in by, with full hearts.
   * Everything she's cleared stays cleared; the room's monsters go back to
   * where they started, and a boss starts its fight again.
   */
  private respawn(): void {
    const p = this.player;
    p.maxHearts = PLAYER.hearts + HELP.extraHearts[Math.min(this.help, HELP.extraHearts.length - 1)]!;
    p.hearts = p.maxHearts;
    p.safe = PLAYER.safe;
    p.kx = p.ky = 0;
    p.mood = 'walk';
    p.moodTime = 0;
    this.enterRoom(this.rx, this.ry);
    p.x = p.prevX = this.entryX;
    p.y = p.prevY = this.entryY;
    this.placeCats();
    this.phase = 'play';
    this.emit('respawn', p.x, p.y, '', 0);
  }

  // --- Events ------------------------------------------------------------------------------------------

  private emit(kind: EventKind, x: number, y: number, tag: string, value: number): void {
    if (this.eventCount >= POOL.events) return;
    const e = this.events[this.eventCount++]!;
    e.kind = kind;
    e.x = x;
    e.y = y;
    e.tag = tag;
    e.value = value;
  }

  drainEvents(consume: (e: GameEvent) => void): void {
    for (let i = 0; i < this.eventCount; i++) consume(this.events[i]!);
    this.eventCount = 0;
  }
}
