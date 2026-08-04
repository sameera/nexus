---
title: "Distiller"
aliases: ["System B", "distillation engine", "concept distiller", "the drain"]
touches: ["concept-store", "committed-queue", "distillation-pr", "code-anchors", "scratch-capture", "portable-tooling", "close-entry-migration", "taxonomy-filing-gate", "drift-advisory", "pr-driven-flow", "issue-sourced-planning", "decision-record", "record-digest", "ephemeral-handoff-entry", "durable-close-record", "concept-page-capacity", "finding-severity"]
last_updated_by: "#220"
status: active
verification: verified
---

# Distiller

The distiller drains queue entries into the concept store — what changed from the merged diff, why from the closed records — inferring the mapping and applying it through a reviewed pull request.

## How It Works

It runs after merges, scanning unconsumed entries in the committed queue and the ephemeral area alike. For each it recomputes the diff from history, resolves the why by precedence, and maps both to per-concept deltas. An entry absent from the trunk is gated on its recorded range head reaching the trunk or resolving to a merged pull request, never on a file's presence. A lost entry is rebuilt on explicit request from its close comment. Its reciprocity step never drops, demotes, or compresses an interaction to fit a page — an interaction too large for one bounded bullet is declared as two edges — and it splits a page only when the page's own content overflows. It writes the store only through the merge consuming each entry.

## Key Invariants

1. It is the single producer of the concept store.
2. The what is the recomputed, never-stored diff; the why is the hash-verified record issue body, else the committed decision record, else the close record; a mismatch hard-errors with no waiver.
3. Judgment is the model's; the reciprocity, anchor, and validator steps are deterministic.
4. ~~A validation failure blocks the apply; a failing page is never shipped.~~ A blocking validation result stops the apply and a failing page is never shipped; an advisory never blocks and is carried to the reviewer.
5. It infers the concept mapping itself — the pipeline emits no structured concept list.
6. Draining is a manually-invoked curated step, not an automated trigger; recovery from a closed epic issue is an explicit per-entry request, never a discovery scan.
7. Input is only gated entries and the recomputed diff, never plans or ungated capture; decision-only memos drain diff-less into logs.

## Integration Points

- [concept-store](concept-store.md) — the store it is sole producer of.
- [committed-queue](committed-queue.md) — the entries it drains.
- [distillation-pr](distillation-pr.md) — the reviewed write it applies through.
- [code-anchors](code-anchors.md) — derived sidecars regenerated per touched concept.
- [scratch-capture](scratch-capture.md) — an input boundary, never read.
- [portable-tooling](portable-tooling.md) — the offline tooling a hub drain runs.
- [close-entry-migration](close-entry-migration.md) — the migrated entry a relocated epic drains from.
- [taxonomy-filing-gate](taxonomy-filing-gate.md) — the filing decision and gate.
- [drift-advisory](drift-advisory.md) — the non-blocking decay report.
- [pr-driven-flow](pr-driven-flow.md) — the flow whose stamped range supplies the diff.
- [issue-sourced-planning](issue-sourced-planning.md) — the model producing born-at-close entries.
- [decision-record](decision-record.md) — the record issue the why is fetched from.
- [record-digest](record-digest.md) — the verification gating that fetch.
- [ephemeral-handoff-entry](ephemeral-handoff-entry.md) — the version-ignored entries it also discovers and drains.
- [durable-close-record](durable-close-record.md) — the close comment a lost entry is rebuilt from.
- [concept-page-capacity](concept-page-capacity.md) — the cap it applies, and the only condition under which it splits a page.
- [finding-severity](finding-severity.md) — the two-class validation result it gates on by exit status alone.

## Decision Log

### 2026-06-14 — bootstrap — 0006: synthesis lives in the distiller

Located all synthesis in the distiller: the pipeline stays dumb and emits only human prose, while the distiller reads the diff and records and infers the concept mapping. The considered alternative — having the close stage pre-produce the structured concept list — was rejected because it pushes machine synthesis onto the human surface and pre-guesses concept boundaries before the final merged code exists, whereas a single post-merge synthesizer sees the final state of every drained epic and reconciles once.

### 2026-07-03 — bootstrap — 0012: draining is a manual curated step, not an auto-trigger

