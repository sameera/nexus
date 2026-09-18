---
title: "Planning Run Folder"
aliases: ["run folder", "planning scratch folder", "draft folder"]
touches: ["epic-approval-gate", "issue-sourced-planning", "distiller"]
last_updated_by: "#638"
status: active
verification: verified
---

# Planning Run Folder

A planning run keeps everything it drafts inside one folder under the checkout's gitignored scratch area, named once before the run decides whether to draft a full epic or file decomposition stubs. The folder holds the draft, its source text, the derived filing body, and any stub work items; the approval gate reports its path beside the digest so a reviewer can open the full stories. The run deletes its own folder only once every issue it produces has filed; any other ending leaves the folder in place so the run can resume.

## How It Works

The folder sits one level deeper than the shape the drain recognises and carries no close record, so the drain never lists, ages or drains a planning draft by construction. The run name is fixed at the run's first write: the epic slug in promotion mode, the feature slug resolved ahead of the right-size gate in intent and decomposition mode (there is no epic slug yet when a run decomposes into stubs), or the discovery folder's slug in discovery mode. Path derivation and removal both go through the toolkit, never shell in a command's own prose, since removal is a guarded delete inside the lead's checkout.

## Key Invariants

1. A run folder sits one level deeper than the shape the drain recognises, so a draft is never mistaken for a drainable entry.
2. The folder is named once, before the right-size gate, for the run's whole life.
3. Everything the run files from, the draft, the derived filing body, and any stub items, lives only in the run's own folder.
4. The folder is removed only once every issue the run produces has filed without error; any other ending leaves it intact.
5. A run reads, writes and removes only its own folder; two runs never share one.
6. The gate names the folder's path beside the digest; the same path a revise edits and a resume reads.
7. Path derivation and removal are both performed by the toolkit, never by shell in command prose.

## Integration Points

- [epic-approval-gate](epic-approval-gate.md) — names this folder's path beside the digest it renders.
- [issue-sourced-planning](issue-sourced-planning.md) — the epic materializes from this folder's draft before it is filed as issues.
- [distiller](distiller.md) — never lists or ages a planning draft, because neither its shape nor a close record matches what the drain looks for.

## Decision Log

### 2026-09-17 — #638 — The draft moves from harness session scratch into the checkout's own scratch folder

Before this epic, a planning draft lived in the harness's own temporary folder, outside the checkout, so a reviewer stopped at the approval gate had no practical way to open a full story before deciding, and an abandoned draft died with the session. The draft now lives in a run folder under the repository's already-gitignored scratch area, one level deeper than the shape the drain recognises, so it is provably not a drainable entry by construction rather than by a fourth case taught to the drain. The gate now names the folder's path beside the digest, and a run deletes its own folder only once every issue it produces has filed. Refuted alternative: teach the distiller to skip planning drafts directly. Rejected because it would give the drain a fourth case to keep in sync with a separate command, turning "the drain lists what it listed before" into a property that must be tested rather than one guaranteed by position alone.
