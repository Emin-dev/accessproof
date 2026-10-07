# AccessProof

AccessProof checks pasted HTML for machine-detectable accessibility issues using
[axe-core](https://github.com/dequelabs/axe-core). It groups findings into practical
remediation guidance and identifies common accessibility-overlay signatures.
The interface is a static HTML, CSS and JavaScript application; it needs no backend
or build step.

## What it does

- Runs the vendored axe-core engine locally in your browser.
- Reports WCAG A/AA failures and separate best-practice advice.
- Keeps pasted HTML out of the application document and does not upload it.
- Includes a deliberately inaccessible sample store for a quick demonstration.
- Labels the paid-report flow as a sandbox. No payment integration is enabled.

Automated results are a starting point for accessibility work, not a compliance
certificate or legal opinion. Keyboard behavior, focus order, meaningful text
alternatives and assistive-technology use require human review.

## Run locally

Use Node.js 22 or newer, then run:

```sh
node server.mjs
```

Open `http://localhost:8097`. Set `PORT` to use another local port. Serve the files
through HTTP or HTTPS; opening `index.html` directly as a file is not supported.
No npm installation is needed to run the app.

## Preview security and scope

Each scan uses a fresh iframe with `sandbox="allow-scripts"` and **without**
`allow-same-origin`. A restrictive Content Security Policy permits only two
nonce-authorized local scripts: the vendored engine and the scan bridge. The
bridge checks the parent identity; the application checks the exact child window,
opaque origin, per-scan random token and result schema. Frames and message
listeners are removed after success, failure or a 15-second timeout.

Pasted markup is parsed only inside that sandbox. Scripts, event handlers,
redirect metadata, embedded documents and templates are removed before rendering.
External stylesheets, fonts, images, media and network requests are blocked.
Inline styles, ordinary HTML semantics, document language/title and embedded
`data:` images/fonts remain available for a static check. Input is limited to
1,000,000 characters.

These restrictions are intentional: fetching resources from pasted HTML would
leak browsing activity, and running its scripts could expose the host page.
Results therefore describe a restricted static snapshot, not the original live
site. External CSS, JavaScript-driven content, frames and shadow-root templates
need separate review on the source site. Do not interpret a clean snapshot as a
complete accessibility assessment. Normal requests still load AccessProof's own
static files from its host.

## Tests

Pure report and isolation-protocol tests need only Node.js:

```sh
node test/report.test.mjs
node test/sanitize.test.mjs
```

Browser regression tests use Playwright as a development-only dependency:

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run test:browser
```

The browser suite uses synthetic local fixtures and one Chromium worker. It checks
real axe findings, inline contrast, language/title handling, parent-origin
isolation, blocked resource requests, malformed markup, message spoofing,
concurrent scans, engine failure and timeout cleanup. It records screenshots of
the unchanged interface and sample results. Firefox and WebKit are not covered.

The pull-request workflow runs unit and browser checks with read-only repository
permissions and saves test evidence. It contains no deployment step. See the
specific pull request's checks for current results; merely adding a test does not
mean it has passed. Local environments that prohibit Chromium sockets cannot run
the browser suite and must rely on the isolated CI job for that coverage.

## Dependencies and licenses

The runtime engine is vendored **axe-core 4.14.0**, under MPL-2.0. Source,
provenance and included third-party notices are documented in
[`vendor/README.md`](vendor/README.md). There are no npm runtime dependencies.
Playwright is pinned in `package-lock.json` for repeatable development checks.
