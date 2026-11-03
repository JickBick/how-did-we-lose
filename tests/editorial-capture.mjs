import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.TEST_URL || 'http://127.0.0.1:3017';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const page = await context.newPage();
await fs.mkdir('.impeccable/review', { recursive: true });
try {
  await page.goto(`${base}/?date=2025-06-22&game=401766128&team=11`, { waitUntil: 'networkidle' });
  await page.locator('.factor-card').last().waitFor();
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode().catch(() => {}))); });
  await page.screenshot({ path: '.impeccable/review/desktop.png', fullPage: true });
  await page.screenshot({ path: '.impeccable/review/desktop-first.png' });
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: width < 640 ? 844 : 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}px`);
    const bad = await page.locator('.impact-value').evaluateAll(nodes => nodes.filter(node => { const r=node.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; }).map(node => node.textContent));
    assert.deepEqual(bad, [], `Clipped point labels at ${width}px`);
    await page.screenshot({ path: `.impeccable/review/${width === 390 ? 'mobile' : `width-${width}`}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.factor-card.hurts').first().locator('.factor-main').click();
  await page.locator('.factor-card.hurts').first().locator('input[type=range]').fill('50');
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: '.impeccable/review/mobile-scenario.png', fullPage: true });
  await page.screenshot({ path: '.impeccable/review/mobile-scenario-first.png' });
  await page.locator('.scenario-dock button').click();
  await page.locator('.scenario-dock').waitFor({ state: 'detached' });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '.impeccable/review/mobile-dark.png', fullPage: true });
  console.log('Editorial captures complete: approved fixture, desktop/1280/phone/320, scenario and dark mode; no horizontal overflow or clipped impact labels.');
} finally { await browser.close(); }
