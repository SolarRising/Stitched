// Drives the app in a real browser and saves the screenshots used in the README.
// Uses an installed Edge or Chrome via playwright-core (no browser download needed).
//
// Usage: node scripts/screenshots.mjs [outDir] [--lang=pl|en] [--channel=msedge|chrome]
// The exported sample PDF is written to the system temp folder.

import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const outDir = resolve(args.find((a) => !a.startsWith('--')) ?? 'docs/screenshots');
const lang = (args.find((a) => a.startsWith('--lang=')) ?? '--lang=pl').slice(7);
const channel = (args.find((a) => a.startsWith('--channel=')) ?? '--channel=msedge').slice(10);
mkdirSync(outDir, { recursive: true });

const server = await createServer({
  server: { port: 5199, strictPort: true },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({ channel });
const errors = [];
const shot = (page, name) => page.screenshot({ path: join(outDir, `${name}-${lang}.png`) });
const idle = async (page) => {
  await page.waitForTimeout(150);
  await page.waitForFunction(() => !document.querySelector('.busy'));
  await page.waitForTimeout(250);
};

try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  });
  await context.addInitScript((l) => localStorage.setItem('stitched.lang', l), lang);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

  await page.goto('http://localhost:5199/');
  await page.waitForSelector('.empty-card');
  await shot(page, 'start');

  // Sample image sized for the front of a T-shirt.
  await page.click('.empty-card .btn');
  await page.waitForSelector('.legend-table tbody tr');
  await page.selectOption('.section >> nth=1 >> select >> nth=0', 'center-chest');
  await idle(page);
  await shot(page, 'chart');

  // Stitched preview on a navy garment.
  await page.click('.swatch[aria-label="Granatowy"], .swatch[aria-label="Navy"]');
  await page.locator('.toolbar .segmented').first().locator('button').nth(1).click();
  await idle(page);
  await shot(page, 'preview');

  // Export dialog + sample PDF.
  await page.click('.header .btn.primary');
  await page.waitForSelector('.export');
  await page.locator('.export .segmented').nth(2).locator('button').nth(1).click();
  await shot(page, 'export');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 90000 }),
    page.click('.export .btn.primary'),
  ]);
  const pdfPath = join(mkdtempSync(join(tmpdir(), 'stitched-')), `sample-${lang}.pdf`);
  await download.saveAs(pdfPath);
  console.log(`Sample PDF: ${pdfPath}`);

  // Phone layout.
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await mobile.addInitScript((l) => localStorage.setItem('stitched.lang', l), lang);
  const m = await mobile.newPage();
  m.on('pageerror', (e) => errors.push(`mobile pageerror: ${e.message}`));
  await m.goto('http://localhost:5199/');
  await m.click('.empty-card .btn');
  await m.waitForSelector('.legend-table tbody tr');
  await idle(m);
  await shot(m, 'mobile');
} finally {
  await browser.close();
  await server.close();
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Screenshots saved to ${outDir}`);
}
