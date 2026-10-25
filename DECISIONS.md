# Decisions

What we decided, why, and what would make us revisit it. **Append to this; don't rewrite
history.** Sister log to the ones in `../slingshot`, `../captain-ellie` and the rest.

---

## 1. The brief

"A kid friendly dungeon crawler similar to the dungeons in the first Legend of Zelda. You play
Ellie, dressed up for Halloween like Rosalina from Mario Galaxy. You can shoot stars out and you
are trying to get through the dungeon (trick-or-treating in a neighbourhood) to find the candy
bowl. You should be able to also pick between Afton and Jacob." Then: "I would hope they play on
the drive in to go trick-or-treating together to get excited."

So: three short streets (a few minutes each for a five-year-old), one phone per kid, and it
has to work with no signal.

## 2. Rooms like Zelda's, sized for a phone

A room is 16 x 9 tiles of 26 px (416 x 234), with a 32 px HUD above it: the whole thing fits the
siblings' 270 px-tall landscape frame. Walking off an edge slides the screen to the next room, as
in Zelda. Maps are text (`streets.ts`), and doorways are cut automatically wherever two rooms
touch, so they always line up. A room can close a shared side (`closed`) when the automatic door
would walk round a gate, which happened in Spooky Hollow on the first draft.

## 3. Drag to walk, shooting on its own

Five-year-olds can drag or press a button, rarely both at once. So the finger only walks (a
joystick centred where it went down, which follows if the finger wanders far), and shots fire on
their own: at the nearest monster in sight, else at the nearest leaf pile, cobweb, hay bale or
chest in reach. Nothing to shoot, nothing fires, so it's never noise.

## 4. Nobody is hurt; nobody is stuck

Monsters get "boo'd" into candy and float away happy. Being touched is a "spook": a heart, a hop
back, a moment of safety. Out of hearts, she starts again at the door she came in by with full
hearts, and everything cleared stays cleared. Captain Ellie's quiet help is here too: more hearts
drop, and from the second time an extra heart, reset at the candy bowl.

Gates open when she's NEAR one with a key, not only when pushing into it. The bot stopped a step
short in the middle of the next tile, as a five-year-old would, and stood there forever.

## 5. Every street must be finishable, provably

A car full of kids with no signal is the worst place to find a dead end. `verify()` floods every
street from the start (breakables count as passable), opens chests, opens a gate whenever a key
is spare, and must reach the bowl with keys found equal to gates. Then a bot plays every street as
every kid and must reach the bowl. First run: 35 s, 63 s and 87 s for the bot; a child will take a
few minutes a street.

## 6. Offline for the car

The siblings cache art and sound as the game fetches them. This one's service worker fetches
both indexes on install and caches every file in them, so one visit on wifi is enough.

## 7. Costumes are described, not named

Prompts say "a pale aqua star-princess gown, a silver crown, a star wand", never a character's
name, which image models refuse or draw off-model. Afton (Good Witch) and Jacob (Superhero) are
placeholders until their costumes are known; swapping one is a table entry and one sheet.

## 8. Hocus and Pocus

"We need to work black cats in there (we had two, Hocus and Pocus) so that is a nice nod." They're
the kids' companions, not monsters: two black cats who trot along behind whoever is playing, can't
be hurt, and are never shot at. They help. When there's a key to find, Pocus runs to it (round the
hedges, by a path search, never through them) and sits beside it meowing until she comes over;
when she has a key and there's a gate, Hocus leads her to it. They sit when she stands still, curl
up and purr if she stands still a while, arch their backs when something spooks her, and dance at
the candy bowl. They're also on the title, pick and candy-bowl screens, and named for the first few
seconds of every street.

Painted to match the real cats, as Jonathan described them: all black, yellow eyes, no spots.
Hocus was a girl (pink collar, a heart tag, and a higher meow), Pocus a boy (blue collar, a lower
meow) with one thin band of white fur round his upper left front leg. The image model couldn't put
that band up high: it drew it near the paw, then as a bandage, so the near-the-paw version stays
(see the note in the art manifest). Black cats vanish on the dark menu screens, so there they get
a soft glow in their collar colour.

## 9. Longer streets, room kinds, and landmarks (Jonathan's second play)

