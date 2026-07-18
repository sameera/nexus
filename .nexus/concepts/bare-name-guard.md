---
title: "Bare-Name Guard"
aliases: ["bare-name security boundary", "workspace name validation", "path-traversal guard", "unsafe name diagnostic"]
touches: ["workspace-resolution"]
last_updated_by: "#74"
status: active
verification: verified
---

# Bare-Name Guard

The bare-name guard is the security boundary of workspace resolution: a name declared in a workspace artifact may only be a bare directory segment, and the hub's optional docs-root override may only be a non-escaping repo-relative path. Because the resolver joins a name onto the shared parent folder to locate a checkout, one carrying a path separator or a traversal token could redirect resolution to a location outside the workspace. The guard rejects an unsafe name or override with a named diagnostic before any join or write happens.

## How It Works

A workspace artifact names other checkouts by a single directory segment under the shared parent folder. The guard admits a name only if it is one segment: it rejects any name containing a path separator, and rejects the two traversal tokens that would climb out of the parent.

The same rule is enforced identically on both sides — the hub manifest's member names and a pointer's hub name — from one shared definition, so the guarantee cannot drift or be copy-pasted differently between them. The manifest and pointer are trusted committed configuration; the guard keeps a hand-authored or tampered name from turning that trust into a read outside the workspace.

The same shared definition also guards the hub's optional docs-root override: unlike a bare name it may be a multi-segment path or the repo root, so a companion rule permits those while still rejecting an absolute path or a traversal escape.

## Key Invariants

1. A name in a workspace artifact must be a single directory segment: no path separator, and not a lone traversal token.
2. The same rule is enforced identically on the manifest side and the pointer side, from one shared definition.
3. A name with embedded dots is allowed; only a name that is entirely a traversal token is rejected.
4. A rejected name produces a named diagnostic identifying the artifact and the entry, and resolution never follows it.
5. The hub's optional docs-root override is validated by a companion repo-relative-path rule from the same definition: a multi-segment path or the repo root is allowed, an absolute path or a traversal segment rejected.

## Integration Points

- [workspace-resolution](workspace-resolution.md) — resolution validates every manifest and pointer name through this guard before joining it onto the shared parent to locate a checkout, and validates the hub's docs-root override through the companion repo-relative-path rule.

## Decision Log

### 2026-07-12 — #38 — Enforce the bare-name boundary from one shared definition

The workspace design documented that a pointer or member name may only be a bare segment, but the guarantee has to be enforced, not merely stated: a name that climbs out of the parent would let a hand-authored or tampered artifact redirect resolution to an arbitrary location. The rule lives in one shared definition used by both the manifest and the pointer sides, because it applies identically to both and a copy-pasted check could drift between them. Refuted alternative: enforce the rule only within the manifest's own validation and reuse it from there — fewer moving parts, but it overloads the manifest with a generic path rule and reads as a weaker shared boundary than a dedicated one.

### 2026-07-18 — #74 — A companion repo-relative-path rule guards the docs-root override

The hub's optional docs-root override says where the hub keeps its human docs, so it can be a nested subdirectory or the repo root itself — shapes the bare-name rule forbids. Rather than loosen that rule or hand-roll a check at the manifest, a companion rule in the same shared definition validates the override as a safe repo-relative path: multi-segment paths and the repo-root token are allowed, an absolute path or any traversal segment is rejected, so neither the atlas write nor the doc-link strip that later consume the value can escape the repo. Keeping it beside the bare-name rule holds all workspace path-safety in one place. Refuted alternative: validate the override inline in the manifest parser with an ad-hoc check — fewer moving parts, but it scatters path-safety logic away from the guard that owns it, the same drift centralizing the bare-name rule was meant to avoid.
