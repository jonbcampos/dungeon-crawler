/**
 * The three trick-or-treaters. They play exactly the same; only the costume,
 * the voice and what they shoot change.
 *
 * Afton's and Jacob's costumes are PLACEHOLDERS until their parents say what
 * they're dressing up as. Swapping one in is this table (name, costume, shot,
 * colours), the matching prompt in scripts/art-manifest.mjs, and a re-run of
 * `npm run art -- --only=<id>.motion` for their sprite sheet.
 */

export type CharacterId = 'ellie' | 'afton' | 'jacob';

/** What a character's shot looks like. Every shot behaves the same. */
export type ShotLook = 'star' | 'sparkle' | 'bolt';

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
    id: 'afton',
    name: 'Afton',
    // Placeholder until Afton's costume is known.
    costume: 'Good Witch',
    shot: 'sparkle',
    shotColor: '#ffd6f5',
    shotGlow: '#e879f9',
    outfit: '#8b5cf6',
    hair: '#8a5a2b',
    skin: '#f1c9a5',
    voice: 'a',
  },
  {
    id: 'jacob',
    name: 'Jacob',
    // Placeholder until Jacob's costume is known.
    costume: 'Superhero',
    shot: 'bolt',
    shotColor: '#dbeafe',
    shotGlow: '#3b82f6',
    outfit: '#2563eb',
    hair: '#3b2a1a',
    skin: '#e0b48c',
    voice: 'j',
  },
];

export function characterById(id: CharacterId): Character {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0]!;
}
