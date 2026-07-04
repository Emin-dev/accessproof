# AccessProof

An **EU Accessibility Act (EAA) compliance scanner** for online stores. Paste your
page's HTML and get the real WCAG 2.1 AA failures a demand letter would cite —
with plain-English explanations, who each issue blocks, and how to fix it.

- **100% local.** The scan runs in your browser (real [axe-core](https://github.com/dequelabs/axe-core) engine); nothing is uploaded.
- **Honest scope.** Automated testing catches only ~a third to a half of WCAG issues. A clean scan is necessary, not sufficient — the tool says so everywhere. This is not legal advice.
- **Overlay detection.** Flags accessibility-overlay widgets (accessiBe, UserWay, AudioEye…) and explains why they do not create compliance (the FTC fined accessiBe $1M in 2025 for that claim).

## Why it exists

The EAA has been in force since 28 June 2025; enforcement is ramping across the EU
(fines €100k–€900k). Overlay widgets are legally discredited, so real conformance
means fixing the underlying code. The free scan finds machine-detectable failures;
a paid **conformance report + remediation** tier (human review + applied fixes) is
where a defensible artefact comes from.

> Payment is **not** wired — the paid tier is a labelled sandbox. Going live with
> real charging is a deliberate manual step.

## Develop / test

```
node test/report.test.mjs   # pure-logic unit tests (no browser needed)
```

Zero build step, zero runtime dependencies (axe-core is vendored under `vendor/`).
