---
name: nxs.epic
description: Turn a natural-language capability description into a right-sized epic with user stories and acceptance criteria. Takes intent directly — no feature brief required. Oversized scope decomposes to backlog stubs instead of full epics.
category: planning
tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill
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

Run the phases in order.

## Phase 0 — Resolve entry mode

1. If `$ARGUMENTS` is empty → ERROR. Ask for a capability description or a stub slug. Stop.
2. Decide **promotion** vs **intent**:
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
    - If `docs/features/<slug>/` already exists, reuse it (append to its epic index). Otherwise scaffold it with a thin nav index `README.md` — a navigation aid, **not** a forcing-function brief:

        ```markdown
        ---
        feature: "<Name>"
        ---

        # <Name>

        <one-line statement of the capability intent>

        ## Epics

        - <linked once this epic gets a queue entry / issue>
        ```

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

**How would you like to proceed?**

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

**How would you like to proceed?**

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
    - For unclear aspects, make informed guesses from context and standards. Mark `[NEEDS CLARIFICATION: …]` only when the choice materially changes scope or UX and no reasonable default exists. **Max 3 markers.** Prioritize: scope > security/privacy > UX > technical.
3. For each story assign **`story_type`**:
    - `user` — acceptance criteria describe a behavioral outcome observable by an end-user.
    - `system` — acceptance criteria are a measurable technical assertion (metric, threshold, or pass/fail contract). Prose-only ACs ("implement caching") are not acceptable for a `system` story.
4. Write the epic document (structure below). Resolve any remaining clarifications with the user before finalizing (use the clarification format in the guidelines).

## Phase 4 — Write the queue entry

The epic is written to the committed planning queue, not under `docs/`.

```bash
BRANCH="$(git branch --show-current)"; [ -z "$BRANCH" ] && BRANCH="detached"
LOCAL_ID="$(python3 -c 'import secrets; print(secrets.token_hex(4))')"
QDIR=".nexus/queue/${BRANCH}/${LOCAL_ID}"
mkdir -p "$QDIR"
```

Write the epic to `${QDIR}/epic.md`. Downstream commands (`/nxs.hld`, `/nxs.tasks`, `/nxs.close`) discover this entry by `git branch --show-current` + globbing `.nexus/queue/<branch>/*/`; multiple entries on one branch prompt a selection.

Then link the epic from the feature nav index (`docs/features/<slug>/README.md` → `## Epics`).

## Phase 5 — Optional: create the GitHub epic issue (MANDATORY STOP)

Ask once:

```markdown
**Create a GitHub issue for this epic now?** (yes / no)
— `yes`: creates the parent epic issue and records its number for downstream tasks.
— `no`: skip; the issue can be created later.
```

**Do NOT proceed without a response.**

- **yes** → invoke the `nxs-gh-create-epic` skill on the queued epic:

    ```bash
    python ./.claude/skills/nxs-gh-create-epic/scripts/nxs_gh_create_epic.py "${QDIR}/epic.md"
    ```

    The skill reads `epic` (title) and `type` from frontmatter, creates the issue, and writes `link: "#<n>"` back. There is **no folder rename** — the queue `<local-id>` is stable (the GitHub number lives in frontmatter, not the path).
- **no** → skip.

If this was a **promotion**, mark the source stub `status: promoted` in its `backlog.md` (a single status edit; do not delete the block).

## Phase 6 — Report completion

Report:

- Feature name and folder.
- Epic title, story count (with `story_type` breakdown), and complexity rating.
- Queue entry path (`.nexus/queue/<branch>/<local-id>/epic.md`).
- GitHub issue link, if created.
- Any open clarifications still outstanding.
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
complexity: <S|M|L|XL>
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
- Each story ≈ 1–3 days. If larger, split further.

### Clarifications (max 3)

When a clarification is genuinely needed, present options and stop:

```markdown
## Clarification needed: <topic>

**Context:** <quote the relevant intent>
**Question:** <specific question>

| Option | Answer | Impact |
|--------|--------|--------|
| A | … | … |
| B | … | … |

**Your choice:** _[A/B or custom]_
```

After answers, update the epic and remove the marker.

### Links

If a GitHub issue is created from the epic, any `.md` links in the body should be absolute GitHub URLs so they resolve from the issue. Use the `nxs-abs-doc-path` skill to convert repo-relative paths:

```bash
python ./.claude/skills/nxs-abs-doc-path/get_abs_doc_path.py "docs/features/<slug>/README.md"
```
