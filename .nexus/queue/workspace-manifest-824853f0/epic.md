---
feature: "Multi-Repo Workspaces"
feature_path: docs/features/multi-repo-workspaces
epic: "Workspace Manifest & Resolution"
slug: workspace-manifest
created: 2026-07-10
type: enhancement
complexity: S
complexity_drivers: [new manifest and pointer schema, resolution from two starting points, single-repo backward compatibility]
concepts: [nexus-pipeline, committed-queue, distiller]
link: "#38"
---

# Epic: Workspace Manifest & Resolution

## Description

Nexus today assumes one repo plays every role at once: code repo, planning-queue host, and
knowledge store. Multi-repo products split those roles — code lives in member repos, knowledge
in a docs hub — and developers work in whichever repo their task lives in, not at a parent
folder. Before any pipeline stage can operate across that split, the workspace itself must be a
declared, discoverable thing: which repo is the hub, which repos are members, and where their
checkouts are expected to live.

This epic delivers that foundation. A single manifest in the hub declares the workspace. A small
pointer in each member repo locates the hub. Resolution behaves identically whether it starts
from the hub or from any member repo, reports exactly what is missing when it cannot resolve,
and falls back to today's single-repo behavior when no workspace is declared — existing
single-repo projects are untouched.

Every later multi-repo capability — close-entry migration, cross-repo distillation, Prime's
workspace state — consumes this resolution rather than re-deriving it. Getting it right once,
with sharp diagnostics, is what keeps the rest of the program frictionless for developers.

## Success Metrics

- **Resolution parity:** from the hub or from any member checkout, workspace resolution reports
  an identical workspace description (same hub, same member set, same checkout locations).
- **Diagnosability:** every resolution failure mode — malformed manifest, missing hub checkout,
  missing member checkout, undeclared member — produces an error naming the artifact and the
  expected state; no generic failure messages.
- **Zero regression:** a repo with no workspace signals runs every `nxs.*` command with behavior
  unchanged from today.
- **Setup cost:** adding a member repo to an existing workspace touches at most two files — the
  hub manifest and the new member's pointer.

## Personas

Per `docs/product/context.md`, with one epic-specific addition:

| Persona | Role in this epic |
|---|---|
| Delivery lead (epic-specific) | Declares and maintains the workspace manifest in the hub repo |

The canonical engineer persona appears here as the member-repo developer who must never need to
know the workspace's full shape to work in their own repo.

## User Stories

### Story 1: Declare the workspace in the hub

- **story_type:** user
- **size:** S

**As a** delivery lead, **I want** to declare the workspace — the hub and its member repos — in
one manifest inside the hub repo, **so that** every Nexus command discovers the workspace's
shape from a single authoritative place.

#### Acceptance Criteria

- [ ] **Given** a hub repo, **when** I author the workspace manifest listing each member repo's
      remote identity and expected checkout location, **then** workspace resolution recognizes
      the hub and every declared member.
- [ ] **Given** a manifest with a structural defect (missing required field, unknown key,
      duplicate member), **when** resolution reads it, **then** it fails with an error naming
      the file, the entry, and the defect — never a silently partial workspace.
- [ ] **Given** an existing workspace, **when** a new member repo is added, **then** the change
      touches only the hub manifest (plus the new member's own pointer, Story 2).

#### Notes

The manifest is committed in the hub repo — it is shared workspace truth, not per-engineer
configuration. Verified through the workspace status read-out (Story 4).

### Story 2: Find the hub from a member repo

- **story_type:** user
- **size:** S

**As an** engineer working in a single member repo, **I want** my repo to carry a pointer to the
hub, **so that** Nexus commands I run locally resolve the full workspace without me launching
from any special folder.

#### Acceptance Criteria

- [ ] **Given** a member repo with a hub pointer, **when** a Nexus command needs workspace
      context, **then** it locates the hub checkout and reads the manifest from there.
- [ ] **Given** a member repo whose pointer names a hub that is not checked out at the expected
      location, **when** resolution runs, **then** the error reports the hub's identity and the
      expected location, and the command does not guess.
- [ ] **Given** a member repo whose pointer and the hub manifest disagree (the member is not
      declared in the manifest), **when** resolution runs, **then** the mismatch is reported
      naming both sides.

#### Notes

Verified through the workspace status read-out (Story 4).

### Story 3: Deterministic resolution with actionable diagnostics

- **story_type:** system
- **size:** M

**As an** engineer, **I want** workspace resolution to behave identically from anywhere in the
workspace and to state exactly what is missing when it cannot resolve, **so that** setup
problems are self-diagnosable without tribal knowledge.

#### Acceptance Criteria

- [ ] **Given** a fully checked-out workspace, **when** resolution runs from the hub and from
      each member repo, **then** all runs yield the same workspace description (same hub, same
      member set, same checkout locations) — pass/fail.
- [ ] **Given** a declared member repo with no checkout at the expected location, **when**
      resolution runs, **then** the result names the missing repo, its remote identity, and the
      expected path — and distinguishes "missing checkout" from "not a workspace."
- [ ] **Given** a repo with neither a manifest nor a hub pointer, **when** any `nxs.*` command
      runs, **then** it operates in single-repo mode with behavior unchanged — verified by the
      existing test suite passing without modification (zero regression, pass/fail).

### Story 4: Workspace status read-out

- **story_type:** user
- **size:** S

**As an** engineer or delivery lead, **I want** an on-demand status read-out of the workspace,
**so that** I can verify a new or changed workspace before any downstream stage depends on it.

#### Acceptance Criteria

- [ ] **Given** a workspace, **when** I request the workspace status, **then** the read-out
      renders the resolved workspace description — the hub, each declared member, and each
      member's checkout state (found at its location, or missing).
- [ ] **Given** a repo that is not part of any workspace, **when** I request the workspace
      status, **then** the read-out states that no workspace is declared (single-repo mode),
      not an error.

#### Notes

This read-out is the epic's observable surface: it is also the verification vehicle for the
declaration stories (1 and 2) and the resolution contract (Story 3).

## Assumptions

- The sibling-checkout convention is the only supported layout in v1: the hub and all member
  checkouts sit under one parent folder. Per-engineer checkout-path overrides are deferred.
- The manifest is committed in the hub repo; the hub pointer is committed in each member repo.
- Workspace membership changes are infrequent, lead-authored edits; no manifest-generation
  tooling is needed in this epic.
- Git is the only version-control system in scope.

## Out of Scope

- Consuming workspace resolution in `/nxs.close` or `/nxs.distill` (the `close-entry-migration`
  and `distill-multi-repo` stubs).
- Prime's derived workspace state (the `workspace-state-provider` stub).
- Per-engineer checkout-path overrides for non-sibling layouts (re-triage via the feature
  backlog if the convention proves insufficient).
- Auto-cloning or fetching missing checkouts — resolution reports; it never mutates.

## Open Questions

## Implementation Sequence

| STORY | Issue | blocked_by |
|---|---|---|
| STORY-38.01 | #39 | none |
| STORY-38.02 | #40 | STORY-38.01 |
| STORY-38.03 | #41 | STORY-38.01, STORY-38.02 |
| STORY-38.04 | #42 | STORY-38.03 |
