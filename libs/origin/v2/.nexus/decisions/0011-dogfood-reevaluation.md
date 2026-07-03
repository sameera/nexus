# 0011 — Re-evaluation of 0001–0010 against the dogfooding + System B objective

**Status:** Audit complete. **All recommendations accepted (R1–R7, 2026-07-02).** R4 was
accepted in reframed form (validate on Prime, not mandatorily Nexus-on-Nexus). Follow-up
amendment records + execution (imports, moves, command edits) land in later passes; this record
captures the decisions and their rationale.
**Date:** 2026-07-02
**Builds on:** all of [`0001`](./0001-refactor-direction.md)–[`0010`](./0010-epic-files-stories-at-approval-gate.md).
**Trigger:** the repo is being turned into a Nexus-managed repo (dogfooding Nexus on Nexus),
and the objective is restated to include System B as an effective knowledge base that
(a) informs future decisions on the active project **and (b) ramps up new contributors** —
for any project Nexus runs against, not just this repo. 0001–0010 were re-read end-to-end
against that objective.

---

## Upheld — re-tested, stands, no churn

This is a re-evaluation, not a rewrite. The following were re-tested against the restated
objective and hold:

| Decision | What was re-tested | Verdict |
|---|---|---|
| 0001 D1–D4 | Two-system split; lean-by-consumer; grep-native/no-topology; scope boundary | **Stands.** The razor and the wall are the right skeleton; every finding below is a gap *within* them, not an argument against them. |
| 0003 §2–§7 | Page schema, 400-word cap, append-only Decision Log, slug-as-key, no generated index | **Stands** as a retrieval design. Gaps are consumer-scope gaps (F1), not shape defects. |
| 0005/0006/0007 | Committed queue; A-dumb/B-smart synthesis split; distillation-PR as the authoritative write | **Stands** structurally. F3 adjusts the *capture point* of the why, not the handoff or the PR gate. |
| 0008/0009/0010 | Direct intent + stubs; story as the terminal unit; approval digest; `/nxs.tasks` cut | **Stands.** The lean-ward amendment chain is correct and self-consistent. |
| 0004 C12 | No queue expiry; drain-SLO flag instead (PAI-default override) | **Stands.** The reasoning (queue = gated backlog of real work, not speculation) is right. |

---

## Findings and recommendations

### F1 — Contributor ramp-up was never a design consumer

[0003 §1](./0003-concept-schema.md) anchors **every** schema field to exactly two machine
consumers — PM spec generation (`/nxs.epic`) and architectural design (`/nxs.hld`) — and
explicitly cuts any field serving neither. The restated objective adds a third consumer
class the schema was cut *against*: a new contributor (or the agent assisting one) ramping
up on the project. Three concrete gaps follow:

1. **No concept→code bridge.** §8.3 bans file paths and type names — correct against rot —
   but leaves no navigable path from a concept page to its implementation. A newcomer who
   has read `org-resolution.md` still cannot find org resolution in the code except by
   guessing that source terms match `aliases:`.
2. **No entry point for a reader who doesn't know what to grep.** Grep-native retrieval
   assumes the reader can name what they want; ramp-up is precisely the case where they
   cannot. §7's index rejection targeted a *per-close-regenerated committed file* (conflict
   magnet, derived state); those reasons do not apply to an on-demand read-side synthesis
   that stores nothing.
3. **Implementers never see Key Invariants.** The story issue is the unit an engineer picks
   up (0009/0010), yet nothing routes the epic's `concepts:` reading list — and therefore
   the invariants the implementation must preserve — into the story issue. The field that
   exists to be preserved is invisible at the point of work.

**R1 — Add "contributor ramp-up" as a third consumer in 0003 §1, with three minimal deltas:**

