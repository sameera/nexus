---
title: "Nexus Setup CLI"
aliases: ["nexus cli", "nexus deploy", "component-deploy primitive", "workspace init", "workspace add-repo", "workspace writer"]
touches: ["workspace-resolution", "portable-tooling"]
last_updated_by: "#60"
status: active
verification: verified
---

# Nexus Setup CLI

The Nexus Setup CLI is the portable `nexus` command that owns the *structural* half of getting Nexus into a repo or a whole multi-repo workspace — installing components and declaring or growing a workspace. It is the structural counterpart to the judgment-owning setup interview: one owns placement and files, the other owns stack docs, standards, and product context.

## How It Works

A single entrypoint exposes four verbs over two capabilities it never duplicates: the workspace resolver (the sole authority on workspace shape) and one component-deploy primitive (the sole component installer). `deploy` mirrors the managed component set into a repo. `init` declares a workspace — the human designates a hub and members from the discovered sibling checkouts, and every declared repo is deployed. `add-repo` adds one member. `status` prints the resolver's own read-out.

Deploy is an overwrite-to-match mirror over an explicit managed set: it refreshes managed files and drops retired ones, converging to an identical set on re-run, and never touches user-owned files. Every workspace-writing verb renders a candidate, runs it back through the resolver, and writes only if resolution accepts it unchanged — so the resolver, not the CLI, judges every artifact.

## Key Invariants

1. One component-deploy primitive is the sole component installer; the legacy update script is retired.
2. Deploy is idempotent: re-running converges the managed component set and never touches user-owned files.
3. Every workspace-writing verb re-resolves its own output and writes nothing unless hub and member resolution agree.
4. The CLI never re-declares workspace shape or collision logic — it takes both from the resolver.
5. `add-repo` mutates exactly two files: the hub manifest and the new member's pointer, preserving existing entries.
6. `status` is strictly read-only and reports single-repo mode rather than failing.
7. The CLI writes only structure and components; the setup interview writes only per-repo judgment.

## Integration Points

- [workspace-resolution](workspace-resolution.md) — writes the manifest and pointer artifacts this resolver reads, re-resolving its output for parity and delegating every collision to it.
- [portable-tooling](portable-tooling.md) — ships as a vendored entrypoint on this distributable, its component payload pinned by the same fingerprint gate.

## Decision Log

### 2026-07-16 — #60 — One structure-owning CLI, thin over the resolver and one deploy primitive

Getting Nexus into a repo or workspace is deterministic structural work, distinct from the judgment the setup interview owns, so it belongs in a single portable command rather than a manual shell script. The CLI is a thin writer/orchestrator: it takes workspace shape and the collision rules from the resolver and installs components through one deploy primitive, so there is never a second definition of either. Deploy is an overwrite-to-match mirror over an explicit managed set rather than a merge. Refuted alternative: merge/patch semantics that preserve local edits inside managed component files — viable, but it makes refresh nondeterministic and reintroduces the OS-specific fragility the retired shell script had, and no requirement asks for it.
