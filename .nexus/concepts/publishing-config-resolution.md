---
title: "Publishing Config Resolution"
aliases: ["github publishing config", "delivery config resolver", "classification mode", "project target", "issues-repo targeting", "publishing precedence chain"]
touches: ["workspace-resolution", "config-write-back", "epic-approval-gate", "nexus-setup-cli", "decision-record", "pr-worktree", "backlog-stub", "target-root-convention", "toolkit-location"]
last_updated_by: "#249"
status: active
verification: verified
---

# Publishing Config Resolution

Publishing config resolution replaces every discovered-by-failure GitHub-publishing decision with one declared configuration block, resolved by a single shared resolver every publishing consumer goes through. It decides how an issue is classified, which project it joins, and which repository it is filed into.

## How It Works

These decisions used to be discovered through live calls that could fail, and the config reader existed as two drifting copies. The logic is defined exactly once; the issue-creation scripts import it, the filing and close stages invoke it, and the epic resolver reads it across a process seam. The key map is the resolver's schema; a key a hub may default needs registering in the manifest allowlist too. The record marker and design-gate labels resolve through the same chain, so classification never disagrees with filing.

Every key resolves most-specific-first: invocation argument, per-item frontmatter, repo settings, workspace-wide hub defaults, then a built-in guaranteeing a value. The hub-defaults layer reaches the workspace read-out through the executable's name; it stays best-effort, discarding a failed run on its exit code rather than on output that happens not to parse.

Classification is an explicit issue-type mode, an explicit label mode, or the default legacy mode preserving the former discover-then-fall-back flow. The project target is deliberate absence, an explicit target, or discovery. Repo targeting resolves independently for the epic and the stories, falling back to a general issues repository, then the current repo.

## Key Invariants

1. The logic exists in exactly one place; no consumer re-derives config by parsing settings itself.
2. Given identical config and frontmatter, every consumer resolves any key to the same value.
3. Precedence is invocation argument, frontmatter, repo settings, hub defaults, built-in — and the hub-defaults layer finds the executable by name, consulting no location inside any repository, yielding nothing on every failure.
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
- [pr-worktree](pr-worktree.md) — its base is one more declared key.
- [backlog-stub](backlog-stub.md) — the unplanned label and the stub's epic classification are two more keys only this resolver supplies.
- [target-root-convention](target-root-convention.md) — the two issue-creation scripts that call this resolver now take their target repo through that convention and reject an out-of-root input artifact.
- [toolkit-location](toolkit-location.md) — supplies the by-name lookup this resolver's hub-defaults layer uses to reach the executable.

## Decision Log

### 2026-07-24 — #121 — One shared resolver over declared config, not discovery-by-failure

Two forces landed together. The config reader existed as two verbatim copies, and both the settings-reader bug and the inconsistent repo targeting lived in that duplication — so the logic is defined exactly once and every consumer goes through it, which is also the only way the four-consumer equivalence guarantee can hold. Separately, discovering classification and project through live calls bakes in assumptions that are false on a personal repo (the original crash), so intent is declared and consulted instead. The legacy classification mode is mandatory rather than a convenience: a repo with no block must reproduce today's outcome, and today's outcome itself depends on discovery, so naming and preserving that flow is what makes the no-regression guarantee true. Refuted alternatives: keep a private copy of the reader in each script and fix them in lockstep — rejected because keeping two copies in sync by discipline is exactly what already failed here; and keep discovering but harden it against every failure — rejected because it cannot distinguish deliberate absence from not-found-yet, so it re-discovers forever and can never be reasoned about without a live service.

### 2026-07-26 — #139 — The record and design-gate markers resolve through the one key map

The decision-record marker and the two design-gate labels joined the declared block as ordinary keys, resolved through the same precedence chain with hub fall-through — and the block's key list collapsed into the one map the hub layer and the key-resolution seam already used, after the new keys were found readable by resolvers but never populated by the reader: a declared value silently lost to a built-in. With the map as the block's single schema, adding a key in one place is all a new key needs to be honoured end to end, so that defect class cannot recur. The epic resolver also became a consumer, across a process seam, so sub-issue classification reads the same answer the filing side applied. Refuted alternative: drop the dead reads and document the markers as built-ins only — it fixes the silent ignore but leaves a declared key doing nothing.

### 2026-08-01 — #178 — A hub-defaultable key needs two registrations, and the block now carries a directory

Two facts landed with the worktree-base key. First, the block's scope widened: it now carries a local filesystem directory, not only publishing targets. That was chosen over a dedicated section for machine-local settings because membership here is what buys the precedence chain, the hub layer, the resolver interface, and the existing tests — all already built; a new section would have to rebuild each one for a single key. Second, this page's earlier claim that one key map is the block's single schema was too strong, and the drift it was meant to rule out is already live: the hub manifest validator carries an independent allowlist that rejects unlisted keys outright, and four record- and design-related keys sit in the resolver map but not in that allowlist, so a hub declaring any of them fails validation today. A key must therefore be registered in both surfaces or one of the two configuration paths fails silently; the new key was registered in both and pinned there by a test. Refuted alternative: fold the allowlist into the resolver map so the single-schema claim becomes true — the better end state, but it changes validation for every existing key and belongs in its own change; the four pre-existing gaps went to the backlog instead.

### 2026-08-06 — manual — Reciprocal link from backlog-stub

Mechanical reciprocity fan-out: the backlog-stub page names this resolver as the sole supplier of the unplanned label and of the epic classification the batch filing path stamps on a stub, neither of which is ever hard-coded by a writer. Declared by hand because both epics involved had already drained; the edge was dropped at distillation only because a reciprocal bullet did not fit under the pre-#220 body cap.

### 2026-08-25 — #248 — Reciprocal link from target-root-convention

Mechanical reciprocity fan-out: the target-root-convention page names this resolver's two issue-creation consumers as scripts that now take their target repo through that same convention and reject an input artifact resolving outside it.

### 2026-08-26 — #249 — The hub-defaults layer finds the executable by name, and discards a failed run on its exit code

The layer used to locate the executable by trying candidate files inside a repository — this checkout's own vendored copy, then a hop into a sibling directory named by a member's pointer — an arrangement that only works while every repository carries a committed copy of the toolkit. It now asks for the executable by name, which a hub and a member reach identically, so the sibling hop disappeared rather than being ported. The two properties this layer was bought with stayed intact and were pinned by tests that fail if either guard is removed: a checkout declaring no workspace artifact still spawns nothing at all, and every failure still yields no hub defaults rather than an exception reaching issue creation. One guard was strengthened in passing — a failed run is now discarded on its exit code, deliberately, because a verb that fails after printing a partial object would otherwise have contributed half a hub layer through output that merely happened to parse. Refuted alternative: keep the candidate-file search as a fallback behind the name — it would have preserved the very repository-relative addressing this change exists to remove.
