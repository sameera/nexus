---
title: "Nexus Setup CLI"
aliases: ["nexus cli", "nexus deploy", "component-deploy primitive", "workspace init", "workspace add-repo", "workspace writer"]
touches: ["workspace-resolution", "portable-tooling", "publishing-config-resolution", "verb-reachability", "environment-guard"]
last_updated_by: "#251"
status: active
verification: verified
---

# Nexus Setup CLI

The Nexus Setup CLI is the portable `nexus` command that owns the *structural* half of getting Nexus into a repo or a whole multi-repo workspace — installing components and declaring or growing a workspace. It is the structural counterpart to the judgment-owning setup interview: one owns placement and files, the other owns stack docs, standards, and product context.

## How It Works

A single entrypoint exposes its verbs over two capabilities it never duplicates: the workspace resolver (the sole authority on workspace shape) and one component-deploy primitive (the sole component installer). `deploy` mirrors the managed component set into a repo. `init` declares a workspace — the human designates a hub and members from the discovered sibling checkouts, and every declared repo is deployed. `add-repo` adds one member. The rest are read-outs over resolver-owned values: workspace status, the resolved docs root, and the hub's publishing defaults, that last emitted as machine-readable output for a consumer in another language.

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
- [publishing-config-resolution](publishing-config-resolution.md) — a read-out here is the seam that resolver reads its hub-defaults layer across.
- [verb-reachability](verb-reachability.md) — the shared registry this CLI's deploy and workspace verbs are dispatched from, now also hosting the newly reachable capabilities.
- [environment-guard](environment-guard.md) — counts the component sets this CLI owns, by its own namespace predicate, and reports a duplicate this CLI resolves.

## Decision Log

### 2026-07-16 — #60 — One structure-owning CLI, thin over the resolver and one deploy primitive

Getting Nexus into a repo or workspace is deterministic structural work, distinct from the judgment the setup interview owns, so it belongs in a single portable command rather than a manual shell script. The CLI is a thin writer/orchestrator: it takes workspace shape and the collision rules from the resolver and installs components through one deploy primitive, so there is never a second definition of either. Deploy is an overwrite-to-match mirror over an explicit managed set rather than a merge. Refuted alternative: merge/patch semantics that preserve local edits inside managed component files — viable, but it makes refresh nondeterministic and reintroduces the OS-specific fragility the retired shell script had, and no requirement asks for it.

### 2026-07-24 — #121 — A read-out verb carries hub publishing defaults across the language boundary

The workspace manifest is owned by the resolver this CLI is thin over, so the publishing resolver — written in a different language — must not parse that manifest itself; doing so would create the second shape authority the single-authority invariant forbids, and a second parser to drift. A dedicated read-out emitting machine-readable output is the seam instead, resolving from any checkout so a member reaches its hub's defaults exactly as the hub does. It degrades rather than crashes: a checkout with no workspace prints an empty result, and a resolution failure prints the empty result on the success channel and the diagnostic separately, so a caller reading only the former treats an unresolved workspace as "no defaults" instead of failing the issue it was filing. Refuted alternative: extend the existing status read-out to also carry the defaults as a parseable field — one fewer verb, but it turns a human-facing render into a machine contract another language couples to, the same objection that gave the docs root its own single-purpose read-out.

### 2026-08-23 — #247 — Dispatch unifies onto the shared verb registry; the workspace status diagnostic stream is fixed

This CLI's own verbs — deploy, and every workspace verb — now dispatch from the same declarative verb registry that also hosts the newly reachable capabilities, rather than a dispatcher of their own: the usage text for every verb, this CLI's included, is composed from one shared object. Auditing the two capabilities the epic assumed needed no work surfaced a real divergence: the workspace status read-out sent its failure diagnostic to standard output in script form and to standard error in its already-shipped verb form, while a component body already named both forms as interchangeable alternatives. Standard error is correct for a failure diagnostic, so the script form was aligned to the verb form rather than the reverse. Refuted alternative: leave the two forms as believed-equivalent and take the epic's claim they need no work at face value — rejected because the parity gate that exists to catch exactly this class of defect found it live in a component body naming both forms as interchangeable today.

### 2026-08-26 — #251 — Reciprocal link from environment-guard

A second installed component set on one account is now detected and reported by the environment guard, using the same namespace predicate this CLI owns its files by; resolving one stays this CLI's job. Recorded here as the reciprocal edge.
