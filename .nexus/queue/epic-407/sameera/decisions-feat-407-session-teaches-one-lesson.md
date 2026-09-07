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
