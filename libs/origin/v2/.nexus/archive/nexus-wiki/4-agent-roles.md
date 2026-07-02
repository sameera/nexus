# 4. Agent and command roles after the pivot

## Summary judgment

The pivot retires two agents (`nxs-dev`, `nxs-decomposer`), introduces one (`nxs-curator`), and rewires the rest around the new artifact set. The architect remains a single agent operating at two stages — decision-record authoring at `/nxs.decide` and advisory consultation at `/nxs.iteration` — kept single-role on prompt-drift grounds, but watched closely so consultation does not balloon back into a 16-section equivalent. The dev agent is removed entirely; `/nxs.dev` is replaced by a one-shot boundary pair, `/nxs.start` and `/nxs.ship`, that handle workspace setup and closure mechanics without sitting across the engineer's work. The analyzer survives but pivots its job from inter-document consistency (gone with the documents that supported it) to decision-vs-reality drift detection at `/nxs.close`. QA's agent definition is unchanged, but its design-mode prompt inputs change materially and must be updated. The middle of the pipeline (`/nxs.tasks`, `/nxs.start`, `/nxs.qa`, `/nxs.ship`) is explicitly optional: engineers may skip all of it, code by hand or with an unsupported tool, and the loop still closes — because `/nxs.close`'s contract depends only on the decision record and graph snapshots, not on the optional middle.

## Decisions

### D1. `nxs-architect` is a single agent operating at two stages

The architect produces the decision record at `/nxs.decide` and provides advisory consultation at `/nxs.iteration` (effort sizing, technical seams, integration risks, capability-first checks). It does not author HLDs — the 16-section template is gone — and it does not generate per-task LLDs.

**Why:** these are sibling architectural-reasoning jobs at adjacent stages, not the two-distinct-jobs case that Q2 D9 split council away from. Splitting them would over-fragment the agent roster.

**How to apply:** the call site supplies a stage-specific prompt; the agent definition stays single. Code review watches for prompt drift — consultation prompts must stay focused on sizing/seams/risks and must not accrete decision-record sections.

### D2. `nxs-decomposer` is retired

Decomposition into epic stubs is PM-led with architect-agent consultation (Q2 D9). No agent owns "decompose into stubs" as a primary function.

**Why:** decomposition is PM judgment about user-value boundaries; an agent in that seat silently transfers carving authority away from the human (Q2 D14).

**How to apply:** any new call site requesting agent-led decomposition is a code-review reject. The architect-agent consultation prompt is advisory only; PM owns the final stubs.

### D3. `nxs-dev` is retired; `/nxs.dev` becomes a boundary pair

The dev agent is removed. `/nxs.dev` is renamed `/nxs.start` and reduced to a one-shot orchestration command: workspace setup (worktree, branch, env sync), context print (task index entry + decision-record link + graph pointers + test expectations), exit. The existing `nxs-ship` skill is promoted to a top-level command `/nxs.ship`: commit hygiene, GitHub summary, issue close, worktree teardown — also one-shot.

The engineer's work between `start` and `ship` is theirs. Plan mode, a fresh Claude Code session in the worktree, Codex, a custom subagent, manual edits, an unsupported LLM — all fine. Nexus does not own the implementation step.

**Why:** the pivot reframes Nexus as a delivery harness, not a generation engine. A single command spanning the engineer's work either blocks (in the way) or fake-handoffs (useless). Two boundary commands are the correct shape for orchestration that stays out of the middle. The agent's prior value (LLD execution + test-first prompt + summary posting) is either obsolete (no LLD) or skill-shaped (workspace setup, ship) or guidance-shaped (test-first defaults belong in `CLAUDE.md`, not in a forced agent prompt).

**How to apply:** `CLAUDE.md` becomes the load-bearing guidance layer for implementation-time behavior (graph-aware navigation, test-first defaults, ship-checkpoint discipline). `/nxs.init` is responsible for bootstrapping it. Nexus does not gate model or agent choice at implementation time.

### D4. `nxs-analyzer` shifts from document consistency to drift detection

The analyzer's prior job — checking coverage and consistency across epic, HLD, and task LLDs — disappears with the documents that supported it. Its new job is decision-record-vs-reality drift detection at `/nxs.close`: diff the decision record against the graph delta and surface divergences for the dev (or council) to either justify or reconcile by updating the decision record.

**Why:** the graph is authoritative for "what is"; the analyzer's value moves to the only consistency question that remains — "did we ship what we decided?"

**How to apply:** prompt rewrite focused on drift attribution (where the implementation diverged), divergence assessment (intentional vs. accidental), and remediation guidance (update record vs. justify in changelog).

