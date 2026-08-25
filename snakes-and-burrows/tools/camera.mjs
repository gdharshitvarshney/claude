/* Sweeps the camera controls and captures each view, to check framing holds. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] || '/tmp/cam';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{width:420,height:880}, deviceScaleFactor:2 });
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto('file:///home/user/claude/snakes-and-burrows/index.html');
await p.waitForTimeout(1500);
await p.getByRole('button', { name: 'Medium' }).click();
await p.waitForTimeout(1200);
await p.evaluate(() => { const S = window.__game.S; for (let i=0;i<S.cur.length;i++) S.cur[i]=S.burrows[i].length; });
await p.waitForTimeout(1500);

const view = async (tilt, yaw, zoom, name) => {
  // one slider at a time: paintCam writes state back to the others, so setting
  // all three before dispatching would clobber the ones not yet dispatched
  await p.evaluate(v => {
    for (const [id, val] of [['camTilt', v.tilt], ['camYaw', v.yaw], ['camZoom', v.zoom * 100]]) {
      const el = document.getElementById(id);
      el.value = val;
      el.dispatchEvent(new Event('input'));
    }
  }, { tilt, yaw, zoom });
  await p.waitForTimeout(700);
  await p.locator('.board').screenshot({ path: `${out}/${name}.png` });
  console.log(name, await p.evaluate(() => {
    const s = window.__game.stage;
    return { tilt: +s.tiltDeg, yaw: +s.yawDeg, zoom: +s.zoom, dist: +s.dist.toFixed(2) };
  }));
};
await view(19, 0, 1, 'default');
await view(45, 0, 1, 'tilted');
await view(30, 35, 1, 'orbited');
await view(19, 0, 1.35, 'zoomed');
await view(5, 0, 1, 'flat');
await b.close();
