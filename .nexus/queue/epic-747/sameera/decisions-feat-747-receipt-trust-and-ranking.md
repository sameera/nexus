## 2026-09-21 — The shared repository rule is the existing `sameRepo`, widened

- **Choice:** widen the comparator the provenance-reference module already exports rather than adding a second, verdict-specific one beside it; both verdict readers now call it.
- **Why:** invariant 4 asks for exactly one comparison rule, and a new function next to an existing one named for the same question is how a second rule starts.
- **Refuted alternative:** a new `sameRepository` exported alongside `sameRepo`, leaving the older one for bare-form callers.

## 2026-09-21 — A stamp that parses as neither form falls back to case-folded equality

- **Choice:** when either side is not a two- or three-segment repository identity, compare the two strings case-insensitively instead of rejecting.
- **Why:** that is exactly today's behaviour for an unparseable stamp, so the widening cannot make a previously accepted verdict fail.
- **Refuted alternative:** reject any stamp that does not parse, which would newly drop verdicts nobody has complained about.

## 2026-09-21 — The command wraps the existing single-pull-request reader

- **Choice:** `nexus pr-verdict` calls the compiled reader that already answers this question, extended with the two filters only the gate's prose had been applying (maintainer authorship, the pull request a block names), rather than a second selection implementation behind the command.
- **Why:** the record's point is that the compiled reader was already right and the gate had no way to reach it; a fresh implementation would be a third reader to keep in step.
- **Refuted alternative:** a standalone reader in the epic-verdicts library, leaving the harness reader untouched.

## 2026-09-21 — An author association GitHub did not state is unknown, not untrusted

- **Choice:** a block whose payload carries no `authorAssociation` is accepted; one that states an association outside OWNER/MEMBER/COLLABORATOR is rejected.
- **Why:** it is the same unstated-is-unknown rule the record fixes for the repository stamp, and GitHub always states the field in a real run, so nothing a live gate reads is weakened.
- **Refuted alternative:** reject an absent association, which would drop every verdict read from a payload that did not request the field.

## 2026-09-21 — `--repo` is required rather than resolved from the checkout

- **Choice:** the command refuses with a usage error when the caller does not name the repository it is reading.
- **Why:** invariant 9 asks every caller to tell the command which repository it is reading; resolving it silently would let a caller that never knew leave the trust check inert and look identical.
- **Refuted alternative:** fall back to the checkout's own identity when `--repo` is omitted.

## 2026-09-21 — Recovery keeps its own close-comment trust rule, and only the PR verdict moves to the command
- **Choice:** `/nxs.distill --recover` now calls `nexus pr-verdict` for the linked pull request's analyze block, but keeps its prose rule for selecting the epic issue's close comment.
- **Why:** invariant 8 is scoped to "which verdict a pull request carries"; the close comment is a different question on a different surface, and no command answers it yet, so replacing that prose would mean either inventing an unasked-for command or dropping the rule.
- **Refuted alternative:** also strip the `authorAssociation` mechanics from the close-comment step so the skill names no trust rule at all — rejected because it removes a rule instead of moving it, leaving the recovery stage with no stated way to ignore an untrusted close comment.
