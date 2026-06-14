# 2. What's the minimum viable delivery flow?

If we strip Nexus to its essentials with Graphify providing the knowledge layer, what does the pipeline look like? What's the thinnest artifact at each stage that still produces correct implementations? Is it: intent statement → decision record with diagram → task list → implementation → graph update?

## Summary judgment

The pivoted flow is thinner than today's pipeline at every stage where the artifact was *describing context* the graph now provides, and unchanged (or stronger) at every stage where the artifact was *forcing a human judgment*. The PM input shifts from elaborate feature briefs to two durable artifacts: a curated concept inventory and per-iteration scope deltas over that inventory. Decomposition into epic stubs is PM-led with Architect-agent consultation for sizing and technical-seam feedback — not a council activity. Council stays in its original single-mode role (ad-hoc cross-functional deliberation), default-on for L epics at the `/nxs.decide` stage. Every stage where an agent generates content for a human to own (concepts, epic stubs, acceptance criteria, decisions) is gated by an explicit changeset-approval checkpoint so curation never silently transfers from human to agent.

## The pivoted flow

```
PM curates concepts (continuous, not per-iteration)
        │
        ▼
/nxs.iteration <scope-prose>
   ├── /nxs.concept  (extract / validate / evolve, internally)
   │      └── concept changeset → PM approves
   └── PM drafts epic stubs with Architect-agent consultation
          (effort sizing, technical seams, integration risks — advisory only)
          └── stubs (M-ceiling, capability-first) → PM approves per stub
        │
        ▼
/nxs.epic <stub-id>
   PM authors acceptance criteria
   right-sizing gate (M-ceiling check)
        │
        ▼
/nxs.decide   (renamed from nxs.hld)
   focused decision record + impact diagram from graph
   council in deliberation mode (default-on for L epics)
        │
        ▼
/nxs.tasks
   task index (no per-task LLDs)
   each task: scope, graph pointers, dependencies, gotchas, test expectations
        │
        ▼
/nxs.qa --mode design   (unchanged)
        │
        ▼
/nxs.dev <task>
   agent reads graph + task pointers (no pre-baked LLD)
        │
        ▼
/nxs.qa --mode implement / verify   (unchanged)
        │
        ▼
/nxs.close
   decision-record drift check vs graph delta
   changelog entry, archive, graph self-updates via Graphify
```

## Decisions

### D1. Each artifact must be a forcing function for a human decision, or it's cut

The frame for every stage in the pipeline. Sections that describe current system state, re-summarize code, or auto-generate boilerplate are scaffolding — the graph provides this. Sections that force a human to commit to scope, AC, trade-offs, or risk decisions are forcing functions and stay (often reshaped, rarely removed).

### D2. `/nxs.hld` is renamed to `/nxs.decide`

The artifact is a decision record, not a design document. The graph describes the system; the pipeline must record *what we intend* and *why we chose this over alternatives*. Renaming clarifies intent and prevents the new lighter document from accreting back into a 16-section template.

### D3. Tasks become an index, not a folder of LLDs

`/nxs.tasks` outputs a task index. Each task entry contains: title, 1-paragraph scope, graph pointers (nodes/files affected), dependencies, test expectations, and a `## Gotchas` section for non-obvious constraints the graph cannot surface. Per-task LLDs are dropped.

### D4. PIRs are replaced by graph delta + changelog entry linking to the decision record

The "what shipped" record is `git log` + the Graphify-derived graph delta. The "why we did it" record is the decision record. PIRs as standalone prose are dropped. `/nxs.close` is responsible for emitting the changelog entry and running the drift check (see D11).

### D5. Feature briefs are dropped; PMs curate concepts continuously

The PM artifact shifts from per-feature briefs to a durable concept inventory under `docs/concepts/`. Concepts persist across quarters; iterations reference them as deltas (extend / introduce / retire).

### D6. Concepts are not communities — they are related layers, not the same layer

| Concept layer | Community layer |
|---|---|
| PM-authored vocabulary | Graph-derived topology (Leiden) |
| Human-readable, intent-bearing | Coupling-based, mechanical |
| Can exist before code (declared) | Only exists once code does |
| Stable across refactors | Shifts when code is restructured |

Concept pages reference communities as evidence of realization. Treating them as identical collapses the distinction and breaks the ability to declare a concept before code exists.

### D7. Concept lifecycle states are explicit

`Declared → Emerging → Established → Evolving → Deprecated`. State transitions are observable from community evidence (no community = declared; partial = emerging; stable matching = established; community shape changing under the concept = evolving; sunset flagged by PM = deprecated).

### D8. Iteration scope replaces the feature brief as the PM's per-cycle input

Scope is a delta over the concept inventory plus a strategic "why now" paragraph. The strategic intent that previously lived in feature briefs lands here at the iteration level; per-change why lives in decision records; concept pages stay timeless.

