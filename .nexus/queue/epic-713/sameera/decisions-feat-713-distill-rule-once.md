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
