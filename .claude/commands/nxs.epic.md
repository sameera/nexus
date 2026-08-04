---
name: nxs.epic
description: Turn a natural-language capability description into a right-sized epic with user stories and acceptance criteria, then — on approval at a decision-grade digest — file the epic and one GitHub issue per story together. Takes intent directly — no feature brief required. Oversized scope decomposes to backlog stub issues, each promoted later by its own issue number.
category: planning
tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill, AskUserQuestion
model: inherit
---

# Role

Act as a product manager and delivery lead. Turn one capability description into a bounded epic — user stories with testable acceptance criteria — or, when the scope is oversized, into decomposition stubs for later promotion. You do not design or implement; that is downstream (`/nxs.decision-record`, the engineer).

# User Input

```text
$ARGUMENTS
```

The text after the slash command is either:

- a **capability description** (natural language) — the normal case, or
- a **bare issue number** (`<n>` or `#<n>`) — **plan this epic**. Legal only while that epic still
  carries the unplanned label, i.e. while it is a backlog stub, or
- **`--from #<issue>`** — pull an epic that is **already filed** as GitHub issues (by Nexus or by
  hand) into a materialized `epic.md`, so downstream stages can run against an epic not planned in
  this session. This is a read-only wrapper over the resolver — it plans nothing and commits nothing
  (handled up front in Phase 0; the planning phases below do not run).

The flag selects the operation; it is never inferred from the shape of the argument. A bare number
always means "plan this epic"; `--from` always means "load this already-planned epic". **Any other
input is a capability description** — there is no slug lookup, because a stub's issue number is its
only identifier.

