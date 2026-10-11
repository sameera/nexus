## 2026-10-10 — Distill ceiling recorded with headroom for the rest of epic #889
- **Choice:** recorded 66,000 authored bytes (measured 56,661 after this story), replacing 53,024.
- **Why:** D9 records the ceiling once for the epic, and #892 (report layout in the shared skill) and #894/#895 (the long-run skill distill loads) still add bytes the measurement counts.
- **Refuted alternative:** record the measured 56,661 exactly, as earlier recordings did, which would make each later story re-record it.

## 2026-10-10 — Finish line and gates as two bold-labelled sentences in each opening
- **Choice:** each stage opening carries `**Finish line:** …` then `**Gates:** …`, followed by one sentence that loads `nxs-run-discipline`; /nxs.close gets the finish-line sentence only.
- **Why:** a fixed label lets the spec find the finish line and check each named gate without pinning prose.
- **Refuted alternative:** free prose in the Role paragraph, which a spec can only check by fragile wording.

## 2026-10-10 — Shared skills counted by matching the distill body's skill names
- **Choice:** `SHARED_SKILLS` lists the skills distill loads on every run, and a spec fails if the base stage names a skill that is neither a contract nor listed there.
- **Why:** a later story that makes distill load another shared skill is forced to count it.
- **Refuted alternative:** list the shared skills by hand with no check, which lets an uncounted load slip through.

## 2026-10-10 — PM self-checks become one "Every Reply States" section
- **Choice:** the PM agent's self-check block is replaced by a short `# Every Reply States` section (confidence, what is unknown, the assumption challenged, concrete next steps); the other checks are dropped because the mode rules, templates and formats already require them, and the council's "next steps assigned" check becomes "with its owner" in its Next Steps format.
- **Why:** one section applies to both modes and every format without adding fields to each template.
- **Refuted alternative:** add Confidence, Unknowns and Next Steps fields to each council and standalone template, which grows every deliverable format.

## 2026-10-10 — Reasoning-request check bound to a verb or "think", not the word "reasoning"
- **Choice:** the G13 spec matches phrases such as "think carefully", "step by step" after think/reason/work, "show your work", "chain of thought", and explain/walk through/understand + your/its/their reasoning.
- **Why:** many components legitimately carry recorded reasoning ("the decision plus its reasoning"), so a bare "reasoning" match would fail on them.
- **Refuted alternative:** forbid the word "reasoning" anywhere in components, which would force rewording record and discovery stages that copy reasoning, not reproduce it.

## 2026-10-10 — Refusals and declined gates keep their form; only reports after a write are reshaped
- **Choice:** the run-discipline skill defines a completion report as what a stage prints when its run ends after it has written something; a stop that wrote nothing (a refusal, a resolver diagnostic, a declined gate) stays a §1 stop that names what it needs. The unattended distill stop report, which may have cut and unwound a branch, is reshaped.
- **Why:** a refusal has nothing to put under Changed or Found, and forcing three headings onto a one-line diagnostic adds noise without moving the dependency first.
- **Refuted alternative:** reshape every stop, refusals included, into the three headings.

## 2026-10-10 — Analyze's open items listed by ID under Blocked on me, full lines kept under Found
- **Choice:** the analyze summary gets `### Blocked on me` (one `DV<n>`/`F<n>` line per open critical or high item, or a one-line "Nothing. Next: …"), `### Changed` (a new `Published:` line plus the existing `Recorded:` line) and `### Found` (every existing result line, the Severity line last); the result line still follows Found as the report's last line. Locally, with no IDs, a blocking item is named by what it departs from or is about.
- **Why:** D4 asks for the ID twice — once where the lead looks first, once in full — and every existing labelled line keeps its label, so specs and readers that key on them still hold.
- **Refuted alternative:** move the whole Departures and Findings lines under Blocked on me, which would split medium and low findings from the rest and break the one-place listing of results.

## 2026-10-10 — Report headings written as markdown headings or bold bullet labels, per stage
- **Choice:** templates in a code block use `##`/`###` headings (analyze, distill, fix, intake, setup); bullet-list reports use `- **Blocked on me:**` labels (discover, epic, decision-record). The spec accepts either form and checks order only.
- **Why:** each stage keeps the report form it already had, so the change is a regrouping, not a rewrite.
- **Refuted alternative:** convert every bullet-list report into a code-block template, which would rewrite three stages' report prose for no gain to the lead.

