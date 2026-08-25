/* Every colour, proportion and timing lives here so the art pass is one file.
   Lengths are in cells (1 cell = 1 world unit); times are in seconds.

   Art references: Snake Pass for the characters — oversized blue eyes, heavy
   brow, cream muzzle, wide smile — and a flat sheet with the play area carved
   into it behind a rounded white lip for the board. */

export const THEME = {
  /* ---- background ---- */
  bgTop:      '#EEF3F8',
  bgBottom:   '#D6E0EA',

  /* ---- the carved board ---- */
  surface:    '#EDF1F6',   // the flat sheet the grid is cut into
  lip:        '#FFFFFF',   // rounded white border around the cut
  recess:     '#7C8899',   // the wall and floor of the cut
  cell:       '#8D99AA',   // a playable cell
  cellAlt:    '#94A0B1',   // faint checker
  cellSolved: '#7FB6A2',   // a cell in a row AND column that is finished

  chip:       '#FFFFFF',
  chipInk:    '#4A5563',
  chipDone:   '#34B27B',
  chipOver:   '#E8615B',

  hole:       '#1B222C',
  holeDeep:   '#0C1016',
  block:      '#B98A5C',   // the wooden block a long-press drops on a cell
  dot:        '#5E6B7C',   // "a snake can no longer reach this cell" pip

  /* saturated snake colours, assigned round-robin per burrow */
  snakes: [
    '#F0553F', '#FF9E2C', '#F6C324', '#5CC94F',
    '#35B7E8', '#7C6BF0', '#F062B4', '#22C7A9',
  ],
  belly:      '#F7E7BC',   // muzzle and underside
  iris:       '#2AA6E8',   // Snake Pass blue, on every snake
  pupil:      '#141A24',
  mouth:      '#8C2E3A',
  tongue:     '#E8556E',
  locked:     '#A8A2C4',   // a given: sleepy, not draggable

  /* ---- proportions, in cells ---- */
  cellSize:   0.94,
  cellH:      0.06,        // cells are nearly flat; the carve gives the depth
  cellRadius: 0.10,
  carveDepth: 0.20,        // how far the play area sits below the sheet
  carvePad:   0.10,        // cut edge, beyond the outermost cell
  carveRadius: 0.55,       // corner rounding of the cut
  lipWidth:   0.17,
  sheetPad:   1.15,        // sheet beyond the cut — the clue chips live here
  sheetH:     0.55,
  sheetRadius: 0.60,
  gutter:     0.64,        // chip centre, out from the cut edge

  tunnelW:    0.72,
  tunnelLift: 0.014,
  tunnelTint: 0.30,

  holeR:      0.34,
  holeDepth:  0.66,
  ringLobes:  11,          // the scalloped collar around each burrow mouth
  ringDepth:  0.055,

  chipSize:   0.74,
  chipH:      0.20,
  chipRadius: 0.16,

  bodyR:      0.292,       // thick, like the reference
  bodyTail:   0.46,        // radius at the hole end, as a fraction of bodyR
  bodyFlat:   0.86,
  scaleBump:  0.018,       // gentle bumps along the back
  scaleFreq:  3.4,         // bumps per cell

  headR:      0.335,
  headLift:   0.30,        // the neck arcs up so the face reads from overhead
  headLiftRun: 1.25,       // over this many cells of body
  eyeR:       0.196,
  eyeSpread:  0.55,
  eyeRise:    0.46,
  browR:      0.112,
  headPitch:  0.44,        // tips the face up toward an almost-overhead camera

  blockSize:  0.56,
  blockH:     0.30,

  /* ---- motion ---- */
  springOut:  15,
  springIn:   26,
  dragSpring: 42,
  commitHyst: 0.12,

  idleAmp:    0.05,
  idleWaves:  1.2,
  idleSpeed:  1.15,
  breathAmp:  0.05,
  breathSpeed: 1.8,
  blinkMin:   2.2,
  blinkMax:   6.5,
  blinkDur:   0.13,
  lookSpeed:  7,

  tongueMin:  2.6,         // idle tongue flicks
  tongueMax:  7.5,
  tongueDur:  0.85,

  /* ---- camera ---- */
  fov:        30,
  tiltDeg:    19,

  holdMs:     430,
  dblMs:      340,
};

export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
