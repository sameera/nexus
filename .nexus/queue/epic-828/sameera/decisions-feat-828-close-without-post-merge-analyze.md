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

## 2026-10-04 — The merge pre-check is a `nexus merge-precheck` verb, and the script prints its words
- **Choice:** Classify the receipt in a new `nexus merge-precheck` verb over `readPrVerdict` (clean / not-run / read-failure / head-moved / blocking, with `merge` true only for clean) and have the script print its message and merge only on `merge: true`.
- **Why:** Each of the four states and the moved head are then pinned by unit specs against real `gh` payloads, and the script cannot drift from the reader's view of trust and head.
- **Refuted alternative:** Classify in the script from `nexus pr-verdict` JSON, which leaves the four states testable only through stubbed shell runs.

## 2026-10-04 — Only-untrusted receipt blocks are a read failure, counted by the one reader
- **Choice:** The trusted receipt reader now counts the blocks it drops as untrusted (`untrustedBlocks`, additive on its result and on `pr-verdict`); the pre-check reports no trusted receipt plus a non-zero count as a read failure.
- **Why:** G21 forbids reporting an untrusted receipt as "not run", and only the reader knows a block was dropped.
- **Refuted alternative:** Report every pull request with no trusted receipt as "not run", which hides an impostor or a copied receipt behind the analyze remedy.

## 2026-10-04 — Story text leaves the receipt type, and `nexus story-fingerprints` is removed
- **Choice:** Drop `storyFingerprints` from the parsed receipt, so readers skip the old `story_fingerprints` key like any unused field, and delete `fingerprint.ts` and the `story-fingerprints` verb.
- **Why:** With no caller left, a parsed value nobody reads is the "recorded value" D12 says invites a gate to creep back; skipping the key keeps every old receipt readable (G37).
- **Refuted alternative:** Keep parsing the field and leave the verb registered but unused, which keeps dead code and a value a later reader could start gating on.

## 2026-10-04 — `verdict-check` refuses a drafted receipt that still records story text
- **Choice:** The pre-publish check refuses a block with a `story_fingerprints` line (`story-text-recorded`) instead of merely tolerating it.
- **Why:** It makes G38 hold mechanically at the one gate every publish passes, not only through analyze's prose.
- **Refuted alternative:** Accept such a block silently, which leaves G38 resting on prose the stage could drift from.

## 2026-10-04 — Each stale cause is its own finding, and a story keeps every finding
- **Choice:** Add `head-mismatch`, `record-revised` and `landed-change` as finding kinds beside `no-receipt`, each carrying its `remedies`; `stale` is decided after never reviewed, and a story in an earlier state still lists (and prints, as an "also stale" line) its stale causes.
- **Why:** G10 asks for every cause with its pull request and reason, and listing them whichever state wins lets a lead clear everything in one pass, as #847's findings already do.
- **Refuted alternative:** One `stale` finding per pull request with a list of causes, which mixes a remedy that only a waiver can meet with ones an analyze run clears.

## 2026-10-04 — The record's current digest is read once, through `fetchRecord`, only when a receipt stamps one
- **Choice:** `ranges` reads the epic's record sub-issue (from the resolver) through the record-digest library's fetch-and-hash, once per run and only when some receipt stamps a `record_hash`; a failed read, or a stamped digest on an epic with no record, makes each story that receipt names `unknown`.
- **Why:** That library is the one digest implementation `nexus record-digest` runs, and G10 forbids guessing current or stale from a digest close could not take.
- **Refuted alternative:** Re-hash the record the receipt's own `record` key names, which can be a qualified reference to another repository and is not the record the epic carries now.

## 2026-10-04 — An unreadable landed check makes its story unknown
- **Choice:** A landed check that failed on a pull request with a range adds an `unreadable` finding (`evidence: landed-check`) to each story its receipt names, beside the existing `landed-unreadable` block.
- **Why:** The story was otherwise reported `current` while close could not read whether its files landed as reviewed, and G10 reserves "unknown" for exactly that.
- **Refuted alternative:** Leave the state current and rely on the range block to stop close, which reports a story as current on evidence close never read.
