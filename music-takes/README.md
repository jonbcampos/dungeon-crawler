# Music takes not in the game

Kept so nothing has to be regenerated to go back. The game plays `public/sounds/music.*.m4a`
(take A of the slow, moody round); these live outside `public/`, so they aren't deployed or
cached on phones.

| File | Round | Why it isn't in the game |
| --- | --- | --- |
| `*.take-b.m4a` | Slow and moody (current prompts) | The other take; Jonathan picked A for all three |
| `*.surf-rock.m4a` | Spooky surf rock | "Still too upbeat" |
| `*.circus.m4a` | First round | "A fun circus vibe", not Halloween |

To use one, copy it over `public/sounds/music.<track>.m4a` and bump `VERSION` in `public/sw.js`.
