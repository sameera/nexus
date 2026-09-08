---
title: "Return Verification"
aliases: ["suite gate", "fence probe", "breached fence", "unchecked fence", "returning from a pause", "unintegrated handoff", "probe control"]
touches: ["teaching-session", "teaching-plan", "workbook-handoff"]
last_updated_by: "#407"
status: active
verification: verified
---

# Return Verification

A learner returning from a pause comes back to a repository somebody else has been writing in, so the session verifies it before teaching again. The full declared suite runs first, and no lesson is written while it is red. Once the suite is green, the pinning test the next exercise names is run: a test that already passes means the handed-off work reached into the learner's slice.

## How It Works

The suite is always the full declared one, never a narrowed subset. Its result gates everything after it, and a probe result taken while the suite is red is never a breach: the absence of a failing probe there says nothing about whether the fence held.

Two probes run on a return, answering different questions. The handed-off slice's own test runs first, and a failure means that work is not in this tree. Only then does the next slice's test run, for the breach.

The probe writes the test's own text at one scratch location, swept at the start of every session and removed after each run, so a crashed probe never leaves a mystery failing test in the learner's source tree. It names that location to the grading command, so the verdict is about that test and nothing else.

A single test file cannot run alone in every stack, so a workbook may declare a control test known to pass. When that control fails the fence is reported as unchecked. Reporting that the fence could not be checked is acceptable; reporting an intact fence nobody verified is not.

## Key Invariants

1. No lesson is written while the declared suite is red, and the suite that runs is always the full one.
2. The suite runs before the fence probe, and a probe result taken on a red suite is never a breach.
3. A fence that could not be checked blocks the lesson and is reported as unchecked, never as intact.
4. A pinning test that passes before the learner wrote it is a breach, and the report names the slice reached into.
5. The probe leaves the tree as it found it, using one scratch location removed after each run and swept at the start of every session.
6. A pause naming a story the plan holds no slice for has nothing to probe, so it blocks and stays open.

## Integration Points

- [teaching-session](teaching-session.md) — the chain that runs these checks on a return, before anything else is taught.
- [teaching-plan](teaching-plan.md) — where the suite, grading and control commands are declared, and where a slice's pinning test text lives.
- [workbook-handoff](workbook-handoff.md) — the pause these checks resolve, marked as verified only after a green suite and an intact fence.

## Decision Log

### 2026-09-07 — #407 — A third fence state, proven by a declared control test

A pass-or-fail probe made a pinning test that cannot compile, or cannot run on its own, indistinguishable from an intact fence, and the session taught on. So the fence has three states and an unchecked one blocks with its own report, and the workbook declares a control test known to pass to tell the two apart. The decided fallback is that declared control rather than detecting the stack, because a control test fails in exactly the case the risk is about. A pause naming a story the plan holds no slice for gained its own blocking outcome: the plan is where a pinning test lives, so such a pause has nothing to probe, and the earlier path ran no probe, left the fence unset, and marked the pause verified when nothing had verified it. Refuted alternative: read the run's exit status or output to guess whether the test actually executed. No status or message is portable across test runners, so the guess would be wrong in exactly the stacks the risk names, and being wrong there is invisible.
