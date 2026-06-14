# 5. What stays from the pre-pivot pipeline?

## Summary judgment

The pivot doesn't redesign Nexus from scratch — most of the operational machinery (GitHub integration, workspace setup, orchestration with human checkpoints, QA pipeline, right-sizing scope, standards as conformance input) survives, but its shape and seams change to match the new artifact set. The biggest reframe: **the story replaces the task as the unit of project delivery**. Tasks remain useful, but as engineer-facing work management — the ship boundary, the branch, the PR, the closure event all sit at the story level. A new top-level GH artifact, the *Objective*, becomes the iteration's tracking issue (custom GH issue type at the project layer, since milestones are repo-scoped and would fight multi-repo iterations — Q3 D14's override case). Standards survive as a distinct artifact in their hand-curated form, separate from `CLAUDE.md`, because they answer a different question (decision-time conformance) than `CLAUDE.md` does (implementation-time guidance). The right-sizing gate moves to where decomposition now happens — `/nxs.iteration` with PM and architect-consultation — and `/nxs.epic` does a confirm-only ceiling check on the elaborated epic. Cross-artifact consistency outside drift detection is deliberately unowned: the auto-remediation half of `/nxs.analyze` is accepted-as-lost rather than reimplemented against the new artifacts.

## The artifact-to-GH mapping

| Layer | Local artifact | GH representation | Created by |
|---|---|---|---|
| Iteration | `iteration.md` (scope) | Issue, type=Objective (project-scoped) | `/nxs.iteration`, opt-in |
| Epic | `epic.md` (capability + AC) | Issue, type=Epic | `/nxs.epic`, opt-in |
| Story | per-story slice of `epic.md`'s AC | Sub-issue of Epic, type=Story, carrying its own AC | `/nxs.epic`, opt-in |
| Task | task index entry | Sub-issue of Story, type=Task | `/nxs.tasks`, optional |
| QA | qa-test-case | Sub-issue tagged `qa-test-case` | `/nxs.qa --mode design` |

GH issue creation is **opt-in at every level**, prompted after generation. A team that doesn't want GH tracking still gets the local artifacts and can run the pipeline end-to-end without ever touching GitHub. Local markdown remains the source of truth; GH issues are projection.

## Decisions

### D1. GH issue hierarchy: Objective → Epic → Story → Task

Iterations get a project-scoped issue of custom type "Objective". Epics are issues. Stories are sub-issues of their epic, carrying their own slice of the epic's acceptance criteria. Tasks are sub-issues of their story when `/nxs.tasks` runs.

**Why:** GH milestones are repo-scoped, which fights multi-repo iterations (Q3 D14's override case). Custom issue types at the project layer can parent across repos, which fits an iteration that touches multiple products. Stories getting first-class GH identity is an upgrade over today, where they live embedded in `epic.md` and are invisible to anyone working from GitHub.

**How to apply:** every level is opt-in via prompt-after-generation. `/nxs.init` is responsible for verifying that the project has the required custom issue types and either creating them or surfacing a clear "set this up first" error.

### D2. Story is the unit of delivery; task is the engineer's private work management

The story is the project-visible delivery boundary: one branch, one PR, one ship event. Tasks (when `/nxs.tasks` runs) are commit-shaping guidance and the engineer's todo-list — not branch-shaping, not ship-shaping.

**Why:** the project cares that capabilities ship. How the engineer decomposes a story into 4 vs 7 commits is a productivity choice, not a tracking concern. Aligns the optionality of `/nxs.tasks` (Q4 D9) with what's really going on: skipping it is invisible to the project.

**How to apply:** `/nxs.start` always operates on a story. `/nxs.ship` always operates on a story. Tasks may exist as GH sub-issues for the engineer's tracking; ship closes them as a side effect of closing the story.

### D3. Branch shape: `feat/{story-id}-{slug}`, one branch per story

`/nxs.start <story>` creates the single branch for that story. The previous `feat/{epic-number}-{title}` convention does not survive — it pointed at the wrong unit.

**Why:** branch boundary aligns with ship boundary aligns with PR boundary. The triplet (story, branch, PR) becomes a single conceptual thing.

### D4. `/nxs.ship` semantics: finalize the story's PR

Ship operates on a story. It finds the existing PR for the story branch (or opens it if there isn't one), writes the consolidated summary, closes the task sub-issues, closes the story issue, tears down the worktree.

**Why:** an engineer may open a draft PR mid-flight for incremental review. That's the *same* PR that ships at the end — there is never more than one open PR per story branch to the same target. Ship's job is finalization, not creation.

**How to apply:** epic and objective issues stay open after a story ships. They close on PM call, not on the last child closing — those are deliberate boundary decisions, not cascade events.

### D5. Mid-flight git hygiene is out of Nexus's scope

If the engineer merges other in-flight branches into their story branch, `/nxs.ship` ships whatever the branch contains. Nexus does not detect, warn, or block on entanglement with other story branches.

**Why:** false-positive prone, and conflicts with the principle that Nexus stays out of the engineer's middle (Q4 D3). PR review and CI/branch protection are the right layers for hygiene enforcement.

### D6. Standards survive as a distinct artifact under the docs root

`docs/system/standards/*.md` survives the pivot, lives at `<docs-root>/system/standards/` (resolved per Q3 D13/D14 — defaults to `./docs/system/standards/` in-repo with `.graphifyignore` excluding it; multi-repo overrides land them under the shared parent alongside concepts), and retains its structured template (Principles / Standards with rationale-and-exceptions / Patterns / Anti-Patterns / Checklist).

**Why:** standards answer "what we always do" — a question concepts ("what does this system have"), decision records ("why we chose this for this change"), and `CLAUDE.md` ("how to behave at implementation time") all leave open. They are decision-time and design-time inputs with structured queryability ("what's our standard for X"). Folding them into `CLAUDE.md` mixes audiences and degrades both.

### D7. Standards are hand-curated; no `/nxs.standard` command

Unlike concepts, standards do not get extract/validate/evolve tooling. The volume is small (5-20 docs per project), the cadence of change is slow, and the cost of automated extraction outweighs its value.

**How to apply:** `/nxs.init` bootstraps an initial set from `_template.md` (template survives unchanged). The team edits markdown directly thereafter. No curator agent, no changeset-approval flow — these are read-mostly artifacts.

### D8. Standards are consumed at decide, design, and tasks stages

| Stage | Consumption |
|---|---|
| `/nxs.decide` | Architect checks proposed approach against applicable standards; non-conformance must be justified in the decision record's "trade-offs" or "non-goals" |
| `/nxs.qa --mode design` | QA design pulls test coverage from standards-mandated concerns (security, accessibility, performance) |
| `/nxs.tasks` | Task entries that touch standard-relevant areas surface the standard as a gotcha |

`CLAUDE.md` references the standards path (resolved via Q3 D14's helper) as a discoverable pointer at implementation time, but does not duplicate its content.

### D9. Right-sizing gate moves to `/nxs.iteration`; `/nxs.epic` only confirms

The decompose-or-reduce gate fires at iteration decomposition, where complexity is first scored. Architect-agent consultation flags candidate stubs as L; the PM either splits, reduces scope, or proceeds with explicit acknowledgement.

`/nxs.epic <stub-id>` does a confirm-only ceiling check on the elaborated epic — has the addition of acceptance criteria pushed it past the M ceiling that the stub claimed? If yes, the gate fires again at this stage with the same options.

**Why:** the original gate at `/nxs.epic` time made sense when epic generation was the first place complexity got scored. With sizing now happening in iteration decomposition (Q2 D9), the gate must move there or it fires too late to inform stub carving. The `/nxs.epic` confirmation guards against AC accretion silently inflating an M into an L.

### D10. Cross-artifact consistency outside drift detection is unowned

`/nxs.analyze`'s drift-detection role moves to `/nxs.close` via `nxs-analyzer` (Q4 D4). Its previous auto-remediation role — terminology normalization, superfluous-task merging, dependency fixup — is not reimplemented against the new artifact set.

**Why:** the surfaces that auto-remediation operated on (per-task LLDs as documents) are gone. The new surfaces (AC vs iteration scope, decision record vs concepts touched, task-index gotchas vs decision record) are smaller and less mechanical — the value of automation is lower, and the risk of an analyzer "fixing" something it shouldn't is higher in PM-curated layers (concepts especially).

**Accepted trade-off:** light cross-artifact drift may go undetected. PM and architect review at changeset-approval gates (Q2 D14) are the compensating control.

### D11. Workspace management survives unchanged inside `/nxs.start`

`nxs-workspace-setup` (worktree creation, branch management) and `nxs-env-sync` (env file syncing) survive as skills called from `/nxs.start`. Both retain their current behavior; only their entry point changes (story instead of task).

### D12. The orchestration pattern is the load-bearing survivor

Q2 D14 already pinned changeset-approval as the universal pattern for any agent-generated artifact that becomes part of the PM-curated layer. That pattern is the spine of the pipeline. Re-stated here for completeness: every command that produces a curation-relevant artifact (concepts, epic stubs, AC drafts) emits a changeset for explicit human accept/edit/reject before disk-writing.

### D13. `/nxs.init`'s scope expands to match the new world

Beyond bootstrapping `CLAUDE.md` (Q4 D3) and ensuring the docs root exists at the location resolved per Q3 D13/D14 (default `./docs/` in-repo with `.graphifyignore`; configurable to multi-repo or out-of-tree via `.nexus/config`), `/nxs.init` is responsible for:

- Verifying or creating GH custom issue types (Objective, Epic, Story, Task) at the project layer.
- Bootstrapping `<docs-root>/system/standards/` from `_template.md` if absent.
- Bootstrapping `<docs-root>/system/stack.md` (technology-stack discovery) — kept from current `/nxs.init`.
- Installing Graphify git hooks for the active repo (Q3 D11).

Each step is idempotent and skippable on re-run. `/nxs.init` becomes the prerequisite-pinning command — every other command can assume its outputs exist.

### D14. QA artifacts move to story-scoped paths

`qa_issues.json` (currently written to `<epic-folder>/`) moves to `<story-folder>/`, matching the new story-as-delivery-unit shape. The QA design-mode prompt updates to reference the story's AC, decision record, and graph context (Q4 D6).

### D15. Skill roster updates: add `nxs-gh-create-story`

`nxs-gh-create-epic` and `nxs-gh-create-task` survive (with frontmatter updates — tasks now `parent: #{story_issue}` rather than `parent: #{epic_issue}`). A sibling `nxs-gh-create-story` skill is added to handle story-as-sub-issue creation with the AC payload. Whether to keep three sibling skills or generalize with a `parent_type` parameter is an implementation choice, not a strategic one.

## What survives unchanged

For the record — these ride through the pivot without modification:

- **`nxs-workspace-setup`** skill (worktree, branch, env coordination)
- **`nxs-env-sync`** skill (env file propagation to worktrees)
- **`nxs-abs-doc-path`** skill (path resolution utility)
- **Council** as single-mode cross-functional deliberation (Q4 D7)
- **QA agent definition** structure (three modes); only design-mode input contract changes (Q4 D6)
- **Right-sizing concept** (M as ceiling, decompose-or-reduce options) — only the stage where the gate fires changes
- **Standards template** `_template.md` (Principles / Rules / Patterns / Anti-Patterns / Checklist)
- **Changeset-approval pattern** (Q2 D14)

## Action items

### GH integration
- [ ] Implement `/nxs.iteration`, `/nxs.epic`, `/nxs.tasks` opt-in prompts for GH issue creation at their respective layers.
- [ ] Add `nxs-gh-create-story` skill (or extend existing skills with `parent_type`).
- [ ] Update `nxs-gh-create-task` frontmatter handling: `parent` is the story issue, not the epic.
- [ ] Add `/nxs.init` step to verify or create custom issue types (Objective, Epic, Story, Task) at the project layer.

### Branch and ship
- [ ] Update `/nxs.start` to operate on stories; create `feat/{story-id}-{slug}` branch.
- [ ] Update `/nxs.ship` to operate on stories: find existing PR or create one, write consolidated summary, close task sub-issues, close story issue, tear down worktree.
- [ ] Document explicitly that `/nxs.ship` does not detect or block on mid-flight branch entanglement.

### Standards
- [ ] Ensure standards live under `<docs-root>/system/standards/` (default `./docs/system/standards/` in-repo per Q3 D13; multi-repo or out-of-tree via Q3 D14 helper).
- [ ] Update `/nxs.decide` to consume standards as conformance input; non-conformance surfaces for justification in the decision record.
- [ ] Update `/nxs.qa --mode design` to pull standards-mandated test coverage.
- [ ] Update `/nxs.tasks` to surface relevant standards as gotchas in task entries.
- [ ] Update bootstrapped `CLAUDE.md` to reference the standards path (via the Q3 D14 helper) as a pointer.

### Right-sizing
- [ ] Move the right-sizing gate to `/nxs.iteration` decomposition output (architect-consultation flag → PM decision).
- [ ] Add a confirm-only ceiling check at `/nxs.epic` time (post-AC).

### `/nxs.init` expansion
- [ ] Verify or create GH custom issue types for the project.
- [ ] Resolve the docs root (default `./docs/` in-repo with `.graphifyignore`; honor `.nexus/config` overrides per Q3 D13/D14).
- [ ] Bootstrap `<docs-root>/system/standards/` from `_template.md`.
- [ ] Retain `<docs-root>/system/stack.md` bootstrap.
- [ ] Install Graphify git hooks.

### QA artifact paths
- [ ] Update `/nxs.qa --mode design` to write `qa_issues.json` to `<story-folder>/` instead of `<epic-folder>/`.

## Open questions

- **Cross-repo sub-issue linkage.** When an Objective in `repo-a` parents an Epic in `repo-b`, GH's sub-issue feature gets flaky. Project hierarchy is the cleaner cross-repo seam but lives outside the issue itself. Decision deferred until multi-repo is exercised; mark in implementation that single-repo is the well-tested path.
- **QA convention pack.** Teams that want QA mandatory will need convention-layer enforcement (CI, branch protection). Whether Nexus ships a thin convention pack (suggested CI steps gating `/nxs.close` on QA artifacts) is deferred; carried over from Q4 open questions.
- **`nxs-gh-create-*` consolidation.** Three sibling skills vs one parameterized skill — implementation-time choice, no strategic implication.
- **Multi-repo standards seam.** With the in-repo `./docs/` default (Q3 D13), the question inverts: when does it make sense to *share* standards across repos via Q3 D14's parent-folder override versus letting each repo own its own `./docs/system/standards/`? Likely when several repos in one product converge on shared conventions enforced uniformly. Empirical question — observe during multi-repo rollout.
