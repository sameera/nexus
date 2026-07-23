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

- [ ] [SKIPPED - see comments] **Given** no `github:` block, **when** a consumer files issues (falling back to today's probe/discovery), **then** after the run a `github:` block exists in `.nexus/config/settings.yml` carrying the decided values as concrete settings — the detected classification mode, the discovered project or `none`, and the resolved issues-repo — never the literal `auto`. 
- [x] **Given** the block was written by a prior run, **when** the same consumer runs again on the same repo, **then** it reads the block and performs no issue-type probe and no project auto-discovery.
- [x] **Given** a key is already declared in the `github:` block (including an explicit `auto`), **when** write-back runs, **then** that declared key is never overwritten — write-back fills only keys that were absent, so an explicit `auto` keeps re-discovering as the operator asked.

## Notes

Complements STORY-121.06: setup seeds the block proactively at setup-time with a human present; this is the runtime safety net for repos bootstrapped before this feature or where setup never ran. Blocked by STORY-121.04 — write-back persists the values the shared resolver decided, so it needs the resolver and its concrete decided values.

### Story 8: Decision Record: GitHub Publishing Config

# Decision Record: GitHub Publishing Config

> Decision record for epic **#121 — GitHub Publishing Config**. Imported from the pre-issue `decision-record.md` (this epic predates the decision-record-as-sub-issue model it introduces).

## Summary

This epic replaces every hard-coded or probe-by-failure GitHub-publishing decision
with one declared configuration block, resolved by a single shared resolver that all
four consumers — both issue-creation scripts, epic filing, and epic close — go through.
The design is deliberately conservative: with no block present, every consumer
reproduces today's issue outcome, with exactly one intended change (the epic fallback
label moves from a generic label to an epic-specific one, made safe by an idempotent
label upsert). The first fallback run persists the decisions it reached, so the fragile
probe runs at most once per repo.

## Chosen Approach

Extract the copy-pasted config reader into one resolver defined exactly once, imported
directly by both creation scripts and invoked by the non-script consumers, so no
consumer re-derives config by parsing settings on its own. The resolver applies one
precedence chain — an imperative invocation-time argument, then per-item frontmatter,
then repo settings, then workspace hub defaults, then built-in defaults — and returns
concrete decisions for classification mode, project target, and repo targeting. Two
producers keep the block populated: setup seeds it proactively at bootstrap with a human
present, and runtime write-back fills any still-absent keys the first time a repo falls
back, freezing only the gaps it filled and never touching a value the operator declared.

## Key Decisions

### One shared resolver, not the copy-paste status quo

- **Decision:** Define the config-resolution logic exactly once; both creation scripts
  import it from that single source, and the non-script consumers (epic filing and epic
  close) obtain resolved values by invoking that resolver rather than reading settings
  themselves.
- **Why:** The two verbatim copies are the drift mechanism this epic exists to kill — the
  settings-reader bug and the inconsistent issues-repo handling both lived in duplicated
  code. One definition is also the only way the four-consumer equivalence invariant can
  hold, and it gives the resolver direct unit tests independent of either script.
- **Refuted alternative:** Keep a private copy in each script and fix them in lockstep. It
  lost because "keep two copies in sync by discipline" is exactly what already failed here;
  nothing prevents the next divergence.

### Declared config, not probe-by-failure

- **Decision:** Move the classification, project, and repo-targeting decisions into
  declared config resolved before any GitHub call, so publishing consults intent instead
  of discovering it through API calls that may fail or return nothing.
- **Why:** Probing bakes in implicit assumptions — that the repo has org issue-types, that
  a project is auto-discoverable — that are false on a personal repo, the original trigger.
  Declared config makes personal-repo and org-repo publishing behave identically and stay
  reasonable offline.
- **Refuted alternative:** Keep probing but harden it (catch every failure, suppress
  warnings). It lost because it cannot distinguish "intentionally none" from "not found
  yet," so it re-probes forever and can never be reasoned about without a live API.

### Three-way classification mode, with `legacy-auto` mandatory

- **Decision:** Support an explicit types mode (apply the configured issue-type, no
  fallback label), an explicit labels mode (apply the configured label, no issue-type
  probe), and a legacy-auto mode that runs today's probe-then-fallback flow; legacy-auto
  is the built-in default when no block is present.