Fixed the drain trigger as a manually-invoked curated step: a human runs the distiller after a feature with a queue entry merges, backed only by the built-in thirty-day drain age flag. A capability ladder is climbed only as scale forces it — manual now; then a plain check that detects undrained closed entries and nags; and only at sustained volume a scheduled headless run that opens the reviewed pull request plus a deterministic deletion step on its merge. The considered alternative — an unattended trigger that runs the distiller automatically on every merge — was rejected: it reintroduces the unattended write the reviewed-pull-request rule removed, merely relocated, and is speculative machinery for a single-entry queue. Resolves the cadence question left open by 0007; reviewer assignment stays open.

### 2026-07-04 — manual — The distiller never consumes plans

The distiller's data model is *what* from the merged diff and *why* from human-gated records; an engineer's plan is neither — it is pre-implementation speculation that routinely diverges from what ships, so distilling from plans risks recording rationale for code that never landed. Decision-only memos, by contrast, are gated queue artifacts and drain diff-less into decision logs. Refuted alternative: consuming captured plan-mode plans to enrich technical detail on concepts and anchors — attractive as free signal, but it breaks the diff-is-ground-truth model and depends on a sometimes-there input only some engineers' tooling produces.

### 2026-07-04 — manual — Reciprocal link from scratch-capture

Mechanical reciprocity fan-out: the scratch-capture page names this distiller as the consumer that never reads it.

### 2026-07-04 — manual — Atlas regeneration joins the deterministic steps

A derived orientation page must never drift from the pages it maps, so rebuilding the human atlas is mechanics-as-code on every drain, gated by the same validation that blocks a failing page — the drain ships only when the atlas matches the active pages.

### 2026-07-14 — #44 — The deterministic steps select their runner by workspace role

The validator and atlas-regeneration steps now choose their runner from the checkout's role: a single code repo runs the in-repo tooling exactly as before, and a docs-only hub runs the vendored portable form. The choice reads the same committed artifacts that already mark a checkout's role and forbids any new heuristic, so it cannot drift from how the rest of the system determines that role, and single-repo distillation stays unchanged. Refuted alternative: one unified invocation that always runs the compiled portable build in both contexts — simpler, and it makes parity trivially structural, but it demotes the in-repo source to mere build input, forces the build to be produced and committed inside code repos too, and changes the single-repo mechanism, breaking the guarantees that the in-repo tooling stays the executed authority and that single-repo distillation is untouched.

### 2026-07-15 — #49 — Reciprocal link from close-entry-migration

Mechanical reciprocity fan-out: the close-entry-migration page names this distiller as the consumer that recomputes a migrated epic's diff from the stamped range and drains the relocated entry once it sits beside the concept store.

### 2026-07-15 — #54 — Workspace-aware sourcing of the what

Draining from a docs-only workspace hub, the distiller now sources the what across repos: each entry's diff is recomputed from its recorded landed range inside the correct member checkout, code anchors and provenance are qualified by member repo, and one pass reports drain health for the whole hub queue. All of it is gated on the presence of the hub manifest, so a single-repo drain is unchanged. The considered alternative — keep the introducing-commit diff as a first-try fast path and fall back to the recorded range — was rejected because after an entry migrates to the hub its introducing commit is the migration commit, so that path would return the migration's file moves, a confidently wrong diff; in a hub the recorded range must be the sole authoritative diff source, never a fallback. The drain only ever reads a member checkout — never cloning, fetching, or mutating one — and a missing checkout, an unreachable recorded revision, or a missing range stamp is a hard per-entry error, never a silent empty diff.

### 2026-07-18 — #67 — Per-user scratch rides inside entries but is never a drain input

Committed engineer scratch now lives inside the very queue entries the distiller drains, so the boundary that the distiller never reads scratch had to become active rather than incidental: the existing queue-path exclusion keeps the scratch out of the what, and an explicit rule keeps the per-user directories out of the why — no concept ever derives from them. Refuted alternative: mine the committed stubs to enrich concept rationale now that they are conveniently in-tree — attractive free signal, but it breaks the diff-is-ground-truth model and launders ungated capture into the gated store.

### 2026-07-18 — #74 — The drain follows the resolved atlas location, holding no docs-path literal

The drain's atlas regeneration, its sync check, its staged file set, and its completion report all follow the docs root the resolver produces, rather than a hardcoded docs-directory location. A single-repo drain is unchanged, because the resolved location there is still that same docs subdirectory; a docs-only hub drain writes the atlas at the hub root, never recreates a docs directory the hub does not use, and names the real location in its report. Sourcing the path from the same producer the generator uses keeps one answer across regenerate, check, stage, and report — the literal was the last place the old fixed-location assumption survived.

