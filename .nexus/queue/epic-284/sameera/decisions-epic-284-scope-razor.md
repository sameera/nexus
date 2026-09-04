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

## 2026-09-03 — the checkpoint reuses the strip assertion rather than adding a marker check

- **Choice:** story #424's final criterion — no observation marker and no placeholder in the filed body — is satisfied by the existing `--assert-clean` run over the derived body, plus the rule that an observation is never written into the draft at all.
- **Why:** an observation that lives only in the render has no marker to leak, so the remaining risk is a surviving template token, which the assertion already covers.
- **Refuted alternative:** teach the checker a placeholder-token rule of its own (`{{...}}`). It would catch a template token the strip pass does not model, but it is a second assertion over the same body for a case the slot removal already eliminates.

## 2026-09-04 — the assertion learns the other two token classes (supersedes the 2026-09-03 stub above)

- **Choice:** `--assert-clean` now fails on a surviving template placeholder (`{{…}}`) and observation marker (`⚠️ razor:`) as well as a provenance label; the label is still stripped, the other two are only reported.
- **Why:** the earlier stub reasoned that the strip assertion already covered a surviving template token, and it does not — the label grammar matches labels only, so a `{{RATIONALE}}` filed clean and invariant 2's "mechanical assertion that none survives" was never true of two of the three classes it names.
- **Refuted alternative:** leave the checker alone and rely on the slot removal plus "replace every placeholder" in the template's filling rules. It is what shipped, and it is the remembered-not-checked failure the derived-body assertion exists to end.

## 2026-09-04 — the observation marker is a named sentinel, not the warning symbol

- **Choice:** every advisory render prefixes its observation with the literal `⚠️ razor:`, stated in nxs-razor §4, and that string is what the assertion looks for.
- **Why:** a filed epic body legitimately carries a warning callout of its own — the utilization-risk banner — so banning the bare symbol would ban the body's own content, and there would be nothing left to assert on.
- **Refuted alternative:** assert on the bare `⚠️`. One less convention to hold, but it makes the risk banner unfileable, and the banner is content the record's own re-derivation rule requires.

## 2026-09-04 — an unlabelled item blocks

- **Choice:** `checkDraft` gains a `provenance-label` rule: an acceptance criterion, assumption or out-of-scope item carrying neither label is a blocking finding.
- **Why:** the first success metric claims every item is traceable or marked with no third state, and an unlabelled item was exactly that third state — invisible, because every other razor check reads a label that is there.
- **Refuted alternative:** leave it to the gate agent's reading. It is judgment where none is needed: a label is present or it is not, which is the presence test invariant 5 explicitly permits in the deterministic checker.

## 2026-09-04 — the counted limits are pinned by a conformance test, not read from the skill at run time

- **Choice:** `AC_CEILING` and `SECTION_LIMIT` stay constants in the checker; an authoring test parses §5's table and asserts the two agree.
- **Why:** the skill claimed the checker read its numbers and nothing else, which was never true; the defect in two copies is silent divergence, and a test that fails the build removes the silence without making the checker depend on locating an installed markdown file.
- **Refuted alternative:** have `razor-check` parse the skill at run time, as the frontmatter claimed. It makes one copy genuinely, but the skill's location differs between a vendored payload, a pointer install and a bare checkout — so the checker gains a way to fail to run at all, for a guarantee the test already gives.

## 2026-09-04 — Phase 6 names the derived body in every command, and the epic number is recorded on the labelled draft

- **Choice:** each concrete command in the epic's Phase 6 names `epic.filing.md`, and after `create-epic` writes `link:` into that derived file the run copies the line back into `epic.md`.
- **Why:** a blanket "every step below files from the derived file" did not survive a dozen literal commands that still said `epic.md`, and the derived file is rebuilt each run — so a number recorded only there is lost on a re-run and the next run files a second epic issue.
- **Refuted alternative:** file from the labelled `epic.md` and strip at the filer. It keeps one file and one place the number lives, but it moves the strip inside a tool that four other callers share, and the assertion would then run over a body no step names.

## 2026-09-04 — the record's derive step becomes Phase 3.6

- **Choice:** "derive the filing body" leaves Phase 3 as step 5b and becomes Phase 3.6, after the Phase 3.5 checkpoint.
- **Why:** the step ran after 3.5 while being numbered inside 3, so the document's own ordering contradicted its execution order; the body has to be derived from the draft the reviewer approved, cuts included.
- **Refuted alternative:** keep it as step 5b and state the loop in prose, as it was. Coherent to a careful reader, but every reference to it had to re-explain the ordering, and a filing step that runs after a gate is a phase.

## 2026-09-04 — a discovery's resolutions are exempt from the provenance rule

- **Choice:** `/nxs.discover` labels the discovery document's open and out-of-scope entries and each ticket's question, and never a resolution.
- **Why:** a resolution is a decision reached in session, so it is inferred by construction — labelling it would print one uniform value on every resolution and tell a reviewer nothing.
- **Refuted alternative:** label resolutions too, for uniformity across the three drafting stages. It keeps one rule with no exception, but it is the decoration the razor's own two-valued rule exists to avoid, and it is the same argument that keeps a refuted alternative unlabelled.

## 2026-09-04 — the story work-items are asserted individually, not the folder

- **Choice:** Phase 6 step 3 ends with a shell loop running `nexus razor-check --draft "$item" --assert-clean` over each `STORY-*.md` work-item, before step 4's `create-story` files any of them.
- **Why:** invariant 2 gates filing on a mechanical assertion over the body that is filed, and the story bodies are hand transcriptions of the asserted `epic.filing.md` — for a six-story epic that left six of the seven filed bodies clean by copying rather than by check.
- **Refuted alternative:** teach `razor-check` a folder mode that asserts every file under a directory in one invocation. One call instead of N and a single exit code, but it adds a second input shape to the one verb four stages share, for a loop the caller can already write.
