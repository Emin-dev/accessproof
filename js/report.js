// AccessProof — report builder.
//
// Pure logic: turn a raw axe-core results object into a prioritized, honestly-
// scoped compliance report. No DOM, no browser globals — unit tested in Node.

import {
  IMPACT_RANK, RULE_MAP, EAA_EFFECTIVE_DATE,
  wcagCriterionFromTags, conformanceLevel, detectOverlays,
} from './wcag-eaa-map.js';

// The honest ceiling of automated testing. Independent research (Deque, WebAIM)
// puts axe-style automated detection at roughly 30–57% of WCAG issues. We state
// this everywhere so the tool never implies "0 violations = compliant" — which
// is exactly the false promise the overlay vendors were fined for.
export const AUTOMATED_COVERAGE_NOTE =
  'Automated testing detects only about a third to a half of WCAG issues. ' +
  'A clean automated scan is necessary but NOT sufficient for EAA conformance — ' +
  'keyboard operation, focus order, meaningful alt text, and screen-reader ' +
  'testing require human review.';

// One normalized issue from an axe violation.
export function enrichIssue(violation) {
  const tags = violation.tags || [];
  const mapped = RULE_MAP[violation.id] || null;
  const sc = (mapped && mapped.sc) || wcagCriterionFromTags(tags);
  const level = conformanceLevel(tags); // 'A' | 'AA' | null
  const nodes = violation.nodes || [];
  return {
    id: violation.id,
    impact: violation.impact || 'moderate',
    rank: IMPACT_RANK[violation.impact] || IMPACT_RANK.moderate,
    title: (mapped && mapped.plain) || violation.help || violation.id,
    wcag: sc,
    level,
    isHardFailure: level === 'A' || level === 'AA', // vs. best-practice advisory
    affects: mapped && mapped.affects,
    demandRisk: mapped && mapped.demandRisk,
    fix: (mapped && mapped.fix) || violation.help || 'See the linked guidance.',
    helpUrl: violation.helpUrl || null,
    elementCount: nodes.length,
    // A few representative CSS selectors, never the whole DOM (keep it readable
    // and avoid dumping the customer's markup back at them wholesale).
    sampleSelectors: nodes.slice(0, 3).map(n => (n.target || []).join(' ')).filter(Boolean),
  };
}

// Risk band from the counts of hard (A/AA) failures by severity. This is a
// communication device, not a legal verdict — labelled as such in the UI.
export function riskBand({ critical, serious, moderate }) {
  if (critical > 0 || serious >= 3) return {
    band: 'High', tone: 'high',
    meaning: 'Multiple blocking failures a demand letter could cite today.',
  };
  if (serious > 0 || moderate >= 5) return {
    band: 'Elevated', tone: 'elevated',
    meaning: 'Real AA failures present; remediation needed before an EAA challenge.',
  };
  if (moderate > 0) return {
    band: 'Moderate', tone: 'moderate',
    meaning: 'Some AA issues; fixable, but do not treat as conformant yet.',
  };
  return {
    band: 'Low (automated)', tone: 'low',
    meaning: 'No machine-detectable AA failures — but automated tools miss most issues; human review still required.',
  };
}

// Build the full report from axe results plus the raw HTML (for overlay
// detection). `axeResults` matches axe.run()'s shape: { violations, passes,
// incomplete }. Everything is derived — nothing is invented.
export function buildReport(axeResults = {}, rawHtml = '') {
  const violations = (axeResults.violations || []).map(enrichIssue);
  // Hard AA/A failures drive the score; best-practice items are shown but never
  // inflate the risk band.
  const hard = violations.filter(v => v.isHardFailure);
  const advisory = violations.filter(v => !v.isHardFailure);

  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of hard) counts[v.impact] = (counts[v.impact] || 0) + 1;

  // Sort by severity desc, then by how many elements are affected desc.
  const bySeverity = (a, b) => b.rank - a.rank || b.elementCount - a.elementCount;
  hard.sort(bySeverity);
  advisory.sort(bySeverity);

  const overlays = detectOverlays(rawHtml);

  return {
    generatedNote: `Checked against WCAG 2.1 A/AA (EN 301 549), the standard the EU Accessibility Act has required since ${EAA_EFFECTIVE_DATE}.`,
    coverageNote: AUTOMATED_COVERAGE_NOTE,
    counts,
    totalHardFailures: hard.length,
    totalElementsAffected: hard.reduce((s, v) => s + v.elementCount, 0),
    incompleteCount: (axeResults.incomplete || []).length,
    passCount: (axeResults.passes || []).length,
    risk: riskBand(counts),
    overlays: overlays.map(o => ({
      key: o.key,
      label: o.label,
      warning: `${o.label} overlay detected. An accessibility overlay does NOT make a site EAA-conformant — the US FTC fined an overlay vendor $1,000,000 in 2025 for exactly that claim, and many accessibility lawsuits target sites that already run one. The failures below are present despite the overlay.`,
    })),
    hardIssues: hard,
    advisoryIssues: advisory,
    // What's gated behind the paid conformance report (kept honest: the free
    // scan already shows every detected failure; the paid tier is the formal
    // written artefact + human remediation, not withheld findings).
    freeShowsEverythingDetected: true,
  };
}

// A compact one-line headline for share/preview surfaces.
export function headline(report) {
  if (report.totalHardFailures === 0) {
    return 'No machine-detectable AA failures found — human review still required.';
  }
  const c = report.counts;
  const parts = [];
  if (c.critical) parts.push(`${c.critical} critical`);
  if (c.serious) parts.push(`${c.serious} serious`);
  if (c.moderate) parts.push(`${c.moderate} moderate`);
  return `${report.totalHardFailures} WCAG AA failures (${parts.join(', ')}) across ${report.totalElementsAffected} elements — risk: ${report.risk.band}.`;
}
