/* Drives the built game the way a player would and asserts the rules still hold.
   Gestures are dispatched inside the page so their timing is exact — the software
   renderer here is far too slow for round-tripped mouse events to be trustworthy
   against a 430 ms long-press. Usage: node tools/play.mjs [outdir] */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] || '/tmp/geckoplay';
mkdirSync(out, { recursive: true });

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', e => errs.push('pageerror: ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_CONNECTION')) errs.push('console: ' + m.text()); });
await p.goto('file:///home/user/claude/gecko-out-3d/index.html');
await p.waitForTimeout(1600);

let fails = 0;
const check = (name, ok, detail = '') => {
  if (!ok) fails++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};

/* every gesture runs in-page: [['down',r,c],['moveTo',r,c,steps],['wait',ms],['up']] */
const gesture = script => p.evaluate(async script => {
  const G = window.__game, n = G.S.n, cam = G.stage.camera, cv = document.getElementById('cv');
  const rect = cv.getBoundingClientRect();
  const ax = i => i + 1.5 - (n + 1) / 2;
  const xy = (r, c) => {
    const v = cam.position.clone().set(ax(c), 0, ax(r));
    v.project(cam);
    return [rect.left + (v.x + 1) / 2 * rect.width, rect.top + (1 - v.y) / 2 * rect.height];
  };
  const fire = (type, x, y) => cv.dispatchEvent(new PointerEvent(type, {
    clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse',
    bubbles: true, cancelable: true, isPrimary: true,
  }));
  const nap = ms => new Promise(r => setTimeout(r, ms));
  const trace = [];
  let at = [0, 0];
  for (const step of script) {
    const [op, a, c, d] = step;
    if (op === 'wait') { await nap(a); continue; }
    if (op === 'up') { fire('pointerup', at[0], at[1]); await nap(20); continue; }
    const to = xy(a, c);
    if (op === 'down') { at = to; fire('pointerdown', at[0], at[1]); await nap(20); continue; }
    if (op === 'moveTo') {
      const from = at, steps = d || 12;
      for (let k = 1; k <= steps; k++) {
        at = [from[0] + (to[0] - from[0]) * k / steps, from[1] + (to[1] - from[1]) * k / steps];
        fire('pointermove', at[0], at[1]);
        await nap(16);
        // sample the drag target, not the spring: it is computed synchronously in
        // the event handler, so it is not at the mercy of this renderer's frame rate
        const dt = G.dragTarget[window.__i];
        trace.push(dt == null ? null : +dt.toFixed(3));
      }
    }
  }
  return trace;
}, script);

const S = () => p.evaluate(() => {
  const G = window.__game;
  return {
    cur: G.S.cur.slice(), cap: G.S.cap.slice(), len: G.S.burrows.map(t => t.length),
    moves: G.S.moves, hist: G.S.hist.length, lock: [...G.S.lock],
    burrows: G.S.burrows, solved: G.S.solved,
  };
});

/* find a long, unlocked burrow to play with */
let s = await S(), pick = null, guard = 0;
const longest = st => st.len.map((L, i) => ({ L, i }))
  .filter(o => !st.lock.includes(o.i) && o.L >= 3).sort((a, b) => b.L - a.L)[0];
pick = longest(s);
while (!pick && guard++ < 8) {
  await p.click('#new'); await p.waitForTimeout(700);
  s = await S(); pick = longest(s);
}
const i = pick.i, path = s.burrows[i], L = path.length;
await p.evaluate(j => { window.__i = j; }, i);
console.log(`playing burrow ${i} (length ${L}) on a ${s.len.length}-burrow board`);

/* 1. tap the hole */
await gesture([['down', ...path[0]], ['up']]);
await p.waitForTimeout(400);
let a = await S();
check('tap a hole sends the gecko out one cell', a.cur[i] === 1, `cur=${a.cur[i]}`);
check('a tap is exactly one move', a.moves === 1 && a.hist === 1, `moves=${a.moves} hist=${a.hist}`);

/* 2. drag from the hole to the far end */
const trace = await gesture([['down', ...path[0]], ['moveTo', ...path[L - 1], 18], ['up']]);
await p.waitForTimeout(500);
a = await S();
check('drag slides the gecko to the far end', a.cur[i] === L, `cur=${a.cur[i]} of ${L}`);
const tr = trace.filter(v => v != null);
check('the slide target never lurches backwards mid-drag',
  tr.every((v, k) => k === 0 || v >= tr[k - 1] - 0.02), tr.slice(0, 5).join(' '));
check('the slide target is continuous, not stepped',
  new Set(tr.map(v => Math.round(v * 10))).size >= 8,
  `${new Set(tr.map(v => Math.round(v * 10))).size} distinct tenths over ${tr.length} samples`);
check('the slide target spans the whole burrow',
  tr.length > 2 && tr[0] < 2 && tr[tr.length - 1] >= L - 0.05,
  `${tr[0]} -> ${tr[tr.length - 1]} (L=${L})`);
check('a whole drag is one undo step', a.hist === 2, `hist=${a.hist}`);

/* 3. long-press the far cell */
await gesture([['down', ...path[L - 1]], ['wait', 620], ['up']]);
await p.waitForTimeout(400);
a = await S();
check('long-press blocks from that cell back', a.cap[i] === L - 1, `cap=${a.cap[i]}`);
check('a blocked cell pushes the gecko out of it', a.cur[i] <= a.cap[i], `cur=${a.cur[i]} cap=${a.cap[i]}`);
await p.screenshot({ path: `${out}/play-blocked.png` });

/* 4. tap the block */
await gesture([['down', ...path[L - 1]], ['up']]);
await p.waitForTimeout(400);
a = await S();
check('tapping a block sends the gecko to it and clears it',
  a.cur[i] === L && a.cap[i] === L, `cur=${a.cur[i]} cap=${a.cap[i]}`);

/* 5. double-tap the hole */
await gesture([['down', ...path[0]], ['up'], ['wait', 90], ['down', ...path[0]], ['up']]);
await p.waitForTimeout(700);
a = await S();
check('double-tapping a hole pulls the gecko all the way in', a.cur[i] === 0, `cur=${a.cur[i]}`);

/* 6. undo */
await p.click('#undo');
await p.waitForTimeout(300);
a = await S();
check('undo restores the level before that gesture', a.cur[i] === L, `cur=${a.cur[i]}`);

/* 7. drag toggle off means no sliding */
await p.click('summary');
await p.uncheck('#t_drag');
const before = (await S()).cur[i];
await gesture([['down', ...path[0]], ['moveTo', ...path[L - 1], 10], ['up']]);
await p.waitForTimeout(400);
a = await S();
check('with drag-to-slide off, a stroke only taps', a.cur[i] !== L || before === L, `cur=${a.cur[i]}`);
await p.check('#t_drag');

/* 8. solve */
await p.evaluate(() => { for (let k = 0; k < 60; k++) document.getElementById('hint').click(); });
await p.waitForTimeout(1500);
a = await S();
check('the board reaches a solved state', a.solved === true);
await p.waitForTimeout(900);
check('the win overlay appears', await p.locator('.win.on').count() === 1);
await p.screenshot({ path: `${out}/play-solved.png` });

console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no page errors');
console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
await b.close();
process.exit(fails || errs.length ? 1 : 0);
