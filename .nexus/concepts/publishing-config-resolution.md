---
title: "Publishing Config Resolution"
aliases: ["github publishing config", "delivery config resolver", "classification mode", "project target", "issues-repo targeting", "publishing precedence chain"]
touches: ["workspace-resolution", "config-write-back", "epic-approval-gate", "nexus-setup-cli", "decision-record", "pr-worktree", "backlog-stub", "target-root-convention", "toolkit-location", "settings-key-catalogue", "resumable-batch-filing", "epic-issue-filing"]
last_updated_by: "#352"
status: active
verification: verified
---

# Publishing Config Resolution

Publishing config resolution replaces every discovered-by-failure GitHub-publishing decision with one declared configuration block, resolved by a single shared resolver every publishing consumer goes through. It decides how an issue is classified, which project it joins, and which repository it is filed into.

## How It Works

These decisions used to be discovered through live calls that could fail, and the config reader existed as two drifting copies. The logic is defined exactly once; the issue-creation scripts import it, the filing and close stages invoke it, and the toolkit's own libraries now import it rather than spawning it, retiring the entry-point lookup that seam needed. Its keys are declared in one catalogue; a key a hub may default needs registering in the manifest allowlist too. The record marker and design-gate labels resolve through the same chain, so classification never disagrees with filing.

Every key resolves most-specific-first: invocation argument, per-item frontmatter, repo settings, workspace-wide hub defaults, then a built-in guaranteeing a value. The hub layer reads the resolved workspace as a value, guarded on the checkout declaring one so a single-repo checkout spawns nothing; it stays best-effort, an unresolvable workspace contributing nothing while resolution completes with the exit code it would have had.

Classification is an explicit issue-type mode, an explicit label mode, or the default legacy mode preserving the former discover-then-fall-back flow. The project target is deliberate absence, an explicit target, or discovery. Repo targeting resolves independently for the epic and the stories, falling back to a general issues repository, then the current repo.

## Key Invariants

1. The logic exists in exactly one place; no consumer re-derives config by parsing settings itself.
2. Given identical config and frontmatter, every consumer resolves any key to the same value.
3. Precedence is invocation argument, frontmatter, repo settings, hub defaults, built-in — and the hub layer applies only where the checkout declares a workspace, never parses its manifest, and yields nothing on every failure.
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
- [toolkit-location](toolkit-location.md) — the by-name rule still governing how bodies and stages address this resolver's toolkit, now that its own callers reach it in process.
- [settings-key-catalogue](settings-key-catalogue.md) — which keys exist and what each falls back to, declared once; split out from here, which keeps what a key resolves to.
- [resumable-batch-filing](resumable-batch-filing.md) — the batch path resolving every key here before its first issue, its own sources checked for holding no second copy.
- [epic-issue-filing](epic-issue-filing.md) — the single-issue filing path resolving classification, project target and repository through this same resolver.

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

### 2026-08-28 — #351 — The hub layer stops being a spawn, and callers reach the resolver in process

The resolver moved onto the runtime its callers are written in, so the two libraries that used to locate and spawn it now import it, and the hub layer reads the resolved workspace as a value instead of obtaining it as text from another process. That deletes a spawn from every key resolution and removes the degradation surface that existed only to describe an inter-process channel; the layer stays guarded on the checkout declaring a workspace, so a single-repo checkout still pays nothing. One behaviour delta was ratified at the design gate: hub defaults that vanished silently when the executable was off the path now apply. The source-side entry-point locator was retired rather than repointed, because a library in the same workspace raises no question of how a checkout with nothing installed runs an entry point. The key catalogue was split out to [settings-key-catalogue](settings-key-catalogue.md), which this page had no room to absorb. **Refuted alternative:** keep spawning the defaults verb, preserving today's behaviour to the letter including the silent vanishing — refused because it left one bundle spawning another to read a local file several times per stage.

### 2026-08-29 — #353 — The one-place rule is checked against a consumer's sources, not left to review

This page's first invariant has always said the resolver is defined exactly once, but nothing enforced it at the consumer: a capability could quietly grow its own reader for classification, project targets, labels or the settings write-back, agree with the shared answer on the day it was written, and drift silently afterwards. Porting the batch issue filer onto this runtime added a structural check over that consumer's own sources — it defines nothing equivalent to a shared capability, and each shared capability it uses is reached from the one place that defines it. The invariant is unchanged; what changed is that it is now held mechanically at one consumer rather than by review. Checking structurally rather than behaviourally is the load-bearing part: a private re-implementation that happens to agree today is invisible to a behavioural assertion, and agreeing on the day of writing is exactly what the duplicated reader this rule exists to prevent also did. **Refuted alternative:** assert only that the consumer's resolved values match the shared resolver's, and leave the no-second-copy rule to review — cheaper and free of any reading of source text, but it passes for precisely the drifting copy the invariant is aimed at.

### 2026-08-30 — #352 — Reciprocal link from epic-issue-filing

Mechanical reciprocity fan-out: the epic-issue-filing page names this resolver as the source of the classification, project target and repository it files into, holding the structural one-place check the previous entry describes over its own sources as well.
