/* Close-ups for art review: pushes every snake out, then clips tight on one head. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] || '/tmp/art';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{width:430,height:900}, deviceScaleFactor:3 });
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto('file:///home/user/claude/snakes-and-burrows/index.html');
await p.waitForTimeout(1500);

// everybody out, so the board is full of snakes
const head = await p.evaluate(() => {
  const G = window.__game, S = G.S;
  for (let i = 0; i < S.cur.length; i++) S.cur[i] = S.burrows[i].length;
  const longest = S.burrows.map((t, i) => ({ L: t.length, i })).sort((a, b) => b.L - a.L)[0].i;
  return longest;
});
await p.waitForTimeout(1800);
await p.screenshot({ path: `${out}/all-out.png` });

const clip = await p.evaluate(j => {
  const G = window.__game, cam = G.stage.camera, cv = document.getElementById('cv');
  const r = cv.getBoundingClientRect();
  const v = G.snakes[j].head.position.clone();
  v.project(cam);
  const x = r.left + (v.x + 1) / 2 * r.width, y = r.top + (1 - v.y) / 2 * r.height;
  return { x: Math.max(0, x - 55), y: Math.max(0, y - 55), width: 110, height: 110 };
}, head);
await p.screenshot({ path: `${out}/head.png`, clip });
console.log('wrote', out);
await b.close();
