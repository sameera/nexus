---
title: "Decision Record: Planning Surfaces Follow the Docs Root"
epic: "#81"
feature: "Multi-Repo Workspaces"
rating: M
concepts: ["workspace-resolution"]
date: 2026-07-18
---

# Decision Record: Planning Surfaces Follow the Docs Root

## Summary

This epic routes the four planning surfaces (`/nxs.epic`, `/nxs.close`, `/nxs.setup`, `/nxs.hld`
and its PM/architect sub-agents) through the docs root the workspace resolver already produces, so
a docs-only hub stops recreating a `docs/` folder it does not use. The value comes from a single
docs-root read-out backed by the resolver's one existing selector, reached through the same two
vehicles the workspace-status read-out already uses — an in-repo script where a Node toolchain
exists, a portable-CLI verb in a docs-only hub. The feature container path is resolved once at
plan time and recorded in `feature_path`; close reads that recorded value instead of resolving
again.

## Chosen Approach

Every planning command obtains the resolved docs root once, at the point it needs it, from a
dedicated single-value read-out that is a thin wrapper over the resolver's existing `localDocsRoot`
selector — the single producer. The command captures that one value and prefixes it onto the
unchanged taxonomy suffixes (`features/`, `product/`, `system/`, `delivery/`). Two kinds of path
are handled differently. A per-feature container path is resolved once when `/nxs.epic` creates
the feature and is recorded in the queue entry's `feature_path`, which `/nxs.close` later reads.
Workspace-level paths that have no recorded value — setup scaffolding, calibration/context reads,
the stub-promotion glob — are resolved fresh at the point of use through the same read-out.
Design-time sub-agents do not resolve for themselves: the invoking command resolves once and hands
them the resolved locations to read.

## Key Decisions

### A dedicated single-value docs-root read-out, backed by the existing resolver selector, reached through both vehicles

- **Decision:** Add one read-out that emits only the resolved repo-relative docs root, wrapping the
  resolver's existing `localDocsRoot` selector. Expose it through both vehicles the resolver is
  already reached by — the in-repo script (checkouts with a Node toolchain) and a new verb on the
  vendored portable CLI (`nexus.mjs`, for a docs-only hub with no toolchain). Each planning command
  invokes it once per run and captures the value into a path prefix.
- **Why:** `localDocsRoot` is already the single producer of this value and already returns a
  machine-readable single field — #74 deliberately added it as a dedicated selector separate from
  the full resolve-and-render path. A one-line read-out keeps the parse contract narrow and stable.
  The dual vehicle is not a new pattern: `/nxs.setup` Phase 0 already branches between the in-repo
  status script and `node <tools-dir>/nexus.mjs workspace status`, because a docs-only hub cannot
  run `tsx`, so the value must also be reachable from the portable bundle. Resolving once per run
  (not once per path) guarantees every path a command builds in that run is internally consistent.
- **Refuted alternative:** Extend the existing `workspace status` read-out to also emit the docs
  root as a parseable field, and have commands parse the value out of that output. Viable — it
  reuses an invocation the commands already make and adds no new surface. It lost because it turns
  the human-facing status render into a machine-parsed contract, coupling every planning command to
  that render's exact format, and it contradicts the separation #74 chose when it added
  `localDocsRoot` as a dedicated selector rather than parsing the full workspace description.
  (Each command re-deriving the docs root itself was not weighed as viable: workspace-resolution
  Invariant 3 forbids a second producer.)

### Resolve the feature container path once, record it, and read the recorded value downstream

- **Decision:** `/nxs.epic` resolves the feature container path when it creates the feature and
  writes the actual resolved path into the queue entry's `feature_path`. `/nxs.close` reads
  `feature_path` and targets the backlog under it, and derives the sibling `delivery/lessons/`
  location from that same recorded anchor. Close never re-resolves the docs root.
- **Why:** The recorded path pins close's writes to where the artifacts actually are. If close
  re-resolved and the resolved root had changed between plan and close — a docs-root override
  edited, or the entry relocated between checkouts of different roles by the close-entry migration —
  close would write under a different root than where `/nxs.epic` created the backlog. Reading the
  recorded value is immune to that drift and keeps one resolution event per feature. It is also
  backward-compatible: an in-flight entry created before this epic carries a plain
  `docs/features/<slug>` literal in `feature_path`, which close reads and uses correctly with no
  migration.
