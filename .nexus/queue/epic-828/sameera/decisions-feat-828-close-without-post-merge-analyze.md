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

## 2026-10-03 — The landed check compares zero-context per-file patches with positions dropped
- **Choice:** Take each file's patch with `-U0` and rename detection off, drop the hunk positions, the function-context text and the blob index, and compare what is left; a deletion compares as a deletion alone, a binary file by the blob it leaves.
- **Why:** With no context lines a sibling's nearby edit or a position shift leaves the removed and added lines identical, while a rename, deletion or mode change still shows in the file headers (D4, G8, G9).
- **Refuted alternative:** Compare per-file patches with the default three context lines, which reads a sibling edit within three lines as a change no analyze run can clear.

## 2026-10-03 — A file the range landed but analysis never reviewed counts as changed
- **Choice:** Report every file either change touches, so a file only the landed change touches is changed.
- **Why:** Against a reviewed change of nothing, any landed change differs, and leaving it out would let unreviewed code land behind an "unchanged" result.
- **Refuted alternative:** Report reviewed files only, as the acceptance criterion's wording reads, which hides a file a merge added on its own.

## 2026-10-03 — The landed check rides on `epic-verdicts ranges`, and unreadable evidence blocks
- **Choice:** Add a per-story `landed` list and `not-landed` and `landed-unreadable` blocks to the `ranges` output; a changed file is reported but not blocked on, and the close record and machine block gain an additive `landed_check` key.
- **Why:** The check needs each range and checkout `ranges` already resolves, and close cannot stamp a result it could not read; whether a changed file stops close is #842's stale gate.
- **Refuted alternative:** A sibling `landed` verb, which would re-run the claiming read and the derivation and could disagree with the ranges close stamps.

## 2026-10-04 — The claiming read returns every state; merged-only callers narrow it at their own call site
- **Choice:** Replace `resolveStoryMergedPrs` with `readStoryClaims` (every claiming pull request with its state) plus `mergedOnly`/`mergedClaims`; evidence, coverage (through a new `readCoverageClaims`) and close-ranges' derivation each call the filter where they ask, and the old merged-only shape is kept for them unchanged.
- **Why:** R3 asks for each merged-only caller to filter explicitly, and returning the old `StoryMergedPr` shape from the filter makes "sees exactly what it saw before" a plain equality the regression tests can assert.
- **Refuted alternative:** Keep `resolveStoryMergedPrs` as a wrapper that filters inside the read module, which hides the filter from the callers R3 wants to make it visible in.

## 2026-10-04 — Story states ride on `epic-verdicts ranges`, apart from its range blocks
- **Choice:** Add `states` (current / never-reviewed / unshipped / unknown / excluded, each with per-pull-request `findings`) and `closable` to the `ranges` output; `ok` and `blocking` keep meaning range and landing blocks only.
- **Why:** The classification needs the same claiming read and receipt reads `ranges` already makes, and keeping `ok` unchanged leaves every #841/#846 expectation intact while #842 adds stale as one more state and finding kind.
- **Refuted alternative:** Fold never-reviewed and unshipped into `blocking`, which flips `ok` on every existing case whose receipt names no story.

## 2026-10-04 — Never reviewed is decided per merged pull request
- **Choice:** Every merged claiming pull request must carry a receipt naming the story; each one that does not is named with `/nxs.analyze --pr <N>`. A no-range pull request is exempt when another receipt names the story.
- **Why:** A follow-up pull request with no receipt is code nobody checked, and the story's goal is that an epic never closes over such work; a no-range pull request landed nothing to review, and naming analyze on it would be a loop.
- **Refuted alternative:** Never reviewed only when no receipt on any claiming pull request names the story, which lets an unanalysed follow-up close silently.

## 2026-10-04 — An unreadable receipt makes its story unknown; a failed claiming read still stops the run
- **Choice:** A receipt read failure is an `unknown` state with its cause (first in the order); a failed claiming read keeps exiting `story-read-failed` before anything is derived.
- **Why:** The record's order starts with read failure, and the claiming read failing means close does not know the story's pull requests at all, so it cannot derive or check anything.
- **Refuted alternative:** Report a failed claiming read as an `unknown` story and carry on, which derives ranges for an epic whose pull-request set is incomplete.
