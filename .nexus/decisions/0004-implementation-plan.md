# 0004 — Refactor implementation plan

**Status:** Plan (consolidated). Direction, artifact contract, and prior art are frozen
upstream; this sequences the build only.
**Date:** 2026-06-12, consolidated 2026-06-21.
**Builds on:** [`0001-refactor-direction.md`](./0001-refactor-direction.md) (direction +
sequencing D5), [`0002-pipeline-audit.md`](./0002-pipeline-audit.md) (keep/slim/cut + gaps
G1–G4), [`0003-concept-schema.md`](./0003-concept-schema.md) (page schema + emission
contract).
**Amendment history:** see [`decision-log.md`](./decision-log.md). Superseded original:
[`overridden-0004-implementation-plan.md`](./overridden-0004-implementation-plan.md).
**Informed by:** [`../research/open-notebook-prior-art.md`](../research/open-notebook-prior-art.md)
(distiller prompt layer), [`../research/pai-prior-art.md`](../research/pai-prior-art.md)
(distiller mechanism/curation layer; `touches:` reciprocity flag). **Note:** PAI originally
informed the G1/G2 defaults below, but the authoritative G1–G4 resolutions are
[0002 §b](./0002-pipeline-audit.md) (decided 2026-06-19); C1/C2/C3 are reconciled to those —
PAI now contributes only the compatible *format/shape*, not the home or the cap stance.

This plan does not relitigate 0001–0003. Where something is genuinely open it is a
**checkpoint** with the research-recommended default, decided when the work reaches it.

---

## The razor, turned on this plan

Every planned artifact must be **either** a forcing function for a human decision **or**
machine-consumed/-produced per the 0003 contract. There are three surfaces, not two:
`docs/` (permanent human artifacts), `.nexus/queue/` (committed transient human planning
artifacts awaiting distillation, then deleted), and `.nexus/concepts/` (machine knowledge).
The 0001 D1 wall: **System A only ever writes human artifacts; System B reads those
artifacts + the code diff and writes the concept store** (via a reviewed distillation-PR).

Two pre-emptive razor checks, because both look like wall violations and aren't:

- **The queue holds committed human planning artifacts that the distiller consumes.** Not a
  violation: every queued artifact is a human forcing-function output, already gated by its
  own pipeline review, and committed by the feature PR. There is **no machine block anywhere
  in System A** — the close record is human prose, not a `ConceptDelta` (0006). The distiller
  *reads* the queue and *writes* concepts; it never writes back into the queue. Because A
  emits nothing structured, there is **nothing to launder** — the laundering path the wall
  guards against (open-notebook §4.2, `save_as_note()`) is structurally absent.
- **`concepts:` reading-list frontmatter on System-A artifacts** points _into_ the concept
  store but stores nothing from it — a read pointer, not relocated content. Allowed.

If any work item below would emit a machine artifact from System A, or have the distiller
write the concept store on main without the distillation-PR gate (0007), the work item is
wrong, not the plan.

---

## Build order (0001 D5, non-negotiable)

```
Contract frozen (0002+0003, DONE)
  → Phase A0  format specs        (contract docs; write before any command rewrite)
  → Phase A1  System A reshape    (commands/agents/skills; removals; mirror)
  → Phase A2  pilot System A      (one real epic; gates entry to B)
  → Phase B0  distiller design    (mechanism checkpoints)
  → Phase B1  distiller build     (deterministic core + prompt layer + distillation-PR apply)
  → Phase B2  bootstrap           (replay in bulk)
  → Phase B3  read side           (concepts: load + PM invariant-conflict gate)
  → Phase B-pilot  bootstrap a real repo   (gates "B done")
  → Phase C   rollout + institutionalize the razor audit
```

A and B are **not** built in lockstep. Mutual feeding is a steady-state property, reached
only after B-pilot. System A is fully usable standalone after A2 — close commits a queue
entry that simply has no consumer yet (that committed entry becomes B's first test input —
see A2 exit). Durability is automatic: the entry is committed, not staged into a sidecar.

---

## Phase A0 — Format specs (contract documents)

**Depends on:** nothing (0002/0003 frozen). **Must complete before A1** — the commands are
rewritten to _generate against_ these specs, so the specs are the real contract surface.

