import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const base = process.env.TEST_URL || "http://127.0.0.1:3017";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "light",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await fs.mkdir("test-results", { recursive: true });

const audit = async (name) => {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  const failures = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => ({
      target: n.target,
      summary: n.failureSummary,
    })),
  }));
  assert.deepEqual(
    failures,
    [],
    `${name} accessibility violations: ${JSON.stringify(failures)}`,
  );
};
const noOverflow = async (width) => {
  await page.setViewportSize({ width, height: 900 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    `Page overflow at ${width}px`,
  );
};
const waitForSheet = () =>
  page.waitForFunction(() => {
    const surface = document.querySelector(".dialog-surface");
    return (
      surface &&
      Math.abs(new DOMMatrix(getComputedStyle(surface).transform).m42) < 0.5
    );
  });

try {
  const counts = new Map();
  page.on("request", (req) => {
    if (/\/api\/games\/\d+$/.test(req.url()))
      counts.set(req.url(), (counts.get(req.url()) || 0) + 1);
  });
  await page.goto(`${base}/?date=2026-11-02`, { waitUntil: "networkidle" });
  await page.locator(".factor-card").first().waitFor();
  const firstId = new URL(page.url()).searchParams.get("game");
  const firstCount = counts.get(`${base}/api/games/${firstId}`);
  await page.locator(".game-card.selected").click();
  assert.equal(
    await page.locator(".scoreboard").count(),
    1,
    "Clicking the selected game keeps the current view",
  );
  await page.locator(".game-card").nth(1).click();
  await page.locator(".factor-card").first().waitFor();
  await page.locator(".game-card").first().click();
  await page.locator(".factor-card").first().waitFor();
  assert.equal(
    counts.get(`${base}/api/games/${firstId}`),
    firstCount,
    "Returning to a cached game makes no extra request",
  );
  await audit("Desktop");

  for (const width of [320, 390, 640, 820, 1024, 1440]) await noOverflow(width);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/?date=2025-06-22&game=401766128&team=11`, {
    waitUntil: "networkidle",
  });
  await page.locator(".factor-card").first().waitFor();
  const factor = page.locator(".factor-card.hurts").first();
  const trigger = factor.locator(".factor-main");
  await trigger.scrollIntoViewIfNeeded();
  const bounds = await trigger.boundingBox();
  for (let n = 0; n < 3; n++)
    await page.mouse.click(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
  assert.equal(
    await trigger.getAttribute("aria-expanded"),
    "true",
    "Rapid reversal finishes at the most recent input",
  );
  await factor.locator("input[type=range]").fill("50");
  await page.locator(".scenario-dock").waitFor({ state: "visible" });
  assert.notEqual(
    await page.locator(".whatif-result strong").first().innerText(),
    "+0.0",
  );
  await page.screenshot({
    path: "test-results/mobile-scenario.png",
    fullPage: true,
  });
  await page.locator(".scenario-dock button").click();
  await page.locator(".scenario-dock").waitFor({ state: "detached" });

  const opener = page.getByRole("button", { name: /How it works/ });
  await opener.click();
  await waitForSheet();
  await audit("Mobile sheet");
  await page.screenshot({ path: "test-results/mobile-sheet.png" });
  const handle = await page.locator(".sheet-handle").boundingBox();
  const startX = handle.x + handle.width / 2,
    startY = handle.y + handle.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let n = 1; n <= 10; n++) {
    await page.mouse.move(startX, startY + n * 2);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await waitForSheet();
  assert.equal(
    await page.getByRole("dialog").count(),
    1,
    "A short pull returns the sheet to its open position",
  );
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let n = 1; n <= 10; n++) {
    await page.mouse.move(startX, startY + n * 22);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.ok(
    await opener.evaluate((el) => document.activeElement === el),
    "Closing returns keyboard focus to the opener",
  );

  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await audit("Dark mode with reduced motion");
  await opener.click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page.locator("h1").click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: "test-results/mobile-dark.png",
    fullPage: true,
  });

  const loading = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    colorScheme: "light",
  });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await loading.route("**/api/games?date=2025-06-22", async (route) => {
    await gate;
    await route.continue();
  });
  await loading.goto(`${base}/?date=2025-06-22`, {
    waitUntil: "domcontentloaded",
  });
  await loading
    .getByRole("status", { name: "Loading NBA games" })
    .waitFor({ state: "visible" });
  assert.equal(await loading.locator(".spin").count(), 0);
  release();
  await loading.locator(".factor-card").first().waitFor();
  await loading.close();
  assert.deepEqual(errors, []);
  console.log(
    "Design checks passed: cached game return, repeat selection, responsive widths, rapid reversal, continuous sliders, scenario dock, sheet snap/dismiss/focus return, dark/reduced motion, structural loading, and WCAG AA checks.",
  );
} catch (error) {
  await page.screenshot({
    path: "test-results/design-failure.png",
    fullPage: true,
  });
  throw error;
} finally {
  await browser.close();
}
