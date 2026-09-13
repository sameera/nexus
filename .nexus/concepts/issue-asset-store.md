---
title: "Issue Asset Store"
aliases: ["asset store", "issue assets", "pinned asset reference", "asset size cap", "assets unsupported", "publish an asset"]
touches: ["publishing-config-resolution", "settings-key-catalogue", "epic-approval-gate", "decision-record", "derived-filing-body"]
last_updated_by: "#594"
status: active
verification: verified
---

# Issue Asset Store

A team names one repository — or one unprotected branch of one — that its filing stages publish issue graphics into. A file is published only after the reviewer approves, and the reference replacing its local path names the commit that publish created, so a later upload to the same path never changes what an earlier issue shows. A repository naming no store files exactly the bodies it filed before.

## How It Works

The store is one more key in the same settings block as the issues repository, so it inherits that block's precedence chain and workspace-wide layer with no resolution code of its own. It carries no built-in on purpose: every other absent publishing target falls back to the current repository, and a store must not, because writing files into a repository nobody nominated is a side effect the team never asked for. One step answers with a location, an unsupported verdict, or a malformed value that stops the run; no stage parses the setting or addresses the store itself.

Publication goes through the hosting platform's file-contents call rather than a clone: one commit per file, in declared order. A partial failure leaves earlier files published, unreferenced and harmless; a re-run republishes cleanly. A reference's shape follows the file's type alone — an image renders inline, every other file is a link — never the store's visibility, so a store later made private does not break the issues filed while it was public.

## Key Invariants

1. No file leaves the machine before the reviewer approves at the filing gate; a revise there leaves the store unchanged.
2. Nothing is deleted from or force-overwritten in the store, and a reference pins a commit, never a branch.
3. An absent store means unsupported with no default location, and the stage says so once rather than failing.
4. The store's visibility is read once a run, feeds only the approval digest, and never selects a reference form.
5. Every referenced asset is published before the run's first issue exists, and no local path reaches an issue body.
6. An oversize file is refused before any request leaves the machine, and two assets in one run may not share a file name.
7. The declared list is kept beside the draft, never in its frontmatter, which is filed onto the issue and scanned by the assertion.

## Integration Points

- [publishing-config-resolution](publishing-config-resolution.md) — the chain the store and its size cap resolve through, hub layer included, which is what let the store be one more key rather than a settings section of its own.
- [settings-key-catalogue](settings-key-catalogue.md) — where both keys are declared once; the store is the row that deliberately carries no built-in, so absence means unsupported rather than the current repository.
- [epic-approval-gate](epic-approval-gate.md) — the gate whose approval publishes this run's files and whose digest names the store and its visibility; a revise there publishes nothing.
- [decision-record](decision-record.md) — the other stage that carries assets, gated the same way at its own checkpoint; a revision's new files are new commits, so a superseded body still resolves.
- [derived-filing-body](derived-filing-body.md) — where each local path is replaced by its published reference, and where a survivor fails the run before any issue exists.

## Decision Log

### 2026-09-13 — #594 — Durable asset store for filed issues

Nexus files issues from the command line and the hosting platform offers no way to attach a file to an issue from there, so a diagram only reached the issue when a documentation pull request merged days later. A store the filing stages write to directly closes that gap on the day the issue is filed, and immutability comes from the commit each publish creates rather than from naming discipline, so file names need no coordination across epics. Refuted alternative: defaulting the store to the issues repository, which would need no configuration at all — it loses because the epic's premise is that the issues repository sits behind a protected branch, so the default would fail exactly the teams it was meant to serve.