These are blank templates + their filling rules. **Home (amended 2026-06-21):
`claude/.claude/nexus/templates/`** — the installed tool surface — mirrored to
`gemini/.gemini/nexus/templates/`. *Not* the old `common/docs/system/delivery/`: blank
templates are tool scaffolding, not the permanent human artifacts `docs/` is reserved for
([0005](./0005-transient-artifact-storage.md)), and `common/` is never copied by
`nxs.update.claude.sh` (it installs only `claude/.claude/` → the old `common/` paths are dead
in any real install). The `nexus/` subfolder namespaces Nexus-owned assets inside the shared
`.claude/` surface: everything else Nexus owns is `nxs`-prefixed, so a bare `templates/` would
collide with user/other-tool files and escape the update script's prune-by-ownership step.
Project-customizable delivery *config* (`task-labels.md`, `config.*`) also moves out of
`common/` to `claude/.claude/nexus/` (the folder root, *not* `templates/` — it is config, not a
blank shape), but is **seeded/customized by `/nxs.init`** per project rather than shipped fixed:
init writes `.claude/nexus/task-labels.md` with the project's label set. This keeps all
Nexus-owned, per-project state under one installed namespace (`.claude/nexus/`) and off the
`docs/` human surface. No command logic yet.

**Deliverables — create:**

- `claude/.claude/nexus/templates/decision-record-template.md` — replaces the 16-section HLD.
  Sections (0002 §4 net): Summary lead (1, slimmed) · Chosen Approach (5, slimmed) ·
  Key Decisions + rationale (10, **core** — each decision records the refuted *viable*
  alternative + why it lost, under the C1/G2 guardrail: no strawmen; omit if none existed) ·
  Constraints/Invariants incl. security (4+9 slimmed) · Blocker/Address risks (13 slimmed) ·
  Open clarifications. The decision record is the distiller's **primary rationale source**
  (the *why*) — it is committed in the queue and read by B post-merge. Each section is
  annotated with which `ConceptDelta` field B will derive from it at distill time
  (invariants→`invariants_added`, decisions→`decision_log_entry`, integration
  changes→`touches_*`). **Note (0006):** these annotations document *what B mines*, not a
  block A emits — A writes only the human prose.
- `claude/.claude/nexus/templates/task-index-template.md` — the slimmed `tasks.md` shape: per
  task = title, one-line summary, AC pointer, `story_ref: [STORY-N, ...]`, `blocked_by`,
  effort. `story_ref` is required — no task without a story parent. Mermaid optional;
  `blocked_by` is the substance (0002 §5). No per-task LLD files.
- `claude/.claude/nexus/templates/close-record-template.md` — replaces `PIR.md`.
  **Human prose only (0006):** key decisions, deferred-scope pointer, and **deviation
  rationale** (the output of the close-from-diff forcing function — see A1 `nxs.close`).
  **No `ConceptDelta` block** — the machine-handoff half is removed; the distiller mines this
  prose for the *why* it cannot derive from the diff.

**Deliverables — modify:**

- `task-template.md` — **relocate** `common/docs/system/delivery/` →
  `claude/.claude/nexus/templates/` (with the three above), then drop the LLD sections (Files /
  Interfaces / Implementation Notes), the Key Decisions table, the Git Workspace section
  (0002 §5). Slim to summary + AC + dependencies — the GH issue body shape.
- `common/docs/system/standards/_template.md` → `claude/.claude/nexus/templates/standard.template.md`
  — same relocation (it is a tool-invariant template too). Reconciles the dangling
  `nxs.init.md:210` reference to `templates/standard.template.md`, which currently points at a
  non-existent path, to the real home. Update the CLAUDE.md "Standards Template" pointer to match.

