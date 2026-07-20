## 2026-07-19 — This story ships as a prompt edit, no application source
- **Choice:** Implement domain filing and the taxonomy gate entirely inside `.claude/commands/nxs.distill.md`; no new TypeScript module, no new spec file.
- **Why:** The decision record calls filing "a synthesis judgment... not a separate deterministic classifier," and no code anywhere in the repo models `AskUserQuestion` or reads prompt-file content for assertions — confirmed against direct precedent (commit `59dad02`, a pure prompt-only gate addition to this same file, changed only the command file + the fingerprint pin).
- **Refuted alternative:** Adding a "prompt conformance" spec file that greps the command markdown for required substrings — rejected as speculative test machinery with zero repo precedent and a brittle false-signal risk (passes on paraphrase, fails on reword-without-behavior-change).

## 2026-07-19 — Ties in fit classification resolve to "forced," never "clear"
- **Choice:** When synthesis is genuinely unsure whether a rubric covers a new concept, classify it as a forced fit.
- **Why:** The epic's Success Metric requires a new concept is never silently filed against the reviewer's judgment — silence is only safe on a genuine, confident match.
- **Refuted alternative:** Default ties to "clear" to minimize gate interruptions — rejected, it directly risks the Success Metric's "never silently filed" guarantee.
