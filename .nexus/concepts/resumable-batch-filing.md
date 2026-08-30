---
title: "Resumable Batch Filing"
aliases: ["resume ledger", "batch filing", "re-runnable batch", "half-filed batch", "duplicate-issue guard", "filing preflight", "keep manifest"]
touches: ["delegating-port", "backlog-stub", "publishing-config-resolution", "story-identity", "target-root-convention", "report-free-shared-layer"]
last_updated_by: "#352"
status: active
verification: verified
---

# Resumable Batch Filing

Filing a folder of work items into issues is a batch that is always safe to re-run. Nothing irreversible happens until the batch is proved legal and every label it needs exists, and each issue is recorded in a resume ledger before anything is done to it. The failure mode this prevents is duplicate issues, which no later stage can undo.

## How It Works

A run first proves the batch legal: the target folder must resolve inside the run's root, and no item may ask for a parent while marked unplanned — a refusal names the offender and files none of the batch. Only then is publishing configuration resolved and every label established, so a repository that has never carried one is prepared before anything exists.

Three passes follow. The first files each item, classifies it, links its parent, and writes its ledger entry the moment the issue's identity resolves. The second wires the declared dependency edges. The third rewrites surviving authoring refs in the filed bodies, reading each back from the platform so a human edit made since is never reverted.

The run then reports what it created, reused, wired and rewrote, and — where anything failed or went unresolved — the ledger's location and the command that resumes it.

## Key Invariants

1. No issue exists until the batch is proved legal: the folder resolves inside the run's root, and no item is both unplanned and parented.
2. Every label the run will apply exists before the first issue; one that can neither be found nor created ends the run having created nothing.
3. A created issue is recorded in the ledger, by atomic replace, before it is typed, parented or added to a project.
4. A ref the ledger already records never yields a second issue: the recorded one is reused, and a missing identity is backfilled from the platform.
5. An unreadable or malformed ledger is treated as empty with a warning, never as a failure.
6. Every pass is re-runnable: an edge or body already in the wanted state counts as present, not re-applied, and a body is read back from the platform rather than re-pushed locally.
7. Decoration after creation — type, parent link, project membership — warns on failure and never fails the run; an issue that exists is never abandoned over it.

## Integration Points

- [delegating-port](delegating-port.md) — the port that moved this contract onto the toolkit's own runtime, where preserving every flag, line and exit code was the bar.
- [backlog-stub](backlog-stub.md) — the one batch path both stub writers file through; its preflight is where the never-a-sub-issue rule stops a deadlocking stub.
- [publishing-config-resolution](publishing-config-resolution.md) — supplies the classification, labels and project target the run establishes before the first issue, none of them hard-coded here.
- [story-identity](story-identity.md) — resolves the pre-filing ref, in dependency graph and prose alike, into the issue number that becomes a story's only name.
- [target-root-convention](target-root-convention.md) — the root the folder must resolve inside, and the root every platform call is bound to rather than the ambient directory.
- [report-free-shared-layer](report-free-shared-layer.md) — this contract's own platform calls and lookups, generalised into a shared layer once a second capability needed them.

## Decision Log

### 2026-08-29 — #353 — The ledger is written before an issue is decorated, and an illegal batch is refused before anything exists

Two orderings carry this contract, and both were preserved deliberately rather than improved. The ledger entry is written the moment a created issue's identity resolves and before any typing, parent linking or project work, because the gap between an issue existing and the ledger recording it is the only path that can produce a duplicate — and a retried call currently sits inside it. Separately, the legality check runs ahead of everything, including configuration resolution, so a bad work item costs a corrected file rather than a half-filed repository nobody can unpick; the consequence accepted here is that a refused batch reports one line fewer than before, on a path that creates nothing. Decoration was made best-effort for the mirror-image reason: an issue that already exists is never abandoned over its type, its parent link or its board membership. **Refuted alternative:** narrow the duplicate window by recording the entry the instant the issue exists and leaving its identity to the existing backfill path. This is a genuine improvement and closes the one gap named above, but the bar for this work was preservation, and a resumed batch is checked against the current ordering; it belongs in its own change rather than smuggled into a port.

### 2026-08-30 — #352 — Reciprocal link from report-free-shared-layer

Mechanical reciprocity fan-out: the report-free-shared-layer page names this contract's platform calls and project lookups as the mechanism it generalised — this page's calls stopped printing for themselves so a second capability could reuse them in its own vocabulary, with no change to this contract's own outcomes or ordering.
