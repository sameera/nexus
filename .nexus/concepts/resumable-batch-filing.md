---
title: "Resumable Batch Filing"
aliases: ["resume ledger", "batch filing", "re-runnable batch", "half-filed batch", "duplicate-issue guard", "keep manifest"]
touches: ["delegating-port", "backlog-stub", "publishing-config-resolution", "story-identity", "target-root-convention", "report-free-shared-layer", "filing-preflight", "initiative"]
last_updated_by: "#705"
status: active
verification: verified
---

# Resumable Batch Filing

Filing a folder of work items into issues is a batch that is always safe to re-run. Nothing irreversible happens until the batch is proved legal and every label it needs exists, and each issue is recorded in a resume ledger before anything is done to it. The failure mode this prevents is duplicate issues, which no later stage can undo.

## How It Works

A run first passes the filing preflight, which proves the batch legal and establishes every label before any issue exists.

Three passes follow. The first files each item, classifies it, links its parent, and writes its ledger entry the moment the issue's identity resolves. On a repeat it retries the parent link of every issue the ledger already records. The second wires the declared dependency edges. The third rewrites surviving authoring refs in the filed bodies, reading each back from the platform so a human edit made since is never reverted.

The run then reports what it created, reused, wired and rewrote, and — where anything failed or went unresolved — the ledger's location and the command that resumes it.

## Key Invariants

1. A created issue is recorded in the ledger, by atomic replace, before it is typed, parented or added to a project.
2. A ref the ledger already records never yields a second issue: the recorded one is reused, and a missing identity is backfilled from the platform.
3. An unreadable or malformed ledger is treated as empty with a warning, never as a failure.
4. Every pass is re-runnable: an edge or body already in the wanted state counts as present, not re-applied, and a body is read back from the platform rather than re-pushed locally.
5. Decoration after creation — type, parent link, project membership — warns on failure and never fails the run; an issue that exists is never abandoned over it.
6. A repeat retries the parent link of every issue the ledger records, and a link that already exists counts as success.

## Integration Points

- [delegating-port](delegating-port.md) — the port that moved this contract onto the toolkit's own runtime, where preserving every flag, line and exit code was the bar.
- [backlog-stub](backlog-stub.md) — the one batch path both stub writers file through, whose preflight limits a stub's parent to an initiative.
- [publishing-config-resolution](publishing-config-resolution.md) — supplies the classification, labels and project target the run establishes before the first issue, none of them hard-coded here.
- [story-identity](story-identity.md) — resolves the pre-filing ref, in dependency graph and prose alike, into the issue number that becomes a story's only name.
- [target-root-convention](target-root-convention.md) — the root the folder must resolve inside, and the root every platform call is bound to rather than the ambient directory.
- [report-free-shared-layer](report-free-shared-layer.md) — this contract's own platform calls and lookups, generalised into a shared layer once a second capability needed them.
- [filing-preflight](filing-preflight.md) — the legality check and label establishment every batch passes before its first issue, split from this page.
- [initiative](initiative.md) — filed as its own one-item batch before the stubs that name it, whose parent links a repeat retries.

## Decision Log

### 2026-08-29 — #353 — The ledger is written before an issue is decorated, and an illegal batch is refused before anything exists

Two orderings carry this contract, and both were preserved deliberately rather than improved. The ledger entry is written the moment a created issue's identity resolves and before any typing, parent linking or project work, because the gap between an issue existing and the ledger recording it is the only path that can produce a duplicate — and a retried call currently sits inside it. Separately, the legality check runs ahead of everything, including configuration resolution, so a bad work item costs a corrected file rather than a half-filed repository nobody can unpick; the consequence accepted here is that a refused batch reports one line fewer than before, on a path that creates nothing. Decoration was made best-effort for the mirror-image reason: an issue that already exists is never abandoned over its type, its parent link or its board membership. **Refuted alternative:** narrow the duplicate window by recording the entry the instant the issue exists and leaving its identity to the existing backfill path. This is a genuine improvement and closes the one gap named above, but the bar for this work was preservation, and a resumed batch is checked against the current ordering; it belongs in its own change rather than smuggled into a port.

### 2026-08-30 — #352 — Reciprocal link from report-free-shared-layer

Mechanical reciprocity fan-out: the report-free-shared-layer page names this contract's platform calls and project lookups as the mechanism it generalised — this page's calls stopped printing for themselves so a second capability could reuse them in its own vocabulary, with no change to this contract's own outcomes or ordering.

### 2026-10-10 — #705 — A repeat retries a failed parent link, and the preflight moves to its own page

A parent link that failed used to print a warning only. The batch still reported complete, and a repeat never retried the link. So a stub could silently drop out of its initiative. A repeat now retries the link for every issue the ledger already records, and a link that already exists counts as success, so the retry is safe to repeat. The approved narrowing of the parent rule pushed this page past the word cap, so the page was split. The legality check and label establishment moved to filing-preflight, with the two invariants that state them. This page keeps the ledger and the three passes. Refuted alternative: report a failed parent link in the run's summary and exit non-zero. It lost because that summary is a frozen surface and the change would alter every story batch. The stage that files under an initiative reads the children back instead.
