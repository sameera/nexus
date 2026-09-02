## 2026-09-01 — Receipt is a fixed plain-text shape, not JSON

- **Choice:** The translator prints a fixed five-field plain-text receipt (`translated:`, `sections changed:`, `sentences rewritten:`, `findings:`, then one line per finding).
- **Why:** The receipt is read by the invoking model, not parsed by a program, and a flat line shape is the cheapest thing to return on the leg the split exists to keep small.
- **Refuted alternative:** A JSON receipt object — machine-checkable, but it is not machine-read anywhere, and its punctuation costs tokens on every run.

## 2026-09-01 — The agent body names the two content rules it does not hold

- **Choice:** The agent body states the concreteness and add-nothing rules by name, and says they are not its own.
- **Why:** A small model told only "apply these six" will silently extend them; naming the two it must not execute is what makes the density-report behaviour follow.
- **Refuted alternative:** Omit them entirely, keeping the body minimal — cheaper, but it leaves the reporting duty in #416 unmotivated from the agent's side.

## 2026-09-01 — Density findings share the receipt's count field rather than adding a second list

- **Choice:** The receipt's fourth field is `density: <count>`, and the finding lines follow it directly; there is no separate general-findings list.
- **Why:** Density is the only finding kind the translator raises, so a second list would always be empty and would still cost a line on every run.
- **Refuted alternative:** Keep a generic `findings:` field with a typed prefix per line, which would extend to future finding kinds — but no other kind is in scope, and the epic's out-of-scope section rules out the one that might have been.

## 2026-09-01 — Regions pair by ordinal position within their own kind

- **Choice:** The comparison pairs the before copy's Nth fenced block with the after copy's Nth fenced block, and reports a surplus on either side as added or removed.
- **Why:** A single inserted region would otherwise shift every later pair and turn one edit into a run of findings naming the wrong lines.
- **Refuted alternative:** A longest-common-subsequence alignment over regions, which survives insertion better — but the extra machinery buys nothing for a check whose passing case is "nothing moved at all".

## 2026-09-01 — A criteria line is recognised by emphasis or by all three keywords

- **Choice:** A Given/When/Then line is a line carrying `**Given**`, `**When**` or `**Then**`, or one carrying all three keywords as standalone words.
- **Why:** The emphasised form is the template shape, and the all-three test catches a plainly written criterion without locking ordinary prose that merely says "given".
- **Refuted alternative:** Match any standalone `Given` — simpler, but it would freeze narrative sentences and make the translator unable to do its job on them.

## 2026-09-01 — The convention names a `translate <file>` marker the phases point at

- **Choice:** The resident block defines one marker, and each phase that needs a translation writes two lines naming the file and the moment.
- **Why:** It keeps the mechanics — the pre-copy, the agent, the check, the stop-on-failure rule — stated once, so a command with three translation points still spends about thirteen lines in total.
- **Refuted alternative:** State the full mechanics at each phase, which reads better in place but multiplies the resident cost by the number of translation points and would breach the fifteen-line cap on the epic command.

## 2026-09-01 — Discovery drafts to session scratch and writes the translated file into the store

- **Choice:** `/nxs.discover` drafts the discovery doc and each ticket to session scratch, translates there, and writes the translated file into `.nexus/discovery/`.
- **Why:** The story requires the artifact be translated and verified *before* it is written out, and translating in the store would put an unverified write into a committed folder first.
- **Refuted alternative:** Write into the store and translate in place, which is fewer steps and matches how the other commands treat their own scratch — but the store is committed, so a failed check would leave a bad file where the commit step expects a good one.

## 2026-09-01 — Grounding sources are the epic and the record only, per the record's scope edit

- **Choice:** The distillation run names `epic.md` and the fetched decision-record body as grounding sources. The change diff is never named.
- **Why:** The decision record's Scope Edits section removes the diff from this story's scope, and invariant 13 states it as a constraint; the story's own acceptance criterion still listed the diff, and the record governs.
- **Refuted alternative:** Follow the story text and hand the diff over too — the richest source of what happened, but a contiguous span lifted from a diff is source code, which a concept page forbids outright.

## 2026-09-02 — Where the record body becomes a readable grounding path
- **Choice:** `/nxs.distill` Phase 0.1 writes the fetched record body to `<scratch>/<entry-slug>/record-body.md`, and every *why* branch (record sub-issue, committed `decision-record.md`, `close-record.md` alone) resolves to one named "*why* file" that Phase 4.6 hands the translator.
- **Why:** the grounding pointer named a path no phase ever wrote, so half the corpus was unreachable and abstractions fell through to density findings.
- **Refuted alternative:** re-fetch the record inside Phase 4.6 — a second network read of a body already hashed at Phase 0.1, and a second chance for the two copies to disagree.

## 2026-09-02 — Deleting the pre-translation copy in the convention, not per translate point
- **Choice:** the shared prose convention now ends `... run prose-verify, then delete <file>.pre`; the copy survives only a failed verify, for diagnosis. `/nxs.setup` additionally scaffolds a `*.pre` ignore rule.
- **Why:** two translate targets are tracked files (the feature `README.md`, concept pages staged by `git add .nexus/concepts`), so a surviving copy rides into a commit and the concept validator cannot see it — it filters on `.endsWith(".md")`.
- **Refuted alternative:** teach `validate-concepts.ts` to reject stray `.md.pre` — catches it late, only inside the concept store, and leaves the docs-tree README case uncovered.

## 2026-09-02 — Invariant 18 stated at the transcription step
- **Choice:** `/nxs.epic` Phase 6 step 3 states the story bodies are a verbatim transcription of the translated `${DRAFT_DIR}/epic.md`, with step 4 pass 3's ref rewrite named as the sole permitted post-translation edit.
- **Why:** invariant 18 covers the per-story bodies written after the gate, and nothing in Phase 6 had stopped a run re-drafting one.
- **Refuted alternative:** re-translate each story file after writing it — burns a translator run per story and reopens the gate's approved wording.

