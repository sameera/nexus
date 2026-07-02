---
name: nxs.epic
description: Turn a natural-language capability description into a right-sized epic with user stories and acceptance criteria, then — on approval at a decision-grade digest — file the epic and one GitHub issue per story together. Takes intent directly — no feature brief required. Oversized scope decomposes to backlog stubs instead of full epics.
category: planning
tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill, AskUserQuestion
model: inherit
---

# Role

Act as a product manager and delivery lead. Turn one capability description into a bounded epic — user stories with testable acceptance criteria — or, when the scope is oversized, into decomposition stubs for later promotion. You do not design or implement; that is downstream (`/nxs.hld`, the engineer).

# User Input

```text
$ARGUMENTS
```

The text after the slash command is either:

- a **capability description** (natural language) — the normal case, or
- a **stub reference** — a single kebab-case slug naming an existing backlog stub to promote.

Empty input is an error: ask the user for a capability description (or a stub slug) and stop.

# What this command does (read once)

- **No feature brief precondition.** It takes intent directly. The feature container is an _output_: if one is not already in context, infer a name, confirm it once, and scaffold it. No human pre-authors a brief before planning.
- **The epic is written to the queue, not `docs/`.** `epic.md` goes into `.nexus/queue/<branch>/<local-id>/` — the committed planning queue the distiller later drains (0006). The feature folder under `docs/features/<name>/` holds only a thin nav index and `backlog.md`.
- **Oversized scope decomposes to stubs.** The right-sizing gate is kept. A `> M` scope, with consent, emits **stubs** into the feature backlog (split by functional goal); the full `epic.md` for each is deferred to a later `/nxs.epic <stub-slug>` promotion.

## Interaction convention — actionable choice gates

Every explicit-choice point in this command — the resume/feature-name confirmations,
the right-size gates, clarifications, and the approval digest — is presented through
the **`AskUserQuestion`** tool, **not** as a free-text prompt the user has to read and
type a reply to. This renders one selectable option per line, each with a short
description, in both the VS Code extension and the terminal.

At each gate:

1. Render any context first as ordinary markdown (the digest, the assessment table,
   the clarification context, the proposed split).
2. Then call `AskUserQuestion` with **one option per choice**. Use the canonical verb
   named at that gate as the option label (`approve`/`revise`, `proceed`/`split`,
   `stubs`/`full`, clarification `A`/`B`, `resume`/`new`) and put the action's effect
   in the option description.
3. Act on the selected option. The user can always pick "Other" to give a custom
   answer (e.g. a different feature name, or a clarification answer not in the list).

The option tables shown at the gates below describe each choice's impact — that detail
is the context you render in step 1; the `AskUserQuestion` call in step 2 is what the
user actually clicks.

Run the phases in order.

## Phase 0 — Resolve entry mode

1. **Resume check.** Glob `.nexus/queue/<branch>/*/epic.md` for the current branch (`git branch --show-current`). If an entry's frontmatter has **no `link`** — an epic already planned but not yet filed as issues — report it and ask whether to **resume** its approval gate or start a new epic. Resume → load that entry and skip to Phase 5. If `$ARGUMENTS` is `--resume` and exactly one pending entry exists, resume it without asking. Otherwise continue.
2. If `$ARGUMENTS` is empty (and not resuming) → ERROR. Ask for a capability description or a stub slug. Stop.
3. Decide **promotion** vs **intent**:
    - A **stub reference** is a single token, no whitespace, kebab-case, that matches a `## <slug>` block with `status: proposed` in some `docs/features/*/backlog.md`. Glob the backlogs and check.
    - Exactly one match → **promotion mode**. Load the stub (functional goal, candidate story-group titles, estimate). The feature container is the backlog's parent directory. Skip the right-sizing gate (the stub was already sized ≤ M at decomposition) and use the stub's goal + candidate stories as the seed for Phase 3.
    - No match, or input contains whitespace → **intent mode**. The text is the capability description.

## Phase 1 — Resolve the feature container

The container must exist before writing: the queue entry records its parent feature, and `backlog.md` lives under it (0006 §4).

