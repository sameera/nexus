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
