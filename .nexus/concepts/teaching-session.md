---
title: "Teaching Session"
aliases: ["workbook session", "session chain", "one sitting", "gated chain", "session brief", "one lesson per session", "walks the plan by position", "pinning test on arrival"]
touches: ["teaching-plan", "plan-drift-gate", "cold-drill", "just-in-time-lesson", "handoff-prompt", "return-verification", "workbook-handoff", "slice-identity", "reference-page"]
last_updated_by: "#481"
status: active
verification: verified
---

# Teaching Session

A learner opens a workbook by running a session, and one session teaches one lesson. The session is a fixed chain of checks decided in code: it clears the probe's scratch space, works out where the learner is, runs the suite, verifies any pause it is returning from, checks the next slice against the state the plan pinned, and chooses a drill. It then writes one lesson, or hands the slice to a coding agent and pauses.

## How It Works

Everything the session guarantees is a fact about a repository. A fact an agent asserts cannot be verified and cannot be repeated, so the order of the checks is fixed in code and every step produces a fact a test can assert. A second run over an unchanged repository reaches the same verdict and hands out the same brief.

Judgment enters as a lesson's prose and as the pinning tests an arrival writes. The chain stops at each, handing out a brief naming the slice, its concepts, the drill and any exercise. What comes back on a second run re-runs the whole chain rather than trusting a verdict carried across the two. The toolkit therefore needs no notion of an agent.

The session moves no version-control state. It writes files under the workbook and the learner folder, and it names the branch the learner works on. It creates, switches, merges, commits and pushes nothing, because the checks it runs on return must verify a tree it did not itself change.

## Key Invariants

1. The order of the checks is fixed in code, and every step produces a fact a test can assert.
2. A second run over an unchanged repository reaches the same verdict, picks the same drill and places the lesson in the same slice.
3. ~~Exactly one step produces prose; that prose is written outside the chain and handed back on a second run.~~
4. The second run re-runs every check rather than trusting a verdict carried from the first.
5. The session creates, switches, merges, commits and pushes nothing.
6. Every read of the learner folder is total: an absent record is an empty history, and a record that cannot be read is reported and skipped rather than failing the session.
7. A check that passed says so, so a learner can tell it from a check that never ran.

## Integration Points

- [teaching-plan](teaching-plan.md) — the plan the chain walks, and the only source of the commands it is allowed to run.
- [plan-drift-gate](plan-drift-gate.md) — the check that stops the chain when the story the next lesson teaches has moved.
- [cold-drill](cold-drill.md) — the concept the chain picks to ask about before it teaches anything new.
- [just-in-time-lesson](just-in-time-lesson.md) — the one lesson a session writes, and how the chain decides which slice the learner is up to.
- [handoff-prompt](handoff-prompt.md) — what the chain produces instead of a lesson when the next slice is not the learner's to build.
- [return-verification](return-verification.md) — the suite and fence checks the chain runs before it teaches again after a pause.
- [workbook-handoff](workbook-handoff.md) — the pause record the chain reads on arrival and resolves after a verified return.
- [slice-identity](slice-identity.md) — the name the chain asks each slice by when it decides whether that slice is behind the learner.
- [reference-page](reference-page.md) — the page a second drill earns, which the chain names in its brief and checks before writing anything.

## Decision Log

### 2026-09-07 — #407 — A gated chain with one generative step, taken in two runs

The session's guarantees are facts about a repository, and an agent asserting such a fact gives something neither verifiable nor repeatable, so the order of the checks lives in code and each step yields an assertable fact. The generative step is split out rather than called from inside the chain: the chain returns a brief, and a second run carrying the prose re-runs every check instead of trusting state carried across the two. That keeps the toolkit free of any notion of an agent, and it exercises the determinism requirement for free. Refuted alternative: take the prose author as a function the chain calls, and write the lesson in one run. It is fewer steps for the caller, but it puts the generative step inside the chain, so a test either injects a fake author and proves nothing about the real path, or the toolkit gains a dependency on how prose is produced.

### 2026-09-13 — #458 — The chain walks the plan by position, remembers a slice by its lesson, and gained a second generative step

The chain keyed every slice by its story, which worked only while the plan held one whole story per slice. It now walks the plan in order and asks each slice, by that slice's own identity, whether it is behind the learner: a learner slice once its lesson is written and its exercise finished, a scaffold once its lesson is written, a handoff once its handoff is resolved. A scaffold is taught rather than refused for naming no story. The rule that exactly one step produces prose is retired: a slice's pinning test is now written when the learner arrives at the slice, so a learner arrival writes the test with the lesson and a handoff arrival writes two tests — the handed-off slice's, which the return probe runs, and the next story slice's, which it fences — before the prompt. Both are recorded in the plan once and never rewritten, which is why the session now writes the committed plan as well as the lessons. The surviving half of the retired invariant, that this text comes from outside the chain and is handed back on a second run, is stated above. This entry also records the reciprocal link from slice-identity.

### 2026-09-18 — #481 — Reciprocal link from reference-page

Mechanical reciprocity fan-out: when the drill the chain picks was already drilled by an earlier lesson, the brief and the report now name that concept as having earned a reference page, and every run names the pages still owed. Prose for the page is optional, so a sitting still writes one lesson whether or not it comes back. Prose that would fail the render stops the sitting before anything is written, which keeps the chain's rule that a sitting leaves the tree consistent.
