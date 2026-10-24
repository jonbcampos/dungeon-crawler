/**
 * Progress: the most candy collected on each street (more than zero means she
 * reached its candy bowl, which opens the next street), the quiet-help counts,
 * the last trick-or-treater picked, and the mute switch.
 *
 * Versioned and defensive about what it reads back, as in the siblings: a
 * phone that two or three kids pass round on the drive will see some odd
 * localStorage. Unreadable data is discarded and the game starts fresh.
 */

import type { CharacterId } from '../game/content';

const KEY = 'trick-or-treat.save';
const VERSION = 1;

export interface Save {
  v: number;
  /** Most candy on each street id; > 0 means its candy bowl was reached. */
  candy: Record<number, number>;
  /** Times out of hearts on each street since she last reached its bowl (HELP). */
  struggle: Record<number, number>;
  character: CharacterId;
  muted: boolean;
}

export function freshSave(): Save {
  return { v: VERSION, candy: {}, struggle: {}, character: 'ellie', muted: false };
}

function counts(raw: unknown, max: number): Record<number, number> {
  const out: Record<number, number> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) out[Number(k)] = Math.min(max, Math.round(n));
  }
  return out;
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshSave();
    const data = JSON.parse(raw) as Partial<Save>;
    if (data.v !== VERSION) return freshSave();
    // 'afton' was Aften's id before the spelling was fixed.
    const picked = (data.character as string) === 'afton' ? 'aften' : data.character;
    const character: CharacterId = picked === 'aften' || picked === 'jacob' ? picked : 'ellie';
    return {
      v: VERSION,
      candy: counts(data.candy, 9999),
      struggle: counts(data.struggle, 9),
      character,
      muted: data.muted === true,
    };
  } catch {
    return freshSave();
  }
}

export function writeSave(save: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Private mode or full storage: progress is lost, the game is not.
  }
}

/** Reached the candy bowl: keep the best haul, and the help goes back to nothing. */
export function recordBowl(save: Save, streetId: number, candy: number): void {
  save.candy[streetId] = Math.max(save.candy[streetId] ?? 0, Math.max(1, candy));
  delete save.struggle[streetId];
  writeSave(save);
}

/** Out of hearts once more on this street. Returns the new count. */
export function recordLoss(save: Save, streetId: number): number {
  save.struggle[streetId] = Math.min(9, (save.struggle[streetId] ?? 0) + 1);
  writeSave(save);
  return save.struggle[streetId];
}
