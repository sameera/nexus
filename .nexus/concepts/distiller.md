---
title: "Distiller"
aliases: ["System B", "distillation engine", "concept distiller", "the drain"]
touches: ["concept-store", "committed-queue", "distillation-pr", "code-anchors", "scratch-capture", "portable-tooling", "close-entry-migration"]
last_updated_by: "#74"
status: active
verification: verified
---

# Distiller

The distiller drains committed queue entries into the concept store — what changed from the merged code diff, why from the queued human records — inferring the per-concept mapping itself and applying the result through a reviewed pull request, not a direct write.

## How It Works

The distiller runs after merges, scanning for unconsumed entries. For each it recomputes the diff from history (never stored), reads the decision and close records for rationale, and maps both to per-concept deltas — a page-patch with the changed sections plus one decision entry. Its work splits firmly: judgment is the model's (mapping diff and records to concepts, writing prose, resolving a slug collision); the mechanical steps are code, never improvised — the reciprocity fan-out, anchor refresh, atlas regeneration, and validator. Those last two run in-repo tooling in a code repo and vendored portable tooling in a docs-only hub, by the checkout's role, never a new heuristic. A validation failure blocks the apply; a failing page is fixed, never shipped. The distiller never writes the store directly — only through the merge consuming each entry.

## Key Invariants

1. The distiller is the single producer of the concept store.
2. What changed comes from the recomputed diff, why from the queued human records; the diff is never stored.
3. Judgment (concept mapping and prose) is the model's; the reciprocity, anchor, and validator steps are deterministic.
4. A validation failure blocks the apply; a failing page is never shipped.
5. The distiller infers the concept mapping itself — the pipeline emits no structured concept list.
6. Draining is a manually-invoked curated step, not an automated trigger; only detecting undrained entries and deleting consumed ones are deterministic.
7. Input is only the gated queue and recomputed diff, never plans or ungated capture; decision-only memos drain diff-less into decision logs.

## Integration Points

- [concept-store](concept-store.md) — the store the distiller is the sole producer of.
- [committed-queue](committed-queue.md) — the entries the distiller drains.
- [distillation-pr](distillation-pr.md) — the reviewed pull request through which the distiller applies its output.
- [code-anchors](code-anchors.md) — the derived sidecars the distiller regenerates for every touched concept.
- [scratch-capture](scratch-capture.md) — an input boundary: the distiller never reads scratch.
- [portable-tooling](portable-tooling.md) — the offline validator and atlas generator the distiller runs when draining from a hub.
- [close-entry-migration](close-entry-migration.md) — the migrated entry and range the drain recomputes a relocated epic's diff from.

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
