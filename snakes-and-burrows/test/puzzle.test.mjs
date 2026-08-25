/* Generator soundness: run with `node test/puzzle.test.mjs`.
   Asserts every generated board is a legal packing, that its clues match its
   solution, and that line propagation alone pins every snake — the property the
   game leans on to promise "always solvable without guessing". */
import { TIERS, generate, prep, cluesFrom, propagate, mulberry } from '../src/puzzle.js';

const PER_TIER = Number(process.argv[2] || 200);
let failures = 0;

const fail = (tier, seed, msg) => {
  failures++;
  console.error(`  FAIL ${tier} seed=${seed}: ${msg}`);
};

for (const [tier, base] of Object.entries(TIERS)) {
  const t0 = Date.now();
  let attempts = 0, empty = 0;
  for (let s = 0; s < PER_TIER; s++) {
    const seed = s * 7919 + 13;
    const cfg = tier === 'Endless' ? { ...base, size: 8, maxLen: 7 } : base;
    const p = generate(cfg, mulberry(seed));
    if (!p) { empty++; continue; }
    attempts += p.attempt;
    const n = cfg.size;

    // 1. the burrows tile the grid exactly once
    const seen = Array.from({ length: n }, () => new Array(n).fill(0));
    for (const path of p.cells) {
      for (let k = 0; k < path.length; k++) {
        const [r, c] = path[k];
        if (r < 0 || c < 0 || r >= n || c >= n) fail(tier, seed, `cell out of grid ${r},${c}`);
        else seen[r][c]++;
        if (k) { // consecutive cells must be orthogonally adjacent
          const [pr, pc] = path[k - 1];
          if (Math.abs(pr - r) + Math.abs(pc - c) !== 1)
            fail(tier, seed, `burrow jumps ${pr},${pc} -> ${r},${c}`);
        }
      }
    }
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
      if (seen[r][c] !== 1) fail(tier, seed, `cell ${r},${c} covered ${seen[r][c]}x`);

    // 2. bends only where the tier allows them
    if (!cfg.bends) {
      for (const path of p.cells) {
        for (let k = 2; k < path.length; k++) {
          const a = path[k - 2], b = path[k - 1], c2 = path[k];
          if ((b[0] - a[0]) !== (c2[0] - b[0]) || (b[1] - a[1]) !== (c2[1] - b[1]))
            fail(tier, seed, 'bend in a straight-only tier');
        }
      }
    }

    // 3. the stated solution really produces the stated clues
    const T = prep(p.cells, n);
    const back = cluesFrom(T, p.levels, n);
    for (let i = 0; i < n; i++) {
      if (back.rows[i] !== p.clues.rows[i]) fail(tier, seed, `row ${i} clue mismatch`);
      if (back.cols[i] !== p.clues.cols[i]) fail(tier, seed, `col ${i} clue mismatch`);
    }

    // 4. propagation alone pins every snake to that solution — unique + no-guess
    const fixed = new Array(T.length).fill(null);
    for (const i of p.locked) fixed[i] = p.levels[i];
    const dom = propagate(T, p.clues, n, fixed);
    if (!dom) { fail(tier, seed, 'propagation contradicted a valid board'); continue; }
    for (let i = 0; i < dom.length; i++) {
      if (dom[i].length !== 1) fail(tier, seed, `snake ${i} left ${dom[i].length} options`);
      else if (dom[i][0] !== p.levels[i]) fail(tier, seed, `snake ${i} pinned to the wrong level`);
    }

    // 5. givens are honoured
    if (p.locked.length !== cfg.prefill) fail(tier, seed, 'wrong number of givens');
  }
  const ms = Date.now() - t0;
  console.log(`${tier.padEnd(8)} ${PER_TIER} boards  ${String(ms).padStart(5)}ms  ` +
    `${(attempts / PER_TIER).toFixed(1)} retries/board` + (empty ? `  ${empty} EMPTY` : ''));
  if (empty) failures += empty;
}

console.log(failures ? `\n${failures} failure(s)` : '\nall good');
process.exit(failures ? 1 : 0);
