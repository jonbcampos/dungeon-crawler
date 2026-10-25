/**
 * The three trick-or-treaters. They play exactly the same; only the costume,
 * the voice and what they shoot change.
 *
 * Aften is going as Rumi, the K-pop demon hunter (told 2026-10-24; the name was
 * first spelled "Afton", and saves from then are carried over in save.ts).
 * Jacob is going as a firefighter (told 2026-10-25): mainly black, yellow stripes. Swapping one in is this table (name, costume, shot,
 * colours), the matching prompt in scripts/art-manifest.mjs, and a re-run of
 * `npm run art -- --only=<id>.motion` for their sprite sheet.
 */

export type CharacterId = 'ellie' | 'aften' | 'jacob';

/** What a character's shot looks like. Every shot behaves the same. */
export type ShotLook = 'star' | 'note' | 'water';

export interface Character {
  id: CharacterId;
  name: string;
  /** Shown under the name on the pick screen. */
  costume: string;
  shot: ShotLook;
  /** The shot's colours: core and glow. */
  shotColor: string;
  shotGlow: string;
  /** Fallback drawing colours (no generated art): outfit, hair, skin. */
  outfit: string;
  hair: string;
  skin: string;
  /** Voice-line prefix in sounds/index.json: `e.*`, `a.*`, `j.*`. */
  voice: string;
}

export const CHARACTERS: readonly Character[] = [
  {
    id: 'ellie',
    name: 'Ellie',
    costume: 'Star Princess',
    shot: 'star',
    shotColor: '#fff3a8',
    shotGlow: '#ffd23f',
    outfit: '#7fdbe0',
    hair: '#4a2c1a',
    skin: '#c98b5a',
    voice: 'e',
  },
  {
    id: 'aften',
    name: 'Aften',
    costume: 'Demon Hunter',
    // The demon hunters fight with their singing, so: glowing music notes.
    shot: 'note',
    shotColor: '#f5e8ff',
    shotGlow: '#a855f7',
    outfit: '#231634',
    hair: '#7c3aed',
    skin: '#f1c9a5',
    voice: 'a',
  },
  {
    id: 'jacob',
    name: 'Jacob',
    costume: 'Firefighter',
    // A firefighter's hose: splashes of water.
    shot: 'water',
    shotColor: '#e6f7ff',
    shotGlow: '#38bdf8',
    outfit: '#1b1b1f',
    hair: '#3b2a1a',
    skin: '#e0b48c',
    voice: 'j',
  },
];

export function characterById(id: CharacterId): Character {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0]!;
}
