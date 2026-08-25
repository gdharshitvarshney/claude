# Snakes & Burrows — a 3D thermometer puzzle

A logic puzzle played with cute, blinking snakes on a board carved out of a flat
sheet, built with
[Three.js](https://threejs.org). No build step needed to play and no runtime
dependencies: `index.html` is a single self-contained file (Three.js is inlined),
so you can open it straight off disk or serve it from anywhere.

It is a 3D remake of a 2D canvas prototype. The characters are art-directed after
*Snake Pass* — oversized eyes under a heavy brow, cream muzzle, wide grin — and
the board after a flat sheet with the play area cut into it behind a rounded
white lip. The rules and every gesture are the prototype's, unchanged.

## How to play

Every snake on a board shares one colour — a level is red, or purple, or green —
so the eye reads shape and length rather than sorting hues. A **given** (a snake
the puzzle starts with placed) is that same colour, washed out, and cannot be
dragged.

Each snake lives in a **burrow** — a fixed path of cells with a **hole** at one
end. A snake always fills its burrow from the hole outwards: it can be 0 cells
out, 1 cell out, 2 cells out, and so on. It can never skip a cell or leave a gap.

The numbers on the top and left edges say **how many cells in that row or column
must end up covered by snake**. Slide every snake to the right length so that
each row and each column matches its number exactly, and you win.

Every board is generated so that it has exactly one solution *and* can be reached
by pure deduction — you never have to guess.

## Controls

- **Tap** a cell — the snake comes out to that cell, or pulls back in past it.
- **Drag** from a snake — it follows your finger along the burrow, continuously.
- **Long-press** a cell — drops a wooden block on it. Blocked cells are ones
  you've decided the snake can't reach, and it will never slide past one.
- **Tap a block** — sends the snake all the way to it and clears that block.
- **Double-tap a hole** — all the way out, then again for all the way back in.

## Friction controls

Five toggles behind the gear in the top HUD strip away the bookkeeping the game does
for you: live count-down numbers, solved lines settling green, pebbles on cells a
snake can no longer reach, drag-to-slide, and double-tap shortcuts. Turn them all
off to feel the unreduced puzzle — the rules are identical either way.

## Camera

The gear also holds tilt, rotation and zoom sliders. The board can be viewed
from almost overhead or swung round to a low three-quarter angle, and the
framing recomputes so the whole board stays in shot at any angle. Your setting
is saved between sessions; *Reset camera* returns to the default.

## Tiers

| Tier | Grid | Notes |
| --- | --- | --- |
| Learn | 5×5 | Straight burrows, two snakes given |
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
| `src/snake.js` | Snake mesh, face, blinking, tongue flicks, idle motion |
| `src/game.js` | State, gestures, drag feel, UI wiring |
| `src/audio.js` | Synthesised SFX and haptics |

`tools/` holds Playwright harnesses used during development — `play.mjs` drives
every gesture and asserts the rules hold, `motion.mjs` checks the idle animation
is really animating, `perf.mjs` profiles the frame, and `shot.mjs` / `portrait.mjs`
take screenshots for art review. They need Playwright and a Chromium build
available on the machine.

## A note on the art

Every colour, proportion and timing is read from `src/theme.js`, so an art
revision is a single-file change followed by `npm run build` — no hunting for
hard-coded values through the geometry code.
