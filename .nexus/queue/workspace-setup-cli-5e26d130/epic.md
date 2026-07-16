---
feature: "Multi-Repo Workspaces"
feature_path: docs/features/multi-repo-workspaces
epic: "Nexus Setup CLI"
slug: workspace-setup-cli
created: 2026-07-16
type: enhancement
complexity: M
complexity_drivers:
  [
    "new portable CLI surface (nexus deploy + nexus workspace verbs) on a bare Node runtime with no in-repo toolchain",
    "a single component-deploy primitive underlies both single-repo deploy and multi-repo init; retiring the nxs.update.claude.sh script hangs off it",
    "five stories behind one shared entrypoint; init and add-repo reuse the deploy primitive and the manifest/pointer writer",
  ]
concepts: [workspace-resolution, portable-tooling]
link: "#60"
---

# Epic: Nexus Setup CLI

## Description

Getting Nexus into a repo — single or multi — is structural work that happens *before* a Claude
session has anything to run. Today it is a manual shell step (`nxs.update.claude.sh`), and for a
multi-repo product there is a further act no single-repo command can perform: deciding which
checkout is the hub and which are members, authoring the hub manifest, stamping each member's hub
pointer, and distributing `.claude/` across sibling checkouts. A command confined to one repo's cwd
has no vantage point from which to do that.

