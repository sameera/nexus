# 0002 — Pipeline audit: keep / slim / cut per stage

**Status:** Audit complete. Classification only — replacement artifacts are not designed here.
**Date:** 2026-06-10
**Builds on:** [`0001-refactor-direction.md`](./0001-refactor-direction.md) (the razor, Decisions 1 & 4).
**Reconciles with:** [`0003-library-schema.md`](./0003-library-schema.md) (fixed input; "→ library" entries below name its actual receiving fields).

**The razor (0001):** every output is either a forcing function for a decision a human must
make (→ `docs/`, lean) or it is agent scaffolding (→ cut from the human surface; relocate to
`.nexus/library/` only if it has a receiving field in 0003, fed at a 0003 trigger).

**Library mechanics (0003), applied throughout:** the single steady-state write trigger is
**epic close** (§8.1) — design-time content never writes to the library directly; it survives
into the close record and is emitted there as per-concept `LibraryDelta`s (§8.2). §8.3 hard-rejects
code, file paths, type names, API/schema specs, and speculative design-time claims — those are
**cut with no relocation, deliberately** (not schema gaps).

Evidence base: `claude/.claude/commands/*.md`, `claude/.claude/agents/*.md`,
`claude/.claude/skills/*/SKILL.md`, `common/docs/system/delivery/task-template.md`.

---

## 1. `/nxs.init` — bootstrap system docs

Source: `claude/.claude/commands/nxs.init.md`.

| Artifact | Output | Verdict | → library | Rationale |
|---|---|---|---|---|
| `docs/system/stack.md` | Technology stack | **keep** | — | Human-maintained ground truth; consumed by design and engineers. Not generated speculation. |
| `docs/system/standards/*.md` | Project standards | **keep** | — | Codified judgment; forces conformance decisions. 0003 §2.2 explicitly names it the home for file paths / code patterns the library rejects. |
| `docs/system/README.md` | Navigation index | **cut** | — | Generated contents listing; same reasoning 0003 §7 used to kill the library index — glob and CLAUDE.md links already serve it, and it goes stale. |
| `CLAUDE.md` refactor | Link-out edits | **keep** | — | Operational hygiene, not a pipeline artifact. |

## 2. `/nxs.product-context` — product context file

Source: `claude/.claude/commands/nxs.product-context.md`.

| Artifact | Output | Verdict | → library | Rationale |
|---|---|---|---|---|
| `docs/product/context.md` | Personas, strategy, anti-goals, metrics, compliance | **keep** | — (rejected by 0003 §8.3: human-judgment prose) | Already self-policing — the command's own section table cuts everything agents don't query. Human-validated product judgment; canonical home for personas (see epic slim below). |

## 3. `/nxs.epic` — epic & user stories

Sources: `claude/.claude/commands/nxs.epic.md`, `claude/.claude/agents/nxs-decomposer.md`.
(Note: CLAUDE.md says this invokes `nxs-council-architect`; the command actually invokes
`nxs-decomposer` — the stub agents are deprecated. Doc drift, flagged for cleanup.)

| Artifact | Output | Verdict | → library | Rationale |
|---|---|---|---|---|
| Right-sizing gate (interactive) | L/XL decomposition prompt, MANDATORY STOP | **keep** | — | The clearest forcing function in the pipeline, and the early over-generation brake 0001 wants. It is an interaction, not a file — keep the gate. |
| `epic.md` · frontmatter | feature, complexity, status, link | **keep** | — | Grep surface for the pipeline; carries the GH linkage. Candidate spot for 0003 §5's `concepts:` reading list (a read aid, not a write). |
| `epic.md` · Description / Business Value / Success Metrics | Value prose, measurable criteria | **keep** | — | The PM judgment the stage exists to force. |
| `epic.md` · User Stories + Acceptance Criteria | Stories, Given/When/Then | **keep** | — | Core forcing function; AC is the contract everything downstream validates against. |
| `epic.md` · Out of Scope / Assumptions / Dependencies / Open Questions | Scope boundary, defaults, ≤3 clarifications | **keep** | — | Scope brake + forced validation of defaults. The clarification limit is good existing discipline. |
| `epic.md` · User Personas table | Persona/goals table | **slim** | — | Re-tabulates `docs/product/context.md` personas. Survives: only epic-specific persona deviations; otherwise reference context.md. |
| `epic.md` · Appendix: Complexity Assessment | S–XL + best/likely/worst table + drivers | **slim** | — | The gate already forced the decision; rating + drivers in frontmatter survive. The three-scenario timeline table is speculative precision — cut. Design-time estimates are rejected by §8.3, no relocation. |
| `epic.md` · Appendix: Glossary | Term/definition table | **cut** | **`aliases:`** frontmatter on the concept pages the terms name, fed at **epic close** via the concept's `LibraryDelta` | Canonical terms are exactly 0003's synonym-findability need. Terms naming a durable shipped concept relocate; epic-local nonce terms drop. |
| GitHub epic issue | Issue via `nxs-gh-create-epic` | **keep** | (it *is* the provenance target: `last_updated_by`, Decision Log attribution per 0003 §2.4) | Tracking surface and the anchor every library provenance reference points at. |
| Folder rename / commit choreography | `{N}-epic-name/` renames | **keep** | — | Convention, not an artifact. |

