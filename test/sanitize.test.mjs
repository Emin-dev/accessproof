// Security tests for sanitizeHtml — the guard that lets us render pasted markup
// in a non-sandboxed same-origin frame without letting it execute. Run:
//   node test/sanitize.test.mjs
import assert from 'node:assert';
import { sanitizeHtml } from '../js/scanner.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ok  ${name}`); };
const hasNoScript = (s) => assert.ok(!/<script/i.test(s), `expected no <script> in: ${s}`);

test('removes a paired script block and its contents', () => {
  const out = sanitizeHtml('<div>hi</div><script>alert(1)</script><p>bye</p>');
  hasNoScript(out);
  assert.ok(out.includes('<div>hi</div>') && out.includes('<p>bye</p>'), 'keeps real content');
});
test('removes external script (e.g. an overlay loader)', () => {
  hasNoScript(sanitizeHtml('<script src="https://acsbapp.com/apps/app/dist/js/app.js"></script>'));
});
test('removes a self-closing / unterminated script tag', () => {
  hasNoScript(sanitizeHtml('<script src="x.js">'));
});
test('strips inline event handlers (double, single, unquoted)', () => {
  const out = sanitizeHtml('<img src=x onerror="steal()"><b onclick=\'go()\'>x</b><a onmouseover=hack>y</a>');
  assert.ok(!/onerror|onclick|onmouseover/i.test(out), `handlers remain: ${out}`);
});
test('neutralises javascript: URLs', () => {
  const out = sanitizeHtml('<a href="javascript:evil()">x</a>');
  assert.ok(!/javascript:/i.test(out), `js url remains: ${out}`);
});
test('leaves benign markup and normal attributes intact', () => {
  const html = '<main class="p"><h1 id="t">Hi</h1><img src="a.jpg" alt="a"></main>';
  assert.strictEqual(sanitizeHtml(html), html);
});
test('handles empty / non-string input without throwing', () => {
  assert.strictEqual(sanitizeHtml(''), '');
  assert.strictEqual(sanitizeHtml(undefined), 'undefined'); // String(undefined), no crash
});

console.log(`\n${passed} assertions passed.`);