### D5. New agent `nxs-curator` owns the concept layer

A new agent backs `/nxs.concept` and its three modes (Extract, Validate, Evolve). It performs concept extraction from prose, layered matching against the inventory, and evolve-mode delta authoring.

**Why:** concept curation is a distinct semantic job — neither architecture, nor decomposition, nor PM advocacy. Folding it into `nxs-architect` would replay the prompt-drift trap that Q2 D9 split council away from.

**How to apply:** curator outputs are always changesets surfaced to the PM (Q2 D14). The curator is never authoritative over the concept inventory; the PM is. The curator's cross-check ordering is layered (Q2 patterns), with model semantic judgment last.

### D6. `nxs-qa` agent definition is unchanged; design-mode prompt inputs change materially

The QA agent's three modes (design, implement, verify) are structurally preserved. Its discipline (functional, OWASP, performance, accessibility, monkey testing) is unchanged. But the design-mode input contract shifts: it no longer reads an HLD's testing-strategy section. It reads the decision record + graph (for impact and surface area) + task index (for AC and gotchas).

**Why:** the agent role is the same QA work; only its source documents changed.

**How to apply:** prompt update for design mode is required (input contract change). Implement and verify modes carry forward with minimal change — they already operate on tests and the live system, not on upstream docs.

### D7. `nxs-council-pm` and `nxs-council-architect` are unchanged

Council remains single-mode (cross-functional deliberation) and default-on for L epics at `/nxs.decide` (Q2 D9, adjacent decisions). Recorded here for roster completeness.

**How to apply:** council is *not* invoked from `/nxs.iteration` (Q2 action items) — keeping its single-mode role intact.

### D8. The PIR-author role is retired

No agent authors PIRs; the prose document is replaced by graph delta + changelog (Q2 D4). `/nxs.close` orchestrates the changelog and drift check directly via `nxs-analyzer`; no PIR-author agent exists.

### D9. Pipeline optionality: skeleton vs. middle

Pipeline commands divide into a required skeleton (judgment forcing functions) and an optional middle (execution ergonomics):

| Stage | Status | Why |
|---|---|---|
| `/nxs.iteration` | required | Concept-layer curation; iteration-start anchor |
| `/nxs.epic` | required | PM-authored AC (Q2 D12) |
| `/nxs.decide` | required | Decision record (Q2 D2); records iteration-start graph snapshot |
| `/nxs.tasks` | optional | Task index is execution ergonomics |
| `/nxs.start` | optional | Workspace setup convenience |
| `/nxs.qa` (any mode) | optional | Engineer may have their own test flow |
| `/nxs.ship` | optional | Engineer may commit and close themselves |
| `/nxs.close` | required | Drift check + changelog (Q2 D4, D11) |

Engineers may skip the entire middle — manual coding, unsupported LLM, custom workflow — and the loop still closes. The skeleton is the judgment surface the pivot was designed to preserve; forcing the middle re-creates the documentation-pipeline bottleneck the pivot removed.

**What the engineer trades by skipping the middle:**

- Loses: task-level changelog granularity (drift is iteration-level), the QA gate as a forcing function for AC validation, standardized branch naming and ship summary format.
- Gains: freedom of tool, model, agent, workflow; less ceremony for small or exploratory work.

**How to apply:** user-facing docs and `CLAUDE.md` mark each command as required or optional. Convention-layer enforcement (CI gates, branch protection) belongs outside Nexus — teams may make QA mandatory by team policy without Nexus enforcing it.

### D10. `/nxs.close` is engineered to tolerate a missing middle

