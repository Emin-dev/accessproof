// AccessProof — WCAG / EAA knowledge map.
//
// This is the domain layer: it turns a raw axe-core rule id into plain-English
// meaning, who it hurts, why a demand-letter lawyer flags it, and a concrete
// fix. This is the part a random person cannot reproduce with a ChatGPT prompt —
// it encodes real WCAG 2.1 AA / EN 301 549 (the standard the European
// Accessibility Act points to) judgement, not generic advice.
//
// Pure data + pure functions only — no DOM, no browser globals — so it is unit
// testable in Node.

// The European Accessibility Act (EAA, Directive 2019/882) took effect
// 2025-06-28. For e-commerce and digital services it is met, in practice, by
// conforming to EN 301 549, which incorporates WCAG 2.1 Level AA. So every
// WCAG 2.1 A/AA failure below is EAA-relevant for an in-scope business.
export const EAA_EFFECTIVE_DATE = '2025-06-28';

// Impact → priority rank (higher = more urgent). Mirrors axe's own severity
// vocabulary so we never silently invent a level axe didn't assign.
export const IMPACT_RANK = { critical: 4, serious: 3, moderate: 2, minor: 1 };

// Overlay widgets that vendors market as one-line "compliance". Courts and the
// FTC disagree: the FTC fined accessiBe $1M in 2025 for deceptive "full
// compliance" claims, and a large share of 2024–2025 US accessibility lawsuits
// targeted sites that already had an overlay installed. Detecting one lets us
// give the single most valuable, specific finding: "this will not protect you."
export const OVERLAY_SIGNATURES = [
  { key: 'accessibe', label: 'accessiBe', markers: ['acsbapp.com', 'acsb.', 'accessibe', 'data-acsb'] },
  { key: 'userway', label: 'UserWay', markers: ['userway.org', 'userwayjs', 'data-uw', 'userway_p'] },
  { key: 'audioeye', label: 'AudioEye', markers: ['audioeye', 'aeaudioeye', 'ae-anchored'] },
  { key: 'equalweb', label: 'EqualWeb / Nagich', markers: ['equalweb', 'nagich', 'aioa-'] },
  { key: 'maxaccess', label: 'Max Access', markers: ['maxaccess'] },
  { key: 'accessiway', label: 'AccessiWay', markers: ['accessiway'] },
];

