/* Game state, gestures and the frame loop.
   The rules, the gesture vocabulary and the friction toggles are the 2D
   prototype's, unchanged. What is new is that the visual length of a snake is
   continuous while its logical level stays whole: during a drag the body is
   glued to the finger, and the level commits as it crosses cell boundaries. */
import * as THREE from 'three';
import { TIERS, generate, mulberry } from './puzzle.js';
import { THEME, REDUCED } from './theme.js';
import { Stage } from './scene.js';
import { Board, axis, boardSpan } from './board.js';
import { Snake } from './snake.js';
import { SFX, sfx, unlock } from './audio.js';

const $ = id => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;

let stage, board, snakes = [], S = null;
let anim = [], vel = [], fast = [], dragTarget = [];
let tierName = 'Learn', endlessWins = 0;
let drag = null, press = null, tapMem = { i: -1, t: 0, before: 0, beforeCap: 0, pushed: false };
let dirty = true, lookPoint = new THREE.Vector3(), hasLook = false;
const opt = { count: true, dim: true, dots: true, drag: true, dbl: true };
const endlessSize = () => Math.min(8, 6 + Math.floor(endlessWins / 5));

/* ---------- state helpers (same shapes as the prototype) ---------- */
function counts() {
  const n = S.n, rows = new Array(n).fill(0), cols = new Array(n).fill(0);
  S.burrows.forEach((t, i) => { for (let k = 0; k < S.cur[i]; k++) { rows[t[k][0]]++; cols[t[k][1]]++; } });
  return { rows, cols };
}
function blockedFrom(cnt) {
  return S.burrows.map((t, i) => {
    for (let k = S.cur[i]; k < t.length; k++) {
      const [r, c] = t[k];
      if (cnt.rows[r] >= S.clues.rows[r] || cnt.cols[c] >= S.clues.cols[c]) return k;
    }
    return t.length;
  });
}

function badge() {
  const el = $('tierNote');
  if (tierName === 'Endless') {
    const s = endlessSize(), left = 5 - (endlessWins % 5);
    el.innerHTML = s >= 8 ? `${s}×${s} · max depth<br>${endlessWins} cleared`
                          : `${s}×${s} · ${left} more<br>to reach ${s + 1}×${s + 1}`;
  } else el.innerHTML = 'always solvable<br>without guessing';
}

function newPuzzle() {
  const base = TIERS[tierName];
  const cfg = tierName === 'Endless'
    ? { ...base, size: endlessSize(), maxLen: Math.min(7, endlessSize()) } : base;
  let p = null, guard = 0;
  while (!p && guard++ < 12) p = generate(cfg, mulberry((Math.random() * 1e9) | 0));
  if (!p) return;

  const n = cfg.size;
  const owner = Array.from({ length: n }, () => new Array(n).fill(null));
  p.cells.forEach((t, i) => t.forEach(([r, c], j) => owner[r][c] = [i, j]));
  const lockSet = new Set(p.locked);
  S = {
    n, burrows: p.cells, sol: p.levels, clues: p.clues, owner, lock: lockSet,
    cur: p.cells.map((t, i) => lockSet.has(i) ? p.levels[i] : 0),
    cap: p.cells.map(t => t.length),
    hist: [], moves: 0, hints: 0, t0: 0, solved: false,
  };
  anim = S.cur.slice(); vel = S.cur.map(() => 0);
  fast = S.cur.map(() => false); dragTarget = S.cur.map(() => null);

  const spin = (Math.random() * THEME.snakes.length) | 0;
  const colors = p.cells.map((_, i) => THEME.snakes[(i + spin) % THEME.snakes.length]);
  board.build(S, colors);
  snakes.forEach(s => s.dispose());
  snakes = p.cells.map((path, i) =>
    new Snake(stage.root, path, n, colors[i], lockSet.has(i), Math.random()));

  if (press) { clearTimeout(press.timer); press = null; }
  tapMem = { i: -1, t: 0, before: 0, beforeCap: 0, pushed: false };
  drag = null; dirty = true;
  $('win').classList.remove('on');
  $('moves').textContent = '0';
  $('time').textContent = '0:00';
  badge();
}