**Checkpoints (forced here because the templates can't be written without resolving them):**

| #                | Question                                                                        | Recommended default (PAI/0002)                                                                                                                                                                                                                                         | Lands in                                  |
| ---------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| C1 — G2          | Format of `decision_log_entry.body` "why"                                       | **Decided (0002 §b G2, 2026-06-19 — overrides the earlier "format not cap relaxation" default):** relax the 1–3-sentence cap to admit the refuted alternative + why it lost. **Viability guardrail:** record an alternative only if genuinely viable (a competent engineer might have chosen it; rejected on a real trade-off), never a strawman — the guardrail is what keeps the relaxation from reopening over-generation. PAI §3's `conjectured/refuted-by/learned/criterion` framing is the compatible disciplined *format* for it. | decision-record template (the human captures the *why* here) + B1 distiller `decision_log_entry` recipe (per 0006: **B** constructs the delta from this prose) |
| C2 — G3          | Durable home for deferred scope (prose PIR "Future Considerations" is cut)      | **Decided (0002 §b G3, 2026-06-19 — pins the earlier "stub" default to a path):** append-only `docs/features/<feature>/backlog.md` — the feature's re-triage queue and the input the next `/nxs.epic` reads. `/nxs.close` appends to it; the close record (in queue) carries only a pointer. Stays on the human surface, never concept store (§8.3 speculative).                                                               | `docs/features/<feature>/backlog.md` (new) + close-record pointer       |
| C3 — G1          | Home for process/delivery lessons (estimate-vs-actual, decomposition lessons)   | **Decided (0002 §b G1, 2026-06-19; home moved out of `system/` 2026-06-22 — overrides the earlier "Gotchas in command docs" default):** out of concept-store scope; a `docs/delivery/lessons/` folder, **one file per lesson** (`<date>-<slug>.md`, source-epic in frontmatter), written by `/nxs.close`. Top-level `docs/delivery/`, **peer of `system/` not child** — `system/` is system-concept knowledge (what the product is); these lessons fail that test (the §9.1 failure that evicted them from the concept store), so they don't sit under `system/`. Folder-of-files not a single ledger — adds-a-file is merge-conflict-free across concurrent epics, mirroring the concept store's one-concept-per-file stance (0003 §6/§7). Permanent human `docs/` artifact (consumed by PM estimation). PAI §3's Gotchas pattern survives only as the per-entry *shape*, not the home. | `docs/delivery/lessons/` (new folder) + `/nxs.close` write |
| C4 — G4          | Home for cross-cutting NFR budgets (e.g. global "page load < 2s")               | **Default:** route to `docs/system/standards/`; do **not** invent a synthetic `performance` concept page. Bless cross-cutting concept pages only if a real shared concept emerges.                                                                                     | standards (decision-record references it) |
| C5               | Tier-scale decision-record sections by epic complexity rating                   | **Defer, design the whitelist now:** S/M may require only Decisions + Invariants; L/XL require all. Whitelist, _not_ heuristic (PAI §4.1 — heuristic bypass becomes doctrine-evasion). Encode as explicit required-section rule in the template even if defaulted off. | decision-record template                  |
| C6               | Decision record as a live document accruing in-flight decisions, mined at close | **Defer:** keep close-time mining as the baseline (GH comments + close review). Note the live-document option (PAI §4.2) as a cheaper future emission story; don't build it now. **See 0007 open item** (structured Decision Log stub) for a compatible refinement.     | (noted only)                              |
| C7 — **DECIDED** | Task-ID stability vs the 0002 §8 renumbering auto-remediation                   | **Override 0002 §8 confirmed:** never renumber a task ID referenced elsewhere (`blocked_by`, GH issue, concept-store provenance). Renumbering breaks merges/references silently (PAI §1.3). Remediation may merge/delete but assigns IDs append-only.                        | task-index template + A1 analyze rewrite  |

**Exit criteria:** the templates exist under `claude/.claude/nexus/templates/` (mirror deferred
to Phase C per C9); C1–C7 resolved and reflected in them; the close-record template is human
prose only (no `ConceptDelta` block, 0006); each decision-record section is annotated with the
`ConceptDelta` field B will derive from it (proves B's mining contract is satisfiable from the
committed artifacts before any command is touched).

---

## Phase A1 — System A reshaping

**Depends on:** A0 (commands generate against the A0 templates). This is the bulk of System A.

### Command rewrites (`claude/.claude/commands/`)

| File                     | Action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Per 0002 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `nxs.init.md`            | **Modify** — cut the generated `docs/system/README.md` navigation index (§1). Keep stack/standards/CLAUDE.md edits. Scaffold the G1 `docs/delivery/lessons/` folder (with a README documenting the one-file-per-lesson convention) and the G4 NFR-budget home under `docs/system/standards/` (C3/C4). **Seed `.claude/nexus/task-labels.md`** with the project's label set (relocated from `common/docs/system/delivery/`; the `nxs.tasks`/decomposer label path updates to this home). **Queue surface (0006):** `.nexus/queue/` is **committed, not gitignored** — init does *not* add a `.nexus/` ignore for it (reverses 0005 §2); only genuinely local scratch, if any, is ignored. | §1       |
| `nxs.product-context.md` | **Modify** — minor; confirm personas are canonical here (epic now references, doesn't re-tabulate).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | §2       |
| `nxs.epic.md`            | **Modify** — slim. Keep right-sizing gate (the early over-generation brake), stories/AC, value, success metrics, scope/assumptions/open-questions. Slim persona table to deviations-only. Cut the three-scenario timeline table; rating+drivers to frontmatter. Add `concepts:` reading-list frontmatter field (defined now, _consumed_ in B3). Glossary terms that name durable concepts route to `aliases:` at close, not stored in the epic. Add `story_type: user \| system` to each story: `user` = behavioral AC observable by an end-user; `system` = measurable technical AC (metric, threshold, contract assertion). Both are first-class; `story_type` determines what the analyze gate checks at the AC level, not whether traceability applies. **Writes into `.nexus/queue/<branch>/<local-id>/`** (0006). | §3       |
| `nxs.hld.md`             | **Rewrite** — emits the focused **decision record** (A0 template) into the queue, not the 16-section HLD. Consumes concept pages for System Context instead of regenerating them (in B3 this read goes live; until then it is a manual/README-driven read).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | §4       |
| `nxs.tasks.md`           | **Rewrite** — emits the **task index** (into the queue) + slim GH issues. Drop per-task LLD generation entirely. Keep the interactive Epic Scope Validation gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | §5       |
| `nxs.analyze.md`         | **Rewrite** — becomes an **inline checkpoint**, no persisted `task-review.md`. Keep the severity gate (blocks issue creation on drift). Terminology normalization survives; renumbering obeys C7 (never renumber referenced IDs). **Story-traceability rules (new):** (1) every task has a `story_ref` — orphaned technical tasks are a severity-gate failure; (2) every story has at least one task; (3) for `story_type: user` stories, at least one task's AC references an observable behavioral outcome; (4) for `story_type: system` stories, at least one task's AC references a measurable criterion (metric, threshold, or pass/fail assertion) — prose-only ACs ("implement caching") are a severity-gate failure.                                | §8       |
| `nxs.close.md`           | **Rewrite** — emits the **close record into the committed queue as pure human prose**: key decisions + deferred-scope pointer + deviation rationale. **No `ConceptDelta` block** — durability is structural (the queue entry is committed). Implements the **close-from-diff forcing function**: diff the branch **against the decision record**, auto-derive the *what*, **surface detected deviations**, and force the human to supply rationale **only on those deviations** (targeted, not a blank "write a summary"); that rationale lands in the close record. Also writes the G1 process lesson as a new file in `docs/delivery/lessons/` (C3) and appends the G3 deferred scope to `docs/features/<feature>/backlog.md` (C2), then points the close record at that backlog. The queue entry records its parent feature (one-direction pointer). Drop prose PIR. Keep GH comment + `gh issue close`. The entry stays committed and travels to main with the PR; the distiller deletes it on consume. | §9       |
| `nxs.council.md`         | **Keep** — unchanged (§10). Verify it still references live agents only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | §10      |
| `nxs.dev.md`             | **Delete** — implementation is the engineer's (0001 D4).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | §7       |
| `nxs.yolo.dev.md`        | **Delete** — same.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | §7       |
| `nxs.qa.md`              | **Delete** — all three modes drive/validate implementation (§6 stage-level cut).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | §6       |

### Agent rewrites (`claude/.claude/agents/`)

| File                       | Action                                                   |
| -------------------------- | -------------------------------------------------------- |
| `nxs-architect.md`         | **Modify** — decision-record mode only; remove LLD mode. |
| `nxs-decomposer.md`        | **Modify** — epic + task-index; drop LLD hand-off.       |
| `nxs-analyzer.md`          | **Modify** — inline-gate behavior; no file emission.     |
| `nxs-pm.md`                | **Keep** — council/decision-record author.               |
| `nxs-dev.md`               | **Delete** — dev stage cut.                              |
| `nxs-qa.md`                | **Delete** — QA stage cut.                               |
| `nxs-council-pm.md`        | **Delete** — deprecated stub (CLAUDE.md drift).          |
| `nxs-council-architect.md` | **Delete** — deprecated stub.                            |

### Skill rewrites (`claude/.claude/skills/`)

| Skill                                             | Action                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `nxs-gh-create-epic`, `nxs-gh-create-task`        | **Keep** — provenance/tracking surface. Slim task bodies to summary+AC+deps.                                                                                                                                                                                                                                                                                                         |
| `nxs-abs-doc-path`                                | **Keep** — utility.                                                                                                                                                                                                                                                                                                                                                                  |
| `nxs-generate-tasks`                              | **Modify** — emit task index, drop LLD generation.                                                                                                                                                                                                                                                                                                                                   |
| `nxs-qa`                                          | **Delete** — QA stage cut.                                                                                                                                                                                                                                                                                                                                                           |
| `nxs-workspace-setup`, `nxs-ship`, `nxs-env-sync` | **Checkpoint C8** — these are dev-stage tooling. 0002 says they _may_ survive as standalone engineer utilities _outside_ the pipeline. **Default:** move out of the Nexus pipeline surface (retain as optional standalone skills, de-referenced from the pipeline command docs) rather than delete outright — cheap to keep, no pipeline coupling. Decide keep-standalone vs delete. |

### Surface / drift updates

- `CLAUDE.md` (repo root) — **Rewrite** the command-workflow section: remove dev/qa stages,
  the per-task-LLD description, stub-agent references; describe the lean A set (0002 §a) and
  the **three-store split** (`docs/` permanent human, `.nexus/queue/` committed-transient
  planning, `.nexus/concepts/` machine). This file describes the _pre-refactor_ pipeline
  (task warning) — it is surface to update, not a constraint.
- `user-docs/`, `DOCUMENTATION.md`, `how-to-nexus.md`, `README.md` — **Modify** for the lean
  pipeline. Scope: stage list, artifact descriptions, three-store explanation. (Survey
  extent in A1; not pre-counted here.)
- `claude/nxs.update.claude.sh` / `.ps1` — **Modify.** They `cp -rf` source over
  `.claude/` and **do not prune**; deleted commands/agents/skills will linger on existing
  installs. Add an explicit removal step for the cut `nxs.*`-prefixed files, or document
  manual cleanup. (ADDRESS risk.)

### Gemini mirror — Checkpoint C9 — **DECIDED: defer**

`gemini/.gemini/` is a full structural mirror (same commands/agents/skills) with its own
`nxs.update.gemini.sh`. **Decided: defer the mirror until the Claude side stabilizes through
A2.** Reapply the same deletes/rewrites to `gemini/.gemini/` as one batch in Phase C, after
the Claude side is pilot-validated — rewriting both in lockstep doubles the churn while the
Claude shape is still settling. Mark `claude/.claude/` canonical and the mirror explicitly
stale in the interim to prevent silent divergence (ADDRESS risk).

**Close-emission durability is structural.** Because `/nxs.close` writes the close record into
the **committed** `.nexus/queue/` entry and System A emits no `ConceptDelta`, durability is
automatic: the A2 pilot's queue entry is committed to the branch and travels to main with the
PR, where it becomes B1's first real fixture. There is no staged sidecar to write.

**Exit criteria:** all listed deletes done; rewritten commands produce only A0-template
artifacts, written into `.nexus/queue/` (committed, not gitignored);
`grep -ri 'nxs-dev\|nxs-qa\|nxs-council-pm\|nxs-council-architect\|per-task LLD\|\.nexus/\.temp\|\.nexus/staged'`
over `claude/` and root docs returns only intentional historical references; CLAUDE.md
describes the lean set + three-store split; update script no longer leaves orphans. Concept
store still empty, and the close record carries no machine block — no A1 work writes to
`.nexus/concepts/` and System A emits nothing structured.

---

## Phase A2 — Pilot System A on one real epic

**Depends on:** A1. **Gates entry to B.**

Run the reshaped pipeline (init→epic→hld→tasks→analyze→close) end-to-end on **one real
epic**. The refactor's own next unit of work is the natural candidate — see Checkpoint C10.

- **Checkpoint C10 — Dogfooding.** Whether the refactor itself runs through the pipeline,
  and which version. **Default:** dogfood Phase B's planning on the _reshaped_ (post-A1)
  pipeline — B is a real epic and exercises A2 for free. Don't dogfood mid-A1 (the pipeline
  is in pieces). Decide: dogfood-on-new vs pilot a separate throwaway epic.

**Exit criteria:** one epic produces a slim epic, a focused decision record, a task index +
slim GH issues, an inline analyze gate, and a **committed `.nexus/queue/<branch>/<local-id>/`
entry** containing those artifacts plus a human-prose close record (key decisions +
deferred-scope pointer + deviation rationale from the close-from-diff forcing function). That
committed queue entry — together with the branch diff — is captured as **B1's first real
fixture** (no `ConceptDelta` validation here: A emits no machine block; B constructs deltas
later). No template section forced empty without cause (C5 whitelist honored). If the pilot
reveals B cannot mine something real from the committed artifacts + diff, amend 0003 §8.2 (its
designated amendment surface) — _not_ the page schema.

---

## Phase B0 — Distiller design (mechanism checkpoints)

**Depends on:** A2 (real committed queue-entry fixture exists). Pure design; no code yet. Read
both research notes here (their stated "read when the distiller conversation opens" trigger).

**Doctrine fixed by prior art (not checkpoints — adopt):**

- _Mechanics as code, judgment as prompt_ (PAI §2.3): everything checkable — body cap,
  frontmatter completeness, `touches:`↔Integration-Points equality, decision-log-entry-
  required, §8.3 rejections — is deterministic TS, never prompt text.
- _Candidates never write the concept store directly_ (PAI §2.1): the distiller emits to a
  **distillation-PR** (0007); the PR merge is the explicit curated apply.
- _Recipes as data, house-style preamble, output sanitization_ (open-notebook §2): named
  versioned prompt templates (likely one per delta-field family); a shared preamble enforces
  §8.3 in the prompt; sanitize model output (`clean_thinking_content` analog) before any
  append — the Decision Log is append-only, a polluted entry is forever.

**Handoff mechanism fixed by 0006/0007 (not checkpoints — adopt):**

- **Input is the committed queue + the diff (0006).** The distiller scans `.nexus/queue/**`
  for unconsumed entries (presence = unconsumed), running **post-merge on main**. It derives
  the *what* from the merged diff (SHA range inferable from the merge commit, else recorded
  base/head in the entry; the diff is recomputed, never stored) and the *why* from the queued
  decision + close records. It **infers** the concept mapping (0003 §9.1 relaxed — A does not
  pre-guess concept boundaries). Naturally batches N epics.
- **Output is a distillation-PR, not a direct write (0007).** The distiller constructs the
  deltas and opens a PR against `.nexus/concepts/`; the **PR merge** is the authoritative
  write. Consumed queue entries are deleted **when the distillation-PR merges** (recoverable
  via git history). Abandoned (never-merged) epics never reach main and never distill. The
  queue→entry feature linkage is one-direction only (entry→brief, 0006 §drain-4).

**Checkpoints:**

| #                            | Question                                                                                                                               | Recommended default                                                                                                                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C11 — `touches:` reciprocity | 0003 never says whether a touched page gets a reciprocal `touches_*` edit (PAI §2.5). Without a rule, blast-radius grep under-reports. | **Adopt symmetry:** a real interaction is bidirectional — one delta's `touches_added: [X]` fans out to a reciprocal edit on page X in the _same_ distillation-PR. Make it a deterministic distiller step, not prompt judgment. |
| C12 — Queue expiry           | Committed queue entries merged to main but never drained into a distillation-PR (PAI §2.6).                                            | **Adopt expiry:** undrained queue entries expire (PAI uses 90 days). A queue that only grows is [speculative over-generation](../concepts/speculative-over-generation.md) relocated. The distillation-PR is the drain, so its cadence is an operational SLO (0007). |
| C13 — Bootstrap trust        | How `last_updated_by: "bootstrap"` pages are treated (PAI §1.5).                                                                       | **Adopt low-trust:** bootstrap pages are re-validated at the first close that touches them; distiller prioritizes that re-validation.                                                                                   |

**Open items inherited from 0007 (B-phase, not blocking the contract):** distillation-PR
**cadence** (per-merge vs nightly batch); **reviewer assignment** for the distillation-PR;
the optional **structured Decision Log stub** (upgrade A's *why* capture from free prose to a
stub the human authors directly so B carries it verbatim — compatible with the wall, does not
pull the *what* pre-merge; pursue or drop in B-phase). See also C6.

**Exit criteria:** C11–C13 resolved; the deterministic-vs-prompt split is enumerated as a
checklist (what code does / where the LLM is invoked); recipe set named (one per delta-field
family); the distillation-PR open/merge/consume flow (0007) is specified. No build started.

---

## Phase B1 — Distiller build

**Depends on:** B0. Against the **frozen** 0003 contract — no schema changes originate here;
a forced change is an amendment to 0003 §8.2, surfaced not silently made. The `ConceptDelta`
shape is the distiller's **internal/output** representation (0006 — repurposed from a
System-A emission), never produced by System A.