- **(a) Derived code-anchor surface.** A regenerable concept→code mapping, explicitly
  *derived state* — one sidecar per concept (e.g. `.nexus/anchors/<slug>.md`), never
  hand-maintained page content. 0001 D3 (the store holds non-regenerable judgment) is not
  violated because anchors are regenerable by construction and never live in the page body;
  §8.3 stays intact for pages. **Generation locus — the distiller drain (`/nxs.distill`,
  R5):** the drain is the only moment the concept↔code mapping is *known* rather than
  guessed — the distiller has just mapped the merged diff to per-concept deltas, so it
  refreshes the anchors of every concept its distillation-PR touches as a byproduct, SHA-
  stamped, in the same PR. Bootstrap (B2 / R4's manual distillation) seeds the initial set.
  The read side treats anchors as a cache: `/nxs.explain` staleness-checks cheaply (paths
  exist, symbols still grep) and regenerates by alias-grep on a miss — any consumer may
  rebuild, no consumer may hand-edit. Per-concept sidecar files avoid the §7 conflict-magnet
  objection the same way one-concept-per-file does.
- **(b) On-demand explain/tour read path.** A read-side command **`/nxs.explain [topic]`**:
  with an argument (concept slug, alias, or free term) it resolves the term via the §5
  retrieval paths and guides the caller through that specific aspect — page Summary,
  invariants, then the code walk via the anchors in (a); with no argument it defaults to the
  ramp-up tour, synthesized at ask time from `glob` + page Summaries +
  `docs/product/context.md`. Nothing stored — §7's index rejection stands untouched.
- **(c) Story issues carry the epic's `concepts:` pointer** (or a one-line invariants
  pointer), so the implementer reads the constraints at the point of work.

Amends, if accepted: 0003 §1 (consumer anchor), plus a §8.3-adjacent note distinguishing
page content (paths still banned) from derived sidecars (allowed, gitignored).

- [x] **R1 accepted** — 2026-07-02

### F2 — Write-only knowledge loops

Two System-A knowledge surfaces are written but never read at decision time:

- **`docs/delivery/lessons/`** (G1): written by `/nxs.close`; "consumed by PM estimation"
  is aspirational — no command reads it. Verified in the current commands: `nxs.close.md`
  writes the lesson file; no read appears in `nxs.epic.md` or anywhere else.
- **`docs/features/<name>/backlog.md`** (G3/0008): read only when the PM explicitly
  promotes a stub (`/nxs.epic <stub-slug>`). Close-time deferred scope resurfaces only if
  the PM remembers it exists.

A knowledge base nobody reads at the moment of decision fails the "inform future decisions"
half of the objective outright — the cheapest System-B-shaped win available, and it is
entirely inside System A.

**R2 — Close the loops in `/nxs.epic`:** (a) at story-sizing, glob/rg
`docs/delivery/lessons/` for lessons matching the epic's domain terms and surface them as
estimate-calibration input; (b) at the approval digest, surface backlog entries of the
current feature that overlap the epic's scope (adjacent deferred scope is a scope-decision
input). Command edits deferred to a later pass; this record fixes the contract.

Amends, if accepted: 0004 A1 `nxs.epic` row.

- [x] **R2 accepted** — 2026-07-02

### F3 — Why-capture fidelity: close-time mining loses the decision moment

0004 C6 chose close-time mining of in-flight decisions (GH comments + close review) as the
baseline; [0007](./0007-delta-in-pr-merge-apply.md) left the structured Decision Log stub
as an undecided "optional refinement." But rationale reconstructed at close — often weeks
after the decision — is confabulated: the genuinely considered alternative and the real
trade-off are exactly what memory rewrites. The close-from-diff forcing function
([0006](./0006-queue-distillation-handoff.md)) catches *deviations from the decision
record*; it cannot recover the refuted alternatives behind decisions the record never
carried. For a knowledge store whose entire payload is the why (0001 D3), the capture
point is the single largest fidelity risk in the design.

**R3 — Make the decision record a live document.** In-flight decisions are appended to the
queued decision record as structured stubs *when they are made* (title, 1–3 sentence why,
refuted viable alternative under the G2 guardrail, date). B then carries them near-verbatim
into `decision_log_entry` — removing one lossy prose→structure LLM hop. Close-from-diff
stays as the deviation net; it stops being the primary why-capture. This reverses the C6
default and promotes 0007's open item to decided-direction. Cost honestly stated: a small
in-flight discipline demand on the engineer/PM; bounded by the stub being three lines.

