# PAI as prior art for System B (distiller mechanics and curation gates)

**Status:** Research note. No decisions made here.
**Date:** 2026-06-11
**Relates to:** [`0001-refactor-direction.md`](../decisions/0001-refactor-direction.md),
[`0002-pipeline-audit.md`](../decisions/0002-pipeline-audit.md) (schema gaps G1/G2),
[`0003-library-schema.md`](../decisions/0003-library-schema.md)
**Companion:** [`open-notebook-prior-art.md`](open-notebook-prior-art.md) — that analysis
supplied the distiller's *prompt layer* (recipes as data, house-style preamble, bulk replay);
this one supplies the *mechanism and curation layer*. Read both when the distiller
conversation opens.
**Mirror:** committed as note `018` in `~/projects/awzm-notes/brainstorms/library/nexus/`
(commit `ffad159`); if the copies diverge, reconcile against the later commit.
**Primary use:** input for the **distiller / bootstrap design conversation** (the build work
0003 §10 explicitly left out of scope).

---

## What was analyzed and why

[PAI — Personal AI Infrastructure](https://github.com/danielmiessler/Personal_AI_Infrastructure)
(local clone: `~/projects/Personal_AI_Infrastructure`, v5.0.0) is Daniel Miessler's
Claude-Code-native "Life OS." Its Knowledge subsystem is a shipped, *operating*
implementation of nearly the 0003 design: a curated markdown knowledge store fronted by
frontmatter, fed by a deterministic harvester from raw work artifacts, retrieval entirely
`rg`/glob — their stated doctrine is *"no RAG since June 2025... Your filesystem is the
index."* That makes it the closest **running** prior art for System B — the open-notebook
note priced the road we declined; PAI proves the road we chose operates at scale. Analyzed
2026-06-11 against the frozen schema (0003) and the audit's open gaps (0002 §b).

Architecture in one line: markdown memory tiers (append-mostly `MEMORY/` → curated
`KNOWLEDGE/` typed graph, promotion only by curation) + deterministic Bun/TypeScript tools
wrapped by skill prompts (*"prompts wrap code; code doesn't wrap prompts"*) + a seven-phase
"Algorithm" whose per-prompt effort classifier (E1–E5) gates how much artifact each task
gets.

Key files if re-examining (paths under `~/projects/Personal_AI_Infrastructure/Releases/v5.0.0/.claude/`):

| Concern | File |
|---|---|
| Deterministic harvester (queue, incremental state, contradictions, index regen) | `PAI/TOOLS/KnowledgeHarvester.ts` (~1,050 lines plain TS) |
| Conversation mining → staged candidates | `PAI/TOOLS/SessionHarvester.ts` |
| BM25-lite compressed retrieval | `PAI/TOOLS/MemoryRetriever.ts` |
| Knowledge skill (3-pass grep retrieval, ingest ripple, contradiction review) | `skills/Knowledge/SKILL.md` |
| Raw-vs-curated memory taxonomy | `PAI/MEMORY/README.md`, `PAI/MEMORY/KNOWLEDGE/README.md` |
| ISA artifact contract (tier gate, ID stability, C/R/L changelog) | `skills/ISA/SKILL.md` |
| Effort classifier + whitelist fast-path doctrine | `PAI/ALGORITHM/mode-detection.md` |
| Over-prompting audit practice | `skills/BitterPillEngineering/SKILL.md` |

Same three-target mapping as the open-notebook note, plus two sections it didn't need: PAI
resolves two of the 0002 audit's open schema gaps, and contributes one System-A idea.

---

## 1. Validates decisions already frozen (no action)

1. **Grep-native retrieval, operated for a year, at larger scale than ours will reach.**
   Their Knowledge search is a 3-pass `rg` sweep (lexical → frontmatter → wikilink) —
   structurally 0003 §5's four retrieval paths. With open-notebook's price tag on the
   embedding road and PAI's operating history on the grep road, 0001 Decision 2 now has
   independent convergence from both directions.
2. **Raw → curated two-layer split, promotion only by curation.** Their KNOWLEDGE README:
   *"Harvesters elsewhere in MEMORY/ propose candidates that get promoted into here only
   after curation."* The docs/-vs-library wall (0001 Decision 1), arrived at from the
   memory-hygiene side instead of the over-generation side.
3. **Append-only history with tombstones; never renumber.** Their hardest-won ISA gotcha:
   *"ID-stability is the cornerstone... never re-number on edit,"* dropped items get a
   tombstone, because renumbering *"breaks merges silently."* Validates 0003 §2.3's
   strike-through-never-delete invariants. Side-flag for System A: this argues **against**
   the task-renumbering auto-remediation the 0002 audit (§8) kept — anything referenced from
   elsewhere should keep its ID forever.
4. **The lookup test ≈ the anchor test.** Their admission rule — *"Would the user look this
   up by name? If not, it's not knowledge"* — is 0003 §1's field-earns-its-place razor.
5. **Trust without verification machinery.** Their seedling → budding → evergreen maturity
   ladder is what trust calibration looks like before a verification mechanism exists —
   confirming 0003 §2.1 was right to *defer* the verification flag rather than invent one.
   Our lightweight analog already exists: `last_updated_by: "bootstrap"` marks the low-trust
   provenance class; the distiller can prioritize re-validating those pages the first time a
   close touches them.

---

## 2. Liftable for the distiller / bootstrap (the future build)

These map onto the machinery 0003 left undesigned — the mechanism half that the
open-notebook note's prompt-layer findings don't cover.

1. **Harvest-queue staging — candidates never write directly.** Their miner *"writes to
   `_harvest-queue/` for review — never directly to KNOWLEDGE/"*; promotion is an explicit
   curation step. For the distiller: stage `LibraryDelta`s (0003 §8.2) in a queue at close,
   apply only after review. This turns 0003 §8.3's hard boundary from agent discipline into
   a structural gate — the same shape-conversion the open-notebook note §1.4 praised (schema
   over prompt-pleading), applied to the *write path*.
2. **Incremental harvest state.** A tiny `.harvest-state.json` (last run + already-harvested
   paths) makes their harvest idempotent and resumable. For our bootstrap — which chews a
   repo's whole history — this is the difference between "re-runnable in chunks" and "one
   giant fragile pass." Their ISA **Seed** workflow (draft from README + code structure +
   recent commits) and **Migrate** skill (classify chunks against a taxonomy, commit with
   provenance) are working bootstrap analogs.
