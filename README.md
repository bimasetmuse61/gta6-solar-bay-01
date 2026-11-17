# Solar Bay

An original open-world crime game for the make.fun **gta6-01** bounty —
built in the spirit of GTA 6, with nothing from any commercial game.

Maya "Rook" Alvarez, a courier with a debt, takes five jobs from Rosa's
garage in the sun-soaked coastal city of Solar Bay: steal a car, run
parcels, lose the heat, clear the warehouse, and steal the gold Comet
from the Marina.

## Play

```sh
node serve.ts   # then open http://localhost:8080
```

- **WASD / arrows** — move on foot, drive in a car
- **Shift** — run · **Space** — handbrake
- **E** — steal / enter / exit a car
- **Mouse aim, Click** — shoot · **R** — reload
- **Q** — save · **P** — pause · **M** — mute

The city has traffic, pedestrians, police who chase you as your wanted
level rises, a minimap, a mission tracker, and a save (localStorage).

## Structure

- `game/index.html` + `game/style.css` — the page
- `game/src/config.js` — tuning numbers and palette
- `game/src/random.js` — seeded RNG
- `game/src/city.js` — the generated city (roads, buildings, parks, beach)
- `game/src/entities.js` — traffic, pedestrians, police
- `game/src/missions.js` — the five story missions
- `game/src/world.js` — the simulation (driving, combat, wanted, saves)
- `game/src/render.js` — canvas drawing, HUD, minimap, menus
- `game/src/audio.js` — synthesized WebAudio sound, no audio files
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=…`)
- `game/src/input.js` — keyboard + mouse
- `main.ts` — the entry program (copies game/ + screenshots/ to /output)

Screenshots are real renders of the game in headless Chrome; see
`shots.json` for the scene each one stages.
