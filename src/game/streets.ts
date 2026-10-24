/**
 * The streets: little Zelda dungeons made of rooms, drawn as text.
 *
 * Each room is 16 x 9 characters. Doorways are NOT drawn: wherever a room has a
 * neighbour, `doorways()` cuts the gap in the edge (rows 3-5 on the left and
 * right, columns 7-8 at the top and bottom), so a door always lines up with the
 * door on the other side. Everything else on the edge is whatever the map says,
 * and verify() checks it's solid, so nobody can walk off the map.
 *
 * Jonathan's second round: "the levels need to be longer. Maybe up to 3 keys.
 * This way it is a bit easier to get lost... the exploration matters", and
 * "some rooms slightly different (like a house) so that mentally you lay out
 * the map in your head with more markers". So each street now has side paths,
 * dead ends with treats, loops, rooms of different kinds (`theme`), and a
 * one-of-a-kind landmark in most yards (a scarecrow, the well, the fountain).
 *
 *   .  grass (or floorboards indoors)     :  path (a carpet runner indoors)
 *   ,  porch boards        #  hedge (a wall indoors)       T  tree
 *   F  fence               W  house wall                   G  gravestone
 *   J  jack-o'-lantern
 *   l  leaf pile    w  cobweb    h  hay bale       (shoot to clear)
 *   L  locked gate (a key opens the whole gate)
 *   X  chest (the room's `chest` says what's inside)
 *   k  key   +  heart   c  candy   B  the candy bowl (the end of the street)
 *   S  where she starts
 *   g  ghost   b  bat   p  pumpkin   r  costumed raccoon   Z  the boss
 *
 * Landmarks (solid):   1 scarecrow   2 well   3 inflatable ghost   4 wheelbarrow
 *                      5 fountain    6 bench  7 spider mailbox    8 swing set
 * Furniture (solid):   C couch   Q bookshelf   E fireplace   Y table
 *                      U grandfather clock   A armchair   V cauldron
 * Furniture (walk on): R rug
 */

import type { BossKind } from './config';

/** What kind of place a room is: how its ground and walls are drawn. */
export type Theme = 'yard' | 'graveyard' | 'patch' | 'house';

export interface RoomSpec {
  /** Grid position in the street. (0, 0) is the top-left. */
  at: readonly [number, number];
  tiles: readonly string[];
  /** Yard if not given. */
  theme?: Theme;
  /** What the chest in this room holds. */
  chest?: 'key' | 'heart' | 'candy';
  boss?: BossKind;
  /**
   * Sides with a neighbour but NO doorway. Two rooms side by side get a door
   * automatically, and sometimes that door would walk round a gate: both rooms
   * must list the shared side (verify() checks they agree).
   */
  closed?: readonly Dir[];
}

export interface Street {
  id: number;
  name: string;
  /** Night-sky colours behind the rooms. */
  sky: readonly [string, string];
  rooms: readonly RoomSpec[];
}

/** The boss rooms and porches are the same shape on every street. */
function bossRoom(at: readonly [number, number], boss: BossKind, decor: string, theme: Theme = 'yard'): RoomSpec {
  const d = decor;
  return {
    at,
    boss,
    theme,
    tiles: [
      '################',
      `#${d}............${d}#`,
      `#...${d}......${d}...#`,
      '#..............#',
      '#.......Z......#',
      '#..............#',
      `#...${d}......${d}...#`,
      `#${d}............${d}#`,
      '################',
    ],
  };
}

function porch(at: readonly [number, number], decor: string): RoomSpec {
  return {
    at,
    tiles: [
      'WWWWWWWWWWWWWWWW',
      'WWWWWWWWWWWWWWWW',
      'WWWW,,,,,,,,WWWW',
      `#${decor}..,,,B,,,,..${decor}#`,
      '#...,,,,,,,,...#',
      '#..............#',
      '#.T..........T.#',
      '#..............#',
      '################',
    ],
  };
}

