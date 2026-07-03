# Decision log — amendment history (0001–0004)

Chronological record of the cross-document changes — supersessions, amendments, and gap
resolutions — that previously lived as inline markup inside the numbered decision records.
With this history extracted here, **0001–0004 read as clean, current-state documents**; this
log carries the "what changed, when, and which later decision drove it." The amending records
themselves (0005–0007) keep their own status banners.

Most recent first.

## 2026-07-02 — 0011: dogfood re-evaluation of 0001–0010 (R1–R7 all accepted)

**0001–0010 re-read end-to-end** against the restated objective — validate the Nexus pipeline
by running it, with System B as a knowledge base that both informs future decisions **and ramps
up new contributors**. The skeleton **holds** (two-system split, razor, committed queue,
distillation-PR, story-as-unit, digest — all re-tested and upheld, no churn). Eight findings,
seven recommendations, **all accepted 2026-07-02**: **R1** add contributor
ramp-up as a third 0003 §1 consumer (derived code-anchor sidecars refreshed by the `/nxs.distill`
drain and seeded at bootstrap; an on-demand `/nxs.explain [topic]` read path — argument = guided
walkthrough of one aspect, no argument = ramp-up tour; `concepts:` pointer on story issues);
**R2** close the write-only loops (`/nxs.epic` reads `docs/delivery/lessons/` at sizing and
surfaces backlog overlap at the digest); **R3** live decision record — in-flight decisions
captured as structured stubs when made (reverses 0004 C6; promotes 0007's open stub item);
**R4** validate the pipeline **with Prime as the subject** (not mandatorily Nexus-on-Nexus) —
import Prime's `.nexus/` + `docs/` surfaces (real in-flight epic `fe205650`), then drive it to
close and distill; depends on R5. Distilling Nexus's own 0001–0010 (F5: the records exhibit the
amendment-sprawl disease the store cures) is decoupled to a later follow-on. **R5** slim 0004 B1
to validator-as-code + a `/nxs.distill` command (cut recipes-as-data and the state file until
scale demands); **R6** verification flag lands at bootstrap, paired with C13; **R7** relocate
`.nexus/` to the repo root (converges with R4's import into one root store). Also flagged: the
glossary→`aliases:` capture path silently broke when 0006 removed structured emission; and Prime
brings stale (cut) task templates + cross-repo provenance to remap. Full record:
[`0011`](./0011-dogfood-reevaluation.md).

## 2026-06-29 — 0010: `/nxs.epic` files story issues at an approval gate; `/nxs.tasks` cut

Story-issue creation moves into **`/nxs.epic`** and **`/nxs.tasks` is eliminated**. The epic issue
and its story sub-issues are now filed **together** at the end of `/nxs.epic`, gated by a
**decision-grade approval digest** (feature line + epic prose + stories as one-liners-with-sizes +
Assumptions/Out-of-Scope) that is the read-surface in place of the full `epic.md`. **Open questions
block the gate** and are the only pre-filing safeguard — `/nxs.analyze` is not run before filing (a
design split surfaced later by `/nxs.hld` is an issue edit). On `approve`, `/nxs.epic` creates the
epic issue, sequences the stories (`blocked_by`), files one issue per story, writes
`## Implementation Sequence` back, and writes the feature nav index (`README.md`) **linking directly
to the epic issue** — the README is deferred until the issue exists, never a draft. A pending queue
entry (epic with no `link`) is re-enterable via `/nxs.epic --resume`.
Pipeline becomes **setup → epic → hld → analyze → close**. **Rationale:** 0009 chose the story as the
unit but left a thin repurposed `/nxs.tasks` (sequence + gate + create) as an extra hop and offered no
read-surface reduction at the only checkpoint that mattered; the digest reduces what the human reads
without fragmenting the single epic artifact (so 0009's rejection of per-story files still holds), and
coupling epic+story filing makes approval the single forcing function. **Rejected:** keeping
`/nxs.tasks`; per-story/AC files; running `/nxs.analyze` inside `/nxs.epic`; deferring filing past the
epic. **Amends** 0009 (the `/nxs.tasks` repurpose + GH-creation locus) and supersedes the `/nxs.tasks`
command. `/nxs.analyze` keeps its role; only its `/nxs.tasks` references are retargeted. CLAUDE.md
rewrite remains the deferred 0009 A1 item. Full record:
[`0010`](./0010-epic-files-stories-at-approval-gate.md).

## 2026-06-29 — 0009: the user story is the unit of implementation (task layer cut)

The **user story** becomes the terminal planning unit and the GitHub-issue granularity; Nexus stops
decomposing at the story and no longer breaks stories into technical tasks (that is the engineer's,
0001 D4). `/nxs.tasks` is **repurposed** from "decompose HLD → task index + per-task issues" to
"sequence the epic's stories + create one issue per story"; `/nxs.analyze` **drops** the story↔task
traceability rules and the barrel-merge auto-remediation (no tasks to trace or merge), keeping
terminology normalization + the `story_type` AC-quality check + a new story↔decision-record coverage
check, and stays an inline gate (no `task-review.md`). Each story is sized S/M in `/nxs.epic` and the
epic `complexity` is a bottom-up rollup; a single story > M splits inside the epic. GH model flips:
epic → **story** issues (was epic → task issues). **Rationale:** the 0001 razor applied to the task
layer — 0004 cut `/nxs.dev` but kept a task-decomposition layer that has no consumer (the distiller
reads decision + close records + diff, not the task index, 0006) and forces no human decision the
story doesn't already encode (INVEST). Task slicing is horizontal → manufactures non-shippable
half-solutions; the barrel-merge remediation existed only to clean those up. **Rejected:** keeping
tasks as the unit; one-file-per-story/AC; a separate `story-index.md`. **Amends** 0001 D4
(interpretation), 0002 §5/§8, and 0004 (A0 templates — cut `task-index-template`/`task-template`;
A1 `nxs.tasks`/`nxs.analyze` rows + skill table — delete `nxs-generate-tasks`, repurpose
`nxs-gh-create-task` → `nxs-gh-create-story`; §5/§8; "does not do"). Full record:
[`0009`](./0009-story-as-implementation-unit.md).

## 2026-06-28 — 0008: `/nxs.epic` takes direct intent; oversized scope → stubs

`/nxs.epic` drops the feature-brief precondition and takes a natural-language capability
description directly; the feature container becomes a scaffolded **output** (name confirmed once),
not an input gate. The right-sizing gate is **kept**, but its `> M` consent path now emits **epic
stubs** (slug + functional goal + candidate story-group titles + complexity + `blocked_by`) into
`docs/features/<name>/backlog.md` — split by functional goal — instead of full epics; the full
`epic.md` is deferred to a later per-stub `/nxs.epic <stub-ref>` promotion. **Rationale:** the
brief is thin friction whose coherence role is absorbed by `context.md` + the `concepts:` read
list, and multi-full-epic generation is the over-generation 0001 names (it fixes the latent hole
in 0002 §3's Option 2). **Rejected:** an "initiative" tier (no 4th level — the feature folder is
already a multi-epic container) and renaming `/nxs.epic` → `/nxs.plan` (cosmetic). Amends 0002 §3
(epic entry + decomposition shape), 0004 A1 `nxs.epic` row, and 0004 C2 (`backlog.md` gains
`/nxs.epic` as a second writer). Full record: [`0008`](./0008-epic-direct-intent-and-stub-decomposition.md).

## 2026-06-28 — templates nested under the config surface (`.nexus/config/templates/`)

The template home moves **`.nexus/templates/` → `.nexus/config/templates/`**, superseding the
2026-06-26 sibling-folder decision (0004 A0). Templates and the per-project delivery config now
share **one** `.nexus/config/` surface rather than two siblings under `.nexus/`: templates live in
`.nexus/config/templates/`, the label set (`task-labels.md`, `config.*`) directly under
`.nexus/config/`. **Rationale:** both are per-project, committed Nexus state with the same
lifecycle; collapsing them to a single surface keeps `.nexus/`'s top level to the three role-distinct
stores (`queue/` committed-transient, `concepts/` machine, `config/` per-project config) instead of a
fourth near-duplicate. The seed-if-absent contract is unchanged — the install/update scripts still
copy the `common/templates/` master, only the destination path changes. Touches 0004 A0 (home +
seeding paragraphs, C0a seed step, exit criteria), 0005 §("further `.nexus/` surfaces"), `nxs.setup`,
the `nxs.update.{claude,gemini}.{sh,ps1}` seed step, `gemini/.gemini/commands/nxs.init.md`, and the
CLAUDE.md Standards Template pointer.

## 2026-06-28 — 0004 A1: `nxs.init` + `nxs.product-context` merged into `nxs.setup`

The two bootstrap commands collapse into one **`/nxs.setup`** command backed by a new
**`nxs-setup` skill**. `setup` auto-detects the stack/standards (**confirm-only** — asks only
when detection is genuinely ambiguous) and scaffolds the Nexus surfaces (`nxs.init`'s job:
`stack.md`, standards incl. the G4 NFR home, `.nexus/config/task-labels.md`,
`docs/delivery/lessons/`, no `docs/system/README.md`, queue committed not gitignored), then
**invokes the `nxs-setup` skill** for the interactive ≤5-question product-context interview
(`nxs.product-context`'s job → `docs/product/context.md`). The command orchestrates; the skill
owns the interview only and is **reusable standalone** to refresh product context without
re-bootstrapping. **Rationale:** bootstrap is one user action — splitting it across two commands
made the product-context step easy to skip and duplicated the "check-existing / confirm"
preamble. Old `claude/.claude/commands/nxs.init.md` and `nxs.product-context.md` deleted.
Updates 0004 A1 command + skill tables, the A2 pipeline string (`init→` → `setup→`), and the A0
`standard.template.md` reference note. Gemini mirror stays deferred (C9); the `gemini/.gemini/`
`nxs.init`/`nxs.product-context` files remain until the Phase C reconciliation.

## 2026-06-22 — 0003 §5: slug-uniqueness invariant made explicit

The schema everywhere assumed one slug → one active page but stated it nowhere. **0003 §5 now
carries the invariant explicitly**, plus its emission-time enforcement rule. Trigger: an external
OKF operator (knowledge-catalog#120) surfaced slug collisions at ~7.5k notes (`index`-ish names,
duplicate vendors) and had to enforce uniqueness by hand. Nexus is *more* exposed than a
path-keyed store: flat slug-as-identity (§5) + 400-word cap and "split, don't grow" (§2.2) + the
shared multi-repo store (§2.4/§10) collapse everything into one flat namespace and manufacture
collision pressure. Left unstated, a collision corrupts `touches:` blast radius and — durably —
merges two unrelated append-only Decision Logs into one page. The fix is a **write-time
precondition on the single producer** (the ConceptDelta emitter, §8.2), *not* a post-hoc linter —
holding the no-machinery line of §7 and the single-producer/validate-at-the-gate stance, against
importing the many-producer conformance tooling that operator's catalog needs. Collision resolves
to either an `update` (same concept, append a log entry — never overwrite, §2.3) or a
distinguishing slug (different concept). Amends 0003 §5 only; the page schema (§2) is untouched.

## 2026-06-22 — G1 lessons home moved out of `system/`

The process/delivery lessons folder moves **`docs/system/delivery/lessons/` →
`docs/delivery/lessons/`** (top-level peer of `system/`). Rationale: `docs/system/` holds
*system-concept* knowledge — what the product **is** (stack, standards). G1 lessons are
estimate-vs-actual / decomposition meta-knowledge about the *act of building*; the G1 decision
itself (0002 §b) evicted them from the concept store **because they are not system-concept
knowledge** (fail 0003 §9.1). Filing them under `system/` re-asserted the membership that
eviction denied. `system/` was doing double duty — *topic* ("about the product") and *scope*
("global / cross-epic, not feature-local"); lessons fit the scope axis but fail the topic axis.
Splitting `delivery/` to a top-level home fixes the false parentage while preserving everything
the G1 decision wanted (one-file-per-lesson, merge-conflict-free adds, `glob`/`rg` by PM). The
"sits beside `task-labels.md`" justification also lapsed: 0004 already relocated labels to
`.claude/nexus/task-labels.md`. Touches `nxs.init` (scaffold path), `nxs.close` (write path);
no `nxs.tasks` change (label path already moved in 0004). Updates 0002 §b G1, 0004 §C3 +
`nxs.init`/`nxs.close` rows, and the 0005 §6 `docs/` table inline.

## 2026-06-21 — 0004 consolidated (folds in 0005/0006/0007)

The original `0004-implementation-plan.md` was renamed
[`overridden-0004-implementation-plan.md`](./overridden-0004-implementation-plan.md) and a new
`0004` was written with the 0005/0006/0007 storage + handoff model folded inline. What those
three changed, relative to the original 0004:

- **Storage (0006, retiring 0005).** Planning artifacts (epic, decision record, task index,
  close record) live in one **committed** `.nexus/queue/<branch>/<local-id>/`. The dotted
  `.nexus/.temp/` and the `.nexus/staged/*.json` sidecar are retired; the queue is committed,
  not gitignored, and travels to main with the feature PR.
- **No machine artifact from System A (0006).** The close record is human prose only (key
  decisions + deferred-scope pointer + deviation rationale); the `ConceptDelta` shape is
  repurposed as the distiller's output, not an A emission.
- **Close-emission BLOCKER dissolved (0006).** Durability is structural — the queue entry is
  committed, so there is nothing to stage before deletion.
- **Synthesis in B (0006).** The distiller derives the *what* from the merged diff and the
  *why* from the queued decision + close records; 0003 §9.1 relaxed (B infers the concept
  mapping rather than A pre-producing it).
- **Distillation-PR apply (0007).** The distiller opens a reviewed PR against the concept
  store; the PR merge is the authoritative write; queue entries are deleted when that PR merges.

Also: 0004 A0 templates home set to `claude/.claude/nexus/templates/` (was the dead
`common/docs/system/delivery/`).

## 2026-06-21 — 0007: distiller applies via a reviewed distillation-PR

Amends 0006 (the distiller's apply) and 0003 §8.1 (locus of the authoritative write). The
distiller no longer writes `.nexus/concepts/` on main directly; on its post-merge drain it
opens a distillation-PR against the concept store. The **PR merge** is the authoritative,
human-reviewed write. Consumed queue entries are deleted when that PR merges.

## 2026-06-21 — 0003 §8.2 serialization pinned (revised in place)

The `ConceptDelta` is specified in its **stored form** — a markdown page-patch (YAML
frontmatter + headed markdown sections), explicitly *not* JSON/struct notation. The fields are
unchanged; only their serialization is pinned, removing format ambiguity.

## 2026-06-19 — 0002 §b: schema gaps G1–G4 resolved

- **G1 (process/delivery lessons)** — out of concept-store scope → `docs/system/delivery/lessons/`,
  one file per lesson, written by `/nxs.close`.
- **G2 (alternatives considered)** — `decision_log_entry.body` cap relaxed to admit the refuted
  *viable* alternative + why it lost, with a viability guardrail. **This amends 0003 §8.2.**
- **G3 (deferred scope)** — append-only `docs/features/<feature>/backlog.md`; the close record
  carries only a pointer.
- **G4 (cross-cutting NFR budgets)** — route to `docs/system/standards/`; no synthetic concept
  page.

G1/G3/G4 are System-A homes that leave the 0003 page schema untouched; only G2 amends 0003.

## 2026-06-14 — 0006: queue-based distillation handoff

- Collapses 0005's two surfaces (`.nexus/.temp/` + `.nexus/staged/`) into one committed
  `.nexus/queue/<branch>/<local-id>/`. **Supersedes 0005 §2/§4/§5/§6.**
- Amends **0003 §8.1** (close = *emission*, not the authoritative write), **§8.2**
  (`ConceptDelta` is the distiller's internal/output shape, not an A emission), and **§9.1**
  (B infers the concept mapping from the diff + queued artifacts; A no longer pre-produces it).
- **Dissolves the 0004 close-emission BLOCKER** (durability is structural). Simplifies 0004 A0
  `close-record-template` to human prose only.
- Confirms 0002 §3's folder-rename/numbered-folder convention is gone (the `<local-id>` model
  introduced by 0005 replaces it).

## 2026-06-14 — 0005: transient artifact storage

Introduced `.nexus/.temp/<branch>/<local-id>/` (gitignored) + `.nexus/staged/<local-id>.json`,
and narrowed `docs/` to permanent human artifacts. Superseded 0004's implicit assumption that
planning artifacts lived in `docs/`, and replaced 0002 §3's numbered-folder rename convention
with the `<local-id>` model. **§2/§4/§5/§6 were later superseded by 0006** (above); §1 path
discovery and §3 close-cleanup survive in spirit.

## 2026-06-12 — 0004: refactor implementation plan (original)

Sequenced the build (A0 → C) against the frozen 0001–0003 contract. Consolidated 2026-06-21
(top of this log).

## 2026-06-10 — 0002 & 0003 (originals)

0002 pipeline audit (keep/slim/cut per stage) and 0003 concept-page schema + emission contract.
Their later amendments are listed above.

## 2026-06-09 — 0001: refactor direction

Root decision (two-system split, grep-native knowledge, scope boundary, sequencing). No
subsequent amendments.
