// AccessProof — UI wiring. Keeps DOM concerns here; all judgement lives in the
// pure, tested modules (report.js / wcag-eaa-map.js).
import { scanHtml } from './scanner.js';
import { buildReport, headline } from './report.js';
import { SAMPLE_STORE_HTML } from './sample.js';
import { PAID_TIER, startCheckout } from './checkout-sandbox.js';

const $ = (id) => document.getElementById(id);
const htmlInput = $('html-input');
const scanBtn = $('scan-btn');
const sampleBtn = $('sample-btn');
const scanStatus = $('scan-status');
const resultsEl = $('results');
const paidEl = $('paid');

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function setBusy(busy, msg) {
  scanBtn.disabled = busy;
  scanBtn.textContent = busy ? 'Scanning…' : 'Scan for failures';
  scanStatus.textContent = msg || '';
  scanStatus.classList.toggle('is-error', false);
}
function setError(msg) {
  scanBtn.disabled = false;
  scanBtn.textContent = 'Scan for failures';
  scanStatus.textContent = msg;
  scanStatus.classList.add('is-error');
}

function issueCard(issue) {
  const wcag = issue.wcag ? `WCAG ${esc(issue.wcag)}${issue.level ? ' (' + issue.level + ')' : ''}` : 'Best practice';
  const selectors = issue.sampleSelectors.length
    ? `<p class="issue-where">e.g. <code>${issue.sampleSelectors.map(esc).join('</code>, <code>')}</code></p>`
    : '';
  const affects = issue.affects ? `<p class="issue-affects"><span>Who it blocks:</span> ${esc(issue.affects)}</p>` : '';
  const risk = issue.demandRisk ? `<p class="issue-risk"><span>Why it’s cited:</span> ${esc(issue.demandRisk)}</p>` : '';
  return `<article class="issue issue-${esc(issue.impact)}">
    <div class="issue-head">
      <span class="issue-sev sev-${esc(issue.impact)}">${esc(issue.impact)}</span>
      <h3 class="issue-title">${esc(issue.title)}</h3>
    </div>
    <p class="issue-meta">${wcag} · ${issue.elementCount} element${issue.elementCount === 1 ? '' : 's'} affected</p>
    ${affects}
    ${risk}
    <p class="issue-fix"><span>Fix:</span> ${esc(issue.fix)}</p>
    ${selectors}
    ${issue.helpUrl ? `<p class="issue-link"><a href="${esc(issue.helpUrl)}" rel="noopener" target="_blank">Detailed guidance ↗</a></p>` : ''}
  </article>`;
}

function renderReport(report) {
  const r = report.risk;
  const overlayHtml = report.overlays.map((o) =>
    `<div class="overlay-hit"><strong>${esc(o.label)} overlay detected.</strong> ${esc(o.warning).replace(esc(o.label) + ' overlay detected. ', '')}</div>`
  ).join('');

  const hardHtml = report.hardIssues.length
    ? report.hardIssues.map(issueCard).join('')
    : `<p class="clean-note">No machine-detectable WCAG&nbsp;AA failures — but that is not a clean bill of health. Automated tools miss most issues; human review is still required.</p>`;

  const advisoryHtml = report.advisoryIssues.length
    ? `<details class="advisory"><summary>${report.advisoryIssues.length} advisory / best-practice item${report.advisoryIssues.length === 1 ? '' : 's'} (not counted as AA failures)</summary>
        <div class="advisory-list">${report.advisoryIssues.map(issueCard).join('')}</div>
      </details>`
    : '';

  resultsEl.innerHTML = `
    <div class="risk-banner tone-${esc(r.tone)}">
      <div class="risk-band">${esc(r.band)} risk</div>
      <p class="risk-head">${esc(headline(report))}</p>
      <p class="risk-meaning">${esc(r.meaning)}</p>
    </div>
    ${overlayHtml}
    <div class="counts">
      <span class="count"><b>${report.counts.critical || 0}</b> critical</span>
      <span class="count"><b>${report.counts.serious || 0}</b> serious</span>
      <span class="count"><b>${report.counts.moderate || 0}</b> moderate</span>
      <span class="count"><b>${report.passCount}</b> checks passed</span>
      <span class="count"><b>${report.incompleteCount}</b> need human review</span>
    </div>
    <div class="issues">${hardHtml}</div>
    ${advisoryHtml}
    <p class="coverage-inline">${esc(report.coverageNote)}</p>
  `;
  resultsEl.hidden = false;
  paidEl.hidden = false;
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function runScan(html) {
  setBusy(true, 'Running the accessibility engine locally…');
  try {
    const axeResults = await scanHtml(html);
    const report = buildReport(axeResults, html);
    renderReport(report);
    setBusy(false, '');
  } catch (err) {
    setError(err.message || 'Something went wrong. Try a smaller snippet.');
  }
}

scanBtn.addEventListener('click', () => runScan(htmlInput.value));
sampleBtn.addEventListener('click', () => {
  htmlInput.value = SAMPLE_STORE_HTML;
  runScan(SAMPLE_STORE_HTML);
});

// Paid tier (sandbox).
$('paid-price').textContent = PAID_TIER.price;
$('paid-includes').innerHTML = PAID_TIER.includes.map((i) => `<li>${esc(i)}</li>`).join('');
$('commission-btn').addEventListener('click', () => {
  const res = startCheckout();
  $('commission-status').textContent = res.message;
});

// Footer honest-scope note, sourced from the same constant the report uses.
import('./report.js').then((m) => { $('coverage-note').textContent = m.AUTOMATED_COVERAGE_NOTE; });
