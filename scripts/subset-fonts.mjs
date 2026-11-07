// Subsets Roboto (Apache-2.0, https://github.com/googlefonts/roboto-2 v2.138) to Latin,
// Latin-1, Latin Extended-A (Polish etc.) and common punctuation, so the PDF exporter
// can embed it cheaply.
//
// Usage:
//   npm i --no-save subset-font
//   node scripts/subset-fonts.mjs <dir with Roboto-Regular.ttf and Roboto-Bold.ttf>

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const srcDir = process.argv[2];
if (!srcDir) {
  console.error('Usage: node scripts/subset-fonts.mjs <font dir>');
  process.exit(1);
}

const ranges = [
  [0x20, 0x7e],
  [0xa0, 0xff],
  [0x100, 0x17f],
  [0x2010, 0x2027],
  [0x2030, 0x203a],
  [0x20ac, 0x20ac],
  [0x2190, 0x2193],
  [0x2212, 0x2212],
  [0x2248, 0x2248],
  [0x2264, 0x2265],
];
let text = '';
for (const [a, b] of ranges) for (let c = a; c <= b; c++) text += String.fromCodePoint(c);

const outDir = fileURLToPath(new URL('../src/assets/fonts/', import.meta.url));
mkdirSync(outDir, { recursive: true });
for (const name of ['Roboto-Regular.ttf', 'Roboto-Bold.ttf']) {
  const input = readFileSync(join(srcDir, name));
  const output = await subsetFont(input, text, { targetFormat: 'truetype' });
  writeFileSync(join(outDir, name), output);
  console.log(`${name}: ${input.length} → ${output.length} bytes`);
}
