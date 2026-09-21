---
name: nxs-distill-taxonomy
description: The domain-registry contract of /nxs.distill. Read it only when that stage's store survey has found a domain registry in the concept store.
---

# nxs-distill-taxonomy

`/nxs.distill` surveys the concept store before it synthesizes anything. This file is what it reads
when that survey finds a domain registry, and nothing else reads it. A store with no registry never
reads it, and behaves exactly as it does today: no `domain` is written for any created concept, the
taxonomy gate never fires, and the drift advisory never runs.

Every rule below is keyed to the base stage's own phase numbering and overrides the base stage at
that number. Phases 6.1 and 6.2 exist only when this contract is read, and the base stage's
phase order and numbering are unchanged, 6.3 included.

Nothing here writes to GitHub, the queue or a branch on its own. Branch creation, the checkpoint
stop and the pull-request opening stay in the base stage.

The Phase 6.1 taxonomy gate follows the base stage's actionable-choice convention: one
`AskUserQuestion` per forced-fit concept, exactly three rendered options, "Other" still available.

## Role — what the registry adds to judgment and to mechanics

Judgment also files each new concept's `domain:` against the registry's rubrics and drafts a new
subdomain/domain when none fits. Mechanics gain the drift advisory (Phase 6.3), which never blocks,
never edits, and always exits zero. It only writes text into the PR body.

## Phase 2 — read the registry

The registry lives beside the atlas at the resolved docs root, filename `domains.md`
(`docs/domains.md` in a single-repo checkout, mirroring exactly how Phase 5.4 resolves the atlas
location):

```bash
cat docs/domains.md
```

Read every domain's and subdomain's title, slug path, and filing rubric. This is the closed list
Phase 3 matches new concepts against, the same role the slug survey plays for slug convergence.

## Phase 3 — delta fields, domain filing and the create-only rule

**Delta frontmatter** gains `domain` (**create only**: the resolving best-fit domain/subdomain path)
and `domain_fit` (**create only**: `clear` or `forced`). **Body sections** gain
`## New Subdomain Draft` (**create + `domain_fit: forced` only**) and `## New Domain Draft`
(**create + `domain_fit: forced` only**).

**Domain filing (epic #94, STORY-94.01): gated on registry presence, judgment against the
rubrics, not a classifier.** For every **create**-action delta, when Phase 2 found a registry:
match the concept's Summary against every domain's and subdomain's filing rubric (the closed
list, exactly the role the Phase 2 slug survey plays for slug convergence) and write the
resolving best-fit as `domain`. **Always resolve to a real, existing path. Never leave a
created page unfiled, never invent an undefined path** (decision-record Invariant 1). Separately
flag the filing:

- **`clear`**: the concept's Summary is plainly within a rubric's stated scope. No draft
  sections; the checkpoint asks nothing for this concept.
