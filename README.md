# Trick or Treat!

A little Zelda-style Halloween adventure for Ellie and her friends, made to play on the drive in to
go trick-or-treating. Pick a trick-or-treater, walk the spooky streets, boo the monsters into
candy, find the keys, open the gates, and reach the candy bowl at the end of each street.

| Kid | Costume | Shoots |
| --- | --- | --- |
| **Ellie** | Star Princess | stars |
| **Afton** | Good Witch *(placeholder)* | sparkles |
| **Jacob** | Superhero *(placeholder)* | lightning bolts |

They all play the same. Afton's and Jacob's costumes are placeholders until their parents say
what they're dressing up as (see "Changing a costume" below).

**Hocus and Pocus**, two black cats, come along on every street. They can't be hurt and they
help: Pocus runs to the key and meows by it, and Hocus leads the way to a gate once there's a key
to open it. If she lingers in a room, both go to the doorway towards what's next.

## Playing

- **Drag anywhere to walk**: a joystick appears under the finger, centred where it went down.
- **Shooting is automatic, at what she's facing**: the nearest monster in front of her, or, with
  no monster around, the nearest thing in the way in front of her (a leaf pile, a cobweb, a hay
  bale, a chest). To shoot something, turn towards it.
- **Monsters** (ghosts, bats, hopping jack-o'-lanterns, and Raccoon Bandits in sheet costumes
  hogging candy) get *boo'd*: they turn happy, pop into candy and float away. Nobody is hurt.
- **Keys** come from chests. Walk up to a gate with a key and it swings open.
- **Bosses** guard the end of each street: the Pumpkin King, Big Boo, and Count Raccula (a Raccoon
  Bandit in a vampire cape). The doors bar while one is up.
- **Out of hearts** ("Boo! Try again!"), she starts again at the door she came in by, with full
  hearts. Everything she's cleared stays cleared. Each time it happens on a street, monsters drop
  more hearts, and from the second time she gets an extra heart.

Each street opens on a card that says what to do ("Find the candy bowl!", with pictures of the
ghost, the key, the gate and the bowl). A thought bubble shows what she's after, a locked gate
makes her say "I need a key!", and if she stays in one room a while, Hocus and Pocus walk to the
way on and meow. Monsters come back when she leaves a room and returns.

**Candy Corner** comes first: four rooms in a line, one lesson each. Then three streets, each a
little maze to explore: **Pumpkin Lane** (12 rooms, 2 keys, a house to go
inside), **Spooky Hollow** (12 rooms, 3 keys, a graveyard and an old church), and **Haunted Hill**
(15 rooms, 3 keys, ending inside the haunted mansion). Rooms come in kinds (yards, graveyards,
pumpkin patches, indoor rooms with furniture) and most yards have a landmark (a scarecrow, the
well, the fountain), so there's always something to remember the way by. Reaching a candy bowl
opens the next street.

Keyboard: arrows or WASD to walk, Esc to pause.

## In the car

The service worker caches **every** picture and sound on the first visit, not just what the game
happens to load, so one visit at home on wifi and the whole game works with no signal. Install it
to the home screen ("Add to Home Screen") for full-screen play. Bump `VERSION` in `public/sw.js`
to make installed copies fetch a new build.

## Changing a costume

1. `src/game/content.ts`: the kid's `costume`, `shot` and colours.
2. `scripts/art-manifest.mjs`: their `*_LOOK` and `*_COSTUME` text.
3. `npm run art -- --only=afton.motion --force && npm run art:shrink`

## Art and sound

Painted by Gemini from `scripts/art-manifest.mjs` (the three kids, monsters, props, items, bosses,
the title and the night sky); the ground tiles are drawn by code. Voices (each kid has the same
lines in their own voice) and Lyria music come from `scripts/sound-manifest.mjs`. All optional:
without them the game draws and synthesises its own.

```bash
cp .env.example .env.local    # then put a Gemini API key in it
npm run art && npm run art:shrink
npm run sound
npm run icons
```

## Running it

```bash
npm install && npm run dev
```

## Verifying it

```js
__game.verify()   // maps well formed; every street solvable; a bot finishes every street as every kid
__game.checkArt() // every sprite sheet has the grid the slicer expects
__game.street(n)  // jump into a street
```

`verify()` also runs in Node (it's a pure simulation): bundle `src/dev/verify.ts` with the
esbuild that ships with Vite and run it.

## How it's built

The same way as its siblings: TypeScript, a 2D canvas, Vite, no runtime dependencies.
`src/game/` is the simulation (it never imports `src/render/`), `src/game/config.ts` holds every
tuning number, `src/game/streets.ts` the maps (drawn as text), and [DECISIONS.md](DECISIONS.md)
records why.
