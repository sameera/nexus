---
title: "Retroactive Implementation"
aliases: ["retroactive run", "retroactive option", "as-built decision record", "as-built record", "as-built mode", "build without a decision record"]
touches: ["unattended-epic-implementation", "decision-record", "distiller", "implement-fix-loop", "harness-model-selection"]
last_updated_by: "#1041"
status: active
verification: verified
---

# Retroactive Implementation

A lead can build an epic that has no decision record by passing the retroactive option to the unattended implement command. The run asks an agent to plan before it builds. After the build it writes and approves a decision record of the design as built, and that record says the run, not the lead, decided and approved it.

## How It Works

The option matters only when the epic has no record sub-issue. With an open record the run refuses as before. With an approved record it builds from that record and prints one line saying the option was not used. Otherwise a planning session runs first. It reads the epic and the checkout, and its final message becomes the plan, kept in a folder git ignores. The build receives the plan as guidance and keeps a log of its non-obvious choices beside it. A planning session that fails or ends with no plan does not stop the run. The pull request body states that the epic was built without a record and quotes the plan, so no quoted line acts as a claim, an answer, a waiver or an issue-closing reference. Once every story has its own commit, and before the first review round, a separate session writes an as-built design document and hands it to the decision-record stage in its as-built mode. The command then checks the record on GitHub and names it on the pull request.

## Key Invariants

1. A run without the option, or on an epic that has any record, starts, refuses and builds as before.
2. The planning session only reads. A change to a file, a commit or the branch stops the run before the build. The run never requires a plan to exist.
3. Agent-written text reaches the pull request only quoted inside its body, never as a comment.
4. The as-built record is filed only after every story has its own commit. A run that stops earlier files no record.
5. Review starts only when exactly one record exists, closed as completed, opening with the as-built statement. Otherwise the run stops and names how to finish by hand.
6. The statement that the epic was built without a record sits outside the status section, so a status update never removes it.

## Integration Points

- [unattended-epic-implementation](unattended-epic-implementation.md) — the command this option changes; its preflight drops the no-record refusal only here.
- [decision-record](decision-record.md) — files and approves the as-built record through that stage's as-built mode.
- [distiller](distiller.md) — attributes every decision-log entry it writes from an as-built record to the run, not the lead.
- [implement-fix-loop](implement-fix-loop.md) — the review rounds, which start only after the as-built record is approved.
- [harness-model-selection](harness-model-selection.md) — picks the planning model; the as-built session runs on the model planning ran on.

## Decision Log

### 2026-11-22 — #1041 — Build an epic that has no decision record

A lead wanted to build an epic unattended without writing a record first. The option removes one refusal, and only when the epic has no record, so every other run is unchanged. The record is filed and approved before the first review round. Analyze, close and the rule that review needs an approved record therefore stay unchanged, and a run that stops later still leaves the epic with its record. A separate session writes the as-built document and the decision-record stage files it, so filing keeps one implementation. A draft holding anything only the owner can accept is not filed. Agent text is quoted in the body because comments under the lead's account are trusted as answers. A re-run after the record is approved rewrites the whole body and drops the retroactive sections; the lead accepted that gap, and follow-up epic #1062 fixes it. Refuted alternative: write the record after the fix loop, so that it reflects every fix. It lost because analyze would need a new bypass for an epic with no record, and a loop stopped by its round cap would leave built code with no record.
