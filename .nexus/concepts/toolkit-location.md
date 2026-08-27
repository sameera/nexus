---
title: "Toolkit Location"
aliases: ["by-name toolkit addressing", "second toolkit", "python toolkit", "self-locating entry point", "no repository-relative toolkit path", "toolkit found on the path"]
touches: ["verb-reachability", "publishing-config-resolution", "target-root-convention", "release-identity"]
last_updated_by: "#257"
status: active
verification: verified
---

# Toolkit Location

Nexus ships two toolkits, and every invocation names the one it wants rather than encoding where it lives. Each half locates the other by name too, so a lookup resolves against wherever the toolkit is installed — never against a copy sitting inside the repository being acted on.

## How It Works

One toolkit is the named executable; the other is a small set of capabilities deliberately held out of that collapse, because each depends only on its runtime's standard library — nothing to install, no resolver to supply — so they ship as plain files and stay a second toolkit. Being held out is not an exemption from the addressing rule: the second toolkit was given one name and a capability dispatcher of its own, so a caller names a toolkit and a capability and nothing else.

Locating a toolkit takes the same two steps in both directions. The installed name on the caller's path is consulted first, the ordinary case. Failing that, a caller may fall back to the entry point shipped beside its own source — which says where the toolkit is, never where the work is. A location derived from the repository being acted on is not a candidate at all. When neither resolves, the caller reports an absent toolkit and names the remedy, rather than a missing file inside the user's repository.

## Key Invariants

1. Every invocation names a toolkit and a capability; no caller encodes a path to a toolkit file, whatever the runtime.
2. A toolkit is found by its installed name first; the only fallback is the entry point beside the caller's own source, never a location inside the repository being acted on.
3. A toolkit that cannot be found is reported as an absent toolkit with the remedy named, never as a missing file in the user's repository.
4. A best-effort lookup over a located toolkit yields an empty answer on every failure mode, and a non-zero exit is inspected deliberately rather than left to unparseable output.
5. A checkout declaring nothing for such a lookup to read spawns no subprocess at all.
6. A capability finds its sibling files through its own packaging, never through a layout describing where it was once deployed.

## Integration Points

- [verb-reachability](verb-reachability.md) — that rule decides which capabilities become reachable names; this one decides how a named toolkit is then found at invocation time.
- [publishing-config-resolution](publishing-config-resolution.md) — its hub-defaults layer locates the executable by name here, keeping its degrade-to-empty and never-spawn guards intact.
- [target-root-convention](target-root-convention.md) — the complement: that convention says where a capability's project lives, this one says where its toolkit lives.
- [release-identity](release-identity.md) — applies this same self-locating rule to the release's version declaration, walking up from the reader's own position rather than assuming a layout.

## Decision Log

### 2026-08-26 — #249 — Two toolkits, each named, neither reaching into a repository for the other

The second toolkit was given one name and a dispatcher of its own rather than being rewritten into the first: every one of its imports is standard library, so a rewrite would have reduced the toolkit count without enabling anything the installation needed. Its home moved out of the deployed component tree, because that tree is where components are installed, not where toolkit code lives, and the payload ships the two halves separately. No compatibility shim was left behind at the old locations: a shim could only have reached the moved capabilities through a repository-relative hop, which is precisely the addressing this work exists to delete — so the invocation strings inside Nexus's own component bodies were knowingly left naming deleted files, an interval that closes when the name reaches an installed path. In the other direction the candidate-file search — this repository's copy, then a hop into a sibling directory — was replaced by resolution by name, since a hub and a member now reach the same install the same way. Refuted alternatives: keeping shims until the invocation rewrite lands; and a dedicated locator package, which would have bought nothing but build wiring over an export on the package both callers already depend on.

### 2026-08-26 — #251 — Reciprocal link from release-identity

The release's one version declaration is reached the same way a named toolkit is: by walking up from the reader's own file position, so no layout is written down. Recorded here as the reciprocal edge.

### 2026-08-27 — #257 — The last in-repository toolkit copy is deleted, closing the rule's exception

The addressing rule was stated before the thing it forbids had been removed: a repository could still hold its own copy of the toolkit, and component bodies still carried a second invocation naming that copy beside the one that actually runs. Both are now gone — no build step writes a toolkit into a target checkout, nothing exports such a location, and the parenthetical telling a reader where the in-repository copy sits was struck from every component body that carried it. The rule therefore stops being aspirational: a location inside the repository being acted on is not merely disfavoured, it no longer exists to fall back to. The placeholder standing for a toolkit's location was deliberately left undefined rather than given a value, because defining it means naming the install this work does not build, and a definition invented here would be wrong the moment the real one lands. Refuted alternative: define the placeholder now against the expected install path, which reads as finishing the job but writes down a layout nothing yet produces.