"The levels need to be longer. Maybe up to 3 keys. This way it is a bit easier to get lost. With the
auto shoot death isn't really an issue so the exploration matters." And: "maybe some dungeon rooms
are slightly different (like a house) so that mentally you lay out the map in your head with more
markers", plus "a slightly higher quality look" for the trees.

- **Longer streets**: Pumpkin Lane 12 rooms and 2 keys; Spooky Hollow 12 rooms and 3 keys (an old
  church you go inside); Haunted Hill 15 rooms and 3 keys, ending inside the haunted mansion
  (foyer, library, hallway, the ballroom for Count Raccula, the candy bowl in the dining room).
  Each has crossroads, dead ends with treats, and branches, so there's somewhere to get lost.
- **Room kinds** (`theme`): yards; graveyards (darker, bluer grass with drifting mist); pumpkin
  patches (rows of soil); and indoors (floorboards, wallpaper, a carpet runner where the map has a
  path, a wooden banister where it has a fence). Indoor rooms are furnished from a painted sheet:
  couch, bookshelf, fireplace, table, grandfather clock, armchair, cauldron and rug.
- **Landmarks**: one-of-a-kind yard things in most yards (scarecrow, well, inflatable ghost,
  wheelbarrow, fountain, bench, spider mailbox, swing set), so a kid can remember "past the
  scarecrow".
- **Trees**: eight painted autumn trees (picked by position, so a room always looks the same),
  drawn nearly two tiles wide and over two tall. Everything that stands up is drawn in a second
  pass, row by row, so canopies overhang the tiles above; rugs get their own pass in between,
  because drawn with the floor the next row's boards covered their bottom half.

**Keys open any gate**, as in Zelda, and Spooky Hollow's first draft reached the bowl with two of
its three keys: the church key opened the last gate, which was off the churchyard, and the pond
garden was skipped. The route to the boss now runs through the pond garden, and `verify()` now
requires every key found and every gate opened on the way to the bowl, so no future map can grow a
shortcut. Bot times rose from 35/63/87 s to 58/85/93 s, and the bot knows where everything is.

## 10. Saying what to do, over and over (Ellie's first play)

She played it. "What do I do?" Told "find the candy bowl", she walked up to a tree: "I found it,
now what?" Once going she liked that things took effort to find. Jonathan asked for a card before
each street showing the goal, a very simple first street, monsters that come back, an "I need a
key" at a locked gate with a thought bubble, and the cats leading her on if she lingers: "a slow
enforcement to keep her from getting stuck".

- **Candy Corner**, a new first street: four rooms in a line, one lesson each (a ghost to boo, a
  key on the path, the gate, the candy bowl). No boss. Pumpkin Lane stays open too, so nobody who
  had played it finds it locked. Street ids are unchanged (Candy Corner is 0), so saves still fit.
- **The goal card** before every street: "Find the candy bowl!" over four pictures (ghost, key,
  gate, bowl) that pop up left to right, with the street's key count, and the kid says "Let's find
  the candy bowl!". A tap starts it, after a beat, so the tap that picked the street can't skip it.
- **A thought bubble** over her head with the thing itself in it, drawn from the same art as the
  map: the bowl as a street starts, a key at a locked gate (with "I need a key!"). She'd never seen
  what the candy bowl looked like before reaching one; now she sees it first.
- **Lingering**: after 20 seconds in a room with nothing found, Hocus and Pocus walk to the
  doorway towards what's next (a search over every tile of the street, so it never points behind a
  locked gate she can't open) and meow, more often the longer she waits, and she thinks of what's
  next again. They stop at a leaf pile or cobweb in the way rather than walking through it.
- **Monsters come back** when she leaves a room and returns, as in Zelda. Starting again after
  running out of hearts still keeps the ones she'd boo'd, so it's no harder to recover.

The bot exposed one of its own bugs on the way: it walked straight at a heart the boss dropped
and wedged on a gravestone. It now walks to pickups along its path. Bot times: 16 s for Candy
Corner, then 59, 69 and 84 s.

## 11. A hot phone

"Every time she plays on my phone my phone definitely gets hot." Two causes, both fixed:

