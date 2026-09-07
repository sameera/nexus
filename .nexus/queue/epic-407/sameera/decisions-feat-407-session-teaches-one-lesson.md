## 2026-09-07 — Drift check takes an injected issue reader rather than calling `gh` itself

- **Choice:** `checkPlanDrift`/`gateNextLesson` in `teaching-plan.ts` take a `read: IssueReader` function and stay pure; nothing in the module fetches from GitHub.
- **Why:** Every checkable fact in this epic is decided in code and must be assertable in a test (decision record #469, "the session is a gated chain with exactly one generative step"). A pure comparison over injected state is deterministic and unit-testable; a function that shelled out to `gh` internally would need network/process mocking for every test and couldn't be asserted as "the same input always gives the same verdict" (invariant 22).
- **Refuted alternative:** Have the drift check call `gh issue view` directly and cache the result. Simpler call site, but couples the pure comparison logic to process execution, makes the unreadable-vs-unchanged distinction (invariant 9) harder to test deterministically, and duplicates a live-issue-reading concern that the session's CLI wiring should own once, not per-check.

## 2026-09-07 — The widget seam gains an optional `lead` field on `WidgetComponent` rather than a second fenced-block kind

- **Choice:** `WidgetComponent` gained one new optional field, `lead`, rendered into an always-visible `<div class="widget-lead">` ahead of the existing reveal control. `predict-then-reveal` is the first (and so far only) component that supplies it.
- **Why:** Decision record #469 calls for "a region that is always visible and always printed" because the existing seam can only hide content or label a button, and a `<button>` itself is excluded from print. Adding one optional field to the existing component contract is the smallest change that satisfies this — every existing component (and the seam's fenced-block declaration syntax) is untouched, since `lead` defaults to absent.
- **Refuted alternative:** A second widget kind (e.g. a `question-answer` fence distinct from `widget`) carrying its own always-visible slot. That would keep `WidgetComponent` unchanged, but it forks the declaration syntax and the render path for what is really one seam property (an always-visible region), and every future component that wants a lead region would face the same fork.

## 2026-09-07 — Advancing past a written lesson is keyed on its own pinning test passing, not on a completion record

- **Choice:** `resolveArrival` in `lesson-writer.ts` treats a written lesson as finished, and moves on to the next slice, exactly when `pinningTestPassed` is true for it — a fact handed in by the caller, not read from any learner record.
- **Why:** Decision record #469 states this directly under "the suite gate applies to every session about to write a lesson": "a session that writes the next lesson is a session in which the current exercise is finished." Grading and what a learning record holds are explicitly out of scope for this epic (#407's own Out of Scope section), so "finished" cannot be read from a graded outcome; the pinning test is the one fact both this story and the fence probe (#465) already need to name, and reusing it here avoids inventing a second, competing notion of "done" that #408's grading epic would also have to reconcile with.
- **Refuted alternative:** Read a completion signal from a learning record kind written elsewhere. Rejected because #407 is documented as a non-writer of learning records and must "read what the workbook has recorded about the learner and never write it" — depending on a record another epic writes for something as central as arrival would make this epic's own tests unable to run without that epic's shape being decided first.

## 2026-09-07 — A handoff prompt's "sibling slices to leave alone" is every other slice in the plan

- **Choice:** `siblingSlices(plan, story)` returns every slice in the plan other than the one being handed off, not some narrower notion (e.g. only slices that share a file or a dependency edge with it).
- **Why:** Neither the epic body nor the decision record defines "sibling" more precisely than "the sibling slices it must not touch" (story #464's own body). Since a wrong narrower guess could under-name a slice the coding agent then touches — silently breaching the fence #465 checks for — the safe default is the whole plan minus the one slice actually handed off.
- **Refuted alternative:** Only slices adjacent in `blocked_by` order. Reads more like what "sibling" suggests in prose, but the decision record's #467 risk note ("slices in one epic routinely share files") means an epic's slices are not graph-isolated from each other regardless of adjacency, so a narrower set would under-warn.

## 2026-09-07 — The fence probe reuses `@nexus/close-migration`'s `Runner` seam rather than a new process-execution type

- **Choice:** `runSuite` and `runProbe` in `fence-probe.ts` take a `Runner = (cmd, args, opts) => RunResult` exactly as `learner-store.ts` and `handoffs.ts` already do for git, rather than defining a second execution seam local to this module.
- **Why:** The codebase already has one process-execution seam built for this purpose — args passed as a vector, never a shell string, and swappable in a spec — and invariant 14 (argument vector, never a shell string) is exactly the property `Runner`'s signature already enforces by construction. A second, parallel type would duplicate that guarantee and could drift from it.
- **Refuted alternative:** Use Node's `child_process.execFileSync` directly in this module, as some existing spec helpers do. Rejected because it is not injectable — every fence-probe test would have to spawn a real process, when the interesting behaviour under test (suite-then-probe ordering, red-suite-never-a-breach) is a pure function of two pass/fail facts and does not need one.

## 2026-09-07 — The teaching plan grows inside `plan.yml`, and a handoff slice names no lesson

- **Choice:** `plan.yml` gained a `slices:` list (story, lesson file, learner-or-handoff mark, pinned title/body, concepts, branch, verbatim pinning test) plus workbook-level `suite:` and `grading:` command vectors, read by a new `workbook-plan.ts`. A handoff slice declares no `lesson`, so it never enters the workbook's reading order. `readLessons` keeps serving the older `lessons:` list unchanged.
- **Why:** Decision record #469 states the plan is one file and that two committed documents describing one plan can disagree with nothing in a position to notice. Reusing the file the renderer already orders by means the pinned state cannot be separated from the order. A handoff slice is neither built nor taught by the learner, so a lesson file for it would be a stub that never becomes a page — the navigation would advertise a lesson that will never exist.
- **Refuted alternative:** A separate `teaching-plan.yml` beside `plan.yml`. Cleaner separation between "what the renderer orders" and "what the session teaches", and it would leave epic #405's contract untouched — but it is exactly the two-documents-one-plan failure the record refuses.

## 2026-09-07 — "Finished" is the pinning test present in the tree, and the suite gate is separate

- **Choice:** `isFinished` in `teaching-session.ts` treats a written slice as finished when the file named by its `pinning_test.file` exists in the learner's tree, and nothing else. The suite result is not part of it; the suite has its own gate on writing a lesson, and the handoff branch sits ahead of that gate because a handoff writes no lesson.
- **Why:** Position is then derived from committed lessons plus files in the tree, so it is the same on every run (invariant 22), and a red suite reports itself as the blocker instead of the session claiming a finished exercise is unfinished. The guarantee is unchanged: writing the next lesson still needs a green suite, so a session that writes one is still a session in which the current exercise is finished. Grading is another epic's, so "done" cannot be read from a graded outcome.
- **Refuted alternative:** Fold the suite result into finished-ness (the first cut here). It made every written slice read as unfinished on a red suite, so a learner who had finished their exercise was told the exercise was not done, and a handoff slice that might have been what fixed the suite could never be reached — the workbook deadlocked on a suite the learner was not the one to fix.

## 2026-09-07 — The generative step is two calls, not an in-process callback

- **Choice:** `runTeachingSession` returns a `brief` outcome when it is clear to write and no prose was supplied, and writes the lesson on a second call carrying `prose`. The CLI surfaces this as `nexus workbook teach <slug>` then `… --prose <file>`.
- **Why:** Every gate before the write must produce the same verdict on both calls, which is invariant 22 exercised for free — the second call re-runs the whole chain rather than trusting state carried across it. It also keeps the toolkit free of any notion of an agent: the prose arrives as a file, so the chain is testable with no model in the loop.
- **Refuted alternative:** Take an `authorTheory(brief) => string` callback and write the lesson in one call. Fewer steps for the caller, but it puts the generative step inside the chain, so a test either injects a fake author (proving nothing about the real path) or the toolkit gains a dependency on how prose is produced.

## 2026-09-07 — The return runs two probes: the handed-off slice's own test, then the fence

- **Choice:** On resuming from a pause the session first probes the *handed-off* slice's pinning test — failing means its work is not in this tree, reported as unintegrated — and only then probes the *next learner* slice's test for the breach.
- **Why:** Record #469 requires both behaviours: "when the handed-off work is not present in the tree, the session reports that and pauses", and the fence breach is "the exercise is already done". They are different questions about different slices, and one probe cannot answer both.
- **Refuted alternative:** Infer integration from git — whether the handoff branch is merged. Rejected because the session moves and reads no git state by decision, and a branch can be merged without the work being present (or present without the branch, having been rebased or squashed elsewhere).

## 2026-09-07 — The probe names the materialized test to the grading command, which is the command's contract

- **Choice:** `runProbe` appends the materialized file's repo-relative path (`.nexus/tmp/workbook-probe/<file>`) to the declared `grading` vector, so the exit status it reads is a verdict over that one file. The workbook's grading command is therefore contracted to take the path of a single test file as its final argument.
- **Why:** Without the path the command chose its own targets, so on a return — where the suite is green by the time the probe runs — it passed for reasons having nothing to do with the pinning test. Every return then read as a breach, and #465's "every test passes on the return → write the next lesson" was unreachable. The final-argument shape is what `vitest <file>`, `pytest <file>` and `jest <file>` already accept, so the contract costs adopters nothing.
- **Refuted alternative:** Pass the path in an environment variable and let each repository's grading command pick it up. More flexible for a runner that cannot take a path, but it is invisible: a command that ignores the variable still exits zero and the fence silently reverts to the wrong question.

## 2026-09-07 — Hints rank the drill, coldness only makes a concept eligible

- **Choice:** `chooseDrill` sorts eligible concepts by hints taken first, then by how overdue they are, then by name. Coldness (last mentioned before the lesson just finished) stays a filter, not a rank.
- **Why:** #462's second criterion states the rule for two eligible concepts: the one with more hints wins. Ranking by coldness first only honoured that in the narrow case where both were last mentioned in the same lesson, which is not the case the criterion describes. Record #469 backs the criterion — hints "rank a drill that is already eligible".
- **Refuted alternative:** Keep coldness first and amend #462 and the record to match the code. Defensible as a spacing policy, but it is a scope edit to an approved story made from the build, which is the plan approver's act and not the implementer's.

## 2026-09-07 — A hinted concept comes back as its own predict-then-reveal section, not through the drill

- **Choice:** `conceptsToRevisit` names the concepts from the lesson just finished that carry a hint, the brief carries them as `revisit`, and `composeLesson` refuses to write a lesson that names one and asks nothing about it. They render as a predict-then-reveal section after the theory, and the front matter records `revisits: [...]`.
- **Why:** #463's second criterion needs a mechanism and the drill can never be it: a concept from the lesson just finished is not a cold recall (invariant 21), so the drill excludes exactly the concepts this criterion is about. Making the brief carry them and the composer refuse without them keeps the fact in code, in the same shape the drill already uses, and puts it on the committed page where a teammate's checkout can read it without a hint log.
- **Refuted alternative:** Fold the hinted concepts into the next slice's `concepts` list and let the theory prose deal with them. Cheaper, but `concepts` means "introduced here" — it feeds the drill's history — so a revisited concept would read as freshly taught and would go cold one lesson late. It also leaves the criterion unenforced, since nothing checks that the prose mentions it.

## 2026-09-07 — A pause belongs to the workbook that recorded it, and a resolution says how it was reached

- **Choice:** The session reads only handoff records whose `workbook` field equals this slug, rather than also claiming records that name none. `resolveHandoff` takes `how` and appends `- resolution: verified | override`, defaulting to `override`; the session passes `verified` after a green suite and an intact fence, and `nexus workbook resolve` passes `override` and says so.
- **Why:** "At most one handoff is outstanding" is per-workbook (invariant 18), so a record naming no workbook belonged to any of them and one workbook could resume at another's pause. Record #469 requires a manual override to record that it was an override; one `- resolved:` line for both made a checked resolution indistinguishable from an asserted one.
- **Refuted alternative:** Keep the empty-workbook fallback for records written by epic #405's `nexus workbook handoff` before the field was carried. Kinder to an old record, but the fallback is what breaks the invariant, and that path has always written the slug.

## 2026-09-07 — The revisited concepts' prose travels in the prose file's front matter, as a `revisit` list

- **Choice:** `readProse` in `workbook-cli.ts` reads a `revisit:` list of `{concept, question, answer}` entries from the prose file's front matter, beside the drill's `question`/`answer`, and hands them to `composeLesson` as `AuthoredProse.revisit`. An entry missing any of the three is dropped rather than half-carried.
- **Why:** Without it #463's second criterion had no path through the shipped surface: `conceptsToRevisit`, the brief's `revisit` and `composeLesson`'s refusal were all implemented, but the only way prose reaches the composer is this file, and it parsed nothing but the drill — so any brief naming a concept to revisit made `nexus workbook teach <slug> --prose <file>` throw instead of writing the lesson. Dropping a half-written entry keeps the composer's refusal (which names the concept) as the one error the author sees, rather than a lesson that asks a question with nothing behind it.
- **Refuted alternative:** A second `--revisit <file>` flag carrying those questions. It keeps the front matter minimal, but it splits one agent's single contribution across two files that can disagree about which concepts were answered, and the brief already names the concepts in one place.

## 2026-09-07 — A probe that cannot run is reported as an unchecked fence, and a declared control test tells the two apart

- **Choice:** `runProbe`'s false no longer flows into `interpretReturn` as a boolean. The plan may declare an optional `probe_control` (a `{file, text}` test written to pass in this repository's stack); `proveProbe` runs it and answers `proven | unrunnable | unproven`, `interpretReturn` takes a `FenceState` of `breached | intact | unchecked`, and an unchecked fence blocks the lesson with its own outcome and report. On a return, the handed-off slice's own probe passing is itself the proof that one test file can run alone, so the fence probe that follows it is trustworthy; when that probe fails, the control decides whether the diagnosis is "the branch is not in this tree" or "the probe cannot run here".
- **Why:** Record #469's fifth ADDRESS risk requires exactly this: "Reporting that the fence could not be checked is acceptable, and silently reporting an intact fence is not." A bare boolean made a pinning test that cannot compile or cannot run in isolation indistinguishable from an intact fence, and the session taught on. It also fixes the wrong diagnosis the unintegrated outcome gave for an unrunnable probe.
- **Refuted alternative:** Read the run's exit status or output to guess whether the test actually executed. No status or message is portable across test runners, so the guess would be wrong in exactly the stacks the risk is about, and being wrong there is invisible — which is the failure the record names.

## 2026-09-07 — Measured: the full suite on this repository is ~25 seconds, so the record's latency risk does not reopen it

- **Choice:** Accept the full-suite gate as built. `npx nx run-many -t test --skip-nx-cache` over all 14 projects runs 1063 tests in ~25 s wall (portable-tools alone: ~17 s, twice consecutively). No narrowing of the declared command, and no reopening of record #469.
- **Why:** The record's third ADDRESS risk accepts the wait as the price of the guarantee but requires it measured before the epic closes, and requires the record reopened rather than the command narrowed if the wait proves unacceptable. Tens of seconds once per sitting is not the "minutes between the learner and each sitting" the risk warns about, so the accepted price stands as accepted.
- **Refuted alternative:** Narrow the gate's command for large suites. Refused by the record itself — a check weaker than it appears is worse than a slow one — and, at 25 s, unnecessary.

## 2026-09-07 — Proven: one test file runs in isolation here, but only under a grading command whose root reaches the scratch path

- **Choice:** The probe is proven on this repository, with the stated fallback being the declared `probe_control`. Materializing a test at `.nexus/tmp/workbook-probe/tests/` and running `npx vitest run --root . --dir . <file>` exits 0 for a passing file and 1 for a failing one, in ~0.5 s — so the breach/intact discrimination is real here. Running the same file under `npx vitest run --root libs/portable-tools <file>` exits 1 with "No test files found", because that project's `include` is `src/**` and the scratch path is outside its root.
- **Why:** Record #469's fifth ADDRESS risk requires the probe proven against this repository's own suite first, and a decided fallback where it cannot run. The second command is precisely the failure mode the risk describes, and it is silent: without a control it reads as an intact fence. So the fallback is not a stack-detection heuristic but the declared control — it fails in exactly that case, and the session reports the fence unchecked.
- **Refuted alternative:** Make the probe write into each project's own `src/` so any project-scoped `include` reaches it. Rejected because it puts a generated test inside the learner's real source tree, which invariant 11 exists to prevent — a crashed probe would become a mystery failing test in a committed directory.

## 2026-09-07 — A clean drift check says so, rather than being silent

- **Choice:** `SessionResult` gained `notes`, and the session pushes an affirmative line when the gate found no drift across the whole plan (and one naming the verified fence on a return). `nexus workbook teach` prints them prefixed "checked:".
- **Why:** #460's third criterion is "the session reports no drift and continues". The session continued correctly but said nothing, so a learner could not tell a check that passed from a check that never ran — which is the whole value of the check to them.
- **Refuted alternative:** Fold the sentence into each outcome's own report. It reaches the same reader, but every outcome would have to restate it, and the drift the check *did* find is already reported separately — one list of what was checked keeps the two together.