/* ---------- moves ---------- */
function apply(i, level, cap, record) {
  const pl = S.cur[i], pc = S.cap[i];
  if (pl === level && pc === cap) return false;
  if (record) {
    S.hist.push([i, pl, pc]); S.moves++;
    $('moves').textContent = S.moves;
  }
  S.cur[i] = level; S.cap[i] = cap;
  if (!S.t0) S.t0 = Date.now();
  dirty = true;
  if (level > pl) SFX.tick(level, S.burrows[i].length);
  else if (level < pl) SFX.retract();
  checkWin();
  return true;
}
const setLevel = (i, L, record) => apply(i, Math.min(L, S.cap[i]), S.cap[i], record);
const clearTap = () => tapMem = { i: -1, t: 0, before: 0, beforeCap: 0, pushed: false };
function endPress() { if (press) { clearTimeout(press.timer); press = null; } }

/* Long press replaces the tap that opened it: one gesture, one move, one undo. */
function longPress() {
  if (!press) return;
  const { i, j, before, beforeCap, pushed } = press;
  press = null; drag = null; clearTap();
  if (!S || S.solved) return;
  if (pushed && S.hist.length) S.hist.pop(); else S.moves++;
  S.hist.push([i, before, beforeCap]);
  $('moves').textContent = S.moves;
  if (!S.t0) S.t0 = Date.now();
  S.cur[i] = Math.min(before, j);       // the snake retreats out of blocked ground
  S.cap[i] = j;                         // block j .. tail
  dirty = true;
  SFX.cross();
  checkWin();
}

/* ---------- picking ---------- */
function cellAt(ev) {
  const p = stage.pick(ev, lookPoint);
  if (!p) return null;
  hasLook = true;
  const n = S.n;
  const c = Math.round(p.x + (n - 1) / 2);
  const r = Math.round(p.z + (n - 1) / 2);
  if (r < 0 || c < 0 || r >= n || c >= n) return null;
  return S.owner[r][c];
}

/** Continuous level for a finger at world point p, projected onto snake i's spine.
    Control points run two per cell, so a finger over the centre of cell m lands on
    index 2m+2 and asks for level m+1 — the same "fill up to my finger" rule the
    tap uses, just without the rounding. */
function levelAtPoint(i, p) {
  const pts = snakes[i].pts, N = snakes[i].N;
  let best = Infinity, bestIdx = 2;
  for (let k = 2; k < N - 1; k++) {           // skip the buried section
    const a = pts[k], b = pts[k + 1];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    let t = len2 > 1e-9 ? ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2 : 0;
    t = clamp(t, 0, 1);
    const qx = a.x + dx * t - p.x, qz = a.z + dz * t - p.z;
    const d = qx * qx + qz * qz;
    if (d < best) { best = d; bestIdx = k + t; }
  }
  return clamp(bestIdx / 2, 0, S.burrows[i].length);
}

/* ---------- input ---------- */
function onDown(ev) {
  if (!S || S.solved) return;
  unlock();
  const h = cellAt(ev); if (!h) return;
  hasLook = false;
  const [i, j] = h;
  if (S.lock.has(i)) { SFX.blocked(); return; }
  ev.preventDefault();
  try { stage.renderer.domElement.setPointerCapture(ev.pointerId); } catch (_) {}
  const now = Date.now();

  // second tap on a hole: all the way out (as far as the blocks allow), or back in
  if (opt.dbl && j === 0 && tapMem.i === i && now - tapMem.t < THEME.dblMs) {
    endPress();
    const before = tapMem.before, cap = tapMem.beforeCap;
    if (tapMem.pushed && S.hist.length) S.hist.pop(); else S.moves++;
    S.hist.push([i, before, cap]);
    $('moves').textContent = S.moves;
    const target = before >= cap ? 0 : cap;
    fast[i] = target === 0;
    clearTap(); drag = null;
    if (!S.t0) S.t0 = Date.now();
    S.cur[i] = target; S.cap[i] = cap;
    dirty = true;
    (target === 0 ? SFX.retract : SFX.line)();
    checkWin();
    return;
  }

  const before = S.cur[i], beforeCap = S.cap[i];
  // tapping a block sends the snake to it and clears only that one block;
  // otherwise the tapped cell toggles — the snake pulls in past it, or comes out to it
  const pushed = j >= beforeCap
    ? apply(i, j + 1, j + 1, true)
    : apply(i, j < before ? j : j + 1, beforeCap, true);
  tapMem = { i, t: now, before, beforeCap, pushed };
  if (opt.drag) drag = { i, from: S.cur[i] };
  press = {
    i, j, before, beforeCap, pushed, x: ev.clientX, y: ev.clientY, start: now,
    timer: setTimeout(longPress, THEME.holdMs),
  };
}

