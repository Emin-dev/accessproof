// Regression tests for the sandbox envelope/bridge, replacing the old regex
// sanitizer assertions. Browser enforcement is tested separately by Playwright.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createScanDocument, isScanMessage, MAX_HTML_LENGTH, scanHtml } from '../js/scanner.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };
const token = 'a'.repeat(64);
const source = {};
const message = (data = {}) => ({ source, origin: 'null', data: {
  channel: 'accessproof-scan', token, type: 'ready', ...data,
} });
const issue = { id: 'image-alt', impact: 'critical', tags: ['wcag2a'], help: 'Add alt text',
  helpUrl: 'https://dequeuniversity.com/rules/axe/4.14/image-alt', nodes: [{ target: ['img'] }] };
const result = { violations: [issue], passes: [], incomplete: [], testEngine: { version: '4.14.0' } };

test('only trusted scripts carry a fresh nonce and CSP precedes them', () => {
  const html = createScanDocument(token, 'https://example.test');
  assert.equal((html.match(/<script /g) || []).length, 2);
  assert.equal((html.match(/ nonce=/g) || []).length, 2);
  assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<script'));
  for (const directive of ["default-src &#39;none&#39;", "connect-src &#39;none&#39;", "form-action &#39;none&#39;", "base-uri &#39;none&#39;", "frame-src &#39;none&#39;"]) assert.ok(html.includes(directive));
  assert.ok(!html.includes('unsafe-eval'));
});
test('envelope attribute values cannot inject markup', () => {
  const html = createScanDocument(token, '\"><script>alert(1)</script>');
  assert.equal((html.match(/<script /g) || []).length, 2);
  assert.ok(html.includes('&lt;script&gt;'));
});
test('rejects invalid nonce values', () => {
  for (const bad of ['', 'short', 'x'.repeat(64), `${token}\"`]) assert.throws(() => createScanDocument(bad, 'https://example.test'));
});
test('accepts a bound ready message', () => assert.equal(isScanMessage(message(), source, token), true));
test('rejects another window even with the correct token', () => assert.equal(isScanMessage({ ...message(), source: {} }, source, token), false));
test('rejects non-opaque origins', () => assert.equal(isScanMessage({ ...message(), origin: 'https://example.test' }, source, token), false));
test('rejects stale token, channel and unknown messages', () => {
  for (const patch of [{ token: 'b'.repeat(64) }, { channel: 'other' }, { type: 'other' }]) assert.equal(isScanMessage(message(patch), source, token), false);
});
test('rejects null, arrays and missing source', () => {
  for (const data of [null, [], 'ready', 4]) assert.equal(isScanMessage({ ...message(), data }, source, token), false);
  assert.equal(isScanMessage(message(), null, token), false);
});
test('accepts the report result shape', () => assert.equal(isScanMessage(message({ type: 'result', result }), source, token), true));
test('rejects malformed result lists and fields', () => {
  for (const patch of [{ violations: {} }, { passes: null }, { incomplete: 'bad' }, { testEngine: {} }]) assert.equal(isScanMessage(message({ type: 'result', result: { ...result, ...patch } }), source, token), false);
  for (const patch of [{ impact: 'invented' }, { helpUrl: 'javascript:alert(1)' }, { tags: [4] }, { nodes: [{ target: [null] }] }]) assert.equal(isScanMessage(message({ type: 'result', result: { ...result, violations: [{ ...issue, ...patch }] } }), source, token), false);
});
test('only bounded error strings cross the bridge', () => {
  assert.equal(isScanMessage(message({ type: 'error', message: 'Try again.' }), source, token), true);
  assert.equal(isScanMessage(message({ type: 'error', message: 'x'.repeat(301) }), source, token), false);
});
await assert.rejects(scanHtml('  '), /Paste your page/);
await assert.rejects(scanHtml('x'.repeat(MAX_HTML_LENGTH + 1)), /smaller page/);
passed += 2;
const sourceCode = await readFile(new URL('../js/scanner.js', import.meta.url), 'utf8');
test('sandbox has scripts only and never reads the child document', () => {
  assert.match(sourceCode, /setAttribute\('sandbox', 'allow-scripts'\)/);
  assert.ok(!sourceCode.includes('contentDocument'));
  assert.ok(!sourceCode.includes('doc.write('));
});
console.log(`\n${passed} isolation assertions passed.`);
