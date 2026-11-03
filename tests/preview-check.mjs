import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light' });
const records = [];
try {
  for (const direction of ['editorial', 'apple', 'analytics']) {
    const url = `http://127.0.0.1:3018/${direction}.html`;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode().catch(() => {}))); window.scrollTo(0, 0); });
    await page.screenshot({ path: `design-previews/${direction}-desktop.png` });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${direction}: desktop overflow`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `design-previews/${direction}-mobile.png`, fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${direction}: mobile overflow`);
    const body = await page.locator('body').innerText();
    assert.match(body, /91/);
    assert.match(body, /103/);
    assert.match(body, /14\.4/);
    records.push({ direction, source: `${direction}.html`, desktop: { width: 1440, height: 900 }, mobile: { width: 390, fullPage: true }, provenance: 'Screenshot of the local HTML design study in Chrome, with real ESPN game 401766128 data.' });
  }
  await page.setViewportSize({ width: 710, height: 1000 });
  await page.goto('http://127.0.0.1:3018/', { waitUntil: 'networkidle' });
  for (const direction of ['editorial', 'apple', 'analytics']) {
    await page.locator(`[data-style=${direction}]`).click();
    assert.match(await page.locator('#preview').getAttribute('src'), new RegExp(direction));
    await page.locator('#preview').evaluate(img => img.decode());
    assert.ok(await page.locator('#preview').evaluate(img => img.complete && img.naturalWidth > 0));
  }
  await page.locator('[data-device=mobile]').click();
  assert.match(await page.locator('#preview').getAttribute('src'), /mobile/);
  await fs.writeFile('design-previews/captures.json', JSON.stringify({ capturedAt: new Date().toISOString(), gameId: '401766128', records }, null, 2));
  console.log('All three real-data design previews captured at desktop and phone sizes; no horizontal overflow; comparison controls work.');
} catch (error) {
  await page.screenshot({ path: 'design-previews/preview-failure.png', fullPage: true });
  throw error;
} finally { await browser.close(); }