Empty input is an error: ask the user for a capability description (or a stub's issue number) and stop.

# What this command does (read once)

- **No feature brief precondition.** It takes intent directly. The feature container is an _output_: if one is not already in context, infer a name, confirm it once, and scaffold it. No human pre-authors a brief before planning.
- **Nothing is committed at planning — GitHub issues are the source of truth (#114).** The epic is drafted only to **session scratch**; the epic gate runs on that draft; and at approval the epic and its story issues are **filed**, committing **nothing** to `.nexus/queue/`. The queue entry is no longer born here — it is born at close (`/nxs.close`), so the queue holds only closed, drainable entries. Every later stage reconstructs the epic from its issue number via the resolver (`nxs-epic-resolve`), not from a committed planning file. The feature folder under `<docs-root>/features/<name>/` (the docs root resolved in Phase 0) still holds the durable nav index. It holds no backlog file: deferred scope is an open issue carrying the unplanned label (#185), so the feature tree carries no re-triage queue at all.
- **Oversized scope decomposes to stubs.** The right-sizing gate is kept. A `> M` scope, with consent, files one **stub issue** per functional goal — an epic identified but not yet planned, carrying the epic classification plus the unplanned label; the full epic for each is deferred to a later `/nxs.epic <issue-number>` promotion.
- **A stub is an epic issue, so every epic query filters it out.** The whole cross-feature backlog is one query — open issues carrying the unplanned label — and its exclusion is one negated filter. Any query here or downstream that enumerates epics for **planned** work carries that negation; ask for it (`delivery_config.py backlog-query --form exclude`) rather than writing the label by hand. This is the accepted price of a stub keeping its issue number through promotion.

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

**`--from #<issue>` short-circuit (handle first, before anything else).** If `$ARGUMENTS` contains
`--from` (string-matched, like `--resume`) followed by an issue reference (`#<n>` or `<n>`), this is
a **pull**, not a plan. Do not draft, do not run the right-size gate, do not file anything:

1. Run the resolver with the epic-vs-story guard on:

    ```bash
    tsx ./.claude/skills/nxs-epic-resolve/scripts/epic_resolve.ts --epic <n> --require-epic
    ```

2. **On a non-zero exit** the resolver printed a diagnostic on stderr (`epic-resolve <problem>:
   <message>`). Report it verbatim and stop — in particular, `not-an-epic` (the number is a story
   sub-issue), `epic-not-found` (no such issue), and `epic-not-planned` (the number is a backlog
   stub, which has nothing to load — offer `/nxs.epic <n>` to plan it) each name why. **No `epic.md`
   is produced** on failure.
3. **On success** it printed `{ epic, targetRoot, outPath }` — a materialized `epic.md` at `outPath`
   under the gitignored `.nexus/tmp/`. Report that path and that `/nxs.decision-record <n>` / `/nxs.analyze` can
   now run against this epic. **Commit nothing** (the same no-commit contract as planning; the output
   is gitignored). Then **stop** — the phases below do not run for `--from`.

Otherwise (no `--from`), continue with normal planning.

**Resolve the docs root (once, up front — reused by every path this command builds).** Run the
docs-root read-out, the single-value view over the workspace resolver:

```bash
tsx ./.claude/skills/nxs-workspace-status/scripts/docs_root.ts
```

In a checkout with no in-repo Node toolchain (a docs-only hub), use the portable CLI instead —
`node <tools-dir>/nexus.mjs workspace docs-root` (in a workspace hub, `<tools-dir>` is `.nexus/tools`).

- It prints one line — capture it as **`<docs-root>`**: `docs` for a single-repo checkout or a
  member, `.` for a hub whose docs root is the repo root, or the hub's configured override.
- **On a non-zero exit** it printed a resolver diagnostic to stderr. **Stop and report it.** Never
  fall back to a literal `docs/` — a resolution failure is not "no feature yet".
- **Building a path under `<docs-root>` (empty-prefix rule):** if `<docs-root>` is `.`, the taxonomy
  hangs directly off the repo root (`features/<slug>/…`); otherwise prefix it
  (`<docs-root>/features/<slug>/…`). Never emit a `./`-prefixed path or a segment named `.`.

1. **Resume check.** Look in your **session scratch** for a pending epic draft — a working folder
   (e.g. `nxs-epic-<slug>/epic.md`) written by a prior run of this command whose frontmatter has
   **no `link`** (an epic drafted but not yet filed as issues). If one exists, report it and ask
   whether to **resume** its approval gate or start a new epic. Resume → load that draft and skip to
   Phase 5. If `$ARGUMENTS` is `--resume` and exactly one pending draft exists, resume it without
   asking. Otherwise continue. (There is no committed queue entry to resume — nothing is committed at
   planning; a draft abandoned mid-session is simply never filed, and needs no cleanup.)
2. If `$ARGUMENTS` is empty (and not resuming) → ERROR. Ask for a capability description or a stub's issue number. Stop.
3. Decide **promotion** vs **intent**. The rule is purely syntactic, then checked against issue state:
    - `$ARGUMENTS` is a **single bare integer**, optionally `#`-prefixed, and no `--from` was passed → **promotion mode**. Resolution reads issue state only and never globs the docs tree:

        ```bash
        gh issue view <n> --json number,title,body,labels,state
        python ./.claude/skills/nxs-gh-shared/delivery_config.py resolve unplanned-label
        ```

      The issue must exist, be **open**, and carry the resolved unplanned label. If it does not — closed, no such issue, or already planned — report **why** it is not promotable, name `--from #<n>` as the way to load an already-planned epic instead, and **file nothing**. Otherwise seed Phase 3 from the stub's body: the functional goal, the estimate, and the candidate story-group titles. Read `feature`/`feature_path` from the body's meta block. Skip the right-sizing gate — the stub was already sized ≤ M when it was decomposed. Record `PROMOTE = <n>`.
    - **Anything else** → **intent mode**. The text is the capability description. A word that looks like a slug is intent, not a lookup key.

**When a promoted stub proves oversized.** If Phase 3's rollup shows the stub cannot become a single epic, run the Phase 2 gate after all and emit fresh stub issues (Phase 2b) — then close the original **as not planned** with a comment naming its successors. Never close it as completed: nothing was delivered.

```bash
gh issue comment <n> --body "Larger than one epic on planning. Re-decomposed into #<a>, #<b>, #<c>."
gh issue close <n> --reason "not planned"
```

## Phase 1 — Resolve the feature container

The container must exist before writing: the feature nav index (written at filing, Phase 6) links the epic issue from it (0006 §4). The draft records the feature it belongs to in its `feature`/`feature_path` frontmatter — carried onto the epic issue's meta block at filing, so the resolver recovers it.

1. **Promotion mode** → already resolved: the `feature_path` recorded in the stub issue's meta block. Create the directory if it does not exist (a stub writes nothing to the tree, so a feature whose first epic is a promotion has no container yet). Continue.
2. **Intent already inside a feature** → if the user referenced a `<docs-root>/features/<name>/` path or has a file open under one, use that feature.
3. **Otherwise infer and confirm once**:
    - Derive a feature **name** (Title Case) and **slug** (kebab-case) from the intent.
    - Let **`<feature-path>`** be the resolved container: `<docs-root>/features/<slug>` (empty-prefix rule: `features/<slug>` on a repo-root hub). This exact string is what you record in `feature_path` and derive `README.md` from.
    - Present a single confirmation: _"I'll plan this under feature **<Name>** (`<feature-path>/`). Accept, or give a different name?"_ — one prompt, cheap. Accept the user's correction if any.
    - Ensure the directory exists (`mkdir -p <feature-path>`) — the draft's `feature_path` needs it. **Do not write `README.md` here.** The feature nav index is written only once the epic is filed as a GitHub issue (Phase 6), so it links directly to the issue rather than a draft that must be updated later. Record the feature **name** and a **one-line capability statement** for that later write.

## Phase 2 — Right-size gate (MANDATORY STOP) — skip in promotion mode

Before generating any epic content, assess the scope yourself using the rubric below. This is a
judgment step — read `<docs-root>/product/context.md` and `<docs-root>/system/stack.md` (the
`<docs-root>` resolved in Phase 0) if present to calibrate against existing patterns.

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
| **stubs** | (recommended) File these as unplanned epic issues (irreversible). Plan one later with `/nxs.epic <issue-number>`. |
| **full**  | Generate a single full epic at the original (oversized) scope anyway, with a scope-warning banner. |
```

**Do NOT proceed without an explicit choice.**

- **proceed** (L) → Phase 3, and include the utilization-risk banner in the epic.
- **split** (L) / **stubs** (XL/XXL) → Phase 2b.
- **full** (XL/XXL) → Phase 3, and include the scope-warning banner in the epic.

## Phase 2b — Emit decomposition stubs (oversized path)

File **one open GitHub issue per functional goal**. A stub is not a third kind of issue: it is an
**epic that has been identified but not yet planned**, so it carries the repository's declared epic
classification plus exactly one label denoting that unplanned state. Write **no** `backlog.md` — the
issue is the stub.

The `stubs` choice at the Phase 2 gate is the consent for this filing; nothing is created before it.

1. **Resolve the classification and the unplanned label** (never hard-code either):

    ```bash
    python ./.claude/skills/nxs-gh-shared/delivery_config.py resolve epic-label
    python ./.claude/skills/nxs-gh-shared/delivery_config.py resolve epic-type
    python ./.claude/skills/nxs-gh-shared/delivery_config.py resolve unplanned-label
    ```

2. **Write one transient work-item per stub** to a session scratch folder (never committed, never
   under `<feature-path>`), named `STORY-STUB-<NN>.md`. No `parent:` key — a stub is never a
   sub-issue of anything:

    ```markdown
    ---
    ref: "STUB-<NN>"                         # internal authoring key for the blocked_by graph
    title: "<Functional goal as an epic title>"
    blocked_by: [STUB-<NN>, ...] | none      # ordering between goals, this batch only
    labels: [<unplanned-label>]              # the resolved unplanned label — nothing else
    ---

    <one-line functional goal>

    ## Meta

    - **feature:** <feature-path>
    - **estimate:** S | M
    - **candidate stories:** <Story group title>; <Story group title>; …
    - **source:** decomposition of "<original intent>" (<YYYY-MM-DD>)
    ```

    Each stub must be ≤ M. If the decomposer returns a sub-goal still > M, record `estimate: M` and
    say so in the goal line — it is re-decomposed when promoted. Write the goal line and every Meta
    value **unwrapped** — one line each, per "Line breaks" under the epic document structure.

3. **File the batch** through the shared filer, classified as an **epic** rather than a story:

    ```bash
    python ./.claude/skills/nxs-gh-create-story/scripts/create_gh_issues.py "<scratch-folder>" \
        --classification-label "<epic-label>" \
        --classification-type "<epic-type>"
    ```

    The filer upserts every label it will apply **before** creating anything, so a repository that
    has never seen the unplanned label still files cleanly; if a label can be neither created nor
    found it reports the gap and creates nothing (grant the token label scope, then re-run). Pass 2
    wires the native `blocked_by` edges between the stubs. With `github.project: none` no project is
    touched. The run is resumable and idempotent — on `⚠️ INCOMPLETE`, re-run the exact same command.

    Discard the transient files only after a `✅ Complete` run.

Then **stop**. Report the created issue numbers with their goals, and tell the user to promote one
with `/nxs.epic <issue-number>`. Do **not** create a queue entry, a feature `README.md`, or a full
epic issue this run.

Close the report with the **cross-feature backlog query** — the whole backlog, this batch included,
in one query. Ask for it rather than spelling the label out:

```bash
python ./.claude/skills/nxs-gh-shared/delivery_config.py backlog-query
```

## Phase 3 — Generate the epic

1. Read `<docs-root>/product/context.md` if present — personas and strategy are canonical there. **Reference** them; do not re-tabulate.
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

## Phase 4 — Write the draft to session scratch (commit nothing)

The epic is drafted **only to session scratch** — never to `.nexus/queue/` and never under `docs/`.
Nothing is committed at planning (#114); the committed queue entry is born at close.

```bash
DRAFT_DIR="<your-session-scratch>/nxs-epic-${EPIC_SLUG}"
mkdir -p "$DRAFT_DIR"
```

`EPIC_SLUG` is the epic's kebab-case slug decided in Phase 3 (the same value written to the draft's
`slug:` frontmatter). Write the epic to `${DRAFT_DIR}/epic.md` — this is the working draft the epic
gate (Phase 4b) and the approval digest (Phase 5) read, and the source the filing skill (Phase 6)
files from. It is transient: it is **not** committed, and after filing it can be discarded.

Write it **unwrapped** — one line per paragraph, per bullet, per table row. This draft is filed
verbatim as the issue body, so a hard wrap here is a hard wrap the reader sees. See "Line breaks"
under the epic document structure.

**Invariant:** after this command completes, the working tree shows **zero** new files under
`.nexus/queue/` (Success Metric 1). If you ever feel the urge to `mkdir .nexus/queue/…`, stop — that
is the old contract.

The feature nav index (`<feature-path>/README.md`) is **not** written here. It is written in Phase 6,
after the epic issue exists, so its `## Epics` entry links directly to the issue.

## Phase 4b — Epic gate (nxs-epic-gate)

Before showing the approval digest, run the **`nxs-epic-gate`** agent against the just-written
`${DRAFT_DIR}/epic.md` draft. It is the planning-consistency check the story issues are filed behind: it verifies
acceptance-criteria quality by `story_type`, story well-formedness (S/M sizing, INVEST), and epic
internal consistency (no unresolved `[NEEDS CLARIFICATION]`, no self-contradicting terms). It checks
the epic alone — story↔design coverage needs the decision record and is `/nxs.decision-record`'s job, not this
gate's.

```
Invoke: nxs-epic-gate
Input: ${DRAFT_DIR}/epic.md
```

Fold the findings into Phase 5:

- **No critical/high findings** → carry the gate result into the digest as a one-line "epic gate: clean"
  and continue.
- **Critical or high findings** → do **not** render the approval prompt. Surface the findings, fix
  `epic.md` in place (or resolve with the user where judgment is needed), then re-run the gate until it
  is clean. The gate is read-only; you apply the fixes.
- **Exception — unresolved `[NEEDS CLARIFICATION]` markers.** Do **not** treat these as a blocking gate
  finding to auto-fix here. Their disposition belongs to the user at the **Phase 5 open-questions gate**
  (`answer` vs. `proceed` with them embedded), not to this gate. Carry any such finding forward as
  context for that gate and continue; the gate's other checks (AC quality, sizing/INVEST,
  self-contradiction) still block as normal.

## Phase 5 — Approval digest (MANDATORY STOP)

Present a **decision-grade digest** for approval — the read-surface, not the full file. The full
`epic.md` stays in session scratch as drill-down. This is the human checkpoint: a reviewer approves
the epic *and* its story breakdown here, in one screen, instead of glossing a long document.

**Open questions gate (MANDATORY STOP).** If `## Open Questions` carries any `[NEEDS CLARIFICATION]`
items, issue creation is **blocked**. Present each item using the clarification format (Guidelines),
then ask via **`AskUserQuestion`** (per the interaction convention) how to unblock:

| Option | Action |
|--------|--------|
| **answer** (recommended) | Resolve the questions now — apply the answers to `epic.md`, remove the `[NEEDS CLARIFICATION]` markers, then continue with `## Open Questions` empty. |
| **proceed** | File the issues anyway **with the open questions embedded** — the `[NEEDS CLARIFICATION]` items stay in `epic.md`'s `## Open Questions` and are carried verbatim into the epic issue body as an explicit unresolved-caveats section. |

Only one of these two selections unblocks the gate. **Do NOT render the approval prompt or create any
issue while a `[NEEDS CLARIFICATION]` marker remains AND the user has not explicitly chosen `proceed`.**

- **answer** → apply the answers, remove every marker (loop until `## Open Questions` is empty), then
  render the digest below.
- **proceed** → keep the markers in place and render the digest below, with the `## Open Questions`
  items surfaced in the digest (see the digest template) so the reviewer approves the epic *knowing*
  it ships with unresolved questions.

Then render the digest:

```markdown
# Feature: <Feature Name>

<the one-line capability statement recorded in Phase 1 (the README is not written yet)>

# Proposal

## <Epic Title>   ·   complexity: <S|M|L|XL>

<everything in epic.md between the H1 title and `## User Stories` — Description, Success Metrics,
Personas — verbatim (condense only obvious redundancy).>

### Stories

- **<Story 1 Title>** (<size>) — <one-line summary of the story's goal>
- **<Story 2 Title>** (<size>) — <one-line summary>
- …

<everything in epic.md after the User Stories section — Assumptions, Out of Scope. If the user chose
**answer**, `## Open Questions` is empty and omitted. If they chose **proceed**, render the remaining
`[NEEDS CLARIFICATION]` items here under a `### ⚠️ Unresolved questions (shipping anyway)` callout so
the approval is made with them in view.>
```

Then ask for the decision via **`AskUserQuestion`** (per the interaction convention) — do not
emit a free-text prompt line. Two options:

- **approve** — file the epic issue and one issue per story.
- **revise** — stop; edit the `epic.md` draft in session scratch, then re-run with `/nxs.epic --resume`.

**Do NOT create any issue without an explicit `approve`** (an `AskUserQuestion` selection of
`approve`, or an "Other" answer that clearly means approve).

- `approve` → Phase 6.
- `revise` → stop. Leave the scratch draft intact for editing; report how to resume. Nothing is
  committed, so there is nothing to clean up.

## Phase 6 — File the epic and story issues (on approve)

Issue creation is **coupled**: the epic issue and its story sub-issues are created together in this
one step. There is no separate task command — the story is the implementation unit (0009), so each
story becomes one GitHub issue, child of the epic issue.

1. **Create (or reuse) the epic issue (idempotent).** If the scratch draft's frontmatter already
   carries `link` — the epic issue was filed in a prior run of this command — **reuse that number;
   do not create a second epic issue** (Success Metric / AC: a re-run reuses the recorded number).
   Otherwise:

    ```bash
    # intent mode — create a new epic issue
    python ./.claude/skills/nxs-gh-create-epic/scripts/nxs_gh_create_epic.py "${DRAFT_DIR}/epic.md"

    # promotion mode — populate the stub's OWN issue in place
    python ./.claude/skills/nxs-gh-create-epic/scripts/nxs_gh_create_epic.py "${DRAFT_DIR}/epic.md" \
        --promote <PROMOTE>
    ```

    **In promotion mode nothing is created and nothing is closed.** The epic body, the
    `nexus:epic-meta` block and the epic classification land on the issue the stub was filed under,
    and the unplanned label comes off — so the number the scope was deferred under is the number it
    ships and closes under, and every dependency edge and body mention written back then stays
    valid. The filer re-checks legality itself: a target that no longer carries the unplanned label
    is refused with nothing written.

    The skill reads `epic` (title) and `type` from frontmatter, **embeds the raw planning
    frontmatter onto the issue as a hidden `nexus:epic-meta` block** (so the resolver can rebuild the
    full `epic.md` field shape from the issue number alone), creates the issue, and writes
    `link: "#<n>"` back into the draft. Re-read the draft frontmatter; set `EPIC` = that number.
    Because the number is now recorded in the draft, re-running is safe — the epic issue is created
    at most once.

    It also applies the **needs-design** label from the epic's `complexity` rollup (#139): **M or
    larger** carries it, **S** does not, and an absent rollup errs toward carrying it. That label is
    the declarative gate — `/nxs.decision-record` files the decision record as a sub-issue for a labelled epic,
    and the downstream gates decide "should this epic have a record?" from the issue graph alone, so
    an epic filed by hand outside Nexus (no label, no record) is treated as an epic without a record
    rather than an error. The threshold is a stated default: **edit the label on the issue** to
    override it either way; nothing here is remembered off the issue.

2. **Sequence the stories.** Order by dependency: foundational first (core data / shared surface),
   then dependents, then polish. Assign each a ref `STORY-<EPIC>.<SEQ>` (`SEQ` zero-padded, in order)
   and record `blocked_by` as a list of story refs or `none`. Do **not** split or merge — sizing
   happened in Phase 3.

   The ref is an **authoring key with the lifetime of this batch**, not a name for the story: it exists
   only so a story can name a sibling before `gh issue create` has minted any issue numbers. It never
   survives filing on an issue, is never reported after filing, and is never re-derived downstream.

   Use it wherever a story must name a sibling — in `blocked_by` **and in body prose** (`extends
   STORY-<EPIC>.<SEQ>`). Step 4's pass 3 rewrites every prose ref to `#<issue>` once the numbers exist,
   so the ref never reaches a reader. Never hand-write a `#<n>` for a story in this batch: the number
   is not knowable at authoring time, and a guess points at an unrelated issue.

3. **Write transient story work-items** to the scratchpad, one `STORY-<EPIC>.<SEQ>.md` per story, with
   the frontmatter the creation skill consumes and the story body as the issue body:

    ```markdown
    ---
    ref: "STORY-<EPIC>.<SEQ>"          # internal authoring key — NOT shown on the issue
    title: "<Story Title>"             # clean title; no STORY-<EPIC>.<SEQ> prefix
    blocked_by: [STORY-<EPIC>.<SEQ>, ...] | none   # blocker refs (this batch)
    labels: [<label>, ...]      # from .nexus/config/issue-labels.yaml — applicable only
    parent: "#<EPIC>"
    project: "<org/repo from .nexus/config/config.* if present>"
    ---

    **As a** … **I want** … **so that** …

    ## Acceptance Criteria
    - [ ] …

    ## Notes
    …
    ```

    The body is the issue body verbatim — write it **unwrapped** (one line per paragraph, per AC
    bullet, per note), per "Line breaks" under the epic document structure.

    The `ref` is the stable planning-time key (the GitHub issue numbers don't exist yet, so the
    `blocked_by` graph is authored against refs). It stays internal: the issue **title is clean**,
    and the skill resolves refs → issue numbers itself. Read valid labels from
    `.nexus/config/issue-labels.yaml`; select only applicable ones per story.

4. **Create the story issues:**

    ```bash
    python ./.claude/skills/nxs-gh-create-story/scripts/create_gh_issues.py "<scratch-folder>"
    ```

    The skill runs three passes: pass 1 creates each issue (clean title), links it as a sub-issue of
    `#<EPIC>`, and adds it to the project, recording each `ref → issue` mapping; pass 2 wires the
    **native GitHub `blocked_by` dependencies** from each story's `blocked_by` refs; pass 3 rewrites
    every `STORY-<EPIC>.<SEQ>` left in a story **body** — and in the epic issue's own body — to the
    `#<issue>` it now resolves to, so no ref survives filing as dead text. A prose ref naming a story
    outside this batch fails the run closed; fix it in the source `STORY-*.md` and re-run.

    The skill is **resumable and idempotent**: it retries transient GitHub failures, records progress to
    a `.nxs-created.json` ledger in the folder, and ends with a SUMMARY. **If it prints
    `⚠️ INCOMPLETE`** (non-zero exit), do **not** hand-create the missing issues — re-run the exact same
    command. Already-created issues are skipped via the ledger (no duplicates) and only the remainder is
    filed. Discard the transient files only **after** a `✅ Complete` run — the stories live in `epic.md`;
    the issues are then the working surface.

5. **Do not persist the sequence to a committed file.** The authoritative dependency graph lives on
   the GitHub issues themselves (the native `blocked_by` edges wired in step 4). The resolver rebuilds
   the `## Implementation Sequence` table from those live edges on demand, so there is **no** queue
   `epic.md` to append it to and no separate index file. Keep the ordered sequence you computed in
   step 2 in memory only — surface it in the Phase 7 completion report:

    ```markdown
    | Issue | blocked_by |
    |---|---|
    | #<n> | none |
    | #<m> | #<n> |
    ```

    Report the sequence by **issue number** — the `STORY-<EPIC>.<SEQ>` refs died at step 4. They exist
    only to wire `blocked_by` inside a batch that has no issue numbers yet; once the issues are filed a
    story has exactly one name, and the ref is positional, so keeping it would hand every story a second
    name that silently shifts whenever the epic is re-scoped.

6. **Write the feature nav index.** Now that the issue exists, write `<feature-path>/README.md`
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

    Give it **no backlog section**. The feature a stub belongs to lives in the stub's issue body, so
    a per-feature backlog view would be a text search over issue bodies — brittle, and several links
    all meaning the same thing. The backlog is linked once, from `<docs-root>/features/README.md`.

7. **Add the new feature to the features index** when Phase 1 created the container. Append a row
   to the table in `<docs-root>/features/README.md` linking `<feature-path>/README.md` and its
   one-line capability statement. An existing feature needs nothing here.

A **promotion** needs no follow-up here: the stub issue *is* the epic issue now — Phase 6 populated
it in place and removed the unplanned label. Nothing was created and nothing was closed, so every
reference written when the scope was deferred still points at the right issue.

## Phase 7 — Report completion

Report:

- Feature name and folder.
- Epic title, complexity rating, and story count (with `story_type` breakdown).
- **In promotion mode**: that epic issue `#<n>` is the same issue the stub was filed under — no
  second issue was created, and the unplanned label was removed.
- **Nothing committed to `.nexus/queue/`** — the epic lives on GitHub issues; the queue entry is
  born at close. The `epic.md` draft stayed in session scratch.
- **If the creation scripts printed "Seeded github config … — review and commit"** (STORY-121.07
  write-back): a repo with no `github:` block had its resolved publishing decisions (classification
  mode, discovered project or `none`) persisted into `.nexus/config/settings.yml`. This is a
  **tracked config file**, distinct from the no-queue-commit planning contract above — tell the user
  to review that diff and commit it, so the fragile probe never runs again.
- Epic issue link and the created story issue numbers, plus the implementation sequence (the table
  from Phase 6 step 5) — or, if the user chose `revise`, that no issues were created and how to
  resume (`/nxs.epic --resume`).
- Next step: `/nxs.decision-record <epic-issue-#>` to produce the decision record for this epic (it resolves the
  epic from its issue number — no committed planning file).

---

## Epic document structure

### Line breaks — write every body unwrapped

**One line per paragraph, per bullet, per table row.** Put a newline only where a blank line or a new
list item is intended; never hard-wrap prose at a fixed column. A GitHub issue body reflows to the
reader's pane, so a newline mid-sentence is a break the reader actually sees — it renders as a ragged
column in a wide pane and throws away the width the pane offered.

This governs **every** body this command writes: the epic (below), the story bodies (Phase 6 step 3)
and the stub bodies (Phase 2b step 2). It is independent of how *this* file is wrapped — that is an
authoring convention for a repo `.md`, not the shape of the artifact being produced. The wrapping of
the `<…>` guidance in the templates below is likewise not a model for the prose that replaces it.

```markdown
---
feature: "<Feature Name>"
feature_path: <feature-path>   # the ACTUAL resolved container from Phase 1 — e.g. `docs/features/onboarding` in single-repo, `features/onboarding` on a repo-root hub. Never a fixed `docs/…` literal.
epic: "<Epic Title>"
slug: <epic-slug>
created: <YYYY-MM-DD>
type: enhancement
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

## Success Metrics

- <measurable, technology-agnostic criterion>

## Personas

<Deviations only. Personas are canonical in `<docs-root>/product/context.md` — the `<docs-root>` resolved in Phase 0, with the empty-prefix rule applied (so `product/context.md` on a repo-root hub, `docs/product/context.md` in a single-repo checkout). If this epic uses them as-is, write that resolved path: "Per `<docs-root>/product/context.md`." Tabulate only personas specific to this epic or deviations from the canonical set.>

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
- **No Business Value section** — it is speculative generation (nobody specifies it upfront). The WHY lives in `## Description`; the measurable outcomes live in `## Success Metrics`.
- **Personas are deviations-only** — the canonical set is `<docs-root>/product/context.md`.
- **`### Story 1:` numbering is a pre-filing artifact of this draft**, which exists before any issue
  is created and so has no issue numbers to use. It is not the shape of a materialized epic: once the
  issues exist, the resolver identifies each story as `### Story #<issue>:` and the sequence table
  keys on `#<issue>`. Nothing downstream ever refers to a filed story by position.

---

## Guidelines

### Focus

- **WHAT** users need and **WHY** (value). Avoid **HOW** (no stack, APIs, code structure).
- Each story is a conversation starter, not a complete spec. Each AC must be verifiable.
- Stay consistent with `<docs-root>/product/context.md` terminology and personas.

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

Issues are **durable**; the queue (`.nexus/queue/…`, a close-time drain buffer) is **ephemeral** —
the distiller drains it post-merge. So an issue body (and the feature nav index) must **never** link to a queue file
(`epic.md`, `decision-record.md`, `close-record.md`); such a link dangles once the entry is drained.
Link only durable targets: other issues, concept pages (`.nexus/concepts/`), anchors
(`.nexus/anchors/`), and persistent `docs/`. The direction is docs → issues, never issue → queue.

Any durable `.md` link placed in an issue body should be an absolute GitHub URL so it resolves from
the issue. Convert repo-relative paths with the `nxs-abs-doc-path` skill:

```bash
tsx ./.claude/skills/nxs-abs-doc-path/scripts/get_abs_doc_path.ts "<feature-path>/README.md"
```