Amends, if accepted: 0004 C6; resolves 0007's "structured Decision Log stub" open item.

- [x] **R3 accepted** — 2026-07-02

### F4 — System B is 100% speculative; the loop has never run once

Every B-side decision (0003 schema, 0006/0007 handoff, C11–C13) was designed and "frozen"
(0001 D5) before a single real distillation existed. Freezing the interface first was the
right sequencing call; treating the frozen contract as *validated* would not be. The
distiller has never processed one real queue entry.

**R4 — Validate the pipeline with Prime as the subject product (2026-07-02, user decision).**
Validation is **product-agnostic**: the point is to prove the Nexus pipeline works
end-to-end, and that does **not** require the subject to be Nexus itself. Prime is a
legitimate subject — it is already partway through the pipeline in `../prime`, and the
monorepo revolves around the **same concept vocabulary** (Prime is a UI harness *for* Nexus),
so a single shared concept store is coherent. Concretely:

- **Import Prime's `.nexus/` into the monorepo** (converges with R7's root relocation — one
  root `.nexus/` becomes the live pipeline surface). Prime brings a **real System-A fixture**:
  the in-flight epic `fe205650` ("Application Shell Layout", complexity M, GH issue `#3`) with
  `epic.md` + `decision-record.md` — exactly the committed queue entry the A2 exit criteria
  wanted and B1 needs as its first fixture.
