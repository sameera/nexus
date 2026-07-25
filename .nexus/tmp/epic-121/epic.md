---
feature: "Multi-Repo Workspaces"
feature_path: docs/features/multi-repo-workspaces
epic: "GitHub Publishing Config"
slug: github-publishing-config
created: 2026-07-22
type: enhancement
complexity: M
complexity_drivers: [seven interlocking config-plumbing stories sharing one resolver, one deliberate behavior change (epic fallback label enhancement → epic), self-healing write-back that persists decided config, one external dependency (workspace-manifest) for the workspace-defaults story]
concepts: []
link: "#121"
---

# Epic: GitHub Publishing Config

## Description

Every GitHub issue-publishing decision Nexus makes today is either hard-coded or discovered
by failure: the epic-creation script probes whether the repo has org issue-types and silently
falls back to a label, projects are auto-discovered by name, and the target issues-repo is read
inconsistently. The same config-reading function is copy-pasted verbatim into both creation
scripts, so the two can drift. This epic externalizes those decisions — classification mode
(issue-types vs. labels), the Project V2 target (including a first-class "none"), repo targeting
for epics vs. stories, and label mappings — into one declared `github:` block in
`.nexus/config/settings.yml`, resolved the same way by all four resolving consumers (both
creation scripts, `/nxs.epic`, and `/nxs.close`). `/nxs.setup` is the producer — it seeds the
block at bootstrap — not a fifth resolver.

The value is reliability and predictability. The trigger was a real failure: epic filing crashed
on a personal repo that had no org issue-types and no auto-discoverable project — the implicit
assumptions the probing baked in. Declared config replaces probing-by-failure, so publishing
works the same on a personal repo and an org repo, and the four consumers can no longer disagree
about where an issue goes or how it is typed.

The change is deliberately conservative. Absent any `github:` block, every consumer reaches the
same *issue outcome* it does today — same type, label, project, and repo — with one, and only
one, intentional change to that outcome: the epic's fallback label changes from `enhancement` to
`epic`, and that change is made safe by an ensure-label step (the same `gh label create --force`
upsert the story path already uses) so filing never strands on a label that does not yet exist.
The only other new behavior is a side effect that leaves the filed issue unchanged — the first
fallback run persists its decisions, described next.

The resolution is also self-healing. The first run on a repo with no `github:` block resolves by
today's fallback probe/discovery *and then persists the decisions it reached* — writing the
concrete values (the detected classification mode, the discovered project or `none`, the resolved
issues-repo) into `.nexus/config/settings.yml`. So the failure-prone probe runs at most once per
repo: every later run reads the declared block instead of re-deriving it. This complements
`/nxs.setup`, which seeds the block proactively at bootstrap with a human present — write-back is
the runtime safety net for repos that were bootstrapped before this feature, or where setup was
never run.

## Success Metrics

- With no `github:` block present, every consumer reproduces today's publishing behavior — no
  regression in issue type, label, project, or repo targeting.
- The config-resolution logic exists in exactly one module; neither creation script carries a
  private copy (zero duplicate definitions).
- Epic filing on a repo with no org issue-types and no linked project completes without a crash
  or manual recovery — the original failure mode is gone.
- Given identical config and frontmatter, both creation scripts, `/nxs.epic`, and `/nxs.close`
  resolve any given key to the same value.
- The epic label is guaranteed to exist before it is applied; issue creation never fails on a
  missing label.
- The issue-type probe and project auto-discovery run at most once per repo: after the first
  fallback run, a `github:` block exists and later runs read it instead of re-probing.

## Personas

Per `docs/product/context.md`. The directly relevant persona is the **Secondary — Solo developer
using AI-assisted delivery**, on a personal repo: the crash this epic removes is exactly the
solo/personal-repo case (no org issue-types, no auto-discoverable project). The Primary persona
(engineer on a small team) benefits from the uniform, declared resolution across consumers. No
epic-specific persona deviations.

## User Stories

### Story 1: Single shared config resolver

**As a** pipeline operator, **I want** the GitHub-publishing config read by one shared resolver instead of a verbatim copy in each script, **so that** epic-creation and story-creation can never drift in how they read config.

## Acceptance Criteria

- [ ] **Given** the two creation scripts (`nxs_gh_create_epic.py`, `create_gh_issues.py`), **when** the config reader is located, **then** `read_delivery_config` is defined in exactly one shared module and both scripts import it — a search finds zero duplicate definitions.
- [ ] **Given** a `.nexus/config/settings.yml` carrying an existing `github:` block, **when** either script resolves config, **then** it returns the same normalized keys and values it returned before the extraction (behavior-preserving parity).
- [ ] **Given** the shared module, **when** its unit tests run, **then** the resolver has direct test coverage independent of either creation script.

