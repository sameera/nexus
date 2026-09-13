---
name: nxs.epic
description: Turn a natural-language capability description into a right-sized epic with user stories and acceptance criteria, then — on approval at a decision-grade digest — file the epic and one GitHub issue per story together. Takes intent directly — no feature brief required. Oversized scope decomposes to epic stub issues, each promoted later by its own issue number.
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
  carries the unplanned label, i.e. while it is an epic stub, or
- **`--from #<issue>`** — pull an epic that is **already filed** as GitHub issues (by Nexus or by
  hand) into a materialized `epic.md`, so downstream stages can run against an epic not planned in
  this session. This is a read-only wrapper over the resolver — it plans nothing and commits nothing
  (handled up front in Phase 0; the planning phases below do not run), or
- **`--discovery <folder>`** — **consume a finished discovery** produced by `/nxs.discover`. The
  discovery doc is the intent. This is the one path by which a discovery becomes GitHub issues:
  `/nxs.discover` writes nothing to GitHub, so graduation happens here, through the emission path
  this command already owns.

Any planning mode — intent, promotion or discovery — may also carry **`--assets <path>[,<path>…]`**:
local files (a diagram, a screen mockup, a sketch) the filed issues should carry. The flag is
repeatable and its value comma-separated; strip every `--assets` token and its value before reading
the rest of `$ARGUMENTS`, and keep the paths **exactly as written** — they are the tokens the draft
carries and the filing step matches. Load the **`nxs-assets`** skill before handling it. `--assets`
is meaningless with `--from` (a pull drafts nothing) and is refused there.

The flag selects the operation; it is never inferred from the shape of the argument. A bare number
always means "plan this epic"; `--from` always means "load this already-planned epic";
`--discovery` always means "consume this finished discovery". **Any other input is a capability
description** — there is no slug lookup, because a stub's issue number is its only identifier.

