/**
 * What art to generate, and the prompt for each piece.
 *
 * This file is the art direction; `generate-art.mjs` is plumbing (copied from
 * ../captain-ellie unchanged). The rules are the siblings', each learned the
 * hard way: one shared style paragraph; a character's poses are ONE image (two
 * calls are two characters); say the grid as a count, loudly; sheets face
 * RIGHT and the game mirrors; nothing keyed may contain green.
 *
 * The world is a friendly Halloween night: cute, glowing, cosy-spooky, never
 * scary. The ground tiles are drawn by code (src/render/scene.ts); everything
 * standing on them is painted here.
 *
 * Costumes are described, never named: "a pale aqua star princess" rather than
 * any character's name, which image models refuse or draw off-model.
 *
 * To change a costume: change the kid's LOOK and COSTUME below (and the
 * matching entry in src/game/content.ts), then
 *     npm run art -- --only=<id>.motion --force
 */

// --- Shared prompt parts -----------------------------------------------------

const KEY_BACKGROUND = [
  'THE BACKGROUND MUST BE FLAT SOLID CHROMA-KEY GREEN, hex #00FF00, pure saturated green,',
  'covering every pixel that is not the subject. No white, no gradient, no vignette,',
  'no shadow cast onto the background, no grass, no ground, no scenery, no border.',
].join(' ');

const BLACK_BACKGROUND = [
  'THE BACKGROUND MUST BE PURE SOLID BLACK, hex #000000, every single pixel that is not fire',
  'or glowing light. No smoke against the black, no haze, no ground, no scenery, no border.',
].join(' ');

const MAGENTA_BACKGROUND = [
  'THE BACKGROUND MUST BE FLAT SOLID MAGENTA, hex #FF00FF.',
].join(' ');

const DRAW_STYLE = [
  "children's picture book illustration of a friendly Halloween night: soft rounded shapes, thick",
  'clean dark outlines, flat bright colours with simple soft shading, cosy and cute and a tiny bit',
  'spooky, never scary. Palette of deep purple night, warm pumpkin orange, candlelight yellow, moonlit',
  'lavender and candy pink. No text, no letters, no numbers, no watermark',
].join(' ');

const NO_GREEN = 'The subject contains NO green anywhere: no green stems, no grass, no green paint or trim.';

const CUT_OUT = 'clean crisp edges suitable for cutting out against pure green #00FF00.';

/** Grid rules shared by every keyed sheet, as in slingshot. */
function gridRules(cols, rows) {
  const cells = cols * rows;
  return [
    `A SPRITE SHEET laid out as a grid of ${cols} columns by ${rows} rows.`,
    `THE GRID IS EXACTLY ${cols} CELLS ACROSS AND ${rows} CELLS DOWN: ${cells} figures in total, no more and no fewer.`,
    `Do NOT add another row. Do NOT repeat a row. Do NOT draw more than ${cells} figures.`,
    'Read each row left to right, top row first.',
    'The subject is IDENTICAL in every single cell: same design, same size, same colours, same',
    'proportions. It must be impossible to tell that any two cells were drawn separately.',
    'ONLY THE POSE AND EXPRESSION CHANGE from cell to cell.',
    'Centre each figure in its own cell, at the same size. EVERY figure must fit ENTIRELY INSIDE its',
    'own cell with a clear band of plain background on all four sides; nothing may touch or cross',
    'the boundary between cells, and nothing may run off the edge of the picture.',
    'Draw NO lines, borders, boxes, numbers or dividers between the cells: one single continuous',
    'flat #00FF00 background behind and between all the figures.',
    'NEVER mirror or turn the subject around between cells.',
    'Draw NOTHING except the subject: no stars, no planets, no motion lines, no smoke, no stray marks.',
  ].join(' ');
}

function cellList(cells) {
  return cells.map((text, i) => `Cell ${i + 1}: ${text}`).join(' ');
}

// --- The cast -----------------------------------------------------------------

/** Ellie, word for word as in ../slingshot and ../tower-defense, so she is the same girl. */

// --- The trick-or-treaters ------------------------------------------------------

/** Ellie is the same girl as in the other games. */
const ELLIE_LOOK =
  'a little girl about five years old, long wavy dark brown hair past her shoulders, ' +
  'warm honey-tan skin, big brown eyes';
const ELLIE_COSTUME =
  'dressed up for Halloween as a star princess: a pale aqua-turquoise princess gown with a wide ' +
  'flowing skirt and a pale yellow star on the front, a small silver crown with light blue gems, ' +
  'little star earrings, and a silver wand topped with a glowing yellow star';

