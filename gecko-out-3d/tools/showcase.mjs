/* Screenshots of the shipped build for review. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] || '/tmp/geckoshow';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{width:420,height:880}, deviceScaleFactor:2 });
await p.goto('file:///home/user/claude/gecko-out-3d/index.html');
await p.waitForTimeout(1500);
await p.getByRole('button', { name: 'Medium' }).click();
await p.waitForTimeout(1400);
await p.locator('.board').screenshot({ path: `${out}/1-start.png` });

// a plausible mid-solve: put roughly half the geckos partway out
await p.evaluate(() => {
  const S = window.__game.S;
  S.burrows.forEach((t, i) => { if (i % 2 === 0) S.cur[i] = Math.max(1, Math.round(t.length * 0.7)); });
  S.moves = 9; S.t0 = Date.now() - 74000;
});
await p.waitForTimeout(2200);
await p.locator('.board').screenshot({ path: `${out}/2-midgame.png` });
await p.screenshot({ path: `${out}/3-full-screen.png` });
await b.close();
console.log('ok');