- **Import the `docs/` read-surfaces too, not just `.nexus/`.** The pipeline reads
  `docs/product/context.md`, `docs/features/`, and `docs/delivery/lessons/`; `.nexus/` alone
  strands them. All exist in `../prime/docs/` and must come with the import or the read side
  (esp. R2's loop-closing) has nothing to read.
- **Validation is import → drive → distill, not import alone.** Importing *provisions* the
  subject. Proving System B still requires driving `fe205650` to **close** (it has a decision
  record but no close record yet) and then running the distiller — so **R4 depends on R5's
  `/nxs.distill`**. Only that run exercises the unproven half (queue + diff → concept pages →
  distillation-PR).

**Two load-bearing details the import surfaces (fix on execution):**

1. **Prime's templates are stale.** `../prime/.nexus/config/templates/` still ships
   `task-index-template.md` and `task-template.md` — the task layer 0009 **cut**. Import the
   config/label set but reseed templates from the current master; do not carry the dead task
   templates in.
2. **Provenance is cross-repo.** The epic's `link: "#3"` and any distilled page's
   `last_updated_by` resolve against **Prime's** repo, not this one. Once the store lives in
   the monorepo, these become the qualified `<owner>/<repo>#n` form (0003 §2.4) — the import
   must remap or the provenance hop breaks.

Amends nothing in the contract if accepted — it executes existing contract on a different
subject; deviations it surfaces amend 0003 §8.2 per that record's own rule (§9).

- [x] **R4 accepted** — 2026-07-02, reframed: validate on Prime (import its `.nexus/` + `docs/`
  surfaces), not mandatorily Nexus-on-Nexus. Depends on R5.

### F5 — The decision records themselves exhibit the disease System B is meant to cure

Current-state truth is smeared across ten ADRs plus an amendment log: 0004 was consolidated
and its original overridden; 0002 is amended by 0008 and 0009; 0003 is amended by 0006 and
the log; reading order is reconstructible only via `decision-log.md`. A new contributor
cannot ramp from this — which is precisely the failure mode the concept store's design
(current-truth page + append-only Decision Log) exists to fix, applied to every project
*except* Nexus's own knowledge.

**Decoupled from R4 (2026-07-02).** R4 now validates on Prime, so distilling Nexus's own
0001–0010 is no longer R4's vehicle — it becomes a **separate follow-on**: once the distiller
exists (R5) and is proven on Prime (R4), point the same `/nxs.distill` (or the manual-curation
trigger, 0003 §8.1) at `libs/origin/v2/.nexus/decisions/` to produce the Nexus toolkit's own
current-truth concept pages. The ADRs remain provenance targets; the concept pages become the
ramp-up read surface (feeds R1's `/nxs.explain`). Recorded here — no separate checkbox — as
the strongest available evidence that the concept-store design is needed: Nexus's own records
demonstrate the very sprawl it cures.

### F6 — Phase B1 machinery is over-planned for current model capability

0004 B1 plans a deterministic queue-reader + delta-constructor, recipes-as-data with a
versioned prompt-template set, a `.harvest-state.json` incremental-state file, and output
sanitization — scaffolding shaped by an assumption of weak LLM judgment needing heavy
harness. Two of its jobs are already structural: queue presence = unconsumed gives
idempotency without a state file, and delete-on-PR-merge gives resumability. The razor,
turned on B (0004's own ADDRESS risk): machinery that exists ahead of demonstrated need is
the disease recursed.

**R5 — Slim B1 to two deliverables:** (a) the deterministic **validator** (worth building
as code: frontmatter completeness, body cap, `touches:`↔Integration-Points equality,
decision-log-entry-required, §8.3 rejections — mechanics-as-code stands); (b) a
**`/nxs.distill` command** — agent-driven, run post-merge, reads queue + diff, constructs
deltas, opens the distillation-PR. Recipes-as-data, the state file, and the standalone
constructor pipeline are cut until a demonstrated scale failure reintroduces them.

Amends, if accepted: 0004 B1 deliverables (B0 doctrine "mechanics as code, judgment as
prompt" survives — the validator is the mechanics; the agent is the judgment).

- [x] **R5 accepted** — 2026-07-02

### F7 — Trust/staleness machinery deferred past the point it is needed

0003 §2.1 deferred the per-page verification flag until "a verification mechanism exists to
set it." But C13 already decided bootstrap pages are low-trust and re-validated at the
first touching close — that *is* a verification mechanism, and bootstrap is the moment the
store fills with exactly the pages most likely to be wrong. Once ramp-up humans consume
pages (F1), a stale invariant misleads a newcomer worse than it misleads a gated PM check.

**R6 — Introduce the verification field at bootstrap time,** paired with C13: bootstrap
pages carry it unverified; the first touching close (or R4's manual distillation review)
flips it. Not built before bootstrap; never deferred past it.

Amends, if accepted: 0003 §2.1 (deferred-field note) at the moment B2/R4 runs.

- [x] **R6 accepted** — 2026-07-02

### F8 — The dogfood install is half-done (OPEN — user decision)

Current repo state: `.claude/` (commands/agents/skills) has moved to the repo root, but the
project-level `.nexus/` (decisions, concepts, research) still lives under
`libs/origin/v2/`, and no `docs/product/context.md` exists. The ADRs and the concept store
are this repo's *project knowledge*; `libs/origin/v2` is toolkit *source*. Leaving them
nested conflates the product being built with the project building it.

**R7 (OPEN):** relocate `.nexus/` to the repo root and run `/nxs.setup` as dogfooding
step 1. Deferred at user request pending review of this record; recorded here so the
half-done state is not silently normalized.

- [x] **R7 accepted** — 2026-07-02

---

## Minor hygiene (noted, no own recommendation)

- `concepts/README.md` "Status: Empty" is false — one page exists. Resolved by R4
  regardless; a one-line fix otherwise.
- The CLAUDE.md command-workflow rewrite remains the open 0009/0010 deferred item.
- **The glossary→`aliases:` capture path broke silently.** 0002 §3 routed epic glossary
  terms to concept-page `aliases:` "at epic close via ConceptDelta"; 0006 removed
  structured emission and the epic no longer stores a glossary (`nxs.epic.md`: "No
  glossary") — so nothing now carries candidate aliases to B. B must infer synonyms from
  prose alone. Cheap fix candidates when B is built: the live decision record (R3) or the
  close record carries a "terms" line. Flagged for B0/B1; not decided here.

## What this record deliberately does not do

- Decides nothing — every recommendation is a pending human decision (the checkboxes are
  the forcing function this record exists for).
- Touches no command, template, or concept page; makes no file moves.
- Does not reopen anything in the Upheld table; findings are gaps within the 0001 skeleton,
  not challenges to it.
