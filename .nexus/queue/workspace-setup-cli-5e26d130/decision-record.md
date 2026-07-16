---
title: "Decision Record: Nexus Setup CLI"
epic: #60
feature: "Multi-Repo Workspaces"
rating: M
concepts: [workspace-resolution, portable-tooling]
date: 2026-07-16
---

# Decision Record: Nexus Setup CLI

## Summary

The Nexus Setup CLI is a single portable `nexus` entrypoint that owns the *structural* half of
getting Nexus into a repo or a whole multi-repo workspace, leaving all judgment to `/nxs.setup`. Its
load-bearing foundation is one idempotent component-deploy primitive that both `nexus deploy` (single
repo) and `nexus workspace init` (fan-out) drive; on top of it sit a manifest/pointer writer that
emits exactly the shape the existing workspace resolver reads, a read-only status verb that reuses
the resolver's own read-out, and a two-file `add-repo` mutation.

## Chosen Approach

Ship the `nexus` CLI as a vendored artifact on the same portable distributable already built for the
concept validator and atlas generator: a single-source-bundled Node entrypoint plus a vendored copy
of the live `.claude/` component tree carried beside it as plain, review-gated files. The CLI is a
thin *writer/orchestrator* over two capabilities it must not duplicate — the workspace resolver (the
single authority on workspace shape, the remote-identity collision rule, and the status render) and
the deploy primitive (the sole `.claude/` installer). Every workspace-writing verb closes the loop by
re-resolving its own output before declaring success, so "the resolver accepts it with zero edits" is
enforced structurally rather than asserted.

## Key Decisions

### The component-deploy primitive is a file-tree mirror over an explicit Nexus-managed set, not a blind directory copy

- **Decision:** The primitive owns a declared set of Nexus components — the slash commands, agents,
  and skills the retired `nxs.update.claude.sh` installed — and mirrors exactly that set into the
  target, overwriting managed files in place so a second run with no upstream change converges to an
  identical component set. It leaves user-owned local files it does not manage — notably the
  per-repo local settings file — untouched. Idempotency comes from "make the destination match the
  managed set," not from timestamp or diff comparisons.
- **Why:** Overwrite-to-match is the simplest mechanism that satisfies the idempotent-refresh
  criterion and gives predictable semantics; an explicit managed set is what makes "don't clobber the
  user's local settings" enforceable.
- **Refuted alternative:** Merge/patch semantics that try to preserve local edits inside managed
  component files — viable, but it makes refresh nondeterministic, reintroduces the OS-specific
  fragility the shell script had, and no acceptance criterion asks for it.

### The authoritative component source is the live root component tree; the archival snapshot is out of scope

- **Decision:** The single source of truth the primitive vendors and installs is the live root
  `.claude/` tree. The second, older component tree carried under the historical archive library is a
  stale snapshot — not the deploy source — and its retirement or reconciliation is tracked separately,
  not folded into this epic.
- **Why:** The repo carries two `.claude/` trees; pinning the deploy primitive requires naming one
  authoritative set, and the live, actively maintained tree is the only one that reflects the current
  component surface (confirmed with the team lead at the design gate).
- **Refuted alternative:** Treat the archival snapshot as canonical, or reconcile both into one set
  first — viable in principle, but the snapshot is stale and reconciliation is separable scope that
  would push Story 1 past S for no delivery benefit.

### The component set is vendored into the distributable, not read from a source-checkout-relative path

- **Decision:** Because the CLI must bootstrap a repo *before* that repo is scaffolded and runs from a
  distributed bundle with no Nexus source tree nearby, the components it installs travel *inside* the
  distributable as a vendored file tree alongside the bundled entrypoint — the same committed,
  offline, reproducible, review-gated posture as the portable tools.
- **Why:** A distributed CLI has no line of sight back to the Nexus repo's live components; the
  payload must be self-contained.
- **Refuted alternative:** Encode the tree as inlined base64/JSON blobs inside the bundle —
  self-contained too, but it violates the portable-tooling posture that shipped code stays reviewable
  (a blob diff is unreadable) and bloats the entrypoint. Plain vendored files keep each component
  review-gated.

### The CLI ships through the existing single-source bundling machinery, extended with a new entrypoint — not a second build system

- **Decision:** The CLI entrypoint is bundled exactly as the validator, atlas, and diff tools are
  (bundled for the Node platform, dependencies inlined, byte-stable), and gated by the same
  parity/fingerprint discipline so a stale build cannot ship.
- **Why:** One packaging vehicle already proven on a bare runtime; reusing it means the CLI inherits
  install-free portability for free and keeps maintenance single-headed.
- **Refuted alternative:** A separately-packaged standalone Node CLI with its own bin and dependency
  handling — idiomatic for a standalone tool, but it forks the distribution story, needs its own
  bare-runtime proof, and duplicates the fingerprint-guard machinery that already exists.

### The manifest/pointer writer reuses the resolver as its acceptance oracle; it never re-declares workspace shape

- **Decision:** The writer takes the schema surface — artifact locations, field names, the bare-name
  and remote-normalization rules — from the resolver library and, after emitting, re-runs resolution
  against what it wrote, failing the verb unless resolution yields clean, identical parity from both
  the hub and every member. Collision detection (a member sharing a remote with the hub or another
  member) is delegated to the resolver's existing remote-identity rule, not re-implemented in the CLI.
- **Why:** This is the mechanism that makes the "zero follow-up edits / resolver parity" success
  metric structural rather than hopeful, and it keeps the resolver the single authority on shape.