function onMove(ev) {
  if (!S) return;
  if (press && (Math.abs(ev.clientX - press.x) > 9 || Math.abs(ev.clientY - press.y) > 9)) endPress();
  if (!drag || S.solved) return;
  const evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
  const last = evs[evs.length - 1] || ev;
  const p = stage.pick(last, lookPoint);
  if (!p) return;
  hasLook = true;   // only set here, so eyes track a drag and not an idle cursor
  const i = drag.i;
  const raw = levelAtPoint(i, p);
  const target = clamp(raw, 0, S.cap[i]);
  dragTarget[i] = target;
  // commit whole cells with a deadband so a finger parked on a boundary is calm
  const want = Math.round(target);
  if (want !== S.cur[i] && Math.abs(target - S.cur[i]) > 0.5 + THEME.commitHyst) {
    setLevel(i, want, false);
    endPress();          // this is a slide now, not a press-and-hold
  }
}

function onUp() {
  endPress();
  if (drag) { dragTarget[drag.i] = null; drag = null; }
  hasLook = false;                 // eyes drift back to their resting gaze
}

/** a snake sitting wholly inside a line that just completed gets a little wiggle */
function celebrate(done, before) {
  const n = S.n;
  snakes.forEach((g, i) => {
    if (S.cur[i] === 0) return;
    const cells = S.burrows[i].slice(0, S.cur[i]);
    const hit = cells.some(([r, c]) =>
      (done[r] && !before[r]) || (done[n + c] && !before[n + c]));
    if (hit) g.cheer(0.55);
  });
}

/* ---------- win / clock ---------- */
function checkWin() {
  const c = counts();
  for (let i = 0; i < S.n; i++)
    if (c.rows[i] !== S.clues.rows[i] || c.cols[i] !== S.clues.cols[i]) return;
  S.solved = true;
  snakes.forEach((s, i) => s.cheer(0.8 + i * 0.05));
  SFX.win();
  const secs = S.t0 ? Math.round((Date.now() - S.t0) / 1000) : 0;
  let extra = '';
  if (tierName === 'Endless') {
    const before = endlessSize(); endlessWins++; save();
    if (endlessSize() > before) extra = ` · grid grows to ${endlessSize()}×${endlessSize()}`;
    badge();
  }
  $('winStat').textContent =
    `${fmt(secs)} · ${S.moves} moves${S.hints ? ` · ${S.hints} hints` : ''}${extra}`;
  setTimeout(() => $('win').classList.add('on'), 900);
}
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/* ---------- storage ---------- */
async function save() {
  try {
    if (window.storage) {
      await window.storage.set('snakes:endless', String(endlessWins));
      await window.storage.set('snakes:mute', sfx.muted ? '1' : '0');
    } else {
      localStorage.setItem('snakes:endless', String(endlessWins));
      localStorage.setItem('snakes:mute', sfx.muted ? '1' : '0');
    }
  } catch (_) {}
}
async function load() {
  try {
    const get = async k => window.storage
      ? (await window.storage.get(k))?.value : localStorage.getItem(k);
    endlessWins = parseInt(await get('snakes:endless'), 10) || 0;
    sfx.muted = (await get('snakes:mute')) === '1';
  } catch (_) {}
}

/* ---------- frame loop ---------- */
let last = 0, clockAcc = 0, lineDone = null;
function loop(now) {
  requestAnimationFrame(loop);
  const t = now / 1000;
  const dt = Math.min(0.05, last ? t - last : 0.016);
  last = t;
  if (!S) return;

  // dt-aware critically damped spring: same feel at 60 and 120 Hz
  for (let i = 0; i < S.cur.length; i++) {
    const goal = dragTarget[i] != null ? dragTarget[i] : S.cur[i];
    const w = dragTarget[i] != null ? THEME.dragSpring
            : fast[i] ? THEME.springIn : THEME.springOut;
    const x = anim[i] - goal;
    const e = Math.exp(-w * dt);
    const nx = (x + (vel[i] + w * x) * dt) * e;
    const nv = (vel[i] - (vel[i] + w * x) * w * dt) * e;
    anim[i] = clamp(goal + nx, 0, S.burrows[i].length);
    vel[i] = nv;
    if (Math.abs(anim[i] - goal) < 0.002 && Math.abs(vel[i]) < 0.002) {
      anim[i] = goal; vel[i] = 0; if (dragTarget[i] == null) fast[i] = false;
    }
  }

  const cnt = counts();
  if (dirty) {
    board.setBlocked(S, blockedFrom(cnt), opt.dots && !S.solved);
    const done = [...cnt.rows.map((v, i) => v === S.clues.rows[i]),
                  ...cnt.cols.map((v, i) => v === S.clues.cols[i])];
    if (lineDone && !S.solved) {
      let gained = 0;
      for (let i = 0; i < done.length; i++) if (done[i] && !lineDone[i]) gained++;
      if (gained) { SFX.line(); celebrate(done, lineDone); }
    }
    lineDone = done;
    dirty = false;
  }
  board.update(S, cnt, opt, dt);
  board.setHold(press ? S.burrows[press.i][press.j] : null,
    press ? Math.min(1, (Date.now() - press.start) / THEME.holdMs) : 0, S.n);

  for (let i = 0; i < snakes.length; i++)
    snakes[i].update(anim[i], dt, t, drag && hasLook ? lookPoint : null);

  if (S.t0 && !S.solved) {
    clockAcc += dt;
    if (clockAcc > 0.25) {
      clockAcc = 0;
      $('time').textContent = fmt(Math.round((Date.now() - S.t0) / 1000));
    }
  }
  stage.render();
}

