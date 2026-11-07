// End-to-end smoke test in a real browser: load the sample, edit, undo/redo, fill,
// save + reopen the project, export PNGs and switch language.
//
// Usage: node scripts/e2e.mjs [--channel=msedge|chrome]

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const channel = (process.argv.find((a) => a.startsWith('--channel=')) ?? '--channel=msedge').slice(
  10,
);
const dir = mkdtempSync(join(tmpdir(), 'stitched-e2e-'));
const server = await createServer({ server: { port: 5196, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel });
const errors = [];
let failed = 0;

function check(cond, message) {
  if (cond) console.log(`  ✓ ${message}`);
  else {
    failed++;
    console.error(`  ✗ ${message}`);
  }
}

try {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true,
  });
  await context.addInitScript(() => localStorage.setItem('stitched.lang', 'pl'));
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('dialog', (d) => d.accept());

  const idle = () => page.waitForFunction(() => !document.querySelector('.busy'));
  const legendRows = () => page.locator('.legend-table tbody tr').count();
  const totalStitches = async () =>
    Number((await page.locator('.legend-table tfoot td').nth(2).innerText()).replace(/\D/g, ''));

  await page.goto('http://localhost:5196/');
  await page.click('.empty-card .btn');
  await page.waitForSelector('.legend-table tbody tr');
  await idle();
  console.log('Sample loaded');
  check((await legendRows()) === 12, 'default palette has 12 colours');
  const before = await totalStitches();

  // Fewer colours.
  const slider = page.locator('.section').nth(2).locator('input[type=range]').first();
  await slider.fill('6');
  await page.waitForTimeout(200);
  await idle();
  check((await legendRows()) === 6, 'colour limit 6 → 6 legend rows');

  // Paint with the eraser across the middle of the pattern.
  await page.click('button[title^="Gumka"]');
  const canvas = page.locator('canvas[data-testid="pattern-canvas"]');
  const box = await canvas.boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - 60, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy, { steps: 12 });
  await page.mouse.up();
  const afterErase = await totalStitches();
  check(afterErase < before, `eraser removed stitches (${before} → ${afterErase})`);
  check(
    await page.locator('button[title^="Usuń ręczne poprawki"]').isVisible(),
    'edit counter visible',
  );

  // Undo / redo.
  await page.keyboard.press('Control+z');
  check((await totalStitches()) === before, 'undo restores the stitches');
  await page.keyboard.press('Control+y');
  check((await totalStitches()) === afterErase, 'redo removes them again');

  // Fill the erased line with a colour picked from the legend.
  await page.locator('.legend-table tbody tr').first().locator('.menu .icon-btn').click();
  await page.click('.menu-list button:has-text("Rysuj tym kolorem")');
  await page.click('button[title^="Wypełnianie"]');
  await page.mouse.click(cx, cy);
  const afterFill = await totalStitches();
  check(afterFill > afterErase, `fill painted the erased cells (${afterErase} → ${afterFill})`);

  // Save project.
  const [projectDl] = await Promise.all([
    page.waitForEvent('download'),
    page.click('button[title="Zapisz projekt"]'),
  ]);
  const projectPath = join(dir, projectDl.suggestedFilename());
  await projectDl.saveAs(projectPath);
  const project = JSON.parse(readFileSync(projectPath, 'utf8'));
  check(
    project.format === 'stitched-project' && project.edits.length > 0,
    'project file has edits',
  );

  // PNG exports.
  await page.click('.header .btn.primary');
  for (const label of ['Wzór (PNG)', 'Podgląd haftu (PNG)']) {
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      page.click(`.export button:has-text("${label}")`),
    ]);
    const p = join(dir, dl.suggestedFilename());
    await dl.saveAs(p);
    const head = readFileSync(p).subarray(0, 8).toString('hex');
    check(head === '89504e470d0a1a0a', `${label} is a PNG`);
  }
  await page.keyboard.press('Escape');

  // Reload and reopen the project.
  await page.reload();
  await page.waitForSelector('.empty-card');
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('button[title="Wczytaj projekt"]'),
  ]);
  await chooser.setFiles(projectPath);
  await page.waitForSelector('.legend-table tbody tr');
  await idle();
  check((await totalStitches()) === afterFill, 'reopened project matches the saved pattern');
  check((await legendRows()) === 6, 'reopened project keeps the colour limit');

  // Language switch.
  await page.click('.lang button:has-text("EN")');
  check(
    (await page.locator('.legend-head h2').innerText()) === 'Key',
    'English UI after switching',
  );
} finally {
  await browser.close();
  await server.close();
}

if (errors.length) {
  failed++;
  console.error('Browser errors:\n' + errors.join('\n'));
}
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exitCode = failed ? 1 : 0;
