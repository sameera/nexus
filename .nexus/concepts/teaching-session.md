---
title: "Teaching Session"
aliases: ["workbook session", "session chain", "one sitting", "gated chain", "session brief", "one lesson per session", "walks the plan by position", "pinning test on arrival"]
touches: ["teaching-plan", "plan-drift-gate", "cold-drill", "just-in-time-lesson", "handoff-prompt", "return-verification", "workbook-handoff", "slice-identity", "reference-page"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Teaching Session

Teaching Session is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

## How It Works

Nothing here asserts the concept any more. The teaching stage left Nexus as its own package,
and its knowledge left with it — one page, one decision log, one place it can be wrong. What
stayed is this stub, because two things still need the name. A reader who greps an old slug
gets an answer instead of silence. And the pages here that name this one keep a live edge: an
edge whose other end is gone is a dead edge, which reads as though the interaction lapsed when
in fact it only moved.

The bullets below are the interactions as they stood when the page left. They are a map to
follow, not a claim about today; the page in the teaching repository is what is current.

## Key Invariants

1. This entry asserts nothing about behaviour; the page in the teaching repository is the one that does.
2. The name keeps resolving here, so a reader who searches the old slug is told where it went.
3. Edges from pages that stayed keep resolving, so no page here carries an edge whose other end is gone.

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


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
