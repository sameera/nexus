---
feature: "Multi-Repo Workspaces"
feature_path: docs/features/multi-repo-workspaces
epic: "Planning Surfaces Follow the Docs Root"
slug: docs-root-planning-surfaces
created: 2026-07-18
type: enhancement
complexity: M
complexity_drivers:
  [
    "path literals across four command/agent surfaces replaced by one resolved producer",
    "feature_path frontmatter becomes a recorded resolved path consumed downstream",
    "end-to-end plan-to-close verification in the hub layout",
  ]
concepts: ["workspace-resolution"]
link: "#81"
---

# Epic: Planning Surfaces Follow the Docs Root

## Description

The Parameterized Docs Root epic makes the docs root a resolved property of workspace context and
routes the derived-artifact surfaces (atlas location and links, the drain, cross-ref URL building)
through it. The planning surfaces still bypass it: `/nxs.epic` creates feature containers,
backlog stubs, and nav indexes at literal `docs/features/…` paths; `/nxs.close` appends deferred
scope to `docs/features/<feature>/backlog.md` and writes lessons to `docs/delivery/lessons/`;
`/nxs.setup` scaffolds `docs/product/context.md` and `docs/system/…`; and the design-time readers
(`/nxs.hld`, the PM and architect agents) load product and system context from those same
literals. A hub with human docs at its root that plans its own docs epics therefore still gets a
`docs/` folder recreated by every planning run, even after the derived surfaces are fixed.

This epic routes the planning surfaces through the same resolved docs root. The taxonomy under the
root is unchanged — `features/`, `product/`, `system/`, and `delivery/` keep their names and
shapes; only the root they hang from moves with the resolved value. Writers record what they
resolved: the queue entry's `feature_path` carries the actual resolved container path, and
downstream consumers read that recorded value instead of re-deriving it. Single-repo projects and
multi-repo members resolve their docs root to `docs/`, so every path they see today is unchanged.

This epic depends on the Parameterized Docs Root epic: the resolver-produced docs root is the
value every story here consumes. It completes the follow-on scope that epic explicitly deferred.

## Success Metrics

- On a hub with human docs at its root, a full planning cycle (`/nxs.setup`, `/nxs.epic` through
  `/nxs.close`) creates zero files under a `docs/` directory — every artifact lands under the
  resolved root.
- On a single-repo project, every planning artifact path is unchanged from today.
- No planning command, skill, or agent reads or writes a feature, product, system, or delivery
  doc through a literal `docs/` prefix that bypasses the resolved docs root.

## Personas

Per `docs/product/context.md`. No epic-specific personas.

## User Stories

### Story 1: Epic planning writes land under the resolved docs root

- **story_type:** system
- **size:** M

**As a** hub maintainer planning docs epics, **I want** `/nxs.epic` to create its feature
artifacts under the resolved docs root, **so that** planning a hub epic doesn't recreate a
`docs/` folder the repo doesn't use.

#### Acceptance Criteria

- [ ] **Given** a hub whose resolved docs root is the repo root, **when** `/nxs.epic` resolves a
      new feature container, **then** the container, its `backlog.md`, and its nav `README.md` are
      created under `<root>/features/<slug>/` and no `docs/` directory is created.
- [ ] **Given** a repo whose resolved docs root is `docs/`, **when** `/nxs.epic` runs, **then**
      every artifact path is unchanged from the pre-change behavior.
- [ ] **Given** an epic is written to the queue, **when** its frontmatter is inspected, **then**
      `feature_path` records the actual resolved container path, not a fixed
      `docs/features/<slug>` literal.
- [ ] **Given** decomposition stubs exist in a hub-layout backlog, **when** `/nxs.epic <stub-slug>`
      promotes one, **then** the stub is found — the promotion glob searches backlogs under the
      resolved docs root.

### Story 2: Close-time writes follow the recorded feature path

- **story_type:** system
- **size:** S

**As a** hub maintainer closing an epic, **I want** `/nxs.close` to write deferred scope and
lessons under the resolved docs root, **so that** closing a hub epic leaves no stray `docs/`
artifacts.