**Deliverables — create (deterministic core, plain TS, PAI §2.3 shape):**

- Schema validator — frontmatter completeness, 400-word body cap, `touches:`↔Integration-
  Points equality, decision-log-entry-required, §8.3 rejection of code/paths/types/specs/
  speculative claims.
- Page/slug mechanics — slug = filename (= kebab-case of `title`), no slug frontmatter field; flat `.nexus/concepts/*.md`; `retire`
  sets `status: deprecated` + moves to `_archive/`; `invariants_retired` strikes through in
  place, never deletes (0003 §2.3, §5).
- Queue reader + delta constructor — scans `.nexus/queue/**` for unconsumed entries, derives
  the *what* from the recomputed branch diff and the *why* from the queued decision + close
  records (0006), and constructs `ConceptDelta`s (B's internal representation). Expiry per C12.
- Incremental state file — `.harvest-state.json` analog (last run + already-processed
  sources/queue entries); makes drain/bootstrap idempotent and resumable (PAI §2.2).

**Deliverables — create (prompt layer, recipes as data, open-notebook §2):**

- Named recipe templates (one per delta-field family) + shared §8.3-enforcing preamble.
- Output sanitization before append.

**Deliverables — wire (the distillation-PR apply, 0007):**

- committed queue entry + diff → distiller → **distillation-PR against `.nexus/concepts/`**,
  with C11 reciprocity fan-out applied deterministically within that PR. The PR merge is the
  authoritative write; consumed queue entries are deleted when the distillation-PR merges.
  The distiller never writes the concept store on main directly and never writes back into the
  queue.

**No generated index** (0003 §7) — `glob`/`rg` over frontmatter is the index.

**Exit criteria:** the A2 fixture (committed queue entry + diff) flows queue → distiller →
distillation-PR → (on merge) applied pages; produced pages pass the validator; a deliberately
malformed delta (§8.3 violation, missing decision-log-entry, over-cap body) is _rejected by
code_, not by prompt, before the PR opens. Reciprocal `touches:` edits land in the same
distillation-PR. The queue entry is deleted only when the distillation-PR merges. Re-running
the drain is a no-op (idempotent).

---

## Phase B2 — Bootstrap

**Depends on:** B1 (same contract, replayed in bulk). PAI ISA Seed/Migrate are working
analogs (PAI §2.2); open-notebook proves per-source independence parallelizes (ON §2.3).

**Deliverables — create:**

- Bootstrap routine — derives the same `ConceptDelta` shape in bulk from a repo's existing
  history (READMEs, code structure, recent commits, prior epics) and emits them as a
  (potentially large, chunked) distillation-PR (0007). Idempotent + resumable via the B1
  state file — re-runnable in chunks, not one fragile pass. Emits
  `last_updated_by: "bootstrap"` (low-trust per C13).

**Exit criteria:** deferred to B-pilot.

---

## Phase B3 — Read side (the second feeding direction)

**Depends on:** B2 (concept store must hold content before reads do anything). This closes the
A↔B loop.

**Deliverables — wire (the `concepts:` field defined in A1 now goes live):**

- `concepts:` reading-list load — `/nxs.epic` and `/nxs.hld` load the named concept pages as
  the cheap authoritative read path; grep is the fallback (0003 §5). Optional per-concept
  one-line _why-you're-reading-this_ (open-notebook §2.5) — weigh, don't pre-commit.
- **PM invariant-conflict gate** as a **two-stage scan** (PAI §2.4): deterministic grep of
  the new epic's terms against `aliases:`/`Key Invariants` for _candidate_ pages → model
  reviews _only those_ for contradiction. Cheap candidates, model only where judgment lives.

**Exit criteria:** an epic naming a `concepts:` list loads those pages; an epic that
contradicts a stored invariant is flagged by the two-stage gate; grep fallback works when
the list is absent.

---

## Phase B-pilot — Bootstrap a real repo

**Depends on:** B2 (+ B3 for the read-loop check). **Gates "B done."**

Run bootstrap against one real repository with real history.

**Exit criteria:** bootstrap produces a coherent concept store (no silent near-duplicate concepts —
the first scale casualty, open-notebook §3.1); resuming a half-run completes without
re-emitting; bootstrap pages are flagged low-trust and re-validated at the next touching
close; a `/nxs.hld` on that repo successfully reads concept pages for System Context. Only
now is the A↔B mutual feeding (0001) actually realized.

---

## Phase C — Rollout + institutionalize the razor

**Depends on:** B-pilot. Steady-state hygiene, not a feature.

- **Institutionalize the 0001 razor as a recurring audit** (PAI §5.3 — the cautionary tale:
  45 skills / 171 workflows / mandatory boilerplate, then a "Lean and Mean" release deleting
  68% of directories). **Named test:** _"every artifact a forcing function for a human
  decision OR machine-consumed per 0003 — else cut."_ **Fixed verdict categories** (PAI's:
  CUT / RESOLVE / MERGE / SHARPEN / KEEP). Schedule its **first run post-refactor**; recur
  thereafter. The 0002 pass was one-time — without recurrence the rebuilt pipeline re-bloats.
