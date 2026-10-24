/**
 * Contracts, run by hand in the dev console:
 *
 *     __game.verify()
 *
 * The worst bug this game could have is a street that can't be finished, found
 * by a car full of kids with no signal and no grown-up who can fix it. So the
 * maps are checked here, not just looked at:
 *
 *  - every room is 16 x 9, its edge solid except its doorways, and two rooms
 *    that close a shared side both close it;
 *  - every street has one start and one candy bowl, every boss room a boss
 *    marker, and every chest a room that says what's in it (and the reverse);
 *  - **every street can be finished**: from the start, clearing everything
 *    shootable and picking up every key in reach, there are always enough keys
 *    for the next gate, until the candy bowl is reachable. And no key is wasted:
 *    keys found equal gates.
 *
 * Then the simulation: a bot plays every street with each kid and must reach
 * the candy bowl.
 */

import { ROOM_COLS, ROOM_ROWS, ROOM_W, ROOM_H, HUD_H, VIRTUAL_H, TILE } from '../game/config';
import { CHARACTERS } from '../game/content';
import { GameState } from '../game/state';
import { DIRS, SOLID, STREETS, buildRoom, hasDoor, roomAt, type Dir, type Street } from '../game/streets';

interface Result {
  check: string;
  ok: boolean;
  detail: string;
}

/** Things she can get past by shooting them. */
const SHOOTABLE = new Set(['l', 'w', 'h']);

/**
 * Can this street be finished? A flood over every walkable tile of every room
 * (breakables count as walkable, since she can shoot them), opening one gate
 * whenever a spare key is in hand, until the bowl is in reach or nothing changes.
 */