## 4. `/nxs.hld` — high-level design (16 sections)

Sources: `claude/.claude/commands/nxs.hld.md`, `claude/.claude/agents/nxs-architect.md`.
This is the JSONata pattern's epicenter (0001). The mineable conclusion — 16 sections → a
**focused decision record** — is confirmed by this breakdown. All "→ library" entries here
flow through the **close record** and emit at the close trigger, never at design time (0003 §8.1).

| Section | Verdict | → library (via close) | Rationale |
|---|---|---|---|
| 1. Executive Summary | **slim** | — | Survives as the 2–3 sentence lead of the decision record. |
| 2. Complexity Assessment | **cut** | — | Duplicates the epic appendix and the decomposer's gate output. Pure scaffolding. |
| 3. System Context | **cut** | `touches_added/removed` + Integration Points deltas | Re-describes current system state — which is precisely what the library *supplies as reads* (0003 §1). The HLD should consume library pages here, not regenerate them. Integration *changes* emit at close. |
| 4. Requirements Analysis | **slim** | NFR constraints → `invariants_added` | Survives: ⚠️ NEEDS CLARIFICATION items (forcing) and NFR constraints (e.g., latency budgets — these are invariants). Functional restatement of epic stories is duplication — cut. |
| 5. Architecture Overview | **slim** | behavioral outcome → `how_it_works_delta` | Survives: the chosen approach in a few sentences (+ diagram only if load-bearing). The frontend/API/data layer-by-layer boilerplate is template-filling — cut. |
| 6. Data Model Strategy | **cut** | — (rejected, §8.3: schema specs regenerable from source) | Entity/index/migration detail is the engineer's (0001 Decision 4). Exception: durable data *invariants* (e.g., identifier formats — cf. 0003 §3 example) → `invariants_added`. |
| 7. API Design Strategy | **cut** | — (rejected, §8.3: API specs) | Engineer's domain; rots against source. |
| 8. Frontend Architecture | **cut** | — (rejected, §8.3) | Pure implementation scaffolding. |
| 9. Security Architecture | **slim** | security constraints → `invariants_added` | Security *boundaries and constraints* are human judgment and the highest-value invariant class (cf. 0003's tenant-existence-leak example). Mechanism detail (token plumbing etc.) — cut, engineer's. |
| 10. Key Technical Decisions | **keep** | `decision_log_entry` per affected concept | **The core of the focused decision record.** Decision + rationale is the one thing that cannot be regenerated from code (0001 Decision 3). See schema gap G2 on the Alternatives column. |
| 11. Technical Debt Analysis | **slim** | accepted-debt rationale → `decision_log_entry` | The net-debt judgment call survives as one line in the decision record; the typed severity table is ceremony. |
| 12. Implementation Phases | **cut** | — | Implementation sequencing is the engineer's (0001 Decision 4). Coarse ordering survives in the task index. |
| 13. Risk Assessment | **slim** | — (speculative; rejected §8.3. Risks that *materialize* reach the log via the close record) | Survives: BLOCKER/ADDRESS risks only — those force a human decision before proceeding. The full likelihood×severity matrix is ceremony. |
| 14. Operational Considerations | **cut** | — | Deployment/monitoring/runbooks: engineer's and ops'. |
| 15. Testing Strategy | **cut** | — | `docs/system/standards/` already codifies testing; per-epic restatement is scaffolding. |
| 16. Success Criteria | **cut** | — | Duplicates epic Success Metrics. One home: the epic. |

**Net:** HLD.md → focused decision record built from sections 1(lead), 10(core), plus the
slimmed survivors of 4, 5, 9, 11, 13. Everything else cut.

## 5. `/nxs.tasks` — decomposition & GitHub issues

Sources: `claude/.claude/commands/nxs.tasks.md`, `claude/.claude/agents/nxs-decomposer.md`,
`claude/.claude/agents/nxs-architect.md` (LLD mode), `common/docs/system/delivery/task-template.md`,
`claude/.claude/skills/nxs-generate-tasks/`, `claude/.claude/skills/nxs-gh-create-task/`.

| Artifact | Output | Verdict | → library | Rationale |
|---|---|---|---|---|
| Epic Scope Validation (Step 3, interactive) | Sibling-epic overlap check, MANDATORY STOP | **keep** | — | Forcing function: a scope decision only the human can make. Interaction, not a file. |
| `tasks/TASK-{E}.{NN}.md` · Summary, Dependencies, Acceptance Criteria, effort | Per-task scope contract | **slim** | — | Survives — but folded into the task index and the GH issue body, not as per-task files (0001 mineable: "task index, drop per-task LLDs"). |
| `tasks/TASK-{E}.{NN}.md` · LLD: Files / Interfaces / Implementation Notes | Per-task low-level design from `nxs-architect` | **cut** | — (rejected, §8.3: file paths, TypeScript types) | The heaviest pure-scaffolding output in the pipeline, generated ahead of validated need to drive code generation — exactly what 0001 Decision 4 removes. Deliberate no-relocation. |
| `tasks/TASK-{E}.{NN}.md` · Key Decisions table | Per-task decisions (extracted from HLD) | **cut** | `decision_log_entry` at close | Mostly re-extracts HLD §10. Genuine task-level decisions surface in the close record and emit there. |
| `tasks/TASK-{E}.{NN}.md` · Git Workspace section | Worktree path, branch name | **cut** | — | Tooling convenience; branch naming is a convention, not knowledge. |
| `tasks.md` | Task list by phase, dependency graph, parallelization, effort | **slim** | — | Becomes **the** surviving task artifact: an index (title, summary line, AC pointer, blocked_by, effort) the PjM approves sequencing against. Mermaid graph optional; the `blocked_by` data is the substance. |
| GitHub task issues | One issue per task, parent-linked | **keep** | (provenance targets for 0003 §2.4 references) | The unit engineers pick up; the tracking surface. Bodies slim to summary + AC + dependencies once LLDs are cut. |
| `tasks/task-review.md` | Analyzer findings + remediation log | **cut** | — | Transient process state, regenerable on demand. The Review Checkpoint table (Step 7) is the forcing function and survives as interaction; the persisted file is scaffolding. |
| `/tmp/task-input-*.json`, scratchpad JSONs | Inter-agent glue | **cut** | — | Never was an artifact. |
| epic.md "Implementation Plan" link | One-line link to tasks.md | **keep** | — | Trivial navigation. |

## 6. `/nxs.qa` — three-phase QA

Sources: `claude/.claude/commands/nxs.qa.md`, `claude/.claude/agents/nxs-qa.md`,
`claude/.claude/skills/nxs-qa/`.

**Stage-level flag:** all three modes exist to drive and validate *implementation* — the
engineer's side of 0001 Decision 4's boundary. The whole stage is a relocation-out-of-Nexus
candidate, not just its artifacts.

| Artifact | Output | Verdict | → library | Rationale |
|---|---|---|---|---|
| `qa-test-case` GitHub issues (design mode) | Per-scenario test specs | **cut** | — | Re-describes epic acceptance criteria as test scenarios — derivable from the AC the epic already keeps. Testing strategy belongs to the engineer. |
| `<epic-folder>/qa_issues.json` | Issue-ID metadata | **cut** | — | Machine glue for the cut stage. |
| Test suites + execution logs (implement mode) | Playwright/integration tests | **cut** | — | Code is the engineer's; it lives in the repo regardless of Nexus. |
| `dist/qa/<epic>/QA-REPORT-*.md` (verify mode) | Functional/OWASP/perf/a11y report | **cut** | — (indirect path exists: a finding that changes behavior enters the Decision Log via the epic that fixes it — exactly 0003 §3's pentest example `#98`) | Verification scaffolding. The go/no-go is the human's, but the human needs the failure summary, not a generated report artifact in the pipeline's custody. |

## 7. `/nxs.dev` (+ `/nxs.yolo.dev`) — implementation

Sources: `claude/.claude/commands/nxs.dev.md`, `claude/.claude/commands/nxs.yolo.dev.md`,
`claude/.claude/agents/nxs-dev.md`, `claude/.claude/skills/nxs-workspace-setup/`,
`claude/.claude/skills/nxs-ship/`.

**Stage-level flag:** this stage *is* the code-generation engine 0001 Decision 4 says Nexus is
not. Strongest cut candidate in the pipeline — implementation is left to engineers as they see fit.

| Artifact | Output | Verdict | → library | Rationale |
|---|---|---|---|---|
| Worktree / branch / env-sync | Workspace via skills | **cut** | — | Engineer tooling. May survive as standalone utilities outside the pipeline, but they are not Nexus artifacts. |
| Implementation code + tests | The feature | **cut** (out of scope) | — | Never was a Nexus artifact; the repo owns it. |
| GH implementation-summary comment (via `nxs-ship`) | What shipped, decisions, deviations, blockers | **slim** | source material for `decision_log_entry` / `how_it_works_delta` at close | The one durable judgment this stage produces: deviations from design and decisions made in flight. Survives as an engineer practice (a comment on the issue); the close stage mines it. |
| Issue closure | `gh issue close` | **keep** | — | Tracking hygiene; moves to engineer/PjM hands with the stage cut. |

## 8. `/nxs.analyze` — consistency analysis

Sources: `claude/.claude/commands/nxs.analyze.md`, `claude/.claude/agents/nxs-analyzer.md`.

| Artifact | Output | Verdict | → library | Rationale |
|---|---|---|---|---|
| Consistency findings + severity gate | Coverage gaps, scope drift, CRITICAL/HIGH block indicator | **slim** | — | The *check* is a real forcing function (it blocks issue creation on drift the human must resolve). Survives as an inline checkpoint report. |
| `tasks/task-review.md` (persisted) | Full findings file | **cut** | — | Same verdict as in §5: deterministic, regenerable, stale the moment tasks change. |
| Auto-remediation (merges, renumbering, terminology) | Edits to task files | **slim** | — | Mostly machinery for over-generated LLD tasks — largely obsolete once per-task LLDs are cut. Terminology normalization survives (feeds clean `concept`/`aliases` naming downstream). |

## 9. `/nxs.close` — epic closure

Source: `claude/.claude/commands/nxs.close.md`.
**This is the library's single steady-state emission point (0003 §8.1).** The slimmed close
artifact must produce the per-concept `LibraryDelta` list — that is the reconciliation
obligation 0003 §9.1–9.2 places on this audit, and the classification below satisfies it.

| Artifact | Output | Verdict | → library (the `LibraryDelta` fields, 0003 §8.2) | Rationale |
|---|---|---|---|---|
| `PIR.md` · Executive Summary | Prose outcome narrative | **cut** | — (prose narrative rejected, §8.3) | "Drop prose PIRs" (0001 mineable). |
| `PIR.md` · Epic Objectives Achieved | Story→implementation table | **cut** | — | Re-describes the epic plus closed-issue states; regenerable from GH. |
| `PIR.md` · Key Decisions Made | Decision/rationale/task-ref table | **keep** (as part of the close record) | `decision_log_entry` per affected concept (title + 1–3 sentence why, issue provenance) | The durable judgment. Exactly 0003 §9.3's "close record's key decisions → Decision Log." |
| `PIR.md` · Implementation Notes | Deviations, challenges | **slim** | behavioral changes → `summary_delta` / `how_it_works_delta`; retired constraints → `invariants_retired` | Survives only as per-concept behavioral deltas; narrative prose is rejected (§8.3). |
| `PIR.md` · Files Changed | Key file list | **cut** | — (rejected, §8.3; regenerable from git) | Deliberate no-relocation. |
| `PIR.md` · Testing Summary | Coverage overview | **cut** | — | Regenerable; engineer's. |
| `PIR.md` · Future Considerations | Deferred scope, debt, recommendations | **slim** | — (speculative; rejected §8.3) | Forward-looking judgment a human must re-triage — stays on the human surface. See schema gap G3 for where. |
| **Net: close record** | Key decisions + per-concept deltas (concepts created/changed/retired, invariants ±, touches ±) + deferred-scope pointer | **slim** (replaces PIR.md) | **emits the full `LibraryDelta` list** — confirms 0003 §9 assumptions 1–3 hold | Structured, attributable to concepts, with issue provenance — not pasted prose. |
| GH PIR comment + issue close | Comment + `gh issue close` | **keep** | — | Provenance anchor (`last_updated_by` points here). |
| `tasks/` deletion | `rm -rf tasks/` | **keep** (mostly moot) | — | With per-task LLD files cut, there is little left to delete. |

## 10. `/nxs.council` — multi-perspective review

Sources: `claude/.claude/commands/nxs.council.md`, `claude/.claude/agents/nxs-pm.md`,
deprecated stubs `nxs-council-pm.md` / `nxs-council-architect.md`.

| Artifact | Output | Verdict | → library | Rationale |
|---|---|---|---|---|
| Council synthesis (conversational) | Perspectives, tensions, Build Now/Later/Differently/Don't recommendation | **keep** | — (a shipped council decision's rationale reaches the Decision Log via the epic that implements it, at close) | A pure judgment forcing function — it exists to put a decision in front of a human. Writes no file by default; correct as-is. |
| `docs/decisions/*.md` (nxs-pm standalone) | Decision records | **keep** | — | Human judgment surface, exactly where 0001 Decision 1 puts it. |
| Deprecated stub agents | `nxs-council-pm`, `nxs-council-architect` | **cut** | — | Dead files; CLAUDE.md still references them (drift). Housekeeping. |

---

## (a) Summary — System A's lean artifact set

What remains in `docs/` after the cuts, every item a forcing function:

1. **Product & system ground truth** (human-maintained): `docs/product/context.md`,
   `docs/system/stack.md`, `docs/system/standards/*.md`.
2. **Feature brief** (`README.md` with `feature:` frontmatter) — unchanged.
3. **Slim epic** — stories + acceptance criteria, value, success metrics, out-of-scope,
   assumptions, open questions; complexity rating in frontmatter. The right-sizing gate stays.
4. **Focused decision record** (replaces the 16-section HLD) — chosen approach (lead),
   key decisions + rationale, constraints/invariants (incl. security), blocker-level risks,
   open clarifications.
5. **Task index** (slimmed `tasks.md`) + slim GH task issues (summary + AC + dependencies).
   No per-task LLD files. Scope-validation and consistency checks survive as interactive gates,
   not persisted reports.
6. **Close record** (replaces PIR.md) — key decisions + per-concept deltas + deferred-scope
   pointer. This is the artifact that emits `LibraryDelta`s into `.nexus/library/` at close,
   satisfying 0003 §9's assumptions.
7. **GitHub issues** (epic + tasks) as the tracking and provenance surface.
8. **Council decision records** in `docs/decisions/`, ad hoc.

Cut entirely from the pipeline: `nxs.dev`/`nxs.yolo.dev` implementation orchestration, all
three `nxs.qa` modes, per-task LLDs, persisted `task-review.md`, generated indexes, QA reports,
and the prose PIR. Workspace/ship tooling may live on as engineer utilities outside Nexus.

## (b) Schema gaps — for reconciliation against 0003

Content the audit wanted to relocate but the 0003 schema cannot hold as written. Per 0003 §9,
if any of these is accepted, the amendment lands in the emission shape (§8.2), not the page schema.

- **G1 — Process/delivery lessons.** PIR-era "lessons learned" of the process kind
  (estimate-vs-actual, decomposition lessons, "we always underestimate migrations") would
  inform PM estimation — but library pages are *system-concept* knowledge; there is no field
  and no concept to attribute process knowledge to (§9.1 test fails). Either declare it
  out of library scope or give it a separate home; do not force it into concept pages.
- **G2 — Alternatives considered.** HLD §10's "Alternatives Considered" column is precisely
  the anti-relitigation material 0003 §1 names as a retrieval need, but `decision_log_entry.body`
  is capped at 1–3 sentences ("the why"). Reconcile: either the why is defined to include the
  rejected alternative, or the cap is slightly relaxed. Currently the relocation is lossy.
- **G3 — Deferred scope.** PIR "Future Considerations" is rejected by §8.3 (speculative) —
  correctly — but with the prose PIR cut it has no durable home anywhere. This is a System-A
  artifact question (next-epic brief / feature backlog), not a library change; flagged so it
  isn't silently dropped.
- **G4 — Cross-cutting NFR budgets.** System-wide constraints not attributable to one concept
  (e.g., a global "page load < 2s" budget from HLD NFRs / QA verify targets) fail §9.1's
  per-concept attribution test. Key Invariants are per-concept; a synthetic `performance`
  concept page would be inventing schema. Reconcile: either bless cross-cutting concept pages
  or route these to `docs/system/standards/`.