- **Why:** The explicit modes serve repos that have decided, but a repo with no block must
  still reproduce today's exact outcome — and today's outcome depends on whether the repo
  happens to have issue-types, which is itself a probe. Legacy-auto is that behavior named
  and preserved; it makes the "no regression when no block" guarantee true, and it is what
  write-back later freezes into a concrete types or labels choice.
- **Refuted alternative:** Only types and labels, defaulting to one when absent. It lost
  because either default silently changes the classification for the half of existing repos
  that would have resolved the other way — a regression this epic forbids.

### Project target as none | auto | explicit, with `none` first-class and silent

- **Decision:** Let the project target be none (no lookup, no add-to-project call, no
  warning), an explicit target (add to exactly that project, no discovery), or auto
  (today's discovery); auto is the built-in default when no block is present.
- **Why:** The personal-repo case genuinely has no project, and today that path emits a
  false-alarm "no project found" warning on every run and wastes a lookup. A first-class
  none encodes "intentionally no project" as a silent, warning-free, zero-call path.
- **Refuted alternative:** Treat a missing project as auto and merely suppress the warning.
  It lost because it still re-discovers on every run and cannot express deliberate absence —
  the operator can never turn the probe off.

### Precedence: invocation argument > frontmatter > repo settings > hub defaults > built-in

- **Decision:** Resolve every key most-specific-first. An imperative invocation-time
  argument (the project passed directly to epic filing today) stays the top override; then
  per-item frontmatter, then the repo's declared settings, then workspace hub defaults, then
  the built-in default.
- **Why:** The invocation argument is an explicit operator command for this run and must win,
  preserving today's behavior. Frontmatter is per-epic/per-story intent and must override a
  repo default for a one-off; a member repo must override a workspace-wide default locally;
  the built-in is the last resort that guarantees a value always exists. This chain is also
  what lets epic close stop ignoring the configured issues-repo — it now resolves that key
  the same way and targets the configured repo.
- **Refuted alternative:** Put repo settings above frontmatter (config-as-law). It lost
  because it removes the per-item override, which is the reason frontmatter exists.

### Split setup-time seeding from runtime write-back, keeping both

- **Decision:** Setup seeds the block proactively at bootstrap; runtime write-back fills
  still-absent keys on the first fallback run. Keep both, not one.
- **Why:** Setup has a human present, so it can resolve an ambiguous project (multiple
  candidates → ask before writing) and fall back to safe values when the CLI is unavailable,
  recording that it did — decisions no unattended run should make. But setup never re-runs on
  repos bootstrapped before this feature, so those would probe forever; write-back is the
  unattended safety net that closes that gap without a human.
- **Refuted alternative:** Write-back only, no setup seeding. It lost because it forfeits
  human disambiguation of ambiguous projects and only acts after the first fallback, rather
  than deciding up front when someone is watching.

### Write-back freezes only absent keys, and never pins "current repo"

- **Decision:** Write-back fills keys that were absent from the block and leaves every
  declared key untouched — an explicit auto keeps re-discovering, an explicit none stays
  none. When the resolved repo target is "the current repo" (no issues-repo declared),
  write-back leaves that key absent rather than pinning a concrete owner/repo.
- **Why:** A declared value is operator intent; freezing an explicit auto to its discovered
  concrete value would silently override an opt-in to re-discovery. Gap-filling is the only
  write that is always safe. Leaving the repo target absent keeps "current repo" meaning
  the current repo, so a later rename or move does not strand publishing on a stale
  pin — an absent key is the durable expression of "wherever this repo is."
- **Refuted alternative:** Persist all resolved values after every run, including pinning the
  current repo as an explicit target. It lost because it overwrites deliberate auto/none
  choices and pins a repo identity that breaks on rename — turning a convenience into a
  surprise.

### The one deliberate outcome change — epic fallback label — made safe by the upsert

- **Decision:** In the fallback (legacy-auto) path, the epic's fallback label becomes the
  epic-specific label instead of the generic one, and an idempotent label upsert guarantees
  the label exists before it is applied — the same mechanism story filing already uses for
  its label.
- **Why:** The generic label does not classify the issue as an epic and is asymmetric with
  the label the sibling story path applies. The upsert removes the only risk of the change —
  filing stranding on a label that does not yet exist — so the change carries no failure
  surface.
- **Refuted alternative:** Keep the generic label to avoid any behavior change. It lost
  because it is semantically wrong and asymmetric with the story path, and the upsert makes
  the correct label free of risk.

### Hub defaults inherited per key; epic and story repo targets resolved separately

- **Decision:** Workspace hub defaults merge into a member's resolution per key, not
  all-or-nothing. The epic-repo and story-repo targets are ordinary keys in the repo-level
  block resolved through the standard chain — a repo may declare them directly, and the more
  specific epic-repo/story-repo win over the general issues-repo, which is the fallback for
  whichever is unspecified. The target repo is resolved independently for the epic issue and
  for the story issues, and the epic issue lands in the hub when a member has no primary code
  repo.
- **Why:** A member that overrides one key must still inherit the rest from the hub;
  block-level replacement would force every member to restate the whole block and re-introduce
  the drift this epic fights. Keeping epic-repo/story-repo as repo-level keys (with per-key
  hub inheritance as fallback) means a member controls placement locally without depending on
  workspace-wide config. Separate epic/story targeting expresses the real workspace shape —
  epics as cross-cutting planning artifacts, stories in the code repo — and handles the member
  with no code repo at all.
- **Refuted alternative:** Treat the whole block as one inherited unit and use a single
  issues-repo for both epic and stories. It lost because it forces per-member duplication and
  cannot express "epic in hub, stories in member," breaking the no-primary-repo case.

## Constraints & Invariants

1. **Behavior-preservation parity:** with no configured block present, every consumer must
   reach the same issue type, label, project, and repo it reaches today — with the single
   exception of the epic fallback label default.
2. **Single source of truth:** the resolution logic exists in exactly one module; a search
   must find zero duplicate definitions, and no consumer re-derives config by parsing
   settings itself.
3. **Four-consumer resolution equivalence:** given identical config and frontmatter, both
   creation scripts, epic filing, and epic close must resolve any given key to the same value.
4. **Precedence order:** resolution is invocation argument > frontmatter > repo settings > hub
   defaults > built-in; the imperative invocation-time argument always wins, and each lower
   level is a fallback for the one above it.
5. **Write-back never overwrites declared keys:** it fills only keys that were absent; any
   declared value, including an explicit auto or none, survives untouched.
6. **Write-back never pins "current repo":** when the repo target resolves to the current
   repo, write-back leaves that key absent, so an absent target continues to mean "current
   repo" and survives a later rename or move.
7. **The `none` project path stays silent:** when the project target is none, no project
   lookup and no add-to-project call is made and no warning is emitted.
8. **Ensure-label idempotency:** the epic label is upserted before it is applied, so re-runs
   are harmless and filing never fails on a missing label.
9. **Per-key hub-defaults inheritance and repo-target specificity:** a member inherits each
   unset key from the hub defaults independently; the more specific epic-repo/story-repo win
   over the general issues-repo, which is the fallback for whichever is unspecified.
10. **Write-back preserves the rest of the settings file:** the block is merged in surgically,
    leaving unrelated sections, comments, and formatting intact — a runtime side effect must
    not rewrite or corrupt the file.

## Risks (BLOCKER / ADDRESS only)

- **ADDRESS — write-back is a mutating side effect on a tracked config file:** runtime
  write-back edits the project settings file during issue creation or close, producing an
  uncommitted working-tree change while the operator may be mid-flow (the planning model
  commits nothing until close). Recommended decision: leave the change uncommitted and surface
  a clear "seeded config block — review and commit" message rather than staging or committing
  it automatically. The mitigation must also guarantee the surgical-merge invariant with a
  round-trip test, plus an assertion that the filed issue's outcome is unchanged by the write.
- **ADDRESS — the current config parser is lossy and read-only in spirit:** it handles only
  a shallow scalar structure and was never meant to write. Both runtime write-back and reading
  the workspace hub manifest push past what it safely supports. This forces a real
  dependency/team-capability decision: extend the hand-rolled read/merge/write carefully enough
  to satisfy the surgical-merge invariant, or adopt a real configuration-format library as a
  dependency.

## Open Clarifications

<!-- none — all three clarifications raised at the /nxs.hld gate were resolved and folded
     into the decisions and invariants above:
       1. invocation-time project argument stays the top override (Precedence decision / Invariant 4);
       2. epic-repo/story-repo are repo-level keys; specific keys win, issues-repo is the fallback
          (Hub-defaults decision / Invariant 9);
       3. write-back leaves the repo target absent, never pinning "current repo"
          (Write-back decision / Invariant 6). -->

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
| STORY-121.08 | #130 | none |
