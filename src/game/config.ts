/**
 * Every tuning number in the game lives in this file.
 *
 * Units: virtual pixels and seconds. Rooms are a grid of tiles; the simulation
 * works in pixels inside a room, with (0, 0) at the room's top-left corner, and
 * the renderer adds the room's position on screen. The street maps in
 * `streets.ts` are the one exception, as LEVELS are in the siblings: they are
 * data, not loose numbers.
 */

// --- Screen -----------------------------------------------------------------
// Same frame and export names as the siblings, so core/viewport.ts is a
// byte-identical copy. Landscape, rotated for her if the phone is upright.

export const DESIGN_W = 480;
export const VIRTUAL_H = 270;
export const MIN_VIRTUAL_W = DESIGN_W;
export const MAX_VIRTUAL_W = 640;
export const SCREEN = { w: DESIGN_W, h: VIRTUAL_H, rotated: false };
export const MAX_DPR = 2;

// --- Loop -------------------------------------------------------------------

export const FIXED_DT = 1 / 120;
export const MAX_FRAME_TIME = 0.25;

// --- Rooms ------------------------------------------------------------------

/**
 * A room is 16 x 9 tiles, the shape of a Zelda dungeon room squeezed to fit a
 * phone held sideways, with a strip above it for the hearts, keys and candy.
 * 26 px tiles make the whole room 416 x 234; on a wide phone the spare width
 * either side shows the neighbourhood at night.
 */
export const TILE = 26;
export const ROOM_COLS = 16;
export const ROOM_ROWS = 9;
export const ROOM_W = TILE * ROOM_COLS;
export const ROOM_H = TILE * ROOM_ROWS;
/** The HUD strip above the room. */
export const HUD_H = 32;

/** Seconds the screen takes to slide from one room to the next. */
export const ROOM_SLIDE = 0.5;

// --- The trick-or-treater ---------------------------------------------------

export const PLAYER = {
  /** px/s at full drag. About three and a half tiles a second. */
  speed: 94,
  /** Collision radius against walls and monsters. A bit smaller than she's drawn. */
  r: 8,
  /** Drawn height. */
  h: 34,
  hearts: 4,
  maxHearts: 6,
  /** Seconds of blinking safety after a spook. */
  safe: 1.6,
  /** How far a spook pushes her back, px/s, decaying. */
  knockback: 170,
};

/**
 * Drag anywhere to walk: a virtual joystick centred wherever the finger went
 * down. Under `dead` px is standing still; at `full` px she walks at full speed.
 * Relative, as in the siblings: the finger never has to be on her.
 */
export const STICK = { dead: 6, full: 30, drawR: 30 };

// --- Shooting ---------------------------------------------------------------

/**
 * Shots fire by themselves. Five-year-olds can drag OR press a button, rarely
 * both at once, so the game aims: at the nearest monster she can see within
 * `range`, else at the nearest thing in the way (a leaf pile, a cobweb, a
 * chest) within `obstacleRange`. With nothing to shoot, nothing fires.
 */
export const SHOT = {
  every: 0.3,
  speed: 250,
  range: 165,
  obstacleRange: 78,
  r: 5,
  damage: 1,
  /** Seconds a shot lives, so a miss fades instead of crossing the room. */
  life: 0.9,
};

// --- Monsters ------------------------------------------------------------------

export type MonsterKind = 'ghost' | 'bat' | 'pumpkin' | 'raccoon';

export interface MonsterSpec {
  hp: number;
  r: number;
  /** px/s. */
  speed: number;
  /** Starts chasing her within this distance. */
  notice: number;
  /** Candy it turns into when boo'd. */
  candy: number;
}

/**
 * Nobody is hurt, as in every game in the set: a monster she hits enough gets
 * "boo'd" (it turns happy, pops into candy, and floats off giggling).
 */
export const MONSTERS: Record<MonsterKind, MonsterSpec> = {
  /** Drifts towards her slowly, wobbling. Goes through nothing: walls stop it too. */
  ghost: { hp: 2, r: 10, speed: 30, notice: 150, candy: 2 },
  /** Flutters in zigzags, fast but fragile. */
  bat: { hp: 1, r: 8, speed: 66, notice: 170, candy: 1 },
  /** Hops towards her every so often. Tough. */
  pumpkin: { hp: 3, r: 11, speed: 70, notice: 140, candy: 3 },
  /** A Raccoon Bandit in a Halloween costume, hogging candy: dashes at her, then stops to giggle. */
  raccoon: { hp: 3, r: 10, speed: 110, notice: 130, candy: 4 },
};

