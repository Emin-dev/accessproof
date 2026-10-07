// Trusted classic script inside the opaque-origin sandbox. Never loaded as an
// application module or granted same-origin access. The CSP precedes both scripts.
(() => {
  const token = document.currentScript.dataset.scanToken;
  const parentOrigin = document.currentScript.dataset.parentOrigin;
  const host = window.parent;
  const engine = window.axe;
  const doc = document;
  const CHANNEL = 'accessproof-scan';
  const send = (type, extra = {}) => host.postMessage({ channel: CHANNEL, token, type, ...extra }, parentOrigin);
  const options = {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
  };

  function render(html) {
    // Parse only in this isolated, network-restricted context, never the parent.
    // Preserve document language, title, semantics and inline styles. Removal is
    // defense in depth; origin isolation and CSP are the security boundaries.
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script, base, link, iframe, frame, frameset, object, embed, meta[http-equiv], template')
      .forEach((node) => node.remove());
    for (const node of parsed.querySelectorAll('*')) {
      for (const attr of Array.from(node.attributes)) {
        const name = attr.localName.toLowerCase();
        const value = attr.value.replace(/[\u0000-\u0020]/g, '').toLowerCase();
        if (name.startsWith('on') || ['nonce', 'srcdoc', 'autofocus', 'ping'].includes(name) ||
            (['href', 'src', 'action', 'formaction'].includes(name) && /^(javascript|vbscript):/.test(value))) {
          node.removeAttributeNode(attr);
        }
      }
    }
    for (const attr of Array.from(parsed.documentElement.attributes)) {
      doc.documentElement.setAttribute(attr.name, attr.value);
    }
    // Retain the shell's CSP; incoming metadata cannot replace or relax it.
    for (const child of Array.from(parsed.head.childNodes)) doc.head.appendChild(child);
    doc.body.replaceWith(parsed.body);
  }

  // Send only the documented fields the report needs; no DOM nodes or functions.
  const projectIssues = (issues) => issues.map(({ id, impact, tags, help, helpUrl, nodes }) => ({
    id, impact, tags, help, helpUrl, nodes: nodes.map(({ target }) => ({ target })),
  }));

  const receive = async (event) => {
    const data = event.data;
    if (event.source !== host || event.origin !== parentOrigin || !data ||
        data.channel !== CHANNEL || data.token !== token || data.type !== 'scan' ||
        typeof data.html !== 'string' || data.html.length > 1_000_000) return;
    window.removeEventListener('message', receive); // One request per fresh frame.
    try {
      if (!engine) throw new Error('engine');
      render(data.html);
      // Timers also settle layout in occluded/background tabs, unlike rAF.
      await new Promise((resolve) => setTimeout(resolve, 60));
      const result = await engine.run(doc, options);
      send('result', { result: {
        violations: projectIssues(result.violations),
        passes: projectIssues(result.passes),
        incomplete: projectIssues(result.incomplete),
        testEngine: { version: result.testEngine.version },
      } });
    } catch {
      send('error', { message: 'The isolated scan could not finish. Reload or try a smaller HTML snippet.' });
    }
  };
  window.addEventListener('message', receive);
  send('ready');
})();
