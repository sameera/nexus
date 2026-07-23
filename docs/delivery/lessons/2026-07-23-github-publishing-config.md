---
date: 2026-07-23
epic: "GitHub Publishing Config"
source: "#121"
---

# Lesson: cross-check acceptance criteria against the epic's own invariants at the gate

## Estimate vs. actual

Rated **M** at the right-size gate — seven interlocking config-plumbing stories sharing one
resolver, one deliberate behavior change (epic fallback label `enhancement` → `epic`), self-healing
write-back, and one external dependency (`workspace-manifest`) for the workspace-defaults story. All
seven stories closed with every in-scope acceptance criterion met and zero invariant violations. The
M rating held: the driver was breadth (many small consumers to keep in lockstep) rather than depth,
and the resolver-first decomposition kept each story small. This is the second epic in a row where a
"single producer everything else reads through, built and proven first" shape delivered on estimate —
treat that shape as a reliable M, not an L.

## The sharpest lesson: an AC contradicted the epic's own invariant

Story 7's AC1 required write-back to persist "the detected classification mode, the discovered
project or `none`, **and the resolved issues-repo**." The epic's own **Invariant 6** says write-back
**never pins "current repo."** Those are the same epic contradicting itself — one clause says persist
`issues-repo`, another says never persist it. Both shipped in the planning artifact; the contradiction
surfaced only when the code was written, forcing a mid-implementation descope of AC1 (now marked
`[SKIPPED]`, grounded in Invariant 6).

The descope was the right call and cost little here, but it was avoidable at planning. When an epic
carries both acceptance criteria **and** a decision-record invariant set, the epic gate should
cross-check them: a "persist X" AC sitting next to a "never persist X" invariant is a mechanically
detectable inconsistency, not a judgment call. **Carry forward:** add an AC-vs-invariant consistency
pass to the epic gate for any epic that ships a decision record, so a contradiction is caught before it
becomes a mid-flight scope change.

## What to carry forward: file the decision record as a sub-issue at planning, not mid-flight

This epic predated the decision-record-as-sub-issue model, so its DR was imported and filed as
sub-issue #130 **during** implementation. That flipped `/nxs.analyze` from downgraded mode (AC and
success-metric conformance only) to full mode (all ten invariants checked) — the invariant pass only
ran because the DR landed in time. The conformance gate's depth depends on the DR being present as its
durable sub-issue home. File the DR sub-issue at planning so analyze runs full mode from its first
pass, rather than relying on a retrofit landing before close.
