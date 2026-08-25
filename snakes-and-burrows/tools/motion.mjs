/* Confirms the idle animation is actually animating and measures frame cost. */
import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{width:430,height:900} });
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto('file:///home/user/claude/snakes-and-burrows/index.html');
await p.waitForTimeout(1200);
await p.getByRole('button', { name: 'Hard' }).click();
await p.waitForTimeout(1200);
await p.evaluate(() => { const S = window.__game.S; for (let i=0;i<S.cur.length;i++) S.cur[i]=S.burrows[i].length; });
await p.waitForTimeout(2000);

const sample = () => p.evaluate(() => {
  const g = window.__game.snakes[0];
  const pos = g.body.geometry.attributes.position.array;
  let sum = 0; for (let i = 0; i < 300; i++) sum += pos[i];
  return { spine: +sum.toFixed(4), blink: +g.blink.toFixed(3),
           headY: +g.head.position.y.toFixed(4),
           legOn: g.legs.filter(l => l.g.visible).length,
           lid: +g.eyes[0].lid.rotation.x.toFixed(3) };
});
const a = await sample(); await p.waitForTimeout(500);
const b2 = await sample(); await p.waitForTimeout(500);
const c = await sample();
console.log('t0', JSON.stringify(a));
console.log('t1', JSON.stringify(b2));
console.log('t2', JSON.stringify(c));
console.log('body is moving:', a.spine !== b2.spine && b2.spine !== c.spine);
console.log('head bobs     :', a.headY !== b2.headY);
console.log('legs attached :', a.legOn);

// blink at least once over a few seconds
const blinks = await p.evaluate(() => new Promise(res => {
  let seen = 0, was = 0;
  const t = setInterval(() => {
    const v = window.__game.snakes.reduce((n, g) => n + (g.blink > 0.5 ? 1 : 0), 0);
    if (v > was) seen++;
    was = v;
  }, 60);
  setTimeout(() => { clearInterval(t); res(seen); }, 8000);
}));
console.log('blink events over 8s (all snakes):', blinks);

const fps = await p.evaluate(() => new Promise(res => {
  const t = []; let n = 0, last = performance.now();
  const tick = () => { const now = performance.now(); t.push(now-last); last = now;
    if (++n < 80) requestAnimationFrame(tick);
    else { t.sort((x,y)=>x-y); res({ median:+t[40].toFixed(1), p90:+t[71].toFixed(1) }); } };
  requestAnimationFrame(tick);
}));
console.log('frame ms on an 8x8, all snakes out, SOFTWARE renderer:', JSON.stringify(fps));
await b.close();
