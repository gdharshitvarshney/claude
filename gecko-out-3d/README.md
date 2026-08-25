# Geckos & Burrows — a 3D thermometer puzzle

A logic puzzle played with cute, blinking geckos on a chunky 3D board, built with
[Three.js](https://threejs.org). No build step needed to play and no runtime
dependencies: `index.html` is a single self-contained file (Three.js is inlined),
so you can open it straight off disk or serve it from anywhere.

It is a 3D remake of a 2D canvas prototype, art-directed after Rollic's *Gecko
Out*. The rules and every gesture are the prototype's, unchanged.

## How to play

Each gecko lives in a **burrow** — a fixed path of cells with a **hole** at one
end. A gecko always fills its burrow from the hole outwards: it can be 0 cells
out, 1 cell out, 2 cells out, and so on. It can never skip a cell or leave a gap.

The numbers on the top and left edges say **how many cells in that row or column
must end up covered by gecko**. Slide every gecko to the right length so that
each row and each column matches its number exactly, and you win.

Every board is generated so that it has exactly one solution *and* can be reached
by pure deduction — you never have to guess.

## Controls

- **Tap** a cell — the gecko comes out to that cell, or pulls back in past it.
- **Drag** from a gecko — it follows your finger along the burrow, continuously.
- **Long-press** a cell — drops a wooden block on it. Blocked cells are ones
  you've decided the gecko can't reach, and it will never slide past one.
- **Tap a block** — sends the gecko all the way to it and clears that block.
- **Double-tap a hole** — all the way out, then again for all the way back in.

## Friction controls

Five toggles under *Friction controls* strip away the bookkeeping the game does
for you: live count-down numbers, solved lines settling green, pebbles on cells a
gecko can no longer reach, drag-to-slide, and double-tap shortcuts. Turn them all
off to feel the unreduced puzzle — the rules are identical either way.

## Tiers

| Tier | Grid | Notes |
| --- | --- | --- |
| Learn | 5×5 | Straight burrows, two geckos given |
| Easy | 6×6 | Straight burrows, one given |
| Medium | 6×6 | Burrows can bend |
| Hard | 7×7 | Longer bending burrows |
| Endless | 6×6 → 8×8 | Grows one row every five clears |

## Running it

Open `index.html`. That's it — it works from `file://`, from a static host, or
from anything that can serve one HTML file.

## Development

Sources live in `src/` as ES modules and are bundled and inlined into
`index.html` at build time.

```sh
npm install
npm run build          # src/ + three.js -> index.html
node build.mjs --dev   # same, unminified, for debugging
npm test               # generator soundness over hundreds of boards per tier
```

| File | What's in it |
| --- | --- |
| `src/puzzle.js` | Board generation, uniqueness and no-guess proof |
| `src/theme.js` | Every colour, proportion and timing in one object |
| `src/scene.js` | Renderer, camera framing, lighting |
| `src/board.js` | Slab, tiles, tunnels, holes, clue chips, blocks |
| `src/gecko.js` | Gecko mesh, blinking, idle motion, legs |
| `src/game.js` | State, gestures, drag feel, UI wiring |
| `src/audio.js` | Synthesised SFX and haptics |

`tools/` holds Playwright harnesses used during development — `play.mjs` drives
every gesture and asserts the rules hold, `motion.mjs` checks the idle animation
is really animating, `perf.mjs` profiles the frame, and `shot.mjs` / `portrait.mjs`
take screenshots for art review. They need Playwright and a Chromium build
available on the machine.

## A note on the art

The palette and proportions in `src/theme.js` are a first pass. Everything
visual is read from that one object, so an art revision is a single-file change
followed by `npm run build`.
