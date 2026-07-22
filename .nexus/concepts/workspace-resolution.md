---
title: "Workspace Resolution"
aliases: ["multi-repo workspace", "workspace manifest", "hub pointer", "single-repo fallback", "workspace resolver"]
touches: ["remote-identity-normalization", "bare-name-guard", "portable-tooling", "close-entry-migration", "nexus-setup-cli", "issue-sourced-planning"]
last_updated_by: "#114"
status: active
verification: verified
---

# Workspace Resolution

Workspace resolution makes a multi-repo product a declared, discoverable thing: one manifest committed in the hub repo names the hub and its members, and a thin pointer committed in each member names only the hub. A single deterministic resolver reads these to produce an identical workspace description from any checkout, and falls back to single-repo behavior when neither artifact is present.

## How It Works

The hub manifest is the single source of truth for the hub, its members, and each member's remote and checkout name. A member's pointer only locates the hub; on disagreement the manifest wins.

A checkout's role follows its artifact: a manifest makes it the hub, a pointer a member that finds the hub as a named sibling and reads that manifest. Both entry points converge on a deep-equal description — the parity guarantee — which also fixes the hub's portable-tooling location and each repo's docs root. Carrying neither means single-repo mode, unchanged.

Two read-outs surface it: full status and resolved docs root.

## Key Invariants

1. The hub manifest is the sole authority for membership; a pointer locates the hub but never redeclares members; disagreement is reported, never inferred away.
2. Resolution from the hub and from any member yields an identical workspace description.
3. One deterministic resolver is the only producer of workspace context; no command re-derives workspace shape.
4. Resolution is strictly read-only: it reports missing checkouts and never clones, fetches, or mutates.
5. With neither artifact present, single-repo behavior is unchanged.
6. Every failure names the artifact, the entry, and expected-versus-actual state — never generic.
7. A missing member checkout is reported state; only a missing hub checkout, undeclared member, or malformed manifest is a hard failure.

## Integration Points

- [remote-identity-normalization](remote-identity-normalization.md) — resolution compares git remotes through this rule to verify a pointer names the located hub and to reject a member sharing another member's or the hub's remote.
- [bare-name-guard](bare-name-guard.md) — every manifest and pointer name is validated as a bare segment before it locates a checkout.
- [portable-tooling](portable-tooling.md) — the resolved workspace context reports where a hub's vendored copy of this tooling lives.
- [close-entry-migration](close-entry-migration.md) — a member close reads its role and hub here before relocating the entry.
- [nexus-setup-cli](nexus-setup-cli.md) — writes the manifest and pointer artifacts this resolver reads, re-resolving for parity.
- [issue-sourced-planning](issue-sourced-planning.md) — the epic resolver reads this for its target.

## Decision Log

### 2026-07-12 — #38 — Two committed artifacts plus one deterministic resolver

The hub manifest is the single source of truth and each member carries only a thin hub-locating pointer, so adding a member stays a two-file change and a member never needs the workspace's full shape to work locally. One shared resolver is the sole producer of workspace context — that is what makes parity hold and lets every later multi-repo capability consume resolution instead of re-deriving it — and single-repo mode is an explicit branch on the absence of both artifacts, so existing projects stay untouched. Refuted alternative: let each member discover the hub by scanning sibling folders for a manifest and drop the pointer file — viable and one fewer artifact, but a member checked out beside several siblings has no deterministic way to know which sibling is the hub and would silently pick the wrong one.

### 2026-07-14 — #44 — The hub's portable-tooling location is part of resolved workspace context

Resolution now also produces where a hub's vendored portable tooling lives, so that location has a single authoritative producer rather than being re-derived by each consumer. This extends the resolver's role as the sole producer of workspace context: renaming the committed tooling directory is a migration across every hub clone, so pinning its location in one place keeps a later rename a single change. Refuted alternative: let each consumer compute or hard-code the tooling location itself — one fewer field on the resolved description, but it scatters the same path across consumers that then drift independently and turns any relocation into a hunt for every copy.

### 2026-07-15 — #49 — Reciprocal link from close-entry-migration

Mechanical reciprocity fan-out: the close-entry-migration page names this resolver as the source of the role and hub location a member close consumes before relocating the entry.

### 2026-07-16 — #60 — The resolver owns the member-vs-hub collision rule; a canonical writer counterpart

The parser now rejects a manifest where a member reuses the hub's sibling name or remote identity, extending the remote-identity rule from member-vs-member to also cover the hub — the shape authority must own the rule so the read and write sides cannot diverge. This epic's setup CLI is that write side: its init and add-repo writers render a candidate and run it back through this parser, writing only when resolution accepts it unchanged, so the resolver stays the single acceptance oracle for workspace shape. Refuted alternative: a CLI-side pre-check comparing the new member against the hub remote — works for the writer, but creates a second copy of collision logic the single-authority invariant forbids.

### 2026-07-18 — #74 — The per-repo docs root is resolved context, defaulted by role

The resolver now produces where each repo keeps its human docs — its docs root — as one more value on the workspace description, defaulted by role: the repo root for a hub, a docs subdirectory for a member or single-repo project, with an optional hub override. Placing it here gives the fact a single producer, so the atlas generator, the doc-link builder, and the drain read it rather than each assuming a fixed location and drifting apart. Refuted alternative: keep the override in each checkout's local settings, beside the existing cross-reference URL — no manifest change needed, but local settings are per-checkout and invisible from another checkout, so a member's value could not be seen when resolving from the hub, breaking the parity guarantee; a shared workspace fact cannot live in per-checkout state.

### 2026-07-19 — #81 — Planning surfaces read the docs root through a dedicated read-out

The single-producer guarantee now provably covers the planning surfaces, not only the derived-artifact ones. A dedicated single-value read-out over the resolver's existing docs-root selector lets the epic, close, setup, and design commands — and the product-manager and architect briefs they invoke — obtain the resolved docs root once per run and prefix it onto the unchanged taxonomy, instead of writing to a fixed docs location a docs-only hub does not use. The per-feature container path is resolved once when the feature is created and recorded in the queue entry; close reads that recorded value rather than re-resolving, so its writes land under the same root as the artifacts they belong to. A resolution failure surfaces the resolver's named diagnostic and stops the command — only a context doc genuinely missing under a successfully resolved root is treated as absent, preserving reference-if-present. Refuted alternative: re-resolve the docs root at each stage instead of recording it — every command stays self-contained, but it creates two sources of truth that disagree exactly when an override changes or the entry migrates between checkouts, landing the close-time writes under a different root than where the feature was created.

### 2026-07-19 — #87 — The product-manager brief's residual path references now read the docs root too

The docs-root read-out reached most of the product-manager brief when the planning surfaces moved, but three references it uses at runtime — its prior-decisions check, its project-templates check, and the decision-record path it recommends — still carried a hardcoded default and were missed by that sweep. They now read the same resolved value instead, so a workspace whose docs root isn't the default no longer sends the brief looking in, or recommending, the wrong place. No new mechanism: this closes a gap in the one already in place. Refuted alternative: leave the gap and treat it as within tolerance since the surfaces are read-time defaults, not write-time — rejected because a wrong read is the same silent-drift failure the docs-root read-out exists to prevent, whether the surface reads or writes.

### 2026-07-22 — #114 — Reciprocal link from issue-sourced-planning

Mechanical reciprocity fan-out: the issue-sourced-planning page names this resolver as what selects the epic resolver's target — the hub's issues in a workspace, the local repo in single-repo mode.
