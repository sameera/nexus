---
feature: "Multi-Repo Workspaces"
feature_path: docs/features/multi-repo-workspaces
epic: "Portable Nexus Tooling"
slug: portable-nexus-tools
created: 2026-07-13
type: enhancement
complexity: M
complexity_drivers: [standalone-node-packaging-of-tsx-scripts, hub-vs-single-repo-invocation-resolution, parity-against-evolving-in-repo-source]
concepts: [distiller, concept-store, workspace-resolution]
link: "#44"
---

# Epic: Portable Nexus Tooling

## Description

In a multi-repo workspace the hub is a docs repo: it holds the concept store and drains the
committed queue with `/nxs.distill`. The hub is not a code project — it carries no node package,
no `node_modules`, no pnpm setup. But two of distillation's deterministic steps are today wired to
that missing toolchain: the concept validator and the atlas generator are TypeScript scripts run
through `tsx`, which only exists after a full workspace install. Run in a bare hub, those steps
cannot start, and distillation stalls at the gate that is supposed to block a failing concept page
from shipping.

This epic makes that deterministic tooling portable: it runs in the hub on a plain Node.js runtime,
with no workspace install and no `tsx`. The concept store the hub owns gets validated and its atlas
regenerated exactly as they are in a single code repo today — same findings, same output — so the
hub is a first-class place to distill from. Nothing about single-repo distillation changes.

The distributable this produces is also the foundation two later multi-repo epics build on
(`workspace-setup-cli` shares it; `distill-multi-repo` depends on it), so the packaging vehicle is
designed to grow — to carry additional deterministic tools later, including ones with real npm
dependencies — even though this epic only ships the validator and the atlas generator through it.

## Success Metrics

- Distilling in a hub repo that carries no node project completes its deterministic steps — atlas
  regeneration, atlas sync-check, and concept validation — with zero manual toolchain setup (no
  `pnpm`/`npm install`, no `tsx`).
- Across the concept corpus, the packaged tooling and the in-repo scripts produce identical
  validator findings and byte-identical atlas output — zero diffs — and any divergence fails an
  automated check.
- Single-repo distillation is unchanged: the existing invocation still runs the deterministic steps
  and passes, with no regression.

## Personas

Per `docs/product/context.md`. The primary engineer persona runs the full pipeline — including
`/nxs.distill` — and in a multi-repo product runs it from the hub docs repo.

## User Stories

### Story 1: Portable tooling distributable

- **story_type:** system
- **size:** M

**As a** Nexus maintainer, **I want** the distill-time deterministic tooling (concept validator and
atlas generator) built into a self-contained distributable that runs on a bare Node.js runtime,
**so that** it can execute where no workspace toolchain is installed.

#### Acceptance Criteria

- [ ] **Given** only the distributable present on a machine with a Node.js runtime and **no**
  workspace install (no `node_modules`, no `tsx`, no `pnpm`, no monorepo checkout), **when** the
  atlas generator entry point is run against a concepts directory, **then** it exits 0 and writes
  atlas output identical to the in-repo generator for the same input.
- [ ] **Given** the same bare-runtime conditions plus the `git` CLI, **when** the validator entry
  point is run over a concepts directory (including its `--base` append-only mode), **then** it
  reports the same findings and returns the same exit code (0 clean / non-zero on findings) as the
  in-repo validator for the same input.
