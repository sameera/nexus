## 2026-10-03 — Close's ranges come from a new `epic-verdicts ranges` subverb
- **Choice:** Add `nexus epic-verdicts ranges --epic <N>` beside `close-gate`, and stamp only its range list; `close-gate` keeps gating on the ledger but its range is no longer stamped.
- **Why:** The ledger gate must stay until #842/#843 replace it, and keeping the derivation in its own verb leaves the gate's output, and every caller of it, unchanged.
- **Refuted alternative:** Make `close-gate` derive ranges itself, which changes the output of a verb that #843 retires anyway.

## 2026-10-03 — Every merged pull request needs a checkout, even one with a shipped record
- **Choice:** Locate the checkout of every merged claiming pull request before anything is derived, and stop on a missing one even when a shipped record already stamps its range.
- **Why:** G5 is unconditional, distill's diff reader needs the same checkout for the stamped range, and the landed-file check (#846) will need it for every pull request.
- **Refuted alternative:** Require a checkout only for pull requests without a record, which lets an in-flight hub epic close and then block at distill.

## 2026-10-03 — An empty derived range is "no range"; any other refusal blocks
- **Choice:** Map the derivation's empty-diff refusal (pipeline stores excluded) to a `no-range` entry under the story, and treat every other refusal, or a missing merge commit, as a hard block naming the pull request.
- **Why:** An empty diff is exactly a pull request with no commits attributable to the story (G2); an ambiguous or unrecognised merge is a range close could not establish, and stamping around it would leave a story's code out of distill.
- **Refuted alternative:** Report every refusal as "no range", which would hide a real squash/rebase ambiguity behind a benign-looking entry.

## 2026-10-03 — A per-story `story_ranges` key, added beside `range`
- **Choice:** Keep `range:` as the flat, de-duplicated list distill reads, and add `story_ranges:` (per story, merge order, `range: none` for no-range) to both the close record and the machine block.
- **Why:** The machine-block change must be additive (D2), and a pull request implementing two stories must appear once in the diff source but under both stories.
- **Refuted alternative:** Nest ranges under stories only, which changes the shape distill and GitHub recovery already parse.
