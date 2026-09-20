## 2026-09-20 — The failure-class token set is a runtime value, not just a type

- **Choice:** `derive-entry-diff.ts` exports `DERIVE_PROBLEMS` as a `const` array and derives
  `DeriveProblem` from it, so a test can enumerate the set and a conformance test can check the
  command document names every token.
- **Why:** story #715 asks that the token contract be pinned by tests, and a TypeScript union alone
  has nothing to assert against at run time.
- **Refuted alternative:** keep the union and restate the token list in the spec. Refuted because
  that is a second copy of the set — the very defect this epic removes.

## 2026-09-20 — The Phase 0.4 not-merged gate loses its first consequence

- **Choice:** removing the introducing-commit fallback also removes the gate's "the
  introducing-commit diff is degenerate" consequence and the waiver's "skips the degenerate
  priority 1" clause; the gate now surfaces only the collapsed-single-PR consequence.
- **Why:** those sentences describe a diff path that no longer exists, so leaving them would be a
  dangling second statement of the rule story #715 consolidates. The derived diff is unchanged:
  Phase 1 already derived from the recorded range in both branches of the gate.
- **Refuted alternative:** leave the gate's prose alone as out of story scope. Refuted because
  AC2 requires no other passage to state a different rule for the same condition.

## 2026-09-20 — The entry-kind table gives `intake` the ephemeral-epic removal target

- **Choice:** the contract's removal-target column reads "the ephemeral-entry rule above,
  unchanged" for `intake`, not "none".
- **Why:** the document never named a removal target for an intake entry, so today Phase 5.6's
  ephemeral rule applies to it and skips when `.nexus/queue/epic-<n>/` is absent. Writing "none"
  would have been a behaviour change the story does not authorise.
- **Refuted alternative:** state "none", which is what an intake entry means in practice since its
  `<n>` is a pull request number. Refuted because the epic's first constraint is that a run over an
  unchanged queue produces identical artifacts.

## 2026-09-20 — The per-kind rules move to the contract by restating them kind-neutrally

- **Choice:** later phases name the *axis* ("the delta vocabulary this entry's kind gives", "the
  validation mode the contract gives") rather than the kind, so the phase text is true for all
  three kinds and the table is the only place a kind is named.
- **Why:** a phase that says "for a fix entry …" is a second copy of the table's fix row, which is
  exactly what story #716 removes.
- **Refuted alternative:** leave each phase's per-kind clause and add the table as a summary.
  Refuted because that makes nine copies instead of eight.
