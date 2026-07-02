# 0003 — Concept page schema & emission contract (System B)

**Status:** Decided (schema + contract). Distiller/build mechanism not started.
**Date:** 2026-06-10
**Builds on:** [`0001-refactor-direction.md`](./0001-refactor-direction.md) (Decisions 1–3, 5).
**Reconciles with:** the pipeline audit (sibling decision record, the System-A half of the
artifact contract). See [§7](#7-emission-contract) for the handoff surface.
**Amendment history:** see [`decision-log.md`](./decision-log.md).

This record defines what `.nexus/concepts/` holds — the schema of a distilled concept
page — and the *shape* and *triggers* of what System A emits to populate it. It does **not**
design the distiller, the bootstrap, or any update mechanism (Decision 5: freeze the
interface first, build against it later).

---

## 1. Anchor — who reads these pages, and for what

Every field below earns its place by naming a concrete retrieval need of one of **two
machine consumers**:

- **PM spec generation** (`/nxs.epic`, brief authoring) — needs to know *what already
  exists* so a spec extends rather than restates it, and *what constraints* bound the new
  feature so a story doesn't silently contradict the system.
- **Architectural design** (`/nxs.hld`) — needs *current behavior* to design an extension,
  *invariants to preserve*, *blast radius* (which subsystems a change ripples into), and the
  *why* behind prior decisions so a new design doesn't relitigate or break them.

If a proposed field serves neither, it is cut. That is the over-generation razor (0001)
turned on ourselves.

---

## 2. Page schema

One concept per file. The page is the unit of retrieval; the frontmatter is the grep
surface; the body is loaded only after a grep hit decides the page is relevant.

### 2.1 Frontmatter (required unless noted)

| Field | Retrieval need it serves | Notes |
|---|---|---|
| `title` | **Human-readable label on the grep surface.** A readable catalog (`rg '^title:'`) and candidate-surfacing to a human without loading bodies; carries the real display name when the slug is an abbreviation (`auth` → "Authentication"). | Title-case string; mirrors the body H1. The *key* is the filename (= slug), not this field. |
| `aliases` | **Synonym findability.** PM/architect greps a term that isn't the canonical name ("org lookup" → `org-resolution`). Without it the page is invisible to natural phrasing. | flat list of strings. |
| `touches` | **Blast radius.** Architect designing a change to X greps `touches:` across the concept store to find every page that names X — the no-graph substitute for an adjacency edge. | flat list of concept slugs. Mirrors *Integration Points* body section exactly. Non-transitive (see [§4](#4-the-touches-field-and-the-no-topology-line)). |
| `last_updated_by` | **Provenance hop.** From a page, jump to the originating epic to recover full context the page necessarily compressed away. The page-level "git blame." | A provenance reference (see [§2.4](#24-provenance-references-single--and-multi-repo)): `"#<issue>"`, `"<owner>/<repo>#<issue>"`, `"bootstrap"`, or `"manual"`. |
| `status` | **Validity filter.** Architect must not design against a removed subsystem; grep can exclude `status: deprecated` cheaply. | `active` (default) \| `deprecated`. |

**Why there is no `id`/slug frontmatter field.** The filename *is* the slug and the page's
key — `read .nexus/concepts/<slug>.md`. Copying that slug into frontmatter would be derived
state in a non-derived store (the same objection [§7](#7-index-question--resolved-no-generated-index)
raises against a generated index) and a drift surface (rename the file and the frontmatter
silently lies), for zero retrieval gain `glob` doesn't already provide. The page is addressed
by filename; `title` is the readable label, not an identifier.

**Deliberately deferred (not in the core schema):** a per-page confidence/verification flag
(was `verification:` in the archived wiki schema). Trust calibration is a real retrieval
need, but it is coupled to the distiller's code-verification pass, which is later build
work. Until that exists, provenance lives in each Decision Log entry (which cites its
source), and the architect calibrates trust from there. Add a frontmatter flag only when a
verification mechanism exists to set it.

### 2.2 Body sections

| Section | Retrieval need it serves | Cap |
|---|---|---|
| `# <Display Name>` (mirrors `title:`) + **Summary** (lead, ≤3 sentences) | **The grep hit.** The agent decides whether to load the rest of the page from the Summary *alone*. This is the single highest-leverage field for keeping volume retrievable. Lead with the most distinctive sentence; write as if returned alone. | part of body cap |
| `## How It Works` | **Current behavior**, so PM/architect extends it instead of restating it, and designs against what the system actually does. Behavioral, domain-term prose — no file paths, no type/function names (they rot; code is the source of that truth). | ≤180 words |
| `## Key Invariants` | **Hard constraints** the new spec/design must preserve. Consumed by the PM invariant-conflict gate and the architect's conformance pass. The highest-value field for the design consumer. | ≤7, numbered, one sentence each |
| `## Integration Points` | **Blast radius, in prose** — one sentence per neighboring concept on the *nature* of the interaction. The readable form of `touches:`; the set must equal `touches:`. | within body cap |
| `## Decision Log` | **The why.** Recover the rationale behind past decisions so a new design doesn't relitigate or contradict them. This is the durable judgment that *cannot be regenerated from code* (0001 Decision 3) — the reason the concept store is git-tracked, not derived. | **uncapped, append-only** |

**Body word cap: 400 words, excluding frontmatter and the Decision Log.** Rationale: the
body is the "current truth" retrieval target and N of them get loaded per task — it must
stay cheap to load. The Decision Log is uncapped because it is history, retrieved
selectively *after* the page is already chosen, and never grep-matched cross-page in the
common path. **Exceeding the cap means the concept is too broad — split it into two concept
pages, don't grow it.** (The *when/how* of splitting is distiller work, out of scope here;
the cap and the "split, don't grow" rule are the contract.)

**No code blocks** beyond a single inline span, **no file paths.** Both rot against the
source and belong in `docs/system/standards/` or source comments, not here. A page that
needs them is describing implementation, not a concept.

### 2.3 Append-only / decision-log semantics (warranted)

The Decision Log is **append-only and immutable**:

- Every emission that changes a page **appends exactly one** Decision Log entry. No silent
  edits.
- Prior entries are **never edited, reordered, or deleted.** A reversed decision is recorded
  as a *new* entry stating the reversal.
- An invariant that becomes false is **struck through** (`~~...~~`) in place and a Decision
  Log entry records the retirement — it is **never deleted.** A future design must be able to
  see that the constraint once held and why it was dropped.

Rationale: the log is the one artifact in the whole system that cannot be reconstructed from
code (0001 Decision 3). Destroying its history defeats System B's entire purpose. This is
the narrow, concept-store-scoped application of 0001's deferred "immutable decision records" idea.

### 2.4 Provenance references (single- and multi-repo)

`last_updated_by` and every Decision Log attribution point at the originating issue. A bare
`#114` is unambiguous only within one repo — across repos `#114` exists everywhere, and the
provenance hop breaks. It breaks worst in the Decision Log, where one shared concept (e.g.
`auth`) can accumulate entries from epics in *different* repos.

A provenance reference is therefore one of two grep-native forms:

- `#<issue>` — issue in the concept store's **home repo**; the terse single-repo default.
- `<owner>/<repo>#<issue>` — fully-qualified; used for any cross-repo reference.

**Resolution rule:** an unqualified `#n` resolves against a single declared *home repo* for
the concept store; a qualified `<owner>/<repo>#n` overrides it. This is GitHub's own cross-repo
issue syntax, so no new resolver is needed (`gh issue view <owner>/<repo>#n`, or build the
URL deterministically), it stays greppable (`rg 'backend#114'`), and single-repo pages stay
short. The full URL form is rejected as noise.

This hardens the *reference*. It does **not** decide the larger multi-repo questions — where
the concept store physically lives (per-repo vs. one shared concept store aggregating N code repos vs.
submodule) and whether `touches:` may cross repos. Those are architecture decisions 0001 did
not take on; see [§10](#10-out-of-scope-here).

---

## 3. Example page

A complete page, `.nexus/concepts/org-resolution.md`:

```markdown
---
title: "Org Resolution"
aliases: ["organization lookup", "org matching", "tenant resolution"]
touches: ["auth", "session", "space-membership"]
last_updated_by: "#114"
status: active
---

# Org Resolution

Maps an inbound request to exactly one organization before any authorization runs, using
the request's host and a signed session claim. It is the first gate in the request
lifecycle: every downstream permission check assumes a resolved org is already in context.

## How It Works

- A request arrives carrying a host (subdomain) and, once authenticated, a session claim.
- Resolution prefers the session claim; the host is used only for the pre-auth landing case.
- A resolved org is pinned into request context for the lifetime of the request. Downstream
  code never re-resolves.
- An unresolvable org short-circuits the request before authorization — it is treated as
  "no such tenant," not "forbidden," so existence of an org is not leaked.

## Key Invariants

1. Exactly one org is resolved per request; never zero-with-fallthrough, never two.
2. Resolution completes before any authorization or membership check runs.
3. Org identifiers are 32-character lowercase hex without hyphens.
4. An unresolvable org returns "not found," never "forbidden" (no tenant-existence leak).
5. ~~The host subdomain is the authoritative resolution source.~~ (Retired #114 — see log.)

## Integration Points

- [auth](auth.md) — authorization runs only after an org is pinned; reads org from context.
- [session](session.md) — the session claim is the primary resolution source post-auth.
- [space-membership](space-membership.md) — membership is always scoped to the resolved org.

## Decision Log

### 2026-01-20 — #87 — Initial concept
Established single-org-per-request resolution gating all authorization.

### 2026-03-02 — #98 — No tenant-existence leak
Unresolvable orgs return "not found" rather than "forbidden" after a pentest finding that
"forbidden" let attackers enumerate valid tenants.

### 2026-06-09 — #114 — Session claim becomes authoritative
Multi-domain customers broke host-based resolution. Resolution now prefers the signed
session claim; host is retained only for the pre-auth landing page. Retired the prior
invariant that the host subdomain was authoritative.
```

Note: the body (Summary + How It Works + Key Invariants + Integration Points) is ~190
words; the Decision Log adds history without counting against the cap.

---

## 4. The `touches:` field and the no-topology line

`touches:` looks adjacent to the forbidden "topology," so the boundary is drawn explicitly:

- It is a **flat list of concept names in frontmatter, retrieved by `grep`.** There is no
  graph engine, no community detection, no precomputed adjacency, no embedding, no
  transitive traversal. "What touches X?" is answered by `rg 'touches:.*\bX\b'` —
  string matching, not graph computation. This is exactly the grep-native retrieval 0001
  Decision 2 mandates, and the stance the most recent prior art (`v2-proposal.md`) took.
- **Non-transitive, capped.** An agent loads directly-relevant pages and *surfaces* their
  `touches:` as candidates, but does not follow them transitively. Cap **5–7 pages per
  task** to bound token cost and keep the design conversation on the concepts the work
  actually intersects.
- **Removable without loss.** `touches:` is a denormalized convenience over the
  *Integration Points* prose, which carries the same information. If it ever drifts toward
  feeling like a maintained graph, it can be dropped and blast-radius answered by full-text
  grep over Integration Points — at a small recall cost, with zero schema migration.

---

## 5. Keying & retrieval

**Naming.** `<concept-slug>.md`, kebab-case (the kebab-case of `title:`). The filename is the
key — there is no frontmatter slug field that restates it. Flat
directory — `.nexus/concepts/*.md` — so `glob` is trivial and there is no nesting to walk.
Deprecated pages move to `.nexus/concepts/_archive/` so active grep stays signal-dense (see
[§6](#6-volume-stance)).

**Slug uniqueness is an invariant of the store.** Because the slug *is* the key
([§2.1](#21-frontmatter-required-unless-noted) — there is no separate `id` field) and every
reference is a bare slug (`touches:`, `[link](slug.md)`, the `concepts:` reading list), the
addressing model assumes **one slug → exactly one active page, globally**. A collision is not
cosmetic: it gives `touches:` false blast radius (one `rg` hit serves two meanings), makes one
of the two concepts unaddressable, and — worst — merges two unrelated **append-only Decision
Logs** into one page — damage the immutability rule
([§2.3](#23-append-only--decision-log-semantics-warranted)) then makes durable, since the entries
can no longer be cleanly torn apart. The flat namespace ([above](#5-keying--retrieval)) buys move-stability (re-scope
without breaking links — the edge over path-as-identity) and *owes* this guarantee as its price;
moving hierarchy into a future `domain:`/dotted-slug field would sidestep path-coupling but
**inherit** the same uniqueness constraint.

**Enforced at emission, not by a linter.** The store has a single producer (the distiller, via
the ConceptDelta contract, [§8.2](#82-emission-shape--the-per-concept-conceptdelta)), so
uniqueness is a *write-time precondition*, not a post-hoc scan — consistent with the no-machinery
stance ([§7](#7-index-question--resolved-no-generated-index)). A `create` delta whose `concept:`
collides with an existing **active** slug is malformed; it must resolve one of two ways:

- **Same concept** → the delta is an `update` of the existing page (append a Decision Log entry),
  never a silent overwrite ([§2.3](#23-append-only--decision-log-semantics-warranted)).
- **Different concept** → the new page takes a distinguishing slug (e.g. `session-auth` vs
  `session-therapy`); the colliding name is disambiguated, not clobbered.

Across repos (the shared concept store of [§2.4](#24-provenance-references-single--and-multi-repo)/[§10](#10-out-of-scope-here)),
slugs are unique within the store's single resolution scope — `auth` from two code repos is the
canonical collision, and the multi-repo location decision (§10) must preserve this property.

**Four retrieval paths, all grep/glob/read:**

| Need | Query |
|---|---|
| Known concept → page | `read .nexus/concepts/<slug>.md` |
| Term / synonym → concept | `rg -i '^(title\|aliases):.*<term>' .nexus/concepts/*.md` (and match filenames: `ls .nexus/concepts/ \| rg -i '<term>'`) then read the hit's Summary |
| Blast radius (what touches X) | `rg 'touches:.*\b<X>\b' .nexus/concepts/*.md` |
| Cross-cutting / unknown phrasing | `rg -i '<phrase>' .nexus/concepts/` (full-text) |

**Relevance ranking** (when an artifact references many candidates): rank by name/alias hits
in the input artifact, then `touches:` overlap. This is a grep-count sort, not a model.

**Forward declaration.** A brief/epic/HLD may carry a `concepts:` reading list in its own
frontmatter naming the pages an agent should load — the cheap, authoritative path. Grep is
the fallback when that list is absent or incomplete. (The reading-list field lives on
System-A artifacts, not on concept pages; it is noted here only because it is the primary
retrieval entry point.)

---

## 6. Volume stance

This is the machine surface, so volume is legitimate (0001 Decision 1). It stays retrievable
by construction, not by restraint:

1. **Summary-first schema.** Grep returns a decisive first line; the agent loads a full page
   only on a hit. Adding pages doesn't slow the *decision* to load.
2. **One concept per file, slug = filename.** Every page is glob-addressable; there is no
   monolith to scan and no file that all writers contend on.
3. **400-word body cap + "split, don't grow."** Each retrieval target stays small, so
   loading N pages stays cheap. Growth happens by *adding files*, which is grep-linear and
   merge-conflict-free, not by fattening existing ones.
4. **`_archive/` for deprecated concepts.** Dead concepts leave the active grep space so
   volume of history never dilutes live hits. They remain searchable when explicitly needed.
5. **Decision Log volume is contained.** Logs grow unbounded but live *inside* an
   already-selected page; the cross-page grep targets (filename/`title`/`aliases`/`touches`/
   Summary/Invariants) are not log prose, so log growth doesn't pollute discovery. Entries
   are date+issue headed so an agent skims headers rather than re-reading the whole log.

The failure mode we are designing against is "grep returns 40 pages and the agent can't
tell which 5 matter." Summary-first + per-page cap + archive segregation is what prevents
it.

---

## 7. Index question — resolved: **no generated index**

Two prior generations disagreed. The archived wiki (`wiki-architecture.md` §7.1) generated a
`README.md` contents index, rebuilt by `update-index.ts` on every close. `v2-proposal.md`
dropped it: *"There is no precomputed index file and therefore no merge conflicts on
concurrent workflows."*

**Decision: drop the generated index. Adopt v2's stance.** Reasons:

1. **Conflict magnet.** The concept store is git-tracked and shared across worktree-per-epic
   isolation (0001; the brainstorm valued this). A single regenerated contents file is the
   *one* file every concurrent distill run rewrites — guaranteed merge conflicts on the
   highest-traffic artifact, for no retrieval gain.
2. **Redundant.** Its only job — "list the concepts" — is already served by
   `glob .nexus/concepts/*.md` (the slugs) and `rg '^title:' .nexus/concepts/` (readable
   names), both always-current.
   The index duplicates frontmatter that is already the grep surface.
3. **It's derived state in a non-derived store.** 0001 Decision 3 says the concept store holds
   judgment that *can't* be regenerated. A file that *is* regenerated-on-every-close invites
   the "do not hand-edit, your changes will be overwritten" friction and staleness the rest
   of the design avoids.
4. **It's machinery we were told not to build.** `update-index.ts` is exactly the
   distiller-adjacent build work out of scope here, and re-introduces the over-generation
   pattern (an artifact maintained for its own sake).

**What the index appeared to provide, and its grep replacement:**

| Index job | Replacement (no artifact) |
|---|---|
| "What concepts exist?" | `glob .nexus/concepts/*.md` |
| "What concepts exist (readable)?" | `rg '^title:' .nexus/concepts/*.md` |
| "One-line summary of each" | `glob .nexus/concepts/*.md` + read each Summary line |
| Concept → issue blame | `last_updated_by` frontmatter, per page |

The directory's existing static [`README.md`](../concepts/README.md) stays — but as a
**hand-written usage/rules doc that documents these queries**, not a regenerated table of
contents. The distinction is load-bearing: a rarely-changing usage guide is not a conflict
magnet; a per-close-regenerated contents listing is. Keep the former, reject the latter.

---

## 8. Emission contract

What System A hands System B, in what shape, at which triggers. **Shape and triggers only** —
the distiller that produces this is later build work (0001 Decision 5).

### 8.1 Triggers (when A writes to the concept store)

| Trigger | Cadence | Role |
|---|---|---|
| **Epic close** (`/nxs.close`) | Steady state, per epic | Emits the *why* (human prose) into the queue (0006). The *authoritative write* is the distiller's **distillation-PR merge** ([`0007`](./0007-delta-in-pr-merge-apply.md)), not close itself. The concept store reflects *shipped* truth, so the write lands post-merge — not design-time. |
| **Bootstrap** | One-time, per repo adoption | Seeds the concept store from existing history. Same emission shape, run in bulk. |
| **Manual curation** | Ad hoc | Human-authored page or edit. Same shape; `last_updated_by: "manual"`. |

**Single steady-state write trigger = close.** Design-time concept references
(`/nxs.hld` naming concepts) are *reads*, not writes — the concept store records outcomes, not
intentions. An invariant a design deliberately overturns is recorded when the epic that
overturns it *closes*, not when it is proposed. This keeps writes few and the concept store
free of speculative state.

### 8.2 Emission shape — the per-concept ConceptDelta

At a trigger, the distiller produces a list of deltas, **one per affected concept** (per
[`0006`](./0006-queue-distillation-handoff.md), B infers these post-merge from the diff + queued
artifacts; the ConceptDelta is B's output shape, not an A emission). Per
[`0007`](./0007-delta-in-pr-merge-apply.md), these deltas land in a **reviewed distillation-PR**
against the concept store rather than a direct write to main — same shape, gated apply.

**Stored/serialized form: a markdown page-patch, *not* JSON.** A ConceptDelta is written in
the **same idiom as the page it mutates** ([§2](#2-page-schema)) — YAML frontmatter for the
scalar and slug-list fields, headed markdown sections for the prose fields. This is
deliberate:

- The prose fields (Summary, How It Works, the Decision Log body) are **fragments destined for
  a markdown page.** JSON would force them through an escaping layer (`\n`, `\"`) that the
  consumer immediately unescapes straight back into markdown — pure token cost, and a known
  invalid-output surface for the LLM that authors the delta, for zero gain.
- Frontmatter still carries the genuinely structured fields (the `action` enum, slug lists)
  where a parseable container earns its place.
- Defining the delta in its stored form removes the "is this a struct or JSON?" ambiguity:
  what is shown below is what is written.

The delta carries an explicit `concept:` because, unlike a page, it is **not yet addressed by
filename** — `concept:` tells the applier which file to create/patch. It is the one place the
slug appears as data ([§2.1](#21-frontmatter-required-unless-noted) explains why a *page* has
no slug field; a free-standing delta is the exception that needs it).

**Frontmatter fields** (omit any optional field that is unchanged):

| Field | Required | Maps to / notes |
|---|---|---|
| `concept` | always | page key = target filename |
| `action` | always | `create` \| `update` \| `retire` |
| `source` | always | `"#<issue>"` → `last_updated_by` + Decision Log attribution ([§2.4](#24-provenance-references-single--and-multi-repo)) |
| `date` | always | `YYYY-MM-DD` |
| `title` | create only | → frontmatter `title` + body H1; omit on update when unchanged |
| `touches_added` | optional | list of slugs; omit if none |
| `touches_removed` | optional | list of slugs; omit if none |

**Body sections** (omit the whole section when the field is unchanged — see the omission rule
below):

| Section | Carries | Notes |
|---|---|---|
| `## Summary` | new/changed Summary | prose |
| `## How It Works` | changed behavior | prose |
| `## Invariants Added` | asserted invariants | numbered list, one sentence each |
| `## Invariants Retired` | retired invariants | `- ~~<invariant>~~ — <reason>`; struck through + logged, never deleted |
| `## Decision Log Entry` | the why | **required for every create/update/retire**; `### <short title>` then the body |

**Example** — the `#114` delta that produced the Decision Log entry in the [§3](#3-example-page)
example page (only changed fields appear; Summary, title, and touches are unchanged so they are
omitted):

```markdown
---
concept: org-resolution
action: update
source: "#114"
date: 2026-06-09
---

## How It Works

Resolution now prefers the signed session claim; the host subdomain is used only for the
pre-auth landing case. Downstream code never re-resolves.

## Invariants Retired

- ~~The host subdomain is the authoritative resolution source.~~ — Multi-domain customers
  broke host-based resolution.

## Decision Log Entry

### Session claim becomes authoritative
Multi-domain customers broke host-based resolution. Resolution now prefers the signed session
claim; host is retained only for the pre-auth landing page. The considered alternative —
per-customer host-alias tables keyed on subdomain — was rejected: it kept the leak-prone host
as the source of truth and pushed tenant config into DNS-shaped state.
```

Semantics binding the shape to [§2.3](#23-append-only--decision-log-semantics-warranted):

- **Every non-noop delta carries exactly one `## Decision Log Entry`.** A delta with no
  rationale is malformed — the *why* is the point of the concept store.
- **Omission means *unchanged*, never *clear*.** An absent frontmatter field or body section
  is "no change to this field." There is no empty/clear operation — a retirement is an explicit
  `action: retire` or a struck-through `## Invariants Retired` entry, not an omission.
- **`decision_log_entry.body` — the why *plus the road not taken*.** The body admits the
  genuinely considered alternative and why it lost (not just the chosen why) — that pairing is
  the anti-relitigation payload ([§1](#1-anchor--who-reads-these-pages-and-for-what)).
  **Viability guardrail:** record an alternative *only if it was genuinely
  viable* — one a competent engineer might have chosen, rejected on a real trade-off, never a
  first-glance strawman; if none existed, state only the why. The guardrail is what bounds the
  relaxation so it does not reopen [speculative over-generation](../concepts/speculative-over-generation.md).
  (Per [0006](./0006-queue-distillation-handoff.md), this `decision_log_entry` is the
  *distiller's* output shape; the guardrail therefore binds B's recipe, and the human-side
  source is the decision record's Key Decisions section — 0004 A0/C1.)
- **`retire`** sets `status: deprecated` and moves the page to `_archive/`; it does not
  delete. **`invariants_retired`** strikes through in place; it does not delete.
- A concept touched by an epic with **no behavioral change** produces **no delta** (not an
  empty one) — incidental touches don't write. This keeps the log free of "we looked at this
  and nothing changed" noise.

### 8.3 What the concept store will **not** accept (the hard boundary)

Mirrors 0001 Decision 1 — the two stores never share an artifact. The concept store **rejects**,
and the emission contract must never carry:

- Human-judgment-forcing prose, status, task lists, sprint/iteration framing → these belong
  in `docs/`.
- Code, file paths, type/function names, API/schema specs → regenerable from source.
- Speculative or design-time-only claims not yet shipped.

A pipeline stage emitting any of the above *into the concept store* is a review violation, the
same way a machine artifact in `docs/` is.

---

## 9. Assumptions about System A — reconciliation surface

The sibling pipeline audit is marking cut content "→ relocate to concept store." This schema
defines what the concept store **can** hold; these are the assumptions the audit must reconcile
against. **Surfaced, not blocking** (0001 Decision 5 sequences the audit and this schema as
two halves of one contract):

1. **The distiller produces a structured list of which concepts an epic created / changed /
   retired** — not free prose. Per [0006](./0006-queue-distillation-handoff.md), System A emits
   human prose; B infers the per-concept `ConceptDelta`s
   ([§8.2](#82-emission-shape--the-per-concept-conceptdelta)) post-merge from the diff + queued
   artifacts. "Relocate to concept store" resolves to those deltas, not to a pasted document.
   If content worth keeping can't be attributed to a concept, it isn't concept store material.
2. **For each concept, A can supply a one-line behavioral delta, asserted/retired
   invariants, integration changes, and a one-sentence rationale (the why)** with an issue
   number for provenance. These are the receiving fields; the audit's job is to confirm the
   slimmed close artifact still produces them.
3. **A does *not* feed me a 16-section HLD or a prose PIR.** Those are being cut/slimmed. I
   assume a "key decisions + concepts-touched" record. Concretely, the natural sources are:
   the slimmed HLD's invariants/constraints → **Key Invariants**; the close record's key
   decisions → **Decision Log**; the design's affected-subsystems → **touches / Integration
   Points**. If the audit relocates those specific fragments, they have receiving fields. If
   it tries to relocate *prose narrative*, that's the boundary in [§8.3](#83-what-the-concept-store-will-not-accept-the-hard-boundary) — route to `docs/` or drop.
4. **Bootstrap can derive the same shape in bulk from existing artifacts.** Not designed
   here; flagged so the audit knows the one-time seeding path consumes the identical
   contract.

If any of these assumptions is false after the audit lands, the gap is in the *emission
shape* ([§8.2](#82-emission-shape--the-per-concept-conceptdelta)), and that table is the
thing to amend — the page schema ([§2](#2-page-schema)) is downstream of it and should not
need to move.

---

## 10. Out of scope here

Per 0001 Decision 5 and the bounded-deliverable instruction — **schema + contract only**:

- The distiller agent and its modes; the update/merge/split *mechanism*.
- The bootstrap pipeline.
- Any `update-index.ts`-style tooling (rejected in [§7](#7-index-question--resolved-no-generated-index) regardless).
- Per-page verification/confidence machinery (deferred, [§2.1](#21-frontmatter-required-unless-noted)).
- **Multi-repo concept store topology** — where a shared concept store physically lives across N code
  repos, and whether `touches:` may cross repos. The provenance-reference encoding
  ([§2.4](#24-provenance-references-single--and-multi-repo)) is forward-compatible with it,
  but the location/sharing decision is unmade (it was v2's deferred Phase 4; 0001 did not
  take it on).
- Graphify, embeddings, Serena/MCP, community topology — burned in 0001; not reopened.
```