// Curated map of the highest-frequency, highest-liability axe rules. Anything
// not here falls back to axe's own help text (see enrichIssue), so coverage is
// never silently dropped — the map only *upgrades* an issue with real framing.
export const RULE_MAP = {
  'image-alt': {
    plain: 'Images are missing text alternatives',
    affects: 'Blind and low-vision people using screen readers hear nothing where the image is.',
    demandRisk: 'One of the most-cited failures in accessibility demand letters — trivially provable by a lawyer running the same scan.',
    fix: 'Add a meaningful alt attribute to every informative <img>; use alt="" only for purely decorative images.',
    sc: '1.1.1',
  },
  'color-contrast': {
    plain: 'Text does not have enough contrast against its background',
    affects: 'Low-vision users, older users, and anyone on a phone in sunlight cannot read the text.',
    demandRisk: 'The single most common WCAG AA failure and a favourite in litigation because it is objective and measurable to the exact ratio.',
    fix: 'Ensure normal text is at least 4.5:1 and large text 3:1 against its background. Darken the text or lighten the background.',
    sc: '1.4.3',
  },
  'link-name': {
    plain: 'Links have no readable text',
    affects: 'Screen-reader users hear "link" with no destination; keyboard users cannot tell where a link goes.',
    demandRisk: 'Flagged because it blocks the core task — navigating — and is easy to demonstrate.',
    fix: 'Give every <a> discernible text, or an aria-label on icon-only links.',
    sc: '2.4.4',
  },
  'button-name': {
    plain: 'Buttons have no accessible name',
    affects: 'Screen-reader users hear "button" with no idea what it does — often the Add-to-Cart or Checkout control.',
    demandRisk: 'High-liability on a store: an unnamed checkout button is a direct barrier to purchasing.',
    fix: 'Add visible text or an aria-label to every <button> and role="button" element.',
    sc: '4.1.2',
  },
  'label': {
    plain: 'Form fields have no associated label',
    affects: 'Screen-reader users cannot tell what to type; voice-control users cannot target the field.',
    demandRisk: 'Checkout and contact forms without labels are a classic cited barrier to completing a transaction.',
    fix: 'Associate every input with a <label for> or an aria-label/aria-labelledby.',
    sc: '3.3.2',
  },
  'html-has-lang': {
    plain: 'The page does not declare its language',
    affects: 'Screen readers may use the wrong pronunciation rules, making content unintelligible.',
    demandRisk: 'A quick, objective win for the opposing side — present or absent, no argument.',
    fix: 'Add a lang attribute to <html> (e.g. lang="en", lang="fr", lang="az").',
    sc: '3.1.1',
  },
  'document-title': {
    plain: 'The page has no title',
    affects: 'Screen-reader and multi-tab users cannot identify the page.',
    demandRisk: 'Objective and binary — easy to prove.',
    fix: 'Add a unique, descriptive <title> element.',
    sc: '2.4.2',
  },
  'link-in-text-block': {
    plain: 'Links are distinguished only by colour',
    affects: 'Colour-blind users cannot tell links from surrounding text.',
    demandRisk: 'Cited alongside contrast failures as a pattern of colour-only meaning.',
    fix: 'Add underline or another non-colour indicator to inline links, or raise contrast against the text to 3:1.',
    sc: '1.4.1',
  },
  'frame-title': {
    plain: 'Embedded frames have no title',
    affects: 'Screen-reader users cannot tell what an iframe (e.g. an embedded payment or map) contains.',
    demandRisk: 'Relevant on stores that embed third-party checkout or booking iframes.',
    fix: 'Add a descriptive title attribute to every <iframe>.',
    sc: '4.1.2',
  },
  'aria-required-attr': {
    plain: 'ARIA elements are missing required attributes',
    affects: 'Screen readers announce broken or misleading state for custom widgets.',
    demandRisk: 'Broken ARIA is often worse than none and reads as negligent implementation.',
    fix: 'Supply every required ARIA attribute for the role, or remove the role and use a native element.',
    sc: '4.1.2',
  },
  'aria-valid-attr-value': {
    plain: 'ARIA attributes have invalid values',
    affects: 'Assistive tech announces wrong or no information for the control.',
    demandRisk: 'Demonstrates an unmaintained, non-conforming custom component.',
    fix: 'Correct the ARIA attribute values to valid tokens or ID references.',
    sc: '4.1.2',
  },
  'select-name': {
    plain: 'Dropdowns have no accessible name',
    affects: 'Screen-reader users cannot tell what a <select> (size, quantity, country) is for.',
    demandRisk: 'Directly blocks configuring and buying a product.',
    fix: 'Associate every <select> with a label or aria-label.',
    sc: '4.1.2',
  },
  'input-image-alt': {
    plain: 'Image buttons have no text alternative',
    affects: 'Screen-reader users cannot identify an image-based submit/search button.',
    demandRisk: 'Blocks search and submit actions — high-impact.',
    fix: 'Add an alt attribute to every <input type="image">.',
    sc: '1.1.1',
  },
  'list': {
    plain: 'Lists are not correctly structured',
    affects: 'Screen readers lose the "3 of 10 items" grouping that makes lists navigable.',
    demandRisk: 'Part of a "structure not conveyed" pattern in reports.',
    fix: 'Ensure <ul>/<ol> contain only <li> children.',
    sc: '1.3.1',
  },
  'heading-order': {
    plain: 'Headings skip levels',
    affects: 'Screen-reader users navigating by heading lose the document outline.',
    demandRisk: 'Secondary, but cited as evidence of non-semantic markup.',
    fix: 'Use headings in order (h1 → h2 → h3) without skipping levels.',
    sc: '1.3.1',
  },
  'video-caption': {
    plain: 'Videos have no captions',
    affects: 'Deaf and hard-of-hearing users get no access to spoken content.',
    demandRisk: 'A named WCAG AA requirement (1.2.2) and frequent litigation subject for media-heavy stores.',
    fix: 'Provide synchronized captions for all prerecorded video with audio.',
    sc: '1.2.2',
  },
  'meta-viewport': {
    plain: 'Zoom is disabled',
    affects: 'Low-vision users cannot pinch-zoom to read on mobile.',
    demandRisk: 'Objective and common on older themes; blocks a documented AA requirement (1.4.4).',
    fix: 'Remove user-scalable=no and maximum-scale from the viewport meta tag.',
    sc: '1.4.4',
  },
};

// Extract the most specific WCAG success criterion from an axe rule's tags.
// axe tags look like 'wcag111', 'wcag143', 'wcag2aa'. We turn 'wcag111' into
// '1.1.1'. Returns null when the rule carries no numeric SC tag (best-practice
// rules), which the caller treats as "advisory, not a hard AA failure".
export function wcagCriterionFromTags(tags = []) {
  for (const tag of tags) {
    const m = /^wcag(\d)(\d)(\d+)$/.exec(tag);
    if (m) return `${m[1]}.${m[2]}.${Number(m[3].length > 1 ? m[3] : m[3])}`;
  }
  return null;
}

// Conformance level from tags: 'A', 'AA', or null (best-practice only).
export function conformanceLevel(tags = []) {
  if (tags.includes('wcag2aa') || tags.includes('wcag21aa') || tags.includes('wcag22aa')) return 'AA';
  if (tags.includes('wcag2a') || tags.includes('wcag21a') || tags.includes('wcag22a')) return 'A';
  return null;
}

// Scan raw HTML text for overlay-widget signatures. Returns the matched
// overlay descriptors (possibly several). Case-insensitive substring match on
// the source — deliberately simple and honest about being a heuristic.
export function detectOverlays(html = '') {
  const hay = String(html).toLowerCase();
  return OVERLAY_SIGNATURES.filter(sig => sig.markers.some(m => hay.includes(m.toLowerCase())));
}