#### Acceptance Criteria

- [ ] **Given** a queue entry whose `feature_path` records a resolved container path, **when**
      `/nxs.close` appends deferred scope, **then** it targets the backlog under that recorded
      path rather than re-deriving a `docs/features/…` literal.
- [ ] **Given** a hub whose resolved docs root is the repo root, **when** the process lesson is
      written, **then** it lands under `<root>/delivery/lessons/` and no `docs/` directory is
      created.
- [ ] **Given** a repo whose resolved docs root is `docs/`, **when** `/nxs.close` completes,
      **then** the backlog append and lesson paths are unchanged from the pre-change behavior.

### Story 3: Setup scaffolds under the resolved docs root

- **story_type:** system
- **size:** S

**As a** hub maintainer bootstrapping a project, **I want** `/nxs.setup` to scaffold the product,
system, and delivery docs under the resolved docs root, **so that** a fresh hub starts in its own
layout instead of a forced `docs/` tree.

#### Acceptance Criteria

- [ ] **Given** a hub whose resolved docs root is the repo root, **when** `/nxs.setup` completes,
      **then** the stack doc, standards directory, product context, and delivery scaffold exist
      under `<root>/system/…`, `<root>/product/…`, and `<root>/delivery/…`, with no `docs/`
      directory created.
- [ ] **Given** a single-repo project, **when** `/nxs.setup` completes, **then** every scaffolded
      path is unchanged from the pre-change behavior.
- [ ] **Given** the interactive interview (the `nxs-setup` skill) writes the product context,
      **when** it saves, **then** the file is written to `<docs-root>/product/context.md` under
      the resolved root.

### Story 4: Design-time readers resolve context docs through the docs root

- **story_type:** system
- **size:** S

**As a** hub maintainer running planning and design commands, **I want** `/nxs.epic`, `/nxs.hld`,
and the PM and architect agents to load product and system context from the resolved docs root,
**so that** calibration works in the hub layout instead of silently treating context as absent.

#### Acceptance Criteria

- [ ] **Given** a hub with a product context at `<root>/product/context.md`, **when** `/nxs.epic`
      or `/nxs.hld` runs, **then** the context is loaded from that path — not reported absent
      because a literal `docs/product/context.md` path missed it.
- [ ] **Given** a hub with system docs under `<root>/system/…`, **when** the architect agent
      performs its standards-conformance pass, **then** it reads them from the resolved location.
- [ ] **Given** a repo whose resolved docs root is `docs/`, **when** any of these readers run,
      **then** their lookup paths are unchanged from the pre-change behavior.
- [ ] **Given** the context docs are genuinely absent under the resolved root, **when** a reader
      runs, **then** today's graceful-absence behavior is preserved (reference-if-present, no hard
      failure).

## Assumptions

- The Parameterized Docs Root epic ships first; the resolver-produced docs root and its role-based
  defaults (hub → repo root, member/single-repo → `docs/`) are the value consumed here. The
  dependency is wired at the issue level when both epics are filed.
- How a markdown command obtains the resolved value (a resolver read-out call, a CLI surface on
  the vendored bundle, or equivalent) is a design decision for the decision record; the stories
  require only that every surface consumes the one resolved value.
- The doc taxonomy under the root (`features/`, `product/`, `system/`, `delivery/`) is stable;
  this epic moves the root, not the shape beneath it.

## Out of Scope

- The derived-artifact and link surfaces (atlas location and links, the drain's staged paths, the
  cross-ref strip rule) — delivered by the Parameterized Docs Root epic.
- Migrating any repo's already-committed docs layout; existing repos adopt the new paths only
  when they next run the planning commands, or via a consumer-side chore.
- Renaming or restructuring the taxonomy beneath the docs root.

## Open Questions

<!-- none -->

## Implementation Sequence

| STORY | Issue | blocked_by |
|---|---|---|
| STORY-81.01 | #82 | none |
| STORY-81.02 | #83 | STORY-81.01 |
| STORY-81.03 | #84 | STORY-81.01 |
| STORY-81.04 | #85 | STORY-81.01 |
