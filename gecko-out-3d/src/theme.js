/* Every colour, proportion and timing lives here so the art pass is one file.
   Lengths are in cells (1 cell = 1 world unit); times are in seconds. */

export const THEME = {
  /* ---- palette (placeholder until the reference frames are matched) ---- */
  bgTop:      '#8FE9FF',
  bgBottom:   '#31B4E4',

  frame:      '#17A398',   // board rim around the playfield
  frameEdge:  '#0E7F76',
  tile:       '#F6E3B8',   // playable cell
  tileAlt:    '#F0DAA9',   // checker shade
  tileMargin: '#EFD9AE',   // the clue-chip gutter
  tileSolved: '#CFEBC8',   // cell sitting in a finished row AND column

  chip:       '#FFF7E6',
  chipInk:    '#4A3B28',
  chipDone:   '#2CB67D',
  chipOver:   '#E5484D',

  hole:       '#2A1D14',   // inside of a burrow
  holeDeep:   '#140D08',
  block:      '#B0784E',   // the wooden block a long-press drops on a cell
  blockTop:   '#C98F5F',
  dot:        '#8A6C46',   // "a gecko can no longer reach this cell" pip

  /* neon gecko colours, assigned round-robin per burrow */
  geckos: [
    '#FF4D6D', '#FF8A00', '#FFD400', '#3DDC84',
    '#00C2FF', '#6C5CE7', '#FF5FD2', '#B4FF39',
  ],
  geckoBelly: 0.55,        // how far the belly colour is lightened toward white
  locked:     '#A794D6',   // a given: sleepy, not draggable
  eyeWhite:   '#FFFFFF',
  pupil:      '#1A1420',

  /* ---- proportions, in cells ---- */
  tileSize:   0.92,
  tileGap:    0.08,
  tileH:      0.30,
  tileRadius: 0.09,
  slabH:      0.62,
  slabRadius: 0.22,
  slabMargin: 0.42,        // extra board beyond the outermost chip gutter

  tunnelW:    0.46,
  tunnelTint: 0.5,         // how far the track is tinted toward its gecko's colour
  tunnelLift: 0.012,       // above the tile top, avoids z-fighting

  holeR:      0.33,
  holeDepth:  0.62,
  holeRimR:   0.055,

  chipSize:   0.74,
  chipH:      0.24,
  chipRadius: 0.11,

  bodyR:      0.185,       // gecko body radius at the shoulders
  bodyTail:   0.42,        // radius at the hole end, as a fraction of bodyR
  bodyFlat:   0.78,        // vertical squash of the body tube
  headR:      0.30,
  eyeR:       0.150,
  eyeSpread:  0.60,        // eye separation as a fraction of head radius
  eyeRise:    0.44,        // how far up the head the eyes sit
  legLen:     0.34,
  legR:       0.055,

  blockSize:  0.56,
  blockH:     0.30,

  /* ---- motion ---- */
  springOut:  15,          // rad/s of the critically damped slide, extending
  springIn:   26,          // …and retracting, which the prototype makes snappier
  dragSpring: 42,          // finger-follow stiffness; high = glued to the finger
  commitHyst: 0.12,        // cell fraction of hysteresis before a level commits

  idleAmp:    0.055,       // lateral body sway, in cells
  idleWaves:  1.35,        // sway periods per cell of body
  idleSpeed:  1.25,        // rad/s
  breathAmp:  0.055,       // body radius pulse
  breathSpeed: 1.9,
  blinkMin:   2.2,
  blinkMax:   6.5,
  blinkDur:   0.13,
  lookSpeed:  7,           // pupil tracking stiffness

  stepPerCell: 2.3,        // leg strides per cell travelled
  stepLift:   0.075,

  /* ---- camera ---- */
  fov:        30,
  tiltDeg:    17,          // off vertical: near top-down, just enough for depth
  parallax:   0.035,       // how far the camera drifts with the pointer

  holdMs:     430,         // long-press to cross out (same as the prototype)
  dblMs:      340,
};

export const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