- **The room was drawn tile by tile, every frame**: grass, paths and a painted sprite for every
  tree, landmark and piece of furniture, about 2 ms of a 2.5 ms frame on a laptop and several
  times that on a phone. Each room is now drawn once into an image at the screen's real
  resolution and copied each frame (0.2 ms); it's redrawn only when its tiles change (a leaf pile
  popped, a gate opened), the screen's scale changes, or a sprite sheet finishes loading. The few
  things that flicker (candles in jack-o'-lanterns, lit windows) are drawn on top every frame.
  A frame of play went from 2.5 ms to 1.1 ms.
- **Drawing at the screen's full refresh rate**: `core/loop.ts`, shared by every game in the set,
  now draws at most 60 pictures a second (the simulation still steps 120 times), so a 120Hz phone
  does half the drawing it did.

## 12. Aim by facing; bosses push back; smoother cats (Jonathan's third play)

"Should they only shoot when they are (mainly) facing the direction of the enemy. I was playing
Big Boo and just being close was enough to kill it. Which means winning is mainly about being
close."

- **Stars fire only at what's in front of her**: within about 45 degrees either side of the way
  she's facing (`SHOT.cone`). She no longer turns to follow what she's shooting, or standing still
  would aim at everything again. With a monster about but none in front of her, stars fly
  straight ahead, so walking at a monster always shoots it. Leaf piles and cobwebs too: she shoots
  the ones she's facing.
- **Bosses push back**: touching one knocks her twice as far as a monster does, and Big Boo won't
  be crowded: within 70 px for 1.2 s he vanishes and pops up elsewhere. A fight is now a cycle of
  facing the boss, shooting, stepping out of the way and lining up again.
- **The bot plays that way too**: it nudges the stick to face a boss, stands and shoots, and steps
  sideways out of the path of incoming orbs. Bot runs, Candy Corner to Haunted Hill: 17, 108, 88
  and 115 s, running out of hearts 0, 4, 0 and 2 times (the Pumpkin King is the hard one). Quiet
  help still adds hearts after each loss.
- **Hocus and Pocus looked "blurry" while she walked**: following her, a cat moved a pixel,
  stopped, moved again and turned round, every frame (over 1,000 walk/stop changes in 12 s of
  walking). Now a cat waits until it's a few pixels out of place, slows as it arrives, and turns
  round only when it's really heading the other way: about 35 changes in the same walk.
  `verify()` checks both the aiming and the cats.

## 13. Pocus sits beside a key, not on it

"Pocus goes to a key, which is great, but then is sitting on top of it. Would be better if he
went to sit next to the item." He now sits on the open tile beside a key (the side nearest her),
or beside a key that's just popped out of a chest, so the key stays in plain sight.

## 14. Halloween music, not circus music

"It has a fun circus vibe. When we want a fun Halloween vibe." The first prompts asked for tuba,
bassoon, pizzicato and xylophone, which is the circus. The three tracks are regenerated in a minor
key from haunted-house sounds: a music-box melody over pipe organ and theremin on the title, a
sneaky spooky-surf-guitar groove with harpsichord and "rattling bones" woodblock for the streets,
and driving spooky surf-rock with organ stabs for the bosses. Each prompt also says outright: not
circus, not carnival, no tuba, no oom-pah.

## 15. Slower, moodier music (take A)

The surf-rock round was "still too upbeat". The prompts now ask for slow, minor-key, atmospheric
music with no drum kit, guitar or brass: a music box over tremolo strings, harp and a distant bell
for the title (78 bpm); tiptoeing pizzicato bass, harpsichord and theremin sighs for the streets
(84 bpm); a low string ostinato, timpani and dark organ for the bosses (120 bpm). Two takes of
each were generated and compared side by side; Jonathan picked take A for all three.

## 16. Aften is Rumi

"Aften (I misspelled earlier) is going as Rumi from demon hunters." The name is fixed everywhere,
including her id (`aften`); a save that picked her under the old spelling still picks her. Her
sheet is repainted from a description, as decision 7 asks: a K-pop idol demon hunter with a long
purple braid, a sparkly black cropped jacket over a purple top, black trousers with glowing purple
markings, and a glowing purple sword. She shoots glowing purple music notes, because the demon
hunters fight with their singing. Jacob is still a placeholder.

## 17. Jacob is a firefighter

"Jacob will be a firefighter. The look is mainly black with the yellow stripes." His sheet is
repainted: a black firefighter coat and trousers with yellow reflective stripes, a black helmet with
a gold badge, black boots and a red hose. He sprays splashes of water. With this, no costume is a
placeholder any more. The first paint had five figures in the bottom row (the slicer needs four);
the second was right.
