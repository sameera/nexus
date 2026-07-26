---
title: "Publishing Config Resolution"
aliases: ["github publishing config", "delivery config resolver", "classification mode", "project target", "issues-repo targeting", "publishing precedence chain"]
touches: ["workspace-resolution", "config-write-back", "epic-approval-gate", "nexus-setup-cli", "decision-record"]
last_updated_by: "#139"
status: active
verification: verified
---

# Publishing Config Resolution

Publishing config resolution replaces every discovered-by-failure GitHub-publishing decision with one declared configuration block, resolved by a single shared resolver every publishing consumer goes through. It decides how an issue is classified, which project it joins, and which repository it is filed into.

## How It Works

These decisions used to be discovered through live calls that could fail, and the config reader existed as two drifting copies. The logic is defined exactly once; the issue-creation scripts import it, the filing and close stages invoke it, and the epic resolver reads it across a process seam. One key map is the block's single schema, after declared keys were found readable but never populated — read and populate can no longer diverge. The record marker and design-gate labels resolve through the same chain, so classification never disagrees with filing.

Every key resolves most-specific-first: invocation argument, per-item frontmatter, repo settings, workspace-wide hub defaults, then a built-in guaranteeing a value.

Classification is an explicit issue-type mode, an explicit label mode, or the default legacy mode preserving the former discover-then-fall-back flow. The project target is deliberate absence, an explicit target, or discovery. Repo targeting resolves independently for the epic and the stories, falling back to a general issues repository, then the current repo.

## Key Invariants

1. The logic exists in exactly one place; no consumer re-derives config by parsing settings itself.
2. Given identical config and frontmatter, every consumer resolves any key to the same value.
3. Precedence is invocation argument, frontmatter, repo settings, hub defaults, built-in.
4. With no block declared, every consumer reaches the classification, project, and repository it reached before — with one exception.
5. That exception is the epic's fallback label, now epic-specific and upserted before use, so filing never strands on a missing label.
6. A deliberately-absent project target makes no lookup, no add call, no warning.
7. The specific epic and story repo targets win over the general one, the fallback for whichever is unspecified.

## Integration Points

- [workspace-resolution](workspace-resolution.md) — supplies the hub-defaults layer, inherited per key.
- [config-write-back](config-write-back.md) — the two producers that populate the block this resolver reads.
- [epic-approval-gate](epic-approval-gate.md) — files epics and stories into the repositories resolved here.
- [nexus-setup-cli](nexus-setup-cli.md) — exposes the hub defaults through a read-out seam.
- [decision-record](decision-record.md) — its record marker and gate labels are keys this resolver alone supplies.

## Decision Log

### 2026-07-24 — #121 — One shared resolver over declared config, not discovery-by-failure

Two forces landed together. The config reader existed as two verbatim copies, and both the settings-reader bug and the inconsistent repo targeting lived in that duplication — so the logic is defined exactly once and every consumer goes through it, which is also the only way the four-consumer equivalence guarantee can hold. Separately, discovering classification and project through live calls bakes in assumptions that are false on a personal repo (the original crash), so intent is declared and consulted instead. The legacy classification mode is mandatory rather than a convenience: a repo with no block must reproduce today's outcome, and today's outcome itself depends on discovery, so naming and preserving that flow is what makes the no-regression guarantee true. Refuted alternatives: keep a private copy of the reader in each script and fix them in lockstep — rejected because keeping two copies in sync by discipline is exactly what already failed here; and keep discovering but harden it against every failure — rejected because it cannot distinguish deliberate absence from not-found-yet, so it re-discovers forever and can never be reasoned about without a live service.

### 2026-07-26 — #139 — The record and design-gate markers resolve through the one key map

The decision-record marker and the two design-gate labels joined the declared block as ordinary keys, resolved through the same precedence chain with hub fall-through — and the block's key list collapsed into the one map the hub layer and the key-resolution seam already used, after the new keys were found readable by resolvers but never populated by the reader: a declared value silently lost to a built-in. With the map as the block's single schema, adding a key in one place is all a new key needs to be honoured end to end, so that defect class cannot recur. The epic resolver also became a consumer, across a process seam, so sub-issue classification reads the same answer the filing side applied. Refuted alternative: drop the dead reads and document the markers as built-ins only — it fixes the silent ignore but leaves a declared key doing nothing.
