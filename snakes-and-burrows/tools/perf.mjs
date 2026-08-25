import { chromium } from 'playwright';
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{width:430,height:900} });
await p.goto('file:///home/user/claude/snakes-and-burrows/index.html');
await p.waitForTimeout(1200);
await p.getByRole('button', { name: 'Hard' }).click();
await p.waitForTimeout(1500);
await p.evaluate(() => { const S=window.__game.S; for(let i=0;i<S.cur.length;i++) S.cur[i]=S.burrows[i].length; });
await p.waitForTimeout(1500);

const fps = () => p.evaluate(() => new Promise(res => {
  const t=[]; let n=0,last=performance.now();
  const tick=()=>{const now=performance.now();t.push(now-last);last=now;
    if(++n<24) requestAnimationFrame(tick);
    else {t.sort((x,y)=>x-y);res(+t[12].toFixed(0));}};
  requestAnimationFrame(tick);
}));
const stat = () => p.evaluate(() => {
  const r = window.__game.stage.renderer.info.render;
  return { calls: r.calls, tris: r.triangles };
});
console.log('render info      ', JSON.stringify(await stat()));
console.log('as shipped            ', await fps(), 'ms');
await p.evaluate(() => { const s=window.__game.stage; s.key.shadow.mapSize.set(512,512);
  s.key.shadow.map?.dispose(); s.key.shadow.map=null; s.key.shadow.blurSamples=4; });
await p.waitForTimeout(600);
console.log('half-size shadow map  ', await fps(), 'ms');
await p.evaluate(() => { const s=window.__game.stage; s.renderer.shadowMap.enabled=false;
  s.renderer.shadowMap.needsUpdate=true; s.scene.traverse(o=>{ if(o.isMesh) o.material.needsUpdate=true; }); });
await p.waitForTimeout(600);
console.log('no shadows            ', await fps(), 'ms');
await p.evaluate(() => { const s=window.__game.stage; s.scene.environment=null;
  s.scene.traverse(o=>{ if(o.isMesh) o.material.needsUpdate=true; }); });
await p.waitForTimeout(600);
console.log('no shadows, no env    ', await fps(), 'ms');
await p.evaluate(() => window.__game.stage.renderer.setPixelRatio(0.6));
await p.waitForTimeout(600);
console.log('…and 0.6x pixel ratio ', await fps(), 'ms');
await b.close();