3. **Mechanics as code, judgment as prompt.** The harvester is ~1,050 lines of plain
   TypeScript doing scanning, schema validation, slug generation, orphan-link detection,
   expiry; the model is invoked only where judgment lives (writing summaries, adjudicating
   contradictions). Distiller rule: everything checkable — body cap, frontmatter
   completeness, `touches:`/Integration-Points equality, decision-log-entry-required,
   §8.3 rejections — is deterministic code, never prompt text.
4. **Two-stage contradiction scanning.** Deterministic candidate pairing (note pairs with
   2+ shared tags) → model semantically reviews *only those pairs*. This is the
   implementation shape for the PM invariant-conflict gate (0003 §2.2): grep the new
   epic's terms against `aliases:`/invariants for candidate pages, model checks only those.
5. **The ripple pass exposes an unspecified rule in 0003.** When PAI ingests a note, it
   updates *reverse-direction* links on related notes. Our `LibraryDelta` carries
   `touches_added` for the emitting concept, but 0003 never says whether the touched page
   gets a reciprocal update. Without a symmetry (or explicit asymmetry) rule, blast-radius
   grep (`rg 'touches:.*\bX\b'`) silently under-reports. Not decided here — flagged as a
   rule the distiller design must specify (likely: a real interaction is bidirectional, so
   one delta fans out to a reciprocal edit in the same emission).
6. **Queue hygiene by expiry.** Unreviewed seedlings expire after 90 days. Staged
   `LibraryDelta`s that nobody promotes should expire too — a curation queue that only grows
   is the JSONata pattern relocated, not removed.

---

## 3. Resolves the 0002 audit's open schema gaps G1 and G2

- **G1 — process/delivery lessons.** PAI keeps these *out* of the knowledge graph entirely:
  a separate LEARNING tier, and — most effectively — per-skill **"Gotchas"** sections, which
  they call *"the highest-information-density part"* of a skill. The pattern: process
  knowledge attaches to the *process artifact it improves* (for us: the command docs,
  `docs/system/standards/` delivery pages), never to concept pages. Confirms the audit's
  "declare it out of library scope" instinct and supplies the concrete home.