export const STREETS: readonly Street[] = [
  {
    // The first street, after Ellie's first play ("what do I do?"): four rooms
    // in a straight line, one lesson each. A ghost to boo, a key on the path, a
    // gate to open with it, and the candy bowl. No boss, nowhere to get lost.
    id: 0,
    name: 'Candy Corner',
    sky: ['#1c1238', '#44235e'],
    rooms: [
      {
        at: [0, 0],
        tiles: [
          '################',
          '#T..J......J..T#',
          '#..............#',
          '#..............#',
          '#S::::::::::g::#',
          '#..............#',
          '#..............#',
          '#T..J......J..T#',
          '################',
        ],
      },
      {
        at: [1, 0],
        tiles: [
          '################',
          '#T....T..T....T#',
          '#..............#',
          '#..............#',
          '#:::::::k::::::#',
          '#..............#',
          '#..............#',
          '#T....T..T....T#',
          '################',
        ],
      },
      {
        at: [2, 0],
        tiles: [
          '################',
          '#T......F.....T#',
          '#.......F......#',
          '#.......L......#',
          '#:::::::L::::::#',
          '#.......L......#',
          '#.......F......#',
          '#T......F.....T#',
          '################',
        ],
      },
      porch([3, 0], 'J'),
    ],
  },
  {
    // 12 rooms, 2 keys: one in the back yard up north, one inside the house.
    id: 1,
    name: 'Pumpkin Lane',
    sky: ['#1a1033', '#3b1f5c'],
    rooms: [
      {
        // The first room teaches shooting: the leaves are the only way through.
        at: [0, 2],
        tiles: [
          '################',
          '#T..T...#..T...#',
          '#.......#...7..#',
          '#S:::::.l::::::#',
          '#.......l......#',
          '#..J....l......#',
          '#.......#...g..#',
          '#T...T..#.T..T.#',
          '################',
        ],
      },
      {
        // The crossroads with the fountain.
        at: [1, 2],
        tiles: [
          '################',
          '#T.....::.....T#',
          '#......::......#',
          '#::::::::::::::#',
          '#::..5.....p.::#',
          '#::::::::::::::#',
          '#......::......#',
          '#T..b..::....T.#',
          '################',
        ],
      },
      {
        // The back yard with the swing set: the first key, wrapped in cobwebs.
        at: [1, 1],
        chest: 'key',
        tiles: [
          '################',
          '#T..8.....T..T.#',
          '#..............#',
          '#..T....b...T..#',
          '#.....wXw......#',
          '#......w.......#',
          '#.T..........T.#',
          '#..g...::......#',
          '################',
        ],
      },
      {
        // A pumpkin patch: a dead end, but there's a heart and candy in the hay.
        at: [1, 3],
        theme: 'patch',
        tiles: [
          '################',
          '#J.....::.....J#',
          '#..............#',
          '#.4..p.....p...#',
          '#..............#',
          '#.hhh......hhh.#',
          '#.h+h..r...hch.#',
          '#..............#',
          '################',
        ],
      },
      {
        // The first gate.
        at: [2, 2],
        tiles: [
          '################',
          '#..T.....F..T..#',
          '#........F.....#',
          '#::::::::L:::::#',
          '#::::g:::L:::::#',
          '#::::::::L:::::#',
          '#........F.....#',
          '#..T.....F..T..#',
          '################',
        ],
      },
      {
        // The second crossroads, with the bench.
        at: [3, 2],
        tiles: [
          '################',
          '#T...6.::....T.#',
          '#......::......#',
          '#::::::::::::::#',
          '#..r........b..#',
          '#::::::::::::::#',
          '#......::......#',
          '#T.....::.....T#',
          '################',
        ],
      },
      {
        // The front yard of a house, with an inflatable ghost and a well.
        at: [3, 1],
        tiles: [
          'WWWWWWWWWWWWWWWW',
          'WWWWWWW,,WWWWWWW',
          'WWWW,,,,,,,,WWWW',
          '#J..,,,,,,,,..J#',
          '#..............#',
          '#..3.......2...#',
          '#..............#',
          '#T.....::.....T#',
          '################',
        ],
      },
      {
        // Inside the house: the second key, by the fireplace.
        at: [3, 0],
        theme: 'house',
        chest: 'key',
        tiles: [
          '################',
          '#QQ....EE....QU#',
          '#..............#',
          '#..A.RR...CC...#',
          '#....RR....g...#',
          '#..Y.......X...#',
          '#..........V...#',
          '#......::......#',
          '################',
        ],
      },
      {
        // A side garden: a hay maze with candy and a heart.
        at: [3, 3],
        tiles: [
          '################',
          '#hh....::....hh#',
          '#h..hh....hh..h#',
          '#..h..h..h..h..#',
          '#.h..c.hh.+..h.#',
          '#..h........h..#',
          '#h..hh....hh..h#',
          '#hh...b......hh#',
          '################',
        ],
      },
      {
        // The second gate, by the old gravestones.
        at: [4, 2],
        tiles: [
          '################',
          '#G.....F......G#',
          '#......F.......#',
          '#::::::L:::::::#',
          '#::g:::L:::b:::#',
          '#::::::L:::::::#',
          '#......F.......#',
          '#G.....F......G#',
          '################',
        ],
      },
      bossRoom([5, 2], 'pumpkin-king', 'J'),
      porch([6, 2], 'J'),
    ],
  },
  {
    // 12 rooms, 3 keys: a graveyard, an old church you go inside, and a pond garden.
    // The keys come in order: graveyard, church, pond garden.
    id: 2,
    name: 'Spooky Hollow',
    sky: ['#0f1a2e', '#24324f'],
    rooms: [
      {
        at: [0, 1],
        theme: 'graveyard',
        tiles: [
          '################',
          '#G...G....G...G#',
          '#..............#',
          '#S::::::::::w::#',
          '#......g....w..#',
          '#...........w..#',
          '#.G...G.....G..#',
          '#..............#',
          '################',
        ],
      },
      {
        // The hub, with the spider mailbox.
        at: [1, 1],
        theme: 'graveyard',
        tiles: [
          '################',
          '#T.....::.....T#',
          '#..b...::...7..#',
          '#::::::::::::::#',
          '#..G...::...G..#',
          '#::::::::::::::#',
          '#......::......#',
          '#T.....::.....T#',
          '################',
        ],
      },
      {
        // The old well, and the first key in a nest of cobwebs.
        at: [1, 0],
        theme: 'graveyard',
        chest: 'key',
        tiles: [
          '################',
          '#GG..G....G..GG#',
          '#G...wwww.....G#',
          '#....wwXw.....G#',
          '#....wwww..g...#',
          '#..2...........#',
          '#G............G#',
          '#GG....::....GG#',
          '################',
        ],
      },
      {
        // A misty dead end with a bench, a heart and candy.
        at: [1, 2],
        theme: 'graveyard',
        tiles: [
          '################',
          '#......::......#',
          '#.G..6.....G...#',
          '#....r.........#',
          '#.hhh.....w.c..#',
          '#.h+h.....w....#',
          '#.....G.....G..#',
          '#..............#',
          '################',
        ],
      },
      {
        // Gate 1.
        at: [2, 1],
        theme: 'graveyard',
        tiles: [
          '################',
          '#G.....F.....G.#',
          '#......F.......#',
          '#::::::L:::::::#',
          '#::g:::L:::b:::#',
          '#::::::L:::::::#',
          '#......F.......#',
          '#G.....F.....G.#',
          '################',
        ],
      },
      {
        // The churchyard: the church door to the north, a gate south.
        at: [3, 1],
        theme: 'graveyard',
        tiles: [
          'WWWWWWWWWWWWWWWW',
          'WWWWWWW,,WWWWWWW',
          '#G..,,,,,,,,..G#',
          '#::::::::::::::#',
          '#..p...::...p..#',
          '#::::::::::::::#',
          '#.G....::....G.#',
          '#......::......#',
          '################',
        ],
      },
      {
        // Inside the old church: pews, candles, and the second key.
        at: [3, 0],
        theme: 'house',
        chest: 'key',
        tiles: [
          '################',
          '#Q.U..EEEE..U.Q#',
          '#..............#',
          '#.CC.CC..CC.CC.#',
          '#..............#',
          '#.CC.CC..CC.CC.#',
          '#....X....g....#',
          '#......RR......#',
          '################',
        ],
      },
      {
        // Gate 2, just inside the door from the churchyard.
        at: [3, 2],
        tiles: [
          '################',
          '#FFFFFFLLFFFFFF#',
          '#..............#',
          '#.T....::....T.#',
          '#..b...::......#',
          '#......::...g..#',
          '#.G....::....G.#',
          '#......::......#',
          '################',
        ],
      },
      {
        // The pond garden, with the fountain and the swing set: the third key,
        // and the way on, east. Keys open any gate (as in Zelda), so the path to
        // the boss runs THROUGH here: with gate 3 off the churchyard, the church
        // key opened it and the pond garden was skipped.
        at: [3, 3],
        chest: 'key',
        tiles: [
          '################',
          '#T.....::.....T#',
          '#..............#',
          '#...5......h...#',
          '#.........hXh..#',
          '#..g.......h...#',
          '#.8............#',
          '#T............T#',
          '################',
        ],
      },
      {
        // Gate 3, before the boss.
        at: [4, 3],
        theme: 'graveyard',
        tiles: [
          '################',
          '#G.....F......G#',
          '#..b...F.......#',
          '#::::::L:::::::#',
          '#::::::L::r::::#',
          '#::::::L:::::::#',
          '#......F.......#',
          '#G.....F......G#',
          '################',
        ],
      },
      bossRoom([5, 3], 'big-boo', 'G', 'graveyard'),
      porch([6, 3], 'G'),
    ],
  },
  {
    // 15 rooms, 3 keys, and it ends INSIDE the haunted mansion: foyer, library,
    // hallway, the ballroom (Count Raccula), and the candy bowl in the dining room.
    id: 3,
    name: 'Haunted Hill',
    sky: ['#120a24', '#3a1240'],
    rooms: [
      {
        // The cobwebs are the only way on.
        at: [0, 2],
        tiles: [
          '################',
          '#T..T.....T..T.#',
          '#..............#',
          '#S::::::::::::w#',
          '#.......b.....w#',
          '#..1..........w#',
          '#..J.......J...#',
          '#T...T...T...T.#',
          '################',
        ],
      },
      {
        // The crossroads, with the spider mailbox.
        at: [1, 2],
        tiles: [
          '################',
          '#T.....::.....T#',
          '#..r...::......#',
          '#::::::::::::::#',
          '#..7...........#',
          '#::::::::::::::#',
          '#......p.......#',
          '#T.....::.....T#',
          '################',
        ],
      },
      {
        // A cobweb maze on the way up.
        at: [1, 1],
        theme: 'graveyard',
        tiles: [
          '################',
          '#ww....::....ww#',
          '#w.w..wwww..w.w#',
          '#..w.......w...#',
          '#..w..g..b.w...#',
          '#..wwww.wwww...#',
          '#......w.......#',
          '#ww....::....ww#',
          '################',
        ],
      },
      {
        // The inflatable ghost, and the first key.
        at: [1, 0],
        theme: 'graveyard',
        chest: 'key',
        tiles: [
          '################',
          '#GG..G....G..GG#',
          '#G............G#',
          '#....g..X..g...#',
          '#..............#',
          '#.G..3.....G...#',
          '#G............G#',
          '#GG....::....GG#',
          '################',
        ],
      },
      {
        // A dead end: the wheelbarrow, and treats in the hay.
        at: [1, 3],
        theme: 'patch',
        tiles: [
          '################',
          '#......::......#',
          '#.hhh......hhh.#',
          '#.hch..4...h+h.#',
          '#.h.h......h.h.#',
          '#.....b........#',
          '#..T........T..#',
          '#..............#',
          '################',
        ],
      },
      {
        // Gate 1.
        at: [2, 2],
        tiles: [
          '################',
          '#T.....F......T#',
          '#......F.......#',
          '#::::::L:::::::#',
          '#::::::L::r::::#',
          '#::::::L:::::::#',
          '#......F.......#',
          '#T.....F......T#',
          '################',
        ],
      },
      {
        // The top of the hill: the bench, and paths every way.
        at: [3, 2],
        tiles: [
          '################',
          '#J.....::.....J#',
          '#..b...::...b..#',
          '#::::::::::::::#',
          '#.....6........#',
          '#::::::::::::::#',
          '#..p...::...p..#',
          '#J.....::.....J#',
          '################',
        ],
      },
      {
        // The scarecrow field: a dead end, but candy (and lots of scarecrows).
        // Its east side is the mansion's wall: no door.
        at: [3, 1],
        closed: ['e'],
        tiles: [
          '################',
          '#..T........T..#',
          '#....1....1....#',
          '#..g...........#',
          '#.......1....r.#',
          '#....1.........#',
          '#..T....c...T..#',
          '#......::......#',
          '################',
        ],
      },
      {
        // The pumpkin patch: the second key, in a ring of hay.
        at: [3, 3],
        theme: 'patch',
        chest: 'key',
        tiles: [
          '################',
          '#J.....::.....J#',
          '#..............#',
          '#.J..J..J..J...#',
          '#......hhh.....#',
          '#..p...hXh..p..#',
          '#......hhh.....#',
          '#.J..J....J..J.#',
          '################',
        ],
      },
      {
        // The mansion's front yard: gate 2 is the front door.
        at: [4, 2],
        tiles: [
          'WWWWWWWWWWWWWWWW',
          'WWWWWWWLLWWWWWWW',
          '#J..,,,,,,,,..J#',
          '#::::,,,,,,,...#',
          '#..g.........5.#',
          '#::::::::......#',
          '#T....2......T.#',
          '#..............#',
          '################',
        ],
      },
      {
        // The foyer. Its west wall backs onto the scarecrow field.
        at: [4, 1],
        theme: 'house',
        closed: ['w'],
        tiles: [
          '################',
          '#Q..U..::..U..Q#',
          '#..............#',
          '#A.....RR......#',
          '#......RR..g...#',
          '#C.............#',
          '#..Y........V..#',
          '#......::......#',
          '################',
        ],
      },
      {
        // The library: the third key.
        at: [4, 0],
        theme: 'house',
        chest: 'key',
        tiles: [
          '################',
          '#QQQQ.QQQQ.QQQQ#',
          '#..............#',
          '#.QQ..A..X..QQ.#',
          '#..............#',
          '#.QQ.....g..QQ.#',
          '#....RR..RR....#',
          '#......::......#',
          '################',
        ],
      },
      {
        // The long hallway: gate 3, a banister across it.
        at: [5, 1],
        theme: 'house',
        tiles: [
          '################',
          '#U.Q..Q..F..Q.U#',
          '#........F.....#',
          '#::::::::L:::::#',
          '#::g:::::L::b::#',
          '#::::::::L:::::#',
          '#........F.....#',
          '#.A..E...F..E..#',
          '################',
        ],
      },
      {
        // The ballroom, where Count Raccula waits.
        at: [6, 1],
        theme: 'house',
        boss: 'raccula',
        tiles: [
          '################',
          '#U.....::.....U#',
          '#..V........V..#',
          '#..............#',
          '#.......Z......#',
          '#..............#',
          '#..RR......RR..#',
          '#Q............Q#',
          '################',
        ],
      },
      {
        // The dining room, and the biggest candy bowl on the hill.
        at: [6, 0],
        theme: 'house',
        tiles: [
          '################',
          '#QU..EEEE....UQ#',
          '#..............#',
          '#...YYY.B.YYY..#',
          '#..............#',
          '#..A........A..#',
          '#..............#',
          '#......RR......#',
          '################',
        ],
      },
    ],
  },
];

