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
