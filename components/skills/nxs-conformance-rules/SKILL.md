---
name: nxs-conformance-rules
description: The conformance rules and severities for judging an epic's implemented code — each story's acceptance criteria, the decision record's guarantees (or an old-format record's invariants), the epic's success metrics and scope drift. Loaded by /nxs.ship. A word-for-word copy of /nxs.analyze's Phase 2 until a follow-up epic makes analyze load it too; a spec fails when the copies differ.
---

# Conformance rules

Judge the checked range's diff against the epic, its stories and the decision record with the rules
below. They are copied word for word from `/nxs.analyze` Phase 2; fix a rule in both places until
the follow-up epic makes analyze load this skill. Where a rule says "the diff", read the diff of the
range the loading stage fixed.

<!-- copied-from: commands/nxs.analyze.md -->

# Phase 2 — Conformance checks

## 2.1 Acceptance-criteria conformance (per story)

For each story in `## User Stories`, take each acceptance criterion and locate the code that
satisfies it in the change set. **In `--pr` mode, this is scoped to only the story (or stories) the
`stories` step resolved** — never every story of the epic. A story pull request is not marked
failing for a sibling story's work that has not landed yet; a sibling's code appearing in the diff
as unplanned scope is Scope drift (§2.4), not an unmet AC for a story this run does not cover.
Classify the AC:

- **met** — the diff/code plainly implements the Given/When/Then or the measurable contract.
- **partial** — some of the AC is implemented; part is missing or weaker than stated.
- **unmet** — no implementing code found in the change set. **(high)** An open story issue is never
  the reason — the diff decides.
- **contradicted** — the code implements the opposite of, or breaks, the stated criterion. **(critical)**

For `system` stories, the AC states a measurable threshold — confirm the code path that would meet it
exists; if the threshold needs a benchmark you cannot read from the diff, mark it **unverifiable here**
and name the command that would measure it, do not pass it silently.

## 2.2 Guarantee and invariant conformance (full mode only)

For each condition Phase 0.5 step 6 listed — every guarantee of a new-format record, or each
constraint/invariant of an old-format one — and any security boundary it names, check the diff does
not violate it. The record is the **record issue body** resolved in Phase 0.5, or an old-contract
entry's committed `decision-record.md`. A change that breaks a guarantee or an invariant is
**critical**, because these are what the build "must preserve". Cite the file/line in the diff that
breaks it, and name a broken guarantee by its ID.

Skip this section only in **degraded** mode, which by Phase 0.5 means the epic genuinely has no
record. That is now the exception rather than the norm: the record has a durable home (the record
sub-issue), so degraded mode is reached only by the deliberate no-record outcome — never, as before,
because the record had nowhere to live.

## 2.3 Success-metric coverage (epic level)

**Skip this section in `--pr` mode.** A success metric is a property of the whole epic, unmeasurable
by construction against one story's pull request — every story PR of the epic would otherwise carry
the same manufactured finding. Cross-story assessment belongs to the epic-level aggregate (#212).

Otherwise, for each item in the epic's `## Success Metrics`, state whether the implementation
plausibly moves it and whether it is **measurable** from what shipped (is the metric instrumented /
observable?). A success metric with no way to measure it post-ship is a **finding (medium)** — the
epic claimed an outcome the build cannot demonstrate.

## 2.4 Scope drift (informational)

Note material behavior in the diff that **no** story called for (unplanned scope), and any story whose
implementation went meaningfully beyond its ACs. Informational unless it breaks a guarantee or an
invariant.
<!-- end-copied-from -->