### D9. Decomposition is PM-led with Architect-agent consultation, not a council activity

Carving iteration scope into epic stubs is fundamentally PM judgment about user-value boundaries. The Architect agent provides advisory input — effort sizing, technical seams that suggest natural boundaries, integration risks between candidate stubs — but does not co-author the carving. Council stays in its original single-mode role: ad-hoc cross-functional deliberation, default-on for L epics at the `/nxs.decide` stage. Keeping council out of decomposition eliminates the prompt-drift risk of one tool playing two distinct jobs and matches how the work actually divides — PM owns user-value carving, Architect informs sizing.

### D10. M complexity is a ceiling, not a target

"Each epic must be ≤ M. Smaller is fine." Wording matters: "target" forces gerrymandering (combining unrelated work to hit M, or splitting cohesive work to avoid L). Ceiling does not.

### D11. Decision-record drift is checked at `/nxs.close`

`/nxs.close` diffs the decision record against the graph delta and prompts the dev (or council) to either update the decision record (if the implementation legitimately diverged for sound reasons) or justify the divergence. Without this check, the PIR's drift-detection function is lost when the PIR is dropped.

### D12. Acceptance criteria stay PM-authored at epic elaboration

Council decomposition produces epic stubs (intent + complexity ceiling + capability boundary), not full epics. AC is authored by the PM during `/nxs.epic <stub-id>`. This preserves the most important human-judgment artifact in the pipeline; AC must never be agent-generated and rubber-stamped.

### D13. New command `/nxs.concept` (three modes, not two)

Modes:

| Mode | Input | Output |
|---|---|---|
| Extract | unstructured prose (e.g. iteration scope text) | N candidate concepts, each tagged: `new` / `extends-X` / `matches-X` |
| Validate | one concept idea from PM | `new` / `extends-X` / `conflicts-with-X` / `similar-to-X (decide)` |
| Evolve | existing concept + delta | updated draft showing state transition |

The Evolve mode is non-optional — without it, refinements get miscategorized as new concepts (library bloat) or duplicates (lost change record). Naming is `/nxs.concept` rather than `/nxs.conceptualize` for symmetry with `/nxs.epic`, `/nxs.tasks`, `/nxs.dev`, `/nxs.decide`.

### D14. Changeset-approval is mandatory for any concept or scope change

`/nxs.iteration` may invoke `/nxs.concept` internally, but the resulting concept changeset is always surfaced to the PM for explicit accept / edit / reject before proceeding. Concept docs are written to disk only on approval. Same pattern for epic stubs: even though the PM authors them with Architect-agent consultation, each stub gets an explicit per-stub checkpoint before iteration commits. This is the single most important guardrail — without it, the curation function silently transfers from human to agent and concept-first PM collapses back into agent-driven brief generation within a quarter.

### D15. Visualizations replace prose only for "what is," never for "why"

Graph-derived diagrams (system context, impact, dependency graphs) replace the descriptive sections of the old HLD. They do not replace the deliberative sections — trade-offs, alternatives considered, non-goals, risks — which remain prose because they are inherently linguistic.

## Schemas

### Concept page (`docs/concepts/<name>.md`)

```yaml
---
concept: "org-resolution"
state: "established"          # declared | emerging | established | evolving | deprecated
aliases: ["org lookup", "organization matching"]
communities: ["c-42", "c-87"] # graphify community refs as evidence
declared_in: "iterations/2025-Q3-foundations"
last_updated_by: "#142"       # github issue/PR
---
# Org Resolution
<2-3 sentence summary>

## How it works
## Key invariants
## Integration points
## Decision log
```

### Iteration scope (`docs/iterations/<id>/iteration.md`)

```yaml
---
iteration: "2026-Q2-enterprise"
why: "Enterprise rollout depends on nested-org support and bulk admin operations"
extend: ["org-resolution", "space-membership"]
introduce: ["bulk-invite", "nested-org"]
retire: ["legacy-invite-link"]
---
```

### Epic stub (output of council decomposition)

```yaml
---
stub_id: "2026-Q2-enterprise/01-nested-orgs"
title: "Nested-org support in org-resolution"
complexity_ceiling: "M"
touches_concepts: ["org-resolution"]   # extends or introduces
capability: "Users in a parent org can resolve into child-org contexts on request"
dependencies: []                        # other stub IDs
integration_risks: ["session token format change affects auth"]
---
<3-line intent paragraph>
```

## Patterns and guardrails

### Changeset-approval pattern (universal)

Any agent-generated artifact that becomes part of the PM's curated layer (concepts, epic stubs, AC drafts) is emitted as a *changeset* surfaced to the PM. PM accept / edit / reject. Disk writes happen on approval only.