## 2026-10-10 — Unconfirmed results carry `looked` and `confirmBy` in the judgments block
- **Choice:** a result whose verdict is `unconfirmed` must carry two text fields, `looked` (where analyze looked, by file or by surface) and `confirmBy` (what would confirm it); the parser refuses an unconfirmed result without them and drops neither when a too-large verdict sheds its file lists.
- **Why:** a `--resolve` run rebuilds the review only from the machine record, so G17's "where it looked" and D6's "what would confirm it" would vanish from the next review if they lived only in prose, and a surface is not a file path the `files` list can hold.
- **Refuted alternative:** add only the `unconfirmed` verdict and treat the result's `files` list as where it looked, which loses a non-file surface and what would confirm it on carry-forward, and loses everything when the file lists are dropped for size.

## 2026-10-10 — A criterion's old `unverifiable` stays accepted, also in new drafts
- **Choice:** the criterion verdict list keeps `unverifiable` beside the new `unconfirmed`, for both the judgments-block parser and the draft parser; the stage text tells the model to write `unconfirmed` and to report an old `unverifiable` as unconfirmed.
- **Why:** both parsers share one result reader, and splitting old-read from new-write would add a second verdict table for no gain to the lead.
- **Refuted alternative:** refuse `unverifiable` in a new draft while still reading it from a published verdict.

## 2026-10-10 — Run folders live under one `.nexus/tmp/runs/` namespace, named `<stage>-<subject>`
- **Choice:** analyze uses `.nexus/tmp/runs/analyze-pr-<N>/` (`analyze-<repo>-pr-<N>/` for a qualified ref) or `.nexus/tmp/runs/analyze-epic-<n>/`; distill uses `.nexus/tmp/runs/distill-<subject>/`, with `<subject>` the named entry's directory, `recover-<n>`, or `queue`.
- **Why:** one namespace one level below `.nexus/tmp/`, like `planning/`, keeps every run folder off distill's entry scan, and the stage prefix keeps the leaf name from ever matching an entry shape.
- **Refuted alternative:** a namespace per stage (`.nexus/tmp/analyze/<subject>/`, `.nexus/tmp/distill/<subject>/`), which adds two top-level names under `.nexus/tmp/` for no gain.

## 2026-10-10 — Working files are renamed from `<scratch>/` to `<run>/` in analyze and distill
- **Choice:** every `<scratch>/…` path in the two stages becomes `<run>/…`, and distill's unnamed "scratchpad" for deltas becomes `<run>/<entry-slug>/deltas.md`.
- **Why:** `<scratch>` was never defined, so a path the stage cannot derive again would be lost in the same summary the checklist must survive.
- **Refuted alternative:** keep `<scratch>` and add one line defining it as the run folder, which leaves a second name for the same folder.

## 2026-10-10 — Analyze opens its run folder past both block states, in Phase 0.5
- **Choice:** the folder opens as Phase 0.5's new step 5, after the block states and before the record body is first written.
- **Why:** a blocked run must emit nothing at all, and the record body is the first working file analyze writes.
- **Refuted alternative:** open it at the end of Phase 0 when the stories are first known, which leaves a folder behind on every blocked or non-epic run.

## 2026-10-10 — The run folder is removed before the completion report is printed
- **Choice:** a finished run removes its folder after its last read and before printing the report.
- **Why:** analyze's fixed result line must stay the last line the run prints, and a removal after the report would follow it.
- **Refuted alternative:** remove the folder after the report, which puts a tool call after the result line the implement script reads.

## 2026-10-10 — Codex runs the readers in sequence through the runtime preamble
- **Choice:** State G38 as one binding in the Codex runtime preamble (`codex-components.ts`), which tells Codex to read each item itself in turn and say so under Found.
- **Why:** No component names Codex; the preamble is where every other Codex-only rule lives, and it costs distill's load ceiling nothing.
- **Refuted alternative:** An "Under Codex" sentence in the `nxs-long-run` skill, which Claude would also load and the ceiling would count.

## 2026-10-10 — A distill reader's checked result is saved but ticks nothing
- **Choice:** Save it to `<run>/<entry-slug>/reading.md`; the entry's line is still ticked only when its commit is on the distill branch, so the skill says a line may be ticked only after the save, "where the stage says".
- **Why:** The record ticks a distill entry at its commit, and a ticked line skips the item after a summary, so ticking at the reading would skip the entry's deltas and commit.
- **Refuted alternative:** Tick at the saved reading, as analyze does at its story file.