### 2026-07-20 — #94 — The drain becomes the taxonomy's steward: filing and a drift advisory

The distiller gained two stewardship behaviors, each split into its own concept rather than grown onto this already-full page: during synthesis it files every new concept under a best-fit domain and stops at a three-way gate when none fits, and among its deterministic steps it now runs a non-blocking drift advisory that reports taxonomy decay into the PR body. Both are gated on a registry's presence, so a drain with no registry is byte-for-byte unchanged. Refuted alternative: describe filing and the advisory inline here — rejected because the page is already at its word cap and the store's discipline splits a concept that no longer fits rather than growing it.

### 2026-07-20 — #101 — Single-repo derivation goes range-first, with a single-entry continuation mode

Single-repo diff derivation now prefers the recorded landed range, with the introducing-commit scan only a fallback for a legacy entry whose range is unreachable — converging single-repo onto how a hub drain already derives. On a close-prepared distillation branch the drain continues in place: it drains exactly that one entry rather than the whole queue, skips cutting a branch, and gates on the recorded range head being reachable from the trunk. Refuted alternative: keep the introducing-commit scan first and whole-queue batching — rejected because on a close-prepared branch the most recent add to the entry is the close commit, so that scan is degenerate, and batching strands entries closed on their own branches and misreports them as overdue.

### 2026-07-22 — #114 — The drain tolerates a born-at-close entry with no decision record

Under issue-sourced planning the committed entry is born at close and, until the durable decision-record home lands, carries no decision record — so the drain now reads the decision record only when present and falls back to the close record's key decisions and deviation rationale as the sole source of the why. Refuted alternative: require every entry to carry a decision record and write a placeholder at close — but a placeholder is a fabricated record, whereas the close record already carries the mined why and the drain degrades cleanly without one.

### 2026-07-26 — #139 — The why is fetched from the record issue and hash-verified

With the decision record living on an approvable sub-issue, the drain's why source became a per-entry precedence: the record issue body — fetched fresh and verified against the hash stamped at close — else a committed decision record (old-contract entries drain unchanged), else the close record alone. A mismatch hard-errors and writes nothing for that entry: the drain writes permanently into the knowledge store, so a waived mismatch would file rationale for a design nobody approved; the remedy is upstream, a re-approval and re-stamp where the second approval act is visible. Refuted alternative: give the drain the same explicit waiver close has, for symmetry across the gates — rejected because it puts the softest control on the most durable write.

### 2026-07-31 — #170 — The drain reaches past the committed queue: ephemeral entries and issue recovery

With a local close's artifacts now version-ignored, the drain gained three capabilities on the same model rather than a parallel one: it discovers ephemeral entries beside committed ones, it derives an ephemeral entry's consumption from the store at the trunk instead of from a deletion it cannot perform, and — on an explicit per-entry request — it rebuilds a lost entry from the epic issue's close comment, whose stamped block carries the record reference, hash, conformance verdict, and landed range. The file-presence merge proxy was replaced for any entry absent from the trunk by range-head reachability with a merged-pull-request second test, because a local close stamps its pre-merge branch tip and a squash or rebase merge means that commit never becomes a trunk ancestor — reachability alone would report every squash-merged local epic as not-merged and train the operator to waive the gate. Refuted alternative: scan closed epic issues for undistilled close comments on every run — it would make drain health genuinely complete, seeing epics closed but never drained, which nothing sees today, but it costs an unbounded issue query per drain, adds a network failure mode, and would surface every historically-closed epic on its first run.

### 2026-08-04 — #220 — A drain can always declare a real interaction

Every surface that once let the cap justify losing an edge was rewritten. The reciprocity step now states that it never drops, demotes to prose, or compresses an interaction, and that an interaction it cannot state within the per-entry bound is two interactions to be declared as two edges — otherwise the new bound would simply relocate the old pressure one level down. The split path and the eviction of last resort both fire on own-content overflow alone, so a long neighbour list is never a reason to cut a page up. The blocking rule changed with them: the drain used to treat any printed finding as fatal, which would have made the first advisory stop a drain with nothing to fix, so it now gates on the exit status alone. Refuted alternative: keep the printed-output rule and have the checks stay silent about anything non-fatal — it needs no change here at all, but it throws away exactly the signals a reviewer wants and leaves the drain's gate a heuristic over text.
