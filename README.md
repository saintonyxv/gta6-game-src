# gta6-game-src — Vice Blocks

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/saintonyxv/gta6-game-src/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/saintonyxv/gta6-game-src/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Vice Blocks** is a top-down open-city driving/action game set in the fictional
sunset city of Neon Bay, built for the make.fun "Make GTA 6" bounty (gta6-01).
Walk the streets, steal cars and drive them, outrun the Neon Bay police, and
take three story jobs from the fixer Rosa Marín — a downtown pickup, a parcel
run across town, and a hot escape to the safehouse. Everything is original:
our own city, characters, vehicles, names, story, art and sounds. Nothing is
taken from any commercial game.

The city is a drivable street grid with neon downtown towers, parks, a beach
strip and the sea. Traffic cars cruise the streets, pedestrians walk the
sidewalks and flee from speeding cars, and a 1–5 wanted-star system brings
police cruisers that chase and ram you — lie low and the heat fades. The HUD
shows cash, wanted stars, the current objective with a timer, speed and car
health, plus a live minimap. Title, how-to, pause, game-over and
mission-complete screens are included, best cash is saved in localStorage,
and all sound is synthesised live with WebAudio (engine hum, sirens, crashes,
chimes and a bass-line loop) — no audio files. The game is pure vanilla JS +
Canvas 2D, fully offline, with zero network requests and no external assets.

## Controls

- WASD / arrow keys — walk and drive (W accelerate, S brake/reverse, A D steer)
- E — enter / exit a car (taking one raises your wanted level)
- Space — handbrake
- P — pause, M — mute, H — how to play, Enter — confirm / start

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

## Inventory

| File | Lines | What it does |
| --- | --- | --- |
| `game/index.html` | 19 | Page shell, canvas, favicon |
| `game/src/config.js` | 65 | Constants, sunset palette, seeded RNG, street math |
| `game/src/city.js` | 127 | Neon Bay layout: blocks, buildings, parks, beach, sea |
| `game/src/world.js` | 551 | Simulation: player, cars, traffic, peds, police, wanted, missions |
| `game/src/missions.js` | 105 | Rosa Marín's three jobs: pickup, parcel run, heat-wave escape |
| `game/src/render.js` | 494 | Drawing: city, cars, HUD, minimap, menus |
| `game/src/input.js` | 71 | Keyboard and pointer input |
| `game/src/audio.js` | 150 | WebAudio synth: engine, siren, crashes, chimes, bass loop |
| `game/src/shots.js` | 82 | Deterministic `?shot=` scenes for screenshots |
| `game/src/main.js` | 197 | Boot, game loop, screens, sound hooks |
| `main.ts` | 50 | Hand-in program: copies `game/` + `screenshots/` to `/output`, writes `dossier.json` |
| `serve.ts` | 72 | Tiny static server for local play (`node serve.ts`) |
| `shots.json` | — | The 4 screenshot scenes and their `?shot=` queries |

Totals: **10 game files, 1,861 lines of game code** (`game/` is 68,157 bytes);
**4 screenshots** (1280×720 JPEG, quality 75, each under 256 KiB):

- `screenshots/1-title.jpg` — title screen over the ambient city
- `screenshots/2-driving.jpg` — driving downtown on Rosa's first job
- `screenshots/3-wanted.jpg` — 4 wanted stars with police in pursuit
- `screenshots/4-mission.jpg` — mission-complete screen, +$150

Screenshots are real renders of the game's own code running in headless
Chrome, staged deterministically with `?shot=title|driving|wanted|mission`
and `seed=20261123`. The game was playtested end to end in the browser:
starting, stealing a car (wanted +1, police spawn), driving at full speed,
completing mission 1 (+$150), and surviving a 3-star police chase that
damaged the car.

<sub>Entered on [make.fun](https://make.fun/?ref=hv020zhf&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
