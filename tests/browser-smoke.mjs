import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.TEST_URL || 'http://127.0.0.1:3001';
await fs.mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.factor-card').first().waitFor();
  assert.equal(await page.locator('.factor-card').count(), 8);
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });

  await page.goto(`${base}/?date=2025-06-22&game=401766128&team=11`, { waitUntil: 'networkidle' });
  await page.locator('.factor-card').first().waitFor();
  assert.match(await page.locator('.result-pill').innerText(), /LOST BY 12/);
  assert.equal(await page.locator('.scores').innerText(), '91\n–\n103');
  const hurtCard = page.locator('.factor-card.hurts').first();
  await hurtCard.locator('.factor-main').click();
  await hurtCard.getByRole('button', { name: /Close the full gap/ }).click();
  assert.notEqual(await page.locator('.whatif-result strong').first().innerText(), '+0.0');
  await page.getByRole('button', { name: 'Reset what-if scenario' }).click();
  assert.equal(await page.locator('.whatif-result strong').first().innerText(), '+0.0');
  await page.getByRole('button', { name: 'Box score', exact: true }).click();
  assert.equal(await page.locator('tbody tr').count(), 13);
  await page.locator('.team-toggle button').filter({ hasText: 'Thunder' }).click();
  await page.getByRole('button', { name: /The breakdown 8/ }).click();
  assert.match(await page.locator('.result-pill').innerText(), /WON BY 12/);
  assert.match(await page.locator('.analysis-title h2').innerText(), /win/i);
  await page.getByRole('button', { name: /How it works/ }).click();
  await page.getByRole('dialog').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  assert.match(page.url(), /team=25/);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.factor-card').first().waitFor();
  assert.match(await page.locator('.result-pill').innerText(), /WON BY 12/);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const date = page.getByLabel('Game date, US Eastern time');
  await date.fill('2025-08-01');
  await page.locator('.empty-games').waitFor();
  assert.equal(await page.locator('.scoreboard').count(), 0);
  await page.getByRole('button', { name: '2025 Finals, Game 7' }).click();
  await page.locator('.factor-card').first().waitFor();
  assert.match(page.url(), /2025-06-22/);
  assert.deepEqual(errors, []);
  console.log('Browser smoke passed: real feed, margin, sliders, reset, box score, perspective, dialog, share-state restore, mobile layout, empty date and classic-game shortcut.');
} catch (error) {
  console.error('Page:', await page.locator('body').innerText());
  console.error('Browser errors:', errors);
  await page.screenshot({ path: 'test-results/failure.png', fullPage: true });
  throw error;
} finally { await browser.close(); }