## Notes

Pure, behavior-preserving refactor. It is the foundation the precedence, classification, and project-target stories build on. No user-visible publishing change.

### Story 2: Declared classification mode (types | labels | legacy-auto)

**As a** pipeline operator, **I want** a declared `classification` mode that decides whether epics and stories are typed (GitHub issue-types) or labeled, **so that** publishing stops probing-by-failure and works on repos that have no org issue-types.

## Acceptance Criteria

- [ ] **Given** `github.classification: labels`, **when** an epic is filed, **then** no issue-type probe runs and the epic issue carries the configured epic label (default `epic`), not a GitHub issue type.
- [ ] **Given** `github.classification: types`, **when** an epic is filed, **then** the configured epic issue-type is applied and no fallback label is added.
- [ ] **Given** `github.classification: legacy-auto` (or no `github:` block), **when** an epic is filed, **then** the probe-then-fallback flow runs as it does today — except the fallback label is `epic` (the one deliberate change; see Notes).
- [ ] **Given** the resolved epic label (`epic` by default) does not yet exist in the repo, **when** an epic is filed, **then** the label is created via an idempotent upsert (`gh label create --force`, mirroring the story-label step) before it is applied, so filing never fails on a missing label.
- [ ] **Given** config maps epic/story to specific issue-type and label names, **when** issues are filed, **then** those exact mappings are applied.

## Notes

This story owns the epic's single deliberate behavior change: the epic fallback label moves from `enhancement` to `epic`. It is made safe by the ensure-label upsert above — the same mechanism `create_gh_issues.py` already uses for the story label.

### Story 3: Project V2 target — none | auto | explicit

**As a** pipeline operator, **I want** to declare the Project V2 target as `none`, `auto`, or an explicit project, **so that** repos without a project don't hit auto-discovery probing or spurious warnings.

## Acceptance Criteria

- [ ] **Given** `github.project: none`, **when** issues are filed, **then** no project lookup and no add-to-project call is made, and no "project not found" warning is emitted.
- [ ] **Given** `github.project` set to an explicit target (`owner/number` or a project name), **when** issues are filed, **then** they are added to exactly that project and no discovery runs.
- [ ] **Given** `github.project: auto`, or a repo with no `github:` block **on its first run**, **when** issues are filed, **then** today's project-discovery behavior runs unchanged. (After that first run, the write-back story has persisted a concrete value, so a no-block repo re-discovers only when the operator keeps `project: auto` declared.)

## Notes

"none" is first-class — the personal-repo case that has no project at all — and must be a silent, warning-free path.

### Story 4: Uniform resolver precedence across all consumers

**As a** pipeline operator, **I want** every consumer to resolve config through the same precedence chain (frontmatter > repo settings > hub defaults > built-in), **so that** the four consumers never disagree and `/nxs.close` stops ignoring the configured issues-repo.

## Acceptance Criteria

- [ ] **Given** a key set at more than one level, **when** the resolver runs, **then** the winning value follows the order frontmatter > repo settings > hub defaults > built-in (verified for each adjacent pair).
- [ ] **Given** `github.issues-repo` is configured, **when** `/nxs.close` comments on and closes the epic issue, **then** it targets the configured issues-repo — fixing today's behavior where `/nxs.close` ignores it.
- [ ] **Given** identical config and frontmatter, **when** both creation scripts, `/nxs.epic`, and `/nxs.close` each resolve a given key, **then** all four produce the same value.

## Notes

Builds on STORY-121.01's shared module. The `/nxs.close` fix is the concrete bug this precedence work resolves.

### Story 5: Workspace github defaults + epic/story repo targeting

**As a** pipeline operator in a multi-repo workspace, **I want** workspace-wide github defaults in the hub manifest with per-key member inheritance, plus an epic-repo/story-repo targeting rule, **so that** epics and stories land in the right repos even when a member has no primary code repo.

## Acceptance Criteria

- [ ] **Given** the hub manifest declares github defaults and a member repo does not override a given key, **when** the member resolves config, **then** it inherits that key from the hub defaults — per-key, not all-or-nothing.
- [ ] **Given** epic-repo and story-repo targeting rules, **when** an epic and its stories are filed, **then** the epic issue and the story issues are created in their configured repos respectively.
- [ ] **Given** a workspace member with no primary code repo, **when** an epic is filed, **then** the epic issue is created in the hub (the no-primary-repo case).

