---
title: "Return Verification"
aliases: ["suite gate", "fence probe", "breached fence", "unchecked fence", "returning from a pause", "unintegrated handoff", "probe control"]
touches: ["teaching-session", "teaching-plan", "workbook-handoff", "plan-field-ownership"]
last_updated_by: "#691"
status: deprecated
verification: verified
---

# Return Verification

Return Verification is a teaching-stage concept, and the teaching stage is no longer part of Nexus. The page that asserts it lives in the teaching repository; this entry is the forwarding address, kept so the name still answers and so the edges that reach it from here stay live.

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

- [teaching-session](teaching-session.md) — the chain that runs these checks on a return, before anything else is taught.
- [teaching-plan](teaching-plan.md) — where the suite, grading and control commands are declared, and where a slice's pinning test text lives.
- [workbook-handoff](workbook-handoff.md) — the pause these checks resolve, marked as verified only after a green suite and an intact fence.
- [plan-field-ownership](plan-field-ownership.md) — who writes the two tests these probes run, and why they exist before the handoff prompt does.

## Decision Log

### 2026-09-07 — #407 — A third fence state, proven by a declared control test

A pass-or-fail probe made a pinning test that cannot compile, or cannot run on its own, indistinguishable from an intact fence, and the session taught on. So the fence has three states and an unchecked one blocks with its own report, and the workbook declares a control test known to pass to tell the two apart. The decided fallback is that declared control rather than detecting the stack, because a control test fails in exactly the case the risk is about. A pause naming a story the plan holds no slice for gained its own blocking outcome: the plan is where a pinning test lives, so such a pause has nothing to probe, and the earlier path ran no probe, left the fence unset, and marked the pause verified when nothing had verified it. Refuted alternative: read the run's exit status or output to guess whether the test actually executed. No status or message is portable across test runners, so the guess would be wrong in exactly the stacks the risk names, and being wrong there is invisible.

### 2026-09-13 — #458 — Both probed tests are written before the handoff, and the fence steps over a scaffold

These checks probe two tests, and until now nothing guaranteed either existed: an approved plan holds no pinning test for a slice the learner has not reached. A handoff arrival now writes both before the prompt — the handed-off slice's, which the first probe runs, and the next slice's, which the second fences — so a pause can always be verified. A scaffold builds nothing and has no test, so the fence skips it and probes the next slice that builds a story. **Known deviation, filed as #604:** when that next slice carries no pinning test the probe is not run and the return is nonetheless reported as verified, with a note that the fence is intact — which is exactly what invariant 3 forbids. The gated flow cannot reach it, because a handoff arrival writes both tests first; it is reachable only from a hand-written plan whose later slice carries no test. The page keeps asserting the rule, because the rule is the contract and this is a defect against it. This entry also records the reciprocal link from plan-field-ownership.


### 2026-09-19 — #691 — Retired: the concept moved with the teaching stage

The teaching stage now ships as a package of its own, and this page went with it — body,
invariants and decision log intact, so there is one place the concept can be wrong rather than
two copies drifting. What is left here is a forwarding address. Archiving it instead was
refuted: an archived page is out of the store, and every page here that names this one would
have been left holding a dead edge, which the store refuses and which would have read as the
interaction having lapsed rather than moved.
