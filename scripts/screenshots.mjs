// Drives the app in a real browser and saves screenshots (used for the README and for
// checking the UI). Uses an installed Edge or Chrome via playwright-core.
//
// Usage: node scripts/screenshots.mjs [outDir] [--lang=pl|en] [--channel=msedge|chrome]

import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const outDir = resolve(args.find((a) => !a.startsWith('--')) ?? 'docs/screenshots');
const lang = (args.find((a) => a.startsWith('--lang=')) ?? '--lang=pl').slice(7);
const channel = (args.find((a) => a.startsWith('--channel=')) ?? '--channel=msedge').slice(10);
mkdirSync(outDir, { recursive: true });

const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ channel });
const errors = [];

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
  await page.screenshot({ path: join(outDir, `empty-${lang}.png`) });

  await page.click('.empty-card .btn');
  await page.waitForSelector('.legend-table tbody tr');
  await page.waitForFunction(() => !document.querySelector('.busy'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, `chart-${lang}.png`) });

  // Detect & skip the background, then show the stitched preview on a navy garment.
  await page.locator('.section').nth(2).locator('.btn').first().click();
  await page.click('.swatch[aria-label="Granatowy"], .swatch[aria-label="Navy"]');
  await page.locator('.toolbar .segmented').first().locator('button').nth(1).click();
  await page.waitForFunction(() => !document.querySelector('.busy'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, `preview-${lang}.png`) });

  // Zoomed-in chart with symbols.
  await page.locator('.toolbar .segmented').first().locator('button').nth(0).click();
  const canvas = page.locator('canvas[data-testid="pattern-canvas"]');
  const box = await canvas.boundingBox();
  for (let i = 0; i < 6; i++) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -300);
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, `zoom-${lang}.png`) });

  // Garment preset.
  await page.selectOption('.section >> nth=1 >> select >> nth=0', 'left-chest');
  await page.waitForFunction(() => !document.querySelector('.busy'));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, `preset-${lang}.png`) });

  // Export dialog + PDF download.
  await page.click('.header .btn.primary');
  await page.waitForSelector('.export');
  await page.screenshot({ path: join(outDir, `export-${lang}.png`) });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.click('.export .btn.primary'),
  ]);
  const pdfPath = join(outDir, `pattern-${lang}.pdf`);
  await download.saveAs(pdfPath);
  console.log(`PDF saved: ${pdfPath}`);

  // Mobile layout.
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
  await m.waitForFunction(() => !document.querySelector('.busy'));
  await m.waitForTimeout(400);
  await m.screenshot({ path: join(outDir, `mobile-${lang}.png`) });
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
