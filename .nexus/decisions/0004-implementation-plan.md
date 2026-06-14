# 0004 — Refactor implementation plan

**Status:** Plan. Direction, artifact contract, and prior art are frozen upstream; this
sequences the build only.
**Date:** 2026-06-12
**Builds on:** [`0001-refactor-direction.md`](./0001-refactor-direction.md) (direction +
sequencing D5), [`0002-pipeline-audit.md`](./0002-pipeline-audit.md) (keep/slim/cut + gaps
G1–G4), [`0003-library-schema.md`](./0003-library-schema.md) (page schema + emission
contract).
**Informed by:** [`../research/open-notebook-prior-art.md`](../research/open-notebook-prior-art.md)
(distiller prompt layer), [`../research/pai-prior-art.md`](../research/pai-prior-art.md)
(distiller mechanism/curation layer; G1/G2 resolutions; `touches:` reciprocity flag).

This plan does not relitigate 0001–0003. Where something is genuinely open it is a
**checkpoint** with the research-recommended default, decided when the work reaches it.

---

## The razor, turned on this plan

Every planned artifact must be **either** a forcing function for a human decision (→ `docs/`)
**or** machine-consumed per the 0003 contract (→ `.nexus/library/`). No artifact serves both
stores. Two pre-emptive razor checks, because both look like violations and aren't:

- **The close record lives in `docs/` and carries a `LibraryDelta` block.** Not a violation:
  the deltas are human-gated *at the close review* (the forcing function), and the distiller
  *reads* the gated record — the same way `/nxs.hld` reads library pages. A machine block a
  human approves before it crosses the wall is a handoff, not a shared artifact. The
  violation the wall prevents is *ungated* machine blobs in `docs/` or human prose in the
  library (open-notebook note §4.2, `save_as_note()` — never build the laundering path).
- **`concepts:` reading-list frontmatter on System-A artifacts** points *into* the library
  but stores nothing from it — a read pointer, not relocated content. Allowed.

If any work item below would emit a human artifact into the library or an ungated machine
artifact into `docs/`, the work item is wrong, not the plan.

---

## Build order (0001 D5, non-negotiable)

```
Contract frozen (0002+0003, DONE)
  → Phase A0  format specs        (contract docs; write before any command rewrite)
  → Phase A1  System A reshape    (commands/agents/skills; removals; mirror)
  → Phase A2  pilot System A      (one real epic; gates entry to B)
  → Phase B0  distiller design    (mechanism checkpoints)
  → Phase B1  distiller build     (deterministic core + prompt layer + apply wiring)
  → Phase B2  bootstrap           (replay in bulk)
  → Phase B3  read side           (concepts: load + PM invariant-conflict gate)
  → Phase B-pilot  bootstrap a real repo   (gates "B done")
  → Phase C   rollout + institutionalize the razor audit
```

A and B are **not** built in lockstep. Mutual feeding is a steady-state property, reached
only after B-pilot. System A is fully usable standalone after A2 — close emits a staged
delta record that simply has no consumer yet (that staged record becomes B's first test
input — see A1 BLOCKER).

---

## Phase A0 — Format specs (contract documents)

**Depends on:** nothing (0002/0003 frozen). **Must complete before A1** — the commands are
rewritten to *generate against* these specs, so the specs are the real contract surface.

These are blank templates + their filling rules, living beside the existing
`common/docs/system/delivery/task-template.md`. No command logic yet.

**Deliverables — create:**
- `common/docs/system/delivery/decision-record-template.md` — replaces the 16-section HLD.
  Sections (0002 §4 net): Summary lead (1, slimmed) · Chosen Approach (5, slimmed) ·
  Key Decisions + rationale (10, **core**) · Constraints/Invariants incl. security (4+9
  slimmed) · Blocker/Address risks (13 slimmed) · Open clarifications. Each section
  annotated with which `LibraryDelta` field it feeds at close (invariants→`invariants_added`,
  decisions→`decision_log_entry`, integration changes→`touches_*`).