- **`forced`**: no rubric's stated scope covers the concept, or covering it needs stretching a
  rubric past its own stated boundary. **When genuinely unsure between clear and forced, choose
  forced**. The epic's success metric requires that a new concept is never silently filed against
  the reviewer's judgment, so ties gate rather than pass silently. A `forced` delta additionally
  drafts exactly two candidates for the Phase 6.1 gate to offer. These are plain values, never a
  literal registry heading (that would collide with this delta's own `## <Section>` boundaries):

  ```
  ## New Subdomain Draft (`domain_fit: forced` only)
  - Parent: `<top-level-domain-slug>` (`<top-level-domain-title>`)
  - Title: <Drafted Subdomain Title>
  - Slug: `<drafted-subdomain-slug>`
  - Rubric: <one-paragraph rubric drafted from the concept, in the registry's own prose style>

  ## New Domain Draft (`domain_fit: forced` only)
  - Title: <Drafted Domain Title>
  - Slug: `<drafted-domain-slug>`
  - Rubric: <one-paragraph rubric drafted from the concept, in the registry's own prose style>
  ```

  The subdomain draft's `Parent` is always the resolved best-fit's **top-level** domain. If the
  best-fit itself is already a subdomain, this drafts a **sibling** subdomain under that same
  parent, never a child of it (the registry caps at domain + subdomain, never a third level).

**`update` and `retire` deltas never carry `domain`, under any circumstance** (decision-record
Invariant 2). An existing page's filing is untouched by any update; re-filing a live page is
manual curation, out of this stage's scope.


- **Domain filing is create-only** (epic #94, STORY-94.01; decision-record Invariant 2): `domain`
  and `domain_fit` appear on a `create` delta only, and only when Phase 2 found a registry. An
  `update` or `retire` delta never adds, changes, or references `domain`. An existing page's
  `domain:` frontmatter line is untouched by any later delta.

## Phase 4 — write the filing onto a created page

A `create` page's frontmatter carries `domain: <delta's domain>` **when the delta carries one**. The
delta's `domain_fit` and any `## New Subdomain Draft` / `## New Domain Draft` sections are **never**
written onto the page. They are working material the Phase 6.1 taxonomy gate consumes, not page
content. An `update` delta carries **never `domain:`**: filing is create-only, so there is nothing
to patch. A `retire` delta carries **never `domain:`**, by the same create-only rule.

A `create` delta synthesized by a Phase 4 split is filed like any other create — `domain` /
`domain_fit` plus drafts when forced, and the Phase 6.1 gate consumes it like any other create.


## Phase 6.1 — Taxonomy gate (forced fits only; epic #94, STORY-94.01)

Collect every `create` delta across every entry in this run whose `domain_fit` is `forced`
(Phase 3). **Zero such deltas → skip 6.1 and 6.2 entirely, proceed straight to 6.3**. A run in
which every new concept resolved to a clear fit never gates (Success Metric: zero gate
interruptions when everything fits).

Otherwise, for each forced-fit concept, in slug order (determinism), render its best-fit path,
its Summary, and both drafts, then ask via **`AskUserQuestion`**, one question per concept, the
same convention as Phase 0.4:

- **"File under `<best-fit path>` (Recommended)"** → no further action; the page already carries
  `domain: <best-fit path>` from Phase 4.
- **"New subdomain under <top-level domain title>: <drafted subdomain title>"** → queue the
  `## New Subdomain Draft` block and this concept's slug for Phase 6.2.
- **"New domain: <drafted domain title>"** → queue the `## New Domain Draft` block and this
  concept's slug for Phase 6.2.

**The drain does not proceed past 6.1 until every forced-fit concept's question is answered**:
no default, no timeout, no silent pass-through (epic #94 AC2; decision-record Invariant 3).

## Phase 6.2 — Apply approved taxonomy changes (only if 6.1 queued any)

For every concept queued in 6.1 with a "new subdomain" or "new domain" answer:

1. Build the real registry heading from the queued draft's Title/Slug/Rubric and append it to the
   registry (`domains.md` at the resolved docs root), matching the registry's exact grammar (§3).
   For a "new subdomain" answer, append a new `###` entry (title, then the backticked slug line,
   then the rubric paragraph) nested directly under the identified `##` domain. For a "new domain"
   answer, append a new top-level `##` entry (same three-line shape).
2. Update that concept's page `domain:` to the new full path (`<top-level-slug>/<new-slug>` for
   a subdomain, `<new-slug>` for a domain).
3. Re-run the Phase 5.4 atlas regeneration and the Phase 5.5 validator over every file this step
   touched (the registry plus every re-filed page). A new registry entry changes the rendered
   hierarchy, so both must run again. **A non-zero exit blocks exactly like Phase 5.5**: fix and
   re-run until both exit 0 (decision-record Invariant 4: the validator passes on this branch
   before the PR opens).
4. Commit **once**, covering every approved change from this step (never amend an entry's Phase 4
   commit): `git add <registry path> <re-filed page paths> <resolved atlas path> && git commit -m
   "distill: taxonomy gate — <n> new domain/subdomain entr(y/ies)"`. This keeps the approved
   registry entry and its motivating page(s) on the same distill branch, in the same
   distillation-PR (decision-record Invariant 4; epic #94 AC3).

## Phase 6.3 — the drift advisory, and the store-level check it adds

**Drift advisory (epic #94, STORY-94.02): deterministic, non-blocking, store-level.** Run the
advisory **once** over the whole store,
now that every entry is applied and any Phase 6.2 taxonomy change has landed (so the branch holds
the final store state the atlas was regenerated from):

```bash
nexus drift-advisory
```

Capture its stdout: advisory markdown, possibly empty. It **never edits a page or the registry and
always exits zero**. A non-zero exit or any file write is a bug, never a block, and nothing it
prints is ever `git add`ed. Record the captured markdown for the digest line below and the Phase 7
PR body.

## Phase 6.3 — the two run-summary values a registry adds


| Field | Holds | Omission and zero case |
|---|---|---|
| `taxonomy` | per forced fit: `<slug>` → best-fit chosen \| new subdomain \| new domain | the line is absent when Phase 6.1 found no forced fits |
| `drift` | the advisory's finding count, `clean`, or `not run — no registry` | advisory only; it never blocks and never gates a surface |

The checkpoint renders them as:

```
Taxonomy gate: <n> forced fit(s) resolved — <slug> → <best-fit chosen | new subdomain "<title>" | new domain "<title>">, ...
Drift advisory: <n finding(s) — misfiles/refinements/candidates, or a staleness alarm | clean — no drift above thresholds | not run — no registry> (advisory only, never blocks)
```

The completion report (Phase 8) renders them as:

```
Taxonomy gate:     <n> forced fit(s) resolved (<n> new subdomain(s), <n> new domain(s), <n> confirmed best-fit)
Drift advisory:    <n finding(s), or "clean", or "not run — no registry"> (advisory only — never blocked this drain)
```

## Phase 7 — the advisory section of the PR body

```markdown
## Taxonomy drift advisory (epic #94, STORY-94.02 — advisory only, never blocks)
<Paste the Phase 6.3 captured advisory markdown verbatim here. If it was empty, write
"Clean — no drift above thresholds.">
```