// --- Tiles --------------------------------------------------------------------------

/** Tiles nobody can walk through. Gates and breakables are solid until cleared. */
export const SOLID = new Set([
  '#', 'T', 'F', 'W', 'G', 'J', 'l', 'w', 'h', 'L', 'X', 'B',
  '1', '2', '3', '4', '5', '6', '7', '8',
  'C', 'Q', 'E', 'Y', 'U', 'A', 'V',
]);
/** Tiles a shot stops at. Same as solid, minus the low things a star flies over. */
export const BLOCKS_SHOTS = new Set(['#', 'T', 'W', 'l', 'w', 'h', 'L', 'X', 'G', '1', '2', '3', '5', '8', 'Q', 'E', 'U', 'V']);

export type Dir = 'n' | 's' | 'e' | 'w';
export const DIRS: Record<Dir, readonly [number, number]> = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

/** Doorway tiles on each edge. */
export const DOOR_ROWS = [3, 4, 5] as const;
export const DOOR_COLS = [7, 8] as const;

export function roomAt(street: Street, x: number, y: number): RoomSpec | undefined {
  return street.rooms.find((r) => r.at[0] === x && r.at[1] === y);
}

/**
 * A room's tiles with its doorways cut: a fresh, mutable grid, row by row. The
 * game breaks leaves and opens gates in this copy, never in the map.
 */