- [ ] **Given** the distributable, **when** its runtime footprint is inspected, **then** it requires
  only a Node.js runtime (and `git` for the validator's `--base` mode) — it does not require the
  monorepo dev toolchain (`tsx`, `typescript`, `nx`) or a pnpm workspace to run.

#### Notes

The two in-repo scripts depend only on node builtins today, so the transpile-to-runnable step is the
core work, not a dependency rewrite. The packaging mechanism must still be able to bundle non-builtin
npm dependencies, because later tooling that shares this distributable (the workspace resolver) needs
the `yaml` package — but shipping that resolver is out of scope here (see Out of Scope). Language and
distribution mechanism (precompiled bundle, vendored artifact, install command) are HLD decisions;
this story fixes only the runtime contract.

### Story 2: Hub invocation path

- **story_type:** user
- **size:** M

**As an** engineer distilling from a multi-repo hub, **I want** `/nxs.distill`'s deterministic steps
to run the packaged tooling in the hub, **so that** I can distill in a docs-only hub without turning
it into a node project.

#### Acceptance Criteria

- [ ] **Given** a hub repo that has a concept store but no `package.json`, `node_modules`, or pnpm
  setup, **when** the distill deterministic steps run (atlas regeneration, atlas sync-check, and
  concept validation), **then** they invoke the packaged tooling and complete successfully, with no
  workspace install step required.
- [ ] **Given** the packaged tooling is not yet present in the hub, **when** the documented one-time
  hub install/placement step is performed, **then** the tooling becomes invokable from the hub and
  the distill steps above succeed.
- [ ] **Given** a single code repo with the workspace toolchain (no hub), **when** the same distill
  deterministic steps run, **then** behavior is unchanged from today — the steps still run and pass,
  and no hub-only assumption breaks the single-repo path.

#### Notes

Whether distill resolves one invocation that works in both contexts or branches on workspace
resolution is an HLD decision; the AC only fixes that both the hub and the single-repo paths work and
that single-repo is not regressed. Consumes [workspace-resolution](../../concepts/workspace-resolution.md)
to know it is in a hub.

### Story 3: Parity guarantee against the in-repo source

- **story_type:** system
- **size:** S

**As a** Nexus maintainer, **I want** an automated check that the packaged tooling and the in-repo
scripts produce identical results, **so that** the hub never validates or generates differently from
a code repo and drift is caught before it ships.

#### Acceptance Criteria

- [ ] **Given** a representative concept corpus (valid pages plus fixtures that trigger validator
  findings and non-trivial atlas clustering), **when** both the packaged tooling and the in-repo
  scripts run over it, **then** the validator findings match exactly and the atlas output is
  byte-identical.
- [ ] **Given** the packaged tooling's behavior is made to diverge from the in-repo source, **when**
  the parity check runs, **then** it fails and names the divergence — so the guarantee is enforced,
  not documented.

#### Notes

If HLD chooses a single source compiled two ways, parity holds structurally and this check is a cheap
guard; if it chooses a separate artifact, the check is load-bearing. The AC is written to hold under
either approach.

## Assumptions

- The hub machine has a Node.js runtime available — the engineer already runs Prime and the Nexus
  toolchain on it. "No local node tooling of its own" means the hub **repo** carries no node project
  (no `package.json`, `node_modules`, pnpm, or `tsx`), not that the machine lacks a `node` binary.
- The hub is a git repository (it holds the committed queue and concept store), so the `git` CLI the
  validator's `--base` append-only check shells out to is present.
- The in-repo scripts remain the authoritative source. Portability tracks that source rather than
  forking a second implementation, which is what makes the parity guarantee meaningful.
- The distributable is the shared vehicle later multi-repo tooling joins, so its packaging mechanism
  must be able to carry bundled npm dependencies even though the validator and atlas generator need
  none today.

## Out of Scope

- The workspace resolver and its status read-out (`@nexus/workspace`, the `nxs-workspace-status`
  skill) and its `yaml` npm dependency — the heavy portability case, claimed by `workspace-setup-cli`
  and consumed by `distill-multi-repo`. This epic only ensures the distributable *can* host it later;
  packaging it is deferred to those epics.
- The GitHub-issue scripts (`nxs_gh_create_epic.py`, `create_gh_issues.py`) — already node-free
  (python stdlib) and run in code repos, not the hub. No portability gap.
- The absolute-doc-path helper (`get_abs_doc_path.ts`) — runs in member code repos, which have the
  node toolchain; it does not run in the bare hub.
- The reciprocity fan-out and code-anchor refresh — these are model-driven prose steps in
  `/nxs.distill`, not scripts, so there is nothing to package.
- Reimplementing the tooling in another language, and publishing to a public package registry —
  neither is required by the runtime contract; both are HLD's call if chosen at all.

## Open Questions

## Implementation Sequence

| STORY | Issue | blocked_by |
|---|---|---|
| STORY-44.01 | #45 | none |
| STORY-44.02 | #46 | STORY-44.01 |
| STORY-44.03 | #47 | STORY-44.01 |