- `common/docs/system/delivery/task-index-template.md` — the slimmed `tasks.md` shape: per
  task = title, one-line summary, AC pointer, `story_ref: [STORY-N, ...]`, `blocked_by`,
  effort. `story_ref` is required — no task without a story parent. Mermaid optional;
  `blocked_by` is the substance (0002 §5). No per-task LLD files.
- `common/docs/system/delivery/close-record-template.md` — replaces `PIR.md`. Human-facing
  half: key decisions, deferred-scope pointer. Machine handoff half: the per-concept
  `LibraryDelta` block (0003 §8.2 shape), one entry per affected concept, each with its
  required `decision_log_entry`.

**Deliverables — modify:**
- `common/docs/system/delivery/task-template.md` — drop the LLD sections (Files /
  Interfaces / Implementation Notes), the Key Decisions table, the Git Workspace section
  (0002 §5). Slim to summary + AC + dependencies — the GH issue body shape.

**Checkpoints (forced here because the templates can't be written without resolving them):**

| # | Question | Recommended default (PAI/0002) | Lands in |
|---|---|---|---|
| C1 — G2 | Format of `decision_log_entry.body` "why" | **Adopt:** the one-sentence why must name the refuted alternative (PAI §3: `conjectured/refuted-by/learned/criterion`, discipline by format not cap relaxation). | decision-record + close-record templates |
| C2 — G3 | Durable home for deferred scope (prose PIR "Future Considerations" is cut) | **Adopt:** a System-A *next-epic brief / feature backlog* stub the close record points at; stays on the human surface, never library (§8.3 speculative). | new template + close-record pointer |
| C3 — G1 | Home for process/delivery lessons (estimate-vs-actual, decomposition lessons) | **Adopt:** out of library scope; attach to the process artifact they improve — **Gotchas** sections in command docs / `docs/system/standards/` delivery pages (PAI §3). | command docs / standards |
| C4 — G4 | Home for cross-cutting NFR budgets (e.g. global "page load < 2s") | **Default:** route to `docs/system/standards/`; do **not** invent a synthetic `performance` concept page. Bless cross-cutting library pages only if a real shared concept emerges. | standards (decision-record references it) |
| C5 | Tier-scale decision-record sections by epic complexity rating | **Defer, design the whitelist now:** S/M may require only Decisions + Invariants; L/XL require all. Whitelist, *not* heuristic (PAI §4.1 — heuristic bypass becomes doctrine-evasion). Encode as explicit required-section rule in the template even if defaulted off. | decision-record template |
| C6 | Decision record as a live document accruing in-flight decisions, mined at close | **Defer:** keep close-time mining as the baseline (GH comments + close review). Note the live-document option (PAI §4.2) as a cheaper future emission story; don't build it now. | (noted only) |
| C7 — **DECIDED** | Task-ID stability vs the 0002 §8 renumbering auto-remediation | **Override 0002 §8 confirmed:** never renumber a task ID referenced elsewhere (`blocked_by`, GH issue, library provenance). Renumbering breaks merges/references silently (PAI §1.3). Remediation may merge/delete but assigns IDs append-only. | task-index template + A1 analyze rewrite |

**Exit criteria:** four templates exist; C1–C7 resolved and reflected in them; each template
section that survives into a `LibraryDelta` is annotated with its receiving field (proves the
emission contract is satisfiable before any command is touched).

---

## Phase A1 — System A reshaping

**Depends on:** A0 (commands generate against the A0 templates). This is the bulk of System A.

### Command rewrites (`claude/.claude/commands/`)

| File | Action | Per 0002 |
|---|---|---|
| `nxs.init.md` | **Modify** — cut the generated `docs/system/README.md` navigation index (§1). Keep stack/standards/CLAUDE.md edits. Add G1/G4 Gotchas-and-NFR homes to standards scaffolding. | §1 |
| `nxs.product-context.md` | **Modify** — minor; confirm personas are canonical here (epic now references, doesn't re-tabulate). | §2 |
| `nxs.epic.md` | **Modify** — slim. Keep right-sizing gate (the early over-generation brake), stories/AC, value, success metrics, scope/assumptions/open-questions. Slim persona table to deviations-only. Cut the three-scenario timeline table; rating+drivers to frontmatter. Add `concepts:` reading-list frontmatter field (defined now, *consumed* in B3). Glossary terms that name durable concepts route to `aliases:` at close, not stored in the epic. Add `story_type: user \| system` to each story: `user` = behavioral AC observable by an end-user; `system` = measurable technical AC (metric, threshold, contract assertion). Both are first-class; `story_type` determines what the analyze gate checks at the AC level, not whether traceability applies. | §3 |
| `nxs.hld.md` | **Rewrite** — emits the focused **decision record** (A0 template), not the 16-section HLD. Consumes library pages for System Context instead of regenerating them (in B3 this read goes live; until then it is a manual/README-driven read). | §4 |
| `nxs.tasks.md` | **Rewrite** — emits the **task index** + slim GH issues. Drop per-task LLD generation entirely. Keep the interactive Epic Scope Validation gate. | §5 |
| `nxs.analyze.md` | **Rewrite** — becomes an **inline checkpoint**, no persisted `task-review.md`. Keep the severity gate (blocks issue creation on drift). Terminology normalization survives; renumbering obeys C7 (never renumber referenced IDs). **Story-traceability rules (new):** (1) every task has a `story_ref` — orphaned technical tasks are a severity-gate failure; (2) every story has at least one task; (3) for `story_type: user` stories, at least one task's AC references an observable behavioral outcome; (4) for `story_type: system` stories, at least one task's AC references a measurable criterion (metric, threshold, or pass/fail assertion) — prose-only ACs ("implement caching") are a severity-gate failure. | §8 |
| `nxs.close.md` | **Rewrite** — emits the **close record** (A0 template): key decisions + per-concept `LibraryDelta` block + deferred-scope pointer (C2). Drop prose PIR. Keep GH comment + `gh issue close`. **Writes the delta block to a durable staged location** (see BLOCKER). | §9 |
| `nxs.council.md` | **Keep** — unchanged (§10). Verify it still references live agents only. | §10 |
| `nxs.dev.md` | **Delete** — implementation is the engineer's (0001 D4). | §7 |
| `nxs.yolo.dev.md` | **Delete** — same. | §7 |
| `nxs.qa.md` | **Delete** — all three modes drive/validate implementation (§6 stage-level cut). | §6 |

### Agent rewrites (`claude/.claude/agents/`)

| File | Action |
|---|---|
| `nxs-architect.md` | **Modify** — decision-record mode only; remove LLD mode. |
| `nxs-decomposer.md` | **Modify** — epic + task-index; drop LLD hand-off. |
| `nxs-analyzer.md` | **Modify** — inline-gate behavior; no file emission. |
| `nxs-pm.md` | **Keep** — council/decision-record author. |
| `nxs-dev.md` | **Delete** — dev stage cut. |
| `nxs-qa.md` | **Delete** — QA stage cut. |
| `nxs-council-pm.md` | **Delete** — deprecated stub (CLAUDE.md drift). |
| `nxs-council-architect.md` | **Delete** — deprecated stub. |

### Skill rewrites (`claude/.claude/skills/`)

| Skill | Action |
|---|---|
| `nxs-gh-create-epic`, `nxs-gh-create-task` | **Keep** — provenance/tracking surface. Slim task bodies to summary+AC+deps. |
| `nxs-abs-doc-path` | **Keep** — utility. |
| `nxs-generate-tasks` | **Modify** — emit task index, drop LLD generation. |
| `nxs-qa` | **Delete** — QA stage cut. |
| `nxs-workspace-setup`, `nxs-ship`, `nxs-env-sync` | **Checkpoint C8** — these are dev-stage tooling. 0002 says they *may* survive as standalone engineer utilities *outside* the pipeline. **Default:** move out of the Nexus pipeline surface (retain as optional standalone skills, de-referenced from the pipeline command docs) rather than delete outright — cheap to keep, no pipeline coupling. Decide keep-standalone vs delete. |

### Surface / drift updates

- `CLAUDE.md` (repo root) — **Rewrite** the command-workflow section: remove dev/qa stages,
  the per-task-LLD description, stub-agent references; describe the lean A set (0002 §a) and
  the two-store split. This file describes the *pre-refactor* pipeline (task warning) — it is
  surface to update, not a constraint.
- `user-docs/`, `DOCUMENTATION.md`, `how-to-nexus.md`, `README.md` — **Modify** for the lean
  pipeline. Scope: stage list, artifact descriptions, two-store explanation. (Survey
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

**BLOCKER — close emission must land somewhere durable.** `/nxs.close` emits `LibraryDelta`s
but B's queue/apply doesn't exist until B1. Close must write the delta block to a durable
staged form now — the `LibraryDelta` block inside the close record itself, plus (preferred)
a sidecar staging file the future distiller reads. If A1 discards the deltas, the A2 pilot
produces no real B input and B1 starts blind. The staging shape must match 0003 §8.2 exactly.

**Exit criteria:** all listed deletes done; rewritten commands produce only A0-template
artifacts; `grep -ri 'nxs-dev\|nxs-qa\|nxs-council-pm\|nxs-council-architect\|per-task LLD'`
over `claude/` and root docs returns only intentional historical references; CLAUDE.md
describes the lean set; update script no longer leaves orphans. Library still empty — no A1
work writes to `.nexus/library/`.

---

## Phase A2 — Pilot System A on one real epic

**Depends on:** A1. **Gates entry to B.**

Run the reshaped pipeline (init→epic→hld→tasks→analyze→close) end-to-end on **one real
epic**. The refactor's own next unit of work is the natural candidate — see Checkpoint C10.

- **Checkpoint C10 — Dogfooding.** Whether the refactor itself runs through the pipeline,
  and which version. **Default:** dogfood Phase B's planning on the *reshaped* (post-A1)
  pipeline — B is a real epic and exercises A2 for free. Don't dogfood mid-A1 (the pipeline
  is in pieces). Decide: dogfood-on-new vs pilot a separate throwaway epic.

**Exit criteria:** one epic produces a slim epic, a focused decision record, a task index +
slim GH issues, an inline analyze gate, and a close record whose `LibraryDelta` block
validates against 0003 §8.2. That staged delta block is captured as **B1's first real test
fixture.** No template section forced empty without cause (C5 whitelist honored). If the
pilot reveals the emission shape can't carry something real, amend 0003 §8.2 (its designated
amendment surface) — *not* the page schema.

---

## Phase B0 — Distiller design (mechanism checkpoints)

**Depends on:** A2 (real close-record fixture exists). Pure design; no code yet. Read both
research notes here (their stated "read when the distiller conversation opens" trigger).

**Doctrine fixed by prior art (not checkpoints — adopt):**
- *Mechanics as code, judgment as prompt* (PAI §2.3): everything checkable — body cap,
  frontmatter completeness, `touches:`↔Integration-Points equality, decision-log-entry-
  required, §8.3 rejections — is deterministic TS, never prompt text.
- *Candidates never write the library directly* (PAI §2.1): close emits to a staged queue;
  apply is an explicit curated step.
- *Recipes as data, house-style preamble, output sanitization* (open-notebook §2): named
  versioned prompt templates (likely one per delta-field family); a shared preamble enforces
  §8.3 in the prompt; sanitize model output (`clean_thinking_content` analog) before any
  append — the Decision Log is append-only, a polluted entry is forever.

**Checkpoints:**

| # | Question | Recommended default |
|---|---|---|
| C11 — `touches:` reciprocity | 0003 never says whether a touched page gets a reciprocal `touches_*` edit (PAI §2.5). Without a rule, blast-radius grep under-reports. | **Adopt symmetry:** a real interaction is bidirectional — one delta's `touches_added: [X]` fans out to a reciprocal edit on page X in the *same* emission. Make it a deterministic distiller step, not prompt judgment. |
| C12 — Queue expiry | Staged deltas nobody promotes (PAI §2.6). | **Adopt expiry:** unreviewed staged deltas expire (PAI uses 90 days). A queue that only grows is the JSONata pattern relocated. |
| C13 — Bootstrap trust | How `last_updated_by: "bootstrap"` pages are treated (PAI §1.5). | **Adopt low-trust:** bootstrap pages are re-validated at the first close that touches them; distiller prioritizes that re-validation. |

**Exit criteria:** C11–C13 resolved; the deterministic-vs-prompt split is enumerated as a
checklist (what code does / where the LLM is invoked); recipe set named (one per delta-field
family). No build started.

---

## Phase B1 — Distiller build

**Depends on:** B0. Against the **frozen** 0003 contract — no schema changes originate here;
a forced change is an amendment to 0003 §8.2, surfaced not silently made.

**Deliverables — create (deterministic core, plain TS, PAI §2.3 shape):**
- Schema validator — frontmatter completeness, 400-word body cap, `touches:`↔Integration-
  Points equality, decision-log-entry-required, §8.3 rejection of code/paths/types/specs/
  speculative claims.
- Page/slug mechanics — slug = `concept` = filename; flat `.nexus/library/*.md`; `retire`
  sets `status: deprecated` + moves to `_archive/`; `invariants_retired` strikes through in
  place, never deletes (0003 §2.3, §5).
- Staged candidate queue — `LibraryDelta`s land here at close, applied only after curation;
  expiry per C12.
- Incremental state file — `.harvest-state.json` analog (last run + already-processed
  sources); makes apply/bootstrap idempotent and resumable (PAI §2.2).

**Deliverables — create (prompt layer, recipes as data, open-notebook §2):**
- Named recipe templates (one per delta-field family) + shared §8.3-enforcing preamble.
- Output sanitization before append.

**Deliverables — wire:**
- close-record `LibraryDelta` block → queue → curated apply, with C11 reciprocity fan-out
  applied deterministically.

**No generated index** (0003 §7) — `glob`/`rg` over frontmatter is the index.

**Exit criteria:** the A2 fixture flows close-record → queue → applied pages; produced pages
pass the validator; a deliberately malformed delta (§8.3 violation, missing
decision-log-entry, over-cap body) is *rejected by code*, not by prompt. Reciprocal
`touches:` edits land in the same emission. Re-running apply is a no-op (idempotent).

---

## Phase B2 — Bootstrap

**Depends on:** B1 (same contract, replayed in bulk). PAI ISA Seed/Migrate are working
analogs (PAI §2.2); open-notebook proves per-source independence parallelizes (ON §2.3).

**Deliverables — create:**
- Bootstrap routine — derives the same `LibraryDelta` shape in bulk from a repo's existing
  history (READMEs, code structure, recent commits, prior epics). Idempotent + resumable via
  the B1 state file — re-runnable in chunks, not one fragile pass. Emits
  `last_updated_by: "bootstrap"` (low-trust per C13).

**Exit criteria:** deferred to B-pilot.

---

## Phase B3 — Read side (the second feeding direction)

**Depends on:** B2 (library must hold content before reads do anything). This closes the
A↔B loop.

**Deliverables — wire (the `concepts:` field defined in A1 now goes live):**
- `concepts:` reading-list load — `/nxs.epic` and `/nxs.hld` load the named library pages as
  the cheap authoritative read path; grep is the fallback (0003 §5). Optional per-concept
  one-line *why-you're-reading-this* (open-notebook §2.5) — weigh, don't pre-commit.
- **PM invariant-conflict gate** as a **two-stage scan** (PAI §2.4): deterministic grep of
  the new epic's terms against `aliases:`/`Key Invariants` for *candidate* pages → model
  reviews *only those* for contradiction. Cheap candidates, model only where judgment lives.

**Exit criteria:** an epic naming a `concepts:` list loads those pages; an epic that
contradicts a stored invariant is flagged by the two-stage gate; grep fallback works when
the list is absent.

---

## Phase B-pilot — Bootstrap a real repo

**Depends on:** B2 (+ B3 for the read-loop check). **Gates "B done."**

Run bootstrap against one real repository with real history.

**Exit criteria:** bootstrap produces a coherent library (no silent near-duplicate concepts —
the first scale casualty, open-notebook §3.1); resuming a half-run completes without
re-emitting; bootstrap pages are flagged low-trust and re-validated at the next touching
close; a `/nxs.hld` on that repo successfully reads library pages for System Context. Only
now is the A↔B mutual feeding (0001) actually realized.

---

## Phase C — Rollout + institutionalize the razor

**Depends on:** B-pilot. Steady-state hygiene, not a feature.

- **Institutionalize the 0001 razor as a recurring audit** (PAI §5.3 — the cautionary tale:
  45 skills / 171 workflows / mandatory boilerplate, then a "Lean and Mean" release deleting
  68% of directories). **Named test:** *"every artifact a forcing function for a human
  decision OR machine-consumed per 0003 — else cut."* **Fixed verdict categories** (PAI's:
  CUT / RESOLVE / MERGE / SHARPEN / KEEP). Schedule its **first run post-refactor**; recur
  thereafter. The 0002 pass was one-time — without recurrence the rebuilt pipeline re-bloats.