function solve(street: Street): { ok: boolean; keys: number; gates: number; note: string } {
  const grids = new Map(street.rooms.map((r) => [`${r.at[0]},${r.at[1]}`, buildRoom(street, r)]));
  const start = street.rooms.find((r) => r.tiles.some((row) => row.includes('S')))!;
  let keys = 0;
  let gates = 0;
  const taken = new Set<string>();
  const walkable = (t: string): boolean => !SOLID.has(t) || SHOOTABLE.has(t);
  for (let round = 0; round < 20; round++) {
    // Flood from the start.
    const seen = new Set<string>();
    const sr = start.tiles.findIndex((row) => row.includes('S'));
    const stack: [number, number, number, number][] = [[start.at[0], start.at[1], start.tiles[sr]!.indexOf('S'), sr]];
    const touching = new Set<string>(); // solid tiles next to reachable ground: chests, gates, the bowl
    while (stack.length) {
      const [rx, ry, c, r] = stack.pop()!;
      const key = `${rx},${ry},${c},${r}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const grid = grids.get(`${rx},${ry}`)!;
      const t = grid[r]![c]!;
      if (t === 'k' && !taken.has(key)) {
        taken.add(key);
        keys++;
      }
      for (const [dx, dy] of Object.values(DIRS)) {
        let nx = c + dx;
        let ny = r + dy;
        let nrx = rx;
        let nry = ry;
        if (nx < 0 || ny < 0 || nx >= ROOM_COLS || ny >= ROOM_ROWS) {
          // Off the edge: only through a doorway, into the neighbour.
          if (!roomAt(street, rx + dx, ry + dy)) continue;
          nrx = rx + dx;
          nry = ry + dy;
          nx = (nx + ROOM_COLS) % ROOM_COLS;
          ny = (ny + ROOM_ROWS) % ROOM_ROWS;
        }
        const ng = grids.get(`${nrx},${nry}`)!;
        const nt = ng[ny]![nx]!;
        if (walkable(nt)) stack.push([nrx, nry, nx, ny]);
        else touching.add(`${nrx},${nry},${nx},${ny}`);
      }
    }
    // Chests next to reachable ground: open them.
    let changed = false;
    for (const k of touching) {
      const [rx, ry, c, r] = k.split(',').map(Number) as [number, number, number, number];
      const grid = grids.get(`${rx},${ry}`)!;
      const t = grid[r]![c]!;
      if (t === 'B') return { ok: keys === gates, keys, gates, note: keys === gates ? 'bowl reached' : `bowl reached, but ${keys - gates} key(s) never needed` };
      if (t === 'X') {
        grid[r]![c] = 'O';
        if (roomAt(street, rx, ry)!.chest === 'key') keys++;
        changed = true;
      }
    }
    if (changed) continue;
    // A spare key: open a gate in reach.
    if (keys > gates) {
      for (const k of touching) {
        const [rx, ry, c, r] = k.split(',').map(Number) as [number, number, number, number];
        const grid = grids.get(`${rx},${ry}`)!;
        if (grid[r]![c] !== 'L') continue;
        const fill: [number, number][] = [[c, r]];
        while (fill.length) {
          const [x, y] = fill.pop()!;
          if (grid[y]?.[x] !== 'L') continue;
          grid[y]![x] = ':';
          fill.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
        gates++;
        changed = true;
        break;
      }
    }
    if (!changed) return { ok: false, keys, gates, note: `stuck with ${keys} key(s) and ${gates} gate(s) opened` };
  }
  return { ok: false, keys, gates, note: 'ran out of rounds' };
}

/**
 * A simple bot: walks towards the next thing that matters (a key, a chest, a
 * gate it can open, a boss, the next room towards the bowl), letting the
 * auto-fire do the rest. Pathfinding is a breadth-first search over tiles of
 * the current room plus a search over rooms; it's slow and simple and fine.
 */
export function playStreet(street: Street, kid: (typeof CHARACTERS)[number]['id'], seconds = 900): { result: string; t: number; candy: number; losses: number } {
  const s = new GameState();
  s.load(street, kid);
  s.begin();
  let t = 0;
  let losses = 0;
  const dt = 1 / 120;
  let stuckFor = 0;
  let lastRoom = '';
  while (t < seconds && s.phase !== 'bowl') {
    if (s.phase === 'lost') {
      if (s.phaseTime === 0) losses++;
    }
    if (Math.floor(t * 30) !== Math.floor((t - dt) * 30)) {
      const [gx, gy] = botTarget(s);
      const dx = gx - s.player.x;
      const dy = gy - s.player.y;
      const d = Math.hypot(dx, dy);
      s.setStick(d > 3 ? dx / d : 0, d > 3 ? dy / d : 0);
      // She only shoots what's in front of her, so part of every second the bot
      // turns to the nearest monster (or the boss) and edges towards it.
      const fight = bossStick(s);
      const foe = nearestFoe(s);
      if (fight) s.setStick(fight[0], fight[1]);
      else if (foe && t % 1 < 0.45) {
        const fx = foe[0] - s.player.x;
        const fy = foe[1] - s.player.y;
        const fd = Math.hypot(fx, fy) || 1;
        s.setStick((fx / fd) * 0.15, (fy / fd) * 0.15);
      }
    }
    s.update(dt);
    s.drainEvents((e) => {
      if (e.kind === 'lost') losses++;
    });
    t += dt;
    const room = `${s.rx},${s.ry}`;
    if (room !== lastRoom) {
      lastRoom = room;
      stuckFor = 0;
    } else stuckFor += dt;
    if (stuckFor > 120) break;
  }
  return { result: s.phase === 'bowl' ? 'bowl' : `stuck in room ${s.rx},${s.ry}`, t, candy: s.player.candy, losses };
}

/**
 * A boss fight, played the way the new aiming asks: step out of the way of
 * anything close (an orb heading her way, the boss itself), otherwise turn to
 * face the boss with a nudge of the stick, then stand and shoot, walking in
 * only if it's far off. Null when there's no fight on.
 */
function bossStick(s: GameState): [number, number] | null {
  const b = s.boss;
  if (b.phase !== 'fight') return null;
  const p = s.player;
  // Danger first: the nearest orb that's coming closer, or the boss on top of her.
  let ax = 0;
  let ay = 0;
  for (const o of s.orbs) {
    if (!o.alive) continue;
    const dx = p.x - o.x;
    const dy = p.y - o.y;
    const d = Math.hypot(dx, dy);
    if (d > 60 || dx * o.vx + dy * o.vy <= 0) continue;
    // Sideways to its path, whichever side she's already on.
    const side = Math.sign(dx * -o.vy + dy * o.vx) || 1;
    ax += (-o.vy * side) / (d + 1);
    ay += (o.vx * side) / (d + 1);
  }
  for (const m of s.monsters) {
    if (!m.alive) continue;
    const dx = p.x - m.x;
    const dy = p.y - m.y;
    const d = Math.hypot(dx, dy);
    if (d < 40) {
      ax += (dx / (d + 1)) * 60;
      ay += (dy / (d + 1)) * 60;
    }
  }
  const bdx = p.x - b.x;
  const bdy = p.y - b.y;
  const bd = Math.hypot(bdx, bdy) || 1;
  if (bd < 75 || b.swoop !== 'none') {
    ax += (bdx / bd) * 3;
    ay += (bdy / bd) * 3;
  }
  // Keep off the walls: a dodge into a corner is no dodge.
  const cx = ROOM_W / 2 - p.x;
  const cy = ROOM_H / 2 - p.y;
  const a = Math.hypot(ax, ay);
  if (a > 0.001) {
    const k = Math.hypot(cx, cy) > 120 ? 0.4 / Math.hypot(cx, cy) : 0;
    return [ax / a + cx * k, ay / a + cy * k];
  }
  // Safe: face the boss, then stand and shoot.
  const facing = (-bdx * p.fx + -bdy * p.fy) / bd;
  if (facing < 0.9) return [(-bdx / bd) * 0.05, (-bdy / bd) * 0.05];
  if (bd > 140) return [-bdx / bd, -bdy / bd];
  return [0, 0];
}

/** The nearest monster or boss worth turning to, or null. */
function nearestFoe(s: GameState): [number, number] | null {
  const p = s.player;
  let best: [number, number] | null = null;
  let bestD = 200;
  for (const m of s.monsters) {
    if (!m.alive) continue;
    const d = Math.hypot(m.x - p.x, m.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = [m.x, m.y];
    }
  }
  const b = s.boss;
  if (b.phase === 'fight' && b.alpha > 0.5 && Math.hypot(b.x - p.x, b.y - p.y) < 240) return [b.x, b.y];
  return best;
}

/** Where the bot wants to walk to next, in room pixels. */
export function botTarget(s: GameState): [number, number] {
  const grid = s.grid;
  const p = s.player;
  const pc = Math.floor(p.x / TILE);
  const pr = Math.floor(p.y / TILE);
  // Wanted tiles in this room, in order of importance.
  const want = (t: string): number => {
    if (t === 'B') return 1;
    if (t === 'k') return 2;
    if (t === 'X') return 3;
    if (t === 'L' && p.keys > 0) return 4;
    return 0;
  };
  // Monsters and a boss come to her; she just keeps her distance from the boss.
  // BFS from her tile; breakables count as passable (the auto-fire clears them).
  const passable = (c: number, r: number): boolean => {
    const t = grid[r]?.[c];
    if (t === undefined) return false;
    return !SOLID.has(t) || SHOOTABLE.has(t);
  };
  const prev = new Map<number, number>();
  const queue: number[] = [pr * ROOM_COLS + pc];
  prev.set(queue[0]!, -1);
  let goal = -1;
  let goalRank = 99;
  const exits: number[] = [];
  while (queue.length) {
    const i = queue.shift()!;
    const c = i % ROOM_COLS;
    const r = Math.floor(i / ROOM_COLS);
    if (c === 0 || r === 0 || c === ROOM_COLS - 1 || r === ROOM_ROWS - 1) exits.push(i);
    for (const [dx, dy] of Object.values(DIRS)) {
      const nc = c + dx;
      const nr = r + dy;
      if (nc < 0 || nr < 0 || nc >= ROOM_COLS || nr >= ROOM_ROWS) continue;
      const ni = nr * ROOM_COLS + nc;
      if (prev.has(ni)) continue;
      const rank = want(grid[nr]![nc]!);
      if (rank && rank < goalRank) {
        goalRank = rank;
        goal = i; // stand next to it
      }
      if (!passable(nc, nr)) continue;
      prev.set(ni, i);
      queue.push(ni);
    }
  }
  // A boss: stay at a middling distance and circle.
  const b = s.boss;
  if (b.phase === 'fight' || b.phase === 'intro') {
    const a = s.time * 0.8;
    return [b.x + Math.cos(a) * 95, b.y + Math.sin(a) * 70];
  }
  // A key or heart lying about (dropped from a chest or a boss): along the
  // search's path, not straight at it, which can wedge her on a gravestone.
  for (const k of s.pickups) {
    if (!k.alive || k.kind === 'candy') continue;
    const at = Math.floor(k.y / TILE) * ROOM_COLS + Math.floor(k.x / TILE);
    if (at === pr * ROOM_COLS + pc) return [k.x, k.y];
    if (prev.has(at)) {
      goal = at;
      break;
    }
  }
  if (goal < 0) {
    // Nothing here: head for the exit towards the next room that matters.
    const next = nextRoom(s);
    if (next) {
      const [dx, dy] = DIRS[next];
      let best = -1;
      for (const i of exits) {
        const c = i % ROOM_COLS;
        const r = Math.floor(i / ROOM_COLS);
        if ((dx === 1 && c === ROOM_COLS - 1) || (dx === -1 && c === 0) || (dy === 1 && r === ROOM_ROWS - 1) || (dy === -1 && r === 0)) {
          best = i;
          break;
        }
      }
      if (best >= 0) {
        goal = best;
        const c = best % ROOM_COLS;
        const r = Math.floor(best / ROOM_COLS);
        // Walk on past the edge.
        if (best === pr * ROOM_COLS + pc) return [(c + 0.5 + dx) * TILE, (r + 0.5 + dy) * TILE];
      }
    }
  }
  if (goal < 0) return [p.x, p.y];
  // Walk back from the goal to the first step.
  let step = goal;
  while (prev.get(step) !== undefined && prev.get(step) !== pr * ROOM_COLS + pc && prev.get(step) !== -1) step = prev.get(step)!;
  if (goal === pr * ROOM_COLS + pc) step = goal;
  return [((step % ROOM_COLS) + 0.5) * TILE, (Math.floor(step / ROOM_COLS) + 0.5) * TILE];
}

/**
 * Which way to the next room that matters: a breadth-first search over rooms
 * to the nearest one with an unopened key chest, a loose key, a gate she can
 * open, or the bowl. Rooms already finished are just passed through.
 */
export function nextRoom(s: GameState): Dir | null {
  const street = s.street;
  const interesting = (x: number, y: number): boolean => {
    if (x === s.rx && y === s.ry) return false;
    const g = s.roomState(x, y).grid;
    const flat = g.map((row) => row.join('')).join('');
    if (flat.includes('B')) return true;
    if (flat.includes('k')) return true;
    if (flat.includes('X') && roomAt(street, x, y)!.chest === 'key') return true;
    if (flat.includes('L') && s.player.keys > 0) return true;
    if (roomAt(street, x, y)!.boss && !s.roomState(x, y).bossBeaten) return s.player.keys === 0 || !flat.includes('L');
    return false;
  };
  const start = `${s.rx},${s.ry}`;
  const prev = new Map<string, [string, Dir] | null>([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const key = queue.shift()!;
    const [x, y] = key.split(',').map(Number) as [number, number];
    if (interesting(x, y)) {
      // Back to the first step.
      let k = key;
      let dir: Dir | null = null;
      while (prev.get(k)) {
        const [from, d] = prev.get(k)!;
        dir = d;
        k = from;
      }
      return dir;
    }
    const room = roomAt(street, x, y)!;
    for (const d of Object.keys(DIRS) as Dir[]) {
      if (!hasDoor(street, room, d)) continue;
      const [dx, dy] = DIRS[d];
      const nk = `${x + dx},${y + dy}`;
      if (prev.has(nk)) continue;
      // A room behind a gate isn't reachable until the gate's open: the gate
      // lives inside a room, so this only stops at rooms, which is good enough.
      prev.set(nk, [key, d]);
      queue.push(nk);
    }
  }
  return null;
}

export function verify(full = true): Result[] {
  const results: Result[] = [];
  const add = (check: string, ok: boolean, detail: string): void => {
    results.push({ check, ok, detail });
  };

  add('a room and the HUD fit the frame', ROOM_H + HUD_H <= VIRTUAL_H, `${ROOM_W}x${ROOM_H} + ${HUD_H} HUD in ${VIRTUAL_H}`);

  for (const street of STREETS) {
    const bad: string[] = [];
    let starts = 0;
    let bowls = 0;
    for (const room of street.rooms) {
      const at = room.at.join(',');
      if (room.tiles.length !== ROOM_ROWS || room.tiles.some((row) => row.length !== ROOM_COLS)) bad.push(`${at} not 16x9`);
      const grid = buildRoom(street, room);
      for (let r = 0; r < ROOM_ROWS; r++) {
        for (let c = 0; c < ROOM_COLS; c++) {
          const edge = r === 0 || c === 0 || r === ROOM_ROWS - 1 || c === ROOM_COLS - 1;
          const t = grid[r]![c]!;
          const door = t === ':' && room.tiles[r]![c] !== ':';
          if (edge && !door && !SOLID.has(t)) bad.push(`${at} edge ${c},${r} is open`);
        }
      }
      for (const d of room.closed ?? []) {
        const [dx, dy] = DIRS[d];
        const other = roomAt(street, room.at[0] + dx, room.at[1] + dy);
        const back: Dir = d === 'n' ? 's' : d === 's' ? 'n' : d === 'e' ? 'w' : 'e';
        if (other && !(other.closed ?? []).includes(back)) bad.push(`${at} closes ${d} but its neighbour doesn't`);
      }
      const flat = room.tiles.join('');
      starts += (flat.match(/S/g) ?? []).length;
      bowls += (flat.match(/B/g) ?? []).length;
      if (room.boss && !flat.includes('Z')) bad.push(`${at} boss room has no Z`);
      if (!room.boss && flat.includes('Z')) bad.push(`${at} has a Z but no boss`);
      if (room.chest && (flat.match(/X/g) ?? []).length !== 1) bad.push(`${at} chest room needs exactly one X`);
      if (!room.chest && flat.includes('X')) bad.push(`${at} has an X but no chest contents`);
    }
    if (starts !== 1) bad.push(`${starts} starts`);
    if (bowls !== 1) bad.push(`${bowls} candy bowls`);
    add(`${street.name}: rooms are well formed`, bad.length === 0, bad.slice(0, 3).join('; ') || `${street.rooms.length} rooms`);
    const solved = solve(street);
    const gatesOnMap = new Set(
      street.rooms.flatMap((r) => (r.tiles.join('').includes('L') ? [r.at.join(',')] : [])),
    ).size;
    const chestsWithKeys =
      street.rooms.filter((r) => r.chest === 'key').length + street.rooms.reduce((n, r) => n + (r.tiles.join('').match(/k/g) ?? []).length, 0);
    // Every gate on the map must be one she has to open: keys open any gate, so
    // a gate she can reach early could be opened with the wrong key and a whole
    // branch skipped (Spooky Hollow's first draft did exactly that).
    const allNeeded = solved.gates === gatesOnMap && solved.keys === chestsWithKeys;
    add(`${street.name}: can be finished, every key and gate needed`, solved.ok && allNeeded,
      `${solved.note}: ${solved.keys}/${chestsWithKeys} key(s) found, ${solved.gates}/${gatesOnMap} gate(s) opened`);
  }

  // Candy Corner, the first street, teaches one thing per room, in a line.
  const first = STREETS[0]!;
  add('the first street is a short straight line', first.rooms.length <= 5 && first.rooms.every((r) => r.at[1] === 0 && !r.boss),
    `${first.name}: ${first.rooms.length} rooms`);

  // A street opens on the "find the candy bowl" card, and starts with her thinking of it.
  {
    const s = new GameState();
    s.load(first, 'ellie');
    const carded = s.phase === 'intro';
    s.update(1);
    const waits = s.phase === 'intro';
    s.begin();
    add('a street opens on the goal card, then she thinks of the bowl', carded && waits && s.phase === 'play' && s.thought === 'bowl' && s.thoughtTime > 0,
      `${carded ? 'card' : 'no card'}, then ${s.phase}, thinking of the ${s.thought}`);
  }

  // Monsters come back after she leaves a room and returns.
  {
    const s = new GameState();
    s.load(first, 'ellie');
    s.begin();
    s.invincible = true;
    const ghosts = (): number => s.monsters.filter((m) => m.alive).length;
    const before = ghosts();
    s.player.x = 8.5 * TILE; // close enough to see it
    for (let t = 0; t < 8 && ghosts() > 0; t += 1 / 120) s.update(1 / 120); // the auto-fire boos it
    const booed = ghosts() === 0;
    // Walk out east, then back west.
    const walk = (dx: number, until: () => boolean, settle = 1): void => {
      s.setStick(dx, 0);
      for (let t = 0; t < 12 && !until(); t += 1 / 120) {
        s.player.y = 4.5 * TILE; // keep to the path
        s.update(1 / 120);
      }
      s.setStick(0, 0);
      for (let t = 0; t < settle; t += 1 / 120) s.update(1 / 120);
    };
    walk(1, () => s.rx === 1);
    walk(-1, () => s.rx === 0, 0); // and look straight away, before the auto-fire boos it again
    add('monsters are back when she comes back to a room', before === 1 && booed && s.rx === 0 && ghosts() === 1, `${before} ghost, boo'd: ${booed}, back in room ${s.rx}: ${ghosts()} ghost`);
  }

  // A locked gate with no key: she thinks of a key.
  {
    const s = new GameState();
    s.load(first, 'ellie');
    s.begin();
    s.invincible = true;
    // Straight to the gate room, beside the gate, with no key.
    s.street = first;
    (s as unknown as { enterRoom(x: number, y: number): void }).enterRoom(2, 0);
    s.player.x = 6.5 * TILE;
    s.player.y = 4.5 * TILE;
    s.setStick(1, 0);
    let locked = false;
    for (let t = 0; t < 2; t += 1 / 120) {
      s.update(1 / 120);
      s.drainEvents((e) => (locked ||= e.kind === 'locked'));
    }
    add('at a locked gate with no key, she thinks of a key', locked && s.thought === 'key' && s.thoughtTime > 0, `locked: ${locked}, thinking of the ${s.thought}`);
  }

  // Standing about in a room: the cats go to the doorway towards what's next and meow.
  {
    const s = new GameState();
    s.load(first, 'ellie');
    s.begin();
    s.invincible = true;
    let meows = 0;
    let nudged = '';
    for (let t = 0; t < 30; t += 1 / 120) {
      s.update(1 / 120);
      s.drainEvents((e) => {
        if (e.kind === 'meow') meows++;
        if (e.kind === 'nudge') nudged = e.tag;
      });
    }
    const atDoor = s.cats.every((c) => c.x > ROOM_W - 2 * TILE);
    add('stood still, the cats go to the way on and meow', !!nudged && atDoor && meows >= 2,
      `thought of the ${nudged || 'nothing'}; cats at x ${s.cats.map((c) => c.x.toFixed(0)).join(', ')}; ${meows} meows`);
  }

  // She shoots what's in front of her, not what's behind her. (Facing away with
  // a monster about, stars fly straight ahead, away from it: they mustn't hit.)
  {
    const s = new GameState();
    s.load(first, 'ellie');
    s.begin();
    s.invincible = true;
    const ghost = s.monsters.find((m) => m.alive)!;
    const full = ghost.hp;
    s.player.x = ghost.x - 60; // the ghost is to her right...
    s.setStick(-0.02, 0); // ...and she's facing left
    for (let t = 0; t < 1.5; t += 1 / 120) s.update(1 / 120);
    const behind = ghost.alive ? full - ghost.hp : full;
    s.setStick(0.02, 0); // turn round
    for (let t = 0; t < 1.5; t += 1 / 120) s.update(1 / 120);
    const ahead = ghost.alive ? full - ghost.hp : full;
    add('she shoots what she faces, not what is behind her', behind === 0 && ahead > 0, `facing away: ${behind} hits; facing it: ${ahead}`);
  }

  // Pocus shows her a key by sitting beside it, not on top of it.
  {
    const s = new GameState();
    s.load(first, 'ellie');
    s.begin();
    s.invincible = true;
    (s as unknown as { enterRoom(x: number, y: number): void }).enterRoom(1, 0);
    s.player.x = 1.5 * TILE;
    s.player.y = 4.5 * TILE;
    for (let t = 0; t < 4; t += 1 / 120) s.update(1 / 120);
    const pocus = s.cats.find((c) => c.name === 'Pocus')!;
    const key = s.grid.flatMap((row, r) => row.map((t, c) => (t === 'k' ? [(c + 0.5) * TILE, (r + 0.5) * TILE] : null))).find(Boolean)!;
    const d = Math.hypot(pocus.x - key[0]!, pocus.y - key[1]!);
    add('Pocus sits beside a key, not on it', pocus.mode === 'guide' && d > TILE * 0.6 && d < TILE * 1.6, `${d.toFixed(0)} px from the key`);
  }

  // Hocus and Pocus trot after her smoothly: no flipping or stop-starting every frame.
  {
    const s = new GameState();
    s.load(STREETS[1]!, 'ellie');
    s.begin();
    s.invincible = true;
    let changes = 0;
    const last = s.cats.map((c) => `${c.fx}${c.moving}`);
    for (let t = 0; t < 12; t += 1 / 120) {
      const a = t * 1.3;
      s.setStick(t < 6 ? Math.cos(a) : t < 9 ? 1 : -0.4, t < 6 ? Math.sin(a) : t < 9 ? 0.2 : -0.3);
      s.update(1 / 120);
      s.drainEvents(() => {});
      s.cats.forEach((c, i) => {
        if (`${c.fx}${c.moving}` !== last[i]) changes++;
        last[i] = `${c.fx}${c.moving}`;
      });
    }
    add('the cats follow smoothly', changes < 80, `${changes} turns or stop-starts in 12 s of walking (was over 1000)`);
  }

  if (full) {
    for (const street of STREETS) {
      for (const kid of CHARACTERS) {
        const run = playStreet(street, kid.id);
        add(`${street.name} with ${kid.name}: the bot reaches the bowl`, run.result === 'bowl', `${run.result} after ${run.t.toFixed(0)}s, ${run.candy} candy, ${run.losses} times out of hearts`);
      }
    }
  }

  console.table(results);
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) console.log(`%c${results.length} contracts hold`, 'color:#2a2');
  else console.error(`${failed.length} of ${results.length} contracts FAILED`);
  return results;
}