## Notes

This is the "layers on workspace-manifest" scope: it depends on the `workspace-manifest` epic (already promoted) for the hub manifest it reads. Within this epic it is blocked by STORY-121.04 (the precedence chain the hub-defaults level plugs into).

### Story 6: /nxs.setup seeds the github: block

**As a** pipeline operator bootstrapping a repo, **I want** `/nxs.setup` to seed the `github:` block by detecting classification and project at setup-time — when I am present — **so that** the crash-prone runtime probe is replaced by a one-time decision.

## Acceptance Criteria

- [ ] **Given** `/nxs.setup` Phase 4 runs, **when** it seeds the block, **then** `classification` is set to the detected mode: `types` when the repo/org exposes issue-types, otherwise `labels`.
- [ ] **Given** a project is linked or detectable via `gh`, **when** setup seeds the block, **then** `project` is set to that target; **and given** more than one candidate project (ambiguous), **then** setup asks the human to confirm the target before writing it.
- [ ] **Given** `gh` is unavailable at setup-time, **when** setup seeds the block, **then** it writes the safe defaults `classification: labels` and `project: none` (no crash) and records that it fell back.

## Notes

Moves the failure-prone probe from issue-creation runtime to setup-time, where the human can confirm ambiguous choices. Depends on the classification and project-target schema (STORY-121.02, STORY-121.03) being defined so it knows what to seed.

### Story 7: Persist resolved defaults on first use (write-back)

**As a** pipeline operator on a repo with no `github:` block, **I want** the first run that decides publishing settings by fallback to persist those decisions into `.nexus/config/settings.yml`, **so that** the same repo never has to re-probe.

## Acceptance Criteria

- [ ] **Given** no `github:` block, **when** a consumer files issues (falling back to today's probe/discovery), **then** after the run a `github:` block exists in `.nexus/config/settings.yml` carrying the decided values as concrete settings — the detected classification mode, the discovered project or `none`, and the resolved issues-repo — never the literal `auto`.
- [ ] **Given** the block was written by a prior run, **when** the same consumer runs again on the same repo, **then** it reads the block and performs no issue-type probe and no project auto-discovery.
- [ ] **Given** a key is already declared in the `github:` block (including an explicit `auto`), **when** write-back runs, **then** that declared key is never overwritten — write-back fills only keys that were absent, so an explicit `auto` keeps re-discovering as the operator asked.

## Notes

Complements STORY-121.06: setup seeds the block proactively at setup-time with a human present; this is the runtime safety net for repos bootstrapped before this feature or where setup never ran. Blocked by STORY-121.04 — write-back persists the values the shared resolver decided, so it needs the resolver and its concrete decided values.

## Assumptions

- The `github:` block lives under a top-level `github:` key in `.nexus/config/settings.yml`,
  matching today's reader, which already looks up `github.project`, `github.epic-type`, and
  `github.issues-repo`.
- Absent any `github:` block, every consumer reproduces today's *decisions* for that run (with the
  single intentional exception of the epic fallback label default `enhancement` → `epic`, made safe
  by the ensure-label step). The new side effect is that those decisions are then persisted
  (Story 7); the filed issue's type, label, project, and repo are unchanged for that run.
- Persisting decided values freezes only keys that were *absent*. A key an operator declared —
  including an explicit `auto` — is never rewritten, so opt-in re-discovery stays possible.
- The story-label upsert (`gh label create --force`) already in `create_gh_issues.py` is the model
  the epic-label ensure step mirrors.

## Out of Scope

- Issue body rendering and content — this epic changes only how issues are typed, labeled,
  projected, and repo-targeted, not what their bodies contain.
- The immediate settings.yml reader-pointer bug fix, which shipped separately (per the stub
  source); this epic builds the schema on top of it.
- Any concept-store or distiller behavior.

## Open Questions

<!-- none -->

## Implementation Sequence

| STORY | Issue | blocked_by |
|---|---|---|
| STORY-121.01 | #122 | none |
| STORY-121.02 | #123 | STORY-121.01 |
| STORY-121.03 | #124 | STORY-121.01 |
| STORY-121.04 | #125 | STORY-121.01 |
| STORY-121.05 | #126 | STORY-121.04 |
| STORY-121.06 | #127 | STORY-121.02, STORY-121.03 |
| STORY-121.07 | #128 | STORY-121.04 |
