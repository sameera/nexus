# Implementation Plan — STORY-94.01: The drain files new concepts under the taxonomy

GitHub issue: **#95**. Epic: #94 (`.nexus/queue/domain-filing-drift-f0249299/epic.md`).
Binding authority: `.nexus/queue/domain-filing-drift-f0249299/decision-record.md`.
Current branch: `epic/domain-filing-drift-story-1` (already checked out; commit directly here).

Executor: follow this plan verbatim. All paths, line anchors, and existing text quoted below are
verified against the repo at the current `main` tip (commit `d1dce3f`). Do **not** explore or
improvise — every fact you need is here. Read the whole plan, including §2, before touching any
file — §2 explains why this story's shape (a prompt edit, not application code) differs from
Story 1/2/3 of the prior epic (#89), which you may have seen as precedent.

---

## 1. Goal

Ship domain filing inside `/nxs.distill`'s synthesis + checkpoint. "Done" == Story 1's four ACs:

- **AC1** — a drain that creates a concept matching an existing filing rubric: the page carries
  that domain and no gate fires.
- **AC2** — a new concept fitting no rubric: at the checkpoint, a gate presents **exactly three**
  options (file under the named best-fit / new subdomain under an existing domain / new domain),
  and the drain does not proceed until one is chosen.
- **AC3** — the reviewer approves a new domain or subdomain: the registry entry and the page that
  motivated it are in the **same** distillation-PR, and the store validator passes on that branch.
- **AC4** — an update delta against an existing page: the page's `domain:` is unchanged.

Registry-presence gating (mirrors the validator's own "activation-on-presence" pattern, §3): with
**no** registry, every rule in this plan is inert — filing writes nothing, the gate never fires.
This repo currently has **no** `docs/domains.md` (verified, §3), so today's real `/nxs.distill`
runs are unaffected until a registry exists (Story 3 of this epic, a separate issue, is the
adoption path — out of scope here, §4).

---

## 2. Judgment calls already made — do not re-decide

### 2.0 — This story's entire deliverable is a prompt edit, not application source (read this first)

The decision record is explicit: **"Filing is a synthesis judgment against the rubrics, not a
separate deterministic classifier"** — the model decides domain fit during synthesis, the same
way it already decides update-vs-distinguish on a slug collision. That judgment, and the
graded-gate behavior AC2 describes, live entirely inside **`.claude/commands/nxs.distill.md`**
(the `/nxs.distill` prompt) — a markdown document a coding agent reads and follows at drain time,
not compiled/interpreted code. Verified by exploration:

- No file anywhere in the repo (`grep -rln "AskUserQuestion" --include="*.ts" .`) implements the
  gate mechanism in code — it is entirely the `AskUserQuestion` tool call the prompt instructs
  the agent to make.
- No test anywhere reads the semantic content of a `.claude/commands/*.md` file. The three specs
  that touch command files (`vendor-components.spec.ts`, `deploy-components.spec.ts`,
  `nexus-cli.spec.ts`) only exercise the generic copy/hash **mechanism** against synthetic
  fixture content (`"epic command\n"`), never the real prompt text.
- **Direct precedent**: commit `59dad02` ("feat: adds distiller merge precondition") added an
  entire new interactive gate (Phase 0.4) to this exact file and changed **two** files total:
  `.claude/commands/nxs.distill.md` and `libs/portable-tools/bundle-fingerprint.json` (the
  re-vendor pin). No spec file was added or touched.
- The registry parser (`domain-registry.ts`) and the validator's `domain:` check
  (`validate-concepts.ts`) — the only code this story could plausibly touch — were **already
  fully built** by the prior epic (#89, commits `f448932`/`483181e`/`0c47776`) and require **zero**
  changes: the validator already blocks any active page whose `domain:` doesn't resolve, gated on
  registry presence, which is exactly what AC3 needs.

**Consequence for CLAUDE.md's TFD / 95%-coverage mandate**: that mandate targets *application
source*. This story adds none. Do not invent a TypeScript module, a classifier, or a "prompt
conformance" spec file to manufacture something to unit-test — that would be speculative
machinery with no precedent and no retrieval need (the CLAUDE.md over-generation razor). §5
substitutes traced acceptance scenarios (read the edited prompt text and confirm the trace holds)
for vitest specs, and the one automated gate this story *does* interact with — the
component-fingerprint parity check — is still mandatory (§6, §7).

### 2.1 — Registry location and activation

The registry (`domains.md`) lives beside the atlas at the resolved docs root — `docs/domains.md`
in this single-repo checkout, exactly the location `validate-concepts.ts`'s `registryPath()` and
`generate-atlas.ts`'s `registryPath()` already resolve (§3). Filing (domain computation +
gate) is gated on that file's presence, checked once at Phase 2 (survey). No registry → Phase 3
writes no `domain`/`domain_fit`, Phase 6's taxonomy gate never fires — byte-identical to today.

### 2.2 — Fit classification: tie goes to "forced"

`clear` vs `forced` is the model's semantic judgment against rubric prose (decision record: "a
just-born concept has no stable link history to classify on" — no deterministic threshold
exists). When genuinely unsure, **classify as `forced`, never `clear`** — required by the epic's
own Success Metric: "a new concept is never silently filed against the reviewer's judgment." Ties
gate; they never pass silently.

### 2.3 — Drafts are pre-computed at synthesis, never authored at the gate

Decision record: "the gate itself needs only the reviewer's choice, not free-text input." So for
every `forced`-fit concept, Phase 3 (not Phase 6) drafts **both** candidate registry entries — a
new subdomain nested under the best-fit's top-level domain, and a wholly new top-level domain —
as plain `Title` / `Slug` / `Rubric` values inside the delta (§6 Edit 4a). Phase 6.2 is the only
place that assembles them into the registry's actual heading grammar; the delta never embeds a
literal `##`/`###` heading (that would collide with the delta's own `## <Section>` boundary
convention, since deltas are read by section markers, not parsed by a real parser).

### 2.4 — New-subdomain option always nests one level, under the best-fit's own top-level domain

`domain-registry.ts` caps the taxonomy at domain + subdomain (a third level is a structural
finding). So "new subdomain" always nests under the resolved best-fit's **top-level** domain —
if the best-fit itself already resolved to a subdomain (e.g. `connectors/catalog`), the drafted
subdomain becomes a **sibling** under that same parent (`connectors`), never a child of
`connectors/catalog`.

### 2.5 — One extra commit per run for every approved gate resolution, never an amend

Approved subdomain/domain writes land in **exactly one** additional commit per drain run — after
every forced-fit concept's question in Phase 6.1 is answered — covering every approved registry
entry and every re-filed page from this run. This never amends an entry's own Phase 4 commit
(keeps that commit's "one queue entry, one commit" property intact) and keeps the registry
write + re-validation atomic and easy to reason about, satisfying AC3's "same distillation-PR."

### 2.6 — The command's frontmatter `description:` stays untouched

The `description:` field (line 3) is surfaced verbatim as the `/nxs.distill` skill's one-line
summary. Precedent: epic #54 added an entire hub-mode capability to this file without touching
this line. Story 1 follows the same restraint — don't touch it.

### 2.7 — `domain_fit` and the drafts are delta-only; never written to the page

Only `domain:` is a real page frontmatter field (already validated by `validate-concepts.ts`).
`domain_fit`, `## New Subdomain Draft`, and `## New Domain Draft` are working material Phase 6.1
consumes and Phase 4 must **never** copy onto the actual concept page.

---

## 3. Ground truth (verified paths, line anchors, existing behavior)

### The one file this story edits
**`.claude/commands/nxs.distill.md`** (598 lines at HEAD `d1dce3f`) — the `/nxs.distill` prompt.
Frontmatter: `tools: Read, Grep, Glob, Write, Edit, Bash, AskUserQuestion` (unchanged; every tool
this story needs is already listed).

### Files this story does NOT touch (already correct, built by epic #89)
- `libs/portable-tools/src/domain-registry.ts` — registry parser. `parseDomainRegistry(content)`
  (line 74) returns `{ domains: DomainNode[], findings: string[] }`; a `DomainNode` is
  `{ title, slug, path, rubric, subdomains }` (lines 14-20). Grammar: an `##` (H2) heading is a
  domain, `###` (H3) a subdomain; the body's first non-blank line, if a lone backticked token
  matching kebab-case, is the slug; everything after is the rubric (joined, whitespace-collapsed).
  A subdomain's `.path` is `<parent-leaf>/<own-leaf>`. A heading at H4+ is a structural finding
  ("nests a third level — the taxonomy caps at domain plus subdomain").
- `libs/portable-tools/src/validate-concepts.ts` — already validates, when a registry is present
  (`hasRegistry = fs.existsSync(regPath)`, line 562), that every active page's `domain:` resolves
  to a defined domain-or-subdomain path (lines 370-377), and is silent when no registry exists.
  This is the whole of AC3's "the store validator passes" requirement — nothing to add.
- `libs/portable-tools/src/generate-atlas.ts` — already renders the curated hierarchy when a
  registry exists (`renderRegistryAtlas`, line 321) and falls back to the untouched
  connected-components clustering otherwise. Nothing to add.
- Both resolve the registry path identically: `registryPath()` = `path.join(localDocsRoot(cwd).ok
  ? localDocsRoot(cwd).docsRoot : "docs", "domains.md")` — `docs/domains.md` in this single-repo
  checkout (no `.nexus/config/workspace.yml`/`hub.yml` present — verified, this repo is
  single-repo mode).

### Current repo state (verified)
- `docs/domains.md` does **not** exist anywhere in the repo. `.nexus/concepts/*.md` has 34 active
  pages, none carrying a `domain:` field (registry never existed). Today's `/nxs.distill` run is
  therefore byte-for-byte unaffected by this story until a registry is authored.
- `npx nx test @nexus/portable-tools` baseline: **295 tests passed, 16 test files**, all green
  (run at plan time). This story touches zero files under `libs/portable-tools/src/`, so this
  number must be **unchanged** after the edit (§7).
- `package.json` scripts (unchanged, needed for §7): `"nexus:vendor-tools": "tsx
  libs/portable-tools/src/vendor-bundle.ts"`.
- Component-fingerprint mechanism (why the re-vendor is mandatory here): `vendor-components.ts`'s
  `hashComponentTree(claudeDir)` hashes every file under `.claude/{commands,agents,skills}/` (the
  managed subtrees, `COMPONENT_SUBTREES`) into a single `"claude-components"` entry in
  `libs/portable-tools/bundle-fingerprint.json`. `parity.spec.ts`'s "fingerprint pin" test
  recomputes this hash fresh and fails if it disagrees with the committed pin — editing
  `nxs.distill.md` **will** make this test fail until you re-vendor (§6 Step 13, §7). This is the
  **opposite** of "this story likely doesn't touch `.claude/**`" — it is entirely inside
  `.claude/**`.

### The registry's own markdown grammar (for drafting; example from `domain-registry.spec.ts`)
```
## Connectors
`connectors`

Everything about pulling data in from and pushing it out to external systems.

### Catalog
`catalog`

The registry of available connector types and their published metadata.
```
An H2 title line, then a lone backticked kebab-case slug line, then a rubric paragraph. A
subdomain (H3) nests directly under its domain (H2) with the identical shape.

### The existing `AskUserQuestion` convention to mirror (Phase 0.4, lines 125-133, verbatim)
```
      Render a one-paragraph markdown note naming the not-merged entry (or entries) and both
      consequences, then ask via **`AskUserQuestion`** — never proceed silently:
        - **"Merge the feature PR first, then re-run (Recommended)"** → stop. Tell the user to merge
          the entry's feature PR to the trunk (and `git fetch` first if it merged remotely but the
          local `origin/main` is stale), then re-run `/nxs.distill`.
        - **"Proceed on the current branch"** → continue with a recorded waiver. ...
```
Bolded quoted option label, then `→`, then the action taken. §6's new options copy this shape.

### The file's own "Phase N.M" citation convention (already established, not invented here)
Phase 5's steps are numbered plainly (`1.` reciprocity, `2.` anchors, `3.` select invocation,
`4.` atlas regeneration, `5.` validator, `6.` remove+commit) but are already cited elsewhere in
the file as `Phase 5.2`, `Phase 5.3`, `Phase 5.3–5.5` (e.g. line 79, line 89). So "Phase 5.4" =
atlas regeneration, "Phase 5.5" = validator — used that way below without inventing a new
convention.

### Provenance / decision-record clause numbers this plan cites
- Decision-record **Invariant 1**: synthesis always writes a resolving `domain:`, never leaves a
  page unfiled, never writes an undefined domain.
- **Invariant 2**: only `create` writes `domain:`; `update`/`retire` never touch it.
- **Invariant 3**: the gate blocks until resolved for every forced fit, never fires for a clear one.
- **Invariant 4**: an approved new domain/subdomain rides the same branch as its motivating page;
  the validator passes on that branch before the PR opens.

---

## 4. Out of scope (do not touch)

- **Story 2 (issue #96) — the drift advisory.** No cross-domain-misfile detection, no
  refinement hints, no staleness alarm, no new PR-body "Drift" section. That is a *separate*,
  non-blocking, deterministic step this story's decision record explicitly keeps apart ("The
  advisory is a non-blocking text producer; the gate is the only blocking taxonomy decision").
- **Story 3 (issue #97) — seed mode.** No registry-drafting-for-an-existing-store tool, no
  community-detection engine. Today's absent `docs/domains.md` stays absent; this story never
  creates one.
- **`libs/portable-tools/src/domain-registry.ts`, `validate-concepts.ts`, `generate-atlas.ts`** —
  already correct (§3). Do not edit any of them.
- **The shared clustering/community-detection engine** the decision record describes for Stories
  2/3 — does not exist yet and this story does not create it.
- **Hub-mode rigor beyond consistent wording.** This repo runs single-repo mode and none of
  Story 1's four ACs mention a hub. Where this plan's prose says "the resolved docs root," that
  is enough; do not add hub-specific branching to the prompt text for this story.
- **The command's `description:` frontmatter** (§2.6) and any other Phase not named in §6.
- **Migrating or authoring a real `docs/domains.md` for this repo.** Out of scope; that is Story
  3's (seed mode) or a human's job.

---

## 5. Tests first — traced acceptance scenarios (TFD, adapted to a prompt artifact)

Per §2.0, there is no vitest target for this story. Each scenario below is RED before you touch
the file (the cited behavior doesn't exist in the current text — trivially confirmable, quoted
in §3) and must be GREEN after §6's edits (confirmable by re-reading the edited phase text and
checking every "Assert" line holds). Do this trace both before and after editing.

**T1 — AC1: clear fit, no gate.** Given a registry exists with a domain `connectors` whose rubric
plainly covers "how connector plugins are configured," and a `create` delta for a new concept
about exactly that. RED: today's Phase 3 has no domain matching at all. GREEN, trace the edited
text: Phase 3 resolves `domain: connectors`, `domain_fit: clear`, no draft sections (§6 Edit 4a).
Phase 4 writes `domain: connectors` onto the page (§6 Edit 5). Phase 6.1 finds **zero** forced-fit
concepts for this run → skips 6.1 and 6.2 entirely, proceeds straight to 6.3 (§6 Edit 6). Assert:
the edited Phase 6.1 text contains an explicit "zero such deltas → skip" instruction, and no
`AskUserQuestion` for taxonomy fires anywhere in the trace.

**T2 — AC2: forced fit, exactly three options, blocks.** Given the same registry, and a `create`
delta for a concept that plainly fits no rubric (e.g. "video transcoding pipelines"). RED: no
such gate exists today. GREEN: Phase 3 still resolves *some* existing path (the least-bad
top-level domain — Invariant 1, "never leave unfiled"), sets `domain_fit: forced`, and drafts a
`## New Subdomain Draft` and a `## New Domain Draft` (§6 Edit 4a). Phase 4 writes that forced
`domain:` onto the page anyway (§6 Edit 5 — the resolving value is written regardless of fit).
Phase 6.1 renders exactly one `AskUserQuestion` for this concept with **exactly three** bolded
options — "File under `<best-fit>` (Recommended)", "New subdomain under `<...>`: `<...>`", "New
domain: `<...>`" — and states the drain does not proceed past 6.1 until answered (§6 Edit 6).
Assert: count the bolded option bullets in the edited 6.1 text — must be exactly 3, and the text
contains "does not proceed past 6.1 until every forced-fit concept's question is answered."

**T3 — AC3: approved new domain rides the same PR, validator passes.** Continue T2; reviewer
picks "New domain: `<drafted title>`". RED: no such apply step exists today. GREEN: Phase 6.2
(§6 Edit 6) appends a new `##` entry built from the queued Title/Slug/Rubric to the registry,
updates the page's `domain:` to the drafted slug, **re-invokes Phase 5.4 (atlas) and Phase 5.5
(validator)** over the touched registry + page(s), and states a finding blocks exactly like
Phase 5.5 (fix and re-run) before a single commit lands — all before Phase 7 pushes/opens the PR.
Assert: the edited 6.2 text names the Phase 5.4/5.5 commands explicitly (not just "validate
somehow"), states the commit happens once per run on the same distill branch, and is placed
before Phase 6.3's final ask (which itself precedes Phase 7).

**T4 — AC4: update delta, domain unchanged.** Given an existing page already carrying
`domain: sources`, and an `update` delta against it (unrelated section change). RED: today's
Phase 3/4 don't mention `domain` at all, so this is vacuously true today but for the wrong
reason (the field doesn't exist yet in the story's own vocabulary). GREEN: Phase 3's binding
rules explicitly forbid `update`/`retire` from ever carrying `domain` (§6 Edit 4b), and Phase 4's
`update` bullet explicitly states "Never `domain:`" (§6 Edit 5). Assert: grep the edited file for
the literal string `Never \`domain:\`` under both the `update` and `retire` bullets, and confirm
the Phase 3 binding-rules bullet cites Invariant 2. Because no delta ever carries the field for an
`update`, the page's existing `domain: sources` line is never part of the patch — unchanged.

**T5 — Regression: no registry (today's real state).** Given `docs/domains.md` absent (verified,
§3). GREEN: Phase 2's new registry-survey block (§6 Edit 3) finds nothing and states "filing is
inert for this drain." Assert: Phase 3/4/6.1 text all explicitly gate on "Phase 2 found a
registry" / "no registry" language, so a drain on this actual repo, today, produces the exact
same pages (no `domain:` field, no gate) as before this story's edits.

**T6 — Internal consistency: the gate follows the file's own convention.** Assert the new
Phase 6.1 `AskUserQuestion` block uses the identical bolded-quote-then-arrow rendering already
used at Phase 0.4 (§3, quoted verbatim) — no free-text default, no numbered list outside
`AskUserQuestion`, "Other" still implicitly available per the file's existing Interaction
Convention section (§6 Edit 2).

---

## 6. Steps

All edits are Find → Replace against `.claude/commands/nxs.distill.md`. Apply in order; each
`Find` block is quoted **exactly** from the file at HEAD `d1dce3f` — if a `Find` doesn't match
byte-for-byte, stop and re-read the live file rather than guessing.

### Step 1 — confirm §5's RED state
Open `.claude/commands/nxs.distill.md` and confirm none of Phase 2/3/4/6 currently mention
`domain`, `domain_fit`, or a taxonomy gate (they don't — this is the starting state). This is
your TFD "failing test" checkpoint before editing.

### Step 2 — Edit 1 (Role section — Judgment bullet)

Find:
```
- **Judgment (yours):** mapping the diff + records to per-concept `ConceptDelta`s, writing the
  page prose, deciding update-vs-distinguish on a slug collision.
```

Replace:
```
- **Judgment (yours):** mapping the diff + records to per-concept `ConceptDelta`s, writing the
  page prose, deciding update-vs-distinguish on a slug collision, and — when a domain registry
  exists (epic #94, STORY-94.01) — filing each new concept's `domain:` against the registry's
  rubrics and drafting a new subdomain/domain when none fits.
```

### Step 3 — Edit 2 (Interaction convention section)

Find:
```
# Interaction convention — actionable choice gate

The pre-PR checkpoint (Phase 6) is presented through the **`AskUserQuestion`** tool, not a
free-text prompt. Render the delta digest first as ordinary markdown, then call `AskUserQuestion`
with one option per choice. The user can always pick "Other" for a custom answer.
```

Replace:
```
# Interaction convention — actionable choice gate

The pre-PR checkpoint (Phase 6) is presented through the **`AskUserQuestion`** tool, not a
free-text prompt. Render the delta digest first as ordinary markdown, then call `AskUserQuestion`
with one option per choice. The user can always pick "Other" for a custom answer. The Phase 6.1
taxonomy gate (epic #94, STORY-94.01) follows the identical convention — one `AskUserQuestion`
per forced-fit concept, exactly three rendered options, "Other" still available.
```

### Step 4 — Edit 3 (Phase 2 — Survey the concept store)

> The quoted text below contains its own ` ```bash ` fence, so the outer Find/Replace wrapper
> uses **4** backticks (` ```` `) — don't collapse it to 3, or the outer block will terminate
> early at the inner fence.

Find:
````
# Phase 2 — Survey the concept store

Before synthesizing, know what exists (0003 §5 retrieval — glob/rg is *your* index; the
generated atlas (at the resolved docs root — `docs/concepts.md` in a single-repo checkout) is a
derived human-orientation page, not a retrieval surface — never consult or hand-edit it):

```bash
ls .nexus/concepts/*.md .nexus/concepts/_archive/*.md 2>/dev/null
rg '^(title|aliases|touches):' .nexus/concepts/ 2>/dev/null
```

Read the Summary of every plausible-neighbor page (name/alias hits against the epic's terms,
then `touches:` overlap). If `.nexus/concepts/` does not exist yet, create the directory — this
is the first drain.
````

Replace:
````
# Phase 2 — Survey the concept store

Before synthesizing, know what exists (0003 §5 retrieval — glob/rg is *your* index; the
generated atlas (at the resolved docs root — `docs/concepts.md` in a single-repo checkout) is a
derived human-orientation page, not a retrieval surface — never consult or hand-edit it):

```bash
ls .nexus/concepts/*.md .nexus/concepts/_archive/*.md 2>/dev/null
rg '^(title|aliases|touches):' .nexus/concepts/ 2>/dev/null
```

Read the Summary of every plausible-neighbor page (name/alias hits against the epic's terms,
then `touches:` overlap). If `.nexus/concepts/` does not exist yet, create the directory — this
is the first drain.

**Domain registry (epic #94, STORY-94.01) — gated on presence.** The registry lives beside the
atlas at the resolved docs root, filename `domains.md` (`docs/domains.md` in a single-repo
checkout, mirroring exactly how Phase 5.4 resolves the atlas location):

```bash
ls docs/domains.md 2>/dev/null && cat docs/domains.md
```

If present, read every domain's and subdomain's title, slug path, and filing rubric — this is
the closed list Phase 3 matches new concepts against, the same role the survey above plays for
slug convergence. **If absent, domain filing is inert for this drain**: Phase 3 writes no
`domain` for any created concept and the Phase 6 taxonomy gate never fires — exactly today's
behavior, unchanged (adopting a registry onto an existing store is Story 3's seed mode, a
separate epic).
````

### Step 5 — Edit 4a (Phase 3 — Delta frontmatter + new Domain filing paragraph)

> The replacement below contains its own nested fence (the draft-block example), so its
> Find/Replace wrapper uses **4** backticks for this one.

Find:
````
**Delta frontmatter:** `concept` (target slug), `action` (`create | update | retire`), `source`
(the Phase 0 provenance ref), `date` (today), `title` (create only), `touches_added` /
`touches_removed` (omit if none). **Body sections** (omit any unchanged one — omission means
*unchanged*, never *clear*): `## Summary`, `## How It Works`, `## Invariants Added`,
`## Invariants Retired`, `## Decision Log Entry`.
````

Replace:
````
**Delta frontmatter:** `concept` (target slug), `action` (`create | update | retire`), `source`
(the Phase 0 provenance ref), `date` (today), `title` (create only), `touches_added` /
`touches_removed` (omit if none), `domain` (**create only**, and only when a registry exists —
epic #94, STORY-94.01: the resolving best-fit domain/subdomain path), `domain_fit` (**create
only**, only when a registry exists: `clear` or `forced`). **Body sections** (omit any unchanged
one — omission means *unchanged*, never *clear*): `## Summary`, `## How It Works`,
`## Invariants Added`, `## Invariants Retired`, `## Decision Log Entry`, `## New Subdomain Draft`
(**create + `domain_fit: forced` only**), `## New Domain Draft` (**create + `domain_fit: forced`
only**).

**Domain filing (epic #94, STORY-94.01) — gated on registry presence, judgment against the
rubrics, not a classifier.** For every **create**-action delta, when Phase 2 found a registry:
match the concept's Summary against every domain's and subdomain's filing rubric (the closed
list — exactly the role the Phase 2 slug survey plays for slug convergence) and write the
resolving best-fit as `domain`. **Always resolve to a real, existing path — never leave a
created page unfiled, never invent an undefined path** (decision-record Invariant 1). Separately
flag the filing:

- **`clear`** — the concept's Summary is plainly within a rubric's stated scope. No draft
  sections; the checkpoint asks nothing for this concept.
- **`forced`** — no rubric's stated scope covers the concept, or covering it needs stretching a
  rubric past its own stated boundary. **When genuinely unsure between clear and forced, choose
  forced** — the epic's success metric requires a new concept is never silently filed against
  the reviewer's judgment, so ties gate rather than pass silently. A `forced` delta additionally
  drafts exactly two candidates for the Phase 6.1 gate to offer — plain values, never a literal
  registry heading (that would collide with this delta's own `## <Section>` boundaries):

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

  The subdomain draft's `Parent` is always the resolved best-fit's **top-level** domain — if the
  best-fit itself is already a subdomain, this drafts a **sibling** subdomain under that same
  parent, never a child of it (the registry caps at domain + subdomain, never a third level).

No registry (Phase 2 found none) → omit `domain`, `domain_fit`, and both draft sections entirely;
filing is inert this drain (Phase 6's taxonomy gate never fires — Success Metric: zero gate
interruptions when every concept fits).

**`update` and `retire` deltas never carry `domain`, under any circumstance** (decision-record
Invariant 2 — an existing page's filing is untouched by any update; re-filing a live page is
manual curation, out of this drain's scope).
````

### Step 6 — Edit 4b (Phase 3 — Binding rules, new bullet)

Find:
```
- **Provenance** — per the Phase 0.6 resolution, everywhere a reference is written: in hub mode
  always the qualified `<owner>/<repo>#n` form (the terse `#n` never appears in a workspace
  drain's output); in single-repo mode `#n` for the home repo, qualified cross-repo.
```

Replace:
```
- **Provenance** — per the Phase 0.6 resolution, everywhere a reference is written: in hub mode
  always the qualified `<owner>/<repo>#n` form (the terse `#n` never appears in a workspace
  drain's output); in single-repo mode `#n` for the home repo, qualified cross-repo.
- **Domain filing is create-only** (epic #94, STORY-94.01; decision-record Invariant 2): `domain`
  and `domain_fit` appear on a `create` delta only, and only when Phase 2 found a registry. An
  `update` or `retire` delta never adds, changes, or references `domain` — an existing page's
  `domain:` frontmatter line is untouched by any later delta.
```

### Step 7 — Edit 5 (Phase 4 — Applying a delta: `create` and `update` bullets)

Find:
```
3. **Applying a delta** (0003 §2, §8.2 semantics):
    - `create` → write the full page: frontmatter (`title`, `aliases`, `touches`,
      `last_updated_by: <source>`, `status: active`, `verification:` per below), H1 mirroring
      `title`, Summary lead (≤3 sentences, written to stand alone as a grep hit), `## How It
      Works` (≤180 words), `## Key Invariants` (≤7, numbered), `## Integration Points` (one
      bullet per `touches` slug: `- [slug](slug.md) — <nature of the interaction>`), and a
      `## Decision Log` seeded with exactly the delta's entry.
    - `update` → patch only the sections the delta carries; update `last_updated_by`; **append
      exactly one** Decision Log entry — never edit, reorder, or delete prior entries. A retired
      invariant is **struck through in place** (`~~...~~`), never deleted.
    - `retire` → set `status: deprecated`, append the Decision Log entry, `git mv` the page to
      `.nexus/concepts/_archive/`.
```

Replace:
```
3. **Applying a delta** (0003 §2, §8.2 semantics):
    - `create` → write the full page: frontmatter (`title`, `aliases`, `touches`,
      `last_updated_by: <source>`, `status: active`, `verification:` per below, plus `domain:
      <delta's domain>` **when the delta carries one** — epic #94, STORY-94.01; omit the field
      entirely when Phase 2 found no registry), H1 mirroring `title`, Summary lead (≤3 sentences,
      written to stand alone as a grep hit), `## How It Works` (≤180 words), `## Key Invariants`
      (≤7, numbered), `## Integration Points` (one bullet per `touches` slug: `- [slug](slug.md)
      — <nature of the interaction>`), and a `## Decision Log` seeded with exactly the delta's
      entry. The delta's `domain_fit` and any `## New Subdomain Draft` / `## New Domain Draft`
      sections are **never** written onto the page — they are working material the Phase 6.1
      taxonomy gate consumes, not page content.
    - `update` → patch only the sections the delta carries; update `last_updated_by`; **append
      exactly one** Decision Log entry — never edit, reorder, or delete prior entries. A retired
      invariant is **struck through in place** (`~~...~~`), never deleted. **Never `domain:`** —
      filing is create-only (epic #94 Invariant 2); an update delta never carries the field, so
      there is nothing to patch.
    - `retire` → set `status: deprecated`, append the Decision Log entry, `git mv` the page to
      `.nexus/concepts/_archive/`. **Never `domain:`** — same create-only rule.
```

### Step 8 — Edit 6 (Phase 6 — restructure into 6.1 / 6.2 / 6.3)

> Both blocks below contain a nested bare fence (the `CHECKPOINT:` digest template), so both
> Find and Replace use **4** backticks here.

Find:
````
# Phase 6 — Checkpoint (before any GitHub write)

**STOP AND WAIT.** Render the delta digest as markdown first:

```
CHECKPOINT: Distillation-PR

Drained entries:
- <local-id> — <epic title> (<provenance ref>)

Concept deltas:
- <slug> — <create|update|retire> — <sections changed> — log: "<entry title>"
  ↳ reciprocity fan-out: <slugs, or none>

Anchors refreshed: <slugs>
Atlas: regenerated (<resolved-atlas-path>)
Validator: PASS (<N> page(s))

Skipped (not closed): <local-id> — repo <owner/repo, hub mode only> — age <n>d [DRAIN-SLO BREACH if >30d]
Blocked (hub mode — diff underivable): <local-id> — repo <owner/repo> — age <n>d — <problem> [DRAIN-SLO BREACH if >30d]
(if nothing was skipped or blocked: "Skipped: none — every queue entry drained; no drain-SLO breaches")

Not-merged (Phase 0.4 waiver): <local-id> — PR based on the current HEAD; merging it lands the
  unmerged feature commits AND this distillation together (omit this line when every drained entry
  was on the trunk)

About to: push the distill branch and open the distillation-PR.
Consumed entries are removed on the branch (in each entry's commit) — the deletion lands on main
only when the PR merges, atomically with the pages. Nothing is removed from main now.
```

Then ask via **`AskUserQuestion`**:

- **open PR** — proceed to Phase 7.
- **review** — print each delta (stored form) and each resulting page, then re-ask.
- **abort** — stop. Return to the original branch (`git checkout -`); leave the distill branch
  for inspection, and report that no PR was opened and no queue entry was touched.
````

Replace:
````
# Phase 6 — Checkpoint (before any GitHub write)

## Phase 6.1 — Taxonomy gate (forced fits only; epic #94, STORY-94.01)

Collect every `create` delta across every entry in this run whose `domain_fit` is `forced`
(Phase 3). **Zero such deltas → skip 6.1 and 6.2 entirely, proceed straight to 6.3** — a run in
which every new concept resolved to a clear fit never gates (Success Metric: zero gate
interruptions when everything fits).

Otherwise, for each forced-fit concept, in slug order (determinism), render its best-fit path,
its Summary, and both drafts, then ask via **`AskUserQuestion`** — one question per concept, the
same convention as Phase 0.4:

- **"File under `<best-fit path>` (Recommended)"** → no further action; the page already carries
  `domain: <best-fit path>` from Phase 4.
- **"New subdomain under <top-level domain title>: <drafted subdomain title>"** → queue the
  `## New Subdomain Draft` block and this concept's slug for Phase 6.2.
- **"New domain: <drafted domain title>"** → queue the `## New Domain Draft` block and this
  concept's slug for Phase 6.2.

**The drain does not proceed past 6.1 until every forced-fit concept's question is answered** —
no default, no timeout, no silent pass-through (epic #94 AC2; decision-record Invariant 3).

## Phase 6.2 — Apply approved taxonomy changes (only if 6.1 queued any)

For every concept queued in 6.1 with a "new subdomain" or "new domain" answer:

1. Build the real registry heading from the queued draft's Title/Slug/Rubric and append it —
   a new `###` entry (title, then the backticked slug line, then the rubric paragraph) nested
   directly under the identified `##` domain, for a "new subdomain" answer; a new top-level `##`
   entry (same three-line shape) for a "new domain" answer — to the registry (`domains.md` at
   the resolved docs root), matching the registry's exact grammar (§3).
2. Update that concept's page `domain:` to the new full path (`<top-level-slug>/<new-slug>` for
   a subdomain, `<new-slug>` for a domain).
3. Re-run the Phase 5.4 atlas regeneration and the Phase 5.5 validator over every file this step
   touched (the registry plus every re-filed page) — a new registry entry changes the rendered
   hierarchy, so both must run again. **A finding blocks exactly like Phase 5.5** — fix and
   re-run until both exit 0 (decision-record Invariant 4: the validator passes on this branch
   before the PR opens).
4. Commit **once**, covering every approved change from this step (never amend an entry's Phase 4
   commit): `git add <registry path> <re-filed page paths> <resolved atlas path> && git commit -m
   "distill: taxonomy gate — <n> new domain/subdomain entr(y/ies)"`. This keeps the approved
   registry entry and its motivating page(s) on the same distill branch, in the same
   distillation-PR (decision-record Invariant 4; epic #94 AC3).

## Phase 6.3 — Final checkpoint

**STOP AND WAIT.** Render the delta digest as markdown first:

```
CHECKPOINT: Distillation-PR

Drained entries:
- <local-id> — <epic title> (<provenance ref>)

Concept deltas:
- <slug> — <create|update|retire> — <sections changed> — log: "<entry title>"
  ↳ reciprocity fan-out: <slugs, or none>

Taxonomy gate: <n> forced fit(s) resolved — <slug> → <best-fit chosen | new subdomain "<title>" | new domain "<title>">, ...
  (omit this line entirely when Phase 6.1 found no forced fits — "no gate fired")

Anchors refreshed: <slugs>
Atlas: regenerated (<resolved-atlas-path>)
Validator: PASS (<N> page(s))

Skipped (not closed): <local-id> — repo <owner/repo, hub mode only> — age <n>d [DRAIN-SLO BREACH if >30d]
Blocked (hub mode — diff underivable): <local-id> — repo <owner/repo> — age <n>d — <problem> [DRAIN-SLO BREACH if >30d]
(if nothing was skipped or blocked: "Skipped: none — every queue entry drained; no drain-SLO breaches")

Not-merged (Phase 0.4 waiver): <local-id> — PR based on the current HEAD; merging it lands the
  unmerged feature commits AND this distillation together (omit this line when every drained entry
  was on the trunk)

About to: push the distill branch and open the distillation-PR.
Consumed entries are removed on the branch (in each entry's commit) — the deletion lands on main
only when the PR merges, atomically with the pages. Nothing is removed from main now.
```

Then ask via **`AskUserQuestion`**:

- **open PR** — proceed to Phase 7.
- **review** — print each delta (stored form) and each resulting page, then re-ask.
- **abort** — stop. Return to the original branch (`git checkout -`); leave the distill branch
  for inspection, and report that no PR was opened and no queue entry was touched.
````

### Step 9 — Edit 7 (Phase 8 — Report completion, one new line)

Find:
```
Pages retired:     <n>  (<slugs>)
Reciprocal edits:  <n>  (<slugs>)
```

Replace:
```
Pages retired:     <n>  (<slugs>)
Taxonomy gate:     <n> forced fit(s) resolved (<n> new subdomain(s), <n> new domain(s), <n> confirmed best-fit) — omit this line when Phase 6.1 found no forced fits (epic #94, STORY-94.01)
Reciprocal edits:  <n>  (<slugs>)
```

### Step 10 — Edit 8 (Constraints section, one new bullet)

Find:
```
- **Every changed page gains exactly one Decision Log entry per queue entry**; prior entries are
  never edited, reordered, or deleted.
```

Replace:
```
- **Every changed page gains exactly one Decision Log entry per queue entry**; prior entries are
  never edited, reordered, or deleted.
- **Domain filing (epic #94, STORY-94.01) is gated on registry presence.** A registry present at
  Phase 2 makes every `create` delta write a resolving `domain:` before Phase 5's validator ever
  runs; the Phase 6.1 taxonomy gate blocks only a `forced` fit and never fires for a `clear` one;
  an approved new domain/subdomain is authored on this same distill branch and re-validated
  before Phase 7 opens the PR. No registry present → completely inert, byte-for-byte today's
  behavior.
```

### Step 11 — re-trace §5's GREEN state
Re-read the edited file and walk T1–T6 again; confirm every "Assert" line holds against the new
text.

### Step 12 — regression-check the untouched code
Run `npx nx test @nexus/portable-tools`. Expect **295 tests / 16 files, still all green,
byte-identical to the §3 baseline** — this story touched no file under `libs/portable-tools/src/`.
If anything differs, you edited the wrong file or something outside this plan's scope changed.

### Step 13 — re-vendor the component-fingerprint pin
Run `pnpm nexus:vendor-tools`. This rewrites `libs/portable-tools/bundle-fingerprint.json`'s
`"claude-components"` entry (and only that entry — no `.mjs` bundle hash changes, since no `.ts`
source changed). Re-run `npx nx test @nexus/portable-tools`; `parity.spec.ts`'s "fingerprint pin"
test must now pass. Stage the regenerated pin.

### Step 14 — append decision stubs
Resolve `<epic>` = `.nexus/queue/domain-filing-drift-f0249299` (already known — you're inside its
plan). Resolve `<your-username>` via `gh api user --jq .login` (fallback: a slug of `git config
user.name`). Branch = `epic/domain-filing-drift-story-1` → slug `epic-domain-filing-drift-story-1`.
Append (create the file if it doesn't exist yet) to
`.nexus/queue/domain-filing-drift-f0249299/<username>/decisions-epic-domain-filing-drift-story-1.md`,
using the CLAUDE.md stub format, at least these two (§2 already made the calls — record them,
don't re-decide):

- **This story ships as a prompt edit, no application source** — Choice: implement domain filing
  and the taxonomy gate entirely inside `.claude/commands/nxs.distill.md`; no new TypeScript
  module, no new spec file. Why: the decision record calls filing "a synthesis judgment... not a
  separate deterministic classifier," and no code anywhere in the repo models `AskUserQuestion`
  or reads prompt-file content for assertions — confirmed against direct precedent (commit
  `59dad02`, a pure prompt-only gate addition to this same file, changed only the command file
  + the fingerprint pin). Refuted alternative: adding a "prompt conformance" spec file that
  greps the command markdown for required substrings — rejected as speculative test machinery
  with zero repo precedent and a brittle false-signal risk (passes on paraphrase, fails on
  reword-without-behavior-change).
- **Ties in fit classification resolve to "forced," never "clear"** — Choice: when synthesis is
  genuinely unsure whether a rubric covers a new concept, classify it as a forced fit. Why: the
  epic's Success Metric requires a new concept is never silently filed against the reviewer's
  judgment — silence is only safe on a genuine, confident match. Refuted alternative: default
  ties to "clear" to minimize gate interruptions — rejected, it directly risks the Success
  Metric's "never silently filed" guarantee.

### Step 15 — commit
Stage `.claude/commands/nxs.distill.md`, `libs/portable-tools/bundle-fingerprint.json`, and the
decision-stub file. Commit message exactly: `feat(#95): The drain files new concepts under the
taxonomy`.

---

## 7. Done checklist

- [ ] `.claude/commands/nxs.distill.md` carries all the edits in §6 Steps 2-10 (Edits 1, 2, 3,
      4a, 4b, 5, 6, 7, 8); §5's T1-T6 traces all hold against the final text (§6 Step 11).
- [ ] `npx nx test @nexus/portable-tools` — **295 tests / 16 files, unchanged from the §3
      baseline** (this story touches no file under `libs/portable-tools/src/`).
- [ ] **Re-vendor obligation — this DOES apply** (contrary to a first guess that a Story-1-shaped
      plan wouldn't touch `.claude/**`: this story's entire scope is inside `.claude/**`). Ran
      `pnpm nexus:vendor-tools`; `libs/portable-tools/bundle-fingerprint.json`'s
      `"claude-components"` entry changed and is committed; every `.mjs` bundle hash is
      unchanged (no `.ts` source touched). `parity.spec.ts`'s fingerprint-pin test is green.
- [ ] No new TypeScript/JS source or spec file was added (§2.0) — application-source TFD/coverage
      does not apply to this story; §5's traced scenarios are the substitute verification.
- [ ] Decision stubs appended (§6 Step 14) to
      `.nexus/queue/domain-filing-drift-f0249299/<username>/decisions-epic-domain-filing-drift-story-1.md`.
- [ ] Scope guards held: `domain-registry.ts`, `validate-concepts.ts`, `generate-atlas.ts`
      untouched; no `docs/domains.md` created; no Story 2/3 content (drift advisory, seed mode,
      community detection) added anywhere.
- [ ] Commit message exactly: `feat(#95): The drain files new concepts under the taxonomy`.
