// AccessProof — paid-tier checkout. SANDBOX ONLY.
//
// Per project rules: no real payment provider is wired, nothing is ever charged.
// This models the paid "Conformance Report + remediation guide" tier so the flow
// is real and testable, and is unmistakably labelled as not-yet-live. Going live
// with real charging is a deliberate stop-and-ask step, never automatic.
export const PAYMENT_MODE = 'sandbox';

export const PAID_TIER = {
  name: 'Conformance Report + Remediation',
  price: 'from $700 / site',
  includes: [
    'A written, dated WCAG 2.1 AA / EN 301 549 conformance statement (demand-letter grade)',
    'Human review of the issues automated scanning cannot catch (keyboard, focus order, alt quality)',
    'Actual code/theme-level fixes applied, then re-verified',
    'Optional $39/mo monitoring so a theme update never silently breaks compliance',
  ],
};

// Returns a labelled sandbox result. Never contacts a network, never charges.
export function startCheckout() {
  if (PAYMENT_MODE !== 'sandbox') {
    throw new Error('Live charging is not enabled. This is a deliberate stop-and-ask boundary.');
  }
  return {
    ok: true,
    sandbox: true,
    message:
      'This is a preview — no payment was taken. To commission a real conformance ' +
      'report and fixes, this connects to a human review. Payment is not wired yet.',
  };
}