- **Mirror reconciliation** — if C9 deferred Gemini, apply the full A1+B changes to
  `gemini/.gemini/` here and drop the "stale" marker.
- **Success metrics** — deferred by choice (0001). *Note* where they could attach (e.g.
  pages-per-close, duplicate-concept rate, decision-record section-fill under C5) — **do not
  invent gates.** Attachment points only.

**Exit criteria:** first razor audit run recorded with verdicts; mirror reconciled or
explicitly still-deferred with owner; metric attachment points noted in CLAUDE.md.

---

## Risks (BLOCKER / ADDRESS only)

- **BLOCKER — close emission durability (A1).** If `/nxs.close` discards `LibraryDelta`s
  before B1 exists, A2 yields no real B fixture and B1 starts blind. Mitigation: A1 writes
  the delta block to the close record *and* a sidecar staging file in 0003 §8.2 shape.
- **BLOCKER — two-store leak via the close record.** The close record (in `docs/`) carrying
  a machine block is safe *only* while the deltas are gated at the close review. If close
  ever auto-applies to the library without that human gate, the wall is breached (open-
  notebook `save_as_note()`). Apply stays a curated step (B1), never automatic.
- **ADDRESS — update script leaves orphans.** `cp -rf` doesn't prune; cut commands/agents/
  skills linger on existing installs. Add a removal step or document manual cleanup (A1).
- **ADDRESS — Gemini mirror divergence.** Deferring the mirror (C9) is fine only if
  `claude/.claude/` is marked canonical and the mirror marked stale; otherwise the two drift
  silently. Reconcile in C.
- **ADDRESS — distiller over-generation (the disease, recursed).** Thousands of library
  pages is more likely distiller bloat than a retrieval-tech gap (open-notebook §3.1). The
  Phase C razor audit must cover the distiller's *output*, not just the command pipeline.

## What this plan deliberately does not do

- No Graphify / embeddings / RAG / Serena-MCP / community topology. Reopen *only* on
  measured recall failure at high-hundreds-to-thousands of pages (open-notebook §3.1) — the
  retrofit is a gitignored per-page embedding sidecar, not 0003's amendment.
- No `/nxs.dev`, `/nxs.yolo.dev`, `/nxs.qa` — implementation is the engineer's (0001 D4).
- No success-metric gates (deferred by choice, 0001).
- No coaching-agent product line; nothing archived under `.nexus/archive/` as direction.
- No speculative timelines or three-scenario estimate tables — that pattern is what this
  refactor removes.
