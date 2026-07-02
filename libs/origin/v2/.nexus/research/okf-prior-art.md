# Open Knowledge Format (OKF) as prior art for System B's concept store

**Status:** Research note. No decisions made here.
**Date:** 2026-06-19
**Relates to:** [`0001-refactor-direction.md`](../decisions/0001-refactor-direction.md)
(D2 grep-native/no-topology, D3 git-tracked-not-derived),
[`0003-concept-schema.md`](../decisions/0003-concept-schema.md) (page schema, `touches:`,
flat namespace, no-index decision),
[`../concepts/speculative-over-generation.md`](../concepts/speculative-over-generation.md)
(distiller-bloat manifestation).
**Companions:** [`open-notebook-prior-art.md`](open-notebook-prior-art.md),
[`pai-prior-art.md`](pai-prior-art.md) — those analyse the *distiller mechanism*; this one
analyses an external *storage format* and tests our schema against it.
**Lens:** read as a developmental-psychology critique — the governing question is whether a
format stores a *snapshot of what is* or a *developmental record of how understanding
changed*. That distinction organises the whole note.

---

## What was analysed and why

[OKF](https://cloud.google.com/products/knowledge-catalog) is Google's open, vendor-neutral
format for representing knowledge as a directory of markdown files with YAML frontmatter
(local clone: `~/projects/contrib/knowledge-catalog`; spec at `okf/SPEC.md` v0.1; three
worked bundles in `okf/bundles/` produced by a Gemini/ADK enrichment agent). It is the
closest external analogue to System B's `.nexus/concepts/` yet found: an independent team
arrived at nearly the same substrate from the opposite direction (cataloguing data assets,
not distilling delivery judgment). That makes it both a **validation** of our substrate bet
and a **contrast case** that sharpens why our two flagged deviations exist.

Analysed against the frozen concept schema (0003). No decision is taken here; this feeds the
distiller/bootstrap conversation and any future revision of 0003 §2/§4/§5.

---

## The substrate convergence — OKF corroborates 0001 D2/D3

Strip both designs to their structural commitments and they are the same artifact:

| Commitment | OKF | Nexus concept store |
|---|---|---|
| Storage | directory of markdown + YAML frontmatter | same |
| Distribution | git repo (history, diffs, blame, PR review) | same (git-tracked, 0001 D3) |
| Access | `cat`/`grep`, no SDK, no registry, no query language | same (0001 D2) |
| Relationships | standard markdown links = untyped directed edges | same, plus `touches:` |
| Consumption | permissive: tolerate broken links, unknown fields/types | same (0003 §9 spirit) |
| Navigation | progressive disclosure via `index.md` | Summary-first grep + `concepts:` reading list |

This convergence is the single most useful thing in the note: **a Google team building for a
completely different purpose independently re-derived our core bet.** Markdown + frontmatter
+ git + grep + untyped links is not a Nexus idiosyncrasy or a corner we cut for lack of
tooling — it is a format two designs reach when the requirements are "human-readable,
agent-parseable, diffable, portable, no central authority." Cite OKF as external evidence
when 0001 D2/D3 is questioned.

One sharp lesson from the convergence concerns **schema strictness vs. producer
heterogeneity.** OKF requires exactly *one* frontmatter field (`type:`); everything else is
optional, and consumers must not reject unknown keys. That minimalism is correct *for OKF*
because OKF expects many heterogeneous producers (hand authors, ADK agents, LangChain
agents, Dataplex/Collibra exporters, db-walking scripts). Nexus requires five fields
(`title`/`aliases`/`touches`/`last_updated_by`/`status`) and can afford to, because it has
**exactly one producer** — the distiller. Principle worth keeping: *required-field count
should scale inversely with producer heterogeneity.* If the concept store ever admits multiple
independent producers (multi-repo, third-party seeds), relax toward OKF-style minimalism.

---

## The deep divergence — catalog vs. ledger (snapshot vs. developmental record)

Everything else follows from one difference in *purpose*:

- **OKF is a catalog of what exists.** Its concepts are nouns bound to a `resource:` URI — a
  BigQuery table, a dataset, an API. The truth lives *elsewhere* (the real table); the OKF
  doc is a queryable projection of it, and is **largely regenerable** (re-run the enrichment
  agent against the source metadata). Its native question is present-tense: *"what is this
  asset?"*
- **Nexus concept store is a ledger of what was decided and why.** Its concepts are behavioral
  ideas, and it explicitly *forbids* the regenerable layer — no file paths, no schemas, no
  type/function names (0003 §2.2), because those rot and code is their truth (0001 D3). What
  remains is exactly the **non-regenerable residue of human judgment**. Its native question
  is historical: *"what must I not break or relitigate?"* (0003 §1).

In developmental-psychology terms: OKF stores a **cross-sectional snapshot** of a mature
structure; Nexus stores a **longitudinal record** of how the structure developed. This is
not a quality gap — they serve knowledge at different stages and answer different tenses. But
it is the root from which the two flagged deviations grow, and it dictates which of OKF's
choices we can borrow and which would quietly corrupt our purpose.

---

## Deviation 1 — concept folders (OKF) vs. flat pages (Nexus)

**What OKF does.** Concept ID *is* the file path with `.md` stripped (`SPEC.md` §2). Folders
organise concepts and, crucially, nest: the GA4 bundle has
`references/metrics/event_count.md`, `references/joins/events___ads_clickstats.md`. The user's
observation is exactly right — **folders give you sub-concepts, i.e. scoping a concept under
a domain.** This reads as natural and correct in OKF because the *territory is already
hierarchical* (project → dataset → table; domain → metric), and the tree simply mirrors it.
In developmental terms folders buy **differentiation + hierarchic integration** (Werner's
orthogenetic principle): as a corpus matures it wants to split global buckets into
domain-scoped sub-structures, and a tree expresses that for free.

**What Nexus does.** Flat `.nexus/concepts/*.md`, slug = filename (no slug frontmatter; the readable name is `title:`) (0003 §5),
chosen so `glob` is trivial, there's nothing to walk, and blast radius comes from `touches:`
rather than tree position.

**The critique — folders are right about the need, wrong about the mechanism.** OKF binds
**identity to location** (Concept ID = path). That is a developmental liability, because the
one thing a maturing knowledge corpus must do is *re-categorise* — discover that
`org-resolution`, first written at the root, really belongs under `auth/`. In OKF that move
**changes the concept's identity and breaks every absolute link and external reference to
it.** The spec half-admits this: it recommends bundle-relative `/…` links as "stable when
documents are moved *within their subdirectory*" — i.e. explicitly *not* stable across the
re-categorisation that knowledge growth actually demands. OKF's hierarchy is rigid against
its own orthogenetic process: differentiation is purchased at the cost of **mobility**.

This is precisely why a developmental store should **separate identity from location**, which
is what Nexus's slug-as-identity already does — a concept can be re-scoped, merged, split, or
archived without losing its addressable identity or breaking the provenance hop
(`last_updated_by`, Decision Log attributions). On *this* axis Nexus is the more
developmentally sound design, and OKF is the cautionary example.

**What to learn — adopt the capability, not the mechanism.** Nexus's flat model genuinely
*under-serves differentiation at scale*: a 150-page flat concept store has weak locality and slug
collisions, and the human who hits the manual-curation trigger (0003 §8.1) has nothing to
browse. Two ways to gain OKF's domain-scoping without OKF's path-as-identity trap:

1. **`domain:` (or `scope:`) frontmatter field.** Keep flat files + stable slug; grep gains
   `rg 'domain: auth'`; re-scoping is a one-line frontmatter edit, not a link-breaking move.
   Preserves 0003 §5's flat-glob virtue exactly.
2. **Compound slugs / dotted namespacing** (`auth.session`, `billing.invoice`). Hierarchy in
   the *name*, not the filesystem; stays flat and glob-addressable.

Either gives the sub-concept scoping the user wants while keeping identity stable. The
load-bearing lesson: **express hierarchy in metadata, never in the primary key.**

One more nuance: OKF's sub-concepts are also a *granularity* tell — `metrics/event_count` is
a leaf so small it would be a few lines. Nexus already pushes toward many small pages (400-word
cap + "split, don't grow", 0003 §2.2), so it will face the same navigability pressure OKF
solves with folders. Nexus's intended answer is Summary-first grep for the *machine*
consumer; the `domain:` field above is what extends that answer to the *human* curator.

---

## Deviation 2 — absence of `touches:` in OKF

**What OKF does.** Relationships are expressed *only* by inline markdown links (untyped
directed edges) plus the implicit parent/child of the tree. There is no frontmatter
adjacency field. Relationship *kind* "is conveyed by the surrounding prose, not by the link"
(§5.3). The bundled viewer answers "what points at X" by **reversing the link graph at
consumption time** ("Cited by" backlinks).

**Why the absence is coherent for OKF — and why it would fail Nexus.** OKF's relationship
need is *navigation* ("show me neighbours so I can browse / draw a graph"), and inline links
+ a Cytoscape viewer serve it. But that answer requires either loading every body or running
a graph engine — exactly the computation **0001 D2 forbids**. Nexus's relationship need is
different: *design-time blast radius* — "an architect changing X must cheaply find every
concept X ripples into." `touches:` exists to answer that by `rg 'touches:.*X'` over
**frontmatter alone** — no body loads, no graph. So OKF's absence is not a refutation of
`touches:`; it shows precisely what you forfeit without it (frontmatter-only blast radius)
and the only alternative (link-reversal) is the forbidden path.

**What Nexus can learn from the absence.** `touches:` is denormalised state that can drift
from the Integration Points prose — 0003 §4 already concedes this and makes it *droppable*
(fall back to full-text grep over Integration Points at a recall cost). OKF embodies the
disciplined end of that spectrum: keep relationships in prose/links, derive adjacency on
read. Validating note: our escape hatch is already the OKF model, so the design is
forward-safe — hold `touches:` only while the frontmatter-grep speed earns its maintenance.

**What OKF could learn from Nexus (and what this validates).** OKF's flattening of all edges
to untyped links means you cannot cheaply distinguish "depends on X" from "merely mentions
X." For a catalog that's fine (a join is a join). For *impact analysis* it is insufficient —
which is exactly why Nexus pairs `touches:` with **Integration Points**, one sentence per
neighbour on the *nature* of the interaction. That is a typed, annotated edge in prose —
strictly richer than OKF's bare link. OKF undersells relationships; Nexus's two-layer
(frontmatter set + prose annotation) is the stronger model for the design consumer.

---

## The decisive gap — OKF has no Decision Log (no record of accommodation)

This is where the snapshot-vs-developmental-record distinction pays out, and it is Nexus's
clearest advantage.

OKF's only temporal affordances are:

- `timestamp:` — a single last-modified scalar that **overwrites**.
- `log.md` (optional) — a *directory-level* CRUD changelog ("Added table X", "Created
  playbook Y"). It records that a *file* changed, not how the *understanding* changed or why.

OKF has **no per-concept, append-only, immutable record of why the content is what it is.**
When a concept's truth changes you overwrite the body and bump the timestamp; the prior
understanding and the reason it was abandoned survive only as a git diff — line-noise, not
curated rationale.

The Decision Log (0003 §2.3) is exactly this missing organ, and it is the *point* of the
concept store (0001 D3). In Piagetian terms:

- OKF supports **assimilation** — adding new facts into the existing structure — but it
  **discards accommodation**, the restructuring of the schema when reality contradicted it.
  Accommodation episodes are the moments of genuine learning, and they are precisely what
  overwrite throws away.
- Nexus's struck-through invariant + "Session claim becomes authoritative (retired prior
  invariant) — #114" log entry *is* an accommodation record. It preserves the
  disequilibrium → re-equilibration episode. The struck-not-deleted rule is **conservation**:
  the retired knowledge-object still exists across the transformation, rather than ceasing to
  exist. This is the difference between a system that *knows things* and one that *remembers
  how it learned them.*

Why it matters for the consumer, concretely: Nexus's consumer is an architect designing an
*extension* who must "not relitigate or contradict past decisions" (0003 §1) — an
*intrinsically historical* need a snapshot cannot serve. OKF's consumer is an analyst asking
"what is this table" — a present-tense need a snapshot serves perfectly. **Do not dilute the
Decision Log toward OKF's `log.md`**: a CRUD file-changelog and an append-only rationale
ledger are different organs, and only the latter discharges 0001 D3. If anything, the
transfer runs the other way — OKF would be stronger if it adopted a per-concept rationale
log.

---

## A caution OKF illustrates — controlled vs. uncontrolled distiller over-generation

OKF's enrichment agent mints roughly one concept *per source object* (the StackOverflow
bundle is ~60 files, one per table/enum/reference). That is catalog-scale auto-generation,
and it is exactly the pattern
[`speculative-over-generation.md`](../concepts/speculative-over-generation.md) warns about —
"a knowledge engine that emits thousands of pages… the symptom reads as a retrieval-tech gap
but the cause is a curation failure."