/**
 * Aften is going as Rumi, the K-pop demon hunter. Described, never named (see
 * DECISIONS 7): her long purple braid, a sparkly black-and-purple stage outfit,
 * the glowing purple markings, and her glowing sword.
 */
const AFTEN_LOOK = 'a little girl about six years old, fair skin, a big confident smile';
const AFTEN_COSTUME =
  'dressed up for Halloween as a K-pop idol demon hunter: very long purple hair in one thick braid ' +
  'hanging down her back, a sparkly black cropped jacket with purple trim over a purple top, black ' +
  'trousers with glowing purple swirling markings, black boots, and a glowing purple sword held ' +
  'proudly in one hand'

/** Jacob is going as a firefighter: "mainly black with the yellow stripes". */
const JACOB_LOOK = 'a little boy about six years old, short dark brown hair, light tan skin, a big grin';
const JACOB_COSTUME =
  'dressed up for Halloween as a firefighter: a black firefighter coat and black trousers with ' +
  'bright yellow reflective stripes around the arms, the chest and the legs, a black fire helmet ' +
  'with a shiny gold badge on the front, black boots, and a short red fire hose with a silver ' +
  'nozzle held in one hand'

/**
 * Written as plain descriptions, not labels. The first version started each
 * cell with a capitalised label ("WALKING to the RIGHT", "STANDING"), and on
 * two of the three sheets the model lettered those labels under the figures,
 * which breaks the slicer.
 */
const KID_CELLS = [
  'mid-stride walking towards the right side of the picture, seen from the side, one foot forward.',
  'mid-stride walking towards the right side of the picture, feet passing each other.',
  'mid-stride walking towards the right side of the picture, the other foot forward.',
  'mid-stride walking towards the right side of the picture, arms swinging.',
  'standing still facing the viewer, smiling, holding a little orange pumpkin candy bucket.',
  'cheering facing the viewer, both arms up in the air, a huge happy grin.',
  'startled facing the viewer, jumping a little with hands up and eyes wide, funny not scared.',
  'walking away from the viewer, seen from behind.',
];

function kidSheet(id, look, costume) {
  return {
    id: `${id}.motion`,
    aspect: '16:9',
    size: '2K',
    sheet: { cols: 4, rows: 2, align: 'floor', rowIds: ['walk', 'poses'] },
    subject: `${look}, ${costume}.`,
    cells: KID_CELLS,
    extra:
      'The top row is a walking cycle to the RIGHT, the bottom row is four poses: exactly four children ' +
      'in each row, eight in total. The child is drawn whole, head to shoes, the same size in every ' +
      'cell. ABSOLUTELY NO WORDS, LABELS OR CAPTIONS anywhere in the picture. ' +
      NO_GREEN,
  };
}

/**
 * Hocus and Pocus, the family's two black cats, who walk along with the kids.
 * As Jonathan described them: all black with yellow eyes, no spots. Hocus was a
 * girl (pink collar), Pocus a boy (blue collar), and Pocus had one thin band of
 * white hair going round his upper left front leg, like an armband.
 *
 * The model would not put that band up high: asked for it "below his chest" it
 * drew it near the paw; asked for "level with his belly" it drew a thick white
 * bandage. The near-the-paw version is the one on disk (one thin band, the same
 * front leg in every frame). Left and right are beyond it: describe what the
 * picture shows ("the front leg nearest the viewer"), never the cat's own left.
 */
const CAT_LOOK =
  'a sleek, friendly, fluffy-cheeked cat that is ALL BLACK, with no spots and no patches, big round ' +
  'bright yellow eyes, a little dark nose, soft dark-grey highlights on the black fur so the shape ' +
  'reads clearly, and a long curly black tail. The chest and belly are exactly as black as the rest: ' +
  'NO lighter bib, NO grey chest patch, and the black is a true black, not purple';

const CAT_CELLS = [
  'trotting towards the right side of the picture, seen from the side, front paw forward.',
  'trotting towards the right side of the picture, paws together.',
  'trotting towards the right side of the picture, back paw forward.',
  'trotting towards the right side of the picture, tail up high.',
  'sitting neatly facing the viewer, tail curled round its paws, happy.',
  'sitting facing the viewer, mouth open in a cheerful meow, one paw lifted to point.',
  'curled up happily facing the viewer, eyes closed, purring.',
  'startled: back arched, fur fluffed, tail puffed up, eyes wide, funny not scared.',
];

