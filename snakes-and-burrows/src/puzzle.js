/* Puzzle generation — ported from the 2D prototype.
   Every board it returns is provably unique AND solvable by line propagation
   alone, i.e. no guessing is ever required. */

/* ---------- grid packing ---------- */
export function packGrid(size, maxLen, allowBends, rng) {
  const owner = Array.from({ length: size }, () => new Array(size).fill(-1));
  const inb = (r, c) => r >= 0 && r < size && c >= 0 && c < size;
  const D = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  const freeN = (r, c) => D.reduce((n, [dr, dc]) =>
    n + (inb(r + dr, c + dc) && owner[r + dr][c + dc] === -1 ? 1 : 0), 0);

  const burrows = [];
  for (;;) {
    const empties = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++)
      if (owner[r][c] === -1) empties.push([r, c]);
    if (!empties.length) break;

    // start from the most constrained empty cell to avoid stranding singletons
    let best = 9, pool = [];
    for (const [r, c] of empties) {
      const n = freeN(r, c);
      if (n < best) { best = n; pool = [[r, c]]; } else if (n === best) pool.push([r, c]);
    }
    const start = pool[(rng() * pool.length) | 0];
    const id = burrows.length;
    const path = [start];
    owner[start[0]][start[1]] = id;

    const target = 2 + ((rng() * (maxLen - 1)) | 0);
    let dir = null;
    while (path.length < target) {
      const [r, c] = path[path.length - 1];
      const dirs = (!allowBends && dir) ? [dir] : D;
      const cands = [];
      for (const [dr, dc] of dirs) {
        const nr = r + dr, nc = c + dc;
        if (inb(nr, nc) && owner[nr][nc] === -1) cands.push([nr, nc, dr, dc]);
      }
      if (!cands.length) break;
      let b = 9, p = [];
      for (const cd of cands) {
        const n = freeN(cd[0], cd[1]);
        if (n < b) { b = n; p = [cd]; } else if (n === b) p.push(cd);
      }
      const ch = p[(rng() * p.length) | 0];
      path.push([ch[0], ch[1]]);
      owner[ch[0]][ch[1]] = id;
      dir = [ch[2], ch[3]];
    }
    burrows.push(path);
  }
  const singles = burrows.filter(t => t.length === 1).length;
  if (singles > Math.max(1, Math.floor(size / 2))) return null;
  for (const t of burrows) if (rng() < 0.5) t.reverse();
  return burrows;
}

/* ---------- precompute row/col prefix contributions ---------- */
export function prep(burrows, size) {
  return burrows.map(cells => {
    const L = cells.length, rp = [], cp = [];
    const rr = new Array(size).fill(0), cc = new Array(size).fill(0);
    rp.push(rr.slice()); cp.push(cc.slice());
    for (let i = 0; i < L; i++) {
      rr[cells[i][0]]++; cc[cells[i][1]]++;
      rp.push(rr.slice()); cp.push(cc.slice());
    }
    return { cells, L, rp, cp, maxR: rp[L], maxC: cp[L] };
  });
}

export function cluesFrom(T, levels, size) {
  const rows = new Array(size).fill(0), cols = new Array(size).fill(0);
  T.forEach((t, i) => {
    for (let r = 0; r < size; r++) rows[r] += t.rp[levels[i]][r];
    for (let c = 0; c < size; c++) cols[c] += t.cp[levels[i]][c];
  });
  return { rows, cols };
}

/* ---------- line propagation: proves no-guess solvability ---------- */
export function propagate(T, clues, size, fixed) {
  const dom = T.map((t, i) =>
    (fixed && fixed[i] != null) ? [fixed[i]] : [...Array(t.L + 1).keys()]);
  let changed = true, guard = 0;
  while (changed && guard++ < 300) {
    changed = false;
    for (let axis = 0; axis < 2; axis++) {
      const key = axis === 0 ? 'rp' : 'cp';
      const mk = axis === 0 ? 'maxR' : 'maxC';
      const clue = axis === 0 ? clues.rows : clues.cols;
      for (let line = 0; line < size; line++) {
        const mn = [], mx = [];
        let minS = 0, maxS = 0;
        for (let i = 0; i < T.length; i++) {
          const d = dom[i];
          if (!d.length) return null;
          let a = 1e9, b = -1e9;
          for (const L of d) { const v = T[i][key][L][line]; if (v < a) a = v; if (v > b) b = v; }
          mn[i] = a; mx[i] = b; minS += a; maxS += b;
        }
        if (minS > clue[line] || maxS < clue[line]) return null;
        for (let i = 0; i < T.length; i++) {
          if (T[i][mk][line] === 0) continue;
          const oMin = minS - mn[i], oMax = maxS - mx[i];
          const nd = dom[i].filter(L => {
            const v = T[i][key][L][line];
            return v + oMin <= clue[line] && v + oMax >= clue[line];
          });
          if (nd.length !== dom[i].length) {
            if (!nd.length) return null;
            dom[i] = nd; changed = true;
            let a = 1e9, b = -1e9;
            for (const L of nd) { const v = T[i][key][L][line]; if (v < a) a = v; if (v > b) b = v; }
            minS += a - mn[i]; maxS += b - mx[i]; mn[i] = a; mx[i] = b;
          }
        }
      }
    }
  }
  return dom;
}

export function generate(cfg, rng) {
  const { size, maxLen, bends, prefill } = cfg;
  for (let attempt = 0; attempt < 6000; attempt++) {
    const raw = packGrid(size, maxLen, bends, rng);
    if (!raw) continue;
    const T = prep(raw, size);
    const levels = T.map(t => (rng() * (t.L + 1)) | 0);
    const filled = levels.reduce((a, b) => a + b, 0);
    if (filled < size * size * 0.25 || filled > size * size * 0.7) continue;
    const clues = cluesFrom(T, levels, size);

    const idx = [...Array(T.length).keys()];
    for (let i = idx.length - 1; i > 0; i--) {          // proper Fisher-Yates
      const j = (rng() * (i + 1)) | 0;
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    // A given still fully inside its hole shows nothing, so it reads as a snake
    // the player simply failed to move. Prefer givens that are visible.
    idx.sort((a, b) => (levels[b] > 0) - (levels[a] > 0));
    const locked = idx.slice(0, prefill);
    const fixed = new Array(T.length).fill(null);
    for (const i of locked) fixed[i] = levels[i];

    // Propagation is sound: it never discards a level that belongs to a valid
    // solution. So if every domain collapses to one value, that value IS the
    // only solution — this proves uniqueness AND no-guess solvability at once,
    // without ever running the exponential backtracking solver.
    const dom = propagate(T, clues, size, fixed);
    if (!dom || !dom.every(d => d.length === 1)) continue;
    return { cells: raw, levels, clues, locked, attempt };
  }
  return null;
}

/* ---------- rng ---------- */
export function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- tiers ---------- */
export const TIERS = {
  Learn:   { size: 5, maxLen: 4, bends: false, prefill: 2 },
  Easy:    { size: 6, maxLen: 5, bends: false, prefill: 1 },
  Medium:  { size: 6, maxLen: 5, bends: true,  prefill: 0 },
  Hard:    { size: 7, maxLen: 6, bends: true,  prefill: 0 },
  Endless: { size: 6, maxLen: 7, bends: true,  prefill: 0 },
};
