---
title: "Portable Tooling"
aliases: ["portable distill tooling", "vendored tooling bundle", "hub tooling", "portable tools distributable", "bare-runtime validator and atlas generator"]
touches: ["distiller", "workspace-resolution", "nexus-setup-cli"]
last_updated_by: "#60"
status: active
verification: verified
---

# Portable Tooling

Portable tooling is the offline form of distillation's deterministic steps — the concept validator, the atlas generator, and a hub diff-derivation tool — built to run on a bare Node.js runtime. Committed into a docs-only hub, it lets a non-code hub validate its concept store and regenerate its atlas as a code repo does. The in-repo tooling stays authoritative; the portable form is a derived build.

## How It Works

Distillation's validator and atlas steps were written to run through a code repo's development toolchain, which a docs-only hub lacks. The portable form drops that dependency: each check is compiled into a self-contained artifact that runs under a bare runtime (the validator still calling git). Every outside dependency is folded in, so nothing resolves from an installed package tree at run time. The same distributable now also carries the `nexus` setup CLI and a vendored component tree, under the one fingerprint gate. Committed into the hub, it gives every checkout identical, offline, reproducible tooling.

## Key Invariants

1. The in-repo tooling is the single authoritative source; the portable artifact is a derived build, never hand-edited.
2. The artifact runs on a bare Node.js runtime alone (plus git for the validator's append-only mode), needing no workspace install, transpiler, or package manager.
3. For identical input the artifact's atlas output is byte-identical, and its validator findings and exit codes match the in-repo tooling exactly.
4. The build folds every outside dependency in; nothing is resolved from an installed package tree at run time.
5. The committed artifact runs offline with no install step, executing only trusted, review-gated code.
6. A parity check is a required gate in the source repo: it diffs source against a fresh build over a representative corpus and fails, naming any mismatch in findings, exit codes, or atlas bytes.
7. A committed fingerprint catches a build left stale against its source, which an executed diff cannot, since both its sides are always current.

## Integration Points

- [distiller](distiller.md) — runs this tooling as its validator and atlas steps when draining from a hub.
- [workspace-resolution](workspace-resolution.md) — the resolved role decides whether the distiller runs this tooling or the in-repo tooling; this tooling's committed hub location is part of the workspace context the resolver produces.
- [nexus-setup-cli](nexus-setup-cli.md) — ships as a vendored entrypoint on this distributable, its component payload pinned by the same fingerprint gate.

## Decision Log

### 2026-07-14 — #44 — Compiled single source, vendored, guarded by a parity check

The portable tooling is a compiled build of the one in-repo source — not a reimplementation and not source run through the runtime's native type-stripping: a single source keeps parity structural at the logic level and maintenance single-headed, and a dependency-inlining build is the only packaging that both runs under a bare runtime today and can carry an outside dependency into an install-free hub later. It is vendored — committed into the hub — rather than published to a registry, so every hub clone is identical, offline, and reproducible. Because a committed build can silently lag its source, a parity check over a representative corpus is load-bearing, not documentation, with a committed fingerprint catching a build that was edited but not re-vendored. Refuted: running the source directly under native type-stripping — viable for these annotation-only checks and build-free, but version-gated and unable to inline the outside dependency the shared vehicle must carry later; and publishing to a registry — idiomatic, but it adds network and version-pinning to a docs repo and makes each hub non-reproducible.

### 2026-07-15 — #54 — A third portable tool: resolver-consuming hub diff derivation

The bundle grew a third tool that derives a hub entry's cross-repo diff, joining the validator and the atlas generator, and the bundled validator learned to check the derived anchor sidecars in their new per-repo shape. Unlike the two checks, this tool must consult the workspace resolver at run time to find where each member's code is checked out, so it is the first portable tool that carries a cross-library dependency into the install-free hub — the packaging always anticipated this. The considered alternative — leave hub diff derivation as command prose rather than a bundled tool — was rejected because resolving members to checkouts needs real workspace context, not a presence bit a markdown command can read, so it belongs in code that actually consults the resolver.

### 2026-07-16 — #60 — The setup CLI and a vendored component payload join the distributable

The `nexus` setup CLI ships on this same distributable, and it makes the distributable carry two things it did not before: an inlined package dependency (the manifest parser needs it) and a vendored copy of the live component tree as plain review-gated files, because a distributed CLI has no line of sight back to the source components. A committed payload can lag its source exactly like a compiled bundle, so it is covered by the same fingerprint gate — one `claude-components` pin beside the bundle hashes — rather than a separate discipline. Refuted alternatives: inlining the component tree as base64 blobs — self-contained too, but a blob diff is unreviewable, breaking the ship-only-reviewable-code posture; and a separate component-fingerprint pin — avoids touching the existing gate, but forks the pin discipline into two files.