### Capability-first carving rule

PM is responsible for ensuring each epic stub ships at least one user-perceivable capability or measurable system improvement on its own. The Architect-agent consultation prompt flags candidate stubs that lack this property so the PM can reshape or merge them. Antibody against M-sized-but-invisible epics where epics 1-3 ship nothing the user perceives and value lands only when 4 completes.

### Layered concept matching (for `/nxs.concept`)

Cross-check ordering, cheapest first:

1. Name + alias exact match
2. Description full-text similarity
3. Graph community overlap (where the candidate maps in the code)
4. Model semantic judgment (last, expensive, black-box)

Specified explicitly to prevent inconsistent dedup behavior across runs.

### Cold-start mode for `/nxs.concept`

First-run detection: if concept inventory is empty, switch to bootstrap mode. Run a concept-discovery pass over existing code (via Graphify communities) plus existing docs, propose an initial concept set, surface as a changeset for PM curation. Without this, the first ten iterations create a chaotic inventory.

### Reverse direction loop (community → concept suggestion)

After implementation, if Graphify detects a new community that doesn't map to any declared concept, the system flags it: "a new community emerged that doesn't have a PM concept page — author one or mark it internal-only." Without this, concept curation drifts behind reality and the bridge breaks in the engineering → PM direction.

### Gotchas section in tasks

Each task entry has a `## Gotchas` section for non-obvious constraints ("this looks innocent and isn't," "we tried the obvious approach in #38 and it broke X"). The graph cannot surface these. This is the single biggest implementation risk if LLDs are dropped without compensating capture.

### Verdicts are advisory, never confident-rejection

`/nxs.concept` Validate mode never returns "this is superfluous." It returns "concept X covers Y%, concept Z covers part of the rest — do you still want this as a distinct concept?" The decision stays with the PM. Concepts may be technically covered by combinations of existing concepts but still warrant separate naming for stakeholder communication.

## Action items

### Pipeline changes
- [ ] Rename `/nxs.hld` → `/nxs.decide`. Update agent prompts to produce a focused decision record (what / approach / alternatives / trade-offs / non-goals / impact diagram), not a 16-section design document.
- [ ] Modify `/nxs.tasks` to emit a task index (single file or one-file-per-task with thin frontmatter), drop per-task LLD generation, add `## Gotchas` section to task schema.
- [ ] Add decision-record drift check to `/nxs.close`: diff decision record against graph delta, prompt for record update or justification.
- [ ] Replace PIR generation in `/nxs.close` with a changelog entry linking to the decision record.

### New commands
- [ ] Build `/nxs.iteration`: takes iteration scope prose, invokes `/nxs.concept` Extract internally, runs Architect-agent consultation for sizing and technical-seam feedback on PM-drafted stubs, surfaces concept changeset and epic stub list for PM approval.
- [ ] Build `/nxs.concept` with three modes (Extract / Validate / Evolve), layered cross-check, cold-start mode, drafts-only output.

### Architect consultation and council changes
- [ ] Add Architect-agent consultation pattern used by `/nxs.iteration`: input is iteration scope + PM-drafted stubs (or candidate stubs); output is sizing per stub, technical-seam observations, integration risks, capability-first checks. Advisory only — PM owns the final stubs.
- [ ] Make council default-on for L epics at `/nxs.decide` stage. Council role and prompt remain unchanged from today.
- [ ] Confirm council is *not* invoked from `/nxs.iteration` to keep its single-mode role intact.

### Schemas and storage
- [ ] Define `docs/concepts/` directory with concept-page schema (frontmatter + sections).
- [ ] Define `docs/iterations/<id>/` directory with iteration scope schema and per-stub epic folders.
- [ ] Define epic stub frontmatter and PM approval flow.
- [ ] Migrate existing `docs/features/<feature>/` to the new structure (one-time bootstrap, council-driven where ambiguous).

