import { test, expect } from '@playwright/test';

const clean = '<!doctype html><html lang="en"><head><title>Example store</title><style>body{background:white;color:black}</style></head><body><main><h1>Example store</h1><p>Welcome.</p><button>Buy</button></main></body></html>';
const scan = (page, html) => page.evaluate(async (markup) => (await import('/js/scanner.js')).scanHtml(markup), html);

async function protectNetwork(page) {
  const probes = [];
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://127.0.0.1:18197' || url.pathname.startsWith('/__probe')) {
      probes.push(route.request().url());
      return route.abort(); // A failing test must not transmit even synthetic probes.
    }
    return route.continue();
  });
  return probes;
}

test('real engine preserves sample findings, inline contrast, language and a clean page', async ({ page }, info) => {
  const probes = await protectNetwork(page);
  await page.goto('/');
  await page.screenshot({ path: info.outputPath('accessproof-initial.png'), fullPage: true });
  await page.getByRole('button', { name: 'Try a sample store' }).click();
  await expect(page.locator('#results')).toBeVisible();
  await expect(page.locator('#results')).toContainText('overlay detected');
  await expect(page.locator('#results')).toContainText('image');
  await page.screenshot({ path: info.outputPath('accessproof-sample.png'), fullPage: true });
  const sample = await page.evaluate(async () => {
    const { SAMPLE_STORE_HTML } = await import('/js/sample.js');
    return (await import('/js/scanner.js')).scanHtml(SAMPLE_STORE_HTML);
  });
  expect(sample.testEngine.version).toBe('4.14.0');
  const ids = sample.violations.map((issue) => issue.id);
  for (const id of ['image-alt', 'button-name', 'html-has-lang', 'document-title', 'color-contrast']) expect(ids).toContain(id);
  const good = await scan(page, clean);
  expect(good.violations).toEqual([]);
  expect(good.passes.length).toBeGreaterThan(0);
  expect(probes).toEqual([]);
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('synthetic scripts, handlers, nested documents and resources stay isolated', async ({ page }) => {
  const probes = await protectNetwork(page);
  await page.goto('/');
  await page.evaluate(() => { window.__accessproofProbe = 0; localStorage.setItem('accessproof-synthetic', 'unchanged'); });
  const marker = 'parent.__accessproofProbe=1;parent.localStorage.setItem("accessproof-synthetic","changed")';
  const payloads = [
    `<script>${marker}</script><img src="/__probe/image" onerror='${marker}'>`,
    `<svg onload='${marker}'><a href="java&#x0A;script:${marker}">link</a></svg><img src=x onerror=${marker}>`,
    `<meta http-equiv="refresh" content="0;url=/__probe/redirect"><base href="https://example.invalid/"><link rel="stylesheet" href="/__probe/css"><link rel="preload" as="image" href="/__probe/preload">`,
    `<iframe src="/__probe/frame" srcdoc="&lt;script&gt;${marker}&lt;/script&gt;"></iframe><object data="/__probe/object"></object><embed src="/__probe/embed">`,
    '<style>@import url("/__probe/import");body{background-image:url("/__probe/background")}@font-face{font-family:probe;src:url("/__probe/font")}p{font-family:probe}</style><p>Resource probe</p><img srcset="/__probe/srcset 1x" src="https://example.invalid/pixel">',
    '<form action="/__probe/form"><input name="token" value="synthetic"><button formaction="/__probe/button" autofocus>Submit</button></form><video poster="/__probe/poster"><source src="/__probe/media"></video>',
    `<template shadowrootmode="open"><script>${marker}</script><meta http-equiv=refresh content="0;url=/__probe/template"></template><math><mtext><svg><foreignObject><img src="/__probe/mixed" onerror='${marker}'></foreignObject></svg></mtext></math>`,
    `<form id="axe"><input name="run"></form><img name="parent" src="/__probe/clobber"><script/${marker}><style></style><h1>Malformed markup</h1>`,
  ];
  for (const payload of payloads) {
    const result = await scan(page, clean.replace('</body>', `${payload}</body>`));
    expect(Array.isArray(result.violations)).toBe(true);
    expect(await page.evaluate(() => window.__accessproofProbe)).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('accessproof-synthetic'))).toBe('unchanged');
    expect(page.url()).toBe('http://127.0.0.1:18197/');
    await expect(page.locator('iframe')).toHaveCount(0);
  }
  expect(probes).toEqual([]);
});

test('opaque origin is enforced and spoofed messages cannot resolve a scan', async ({ page }) => {
  await protectNetwork(page);
  await page.goto('/');
  // Delay only the trusted engine, leaving enough time to inspect the boundary.
  await page.route('**/vendor/axe.min.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await page.evaluate((html) => {
    window.scanState = 'pending';
    import('/js/scanner.js').then(({ scanHtml }) => scanHtml(html)).then(() => { window.scanState = 'done'; });
  }, clean);
  await expect(page.locator('iframe')).toHaveCount(1);
  const state = await page.evaluate(() => {
    const frame = document.querySelector('iframe');
    const token = frame.srcdoc.match(/data-scan-token="([a-f0-9]+)"/)[1];
    window.postMessage({ channel: 'accessproof-scan', token, type: 'error', message: 'spoof' }, '*');
    let denied = false;
    try { void frame.contentWindow.document; } catch { denied = true; }
    return { sandbox: frame.getAttribute('sandbox'), document: frame.contentDocument, denied };
  });
  expect(state).toEqual({ sandbox: 'allow-scripts', document: null, denied: true });
  await expect.poll(() => page.evaluate(() => window.scanState)).toBe('done');
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('repeated/concurrent scans stay distinct and clean up', async ({ page }) => {
  await protectNetwork(page);
  await page.goto('/');
  const results = await page.evaluate(async (html) => {
    const { scanHtml } = await import('/js/scanner.js');
    return Promise.all([scanHtml(html), scanHtml('<html><body><button></button></body></html>')]);
  }, clean);
  expect(results[0].violations).toEqual([]);
  expect(results[1].violations.map((issue) => issue.id)).toContain('button-name');
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.getByRole('button', { name: 'Try a sample store' }).click();
  await expect(page.locator('#results')).toBeVisible();
  await expect(page.locator('#sample-btn')).toBeEnabled();
  await expect(page.locator('#scan-btn')).toBeEnabled();
});

test('engine failure and timeout remove frames and restore UI', async ({ page }) => {
  await protectNetwork(page);
  await page.goto('/');
  await page.route('**/vendor/axe.min.js', (route) => route.abort());
  await page.getByRole('button', { name: 'Try a sample store' }).click();
  await expect(page.locator('#scan-status')).toContainText('could not finish');
  await expect(page.locator('#sample-btn')).toBeEnabled();
  await expect(page.locator('#scan-btn')).toBeEnabled();
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.unroute('**/vendor/axe.min.js');
  await page.route('**/js/scanner-frame.js', (route) => route.fulfill({ contentType: 'text/javascript', body: '' }));
  const error = await page.evaluate(async (html) => {
    try { await (await import('/js/scanner.js')).scanHtml(html); } catch (error) { return error.message; }
  }, clean);
  expect(error).toContain('took too long');
  await expect(page.locator('iframe')).toHaveCount(0);
});
