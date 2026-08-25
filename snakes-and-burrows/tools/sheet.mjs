/* Captures the settings sheet open, for review. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] || '/tmp/sheet';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport:{width:420,height:880}, deviceScaleFactor:2 });
await p.goto('file:///home/user/claude/snakes-and-burrows/index.html');
await p.waitForTimeout(1500);
await p.click('#settings');
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/settings.png` });
await b.close();
console.log('ok');