- **G2 — alternatives considered.** Their changelog entry format is four mandatory pieces —
  *conjectured / refuted-by / learned / criterion-now* — and the tooling *"refuses to write
  a partial."* A terse, disciplined shape that captures the dead end without prose sprawl.
  Supports resolving G2 by **defining** `decision_log_entry.body`'s "why" to include the
  refuted alternative in one sentence — discipline by format, not cap relaxation.

---

## 4. System-A sidebar: tier-scaled artifact shape

Outside System B, but too directly relevant to the lean refactor to drop.

PAI classifies every task E1–E5 and scales the *required sections of the artifact* by tier:
an E1 task's ISA is Goal + Criteria only; E4 requires all twelve sections; *"sections never
appear empty."* And the bypass is doctrine: *"The fast-path is a whitelist, not a
heuristic"* — because *"any heuristic-shaped bypass becomes a doctrine-evasion route."*

Two separable takeaways:

1. **Scale the decision record by complexity rating.** Nexus's right-sizing gate sizes epic
   *scope*, but the artifact *shape* is one-size. The complexity rating already in epic
   frontmatter could gate which decision-record sections are required — an S epic might need
   only decisions + invariants. The whitelist discipline transfers: the smaller contract is
   an explicit rule, not the model's judgment call.
2. **The single-living-document contrast.** PAI collapses spec, decision log, changelog, and
   verification into one document with five identities. Don't adopt the collapse — PAI is
   single-principal; Nexus is multi-role with GitHub as the tracking surface, and the
   artifact chain matches that. But one element is worth weighing when the close record gets
   designed: *decisions accrue append-only in the decision record during implementation and
   are mined at close* — a cheaper emission story than reconstructing in-flight decisions
   from GH comments after the fact.

---

## 5. Anti-patterns confirmed (what copying them would have broken)

1. **Typed-link ceremony.** Every Knowledge write must carry 2–4 typed `related:` links
   (8 relationship types: `supports`, `contradicts`, `extends`, `part-of`...), body
   wikilinks, and MOC index regeneration. This is the topology 0001 burned, in
   maintenance-burden form — a tax on every emission. Notably, even PAI's "graph" is just
   grep + TypeScript over frontmatter: *nobody in this prior-art set actually needed a graph
   engine.* The ceremony is justified for open-ended personal knowledge where connection is
   the value; for a bounded system-concept inventory (~10² genuine concepts), flat
   `touches:` stands.
2. **Keyword classification.** Their `TYPE_KEYWORDS` routing ("insight" → Ideas, "osint" →
   People) is brittle — tolerable only because output lands in a review queue. Restated as
   the rule: cheap classifiers belong *behind* curation gates, never in front of
   authoritative writes.
3. **The accretion arc — the cautionary tale.** PAI grew to 45 skills, 171 workflows, 37
   hooks, with mandatory voice-notification boilerplate in every skill — then had to build a
   dedicated audit skill (BitterPillEngineering: *"would a smarter model make this
   unnecessary?"*, verdicts CUT/RESOLVE/MERGE/SHARPEN/KEEP) to fight its own bloat, and ship
   a release literally titled "Lean and Mean" deleting 68% of its top-level directories.
   This is the JSONata pattern at toolkit scale. Transfer: the 0001 razor must be a
   **recurring audit with a named test and fixed verdict categories**, not the one-time
   0002 pass — or the rebuilt pipeline re-bloats the same way.
4. **Generated MOC indexes.** PAI regenerates per-domain index dashboards on every write —
   fine single-user, a guaranteed conflict magnet under worktree-per-epic concurrency. The
   context difference explains the differing verdicts; 0003 §7's rejection stands.

---

## Net

PAI changes nothing in the frozen schema — it raises confidence in it. Its contribution is
the unbuilt half, complementary to the open-notebook note: open-notebook supplied the
distiller's *prompt layer*; PAI supplies the *mechanism and curation layer* — deterministic
code with a staged candidate queue and incremental state, two-stage contradiction checking,
queue expiry, and bootstrap-as-replay precedents. It resolves the audit's G1/G2 gaps with
field-tested answers, contributes one System-A idea (tier-scaled artifact shape,
whitelist-gated), and flags exactly one rule for the distiller design to specify:
`touches:` reciprocity.
