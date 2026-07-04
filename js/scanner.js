// AccessProof — browser scanner. Renders user-supplied HTML in an isolated,
// same-origin iframe and runs the real axe-core engine INSIDE that frame.
// Nothing is ever sent anywhere: the scan is 100% local to the browser tab.
//
// Why in-frame: running the parent's axe against a *different* frame's document
// makes axe hang on cross-frame messaging. Loading axe into the target frame and
// running it there is the reliable, supported approach.

// Absolute URL to the vendored engine, resolved against this module's location
// so it works from any page path.
const AXE_URL = new URL('../vendor/axe.min.js', import.meta.url).href;

const AXE_OPTIONS = {
  // WCAG 2.1 A/AA is what EN 301 549 (and therefore the EAA) requires. We also
  // keep best-practice rules so the report can show advisory items separately.
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
  },
};

// Strip anything executable before rendering: the frame is NOT sandboxed (so axe
// and computed styles work natively), so we must guarantee the pasted markup
// can't run code. Remove <script>, inline on*="" handlers, and javascript: URLs.
export function sanitizeHtml(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');
}

// Render sanitized HTML into a fresh same-origin iframe, inject axe into it, and
// resolve with the frame's window/document once axe is ready. The frame is
// rendered genuinely on-screen (1024x768) but at z-index:-1 behind the opaque
// page — so axe's contrast/visibility checks see real computed styles while the
// user sees nothing. (visibility:hidden / display:none / off-screen would make
// axe skip colour-contrast entirely.)
function renderAndArm(html) {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('title', 'accessproof-scan-target');
    iframe.style.cssText =
      'position:fixed;top:0;left:0;width:1024px;height:768px;border:0;z-index:-1;pointer-events:none;';
    document.body.appendChild(iframe);

    const cleanup = () => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); };
    const fail = (msg) => { clearTimeout(timer); cleanup(); reject(new Error(msg)); };

    const timer = setTimeout(
      () => fail('The scan took too long. Try pasting less, or only the <body> content.'),
      15000,
    );

    try {
      const doc = iframe.contentDocument;
      doc.open();
      doc.write(sanitizeHtml(html));
      doc.close();
      if (!doc.documentElement) throw new Error('empty');

      // Inject axe into the frame and run it in the frame's own context.
      const s = doc.createElement('script');
      s.src = AXE_URL;
      s.onload = () => {
        clearTimeout(timer);
        // Let inline <style> apply + layout settle before contrast reads styles.
        // Use setTimeout, not requestAnimationFrame: in a backgrounded/occluded
        // tab rAF is paused and would never fire, hanging the scan.
        setTimeout(() => {
          if (iframe.contentWindow && iframe.contentWindow.axe) {
            resolve({ win: iframe.contentWindow, doc, cleanup });
          } else {
            fail('The accessibility engine did not initialise. Reload and try again.');
          }
        }, 60);
      };
      s.onerror = () => fail('The accessibility engine failed to load. Reload and try again.');
      (doc.head || doc.documentElement).appendChild(s);
    } catch {
      fail('Could not read the pasted markup. Make sure you copied real HTML.');
    }
  });
}

// Scan a string of HTML. Resolves with axe's raw results object
// { violations, passes, incomplete, ... }. Rejects with a friendly Error.
export async function scanHtml(html) {
  const trimmed = (html || '').trim();
  if (!trimmed) throw new Error('Paste your page HTML first.');

  const { win, doc, cleanup } = await renderAndArm(trimmed);
  try {
    return await win.axe.run(doc, AXE_OPTIONS);
  } finally {
    cleanup();
  }
}