The drift check requires only the decision record (on disk from `/nxs.decide`) and a pair of graph snapshots (iteration-start recorded by `/nxs.decide`, current state derived from Graphify's git-hook-maintained graph). It does not require a task index, a Nexus-managed worktree, QA artifacts, or a ship summary.

**Precondition handling:**

- Happy path: iteration-start snapshot exists → drift check → changelog → close.
- Missing snapshot: error with actionable hint (e.g. "iteration-start snapshot missing — was `/nxs.decide` run? Use `--skip-drift` to close without the drift check").
- Uncommitted code at close time: error or warn — drift check operates on last-committed state per Q3 D11.

**Why:** enforces the dependency on `/nxs.decide` (which is required) without forcing the optional middle.

## Agent roster snapshot

Six agents post-pivot, down from seven. Two retired (`nxs-dev`, `nxs-decomposer`); one added (`nxs-curator`).

| Agent | Role | Stage(s) | Model |
|---|---|---|---|
| `nxs-architect` | Decision-record author; advisory consultation on sizing/seams | `/nxs.decide`, `/nxs.iteration` | Opus |
| `nxs-curator` | Concept extract / validate / evolve | `/nxs.concept` | Sonnet |
| `nxs-analyzer` | Decision-vs-reality drift detection | `/nxs.close` | Sonnet |
| `nxs-qa` | Test design, implementation, verification | `/nxs.qa --mode *` | Sonnet |
| `nxs-council-pm` | Cross-functional deliberation (PM perspective) | `/nxs.decide` (default-on for L) | Inherit |
| `nxs-council-architect` | Cross-functional deliberation (architect perspective) | `/nxs.decide` (default-on for L) | Inherit |

Model assignments for the new and re-roled agents are starting points; revisit empirically during phased rollout.

## Command shape changes

| Before | After | Note |
|---|---|---|
| `/nxs.hld` | `/nxs.decide` | Renamed; decision record, not 16-section design (Q2 D2) |
| `/nxs.dev` (agent-driven, spans implementation) | `/nxs.start` (one-shot orchestration) | Boundary command; engineer's middle is theirs (D3) |
| `nxs-ship` (skill, invoked from `/nxs.dev`) | `/nxs.ship` (top-level command) | Promoted for symmetry with `/nxs.start` (D3) |
| `/nxs.tasks` (LLDs per task) | `/nxs.tasks` (task index) | Role change (Q2 D3) |
| `/nxs.close` (PIR generation) | `/nxs.close` (drift check + changelog) | Role change (Q2 D4, D11; D10 above) |
| — | `/nxs.iteration` | New (Q2) |
| — | `/nxs.concept` | New (Q2 D13) |

## Action items

### Agent definitions
- [ ] Retire `nxs-dev` agent definition.
- [ ] Retire `nxs-decomposer` agent definition.
- [ ] Update `nxs-architect`: remove HLD section template, remove per-task LLD generation, add decision-record output format, add iteration-consultation prompt mode (sizing, seams, risks, capability-first checks).
- [ ] Update `nxs-analyzer`: remove inter-document consistency prompts; add drift-detection prompts (decision record vs. graph delta, divergence attribution, remediation guidance).
- [ ] Add `nxs-curator` agent: three modes (Extract, Validate, Evolve), layered cross-check ordering, drafts-only output gated by changeset approval.
- [ ] Update `nxs-qa` design-mode prompt: shift input contract from HLD to decision record + graph + task index. Verify and implement modes unchanged.

### Command definitions
- [ ] Rename `/nxs.dev` → `/nxs.start`. Strip agent invocation. Implement: workspace setup (via `nxs-workspace-setup`) + context print (task entry, decision-record link, graph pointers, test expectations) + exit.
- [ ] Promote `nxs-ship` skill to `/nxs.ship` top-level command.
- [ ] Update `/nxs.close`: remove PIR generation; orchestrate drift check via `nxs-analyzer`; emit changelog entry; handle missing-snapshot precondition with actionable error or `--skip-drift` fallback.
- [ ] Update `/nxs.tasks` per Q2 D3 (already in Q2 action items; cross-referenced here for completeness).
- [ ] Update `/nxs.decide` per Q2 D2 (already in Q2 action items).

### Guidance layer
- [ ] Update `/nxs.init` to bootstrap `CLAUDE.md` with: Graphify pointer (graph adapter usage at implementation time), task-index conventions, test-first defaults, ship-checkpoint guidance.
- [ ] Mark each pipeline command as required or optional in user-facing docs and `CLAUDE.md`.

### Cross-cutting
- [ ] Audit prompt drift in `nxs-architect` consultation mode during Phase 1 rollout — flag if iteration-consultation output starts to resemble decision-record content.

## Open questions

- **Dev-time agent capability sufficiency:** post-retirement of `nxs-dev`, is the engineer's chosen agent (default Claude Code, Plan mode, custom subagent) consistently capable enough for graph-driven implementation without pre-baked LLDs? Observe during Phase 1; do not pre-decide.
- **`nxs-qa` optionality friction:** teams that want QA mandatory will rely on convention-layer enforcement (CI, branch protection). Whether Nexus should provide a thin "convention pack" (e.g., suggested CI steps that gate `/nxs.close` on `/nxs.qa --mode verify` artifacts) is deferred — it crosses into Q5 ("what stays") territory.
- **Curator agent scope creep risk:** if `nxs-curator` starts to be invoked outside `/nxs.concept` (e.g., for ad-hoc concept lookups inside `/nxs.iteration`), it risks the same dual-role drift Q2 D9 warned about. Watch the call sites; keep curator scoped to concept-layer operations only.
