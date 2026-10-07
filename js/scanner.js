// Pasted markup never enters the application document. Each scan runs in a
// fresh opaque-origin sandbox; only the trusted engine/bridge can run scripts.
const AXE_URL = new URL('../vendor/axe.min.js', import.meta.url).href;
const BRIDGE_URL = new URL('./scanner-frame.js', import.meta.url).href;
export const MAX_HTML_LENGTH = 1_000_000;
const SCAN_TIMEOUT_MS = 15000;
const CHANNEL = 'accessproof-scan';

const escapeAttribute = (value) => String(value).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// This shell contains trusted code URLs only. HTML arrives later as message
// data, so malformed markup cannot break out of an embedded script/string.
export function createScanDocument(token, parentOrigin) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid scan token.');
  const policy = `default-src 'none'; script-src 'nonce-${token}'; ` +
    "style-src 'unsafe-inline'; img-src data:; font-src data:; " +
    "base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; connect-src 'none'";
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${escapeAttribute(policy)}">
<meta name="referrer" content="no-referrer">
<script nonce="${token}" src="${escapeAttribute(AXE_URL)}"></script>
<script nonce="${token}" data-scan-token="${token}" data-parent-origin="${escapeAttribute(parentOrigin)}" src="${escapeAttribute(BRIDGE_URL)}"></script>
</head><body></body></html>`;
}

const stringList = (value) => Array.isArray(value) && value.every((v) => typeof v === 'string');
const targetList = (value) => Array.isArray(value) && value.every((v) =>
  typeof v === 'string' || stringList(v));
const issueList = (value) => Array.isArray(value) && value.every((issue) =>
  issue && typeof issue.id === 'string' && typeof issue.help === 'string' &&
  ['minor', 'moderate', 'serious', 'critical', null].includes(issue.impact) &&
  stringList(issue.tags) && typeof issue.helpUrl === 'string' &&
  /^https:\/\/dequeuniversity\.com\//.test(issue.helpUrl) &&
  Array.isArray(issue.nodes) && issue.nodes.every((node) => node && targetList(node.target)));

// An opaque frame's origin is "null", which is not an identity. Bind every
// message to this exact WindowProxy and an unpredictable per-scan token too.
export function isScanMessage(event, source, token) {
  const data = event.data;
  if (!source || event.source !== source || event.origin !== 'null' ||
      !data || typeof data !== 'object' || Array.isArray(data) ||
      data.channel !== CHANNEL || data.token !== token) return false;
  if (data.type === 'ready') return true;
  if (data.type === 'error') return typeof data.message === 'string' && data.message.length <= 300;
  const result = data.result;
  return data.type === 'result' && result && typeof result === 'object' &&
    issueList(result.violations) && issueList(result.passes) && issueList(result.incomplete) &&
    typeof result.testEngine?.version === 'string';
}

export function scanHtml(html) {
  const trimmed = String(html ?? '').trim();
  if (!trimmed) return Promise.reject(new Error('Paste your page HTML first.'));
  if (trimmed.length > MAX_HTML_LENGTH) return Promise.reject(new Error('Paste a smaller page (up to 1,000,000 characters).'));

  return new Promise((resolve, reject) => {
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)),
      (byte) => byte.toString(16).padStart(2, '0')).join('');
    const iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', 'allow-scripts'); // Never add allow-same-origin.
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('tabindex', '-1');
    iframe.setAttribute('title', 'accessproof-scan-target');
    // Keep real layout for axe's visibility/contrast checks, behind the UI.
    iframe.style.cssText =
      'position:fixed;top:0;left:0;width:1024px;height:768px;border:0;z-index:-1;pointer-events:none;';
    let started = false;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('message', receive);
      iframe.remove();
    };
    const fail = (message) => { cleanup(); reject(new Error(message)); };
    const receive = (event) => {
      if (!isScanMessage(event, iframe.contentWindow, token)) return;
      const data = event.data;
      if (data.type === 'ready' && !started) {
        started = true;
        // Opaque origins require '*'; the exact target window is already bound.
        iframe.contentWindow.postMessage({ channel: CHANNEL, token, type: 'scan', html: trimmed }, '*');
      } else if (data.type === 'error') {
        fail(data.message);
      } else if (data.type === 'result' && started) {
        cleanup();
        resolve(data.result);
      }
    };
    const timer = setTimeout(() => fail('The scan took too long. Try pasting less, or only the <body> content.'), SCAN_TIMEOUT_MS);
    window.addEventListener('message', receive);
    try {
      iframe.srcdoc = createScanDocument(token, window.location.origin);
      document.body.appendChild(iframe);
    } catch {
      fail('Could not start the isolated scan. Reload and try again.');
    }
  });
}