function catSheet(id, collar) {
  return {
    id: `${id}.motion`,
    aspect: '16:9',
    size: '2K',
    sheet: { cols: 4, rows: 2, align: 'floor', rowIds: ['walk', 'poses'] },
    subject: `${CAT_LOOK}, wearing ${collar}.`,
    cells: CAT_CELLS,
    extra:
      'The top row is a trotting cycle and ALL FOUR cats in it face and walk to the RIGHT, none to the ' +
      'left. The bottom row is four poses: exactly four cats in ' +
      'each row, eight in total, the same cat at the same size in every cell. ABSOLUTELY NO WORDS, ' +
      'LABELS OR CAPTIONS anywhere in the picture. ' +
      NO_GREEN,
  };
}

export const PIECES = [
  kidSheet('ellie', ELLIE_LOOK, ELLIE_COSTUME),
  kidSheet('aften', AFTEN_LOOK, AFTEN_COSTUME),
  kidSheet('jacob', JACOB_LOOK, JACOB_COSTUME),

  // --- Hocus and Pocus ------------------------------------------------------------------
  // The family's two black cats, as the kids' companions.
  catSheet('hocus', 'a pink collar with a little heart-shaped tag. She is a girl cat'),
  catSheet(
    'pocus',
    'a blue collar with a little round silver tag. He is a boy cat. He has ONE single thin white band ' +
      'of fur, like one thin white bracelet, wrapped around the TOP of ONE front leg, just below his chest. ' +
      'In the walking cells it is on the FRONT leg nearest the viewer, in exactly the same place in all ' +
      'four. When he faces the viewer it is on the front leg on the RIGHT side of the picture. Only one ' +
      'band, never two, never on a back leg, never near the paw. It is the only white anywhere on him',
  ),

  // --- Monsters: friendly, and happy once boo'd ------------------------------------
  {
    id: 'monsters.motion',
    aspect: '16:9',
    size: '2K',
    sheet: { cols: 4, rows: 2, align: 'center', rowIds: ['normal', 'happy'] },
    subject: 'FOUR friendly cute Halloween monsters for a children\'s game, each shown twice.',
    cells: [
      'a little white floating ghost with a wavy bottom edge, big dark eyes and a cheeky "boo" mouth, arms out.',
      'a little purple-black bat with wings spread, big shiny eyes and two tiny fangs, mischievous.',
      'a little orange jack-o\'-lantern with stubby legs and a brown stem, hopping, with a cheeky carved grin.',
      'a little grey raccoon with a black bandit mask wearing a white bedsheet ghost costume with eye holes, ' +
        'his ringed tail poking out the back, holding a bulging orange candy bag, grinning greedily.',
      'the SAME ghost, now happy and sweet: eyes closed in joy, a big smile, little pink hearts around it.',
      'the SAME bat, now happy: eyes closed, smiling, waving one wing.',
      'the SAME jack-o\'-lantern, now happy: a big sweet smile, eyes closed in joy.',
      'the SAME raccoon in his sheet costume, now happy: sheet slipped off his head, laughing, waving.',
    ],
    extra:
      'The top row is the four monsters in order: ghost, bat, jack-o\'-lantern, raccoon. The bottom ' +
      'row is the SAME four in the SAME order, now happy. Each is round-ish and fills its cell. ' +
      NO_GREEN,
  },

  // --- Things on the tiles -------------------------------------------------------------
  {
    id: 'props.motion',
    aspect: '16:9',
    size: '2K',
    sheet: { cols: 4, rows: 2, align: 'center', rowIds: ['all', 'all'] },
    subject: 'EIGHT different Halloween yard objects for a top-down children\'s game, seen from slightly above.',
    cells: [
      'a glowing carved jack-o\'-lantern with a friendly face and a brown stem.',
      'a rounded grey cartoon gravestone with a little crack, no writing.',
      'a small spooky bare tree with curly branches and dark purple-brown bark.',
      'a big pile of orange, red and yellow autumn leaves.',
      'a big white cobweb stretched in a square.',
      'a round golden hay bale with straw sticking out.',
      'a closed wooden treasure chest painted orange and black with a golden lock.',
      'a big purple candy bowl overflowing with colourful wrapped candy and lollipops.',
    ],
    extra: 'Each object is drawn whole and fills most of its cell. ' + NO_GREEN,
  },
  // --- Landmarks: trees, yard things, furniture -------------------------------------
  // Jonathan: rooms should be "slightly different (like a house) so that mentally you lay
  // out the map in your head with more markers", and the trees deserve "a slightly
  // higher quality look". Each is drawn bigger than a tile in the game.
  {
    id: 'trees.motion',
    aspect: '16:9',
    size: '2K',
    sheet: { cols: 4, rows: 2, align: 'floor', rowIds: ['all', 'all'] },
    subject: 'EIGHT different autumn trees for a top-down children\'s Halloween game, each seen from the front.',
    cells: [
      'a round full maple tree with bright red autumn leaves and a brown trunk.',
      'a round full tree with bright orange autumn leaves and a brown trunk.',
      'a tall oval tree with golden-yellow autumn leaves and a pale trunk.',
      'a spooky bare tree with curly twisting branches and dark purple-brown bark, no leaves.',
      'a big tree with orange and red leaves and a tyre swing hanging from a low branch on a rope.',
      'a tree with red-orange leaves and little glowing paper lanterns hanging from its branches.',
      'a tree with yellow-orange leaves holding a small wooden treehouse with a round window.',
      'a tall slim tree with deep purple and plum autumn leaves.',
    ],
    extra:
      'Each tree is drawn WHOLE, from the base of its trunk to the top of its leaves, filling most of ' +
      'its cell, with the bottom of the trunk at the same height in every cell. ' + NO_GREEN,
  },
  {
    id: 'yard.motion',
    aspect: '16:9',
    size: '2K',
    sheet: { cols: 4, rows: 2, align: 'floor', rowIds: ['all', 'all'] },
    subject: 'EIGHT different Halloween yard decorations and garden things for a top-down children\'s game, seen from slightly above.',
    cells: [
      'a friendly scarecrow on a post with a pumpkin head, a straw hat and a patched shirt.',
      'an old round stone wishing well with a little wooden roof and a bucket.',
      'a big inflatable lawn ghost decoration, white with a happy face, a little wobbly.',
      'a wooden wheelbarrow full of orange pumpkins.',
      'a round stone garden fountain with sparkling blue water.',
      'a wooden park bench with a little pumpkin sitting on it.',
      'a mailbox on a post with a cute toy spider on top and fake cobweb.',
      'a small wooden swing set with two swings.',
    ],
    extra: 'Each is drawn whole and fills most of its cell, the bottom of each at the same height. ' + NO_GREEN,
  },
  {
    id: 'indoor.motion',
    aspect: '16:9',
    size: '2K',
    sheet: { cols: 4, rows: 2, align: 'floor', rowIds: ['all', 'all'] },
    subject: 'EIGHT pieces of cosy Halloween-decorated house furniture for a top-down children\'s game, seen from slightly above.',
    cells: [
      'a plump purple couch with orange cushions.',
      'a tall wooden bookshelf full of colourful books and a little pumpkin.',
      'a stone fireplace with a warm crackling fire and two small jack-o\'-lanterns on the mantel.',
      'a round wooden table with a small bowl of candy on it.',
      'a tall grandfather clock with a round face and a swinging pendulum.',
      'a cosy orange armchair with a striped blanket.',
      'a black witch\'s cauldron bubbling with purple goo and little sparkles.',
      'a round woven rug in orange, purple and cream rings.',
    ],
    extra: 'Each is drawn whole and fills most of its cell, the bottom of each at the same height. ' + NO_GREEN,
  },

  {
    id: 'items.motion',
    aspect: '16:9',
    size: '2K',
    sheet: { cols: 4, rows: 2, align: 'center', rowIds: ['all', 'all'] },
    subject: 'EIGHT shiny pickups for a children\'s Halloween game.',
    cells: [
      'a fancy golden key with a round loop shaped like a pumpkin.',
      'a glossy red heart.',
      'a wrapped orange candy with twisted ends.',
      'a wrapped pink candy with twisted ends.',
      'a piece of candy corn, white, orange and yellow.',
      'an open orange-and-black treasure chest with golden sparkles coming out.',
      'a round swirly rainbow lollipop.',
      'a chocolate bar in a purple wrapper.',
    ],
    extra: 'Each pickup is drawn big and fills most of its cell. ' + NO_GREEN,
  },

  // --- Bosses -------------------------------------------------------------------------------
  ...[
    [
      'boss.pumpkin-king',
      'the Pumpkin King: a giant round jack-o\'-lantern with a big grumpy-silly carved face, a golden ' +
        'crown, a brown stem, and curly vine arms, hopping',
    ],
    [
      'boss.big-boo',
      'Big Boo: a giant fluffy white ghost with a huge cheeky grin, round blushing cheeks, little arms ' +
        'waving, and a wavy tail, glowing softly',
    ],
    [
      'boss.raccula',
      'Count Raccula: a plump grey raccoon with a black bandit mask dressed up as a vampire for ' +
        'Halloween: a black cape with a red lining, a little bow tie, slicked-back fur and plastic ' +
        'toy fangs, arms spread wide with the cape, looking theatrical and silly',
    ],
  ].map(([id, what]) => ({
    id,
    aspect: '1:1',
    size: '1K',
    subject: `${what}. Seen from the front, filling most of the picture. Big, silly and impressive, NEVER scary.`,
    extra: NO_GREEN,
  })),

  // --- Copied from ../slingshot ------------------------------------------------------------
  {
    id: 'boom.motion',
    aspect: '16:9',
    size: '2K',
    background: 'black',
    sheet: { cols: 4, rows: 2, align: 'center', rowIds: ['fx', 'fx'] },
    subject: 'ONE cartoon explosion, shown as an animation in eight stages.',
    cells: [
      'a small white-hot flash star.',
      'a bright yellow-white ball bursting outward with spiky edges.',
      'a big round fireball, yellow core, orange rim.',
      'the fireball at its biggest: orange with red edges and puffy billows.',
      'breaking up into separate orange puffs.',
      'deep red puffs spreading apart.',
      'dim dark-red embers, mostly faded.',
      'a few last tiny glowing sparks.',
    ],
  },

  // --- The world -------------------------------------------------------------------------------
  {
    // Menus. Kids are drawn over it from their own sheets, so it has none.
    id: 'title',
    aspect: '16:9',
    size: '2K',
    background: 'none',
    subject:
      'A friendly Halloween night street in a cosy neighbourhood, seen from the sidewalk: little houses ' +
      'with glowing orange windows, jack-o\'-lanterns on the porch steps, paper bats and fairy lights, ' +
      'a big round full moon and a purple starry sky. The TOP THIRD is open sky left empty for a title. ' +
      'The BOTTOM-MIDDLE is an empty sidewalk where three children will be drawn later. No people, no ' +
      'text.',
  },
  {
    // Behind the rooms, at the screen edges.
    id: 'night',
    aspect: '21:9',
    size: '2K',
    background: 'none',
    subject:
      'A wide calm Halloween night sky: deep purple with soft lavender clouds, twinkling stars and a big ' +
      'glowing full moon near one corner, and along the very bottom edge a low row of dark rooftops ' +
      'with a few warm glowing windows. Simple and quiet, no people, no text.',
  },
];

