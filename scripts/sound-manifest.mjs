/**
 * What to ask Gemini to SAY and PLAY: voice lines (text-to-speech) and music
 * (Lyria). The small sounds (shots, candy, gates) are synthesised in
 * src/core/audio.ts, as in the siblings.
 *
 * Inherited from ../captain-ellie, where each was learned by listening: only
 * the TRANSCRIPT section of `voicePrompt` is read aloud; lines are short;
 * cartoon voices get a playback `rate` (faster = shorter AND higher).
 *
 * Each kid has the same lines with their own prefix (`e.*`, `a.*`, `j.*`) and
 * their own voice. All three are TTS for now. Ellie's real recordings can drop
 * in later (set `recorded: true` on ELLIE), and if Afton and Jacob want to
 * record theirs on the way over, so can theirs.
 */

const ELLIE = {
  voice: 'Zephyr',
  rate: 1,
  profile:
    "a little cartoon girl from a children's TV cartoon, about five years old: high, bright, squeaky " +
    'and bouncy, innocent and goofy. NOT grown-up, NOT breathy: a loud happy little kid',
};

const AFTON = {
  voice: 'Leda',
  rate: 1.05,
  profile:
    "a little cartoon girl from a children's TV cartoon, about six years old: sweet, clear and giggly, " +
    'a confident little friend. NOT grown-up: a happy little kid',
};

const JACOB = {
  voice: 'Orus',
  rate: 1.15,
  profile:
    "a little cartoon boy from a children's TV cartoon, about six years old: bright, brave and excited, " +
    'a playful little hero. NOT grown-up, NOT deep: a happy little kid',
};

const RACCOON = {
  voice: 'Puck',
  rate: 1.35,
  profile:
    "a tiny squeaky cartoon critter from a children's TV cartoon: a mischievous little raccoon with a " +
    'high, nasal, chipmunk-like voice, silly and over the top, never mean',
};

const GHOST = {
  voice: 'Fenrir',
  rate: 1.2,
  profile: "a tiny friendly cartoon ghost from a children's TV cartoon: airy, wobbly and giggly, never scary",
};

const PUMPKIN_KING = {
  voice: 'Charon',
  rate: 1.05,
  profile: "a big pompous cartoon pumpkin king from a children's TV cartoon: booming, theatrical and silly, never scary",
};

const BIG_BOO = {
  voice: 'Fenrir',
  rate: 1,
  profile: "a giant friendly cartoon ghost from a children's TV cartoon: a big wobbly booming voice, goofy, never scary",
};

const RACCULA = {
  voice: 'Puck',
  rate: 1.15,
  profile:
    "a cartoon raccoon pretending to be a vampire in a children's TV cartoon: a silly fake spooky accent, " +
    'very dramatic, clearly just playing dress-up, never scary',
};

function line(id, who, style, text) {
  return { id, kind: 'voice', who, style, text };
}

/** The same eleven lines for each kid, in their own voice. */
function kid(prefix, who) {
  return [
    line(`${prefix}.trick`, who, 'excited, shouting at the door', 'Trick or treat!'),
    line(`${prefix}.yay`, who, 'delighted, cheering', 'Yay!'),
    line(`${prefix}.candy`, who, 'thrilled, greedy in a cute way', 'Candy!'),
    line(`${prefix}.boo`, who, 'playful, shouting back at a ghost', 'Boo to you!'),
    line(`${prefix}.key`, who, 'excited discovery', 'I found a key!'),
    line(`${prefix}.gate`, who, 'proud, cheerful', "It's open!"),
    // The goal, said out loud: on the card before every street, and at a locked gate.
    line(`${prefix}.find`, who, 'excited, setting off on an adventure', "Let's find the candy bowl!"),
    line(`${prefix}.need`, who, 'thinking out loud, curious, not upset', 'I need a key!'),
    line(`${prefix}.spooky`, who, 'startled but giggling', 'Spooky!'),
    line(`${prefix}.oops`, who, 'disappointed but cheerful', 'Oh no!'),
    line(`${prefix}.happy`, who, 'thrilled and proud, celebrating', 'Happy Halloween!'),
  ];
}

export const SOUNDS = [
  ...kid('e', ELLIE),
  ...kid('a', AFTON),
  ...kid('j', JACOB),

  // --- The monsters ------------------------------------------------------------------
  line('r.mine', RACCOON, 'whiny, clutching his candy bag', 'My candy!'),
  line('r.nofair', RACCOON, 'whiny, dramatic', 'No fair!'),
  line('r.hehe', RACCOON, 'a short burst of cheeky giggles', 'Hee hee hee!'),
  line('g.happy', GHOST, 'turning happy, giggly and floaty', 'Wooo-hoo-hoo!'),

  // --- Bosses -------------------------------------------------------------------------
  line('pk.hello', PUMPKIN_KING, 'grand and pompous, announcing himself', 'I am the Pumpkin King!'),
  line('pk.lose', PUMPKIN_KING, 'laughing, giving up happily', 'Ho ho! Happy Halloween!'),
  line('bb.hello', BIG_BOO, 'big wobbly boo, then a giggle', 'Boooooo! Hee hee!'),
  line('bb.lose', BIG_BOO, 'happy and floaty, waving goodbye', 'Okay, okay! You win!'),
  line('rc.hello', RACCULA, 'silly fake vampire accent, dramatic', 'I vant your candy!'),
  line('rc.lose', RACCULA, 'dropping the accent, sheepish and giggly', 'Okay... want some of mine?'),

  // --- Music (Lyria) ---------------------------------------------------------------------
  {
    id: 'music.title',
    kind: 'music',
    prompt:
      "A cheerful, cosy-spooky Halloween title theme for a children's cartoon game about kids going " +
      'trick-or-treating: plucky pizzicato strings, a bouncy bassoon, a little spooky theremin melody ' +
      'that is playful not scary, celesta sparkles, light finger snaps, 100 bpm. Steady the whole way ' +
      'through: no long intro, no ending, no fade-out. Instrumental, no vocals.',
  },
  {
    id: 'music.street',
    kind: 'music',
    prompt:
      "Bouncy, playful exploring music for a children's Halloween adventure game, walking through a " +
      'neighbourhood at night: a walking bassline on tuba, xylophone skeleton-dance melody, spooky-fun ' +
      'organ chords, light brushed drums, mischievous and happy, 112 bpm. Gentle enough to play under ' +
      'sound effects. A steady groove the whole way through: no intro, no build-up, no ending and no ' +
      'fade-out, so it can loop. Instrumental, no vocals.',
  },
  {
    id: 'music.boss',
    kind: 'music',
    prompt:
      "Exciting, silly boss-battle music for a children's Halloween cartoon game against a pompous " +
      'pumpkin king: dramatic pipe organ stabs, galloping tuba, bright brass, pounding toms and a ' +
      'cheeky xylophone, goofy and never scary, 136 bpm. A steady groove the whole way through: no ' +
      'intro, no ending and no fade-out, so it can loop. Instrumental, no vocals.',
  },
];

/** The TTS prompt. Only the TRANSCRIPT section is spoken. */
export function voicePrompt(s) {
  return [
    `# AUDIO PROFILE: ${s.who.profile}`,
    "## DIRECTOR'S NOTES",
    `Style: ${s.style}. Cartoon voice acting, short, punchy and high-pitched.`,
    '#### TRANSCRIPT',
    s.text,
  ].join('\n');
}