### Graphify integration
- [ ] Decide integration model (subprocess CLI / MCP / library) — depends on Q3 output.
- [ ] Implement community-evidence linkage in concept pages (`communities: [c-id, ...]`).
- [ ] Implement reverse-direction loop: after implementation, flag new communities without concept pages.
- [ ] Implement graph-pointer resolution for task entries (resolve `community/node refs to file paths at dev time).

### Pattern enforcement
- [ ] Implement changeset-approval flow as a reusable pattern (used by `/nxs.iteration`, `/nxs.concept`, council decomposition).
- [ ] Implement capability-first carving as part of the Architect-agent consultation prompt and as a check at PM stub-approval time.
- [ ] Implement layered matching algorithm in `/nxs.concept`.

## Rollout plan

Three phases, each independently shippable, ordered by reversibility and learning value.

### Phase 1: decision-record swap (1-2 epics, isolated experiment)

Goal: validate that downstream stages (tasks, dev, QA) work with a 1-2 page decision record instead of a 16-section HLD. Everything else stays as today.

Steps:
1. Implement `/nxs.decide` alongside existing `/nxs.hld` (both available).
2. Pick 2 in-flight epics — one M, one L. Run them through `/nxs.decide` instead of `/nxs.hld`.
3. Observe: did task generation produce reasonable specs? Did dev agent ask follow-up questions it wouldn't have asked with an HLD? Did QA find anything the lighter doc missed?
4. Decide: either commit to the rename, or identify what's missing from the decision record format.

Risk if skipped: lighter docs ship in production without isolation, and downstream regressions get blamed on the wrong cause.

### Phase 2: concept-first foundation (one team, full quarter)

Goal: establish concept inventory and prove that PMs can author/curate concepts as a durable artifact.

Steps:
1. Build `/nxs.concept` (all three modes, cold-start mode, layered matching, drafts-only).
2. Bootstrap concept inventory from existing codebase + docs via cold-start mode.
3. PM curates the proposed inventory (expect 1-2 weeks of cleanup).
4. Run one full iteration with the concept inventory as PM's working layer, but still use legacy `/nxs.epic` flow downstream. Observe whether PMs maintain the inventory under real workload.
5. Build reverse-direction loop (community → concept suggestion) once Graphify is integrated enough to emit community deltas.

Risk if skipped: full iteration flow ships without proven PM adoption of concept curation; PMs revert to brief-writing in concept-page disguise.

### Phase 3: full iteration flow (team-wide)

Goal: replace per-feature entry points with iteration scope + council decomposition.

Steps:
1. Build `/nxs.iteration` integrating `/nxs.concept` (Extract) and council (decomposition mode).
2. Implement changeset-approval pattern, per-stub PM checkpoint.
3. Cut over from `/nxs.epic` as entry point to `/nxs.iteration` as entry point. `/nxs.epic` continues to exist but operates on epic stubs, not free-form briefs.
4. Implement decision-record drift check in `/nxs.close`. Drop PIR generation.

Risk if skipped or rushed: stub generation without per-stub checkpoints silently transfers carving authority to the Architect agent; iteration scope without changeset approval bypasses concept curation.

## Adjacent decisions captured here (beyond strict Q2 scope)

These emerged during Q2 discussion and are decision points the action plan depends on. They cross-reference into Q3-Q7 territory but must be settled for Q2 to be coherent.

- **PM input mechanics (Q2 → Q6 territory):** PM authors iteration scope as prose; system extracts/dedupes/creates concepts; PM approves the changeset. Stakeholders external to Nexus still speak in features — PMs are the boundary that translates feature requests into concept deltas. This is an organizational lift, not just a tooling change.
- **Council role (Q4 territory):** council remains an ad-hoc cross-functional deliberation tool, single-mode. The only change is that it becomes default-on for L epics at the `/nxs.decide` stage rather than purely opt-in. It is *not* the decomposition engine — decomposition is PM-led with Architect-agent consultation.
- **Graphify coupling depth (Q3 territory):** the action items above assume concept pages can reference Graphify community IDs and that graph deltas are queryable at close time. Whether this is via subprocess CLI, MCP, or a deeper integration is decided in Q3 — but Q2 commits to the dependency.
- **Agent role changes (Q4 territory):** `nxs-architect` produces decision records (not 16-section HLDs) and provides advisory consultation to `/nxs.iteration` for sizing and technical seams; `nxs-decomposer` is retired (its function is absorbed by PM-led decomposition with Architect consultation); per-task LLD generation is removed from `nxs-architect`'s responsibilities; `nxs-analyzer` shifts from inter-document consistency to decision-vs-reality drift checks.
- **Bridge of understanding (Q6 territory):** concept pages serve PMs (durable vocabulary). Decision records serve engineers (why we chose what we chose). Iteration scopes serve leadership (slate-level intent and progress). The graph serves all three but as a substrate, not a stakeholder-facing artifact.

## Open questions

- **Concept inventory size:** what's the minimum coverage before iteration scope becomes useful? Empirically probably 15-30 concepts, but should be measured during Phase 2.
- **Iteration cadence:** is one iteration per quarter, per month, or per sprint? Affects how heavy iteration scope can be and how often `/nxs.iteration` runs.
- **Multi-PM concept conflict:** what happens when two PMs propose conflicting concept changes in overlapping iterations? Needs a merge/conflict pattern, not yet specified.
- **Concept versioning:** when a concept evolves significantly, do we keep history in the page, branch the concept, or just rewrite? Affects long-term traceability.
- **Brief-to-concept migration:** for existing repos with `docs/features/<feature>/README.md`, what's the deterministic migration? One-shot bootstrap is mentioned but the algorithm is not specified.