/* ---------- boot ---------- */
export async function main() {
  const canvas = $('cv');
  stage = new Stage(canvas);
  board = new Board(stage);

  const tiersEl = $('tiers');
  Object.keys(TIERS).forEach(k => {
    const b = document.createElement('button');
    b.className = 'tier'; b.textContent = k;
    b.setAttribute('aria-pressed', k === tierName);
    b.onclick = () => {
      tierName = k;
      [...tiersEl.children].forEach(x => x.setAttribute('aria-pressed', x.textContent === k));
      newPuzzle();
    };
    tiersEl.appendChild(b);
  });

  $('new').onclick = newPuzzle;
  $('next').onclick = newPuzzle;
  $('undo').onclick = () => {
    if (!S || !S.hist.length || S.solved) return;
    const [i, L, C] = S.hist.pop();
    S.cur[i] = L; S.cap[i] = C; dirty = true; SFX.undo();
  };
  $('hint').onclick = () => {
    if (!S || S.solved) return;
    const wrong = S.cur.map((v, i) => v !== S.sol[i] ? i : -1).filter(i => i >= 0);
    if (!wrong.length) return;
    const i = wrong[(Math.random() * wrong.length) | 0];
    S.hints++;
    apply(i, S.sol[i], S.burrows[i].length, true);
    S.lock.add(i);
    snakes[i].locked = true;
  };
  const muteBtn = $('mute');
  const paintMute = () => {
    muteBtn.setAttribute('aria-pressed', String(!sfx.muted));
    const wave = document.getElementById('wave');
    if (wave) wave.style.opacity = sfx.muted ? '0' : '1';
  };
  muteBtn.onclick = () => { sfx.muted = !sfx.muted; paintMute(); save(); };

  // friction toggles live behind the gear in the HUD now, not in a page-long panel
  const sheet = $('sheet'), scrim = $('scrim');
  const showSheet = on => { sheet.classList.toggle('on', on); scrim.classList.toggle('on', on); };
  $('settings').onclick = () => showSheet(true);
  $('sheetClose').onclick = () => showSheet(false);
  scrim.onclick = () => showSheet(false);
  addEventListener('keydown', e => { if (e.key === 'Escape') showSheet(false); });

  [['t_count', 'count'], ['t_dim', 'dim'], ['t_dots', 'dots'],
   ['t_drag', 'drag'], ['t_dbl', 'dbl']].forEach(([id, key]) => {
    const el = $(id);
    if (el) el.onchange = e => { opt[key] = e.target.checked; dirty = true; };
  });

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  addEventListener('pointerup', onUp);
  addEventListener('pointercancel', onUp);
  addEventListener('resize', () => stage.resize());
  // the board is a flex child, so it resizes without the window ever changing
  new ResizeObserver(() => stage.resize()).observe(canvas.parentElement);

  // a small handle for tests and tuning; harmless in production
  window.__game = {
    get S() { return S; }, get snakes() { return snakes; }, get anim() { return anim; },
    get drag() { return drag; }, get dragTarget() { return dragTarget; },
    opt, newPuzzle, stage, board, cellAt, levelAtPoint,
  };

  await load();
  paintMute();
  newPuzzle();
  requestAnimationFrame(loop);
  if (document.fonts) document.fonts.ready.then(() => {
    board.chipCanvas.forEach(c => { c.last = null; });   // redraw once Fredoka lands
    dirty = true;
  });
}