## 2026-09-02 — Rule 3 targets idioms, not technical notation
- **Choice:** rule 3 becomes "no idioms or invented shorthand". Standard technical notation — `≤ M`, `95%`, `O(n)`, the project's defined terms — is named as explicitly out of its reach and left as written; the idiom half is justified by the non-native reader rather than by verbosity.
- **Why:** the original rule expanded "≤ M" to "size M or smaller" in running prose, which throws words at an audience that reads the symbol faster; the reader this artifact set actually has is technical and often not a native English speaker, so the idiom is the hazard and the symbol is not.
- **Refuted alternative:** keep the rule as re-homed from the retired skill, on the epic's "does not revise them" assumption — faithful to the re-homing scope, but it ships a known over-correction into every artifact the translator touches, and the assumption exists to stop drift, not to freeze a rule the maintainer has judged wrong.

## 2026-09-02 — Structure is counted by shape, not by its text
- **Choice:** a heading keys on its level (`h2`), a list item on `list-item`, a table row on `table-row`; only the counts must not drop.
- **Why:** the translator legitimately rewrites the prose inside a bullet or a cell, and keying on text would fail every one of those rewrites; the words inside are still covered by the numeric, modal and name classes.
- **Refuted alternative:** key each on its normalised text, which would also catch a reworded heading — stricter, and true to "headings are the invoking command's contract", but it trips on every legal in-bullet rewrite, which is most of what the translator does.

## 2026-09-02 — A numeric's unit is the suffix written against the numeral
- **Choice:** the numeric key is the value plus an attached suffix (`95%`, `10ms`) or the word `percent`; a free-standing unit word that merely follows the numeral is not part of the key.
- **Why:** a following unit word is an ordinary lower-case word, which the story's form-based definition puts outside the tracked class, and binding it into the key fails an honest rewrite ("3 sentences" → "three of the sentences").
- **Refuted alternative:** take the next word as the unit, which would catch "40 words" becoming "40 sentences" — a real defect, but bought with a false failure on every rewrite that changes what follows a numeral.

## 2026-09-02 — "One" and "zero" are not tracked as numbers
- **Choice:** the spelled-out number map covers `two` upward; `one`, `a` and `zero` are left out.
- **Why:** English uses all three as determiner, article and pronoun as readily as counts ("one can go stale"), and a form-based reader cannot tell those apart — rule 5 actively asks the translator to replace the pronoun "one" with a noun, which would then read as a lost number.
- **Refuted alternative:** track them and accept the noise, which catches the rare deliberate "1" rewritten as "one" but fails honest rewrites far more often.

## 2026-09-02 — The proper-noun vocabulary is the union of both copies
- **Choice:** tier two admits a capitalised, non-sentence-initial, non-function word found in **either** copy, then counts every occurrence of it at every position in both.
- **Why:** the story derives the vocabulary from the pre-translation copy alone, which makes an *introduced* proper noun invisible to the tier and leaves the story's own grounding criterion unreachable for names; taking the union closes that without touching position-blindness, so a name moved to the start of a sentence still reports no change.
- **Refuted alternative:** the pre-translation copy alone, as written — literal to the story, but then no `--source` check can ever fire on a name, which is the case the grounding criterion exists for.

## 2026-09-02 — Machine-read regions are excluded from the preservation scan
- **Choice:** the tracked-item reader skips every line `extractRegions` claims.
- **Why:** those bytes are already compared by the region check, so scanning them would report one defect twice and bury the prose finding under frontmatter noise; each check covers its own territory.
- **Refuted alternative:** scan the whole file, which needs no exclusion logic — but a changed fenced block would then surface as a region change *and* a run of missing tokens naming lines the author cannot act on.

## 2026-09-02 — One verdict, one failure variant
- **Choice:** `VerifyResult`'s failure collapses to a single `changed` variant carrying both the region problems and the preservation findings; the old `region-changed` discriminant is gone.
- **Why:** the story requires one invocation to return one verdict covering both comparisons, and two failure variants would let a caller branch on one and ignore the other.
- **Refuted alternative:** keep `region-changed` and add a sibling `not-preserved`, which is a smaller diff — but it reintroduces exactly the "satisfy one property, skip the other" shape the story forbids.

## 2026-09-02 — Zero and one are excluded by denotation, not by spelling
- **Choice:** the numeric reader drops any value whose denotation is 0 or 1 whatever its written form and whatever suffix it carries, so `1`, `one`, `1%`, `0ms` and `1.0` are all untracked.
- **Why:** dropping only the word forms left the exclusion asymmetric, and the asymmetry false-failed in both directions — `1` rewritten as "one" read as a lost value, and "one" written back as `1` read as an invented one, neither of which clears on a retry.
- **Refuted alternative:** exclude the bare numerals `1` and `0` only, leaving suffixed forms tracked — narrower, but "1%" and "one percent" then reproduce the same asymmetry one layer down.

## 2026-09-02 — The retry is stated in the convention block, not at each translate point
- **Choice:** the restore-and-retranslate step is one clause inside each command's shared prose-convention block ("on a failure, restore `<file>` from it and translate once more"), and no translate point repeats it.
- **Why:** record #421's invariant 11 caps the shared block and buys that cap by keeping every translation point free of mechanics; stating the retry per point would multiply it by the number of artifacts a command drafts.
- **Refuted alternative:** state the retry at each translate point, which reads better in place — but `/nxs.distill` carries two points and `/nxs.epic` two, so the mechanics would be written four times for one rule.