/** Pumpkins hop this often, for this long. */
export const HOP = { every: 1.25, time: 0.35 };
/** Raccoons dash for this long, then rest (and tease) for this long. */
export const DASH = { time: 0.55, rest: 1.4 };

// --- Things in the way ---------------------------------------------------------

/** Hit points of the breakable tiles: a leaf pile, a cobweb, a hay bale. */
export const BREAKABLE_HP = { leaves: 1, web: 2, hay: 3 } as const;
/** A chest takes this many hits to pop open. */
export const CHEST_HP = 2;

// --- Bosses ----------------------------------------------------------------------

export type BossKind = 'pumpkin-king' | 'big-boo' | 'raccula';

export interface BossSpec {
  name: string;
  hp: number;
  r: number;
  /** Drawn size. */
  size: number;
  /** Seconds between attacks. */
  every: number;
  /** Movement speed, px/s. */
  speed: number;
  candy: number;
}

export const BOSSES: Record<BossKind, BossSpec> = {
  /** Hops round the room and spits pumpkin seeds in a ring. */
  'pumpkin-king': { name: 'The Pumpkin King', hp: 26, r: 22, size: 64, every: 2.2, speed: 80, candy: 15 },
  /** Floats, fades out, pops up somewhere else, and throws spooky orbs at her. */
  'big-boo': { name: 'Big Boo', hp: 34, r: 22, size: 66, every: 2, speed: 40, candy: 20 },
  /** A Raccoon Bandit dressed as a vampire, guarding the candy bowl. Swoops and sends bats. */
  raccula: { name: 'Count Raccula', hp: 44, r: 20, size: 62, every: 1.9, speed: 60, candy: 30 },
};

/** Boss projectiles: big, slow, bright. */
export const ORB = { speed: 80, r: 6, drawR: 8, life: 5 };

// --- Hocus and Pocus -------------------------------------------------------------

/**
 * The family's two black cats, walking along with whoever is playing. They
 * can't be hurt and don't fight; they're company, and guides: when there's a
 * key to find, Pocus runs to it and meows, and when she has a key and there's a
 * gate, Hocus runs to the gate.
 */
export const CATS = {
  /** How far behind the one in front each cat trots, px. */
  gap: 20,
  /** Top speed following, px/s (a little faster than her, so they keep up). */
  speed: 115,
  /** Running to show her something, px/s. */
  guideSpeed: 130,
  /** Seconds between meows while guiding and she's not close yet. */
  meowEvery: 3.2,
  /** She's "found it" (and the cat stops meowing) within this distance. */
  near: 46,
  /** Standing still this long, a cat sits; this long, it curls up and purrs. */
  sitAfter: 0.4,
  purrAfter: 5,
  /** Drawn height. */
  h: 22,
};

/**
 * Keeping her moving. Ellie's first play: "what do I do?", then a tree she
 * was sure was the candy bowl. So the game says what she's after, over and over,
 * gently:
 *  - a thought bubble over her head with the thing she wants (the candy bowl
 *    when a street starts, a key at a locked gate);
 *  - after `after` seconds in one room with nothing found there, Hocus and Pocus
 *    walk to the doorway towards whatever's next and meow, more often the
 *    longer she waits, and she thinks of what's next again every `rethink`.
 */
export const NUDGE = {
  after: 20,
  /** Seconds between working out the way again (it can change as she clears things). */
  reroute: 0.5,
  rethink: 12,
  /** Meows come quicker the longer she stays, down to this many seconds apart. */
  meowFastest: 1.6,
};

/** Seconds a thought bubble shows. */
export const THOUGHT = { start: 4.5, locked: 3.5, nudge: 4 };

// --- Help -----------------------------------------------------------------------

/**
 * Quiet help, as in Captain Ellie: every time she runs out of hearts on a
 * street, monsters drop hearts more often, and from the second time she gets an
 * extra heart. Reset when she reaches the candy bowl.
 */
export const HELP = {
  heartChance: [0.12, 0.25, 0.35, 0.45] as readonly number[],
  extraHearts: [0, 0, 1, 2] as readonly number[],
};

// --- Pools ------------------------------------------------------------------------

export const POOL = {
  shots: 32,
  orbs: 48,
  monsters: 24,
  pickups: 24,
  events: 128,
};
