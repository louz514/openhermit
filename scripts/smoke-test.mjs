#!/usr/bin/env node
// Headless smoke test of the local OpenHermit web app.
// Usage: node scripts/smoke-test.mjs [--url=http://localhost:5173]
import { chromium } from 'playwright';

const URL = process.argv.find((a) => a.startsWith('--url='))?.slice(6) ?? 'http://localhost:5173/';
const HEADLESS = !process.argv.includes('--headed');

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const timings = {};

function step(name) {
  const t0 = Date.now();
  return () => {
    timings[name] = `${Date.now() - t0}ms`;
  };
}

const browser = await chromium.launch({ headless: HEADLESS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => pageErrors.push(`${err.name}: ${err.message}`));
page.on('requestfailed', (req) => {
  const f = req.failure();
  failedRequests.push(`${req.method()} ${req.url()} — ${f?.errorText ?? 'failed'}`);
});
page.on('response', (res) => {
  if (res.status() >= 500) failedRequests.push(`${res.status()} ${res.request().method()} ${res.url()}`);
});

const results = [];

async function check(name, fn) {
  const done = step(name);
  try {
    await fn();
    done();
    results.push({ name, status: 'ok', time: timings[name] });
    process.stdout.write(`  ✓ ${name} (${timings[name]})\n`);
  } catch (err) {
    done();
    results.push({ name, status: 'fail', time: timings[name], error: err.message });
    process.stdout.write(`  ✗ ${name} (${timings[name]}) — ${err.message}\n`);
  }
}

console.log(`\n→ Smoke test against ${URL}\n`);

await check('landing loads', async () => {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 15000 });
  const title = await page.title();
  if (!/openhermit/i.test(title)) throw new Error(`unexpected title: ${title}`);
  await page.waitForSelector('.landing__title', { timeout: 5000 });
});

await check('landing nav anchors render', async () => {
  for (const id of ['features', 'why', 'quickstart']) {
    const found = await page.locator(`#${id}`).count();
    if (!found) throw new Error(`missing section #${id}`);
  }
});

await check('landing CTA navigates to setup/pick-agent/chat', async () => {
  // Click the hero CTA — it routes to whatever resumeTarget resolved to.
  await page.locator('.landing__cta button').first().click();
  await page.waitForFunction(
    () => !document.querySelector('.landing__title'),
    null,
    { timeout: 5000 },
  );
});

const reachedScreen = await page.evaluate(() => {
  if (document.querySelector('.chat__messages, .chat__sidebar')) return 'chat';
  if (document.querySelector('.pick-agent, .pick-agent__list')) return 'pick-agent';
  if (document.querySelector('.welcome-card, .welcome-bg')) return 'setup';
  return 'unknown';
});
console.log(`  · landed on screen: ${reachedScreen}`);

if (reachedScreen === 'setup') {
  await check('setup form renders with both tabs', async () => {
    await page.waitForSelector('.welcome-card', { timeout: 5000 });
    const tabs = await page.locator('.welcome-tab').count();
    if (tabs < 2) throw new Error(`expected 2 setup tabs, got ${tabs}`);
  });
  await check('setup name input is editable', async () => {
    const input = page.locator('input[type="text"], input:not([type])').first();
    await input.waitFor({ timeout: 3000 });
    await input.fill('smoke-tester');
    if ((await input.inputValue()) !== 'smoke-tester') throw new Error('input did not update');
  });
}

if (reachedScreen === 'chat') {
  await check('chat sidebar mounts', async () => {
    await page.waitForSelector('.chat__sidebar, .sidebar', { timeout: 5000 });
  });

  await check('composer is interactive', async () => {
    const composer = page.locator('textarea, [contenteditable="true"]').first();
    await composer.waitFor({ timeout: 5000 });
    await composer.click();
  });

  await check('manage tabs render without crash', async () => {
    // Try clicking a Manage link if present in the sidebar/command palette.
    const manageLink = page.locator('text=/manage/i').first();
    if (await manageLink.count()) {
      await manageLink.click().catch(() => {});
      await page.waitForTimeout(400);
    }
  });
}

await browser.close();

const ok = results.every((r) => r.status === 'ok') && pageErrors.length === 0;

console.log('\n=== Page errors ===');
console.log(pageErrors.length ? pageErrors.map((e) => `  • ${e}`).join('\n') : '  (none)');

console.log('\n=== Console errors ===');
const filtered = consoleErrors.filter(
  (e) => !/Download the React DevTools|inpage\.js|lockdown-install|StacksProvider|Xverse|EternlDom/i.test(e),
);
console.log(filtered.length ? filtered.map((e) => `  • ${e}`).join('\n') : '  (none, after filtering wallet/extension noise)');

console.log('\n=== Failed network requests ===');
console.log(failedRequests.length ? failedRequests.map((e) => `  • ${e}`).join('\n') : '  (none)');

console.log(`\n=== Result: ${ok ? 'PASS' : 'FAIL'} ===\n`);
process.exit(ok ? 0 : 1);