- **Refuted alternative:** The CLI carries its own manifest schema and serializer and trusts them —
  faster to write, but it creates a second definition of workspace shape that will drift from the
  resolver, exactly what the epic forbids.

### `init` lists discovered siblings for the user to designate hub and members; it never proposes a hub

- **Decision:** Sibling discovery enumerates candidate checkouts under the shared parent and presents
  them; the human designates hub and members before anything is written. Nothing is written until the
  designation is confirmed, and a repo already carrying a manifest or pointer is reported and left
  unchanged absent explicit confirmation.
- **Why:** Auto-proposing a hub is explicitly out of scope — it fights the workspace model's
  deliberate "no manifest-generation tooling" posture and pushes Story 2 past M; "discover, human
  designates" is the minimum that removes hand-editing without adding inference.
- **Refuted alternative:** Heuristic hub proposal (e.g. the checkout that already has a manifest, or
  the first alphabetically) — a genuine convenience, but the epic defers it, and a wrong silent guess
  is the failure mode the separate hub-pointer artifact exists to prevent.

### `add-repo` performs a structured, minimal mutation of precisely two files

- **Decision:** It reads the existing hub manifest, appends a single member entry preserving every
  existing entry, and writes the new member's pointer — touching no third file in any repo. It reuses
  the resolver's collision rule to reject a colliding name or remote before writing, and its success
  is observable by the status verb showing the new member present.
- **Why:** The two-file invariant is a headline success metric and the reason membership (manifest)
  and location (pointer) are split; a structured edit that preserves existing manifest content keeps
  the change a minimal, reviewable diff.
- **Refuted alternative:** Regenerate the manifest wholesale from resolved state on every add —
  simpler code, but it risks reordering or reformatting existing entries (a noisy diff) and invites
  rewriting fields the user hand-tuned, undermining "no other file changes" in spirit.

### `status` and Story 5's role detection are the same resolver call, differing only in what they do with the result

- **Decision:** The portable `status` verb runs the resolver and its status renderer directly — the
  identical code the in-repo status skill already runs — so its output is identical by construction,
  portable because it is bundled, and read-only because the resolver is. Story 5 re-scopes `/nxs.setup`
  to call that same resolver to detect its role (hub, member, or single-repo) and branch: it issues no
  placement prompt and writes no manifest or pointer, running only the per-repo judgment interview.
- **Why:** The resolver is already the sole observable surface over workspace state; reusing it is the
  only way to guarantee the "matches the existing read-out exactly" criterion and to keep the
  CLI-owns-structure / setup-owns-judgment seam clean.
- **Refuted alternative:** A fresh CLI-side status renderer, or `/nxs.setup` sniffing for artifact
  files itself — both re-derive workspace shape outside the one resolver and risk divergent output.

## Constraints & Invariants

1. **Resolver parity (writer):** every workspace-writing verb (`init`, `add-repo`) must re-resolve its
   own output and confirm that hub-and-member resolution yield the identical description before
   reporting success; a verb that cannot achieve clean parity must write nothing.
2. **Single authority on shape:** the CLI takes the manifest/pointer schema, bare-name, and
   remote-identity rules from the resolver and never defines a second copy of workspace shape or
   collision logic.
3. **Exactly-two-files add-repo:** `add-repo` mutates only the hub manifest and the new member's
   pointer; existing manifest entries are preserved and no file in any other repo changes.
4. **Single-repo writes nothing:** the `deploy` path and single-repo `/nxs.setup` never create or
   modify a manifest or pointer; workspace artifacts appear only through `init`/`add-repo`.
5. **Idempotent deploy:** re-running `deploy` (or `init`'s per-repo deploy) with no upstream change
   converges the target's managed component set to an identical state and leaves user-owned files
   (e.g. the per-repo local settings file) untouched.
6. **Read-only status:** `status` performs no clone, fetch, or mutation; a missing member checkout is
   reported as state, and only a missing hub, an undeclared member, or a malformed manifest is a hard
   failure — inherited directly from the resolver.
7. **Bare-runtime portability:** every verb runs to completion on a checkout with no in-repo Node
   tooling and no install/build step, shipping as a fingerprint-guarded vendored artifact on the
   portable distributable, its component payload carried as review-gated plain files.
8. **Structure/judgment seam:** the CLI writes structure and components only; `/nxs.setup` writes only
   per-repo judgment artifacts (stack docs, standards, product context) and detects role through the
   resolver rather than any placement prompt.
9. **Retire the legacy path:** the distribution ships without `nxs.update.claude.sh`; `nexus deploy`
   is the sole Claude-component install path (non-Claude agents out of scope).

## Risks (BLOCKER / ADDRESS only)

- **ADDRESS — the vendored component payload can silently drift from the live source tree:** the
  distributable carries a copy of `.claude/`, so the same stale-build hazard the portable-tools
  fingerprint guard exists to catch applies here. Mitigation: extend the existing parity/fingerprint
  gate to cover the vendored component payload, so a distributable whose components lag their source
  fails the source-repo gate rather than deploying stale components.
- **ADDRESS — `deploy` overwriting managed component files can destroy user modifications:** because
  the primitive mirrors managed files, a user who hand-edited a shipped component loses that edit on
  refresh. Mitigation: keep the managed set defined narrowly enough that the only files overwritten
  are ones users are not expected to edit, with user extension points (like the per-repo local
  settings file) living outside the managed set; if shipped components are meant to be customized, that
  expectation reopens the mirror-vs-merge decision above.

## Open Clarifications

None. The one design question raised — which of the two component trees is the authoritative deploy
source — was resolved at the design gate: the live root `.claude/` tree is authoritative; the archival
snapshot is out of scope (see Key Decisions).