The reason OKF gets away with it and Nexus must not: **OKF concepts are 1:1 with real
resources, so the territory bounds the count.** A dataset has N tables; the bundle has N+k
pages; growth is capped by reality. Nexus concepts are *distilled judgments* bound to nothing
external, so a "one page per source object" reflex has **no natural bound** and degenerates
straight into distiller bloat. Therefore: Nexus must reject OKF's
auto-enrich-per-object production model even while admiring its output format. The format is
borrowable; the *production policy* is not. (This reinforces 0003 §9.1 as amended by 0006:
the distiller *infers* the concept mapping and must own the over-generation razor; it must
never mint a page per diffed file.)

---

## Minor borrowables (optional, must respect the no-paths rule)

- **`type:` field.** OKF's one required field aids routing/relevance ranking. Nexus ranks by
  name/alias/`touches` grep-count (0003 §5); a light `type:` (`subsystem` | `invariant-cluster`
  | `playbook` | `policy`) could refine that sort and the human-browse view. Optional; cut if
  it doesn't earn a retrieval need (the 0003 §1 razor).
- **`resource:` binding — explicitly *reject* for the concept store.** It is the heart of OKF's
  catalog purpose and the direct violation of 0001 D3 (binds the page to regenerable,
  rot-prone external truth). Noted only to mark the boundary clearly.

---

## Net assessment

1. **OKF validates the substrate.** Independent Google convergence on
   markdown+frontmatter+git+grep+untyped-links is strong external corroboration of 0001
   D2/D3 — use it as such.
2. **Deviation 1 (folders/sub-concepts):** the user is right that folders enable
   domain-scoped sub-concepts, a capability the flat model under-serves at scale — but OKF's
   path-as-identity breaks re-categorisation, the very thing maturing knowledge needs. Gain
   the capability via a `domain:` frontmatter field or dotted slugs; **never put hierarchy in
   the primary key.**
3. **Deviation 2 (`touches:`):** OKF's absence is coherent for navigation but cannot serve
   frontmatter-only blast radius without the forbidden graph computation. Keep `touches:`;
   recognise OKF's link-only model as the principled fallback 0003 §4 already encodes.
4. **Decision Log is Nexus's decisive edge and OKF's clearest gap** — the snapshot-vs-record
   distinction. Do not let it drift toward OKF's operational `log.md`.
5. **Reject OKF's per-object enrichment policy** as unbounded distiller over-generation for a
   judgment store, even while adopting its file format.
