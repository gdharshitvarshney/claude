/* Loads the built game in headless Chromium, drives a few gestures and writes
   screenshots. Usage: NODE_PATH=/opt/node22/lib/node_modules node tools/shot.mjs [outdir] */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const outDir = process.argv[2] || '/tmp/geckoshots';
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--ignore-gpu-blocklist', '--enable-webgl'],
});
const page = await browser.newPage({ viewport: { width: 430, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

await page.goto('file:///home/user/claude/gecko-out-3d/index.html');
await page.waitForTimeout(2500);

const diag = await page.evaluate(() => {
  const c = document.getElementById('cv');
  const gl = c.getContext('webgl2') || c.getContext('webgl');
  return { w: c.width, h: c.height, gl: !!gl,
           renderer: gl ? gl.getParameter(gl.RENDERER) : null };
});
console.log('canvas', JSON.stringify(diag));

await page.screenshot({ path: `${outDir}/01-start.png` });

// centre of the board, then a drag across a few cells
const box = await page.locator('.board').boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
await page.mouse.move(cx, cy);
await page.mouse.down();
for (let i = 0; i <= 12; i++) {
  await page.mouse.move(cx + i * 6, cy + i * 3);
  await page.waitForTimeout(16);
}
await page.mouse.up();
await page.waitForTimeout(900);
await page.screenshot({ path: `${outDir}/02-after-drag.png` });

// hardest tier, biggest board
await page.getByRole('button', { name: 'Hard' }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/03-hard.png` });

// solve it outright to check the celebration + overlay
await page.evaluate(() => { for (let i = 0; i < 40; i++) document.getElementById('hint').click(); });
await page.waitForTimeout(2200);
await page.screenshot({ path: `${outDir}/04-solved.png` });

// frame timing on the biggest board
const fps = await page.evaluate(() => new Promise(res => {
  const t = []; let n = 0, last = performance.now();
  const tick = () => {
    const now = performance.now(); t.push(now - last); last = now;
    if (++n < 90) requestAnimationFrame(tick);
    else { t.sort((a, b) => a - b); res({ median: +t[45].toFixed(1), p90: +t[80].toFixed(1) }); }
  };
  requestAnimationFrame(tick);
}));
console.log('frame ms (swiftshader, software)', JSON.stringify(fps));

// desktop framing
await page.setViewportSize({ width: 1100, height: 820 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/05-desktop.png` });

console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
await browser.close();