/**
 * Composed from named parts, never by editing a finished string (slingshot's
 * rule: tower-defense lost a whole background to a `.replace()` that silently
 * stopped matching). The two copied pieces keep slingshot's exact wording.
 */
export function promptFor(piece) {
  if (piece.background === 'magenta') {
    return [
      MAGENTA_BACKGROUND,
      piece.subject,
      'There is NO magenta or pink anywhere in the clouds themselves.',
      `${DRAW_STYLE}, clean crisp edges suitable for cutting out against pure magenta #FF00FF.`,
      MAGENTA_BACKGROUND,
    ].join(' ');
  }
  if (piece.background === 'black') {
    const { cols, rows } = piece.sheet;
    return [
      BLACK_BACKGROUND,
      `A grid of ${cols} columns by ${rows} rows: EXACTLY ${cols * rows} drawings, no more and no fewer,`,
      'each centred in its own cell with black space all around it, read left to right, top row first.',
      'No lines, borders or numbers between the cells.',
      `Subject: ${piece.subject}`,
      cellList(piece.cells),
      'Bold cartoon shapes like a picture book, not realistic. No text, no letters, no watermark.',
      BLACK_BACKGROUND,
    ].join(' ');
  }
  if (piece.background === 'none') {
    return `${piece.subject} ${DRAW_STYLE}. This is a full-bleed background image: it must fill the entire frame edge to edge, with no border and no chroma-key colour anywhere.`;
  }
  if (piece.sheet) {
    const { cols, rows } = piece.sheet;
    return [
      KEY_BACKGROUND,
      gridRules(cols, rows),
      `The subject: ${piece.subject}`,
      cellList(piece.cells),
      piece.extra ?? '',
      `${DRAW_STYLE}, ${CUT_OUT}`,
    ].join(' ');
  }
  return [
    KEY_BACKGROUND,
    `Subject: ${piece.subject}`,
    'A single centred subject filling most of the frame.',
    piece.extra ?? NO_GREEN,
    `${DRAW_STYLE}, ${CUT_OUT}`,
  ].join(' ');
}