This epic gives the structural half a single home: a deterministic, portable `nexus` CLI. Its
foundation is one **component-deploy primitive** — copy the Nexus components (slash commands, agents,
skills, the rest of `.claude/`) into a repo — exposed directly as `nexus deploy` for the single-repo
case and reused by `nexus workspace init` to fan out across every checkout. On top of that primitive
the CLI **declares** a workspace, **adds** a member later, and **reports** status. It runs on a bare
Node runtime with no in-repo tooling installed — it ships on the portable distributable already built
for the concept validator and atlas generator ([portable-tooling](portable-tooling.md), epic \#44) —
so it can bootstrap a repo *before* that repo is scaffolded. The manual `nxs.update.claude.sh` script
is retired; `nexus deploy` replaces it.

Everything the CLI writes for a workspace is exactly what the one deterministic resolver
([workspace-resolution](workspace-resolution.md), epic \#38) already reads; the CLI is the *writer*
for the manifest and pointer artifacts the resolver owns on the read side, never a second definition
of workspace shape.

This draws a clean seam through Nexus setup: **the CLI owns structure and deployment** — getting
components in place, whether into one repo or a whole workspace — and **`/nxs.setup` owns judgment** —
stack docs, standards, the product-context interview, run inside each repo once its components are
present. `/nxs.setup` is re-scoped accordingly: it detects an existing hub pointer or manifest through
the resolver and skips any placement prompt. Single-repo projects stay simple — `nexus deploy` then
`/nxs.setup`, with no manifest or pointer ever written.

Scope note: this epic covers the **Claude** agent surface only. Support for other agents (e.g. Gemini)
is out of scope, and their update scripts are not addressed here.

## Success Metrics

- Getting Nexus into a fresh single repo is one `nexus deploy` invocation (replacing the removed
  `nxs.update.claude.sh` step), after which `/nxs.setup` runs — the legacy Claude update script no
  longer exists in the distribution.
- Declaring a new N-repo workspace (one hub + N−1 members) is a **single** `nexus workspace init`
  invocation whose output the existing workspace resolver accepts with **zero** follow-up edits —
  resolution from the hub and from every member yields the identical workspace description (the
  resolver parity guarantee).
- Adding one member to an existing workspace mutates **exactly two files**: the hub manifest and the
  new member's pointer — no third file in any repo changes.
- Every CLI verb runs to completion on a checkout with **no in-repo Node tooling installed** (bare
  runtime, no `install` step).
- After the CLI has placed a repo, a `/nxs.setup` run in that repo issues **no** hub/member placement
  prompt and creates or modifies **no** manifest or pointer file.

## Personas

Per `docs/product/context.md`, with one addition specific to this epic:

- **Team lead standing up a Nexus product** — deploys the components into a single repo, or makes the
  hub/member placement decision once and runs the CLI to make it real across every checkout, then
  hands each repo to `/nxs.setup` for its own per-repo judgment pass.

## User Stories

### Story 1: `nexus deploy` — Install Nexus Components into a Repo

- **story_type:** user
- **size:** S

**As a** developer adopting Nexus in a single repo, **I want** one portable command that installs the
Nexus Claude components into my repo, **so that** I can start running the pipeline without a manual,
OS-specific shell script.

#### Acceptance Criteria

- [ ] **Given** a repo with no Nexus components, **when** I run `nexus deploy` from it, **then** the
      Nexus `.claude/` components (slash commands, agents, skills, and the rest) are installed into
      that repo, matching the set the retired `nxs.update.claude.sh` script installed.
- [ ] **Given** a repo that already carries Nexus components, **when** I re-run `nexus deploy`, **then**
      it refreshes them in place idempotently — a second run with no upstream change leaves the repo's
      component set identical.
- [ ] **Given** a checkout with no in-repo Node tooling installed, **when** I run `nexus deploy`,
      **then** it completes using the portable distributable ([portable-tooling](portable-tooling.md),
      epic \#44) — no project `install` or build step is required, on any supported OS.
- [ ] **Given** the CLI ships, **when** the distribution is inspected, **then** the legacy
      `nxs.update.claude.sh` script is **removed** — `nexus deploy` is the sole Claude-component
      install path (Gemini and other agents are out of scope).

#### Notes

This story establishes the shared `nexus` entrypoint and the **component-deploy primitive** that
`nexus workspace init` (Story 2) reuses to distribute components across every declared repo. It does
**not** author any manifest or pointer — deploy is component installation only; workspace declaration
is Story 2.

### Story 2: `nexus workspace init` — Declare a Multi-Repo Workspace

- **story_type:** user
- **size:** M

**As a** team lead setting up a multi-repo Nexus product, **I want** a single CLI command that
declares the workspace — letting me designate which checkout is the hub and which are members —
**so that** the hub manifest, every member's pointer, and each repo's components are all in place
without hand-editing files in each repo.

#### Acceptance Criteria

- [ ] **Given** several sibling checkouts under a shared parent with no existing manifest or pointer,
      **when** I run `nexus workspace init` from one of them, **then** the CLI **lists the discovered
      sibling checkouts** and I designate the hub and the members before anything is written.
- [ ] **Given** a confirmed hub/member designation, **when** init completes, **then** the hub carries a
      manifest naming every member (name + remote identity + expected sibling checkout name) and each
      member carries a pointer naming only the hub, in the exact schema the workspace resolver reads
      ([workspace-resolution](workspace-resolution.md), epic \#38) — resolution from the hub and from
      any member returns the identical workspace description.
- [ ] **Given** a confirmed designation, **when** init completes, **then** every declared repo — hub and
      members — has its Nexus components installed via the same component-deploy primitive as
      `nexus deploy` (Story 1).
- [ ] **Given** a repo that already carries a manifest or pointer, **when** I re-run
      `nexus workspace init`, **then** it reports the existing declaration and makes **no** change to any
      file without explicit confirmation.
- [ ] **Given** a designated member whose remote is the same as the hub's or as another declared
      member's, **when** init runs, **then** it reports the collision (through the resolver's
      remote-identity rule) and writes nothing.

#### Notes

Auto-*proposing* which sibling is the hub (versus listing them for the user to designate) is
deliberately out of scope — see Out of Scope.

### Story 3: `nexus workspace status` — Portable Status Verb

- **story_type:** user
- **size:** S

**As a** developer working from a checkout with no in-repo Node tooling installed, **I want** the
workspace status read-out available through the portable CLI, **so that** I can verify a workspace
from any checkout without an in-repo toolchain.

#### Acceptance Criteria

- [ ] **Given** a declared workspace, **when** I run `nexus workspace status` from the hub or from any
      member, **then** the output matches the existing in-repo status read-out (the sole observable
      surface over the resolver, epic \#38) — hub identity, each declared member, and each member's
      checkout state.
- [ ] **Given** a checkout carrying neither a manifest nor a pointer, **when** I run
      `nexus workspace status`, **then** it reports single-repo mode — not an error.
- [ ] **Given** a declared member whose sibling checkout is missing, **when** I run status, **then** the
      missing member is reported by name and expected path as *state*, not surfaced as a hard failure
      (only a missing hub, an undeclared member, or a malformed manifest is a hard failure).
- [ ] **Given** any invocation, **when** status runs, **then** it performs **no** clone, fetch, or file
      mutation — the read-out is strictly read-only over the resolver.

### Story 4: `nexus workspace add-repo` — Add a Member to an Existing Workspace

- **story_type:** user
- **size:** S

**As a** developer growing an existing multi-repo workspace, **I want** a CLI command to add one new
member repo, **so that** onboarding a repo touches only the two files the workspace model requires —
not a hand-edit of the manifest plus a manually authored pointer.

#### Acceptance Criteria

- [ ] **Given** an existing hub with a manifest, **when** I run `nexus workspace add-repo` from a new
      sibling checkout, **then** the hub manifest gains exactly one new member entry and the new
      checkout gains a hub pointer — and **no other repo's files change** (exactly two files mutated).
- [ ] **Given** a new member whose name or remote collides with an already-declared member, **when** I
      run add-repo, **then** it reports the collision and makes no change.
- [ ] **Given** the new member was just added, **when** I run `nexus workspace status` afterward,
      **then** the new member appears among the declared members as checked-out and present.

### Story 5: Re-scope `/nxs.setup` to Per-Repo Judgment

- **story_type:** user
- **size:** S

**As an** engineer running `/nxs.setup` inside a repo whose components the CLI has already installed,
**I want** the command to detect its workspace role (or single-repo mode) and skip the structural
bootstrap the CLI already performed, **so that** I only go through the per-repo judgment interview
(stack docs, standards, product context) rather than redoing placement or component installation.

#### Acceptance Criteria

- [ ] **Given** a repo carrying a hub pointer or a manifest, **when** I run `/nxs.setup`, **then** it
      detects the workspace role through the resolver and issues **no** hub/member placement prompt.
- [ ] **Given** a repo carrying neither artifact (single-repo mode), **when** I run `/nxs.setup`,
      **then** it runs the per-repo judgment interview without attempting a hub/member placement prompt.
- [ ] **Given** a repo the CLI has placed, **when** `/nxs.setup` completes, **then** it has produced only
      per-repo judgment artifacts (stack docs, standards, product context) — it creates or modifies
      **no** manifest or pointer file.

## Assumptions

- The **component-deploy primitive** introduced in Story 1 is the single distribution mechanism for
  Nexus Claude components; the legacy `nxs.update.claude.sh` script is removed rather than kept as a
  parallel path. The exact copy implementation (what the primitive treats as the component source of
  truth) is an HLD decision, but it produces the same component set the old script installed.
- The manifest/pointer **writer** this epic introduces is the counterpart to the epic \#38 **resolver**
  (the reader). The resolver stays the single authority on workspace *shape*; the CLI writes artifacts
  in that shape and never re-derives or re-defines it.
- Ongoing, idempotent hub-pointer stamping on repeat component updates, the per-engineer self-gating
  scratch-capture hook, and a one-time engineer installer remain a **separate** concern from this
  epic's one-time deploy/declare/add CLI — they stay with the `engineer-install` backlog stub (still
  `proposed`), not folded in here.

## Out of Scope

- **Non-Claude agent support.** This epic covers the Claude component surface only; Gemini (and any
  other agent) deployment and their update scripts are untouched.
- **Manifest-skeleton auto-generation** — the CLI *proposing* which sibling is the hub and which are
  members, versus listing the discovered siblings for the user to designate. Deferred: it pushes
  against the workspace-manifest epic's (\#38) deliberate "no manifest-generation tooling" posture and
  would push Story 2 past M. Re-triage under the `workspace-setup-cli` stub if picked up later.
- The `engineer-install` stub's self-gating scratch-capture hook, one-time engineer installer, and
  update-script hub-pointer extension (`docs/features/multi-repo-workspaces/backlog.md`) — separate,
  not-yet-promoted scope.
- Cross-repo range recording for epics implemented across multiple member repos — tracked under the
  `cross-repo-range-recording` backlog stub.

## Open Questions

None.

## Implementation Sequence

| STORY | Issue | blocked_by |
|---|---|---|
| STORY-60.01 | #61 | none |
| STORY-60.02 | #62 | STORY-60.01 |
| STORY-60.03 | #63 | STORY-60.01 |
| STORY-60.04 | #64 | STORY-60.02 |
| STORY-60.05 | #65 | none |
