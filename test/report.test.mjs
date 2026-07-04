// Node test suite for the pure report/domain logic. Run: node test/report.test.mjs
import assert from 'node:assert';
import {
  wcagCriterionFromTags, conformanceLevel, detectOverlays, IMPACT_RANK,
} from '../js/wcag-eaa-map.js';
import {
  enrichIssue, riskBand, buildReport, headline, AUTOMATED_COVERAGE_NOTE,
} from '../js/report.js';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`  ok  ${name}`); }

// --- wcagCriterionFromTags ---
test('parses wcag111 -> 1.1.1', () => {
  assert.strictEqual(wcagCriterionFromTags(['cat.text', 'wcag2a', 'wcag111']), '1.1.1');
});
test('parses wcag143 -> 1.4.3', () => {
  assert.strictEqual(wcagCriterionFromTags(['wcag2aa', 'wcag143']), '1.4.3');
});
test('returns null when no numeric SC tag', () => {
  assert.strictEqual(wcagCriterionFromTags(['cat.semantics', 'best-practice']), null);
});

// --- conformanceLevel ---
test('detects AA', () => assert.strictEqual(conformanceLevel(['wcag2aa', 'wcag143']), 'AA'));
test('detects A', () => assert.strictEqual(conformanceLevel(['wcag2a', 'wcag111']), 'A'));
test('best-practice rule has no level', () => assert.strictEqual(conformanceLevel(['best-practice']), null));

// --- detectOverlays ---
test('detects accessiBe from source', () => {
  const hits = detectOverlays('<script src="https://acsbapp.com/apps/app/dist/js/app.js"></script>');
  assert.strictEqual(hits.length, 1);
  assert.strictEqual(hits[0].key, 'accessibe');
});
test('detects UserWay case-insensitively', () => {
  const hits = detectOverlays('<div data-uw-feature></div><script>USERWAY_p</script>');
  assert.strictEqual(hits[0].key, 'userway');
});
test('no overlay in clean HTML', () => {
  assert.strictEqual(detectOverlays('<html><body><h1>Hi</h1></body></html>').length, 0);
});

// --- enrichIssue ---
test('enriches a mapped rule with domain framing', () => {
  const issue = enrichIssue({
    id: 'color-contrast', impact: 'serious', tags: ['wcag2aa', 'wcag143'],
    help: 'Elements must meet contrast', helpUrl: 'https://x',
    nodes: [{ target: ['.a'] }, { target: ['.b'] }],
  });
  assert.strictEqual(issue.wcag, '1.4.3');
  assert.strictEqual(issue.level, 'AA');
  assert.strictEqual(issue.isHardFailure, true);
  assert.strictEqual(issue.elementCount, 2);
  assert.ok(issue.demandRisk && issue.demandRisk.length > 0, 'has demand-letter framing');
  assert.strictEqual(issue.rank, IMPACT_RANK.serious);
});
test('falls back to axe help for unmapped rule (no coverage dropped)', () => {
  const issue = enrichIssue({
    id: 'some-new-rule', impact: 'minor', tags: ['wcag2a', 'wcag131'],
    help: 'Do the thing', nodes: [],
  });
  assert.strictEqual(issue.title, 'Do the thing');
  assert.strictEqual(issue.wcag, '1.3.1');
  assert.strictEqual(issue.fix, 'Do the thing');
});
test('best-practice violation is advisory, not a hard failure', () => {
  const issue = enrichIssue({ id: 'region', impact: 'moderate', tags: ['best-practice'], nodes: [] });
  assert.strictEqual(issue.isHardFailure, false);
  assert.strictEqual(issue.level, null);
});

// --- riskBand ---
test('critical => High', () => assert.strictEqual(riskBand({ critical: 1, serious: 0, moderate: 0 }).band, 'High'));
test('3 serious => High', () => assert.strictEqual(riskBand({ critical: 0, serious: 3, moderate: 0 }).band, 'High'));
test('1 serious => Elevated', () => assert.strictEqual(riskBand({ critical: 0, serious: 1, moderate: 0 }).band, 'Elevated'));
test('moderate only => Moderate', () => assert.strictEqual(riskBand({ critical: 0, serious: 0, moderate: 2 }).band, 'Moderate'));
test('clean => Low', () => assert.ok(riskBand({ critical: 0, serious: 0, moderate: 0 }).band.startsWith('Low')));

// --- buildReport (integration of the pure pipeline) ---
const fakeAxe = {
  violations: [
    { id: 'color-contrast', impact: 'serious', tags: ['wcag2aa', 'wcag143'], help: 'contrast', helpUrl: 'u', nodes: [{ target: ['.p'] }, { target: ['.q'] }] },
    { id: 'image-alt', impact: 'critical', tags: ['wcag2a', 'wcag111'], help: 'alt', helpUrl: 'u', nodes: [{ target: ['img'] }] },
    { id: 'region', impact: 'moderate', tags: ['best-practice'], help: 'region', nodes: [{ target: ['div'] }] },
  ],
  passes: [{ id: 'x' }],
  incomplete: [{ id: 'y' }],
};

test('buildReport separates hard failures from advisory', () => {
  const r = buildReport(fakeAxe, '<html></html>');
  assert.strictEqual(r.hardIssues.length, 2, 'contrast + image-alt are hard');
  assert.strictEqual(r.advisoryIssues.length, 1, 'region is advisory');
});
test('buildReport sorts hard issues by severity (critical first)', () => {
  const r = buildReport(fakeAxe, '');
  assert.strictEqual(r.hardIssues[0].id, 'image-alt', 'critical sorts above serious');
});
test('buildReport counts and risk band reflect only hard failures', () => {
  const r = buildReport(fakeAxe, '');
  assert.strictEqual(r.counts.critical, 1);
  assert.strictEqual(r.counts.serious, 1);
  assert.strictEqual(r.risk.band, 'High');
  assert.strictEqual(r.totalElementsAffected, 3); // 2 contrast + 1 image
});
test('buildReport surfaces overlay warning when present', () => {
  const r = buildReport(fakeAxe, '<script src="acsbapp.com/x.js"></script>');
  assert.strictEqual(r.overlays.length, 1);
  assert.ok(r.overlays[0].warning.includes('1,000,000'), 'cites the real FTC fine');
});
test('buildReport always carries the honest coverage caveat', () => {
  const r = buildReport(fakeAxe, '');
  assert.strictEqual(r.coverageNote, AUTOMATED_COVERAGE_NOTE);
  assert.ok(r.freeShowsEverythingDetected, 'free tier hides no detected findings');
});
test('headline summarizes a failing report', () => {
  const h = headline(buildReport(fakeAxe, ''));
  assert.ok(h.includes('WCAG AA failures') && h.includes('High'));
});
test('headline handles a clean report honestly', () => {
  const h = headline(buildReport({ violations: [], passes: [], incomplete: [] }, ''));
  assert.ok(h.includes('human review still required'));
});

console.log(`\n${passed} assertions passed.`);
