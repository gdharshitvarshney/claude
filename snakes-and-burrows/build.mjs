/* Bundles src/ + three.js into one <script> and inlines it into index.html, so
   the shipped game is a single file that opens straight off the filesystem. */
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const out = await build({
  entryPoints: ['src/main.js'],
  bundle: true, format: 'iife', target: ['es2020'],
  minify: !process.argv.includes('--dev'),
  write: false, legalComments: 'none',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = readFileSync('index.src.html', 'utf8')
  // replacer function, not a string: `$&` and friends inside the bundle must not
  // be treated as replacement patterns
  .replace('<!--BUNDLE-->', () => `<script>\n${js}\n</script>`);
writeFileSync('index.html', html);
console.log(`index.html  ${(html.length / 1024).toFixed(0)} KB`);
