---
title: "Publishing Config Resolution"
aliases: ["github publishing config", "delivery config resolver", "classification mode", "project target", "issues-repo targeting", "publishing precedence chain"]
touches: ["workspace-resolution", "config-write-back", "epic-approval-gate", "nexus-setup-cli"]
last_updated_by: "#121"
status: active
verification: verified
---

# Publishing Config Resolution

Publishing config resolution replaces every discovered-by-failure GitHub-publishing decision with one declared configuration block, resolved by a single shared resolver all four publishing consumers go through. It decides how an issue is classified, which project it joins, and which repository it is filed into. With no block declared, every consumer reaches the outcome it reached before.

## How It Works

These decisions used to be discovered through calls that could fail or return nothing — a path that crashed on a personal repo — and the config reader itself existed as two verbatim copies that drifted. The logic is now defined exactly once; both issue-creation scripts import it and the epic-filing and epic-close stages invoke it, so no consumer re-derives config itself.

Every key resolves most-specific-first: an invocation-time argument, then per-item frontmatter, then the repo's settings, then workspace-wide hub defaults, then a built-in guaranteeing a value exists.

Three decisions resolve this way. Classification is an explicit issue-type mode, an explicit label mode, or a named legacy mode preserving the former discover-then-fall-back flow — the default. The project target is deliberate absence, an explicit target, or discovery. Repo targeting resolves independently for the epic and the stories, each falling back to a general issues repository, then the current repo.

## Key Invariants

1. The logic exists in exactly one place; no consumer re-derives config by parsing settings itself.
2. Given identical config and frontmatter, all four consumers resolve any key to the same value.
3. Precedence is invocation argument, frontmatter, repo settings, hub defaults, built-in.
4. With no block declared, every consumer reaches the classification, project, and repository it reached before — with one exception.
5. That exception is the epic's fallback label, now epic-specific and upserted before use, so filing never strands on a missing label.
6. A deliberately-absent project target makes no lookup and no add call, and emits no warning.
7. The specific epic and story repo targets win over the general one, the fallback for whichever is unspecified.

## Integration Points

- [workspace-resolution](workspace-resolution.md) — supplies the hub-defaults layer, inherited per key rather than as a whole block.
- [config-write-back](config-write-back.md) — the two producers that populate the block this resolver reads.
- [epic-approval-gate](epic-approval-gate.md) — files the epic and story issues into the repositories resolved here.
- [nexus-setup-cli](nexus-setup-cli.md) — exposes the hub defaults through a read-out, the seam this resolver reads them across.

## Decision Log

### 2026-07-24 — #121 — One shared resolver over declared config, not discovery-by-failure

Two forces landed together. The config reader existed as two verbatim copies, and both the settings-reader bug and the inconsistent repo targeting lived in that duplication — so the logic is defined exactly once and every consumer goes through it, which is also the only way the four-consumer equivalence guarantee can hold. Separately, discovering classification and project through live calls bakes in assumptions that are false on a personal repo (the original crash), so intent is declared and consulted instead. The legacy classification mode is mandatory rather than a convenience: a repo with no block must reproduce today's outcome, and today's outcome itself depends on discovery, so naming and preserving that flow is what makes the no-regression guarantee true. Refuted alternatives: keep a private copy of the reader in each script and fix them in lockstep — rejected because keeping two copies in sync by discipline is exactly what already failed here; and keep discovering but harden it against every failure — rejected because it cannot distinguish deliberate absence from not-found-yet, so it re-discovers forever and can never be reasoned about without a live service.
