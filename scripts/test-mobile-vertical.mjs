import { chromium } from '../../.tools/browser-tests/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const site = process.argv[2] || 'http://127.0.0.1:5181';
const out = 'docs/reviews/evidence-mobile-vertical-20261008';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
});
const profiles = [
  ['iphone12-short', 390, 650],
  ['iphone12', 390, 844],
  ['android-short', 412, 700],
  ['phone-landscape', 844, 390],
];
const report = { site, checkedAt: new Date().toISOString(), browser: 'Edge mobile viewport emulation; not physical Safari or Android', profiles: [], pass: true };

for (const [name, width, height] of profiles) {
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: true, locale: 'zh-CN' });
  const page = await context.newPage();
  const row = { name, width, height, errors: [] };
  page.on('pageerror', error => row.errors.push(error.message));
  try {
    await page.goto(`${site}/legacy/drum/`, { waitUntil: 'networkidle' });
    const access = page.getByText('确定访问', { exact: true });
    await access.waitFor({ timeout: 5000 }).catch(() => null);
    if (await access.isVisible().catch(() => false)) {
      await access.click();
      await page.waitForLoadState('networkidle');
    }
    const start = page.locator('[data-start]');
    await start.waitFor();
    await start.scrollIntoViewIfNeeded();
    const startBox = await start.boundingBox();
    assert.ok(startBox && startBox.y >= 0 && startBox.y + startBox.height <= height, `start unreachable: ${JSON.stringify(startBox)}`);
    row.startReachable = true;

    await page.locator('[data-settings]').tap();
    const close = page.locator('[data-close-top]');
    await close.waitFor();
    const firstCloseBox = await close.boundingBox();
    assert.ok(firstCloseBox && firstCloseBox.y >= 0 && firstCloseBox.y + firstCloseBox.height <= height, `close initially unreachable: ${JSON.stringify(firstCloseBox)}`);
    const themes = page.locator('.theme-card');
    const lastTheme = themes.last();
    await lastTheme.scrollIntoViewIfNeeded();
    await lastTheme.tap();
    assert.ok(await lastTheme.evaluate(el => el.classList.contains('active')));
    const stickyCloseBox = await close.boundingBox();
    assert.ok(stickyCloseBox && stickyCloseBox.y >= 0 && stickyCloseBox.y + stickyCloseBox.height <= height, `close after scroll unreachable: ${JSON.stringify(stickyCloseBox)}`);
    assert.equal(await page.locator('body.settings-open .wireless-panel:visible, body.settings-open .drum-history:visible').count(), 0);
    await page.screenshot({ path: `${out}/${name}-drum-settings.png` });
    await close.tap();
    assert.equal(await page.locator('.modal.show').count(), 0);
    row.settingsLastThemeAndClose = true;

    await page.goto(`${site}/legacy/english/`, { waitUntil: 'networkidle' });
    await access.waitFor({ timeout: 5000 }).catch(() => null);
    if (await access.isVisible().catch(() => false)) {
      await access.click();
      await page.waitForLoadState('networkidle');
    }
    await page.getByRole('button', { name: /Start|开始学习/ }).tap();
    await page.getByText('Vocabulary', { exact: true }).tap();
    await page.getByRole('button', { name: '🏠 Home', exact: true }).waitFor();
    for (let i = 0; i < 14 && !(await page.locator('.overlay .finale').count()); i += 1) {
      await page.keyboard.press('5');
      await page.waitForTimeout(120);
    }
    await page.locator('.overlay .finale').waitFor({ timeout: 5000 });
    const replay = page.getByRole('button', { name: /Play again/ });
    await replay.scrollIntoViewIfNeeded();
    const replayBox = await replay.boundingBox();
    assert.ok(replayBox && replayBox.y >= 0 && replayBox.y + replayBox.height <= height, `replay unreachable: ${JSON.stringify(replayBox)}`);
    const levelHead = page.locator('.level-head');
    const levelMetrics = await levelHead.evaluate(el => {
      const tag = el.querySelector('.level-tag');
      const goal = el.querySelector('.level-goal');
      return {
        direction: getComputedStyle(el).flexDirection,
        tagWidth: tag?.getBoundingClientRect().width || 0,
        goalWidth: goal?.getBoundingClientRect().width || 0,
      };
    });
    if (width <= 600) {
      assert.equal(levelMetrics.direction, 'column');
      assert.ok(levelMetrics.goalWidth > 180, `goal text squeezed: ${JSON.stringify(levelMetrics)}`);
    }
    await page.screenshot({ path: `${out}/${name}-english-finale.png` });
    await replay.tap();
    assert.equal(await page.locator('.overlay .finale').count(), 0);
    row.englishFinaleReachable = true;
    row.errors = [...new Set(row.errors)];
    assert.deepEqual(row.errors, []);
    row.pass = true;
  } catch (error) {
    row.pass = false;
    row.error = String(error.stack || error);
    report.pass = false;
    await page.screenshot({ path: `${out}/${name}-failure.png`, fullPage: true }).catch(() => {});
  }
  report.profiles.push(row);
  console.log(JSON.stringify(row));
  await context.close();
}
await browser.close();
await writeFile(`${out}/results.json`, JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