1. **Promotion mode** → already resolved (the stub's backlog parent). Continue.
2. **Intent already inside a feature** → if the user referenced a `docs/features/<name>/` path or has a file open under one, use that feature.
3. **Otherwise infer and confirm once**:
    - Derive a feature **name** (Title Case) and **slug** (kebab-case) from the intent.
    - Present a single confirmation: _"I'll plan this under feature **<Name>** (`docs/features/<slug>/`). Accept, or give a different name?"_ — one prompt, cheap. Accept the user's correction if any.
    - Ensure the directory exists (`mkdir -p docs/features/<slug>`) — the queue entry's `feature_path` and any `backlog.md` need it. **Do not write `README.md` here.** The feature nav index is written only once the epic is filed as a GitHub issue (Phase 6), so it links directly to the issue rather than a draft that must be updated later. Record the feature **name** and a **one-line capability statement** for that later write.

## Phase 2 — Right-size gate (MANDATORY STOP) — skip in promotion mode

Before generating any epic content, assess the scope yourself using the rubric below. This is a
judgment step — read `docs/product/context.md` and `docs/system/stack.md` if present to calibrate
against existing patterns.

### Sizing rubric

| Size | Duration | Characteristics |
| ---- | -------- | --------------- |
| **S** | 1–2 days | Single service, existing patterns, no new infra, low risk |
| **M** | 3–5 days | Multiple files, minor schema changes, 1–2 integrations |
| **L** | 1–2 weeks | New service / major refactor, migrations, 3+ integrations, cross-team |
| **XL** | 2–4 weeks | Architectural shift, large migrations, new infra, phased rollout |
| **XXL** | 1–3 months | Feature-scale program — multiple architectural shifts or workstreams |

Weigh distinct components, data entities, integration points, non-trivial NFRs (security,
performance, observability), and known unknowns. Record the rating and its **drivers** — they go
into the epic frontmatter (`complexity`, `complexity_drivers`).

### Story-level sizing rolls up to the epic (0009)

The epic's size is **not** guessed top-down — it is the **rollup of its story sizes**. Each story is
sized **S or M** in Phase 3, at story scale (S ≈ ≤1 day, M ≈ 1–3 days), and **no single story may
exceed M** — a story that reads larger is split into ≤ M stories there (the story is the
implementation unit; an oversized story is a planning defect, not a big issue to file). The epic
`complexity` is then **derived** from the story set: the dominant story size, the **story count**,
and **cross-story integration**. A handful of S stories is an S/M epic; many stories, or several M
stories with heavy interlock, roll up to L/XL and re-fire the gate below.

This Phase-2 pass is therefore the **coarse pre-assessment** that catches obviously-oversized intent
before any generation. Phase 3 finalizes `complexity` from the actually-sized stories; if that rollup
lands **> M**, return here and apply the L/XL/XXL gate (offer stubs) before writing the epic.

Interpret:

| Assessment | Action |
| --- | --- |
| **S** (1–2 days) / **M** (3–5 days) | Proceed to Phase 3 — generate the full epic. |
| **L** (1–2 weeks) | **Soft gate.** Fits a sprint but fills it with no slack for overruns. Present the assessment + utilization-risk warning, then **MANDATORY STOP**: proceed only on explicit confirmation, with decomposition offered as the safer alternative. |
| **XL** (2–4 weeks) / **XXL** (1–3 months) | Present the assessment + proposed split, then **MANDATORY STOP** for a choice. XXL is feature-scale — recommend feature-level planning over a single epic. |

When **L/XL/XXL**, decompose the capability into right-sized functional goals using the rules below,
then present the assessment and the proposed split. For **L** the split is the *alternative*; for
**XL/XXL** it is the *expectation*.

### Decomposition (L/XL/XXL)

- Split by **functional goal** — a shippable, independently reviewable slice of capability. Never
  split by layer (no "backend goal" + "frontend goal").
- **Each goal must be ≤ M.** Split further if a goal still reads L or larger; if one genuinely
  cannot drop below M, mark it `M` — it re-sizes when promoted.
- Give each goal: a kebab-case **slug**, a one-line **goal**, an **S/M estimate**, **blocked_by**
  ordering (foundational goals first, referenced by slug), and **candidate user-story group
  titles** (titles only — no acceptance criteria).
- Prefer the fewest viable goals. A clean L often splits into 2–3 goals, not 6. Do not pad.

Then offer. Use the variant matching the assessed size.

**L (soft gate — fills the sprint):**

```markdown
## ⚠️ Fills the sprint — no slack

Assessed **L** (1–2 weeks). This fits a sprint but consumes it entirely, leaving no
buffer for overruns or the unexpected. Proceeding is allowed but risky.

**Options** (asked via `AskUserQuestion` — see the interaction convention):

| Option | Action |
|--------|--------|
| **proceed** | Generate the full epic at this scope. Adds a utilization-risk banner. |
| **split** | (safer) Decompose into the right-sized goals below and write them as stubs. |
```

**XL / XXL (exceeds one epic):**

```markdown
## ⚠️ Scope exceeds one epic

Assessed **[XL/XXL]**. Generating full epics for every sub-goal now would be speculative
over-generation. [XXL: this is feature-scale — prefer feature-level planning over a single
epic.] Proposed split into right-sized goals:

| # | Functional goal | Est. | Candidate stories |
|---|-----------------|------|-------------------|
| 1 | …               | S/M  | …                 |

**Options** (asked via `AskUserQuestion` — see the interaction convention):

| Option | Action |
|--------|--------|
| **stubs** | (recommended) Write these as proposed stubs to the feature backlog. Promote one later with `/nxs.epic <slug>`. |
| **full**  | Generate a single full epic at the original (oversized) scope anyway, with a scope-warning banner. |
```

**Do NOT proceed without an explicit choice.**

- **proceed** (L) → Phase 3, and include the utilization-risk banner in the epic.
- **split** (L) / **stubs** (XL/XXL) → Phase 2b.
- **full** (XL/XXL) → Phase 3, and include the scope-warning banner in the epic.

## Phase 2b — Emit decomposition stubs (oversized path)

Append one stub per functional goal to `docs/features/<slug>/backlog.md` (create it if absent). The backlog is **append-only** with one consumer (the next `/nxs.epic`); `/nxs.close` also appends deferred scope here, so the entry shape is shared (slug + goal + estimate + status).

Create the file with this header on first write:

```markdown
# Backlog: <Feature Name>

<!-- Append-only re-triage queue. Writers: /nxs.epic (decomposition stubs),
     /nxs.close (deferred scope). One consumer: the next /nxs.epic.
     Promote a proposed stub with `/nxs.epic <slug>`. -->
```

Append one block per stub (never rewrite existing blocks):

```markdown
## <stub-slug>

- **status:** proposed
- **goal:** <one-line functional goal>
- **estimate:** S | M
- **blocked_by:** [<stub-slug>, …] | none
- **source:** decomposition of "<original intent>" (<YYYY-MM-DD>)
- **candidate stories:** <Story group title>; <Story group title>; …
```

Each stub must be ≤ M. If the decomposer returns a sub-goal still > M, note it in the stub (`estimate: M`, with a comment) — it will be re-decomposed when promoted.

Then **stop**. Report the stub list and tell the user to promote one with `/nxs.epic <slug>`. Do **not** create a queue entry or a GitHub issue this run.

## Phase 3 — Generate the epic

1. Read `docs/product/context.md` if present — personas and strategy are canonical there. **Reference** them; do not re-tabulate.
2. Parse the capability description (or, in promotion mode, the stub's goal + candidate story titles):
    - Extract actors, goals, actions, data, constraints, business value.
    - Decompose into **3–8 user stories**, each independently deliverable (INVEST).
    - **Size each story `S` or `M`** (story-scale rubric) and **split any story that would exceed M**
      into ≤ M stories before finalizing — the story is the implementation unit (0009), so an
      oversized story is split here, not filed. Record each story's `size`.
    - For unclear aspects, make informed guesses from context and standards. Mark `[NEEDS CLARIFICATION: …]` only when the choice materially changes scope or UX and no reasonable default exists. **Max 3 markers.** Prioritize: scope > security/privacy > UX > technical.
3. For each story assign **`story_type`**:
    - `user` — acceptance criteria describe a behavioral outcome observable by an end-user.
    - `system` — acceptance criteria are a measurable technical assertion (metric, threshold, or pass/fail contract). Prose-only ACs ("implement caching") are not acceptable for a `system` story.
4. **Roll up the epic complexity (0009).** Derive `complexity` from the sized stories — dominant
   story size + story count + cross-story integration — and set `complexity_drivers` to match. **If
   the rollup exceeds M**, stop and return to the Phase 2 gate (present the L/XL/XXL options; stubs
   are the expected path) before writing anything.
5. Write the epic document (structure below). Resolve any remaining clarifications with the user before finalizing (use the clarification format in the guidelines).

## Phase 4 — Write the queue entry

The epic is written to the committed planning queue, not under `docs/`.

```bash
BRANCH="$(git branch --show-current)"; [ -z "$BRANCH" ] && BRANCH="detached"
LOCAL_ID="$(python3 -c 'import secrets; print(secrets.token_hex(4))')"
QDIR=".nexus/queue/${BRANCH}/${LOCAL_ID}"
mkdir -p "$QDIR"
```

Write the epic to `${QDIR}/epic.md`. Downstream commands (`/nxs.hld`, `/nxs.analyze`, `/nxs.close`) discover this entry by `git branch --show-current` + globbing `.nexus/queue/<branch>/*/`; multiple entries on one branch prompt a selection.

The feature nav index (`docs/features/<slug>/README.md`) is **not** written here. It is written in Phase 6, after the epic issue exists, so its `## Epics` entry links directly to the issue — never a draft queue-path pointer that needs updating (the queue entry is transient; the distiller drains it, 0006).

## Phase 4b — Epic gate (nxs-epic-gate)

Before showing the approval digest, run the **`nxs-epic-gate`** agent against the just-written
`${QDIR}/epic.md`. It is the planning-consistency check the story issues are filed behind: it verifies
acceptance-criteria quality by `story_type`, story well-formedness (S/M sizing, INVEST), and epic
internal consistency (no unresolved `[NEEDS CLARIFICATION]`, no self-contradicting terms). It checks
the epic alone — story↔design coverage needs the decision record and is `/nxs.hld`'s job, not this
gate's.

```
Invoke: nxs-epic-gate
Input: ${QDIR}/epic.md
```

Fold the findings into Phase 5:

- **No critical/high findings** → carry the gate result into the digest as a one-line "epic gate: clean"
  and continue.
- **Critical or high findings** → do **not** render the approval prompt. Surface the findings, fix
  `epic.md` in place (or resolve with the user where judgment is needed), then re-run the gate until it
  is clean. The gate is read-only; you apply the fixes.

## Phase 5 — Approval digest (MANDATORY STOP)

Present a **decision-grade digest** for approval — the read-surface, not the full file. The full
`epic.md` stays in the queue as drill-down. This is the human checkpoint: a reviewer approves the
epic *and* its story breakdown here, in one screen, instead of glossing a long document.

**Open questions block the gate.** If `## Open Questions` carries any `[NEEDS CLARIFICATION]` items,
resolve them first: present each using the clarification format (Guidelines), apply the answers to
`epic.md`, and remove the markers. Do **not** render the approval prompt or create any issue while
open questions remain.

Then render the digest:

```markdown
# Feature: <Feature Name>

<the one-line capability statement recorded in Phase 1 (the README is not written yet)>

# Proposal

## <Epic Title>   ·   complexity: <S|M|L|XL>

<everything in epic.md between the H1 title and `## User Stories` — Description, Business Value,
Success Metrics, Personas — verbatim (condense only obvious redundancy).>

### Stories

- **<Story 1 Title>** (<size>) — <one-line summary of the story's goal>
- **<Story 2 Title>** (<size>) — <one-line summary>
- …

<everything in epic.md after the User Stories section — Assumptions, Out of Scope. Open Questions is
empty by now.>
```

Then ask for the decision via **`AskUserQuestion`** (per the interaction convention) — do not
emit a free-text prompt line. Two options:

- **approve** — file the epic issue and one issue per story.
- **revise** — stop; edit the queued `epic.md`, then re-run with `/nxs.epic --resume`.

**Do NOT create any issue without an explicit `approve`** (an `AskUserQuestion` selection of
`approve`, or an "Other" answer that clearly means approve).

- `approve` → Phase 6.
- `revise` → stop. Leave the queue entry intact for editing; report how to resume.

## Phase 6 — File the epic and story issues (on approve)

Issue creation is **coupled**: the epic issue and its story sub-issues are created together in this
one step. There is no separate task command — the story is the implementation unit (0009), so each
story becomes one GitHub issue, child of the epic issue.

1. **Create (or reuse) the epic issue.** If `epic.md` frontmatter already carries `link`, reuse that
   number. Otherwise create it:

    ```bash
    python ./.claude/skills/nxs-gh-create-epic/scripts/nxs_gh_create_epic.py "${QDIR}/epic.md"
    ```

    The skill reads `epic` (title) and `type` from frontmatter, creates the issue, and writes
    `link: "#<n>"` back. Re-read the frontmatter; set `EPIC` = that number. There is **no folder
    rename** — the queue `<local-id>` is stable (the GitHub number lives in frontmatter, not the path).

2. **Sequence the stories.** Order by dependency: foundational first (core data / shared surface),
   then dependents, then polish. Assign each a stable ref `STORY-<EPIC>.<SEQ>` (`SEQ` zero-padded, in
   order) and record `blocked_by` as a list of story refs or `none`. Do **not** split or merge —
   sizing happened in Phase 3.

3. **Write transient story work-items** to the scratchpad, one `STORY-<EPIC>.<SEQ>.md` per story, with
   the frontmatter the creation skill consumes and the story body as the issue body:

    ```markdown
    ---
    ref: "STORY-<EPIC>.<SEQ>"          # internal authoring key — NOT shown on the issue
    title: "<Story Title>"             # clean title; no STORY-<EPIC>.<SEQ> prefix
    blocked_by: [STORY-<EPIC>.<SEQ>, ...] | none   # blocker refs (this batch)
    labels: [<label>, ...]      # from .nexus/config/task-labels.md — applicable only
    parent: "#<EPIC>"
    project: "<org/repo from .nexus/config/config.* if present>"
    ---

    **As a** … **I want** … **so that** …

    ## Acceptance Criteria
    - [ ] …

    ## Notes
    …
    ```

    The `ref` is the stable planning-time key (the GitHub issue numbers don't exist yet, so the
    `blocked_by` graph is authored against refs). It stays internal: the issue **title is clean**,
    and the skill resolves refs → issue numbers itself. Read valid labels from
    `.nexus/config/task-labels.md`; select only applicable ones per story.

4. **Create the story issues:**

    ```bash
    python ./.claude/skills/nxs-gh-create-story/scripts/create_gh_issues.py "<scratch-folder>"
    ```

    The skill runs two passes: pass 1 creates each issue (clean title), links it as a sub-issue of
    `#<EPIC>`, and adds it to the project, recording each `ref → issue` mapping; pass 2 wires the
    **native GitHub `blocked_by` dependencies** from each story's `blocked_by` refs.

    The skill is **resumable and idempotent**: it retries transient GitHub failures, records progress to
    a `.nxs-created.json` ledger in the folder, and ends with a SUMMARY. **If it prints
    `⚠️ INCOMPLETE`** (non-zero exit), do **not** hand-create the missing issues — re-run the exact same
    command. Already-created issues are skipped via the ledger (no duplicates) and only the remainder is
    filed. Discard the transient files only **after** a `✅ Complete` run — the stories live in `epic.md`;
    the issues are then the working surface.

5. **Record the sequence on the epic.** Append (or replace) an `## Implementation Sequence` section in
   the queue `epic.md` — a thin ordered table, **not** a separate index file. The `blocked_by` column
   is a human-readable mirror; the authoritative dependency graph now lives on the GitHub issues
   themselves (wired in step 4):

    ```markdown
    ## Implementation Sequence

    | STORY | Issue | blocked_by |
    |---|---|---|
    | STORY-<EPIC>.01 | #<n> | none |
    | STORY-<EPIC>.02 | #<n> | STORY-<EPIC>.01 |
    ```

6. **Write the feature nav index.** Now that the issue exists, write `docs/features/<slug>/README.md`
   with an `## Epics` entry that links **directly to the epic issue `#<EPIC>`** — no draft, no later
   update. The entry must be a clickable **markdown link** to the issue, not a bare `#<EPIC>` ref
   (a bare ref does not resolve in a repo `.md` file). Resolve the issue URL from the `gh` CLI
   (`gh issue view <EPIC> --json url -q .url`, or `gh repo view --json url -q .url` + `/issues/<EPIC>`).
   If the README does not exist (new feature), create it from the skeleton below using the name +
   one-line statement recorded in Phase 1. If it exists (a multi-epic feature), append the new entry
   to `## Epics`.

    ```markdown
    ---
    feature: "<Feature Name>"
    ---

    # <Feature Name>

    <one-line capability statement>

    ## Epics

    - **<Epic Title>** — [#<EPIC>](<epic-issue-url>)
    ```

If this was a **promotion**, mark the source stub `status: promoted` in its `backlog.md` (a single
status edit; do not delete the block).

## Phase 7 — Report completion

Report:

- Feature name and folder.
- Epic title, complexity rating, and story count (with `story_type` breakdown).
- Queue entry path (`.nexus/queue/<branch>/<local-id>/epic.md`).
- Epic issue link and the created story issue numbers — or, if the user chose `revise`, that no
  issues were created and how to resume (`/nxs.epic --resume`).
- Next step: `/nxs.hld` to produce the decision record for this epic.

---

## Epic document structure

```markdown
---
feature: "<Feature Name>"
feature_path: docs/features/<slug>
epic: "<Epic Title>"
slug: <epic-slug>
created: <YYYY-MM-DD>
type: enhancement
status: draft
complexity: <S|M|L|XL>   # rollup of story sizes + count + cross-story integration (0009)
complexity_drivers: [<driver>, <driver>]
concepts: []          # reading-list of concept slugs this epic depends on (consumed in B3)
link:                 # GitHub epic issue, set by nxs-gh-create-epic
---

# Epic: <Epic Title>

<!-- Risk banner ONLY if the user chose to proceed past a gate:
- L, chose "proceed": > ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep.
- XL/XXL, chose "full": > ⚠️ **Scope warning:** assessed [XL/XXL]. Exceeds one sprint. Consider splitting during planning.
-->

## Description

<2–3 paragraphs: WHAT the capability does and WHY it matters. Value, not implementation.>

## Business Value

- <business justification / expected outcome>

## Success Metrics

- <measurable, technology-agnostic criterion>

## Personas

<Deviations only. Personas are canonical in docs/product/context.md. If this epic uses them
as-is, write: "Per `docs/product/context.md`." Tabulate only personas specific to this epic or
deviations from the canonical set.>

## User Stories

### Story 1: <Story Title>

- **story_type:** user | system
- **size:** S | M

**As a** <persona>, **I want** <goal>, **so that** <benefit>.

#### Acceptance Criteria

- [ ] **Given** <precondition>, **when** <action>, **then** <expected result>
<!-- For story_type: system, at least one AC must state a measurable metric, threshold,
     or pass/fail assertion — not prose like "implement caching". -->

#### Notes

<assumptions, constraints, context — optional>

### Story 2: <Story Title>

<repeat>

## Assumptions

- <reasonable defaults chosen for unspecified details>

## Out of Scope

- <explicitly excluded; for the "full" oversized path, note deferred scope here>

## Open Questions

<[NEEDS CLARIFICATION] items — max 3. Empty if none.>
```

Notes on the shape (vs. the pre-refactor epic):

- **No three-scenario timeline table and no complexity appendix** — the rating and its drivers live in frontmatter (`complexity`, `complexity_drivers`).
- **No glossary.** Terms that name durable concepts are routed to a concept page's `aliases:` at close time (System B), not stored in the epic.
- **Personas are deviations-only** — the canonical set is `docs/product/context.md`.

---

## Guidelines

### Focus

- **WHAT** users need and **WHY** (value). Avoid **HOW** (no stack, APIs, code structure).
- Each story is a conversation starter, not a complete spec. Each AC must be verifiable.
- Stay consistent with `docs/product/context.md` terminology and personas.

### Story decomposition

- Split by user action/workflow, data entity, permission level, or core-vs-enhancement.
- Order foundational stories first (core CRUD / data), then enhancements, then polish.
- **Each story is sized `S` or `M` and must not exceed M (0009).** Split any larger story further —
  the story is the implementation unit, so an oversized story is split here, not filed as a big issue.

### Clarifications (max 3)

When a clarification is genuinely needed, render the context as markdown, then ask via
`AskUserQuestion` (per the interaction convention) — one option per answer, plus the user's
"Other" for a custom answer. Stop until answered.

```markdown
## Clarification needed: <topic>

**Context:** <quote the relevant intent>
**Question:** <specific question>

| Option | Answer | Impact |
|--------|--------|--------|
| A | … | … |
| B | … | … |
```

Then call `AskUserQuestion` with option `A`, option `B` (labels = the answers, descriptions =
the impact). After answers, update the epic and remove the marker.

### Links

If a GitHub issue is created from the epic, any `.md` links in the body should be absolute GitHub URLs so they resolve from the issue. Use the `nxs-abs-doc-path` skill to convert repo-relative paths:

```bash
python ./.claude/skills/nxs-abs-doc-path/get_abs_doc_path.py "docs/features/<slug>/README.md"
```