- **Mirror reconciliation** — if C9 deferred Gemini, apply the full A1+B changes to
  `gemini/.gemini/` here and drop the "stale" marker.
- **Success metrics** — deferred by choice (0001). _Note_ where they could attach (e.g.
  pages-per-close, duplicate-concept rate, distillation-PR drain latency / queue-expiry rate,
  decision-record section-fill under C5) — **do not invent gates.** Attachment points only.

**Exit criteria:** first razor audit run recorded with verdicts; mirror reconciled or
explicitly still-deferred with owner; metric attachment points noted in CLAUDE.md.

---

## Risks (BLOCKER / ADDRESS only)

- **BLOCKER — unreviewed authoritative write to the concept store.** The concept store's
  payload is non-regenerable judgment (0001 D3); an LLM run writing it on main unsupervised is
  the pipeline's weakest link. Mitigation (0007): the distiller never writes main directly —
  it opens a **distillation-PR**, and the **PR merge** is the authoritative, human-reviewed
  write. Apply stays a curated step (B1); the two-store wall holds (A never writes concepts;
  B's write is PR-gated).
- **ADDRESS — update script leaves orphans.** `cp -rf` doesn't prune; cut commands/agents/
  skills linger on existing installs. Add a removal step or document manual cleanup (A1).
- **ADDRESS — Gemini mirror divergence.** Deferring the mirror (C9) is fine only if
  `claude/.claude/` is marked canonical and the mirror marked stale; otherwise the two drift
  silently. Reconcile in C.
- **ADDRESS — distillation-PR backlog.** If distillation-PRs aren't drained promptly a review
  backlog forms (0007). C12 expiry governs undrained queue entries; the distillation-PR is the
  drain, so its cadence is an operational SLO.
- **ADDRESS — distiller over-generation (the disease, recursed).** Thousands of concept store
  pages is more likely distiller bloat than a retrieval-tech gap (open-notebook §3.1). The
  Phase C razor audit must cover the distiller's _output_ (the distillation-PR's pages), not
  just the command pipeline.

## What this plan deliberately does not do

- No Graphify / embeddings / RAG / Serena-MCP / community topology. Reopen _only_ on
  measured recall failure at high-hundreds-to-thousands of pages (open-notebook §3.1) — the
  retrofit is a gitignored per-page embedding sidecar, not 0003's amendment.
- No `/nxs.dev`, `/nxs.yolo.dev`, `/nxs.qa` — implementation is the engineer's (0001 D4).
- No success-metric gates (deferred by choice, 0001).
- No machine artifact emitted by System A — the close record is human prose; B constructs the
  `ConceptDelta`s.
- No direct distiller write to `.nexus/concepts/` on main — the authoritative write is the
  distillation-PR merge.
- No `.nexus/.temp/` or `.nexus/staged/*.json` — the single committed `.nexus/queue/` is the
  one handoff surface.
- No coaching-agent product line; nothing archived under `.nexus/archive/` as direction.
- No speculative timelines or three-scenario estimate tables — that pattern is what this
  refactor removes.