export function buildRoom(street: Street, room: RoomSpec): string[][] {
  const grid = room.tiles.map((row) => row.split(''));
  if (hasDoor(street, room, 'w')) for (const r of DOOR_ROWS) grid[r]![0] = ':';
  if (hasDoor(street, room, 'e')) for (const r of DOOR_ROWS) grid[r]![grid[r]!.length - 1] = ':';
  if (hasDoor(street, room, 'n')) for (const c of DOOR_COLS) grid[0]![c] = ':';
  if (hasDoor(street, room, 's')) for (const c of DOOR_COLS) grid[grid.length - 1]![c] = ':';
  return grid;
}

/** Is there a doorway on this side: a neighbour, and the side not closed? */
export function hasDoor(street: Street, room: RoomSpec, dir: Dir): boolean {
  const [dx, dy] = DIRS[dir];
  return !!roomAt(street, room.at[0] + dx, room.at[1] + dy) && !(room.closed ?? []).includes(dir);
}

export function streetById(id: number): Street {
  return STREETS.find((s) => s.id === id) ?? STREETS[0]!;
}

/**
 * Candy Corner and Pumpkin Lane are always open (Pumpkin Lane was the first
 * street before Candy Corner was added, and kids who'd played it shouldn't find
 * it locked); reaching a candy bowl opens the next.
 */
export function isStreetUnlocked(done: Record<number, number>, id: number): boolean {
  return id <= 1 || (done[id - 1] ?? 0) > 0;
}
