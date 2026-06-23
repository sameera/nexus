# Decision log — amendment history (0001–0004)

Chronological record of the cross-document changes — supersessions, amendments, and gap
resolutions — that previously lived as inline markup inside the numbered decision records.
With this history extracted here, **0001–0004 read as clean, current-state documents**; this
log carries the "what changed, when, and which later decision drove it." The amending records
themselves (0005–0007) keep their own status banners.

Most recent first.

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