- **Refuted alternative:** Re-resolve the docs root at each stage and rebuild the container path in
  close. Viable — every command stays self-contained and depends on nothing recorded. It lost
  because it creates two sources of truth (the recorded path and a freshly resolved one) that
  disagree precisely in the override-changed and entry-migrated cases, landing the backlog append
  and the lesson under a different root than the artifacts they belong to.

### Workspace-level paths with no recorded value resolve fresh at the point of use

- **Decision:** Setup scaffolding, the stub-promotion glob (`<root>/features/*/backlog.md`), and the
  design-time context reads resolve the docs root fresh through the read-out; only the per-feature
  container path is recorded and threaded. For sub-agents, the invoking command (`/nxs.hld`,
  `/nxs.epic`) resolves once and hands the resolved context-doc locations into the agent brief,
  replacing the literal `docs/product/context.md` and `docs/system/...` paths the brief and the
  agent prompts name today.
- **Why:** These paths have no prior recorded value to read — setup is bootstrapping the tree, and
  the readers are locating workspace-level context, not a per-feature artifact. Threading the
  resolved locations into the agent brief keeps the single-resolution-per-run property and keeps the
  sub-agents free of the vehicle branch, so they never need to know whether they are in a code repo
  or a docs-only hub.

## Constraints & Invariants

1. **Single producer (workspace-resolution Invariant 3):** no planning command, skill, or agent
   re-derives the docs root; every surface obtains it from the one resolver selector via the
   read-out.
2. **Single-repo and member parity:** for any checkout whose resolved docs root is `docs`, every
   create, read, write, and glob path is byte-identical to today's `docs/...` literal — the read-out
   returns `docs` for these checkouts, so prefixing reproduces current behavior exactly. This is the
   "unchanged" acceptance criterion in all four stories.
3. **Taxonomy stability:** the change moves only the root; `features/`, `product/`, `system/`, and
   `delivery/` keep their names and nested shapes, and nothing beneath the root is renamed.
4. **Empty-prefix handling for a repo-root docs root:** a hub value is `.` (the repo root); commands
   must treat `.` as an empty prefix that hangs the taxonomy directly off the repo root, never
   creating a `.`-named segment or a `./`-prefixed path.
5. **Read-only resolution (workspace-resolution Invariant 4):** resolving the docs root never
   creates the docs root or any directory as a side effect; directory creation stays in each
   command's own explicit `mkdir`, after resolution.
6. **Recorded-path anchor:** `/nxs.epic` records the actual resolved container path in
   `feature_path`, and `/nxs.close` reads it and derives sibling paths from it; neither re-resolves
   for a path the other already fixed.
7. **Graceful absence for context readers:** when resolution succeeds but a specific context doc is
   genuinely absent under the resolved root, readers preserve today's reference-if-present behavior
   and do not hard-fail — the change moves where readers look, not whether absence is tolerated
   (Story 4 AC-4).
8. **Portable-CLI parity and fingerprint (portable-tooling):** the new docs-root verb on `nexus.mjs`
   is a compiled build of the one in-repo source, re-vendored with its fingerprint pin updated, so
   the docs-only-hub vehicle stays byte-parity with the in-repo vehicle.
9. **Local root, not the cross-ref URL:** this epic touches only the local filesystem docs root used
   to build create/read/write paths; it must not be conflated with the GitHub cross-ref URL surface
   (`nxs-abs-doc-path`), which #74 owns, and that skill's URL-vs-resolved-root agreement check stays
   as-is.

## Risks (BLOCKER / ADDRESS only)

- **ADDRESS — a resolution failure must not be swallowed as graceful absence.** The graceful-absence
  guarantee (Invariant 7) and a resolution failure look similar at the call site: both end with "no
  context doc found." If a command silently treats a resolution error — or a misconfigured docs-root
  override that resolves to the wrong place — as "context absent," it reintroduces the exact
  silent-absent-context bug Story 4 exists to kill, now masked. Mitigation: the read-out must
  distinguish the two outcomes — a resolution failure surfaces the resolver's named diagnostic and
  stops the command (never a silent fallback to a literal `docs/`), while reference-if-present
  applies only after a successful resolution where the specific doc is genuinely missing. The
  existing selector already returns a structured failure the read-out can surface; the design must
  not collapse it into an empty result.

No BLOCKER.

## Open Clarifications

None. The one design fork a reader might expect — whether these commands run in a docs-only hub
with no in-repo toolchain, forcing the portable-CLI vehicle — is already answered by the established
`/nxs.setup` Phase 0 dual-vehicle pattern, and migrating any already-committed docs layout is
explicitly out of scope.
