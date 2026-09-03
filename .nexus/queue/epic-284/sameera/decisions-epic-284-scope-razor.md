## 2026-09-03 — `razor-check` ships with story #285, not #287

- **Choice:** the `razor-check` verb and the `@nexus/scope-razor` library are created here, carrying assertion mode only; #287 adds the counted limits and the citation comparison to the same operation.
- **Why:** #285's fourth criterion is enforced by the derived-body assertion, and the component-invocation gate refuses a shipped body naming a verb the executable does not declare — so the command wiring and the verb cannot land in different commits.
- **Refuted alternative:** wire the epic command to strip labels by instruction and defer every mechanical check to #287. It keeps the story boundary the record drew, but it makes the one criterion the record calls "checked rather than remembered" remembered again for a whole story.

## 2026-09-03 — the label grammar tolerates optional backticks

- **Choice:** `[inferred]` and `[asked: "…"]` match with or without surrounding backticks, and stripping collapses the whitespace it leaves behind.
- **Why:** a draft reads better with the label in code ticks and the checker must not make that a formatting rule the author has to get right.
- **Refuted alternative:** require the backticks, so the grammar is exact. It converts a rendering preference into a blocking condition, which is the escape-valve failure the citation rule already refuses.

## 2026-09-03 — the template restatements are HTML comments beside the heading

- **Choice:** each counted limit is restated as an HTML comment on the heading's own line in the epic template, naming the skill section it points at.
- **Why:** the template block is itself the thing a drafting model copies, so the restatement has to survive into the model's working copy without surviving into the epic it writes; a comment on the heading line does both.
- **Refuted alternative:** a prose line under each heading. It renders in the draft the model produces, so the pointer would leak into the filed body — the same leak the derived-body assertion exists to stop.

## 2026-09-03 — the checker parses headings, not a schema

- **Choice:** `checkDraft` finds stories and sections by markdown heading depth and counts list items, tolerating an HTML comment after a heading.
- **Why:** the draft it reads is the same markdown that becomes the issue body, and the template now carries the limit restatements as comments on the heading lines — a parser that choked on them would fail on every draft the template produces.
- **Refuted alternative:** require the drafting stage to emit a machine-readable sidecar the checker reads instead. It removes the parsing entirely, but it is the sidecar-key staleness the record already refuted for the labels, one layer along.

## 2026-09-03 — mechanism-naming stays in the gate agent's prompt

- **Choice:** the checker returns no advisory findings; the only advisory rule, mechanism-naming, is judged by the gate agent and reported as a low finding.
- **Why:** invariant 5 limits blocking findings to counts, presence tests and containment — a judgment implemented in the deterministic checker would either be a bad heuristic or a blocking rule in disguise.
- **Refuted alternative:** a keyword list of mechanism-shaped words in the checker, emitted as advisory. It is deterministic and cheap, but it would fire on every criterion naming a command or a gate, which the rule explicitly excludes.

## 2026-09-03 — cuts re-run the gate rather than trusting the reduced draft

- **Choice:** applying cuts ends by re-running Phase 4b on the cut draft before Phase 6.
- **Why:** a cut changes the counts the gate checked — deleting five of six acceptance criteria leaves a stated reason with nothing to excuse, and a story cut changes the sequence table — so the verdict the reviewer saw is about a document that no longer exists.
- **Refuted alternative:** trust the pre-cut gate result, since cutting only removes content and every counted limit is a ceiling. It holds for the limits, but not for the re-derived complexity, the re-parented edges or an orphaned stated reason.

## 2026-09-03 — the record's labelled draft is a second file, not an in-place edit

- **Choice:** Phase 3 writes `record-body.labelled.md` and derives `record-body.md` from it, rather than labelling `record-body.md` and stripping in place.
- **Why:** Phase 4 refuses to file if `record-body.md` was not written by this run's Phase 3, and the assertion has to run over the file that is actually filed; two files make both true without changing the filing contract.
- **Refuted alternative:** label in place and strip before filing. One fewer artifact, but a run that stops between the two leaves a labelled body at the exact path Phase 4 files from.
