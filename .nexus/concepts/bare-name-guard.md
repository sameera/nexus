---
title: "Bare-Name Guard"
aliases: ["bare-name security boundary", "workspace name validation", "path-traversal guard", "unsafe name diagnostic"]
touches: ["workspace-resolution"]
last_updated_by: "#38"
status: active
verification: verified
---

# Bare-Name Guard

The bare-name guard is the security boundary of workspace resolution: a hub or member name declared in a workspace artifact may only be a bare directory segment, never a path. Because the resolver joins such a name onto the shared parent folder to locate a checkout, a name carrying a path separator or a traversal token could redirect resolution to an arbitrary location outside the workspace. The guard rejects such a name with a named diagnostic before any join happens.

## How It Works

A workspace artifact names other checkouts by a single directory segment under the shared parent folder — a member's expected checkout, or the hub a pointer locates. The guard admits a name only if it is one segment: it rejects any name containing a path separator, and rejects the two traversal tokens that would climb out of the parent. A segment with dots merely embedded in it is fine; only a name that is entirely a traversal token is refused.

The same rule is enforced identically on both sides — the hub manifest's member names and a pointer's hub name — from one shared definition, so the guarantee cannot drift or be copy-pasted differently between them. A violation is a named diagnostic identifying the artifact and the offending entry, consistent with every other resolution failure. The manifest and pointer are otherwise trusted committed configuration, at the same trust level as existing delivery settings; the guard is what keeps a hand-authored or tampered name from turning that trust into a read outside the workspace.

## Key Invariants

1. A name in a workspace artifact must be a single directory segment: no path separator, and not a lone traversal token.
2. The same rule is enforced identically on the manifest side and the pointer side, from one shared definition.
3. A name with embedded dots is allowed; only a name that is entirely a traversal token is rejected.
4. A rejected name produces a named diagnostic identifying the artifact and the entry, and resolution never follows it.

## Integration Points

- [workspace-resolution](workspace-resolution.md) — resolution validates every manifest and pointer name through this guard before joining it onto the shared parent to locate a checkout.

## Decision Log

### 2026-07-12 — #38 — Enforce the bare-name boundary from one shared definition

The workspace design documented that a pointer or member name may only be a bare segment, but the guarantee has to be enforced, not merely stated: a name that climbs out of the parent would let a hand-authored or tampered artifact redirect resolution to an arbitrary location. The rule lives in one shared definition used by both the manifest and the pointer sides, because it applies identically to both and a copy-pasted check could drift between them. Refuted alternative: enforce the rule only within the manifest's own validation and reuse it from there — fewer moving parts, but it overloads the manifest with a generic path rule and reads as a weaker shared boundary than a dedicated one.