Empty input is an error: ask the user for a capability description (or a stub's issue number) and stop.

# What this command does (read once)

- **No feature brief precondition.** It takes intent directly. The feature container is an _output_: if one is not already in context, infer a name, confirm it once, and scaffold it. No human pre-authors a brief before planning.
- **Nothing is committed at planning — GitHub issues are the source of truth (#114).** The epic is drafted only to **session scratch**; the epic gate runs on that draft; and at approval the epic and its story issues are **filed**, committing **nothing** to `.nexus/queue/`. The queue entry is no longer born here — it is born at close (`/nxs.close`), so the queue holds only closed, drainable entries. Every later stage reconstructs the epic from its issue number via the resolver (`nxs-epic-resolve`), not from a committed planning file. The feature folder under `<docs-root>/features/<name>/` (the docs root resolved in Phase 0) still holds the durable nav index. It holds no backlog file: deferred scope is an open issue carrying the unplanned label (#185), so the feature tree carries no re-triage queue at all.
- **Underspecified scope is referred to discovery, not answered with stubs.** The right-size phase
  tests sharpness before it measures size. An intent whose functional goals cannot be stated stops
  there and recommends `/nxs.discover`, with an explicit override. Big-but-clear is a different
  problem and keeps the decomposition path below.
- **Oversized scope decomposes to stubs.** The right-sizing gate is kept. A `> M` scope, with consent, files one **stub issue** per functional goal — an epic identified but not yet planned, carrying the epic classification plus the unplanned label; the full epic for each is deferred to a later `/nxs.epic <issue-number>` promotion.
- **A finished discovery graduates here.** `/nxs.discover` resolves decisions and writes nothing to
  GitHub; `--discovery <folder>` turns those resolved decisions into issues through the very same
  emission path everything else uses. That is what makes "a discovery-produced stub is accepted
  unchanged by promotion" true by construction rather than by a third copy of the stub contract.
- **A stub is an epic issue, so every epic query filters it out.** The whole cross-feature backlog is one query — open issues carrying the unplanned label — and its exclusion is one negated filter. Any query here or downstream that enumerates epics for **planned** work carries that negation; ask for it (`nexus config backlog-query --form exclude`) rather than writing the label by hand. This is the accepted price of a stub keeping its issue number through promotion.

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

## Prose convention — human-facing artifacts

Before drafting any human-facing artifact, load the **`nxs-prose-style`** skill. It holds the six
form rules, and where a restatement here disagrees with that file, that file governs. Two content
rules are yours and are not in it. Write concrete, not abstract: "there are two copies of the
record; one can go stale", never "state duplication risks divergence". Add nothing: every sentence
carries a fact, a decision or a consequence. Draft plainly the first time. There is no translation
pass, no pre-translation copy and no verify step on an artifact this command authored. File the
drafted file verbatim.

## Scope convention — the razor

Before drafting anything, load the **`nxs-razor`** skill. It is the one normative statement of the
provenance rule, and this command restates none of it — where a phrase below and the skill disagree,
the skill governs and `nexus razor-check` enforces the skill's numbers.

Two obligations land in this command's phases:

- **Phase 4 materializes the run's source text** to `${DRAFT_DIR}/source.md` before any item is
  labelled, and every citation check in the run compares against that file.
- **Phase 6 files from a derived body**, not from the labelled draft. Provenance labels are for the
  gate and the digest; a durable reader is never asked to read planning bookkeeping.

Run the phases in order.

## Phase 0 — Resolve entry mode

**`--from #<issue>` short-circuit (handle first, before anything else).** If `$ARGUMENTS` contains
`--from` (string-matched, like `--resume`) followed by an issue reference (`#<n>` or `<n>`), this is
a **pull**, not a plan. Do not draft, do not run the right-size gate, do not file anything:

1. Run the resolver with the epic-vs-story guard on:

    ```bash
    nexus epic-resolve --epic <n> --require-epic
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
nexus workspace docs-root
```

- It prints one line — capture it as **`<docs-root>`**: `docs` for a single-repo checkout or a
  member, `.` for a hub whose docs root is the repo root, or the hub's configured override.
- **On a non-zero exit** it printed a resolver diagnostic to stderr. **Stop and report it.** Never
  fall back to a literal `docs/` — a resolution failure is not "no feature yet".
- **Building a path under `<docs-root>` (empty-prefix rule):** if `<docs-root>` is `.`, the taxonomy
  hangs directly off the repo root (`features/<slug>/…`); otherwise prefix it
  (`<docs-root>/features/<slug>/…`). Never emit a `./`-prefixed path or a segment named `.`.

**Assets intake (when `--assets` was passed — before anything is drafted).** Run the one intake
step, naming every declared path exactly as the lead wrote it:

```bash
nexus assets check --asset <path> [--asset <path> ...]
```

- **Non-zero exit → stop before drafting and report the diagnostic verbatim.** It names a missing
  path (`missing-asset`), two assets sharing a file name (`duplicate-filename`), a malformed
  `asset-store` value (`malformed-store`), or a store GitHub cannot read (`store-unreadable`).
  Nothing has been drafted and nothing has been published.
- **`{ "state": "unsupported", … }`** → this repository declares no asset store. Say so once on the
  console — *assets are unsupported for this repository: no asset-store is declared* — and set
  `ASSETS = none`. The run then continues **exactly as it would without the flag**: the draft is
  written with no asset references and the issues are filed without them, with the same bodies this
  command filed before assets existed. Never refer to the files in a body, and never write them
  anywhere else instead.
- **`{ "state": "declared", repo, branch, visibility, assets }`** → record `ASSETS` (the declared
  paths, in the order given), `ASSET_STORE` (`repo`, plus `@branch` when one is set) and
  `ASSET_VISIBILITY` (`public` | `private`). The visibility is read here **once** and feeds the
  Phase 5 digest only; it never selects how an asset is referenced.

The check reads; it writes nothing to the store. Nothing is published before the Phase 5 gate.

1. **Resume check.** Look in your **session scratch** for a pending epic draft — a working folder
   (e.g. `nxs-epic-<slug>/epic.md`) written by a prior run of this command whose frontmatter has
   **no `link`** (an epic drafted but not yet filed as issues). If one exists, report it and ask
   whether to **resume** its approval gate or start a new epic. Resume → load that draft, **recover
   its asset state** (below), and skip to Phase 5. If `$ARGUMENTS` is `--resume` and exactly one
   pending draft exists, resume it without asking. Otherwise continue. (There is no committed queue
   entry to resume — nothing is committed at planning; a draft abandoned mid-session is simply never
   filed, and needs no cleanup.)

   **Recovering asset state on resume.** `ASSETS`, `ASSET_STORE` and `ASSET_VISIBILITY` live in the
   context of the run that drafted; a resumed run has none of them, and Phase 6 runs the rewrite and
   the `--asset-path` assertion only when `ASSETS` is set — so a resume that skipped this step would
   file the draft's local paths into the issues. Look for `assets.json` in the draft's folder — the
   intake result Phase 4 stores beside `epic.md`:
   - **Present** → re-run the intake step with the `path` of every entry in its `assets` list, in
     order — `nexus assets check --asset <path> [--asset <path> ...]` — and handle its result exactly
     as the assets intake above does: a non-zero exit stops the run and reports the diagnostic (a
     file moved since the draft was written is a `missing-asset`), `unsupported` sets `ASSETS = none`,
     `declared` sets the three values. The store is read again; nothing is published.
   - **Absent** → the run that drafted was not passed `--assets`. Set `ASSETS = none`.
   Never derive the declared list from the draft's prose: the intake file is the record of what the
   lead declared, and the assertion in Phase 6 must fail on exactly those paths.
2. If `$ARGUMENTS` is empty (and not resuming) → ERROR. Ask for a capability description or a stub's issue number. Stop.
3. Decide **promotion** vs **intent**. The rule is purely syntactic, then checked against issue state:
    - `$ARGUMENTS` is a **single bare integer**, optionally `#`-prefixed, and no `--from` was passed → **promotion mode**. Resolution reads issue state only and never globs the docs tree:

        ```bash
        gh issue view <n> --json number,title,body,labels,state
        nexus config resolve unplanned-label
        ```

      The issue must exist, be **open**, and carry the resolved unplanned label. If it does not — closed, no such issue, or already planned — report **why** it is not promotable, name `--from #<n>` as the way to load an already-planned epic instead, and **file nothing**. Otherwise seed Phase 3 from the stub's body: the functional goal, the estimate, and the candidate story-group titles. Read `feature`/`feature_path` from the body's meta block. Skip the right-sizing gate — the stub was already sized ≤ M when it was decomposed. Record `PROMOTE = <n>`.

      **Promotion is unchanged by discovery.** A stub filed from a discovery is promoted with no
      manual edit: its body carries the decision gists in a `## Decisions this goal hangs on`
      section, which seeds Phase 3 like the rest of the body and is then rewritten with it.
      Promotion **neither reads nor moves** the marked gist comment — that comment is the copy that
      survives the rewrite, and `/nxs.decision-record` is what consumes it later.
    - `$ARGUMENTS` contains **`--discovery <folder>`** (string-matched, like `--from`) → **discovery
      mode**. Record `DISCOVERY = <folder>` and resolve it as follows:

        1. Read `<folder>/discovery.md`. If it does not exist, ERROR — that is not a discovery
           folder. If its `status` is `closed`, ERROR: a discovery closed with no build has nothing
           to graduate.
        2. **Precondition — the discovery is finished.** Every `ticket-*.md` in the folder must have
           `status: resolved`, and `## Not yet specified` must be empty. If either fails, stop and
           report what is still open **by title**, pointing at `/nxs.discover --resume <folder>`.
           File nothing.
        3. The discovery doc is the **intent**: its destination and its resolved-decisions index are
           the capability description this run sizes. Read every ticket file too — the full
           reasoning lives there, and it is copied onto what gets filed.
        4. Read `feature` / `feature_path` from the discovery doc's frontmatter. That is the
           **default** feature for everything filed from this discovery, overridable per stub in
           Phase 2b.
        5. **Skip the sharpness precondition** of the right-size phase — discovery is the thing that
           precondition refers people to, so firing it here would deadlock the work discovery itself
           produced. Then run the Phase 2 right-size gate **unchanged**.
    - **Anything else** → **intent mode**. The text is the capability description. A word that looks like a slug is intent, not a lookup key.

**When a promoted stub proves oversized.** If Phase 3's rollup shows the stub cannot become a single epic, run the Phase 2 gate after all and emit fresh stub issues (Phase 2b) — then close the original **as not planned** with a comment naming its successors. Never close it as completed: nothing was delivered.

```bash
gh issue comment <n> --body "Larger than one epic on planning. Re-decomposed into #<a>, #<b>, #<c>."
gh issue close <n> --reason "not planned"
```

## Phase 1 — Resolve the feature container

The container must exist before writing: the feature nav index (written at filing, Phase 6) links the epic issue from it (0006 §4). The draft records the feature it belongs to in its `feature`/`feature_path` frontmatter — carried onto the epic issue's meta block at filing, so the resolver recovers it.

1. **Promotion mode** → already resolved: the `feature_path` recorded in the stub issue's meta block. Create the directory if it does not exist (a stub writes nothing to the tree, so a feature whose first epic is a promotion has no container yet). Continue.
2. **Discovery mode** → already resolved: the `feature_path` recorded in the discovery doc, confirmed
   once when the discovery was started. Create the directory if it does not exist. A per-stub override
   is offered in Phase 2b; nothing is re-confirmed here.
3. **Intent already inside a feature** → if the user referenced a `<docs-root>/features/<name>/` path or has a file open under one, use that feature.
4. **Otherwise infer and confirm once**:
    - Derive a feature **name** (Title Case) and **slug** (kebab-case) from the intent.
    - Let **`<feature-path>`** be the resolved container: `<docs-root>/features/<slug>` (empty-prefix rule: `features/<slug>` on a repo-root hub). This exact string is what you record in `feature_path` and derive `README.md` from.
    - Present a single confirmation: _"I'll plan this under feature **<Name>** (`<feature-path>/`). Accept, or give a different name?"_ — one prompt, cheap. Accept the user's correction if any.
    - Ensure the directory exists (`mkdir -p <feature-path>`) — the draft's `feature_path` needs it. **Do not write `README.md` here.** The feature nav index is written only once the epic is filed as a GitHub issue (Phase 6), so it links directly to the issue rather than a draft that must be updated later. Record the feature **name** and a **one-line capability statement** for that later write.

## Phase 2 — Right-size gate (MANDATORY STOP) — skip in promotion mode

Before generating any epic content, assess the scope yourself using the rubric below. This is a
judgment step — read `<docs-root>/product/context.md` and `<docs-root>/system/stack.md` (the
`<docs-root>` resolved in Phase 0) if present to calibrate against existing patterns.

### Sharpness precondition — is this intent underspecified? (intent mode only)

**This runs before sizing**, because sizing an intent nobody can state is a guess dressed as a
measurement. It distinguishes two different problems that the size rubric alone cannot tell apart:

- **Oversized** — big but clear. The split is knowable now. The L/XL/XXL path below handles it.
- **Underspecified** — foggy. The split itself hangs on decisions nobody has made, so pre-slicing it
  into work-shaped stubs is speculative over-generation.

**The test is the stub shape itself.** Attempt the decomposition below and ask: can **each**
functional goal be stated as a one-line goal, with an S or M estimate, and with candidate story
titles? If decomposition cannot produce that shape, the intent is **underspecified**, not merely
oversized. The test adds no new machinery, because that shape is already the output the decomposition
step must produce.

**When does this fire.** Intent mode only. In **promotion mode** and **discovery mode** the gate does
**not** fire: a promoted stub was already discovered, and a consumed discovery is the output of the
very thing this gate refers people to, so firing there would deadlock the work discovery itself
produced. It lives inside this phase rather than as a phase of its own precisely so it inherits that
skip rule instead of needing its own exemption.

**If the goals are sharp** — every one of them — this precondition adds **no interaction at all**.
Say nothing about it and continue to the sizing rubric below. A sharp, right-sized intent must see
exactly the run it sees today.

**Sharpness gate (MANDATORY STOP).** If they are not, stop before sizing. Render the assessment, then
ask via `AskUserQuestion`:

```markdown
## ⚠️ Underspecified — the split isn't knowable yet

This intent cannot be decomposed into stated goals. What is missing is not size, it is decisions:

| Functional goal (attempted) | What blocks stating it |
|---|---|
| … | … |

Nexus answers this with discovery, not with stubs. `/nxs.discover` resolves the open decisions one
at a time and ends when every goal is sharp enough to file — then `/nxs.epic --discovery` files them.

**Options** (asked via `AskUserQuestion` — see the interaction convention):

| Option | Action |
|--------|--------|
| **discover** | (recommended) Stop here and run `/nxs.discover <intent>`. Nothing is filed. |
| **override** | Size and plan this intent anyway, on the existing path below. |
```

- **discover** → stop. **File nothing.** Report the command to run.
- **override** → continue to the sizing rubric below, unchanged.

**Nothing is filed before the lead chooses.** The override exists because the sharpness call is a
judgement the lead owns: a hard refusal would make a false positive unrecoverable, leaving the lead
to reword the intent until the model relented.

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
    nexus config resolve epic-label
    nexus config resolve epic-type
    nexus config resolve unplanned-label
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

    ## Decisions this goal hangs on      <!-- discovery mode ONLY — omit this heading entirely otherwise -->

    <one gist per decision — see step 3 below>
    ```

    Each stub must be ≤ M. If the decomposer returns a sub-goal still > M, record `estimate: M` and
    say so in the goal line — it is re-decomposed when promoted. Write the goal line and every Meta
    value **unwrapped** — one line each, per "Line breaks" under the epic document structure.

    In **discovery mode** the `feature` value defaults to the one recorded in the discovery doc; ask
    for a per-stub override only where a goal plainly belongs to a different feature. The `source`
    line reads `discovery of "<destination>" (<YYYY-MM-DD>)` instead of `decomposition of …`, and
    it names the destination — **never a path into the discovery folder**, which is removed once the
    discovery ends.

3. **Copy the decision gists onto each stub (discovery mode only).** Each stub carries the resolved
    decisions **that goal hangs on**, in **full gist form** — the decision **plus its reasoning**,
    copied from the ticket files, not the one-line index entry:

    ```markdown
    ### <Ticket title>

    - **Decided:** <the decision>
    - **Why:** <the reasoning, copied from the ticket's resolution>
    - **Refuted alternative:** <the option not taken, and why it lost — omit the line if none>
    ```

    Each gist **names its originating ticket by title only**. Nothing durable may carry a path into
    the discovery folder, because the folder is removed once the discovery ends and the link would
    break at exactly the moment a reader needs it. A decision that more than one goal hangs on is
    copied onto each of them in full; a reference to another stub is not sufficient.

    Hold this text as `GIST_BODY_<NN>` — step 5 writes **the same text**, unedited, a second time as
    a comment.

4. **File the batch** through the shared filer, classified as an **epic** rather than a story:

    ```bash
    nexus create-story "<scratch-folder>" \
        --classification-label "<epic-label>" \
        --classification-type "<epic-type>"
    ```

    The filer upserts every label it will apply **before** creating anything, so a repository that
    has never seen the unplanned label still files cleanly; if a label can be neither created nor
    found it reports the gap and creates nothing (grant the token label scope, then re-run). Pass 2
    wires the native `blocked_by` edges between the stubs. With `github.project: none` no project is
    touched. The run is resumable and idempotent — on `⚠️ INCOMPLETE`, re-run the exact same command.

    Discard the transient files only after a `✅ Complete` run.

5. **Post the marked gist comment (discovery mode only).** This is the **one** addition the discovery
   entry mode makes to the emission path above — that path files issues and writes no comments.
   For each stub, write `GIST_BODY_<NN>` — **the same text already in the body, unedited** — to a
   scratch file under the marker, and post it:

    ```markdown
    ## Decisions this goal hangs on

    <GIST_BODY_NN — byte-identical to the copy in the stub body>

    <!-- nexus:discovery-gists -->
    ```

    ```bash
    gh issue comment <stub-issue> --body-file "<scratch>/gist-<NN>.md"
    ```

    The gist is written twice because the two copies do different jobs. The **body** copy is the one
    promotion consumes, because promotion seeds its draft from the stub's body. The **comment** copy
    is the one that **survives**, because promotion rewrites that body wholesale — anything left only
    in the body is destroyed at exactly the moment the reasoning matters most. The duplication cannot
    drift, because **neither copy is ever edited again**. The hidden marker is what turns the
    surviving copy from an archive into an input: `/nxs.decision-record` finds it by that marker when
    it later designs the promoted epic.

Then **stop**. Report the created issue numbers with their goals, and tell the user to promote one
with `/nxs.epic <issue-number>`. Do **not** create a queue entry, a feature `README.md`, or a full
epic issue this run.

**In discovery mode**, also report that `<DISCOVERY>` has been **consumed** and can now be removed,
and that removing it is a plain commit the user makes — this command does not delete the folder and
**commits nothing**, which is its contract on every path. Name the folder in the report only; never
write it into an issue body or a comment.

Close the report with the **cross-feature backlog query** — the whole backlog, this batch included,
in one query. Ask for it rather than spelling the label out:

```bash
nexus config backlog-query
```

## Phase 3 — Generate the epic

1. Read `<docs-root>/product/context.md` if present — personas and strategy are canonical there. **Reference** them; do not re-tabulate.
2. Parse the capability description (in promotion mode, the stub's goal + candidate story titles; in
   discovery mode, the discovery doc's destination plus the resolved decisions in full — the epic is
   built **on top of** those decisions, not by re-deriving them):
    - Extract actors, goals, actions, data, constraints, business value.
    - Decompose into **3–8 user stories**, each independently deliverable (INVEST).
    - **Size each story `S` or `M`** (story-scale rubric) and **split any story that would exceed M**
      into ≤ M stories before finalizing — the story is the implementation unit (0009), so an
      oversized story is split here, not filed. Record each story's `size`.
    - **Order the stories while you draft them** (nxs-razor §10). Write the epic's `## Implementation
      Order` block: one row per story, naming the stories it waits on by title, or `none`. Ordering
      is not assigned after approval — the gate shows the reviewer what each story waits on, and the
      closure check needs the graph before anything is filed. Generate both the rows and the
      necessity line below from the story headings; never re-type a title.
    - **Answer the necessity question** (nxs-razor §7): which of these stories does the smallest
      usable version of this capability need? Write the answer as the epic's `## Smallest Usable
      Version` line. It is scope reasoning a later reader consumes, so it is one of the few razor
      outputs that reaches the filed body. It is also **checked, not asserted** (nxs-razor §11): the
      set you name must be closed under the ordering block's blockers, so name a story's blockers
      alongside it or leave that story out.
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

**Store the assets intake result beside the draft** (when `--assets` was passed): write the JSON the
intake step printed — `declared` or `unsupported`, with its `assets` list — verbatim to
`${DRAFT_DIR}/assets.json`. It is what a resumed run (Phase 0 step 1) recovers `ASSETS`,
`ASSET_STORE` and `ASSET_VISIBILITY` from after a `revise`. It is session scratch like the draft:
it is never copied into `epic.filing.md` and never reaches an issue. **Do not put the declared paths
in the draft's frontmatter** — the frontmatter is embedded onto the epic issue as its meta block,
and the Phase 6 assertion scans every line of the filing body, frontmatter included.

**Materialize the run's source text first.** Write, verbatim, into `${DRAFT_DIR}/source.md`: the
capability description the lead typed (intent mode), the stub issue's body (promotion mode), or the
discovery document plus every resolved ticket (discovery mode). Write it before labelling anything —
the labels cite it, and the gate has no other way to see what the lead actually asked for. It is
session scratch and stays there: no part of it is posted to an issue, a comment or a report.

**Then label every story heading, every acceptance criterion, every assumption and every
out-of-scope item** inline, `[asked: "…"]` with a fragment quoted from `source.md`, or `[inferred]`.
The vocabulary is the skill's and has two values. **Label every story heading** — a story's own label
is what decides whether the approval gate files it by default, so it is a claim the reviewer has to
see and be able to reject, not a rendering hint.

**Refer to each asset by its local path, exactly as declared** (when `ASSETS` is set). Put the
reference in the section it illustrates — a story's `### Story` section for that story's diagram,
an epic-level section for an epic-level one — as a Markdown image or link whose target is the
declared path: `![the filing flow](assets/flow.png)`, `[the mockup](assets/mock.html)`. Write the
path verbatim; the Phase 6 rewrite matches it exactly. **Nothing is published while drafting.** The
reviewer approves a draft that names files on the lead's machine, so a revise at the gate costs
nothing and leaves the store unchanged. A declared asset the draft never mentions is not published
either — it is reported at filing and skipped, because the store is never pruned.

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
Source text: ${DRAFT_DIR}/source.md
```

The gate runs the razor's checker (`nexus razor-check`) against that pair. It reports; it edits
nothing and creates nothing. **A blocking razor finding is a high finding: do not render the Phase 5
digest.** Fix `${DRAFT_DIR}/epic.md` — cut the item, restate the citation, add the story's stated
reason, or repair the ordering block or the necessity line — and re-run the gate until it is clean. A
draft that breaks a counted limit, or that names a smallest usable version which cannot run,
**never reaches the reviewer**.

The closure finding (nxs-razor §11) is the one to read carefully: it names the draft, the story in
the smallest usable version, and the excluded story that story waits on. Either pull the blocker into
the `## Smallest Usable Version` line or drop the story that needs it — the answer is scope
reasoning, so it is yours and the lead's, not the checker's.

The gate's **mechanism observations** are the one razor finding that does not block. Carry each into
the Phase 5 digest verbatim, as an observation beside the story it belongs to, and let the reviewer
decide.

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

<when ASSETS is set — the store line, informed consent to publish there:>
**Assets:** <n> file(s) → `<ASSET_STORE>` (<public | private>) — <file names, comma-separated>
<when ASSET_VISIBILITY is public and the issues repository is private (`nexus config resolve
issues-repo`, or the current repository when it resolves to nothing):>
⚠️ The store is public and the issues repository is private: these files will be world-readable while the issues are not.
<when ASSET_VISIBILITY is private and the issues repository is public:>
Note: the store is private, so a reader outside the team sees a broken image where a member sees the diagram.

<everything in epic.md between the H1 title and `## User Stories` — Description, Success Metrics,
Personas — verbatim (condense only obvious redundancy).>

### Stories

- **<Story 1 Title>** (<size>) — <one-line summary of the story's goal> · waits on: none
- **<Story 2 Title>** (<size>) — <one-line summary> · waits on: <Story 1 Title>
- …

Each story's `waits on` is read from the draft's `## Implementation Order` block (nxs-razor §10) —
the reviewer decides with the graph in view, and the block they see is the one filing uses.

<everything in epic.md after the User Stories section — Assumptions, Out of Scope. If the user chose
**answer**, `## Open Questions` is empty and omitted. If they chose **proceed**, render the remaining
`[NEEDS CLARIFICATION]` items here under a `### ⚠️ Unresolved questions (shipping anyway)` callout so
the approval is made with them in view.>
```

**Then render the offer list** (nxs-razor §8), directly under the digest and before the choice. The
default here is **addition**: a plain approval files the smallest usable version and nothing else, so
scope the lead never asked for takes an act of will to acquire rather than an act of vigilance to
avoid.

**Take the additions and their numbering from the checker, not by hand:**

```bash
nexus razor-offer --draft "${DRAFT_DIR}/epic.md"
```

It prints every story the `## Smallest Usable Version` line excludes — asked-for first, then
model-added, each group in the order the `## Implementation Order` block unlocks it — with the stable
number and the blockers each carries. Transcribe those numbers; the removals below continue the same
sequence from the last one it printed.

```markdown
### What a plain approval files

**Smallest usable version** — <the stories the `## Smallest Usable Version` line names>

- **<Story Title>** (<size>) · waits on: <…> — <one line: what it adds>

### Additions — taken only if you name them

*Asked for*

1. **<Story Title>** (<size>) · waits on: <Story Title> — <one line> · you asked: "<the story's asked fragment, verbatim>"

*Added by the drafting model*

2. **<Story Title>** (<size>) · waits on: <…> — <one line>

### Removals — applied unless you name them

**<A story in the filed set>**

3. <an inferred acceptance criterion, verbatim minus its label>

**Epic-level**

4. <an inferred assumption>
5. <an inferred out-of-scope item>
```

**Only the two acted-on groups are numbered.** *Additions* and *Removals* share one stably numbered
list, and **one typed selection covers both directions**: a number in *Additions* adds that story, a
number in *Removals* deletes that item. What a plain approval files is rendered as plain bullets and
carries no numbers at all — it is what the reviewer gets by typing nothing, so a number against it
would name an action the selection has no meaning for.

The offer list holds **every story the `## Smallest Usable Version` line excludes**. The stories the
lead asked for sort **first** and are rendered **asked-for**, each carrying its story-level asked
fragment verbatim beside it — the fragment is a claim the drafting model made about the lead's own
words, and this is the one place the reviewer can reject it. Within each group the order follows the
`## Implementation Order` block — **what each item unlocks, never a ranking by value**. Ranking the
additions by usefulness would have the drafting model scoring its own additions, which the razor
forbids elsewhere for the same reason.

**The inversion is at story granularity only.** A model-added acceptance criterion, assumption or
out-of-scope item on a story that *is* being filed stays opt-out and is listed under *Removals*: a
story can stand alone, a criterion about a story already being filed cannot, and making criteria
opt-in would let an asked-for story file with no criteria at all.

If the gate reported a mechanism observation, show it beside its story here — it is not an addition
and not a removal, it is a thing to look at.

Then ask for the decision via **`AskUserQuestion`** (per the interaction convention) — do not
emit a free-text prompt line. Three options:

- **approve** — file the smallest usable version, and nothing else. Adds nothing; applies every
  listed removal.
- **approve with changes** — the same, after adding the stories the reviewer names and keeping the
  removals they name back.
- **revise** — stop; edit the `epic.md` draft in session scratch, then re-run with `/nxs.epic --resume`.

**Do NOT create any issue without an explicit approval** (an `AskUserQuestion` selection of one of
the two approve options, or an "Other" answer that clearly means approve). The store line is part
of what is approved: a public store under a private issues repository is a **warning the lead
decides on**, never a refusal — the team chose the store deliberately, and a refusal would block
an open-source project with a private planning repository.

- `approve` → apply the step below with the filed set equal to the smallest usable version.
- `approve with changes` → take the numbers (typed as a list, e.g. `2, 4`), apply the step below,
  then Phase 6. **An empty selection is identical to a plain approval**: the smallest usable version,
  no re-render and no second confirmation.
- `revise` → stop. Leave the scratch draft intact for editing; report how to resume. Nothing is
  committed, so there is nothing to clean up — and **nothing has been published to the store**:
  assets are published only in Phase 6, after approval, so a revise leaves the store unchanged.
  Leave `${DRAFT_DIR}/assets.json` beside the draft: the resumed run recovers the declared assets
  from it, so the rewrite and the `--asset-path` assertion run on the resumed filing too.

**Scope the reviewer does not take is treated by where it came from.** A model-added story nobody
took is discarded and leaves no trace anywhere — no issue, no note, no later triage. An **asked-for**
story nobody took is **deferred, not dropped**: Phase 6 step 8 files it as one epic stub the lead can
plan later under this same gate, so deferring costs them nothing and forgets nothing.

### Applying the approved set (before any issue is created)

The **filed set** is the smallest usable version plus the additions the reviewer named. Everything
here is an edit to `${DRAFT_DIR}/epic.md`, made **before** Phase 6 derives the filing body — nothing
is added or removed after something is filed.

1. **Refuse a selection naming already-filed content.** If a prior partial run filed the epic or a
   story (the draft's frontmatter carries `link`, or a story carries an issue number), a number
   naming it is **refused with the reason stated** — never silently applied. Report which numbers
   were refused and what remains.
2. **Refuse an empty filed set.** At least one story is always filed; a selection that would file
   none is a revise, not an approval. Say so and return to the choice.
3. **Re-check closure over the filed set — before any edit, over the graph as drafted.**

    ```bash
    nexus razor-check --draft "${DRAFT_DIR}/epic.md" --filed "<Story Title>; <Story Title>; …"
    ```

    This is the apply-time arm of nxs-razor §11, and **its position is the whole of it**. It reads the
    `## Implementation Order` block as the drafter wrote it, so an addition whose blocker the reviewer
    did not also take is a story waiting on a story outside the filed set, and the check blocks. Edit
    the graph first — delete a dropped story's row, or re-parent its dependents onto its own blockers
    — and every filed set is closed by construction: the edge the rule exists to catch is the edge
    that was rewritten, and the arm can never fire in the direction the addition convention added it
    for.

    A non-zero exit **returns to the choice** with the pair it named. The reviewer either takes the
    blocker too or drops the addition; **nothing is re-parented on their behalf**, because "exactly
    the named items join the filed set" and a set silently re-wired to run is a set they did not
    approve. Nothing has been edited at this point, so there is nothing to undo.

4. **Apply the selection.** Delete the `### Story` section of every story outside the filed set, and
   delete the lines of every listed removal the reviewer did not name back. Delete each dropped
   story's row from the `## Implementation Order` block too, so the block describes the filed set.
   No surviving story waits on a deleted one — step 3 refused the set otherwise — so **no cascade
   follows and no edge is re-parented**.
5. **Re-derive what the story set determined — one step, in one place.** Run it whenever the filed
   story set **differs from the drafted one, in either direction**: an addition and a removal both
   change the set, and all three of these are properties of the set rather than of one direction of
   travel. Skip it only when the two sets are identical.

    - the epic `complexity` rollup, re-derived **from the filed story set** by the Phase 3 step-4
      rule — never from the draft as it was first written. **Step 6's `--filed` run checks this one
      mechanically**: the rollup may not sit below the largest size in the filed set, and it may not
      sit above it with `complexity_drivers` stating nothing that raises it. How far cross-story
      integration raises it is still the judgment — the check is that the judgment was made over the
      stories actually filed, and is stated;
    - the **needs-design** label that follows from that new value in Phase 6. A change that drops the
      epic below the threshold must drop the label, and **additions that carry the epic past it must
      gain the label** — or the epic filed demands a record it does not warrant, or omits one it does.
      The label is not re-derived by hand either: it follows from the checked rollup by the one
      threshold Phase 6 step 1 states, and the `--filed` report names the warrant it implies;
    - any utilization-risk or scope banner in the epic body quoting the pre-change assessment —
      **re-derived, or removed**, so any warning the epic still carries **describes the story set that
      was actually filed**. A stale banner asserts a sizing the epic no longer has, to every future
      reader of the issue.

6. **Re-run the checker and the gate on the edited draft**, then continue to Phase 6:

    ```bash
    nexus razor-check --draft "${DRAFT_DIR}/epic.md" --filed "<the same filed titles>"
    ```

    The same command, now over the edited draft: closure again — cheap, and it catches an edit that
    went wrong — and the arm that reads the re-derived rollup, so a `complexity` or a
    `complexity_drivers` step 5 left describing stories nobody filed blocks here rather than reaching
    an issue. Then **re-run the gate** (Phase 4b). A set the reviewer assembled at the gate has been
    checked by nothing until both have run.

## Phase 6 — File the epic and story issues (on approve)

**Derive the filing body first (before step 1).** The draft carries provenance labels and the
drafting-time ordering block; the issues must not. **The checker derives it and asserts it in one
step** — hand-stripping a label out of a dozen headings is exactly the clerical pass a model drops
one line of:

```bash
nexus razor-check --draft "${DRAFT_DIR}/epic.md" --derive "${DRAFT_DIR}/epic.filing.md"
```

It writes `epic.filing.md` with every `[asked: "…"]` and `[inferred]` label removed and the whole
`## Implementation Order` section removed — **the ordering block dies here**, because the native
dependency edges wired in step 4 own the graph once the issues exist — and then asserts that no
drafting-time token survived into what it wrote.

A non-zero exit stops the run: **file nothing**, fix the draft, and re-derive. The assertion covers a
surviving template placeholder (`{{…}}`) and observation marker (`⚠️ razor:`) as well as a label, so
nothing drafting-time reaches an issue. (`--assert-clean` runs the same assertion over a body derived
some other way, and every other stage's filing body still goes through it.)

**Then publish the assets and rewrite their references (when `ASSETS` is set).** This is the first
side effect after the gate. It runs on the derived body, before the assertion below, and before any
issue exists. `<feature-slug>` is the last segment of the draft's `feature_path` — the folder the
files land in is the feature's, so a second epic in the same feature shares it:

```bash
nexus assets rewrite --body "${DRAFT_DIR}/epic.filing.md" \
    --asset <path> [--asset <path> ...] \
    --feature "<feature-slug>"
```

It publishes every asset the body references — one commit per file, in the order declared, through
GitHub's file-contents endpoint with no clone — and replaces each local path with the reference its
reader renders: an image inline, any other file a link to the version at the pinned commit. It
prints `{ published, unreferenced, rewritten }`. **A non-zero exit stops the run: file nothing.** The
diagnostic is GitHub's own error or a named problem; anything it had already published is harmless
and unreferenced, and a re-run republishes cleanly. An `unreferenced` entry is a declared file no
body mentions — report it in Phase 7; nothing is written for it. Because the story work-items in
step 3 are transcribed from this rewritten body, a reference in a story's section lands in that
story's issue body and one in an epic-level section lands in the epic body.

**Then assert that no declared local path survived the rewrite (when `ASSETS` is set):**

```bash
nexus razor-check --draft "${DRAFT_DIR}/epic.filing.md" --assert-clean \
    --asset-path <path> [--asset-path <path> ...]     # one per declared asset
```

A non-zero exit stops the run: **file nothing**, fix the derived body, and re-assert. `--derive`
already asserted the labels, placeholders, markers and ordering rows away; this second pass adds the
one thing it could not know — this run's `--asset-path`s, matched exactly — so a local asset path
the rewrite missed fails the run the same way a surviving label does, before any issue is created
or edited.

**Every command below names `epic.filing.md` explicitly.** The two files have different jobs and the
distinction is not one a blanket sentence can carry through a dozen concrete commands:

| File | Role |
|---|---|
| `${DRAFT_DIR}/epic.md` | the labelled draft — the reviewer's drill-down, and the run's **record of what was filed** (its frontmatter carries `link`) |
| `${DRAFT_DIR}/epic.filing.md` | the derived clean body — **everything filed is filed from here**, and it is re-derived from `epic.md` on every run |

Because the derived file is rebuilt each run, the epic issue number is recorded on the labelled
`epic.md`, not on it. Step 1 says how.

Issue creation is **coupled**: the epic issue and its story sub-issues are created together in this
one step. There is no separate task command — the story is the implementation unit (0009), so each
story becomes one GitHub issue, child of the epic issue.

1. **Create (or reuse) the epic issue (idempotent).** If `${DRAFT_DIR}/epic.md`'s frontmatter already
   carries `link` — the epic issue was filed in a prior run of this command — **reuse that number;
   do not create a second epic issue** (Success Metric / AC: a re-run reuses the recorded number).
   Otherwise:

    ```bash
    # intent mode — create a new epic issue
    nexus create-epic "${DRAFT_DIR}/epic.filing.md"

    # promotion mode — populate the stub's OWN issue in place
    nexus create-epic "${DRAFT_DIR}/epic.filing.md" \
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
    `link: "#<n>"` back into the file it was given — here, `epic.filing.md`. Set `EPIC` = that number.

    **Then copy that `link: "#<n>"` line into `${DRAFT_DIR}/epic.md`'s frontmatter.** The derived
    file is rebuilt from `epic.md` on every run, so a number recorded only on it is lost the moment
    the run is repeated and the next run files a second epic issue. Recording it on the labelled
    draft is what makes the idempotency check at the top of this step true.

    It also applies the **needs-design** label from the epic's `complexity` rollup (#139): **M or
    larger** carries it, **S** does not, and an absent rollup errs toward carrying it. That label is
    the declarative gate — `/nxs.decision-record` files the decision record as a sub-issue for a labelled epic,
    and the downstream gates decide "should this epic have a record?" from the issue graph alone, so
    an epic filed by hand outside Nexus (no label, no record) is treated as an epic without a record
    rather than an error. The threshold is a stated default: **edit the label on the issue** to
    override it either way; nothing here is remembered off the issue.

2. **Sequence the stories — derive the sequence from the draft's `## Implementation Order` block.**
   The ordering was settled in Phase 3 and shown to the reviewer at the digest; deriving it again
   here from scratch would file an ordering nobody approved. Walk the block so a story follows
   everything it waits on, assign each a ref `STORY-<EPIC>.<SEQ>` (`SEQ` zero-padded, in that order),
   and translate each row's blocker titles into that story's `blocked_by` refs — `none` where the row
   says `none`. Do **not** split or merge — sizing happened in Phase 3.

   The ref is an **authoring key with the lifetime of this batch**, not a name for the story: it exists
   only so a story can name a sibling before `gh issue create` has minted any issue numbers. It never
   survives filing on an issue, is never reported after filing, and is never re-derived downstream.

   Use it wherever a story must name a sibling — in `blocked_by` **and in body prose** (`extends
   STORY-<EPIC>.<SEQ>`). Step 4's pass 3 rewrites every prose ref to `#<issue>` once the numbers exist,
   so the ref never reaches a reader. Never hand-write a `#<n>` for a story in this batch: the number
   is not knowable at authoring time, and a guess points at an unrelated issue.

3. **Write transient story work-items** to the scratchpad, one `STORY-<EPIC>.<SEQ>.md` per story, with
   the frontmatter the creation skill consumes and the story body as the issue body.

   Each body is a **verbatim transcription** of that story's section in the derived
   `${DRAFT_DIR}/epic.filing.md` — copy the prose across, do not re-draft it. Transcribing from the
   labelled `epic.md` would carry a provenance label onto a story issue, which is the one leak the
   derived body exists to prevent. The epic was approved at the Phase 5 digest on that wording, so
   a sentence rewritten here would reach the issue unapproved. Only the asset rewrite at the top of
   this phase and the ref rewrite in step 4's pass 3 (`STORY-<EPIC>.<SEQ>` → `#<issue>`) may change
   a body after approval:

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

    **Then assert every work-item, before step 4 files any of them:**

    ```bash
    for item in "<scratch-folder>"/STORY-*.md; do
        nexus razor-check --draft "$item" --assert-clean [--asset-path <path> ...] || exit 1
    done
    ```

    Pass the same `--asset-path` flags as the epic body's assertion, so a local path that slipped
    into a transcription is caught on the same terms.

    A non-zero exit stops the run: **file nothing**, fix the work-item, and re-assert. The epic body
    was asserted at the top of this phase and each story body is transcribed out of it — but a
    transcription is a copy made by hand, and for a six-story epic six of the seven bodies that
    reach GitHub are copies. Clean-by-copying is the remembered-not-checked mode the derived body
    exists to end, so the copies are checked on the same terms as the original.

4. **Create the story issues:**

    ```bash
    nexus create-story "<scratch-folder>"
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
   to `## Epics`. The capability statement is a durable read surface and carries the same style as
   the epic body (see *Prose convention*).

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

6b. **Post the marked gist comment on the epic issue (discovery mode only).** A discovery that
    right-sized to M or smaller is planned here as one epic and files **no stub**, so there is no
    stub body to carry its reasoning. Write the resolved decisions onto the epic issue in the same
    full gist form and under the same marker Phase 2b step 5 uses, so the reasoning still outlives
    the folder and still reaches `/nxs.decision-record`:

    ```bash
    gh issue comment <EPIC> --body-file "<scratch>/gist-epic.md"
    ```

    Anything that must outlive a discovery is copied in full into a durable artifact; a reference is
    never sufficient, because the folder is removed once the discovery ends.

7. **Add the new feature to the features index** when Phase 1 created the container. Append a row
   to the table in `<docs-root>/features/README.md` linking `<feature-path>/README.md` and its
   one-line capability statement. An existing feature needs nothing here.

8. **File the deferral stub — asked-for scope the smallest usable version excludes, that the
   reviewer did not take.** This runs **after the epic issue and every story issue exist**, and only
   on the approval that filed them: nothing is created before an explicit approval selection.

    The deferred set is exactly the *Asked for* entries of the Phase 5 offer list the reviewer left
    unnamed. It **never carries a story the drafting model added** — model-added scope the reviewer
    declined is discarded and leaves no trace anywhere, because regenerating it later is cheaper than
    carrying it as an open item somebody has to triage.

    If that set is empty — the smallest usable version needed every asked-for story, or the reviewer
    took the rest — **file no stub**. An empty deferral is not an artifact.

    Otherwise file **one** stub, through **the same stub producer Phase 2b uses** (same resolved
    classification, same unplanned label, same work-item shape), so the thing deferred is an epic
    nobody has planned yet and meets this same command and this same gate when it is planned:

    ```markdown
    ---
    ref: "STUB-DEFERRED"
    title: "<Originating epic title> — deferred scope"
    labels: [<unplanned-label>]
    ---

    <one line: the capability the deferred stories together still leave unbuilt>

    ## Meta

    - **feature:** <feature-path>
    - **estimate:** S | M
    - **candidate stories:** <Story Title>; <Story Title>; …
    - **source:** deferred from #${EPIC} (<YYYY-MM-DD>)
    - **deferred:** <n> story|stories
    ```

    The `deferred` line **counts the titles** — `1 story`, `2 stories`, and the singular form is
    written when the count is one, because step 9's floor reads that line and a stub that says
    `1 stories` is a floor the next run does not recognise.

    It carries **story titles only** — **no acceptance criteria**, no provenance label and no
    ordering block. A deferred title is drafted again when it is planned, so criteria copied across
    would be criteria nobody approved for the epic that ships them. The `source` line names the
    originating epic **by issue number** (`deferred from #${EPIC}`) and **never any part of
    `source.md`**, which may hold anything the lead pasted.

    **Record the stub's number back onto `${DRAFT_DIR}/epic.md`'s frontmatter** as
    `deferral_link: "#<n>"`, the way step 1 records `link`. A re-run of a partially completed filing
    reads it and files no second stub.

9. **The deferral floor — a deferral that carries one story defers nothing further.** When this run
   is planning a stub whose `## Meta` **`deferred:` line counts one story** (`deferred: 1 story`, the
   singular form step 8's template writes for a count of one), file its remainder into the epic and
   **skip step 8 entirely**: it **defers nothing further**, whatever the necessity answer says. The
   request makes deferral recursive, and without a floor the tail of an initiative recedes
   indefinitely, each round deferring a remainder that is never built. The floor is checkable at the
   moment it matters and needs no history.

A **promotion** needs no follow-up here: the stub issue *is* the epic issue now — Phase 6 populated
it in place and removed the unplanned label. Nothing was created and nothing was closed, so every
reference written when the scope was deferred still points at the right issue.

## Phase 7 — Report completion

Report:

- Feature name and folder.
- Epic title, complexity rating, and story count (with `story_type` breakdown).
- **In promotion mode**: that epic issue `#<n>` is the same issue the stub was filed under — no
  second issue was created, and the unplanned label was removed.
- **In discovery mode**: that the discovery folder has been **consumed** and can be removed, and
  that removing it is a plain commit the user makes. This command does not delete it. Name it in the
  report only — never in an issue body or comment.
- **Nothing committed to `.nexus/queue/`** — the epic lives on GitHub issues; the queue entry is
  born at close. The `epic.md` draft stayed in session scratch. This holds in discovery mode too: a
  consumed discovery folder is left exactly as it was found.
- **If the creation scripts printed "Seeded github config … — review and commit"** (STORY-121.07
  write-back): a repo with no `github:` block had its resolved publishing decisions (classification
  mode, discovered project or `none`) persisted into `.nexus/config/settings.yml`. This is a
  **tracked config file**, distinct from the no-queue-commit planning contract above — tell the user
  to review that diff and commit it, so the fragile probe never runs again.
- **The deferral stub, when one was filed** (Phase 6 step 8): its issue number, and the story titles
  it carries. If none was filed, say so — either the smallest usable version needed every asked-for
  story, or this run was planning a single-story deferral and the floor suppressed it.
- **Assets**, when `--assets` was passed: each published file with its pinned reference and the
  issue it landed in; any declared file that no body mentioned and so was **not** published; or,
  when the repository declares no store, that assets were unsupported and the issues were filed
  without them.
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

## Personas   <!-- deviations only — no table when the canonical personas apply as-is (nxs-razor §6) -->

<Deviations only. Personas are canonical in `<docs-root>/product/context.md` — the `<docs-root>` resolved in Phase 0, with the empty-prefix rule applied (so `product/context.md` on a repo-root hub, `docs/product/context.md` in a single-repo checkout). If this epic uses them as-is, write that resolved path: "Per `<docs-root>/product/context.md`." Tabulate only personas specific to this epic or deviations from the canonical set.>

## Implementation Order   <!-- drafting-time only (nxs-razor §10) — derived away at filing -->

- **<Story Title>** — blocked by: none
- **<Story Title>** — blocked by: <Story Title>; <Story Title>

## Smallest Usable Version

<the stories the smallest usable version of this capability needs, named by title, and nothing else — the necessity answer (nxs-razor §7). It reaches the filed issue and orders the digest's cut list.>

## User Stories

### Story 1: <Story Title>   <!-- label the heading too (nxs-razor §1) — `[asked: "…"]` or `[inferred]` -->

- **story_type:** user | system
- **size:** S | M

**As a** <persona>, **I want** <goal>, **so that** <benefit>.

#### Acceptance Criteria   <!-- 3–5 (nxs-razor §5); above five, add one `**Reason for <n>:**` line here -->

- [ ] **Given** <precondition>, **when** <action>, **then** <expected result>   <!-- names no mechanism (nxs-razor §6); label it `[asked: "…"]` or `[inferred]` (§1) -->
<!-- For story_type: system, at least one AC must state a measurable metric, threshold,
     or pass/fail assertion — not prose like "implement caching". -->

#### Notes

<assumptions, constraints, context — optional>

### Story 2: <Story Title>

<repeat>

## Assumptions   <!-- max 5, no escape; may be empty (nxs-razor §5); label each item (§1) -->

- <reasonable defaults chosen for unspecified details>

## Out of Scope   <!-- max 5, no escape; may be empty (nxs-razor §5); label each item (§1) -->

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
nexus abs-doc-path "<feature-path>/README.md"
```
