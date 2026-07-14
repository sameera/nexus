---
title: "Workspace Resolution"
aliases: ["multi-repo workspace", "workspace manifest", "hub pointer", "single-repo fallback", "workspace resolver"]
touches: ["remote-identity-normalization", "bare-name-guard", "portable-tooling"]
last_updated_by: "#44"
status: active
verification: verified
---

# Workspace Resolution

Workspace resolution makes a multi-repo product a declared, discoverable thing: one manifest committed in the hub repo names the hub and its members, and a thin pointer committed in each member names only the hub. A single deterministic resolver reads these to produce an identical workspace description from any checkout, and falls back to single-repo behavior when neither artifact is present.

## How It Works

The hub manifest is the single source of truth for the workspace shape: the hub, the members, each member's remote identity, and its expected sibling checkout name. A member's pointer names only the hub, locating it without redeclaring membership; on disagreement the manifest wins and the mismatch is reported naming both sides.

A checkout's role follows the artifact it carries: a manifest makes it the hub; a pointer makes it a member, which finds the hub as a named sibling under the shared parent and reads that same manifest. Both entry points converge on a deep-equal description, the parity guarantee, which also fixes where a hub's vendored portable tooling lives, giving that location one authoritative producer. Carrying neither artifact means single-repo mode, unchanged.

The status read-out is the one observable surface over this resolver: it renders the hub, each declared member, and its checkout state.

## Key Invariants

1. The hub manifest is the sole authority for membership; a pointer locates the hub but never redeclares members, and disagreement is reported, never inferred away.
2. Resolution from the hub and from any member yields an identical workspace description.
3. One deterministic resolver is the only producer of workspace context; no command re-derives workspace shape.
4. Resolution is strictly read-only: it reports missing checkouts and never clones, fetches, or mutates.
5. With neither artifact present, single-repo behavior is unchanged.
6. Every failure names the artifact, the entry, and expected-versus-actual state — never generic or silently partial.
7. A missing member checkout is reported state; only a missing hub checkout, an undeclared member, or a malformed manifest is a hard failure.

## Integration Points

- [remote-identity-normalization](remote-identity-normalization.md) — resolution compares git remotes through this rule to verify a pointer names the located hub and to reject same-remote members.
- [bare-name-guard](bare-name-guard.md) — every manifest and pointer name is validated as a bare segment before it locates a checkout.
- [portable-tooling](portable-tooling.md) — the resolved workspace context reports where a hub's vendored copy of this tooling lives.

## Decision Log

### 2026-07-12 — #38 — Two committed artifacts plus one deterministic resolver

The hub manifest is the single source of truth and each member carries only a thin hub-locating pointer, so adding a member stays a two-file change and a member never needs the workspace's full shape to work locally. One shared resolver is the sole producer of workspace context — that is what makes parity hold and lets every later multi-repo capability consume resolution instead of re-deriving it — and single-repo mode is an explicit branch on the absence of both artifacts, so existing projects stay untouched. Refuted alternative: let each member discover the hub by scanning sibling folders for a manifest and drop the pointer file — viable and one fewer artifact, but a member checked out beside several siblings has no deterministic way to know which sibling is the hub and would silently pick the wrong one.

### 2026-07-14 — #44 — The hub's portable-tooling location is part of resolved workspace context

Resolution now also produces where a hub's vendored portable tooling lives, so that location has a single authoritative producer rather than being re-derived by each consumer. This extends the resolver's role as the sole producer of workspace context: renaming the committed tooling directory is a migration across every hub clone, so pinning its location in one place keeps a later rename a single change. Refuted alternative: let each consumer compute or hard-code the tooling location itself — one fewer field on the resolved description, but it scatters the same path across consumers that then drift independently and turns any relocation into a hunt for every copy.
