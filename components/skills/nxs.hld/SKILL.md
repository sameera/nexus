---
name: nxs.hld
description: Render one planned epic's approved design as a high-level design document (HLD), a Markdown page whose architecture, flow, data and delivery diagrams are Mermaid blocks, so people read it rendered by GitHub and an implementing agent reads the same text, and check that design against the epic. Reads the epic, its stories and its decision record, derives the design from the record's decisions and guarantees, and reports every acceptance criterion as achievable or not, every decision and guarantee as kept or violated, every conflict between the record and the code, and every choice the record left open. Shows the page to the lead before any write, then publishes it to the team's asset store through `nexus assets publish` and references it from the decision record with a dated comment, whether the record is open or approved, so the hashed record body never changes. Never edits the record's body, never edits the epic or a story, never writes a decision of its own into the record. Refuses to be the first design step: it stops while the epic has no record or still carries the needs-design label. Invoke as `/nxs.hld <epic-issue-number>`.
---

# nxs.hld

Render the design the decision record already made as a document engineers can build from and a
lead can check in one sitting, with the architecture, the flows and the data drawn rather than
described. The document is one Markdown page with Mermaid diagrams: GitHub draws them for a person,
and an agent reads the same blocks as text. Then put that document where the record lives, so the picture of the design sits
beside its reasons.

An HLD here is **derived from the record, never a substitute for it**. The record holds every
decision and its why. The HLD holds what those decisions look like when they meet the epic's
stories and the code as it is today: the components, the flows, the data, the delivery order, and
a check of every acceptance criterion, decision and guarantee. A design choice the record did not
make is reported as an open choice for the lead to settle, never filed as a decision by this
skill.

The HLD is the step **after the decision record and before implementation**. It takes the design
the record approved one step closer to code, so engineers, and `nexus implement-epic` when a lead
runs it, can build from it. It never feeds back into the record: a choice it makes binds the build
only once the lead promotes it with `/nxs.decision-record --revise`. So it is never the first step
of a design. It refuses while the epic has no record, or while the epic still carries the
needs-design label, which `/nxs.decision-record` removes when it files the record.

**Finish line:** the Markdown page published to the asset store and referenced from the decision
record, with the completion report; or the page left local when the lead chose that; or a refusal
that names what is missing.

Load the `nxs-run-discipline` skill at the start. It governs when this run stops and the layout
of the completion report. Load the `nxs-issue-reference` skill before writing any issue number
into the page, a comment or the report. Load the `nxs-assets` skill before Phase 5.

# User Input

```text
$ARGUMENTS
```

`$ARGUMENTS` is the epic's issue number: `348` or `#348`. Nothing else is accepted. With no
number, or with a pull request reference, a story number, a path or `owner/repo#N`, stop and ask
for the epic issue number; the resolver takes a bare number only.

# Scope

A run reads GitHub and the workspace's checkouts. Its working files go under the gitignored
`.nexus/tmp/`: the materialized `epic.md`, the record body and the Markdown page are written there
before the preview gate in Phase 4, and the reference block after it. Outside `.nexus/tmp/`
it writes exactly two things, both after the preview gate: one file in the asset store, and one
reference in the decision record. It edits no epic, no story and no code. It never
reopens or closes an issue, never changes a label, and never writes a decision into the record.

# Phase 0 — Resolve the epic, the record and the repositories

1. **Materialize the epic.** Run the resolver; it is the one producer of the epic every stage reads:

    ```bash
    nexus epic-resolve --epic <N>
    ```

    On a non-zero exit, report the diagnostic verbatim and stop. On success keep `outPath` (the
    materialized `epic.md`), `targetRoot`, `issuesRepo` and `record` (`{ number, state }` or
    `null`).

2. **Refuse without a record.** When `record` is `null`, stop: *epic #N has no decision record;
   run `/nxs.decision-record N` first. An HLD derives from a record, so there is nothing to derive
   from.* Write nothing.

3. **Resolve the issues repository.** Do this before reading the record: the record lives in the
   issues repository, and every later read of it names that repository. Take it from the
   resolver's `issuesRepo`, the repository the resolver read the epic and the record's number
   from, so the number and the repository always come from one source. Never resolve it again
   from configuration: a configured repository that differs from the one the resolver read would
   pair the record's number with an unrelated issue.

    ```bash
    ISSUES_REPO="<issuesRepo, or empty when it is null>"
    REPO_ARG=""; [ -n "$ISSUES_REPO" ] && REPO_ARG="-R $ISSUES_REPO"
    ```

    A `null` `issuesRepo` (single-repo mode) means the current repository, and `REPO_ARG` then
    stays empty: `gh` refuses `-R ""`. **Every `gh` call below carries `$REPO_ARG`**, and it is the
    only form used.

4. **Refuse while the design step is unfinished.** Read the label name through the resolver and the
   epic's labels from GitHub:

    ```bash
    NEEDS_DESIGN="$(nexus config resolve needs-design-label --root "<targetRoot>")"
    gh issue view <N> $REPO_ARG --json labels --jq '[.labels[].name]'
    ```

    `/nxs.decision-record` removes this label when it files the record. When the label is on the
    epic, stop: *epic #N still carries `<NEEDS_DESIGN>`, so its design step has not finished; run
    `/nxs.decision-record N` first. An HLD refines a filed record and is never the first step of a
    design.* Write nothing. This catches a record filed by hand or a filing that stopped before it
    moved the label.

5. **Note the record's state.** `open` means the record is filed but not yet approved; its body
   may still change. `closed` means approved; its body is frozen. Read the record's approval and
   its digest through the one digest program, never a shell hash:

    ```bash
    nexus record-digest --issue <RECORD> ${ISSUES_REPO:+--repo $ISSUES_REPO}
    ```

    Keep `state` as `RECORD_STATE`, `digest` as `RECORD_DIGEST` and `approved` as
    `RECORD_APPROVED`. A record closed as *not planned* is withdrawn, not approved: say so and stop,
    because a withdrawn design is not one to build from. This state and digest are what the page is
    derived from. The record can change while the lead is at the preview gate, so Phase 5 reads both
    again before anything is published.

6. **Find the code.** Run `nexus workspace status`. In a workspace, the members' checkouts hold the
   code; in single-repo mode, the current checkout does. For each checkout the HLD reads, record
   its short commit (`git rev-parse --short HEAD`) for the page header. Pull nothing and switch no
   branch.

# Phase 1 — Read the sources, in order of authority

Read all of them before designing. The order says which wins when two disagree.

1. **The decision record**, its body and its comments as fetched from GitHub:

    ```bash
    gh issue view <RECORD> $REPO_ARG --json body,comments
    ```

    Write the `body` field, unchanged, to `<targetRoot>/.nexus/tmp/hld/record-body.md`; step 4
    reads it. Its decisions (D-IDs), guarantees (G-IDs), risks (R-IDs), mechanism and approval
    brief are binding. Read the comments for a revision trail (a `## Record revised` comment) and
    for an earlier HLD reference (a comment whose first line is `<!-- nxs.hld -->`), so the report
    can say this run supersedes it.
2. **The stories**, as `epic.md` carries them now. The resolver materializes the live issue text,
   so an acceptance criterion the record amended is read in its current wording, not the wording
   the record quoted.
3. **The epic**: description, success metrics, assumptions, out-of-scope list and the
   Implementation Sequence table.
4. **The concept invariants** on the pages the epic lists. List them with the invariant lister
   `/nxs.analyze` runs, never by reading the store by hand:

    ```bash
    nexus concept-invariants --epic "<outPath>" --base HEAD --record "<targetRoot>/.nexus/tmp/hld/record-body.md" --root "<targetRoot>"
    ```

    `<targetRoot>` is the hub checkout in a workspace, which holds the store. The lister reads
    each listed page from git at `HEAD` and marks an invariant **covered** when a stated change in
    the record's Concept-store changes quotes it. A covered invariant is one the approved record
    changes on purpose: the design follows the record's change, and it is never a violation. Every
    **uncovered** invariant binds the design as the record's guarantees do. Name each page the
    lister reports under `missing`. Exit 1 stops the run with its diagnostic: never read zero
    invariants as none to keep. Put the lister's `sentence` in the report.
5. **The code**, only to the depth the HLD needs: the components the record's mechanism touches,
   the entry points a flow passes through, the stored data a decision changes. Stop at file level.
   Line numbers, call-site tables and schema dumps belong to an engineer's low-level design, not
   here.

When the code or a story contradicts the record, do not quietly take the record's side. Record a
**conflict** (Phase 2) and design for the facts as found.

# Phase 2 — Derive the design and check it

Work as the principal engineer who owns the end-to-end design of this product, writing for the
engineers who will build the stories and the lead who approves the design. The record decided;
you draw what it decided and check that it holds.

## Altitude: what an HLD holds

Keep every section at the altitude a lead approves and an engineer starts from. A document that
mixes in implementation detail reads as a low-level design and stops being checkable in one
sitting.

| In the HLD | Not in the HLD |
| --- | --- |
| Components and what each is responsible for | Class, function or variable names |
| A mechanism as numbered steps or a flow diagram | Full SQL, DDL or migration scripts |
| Entities, their relationships and key constraints | Column-by-column schemas and indexes |
| Changes to the API surface, by endpoint and shape | Request and response schemas |
| Operator steps as a runbook outline | A script's arguments |
| Configuration keys per environment | Values and secrets |
| Test strategy by level, and what each level must prove | A catalogue of named tests |
| Delivery order by pull request and story | Task lists |
| A short "starting point in the code" list of files | Per-call-site tables with line numbers |

A file path is allowed only in the starting-point list and only to tell an engineer where to begin.

## Content

Produce these sections, in this order. Omit a section only when the record gives it nothing, and
say so in one line rather than leaving it out silently.

1. **Header.** Epic, stories, record with its state and `RECORD_DIGEST`, the checkouts and
   commits designed against, the generation date, the audience.
2. **Summary.** What changes, in about ten lines.
3. **Scope.** In scope. The epic's out-of-scope items, restated. Nothing is designed outside it.
4. **Starting point in the code.** The short list of where each affected component lives today,
   and the facts about it the design relies on.
5. **Architecture.** The components, grouped by where they run, and the paths between them.
   This section carries the **architecture diagram**.
6. **Data.** The entities the design introduces or changes, their relationships and the
   constraints that keep the guarantees. This section carries the **data diagram** when any
   stored data changes.
7. **Mechanisms.** One subsection per mechanism the record describes, as numbered steps, with
   every outcome the record lists. Each carries a **flow diagram**: a sequence diagram for a path
   through components, a decision flow for a branching rule.
8. **API surface, operator tooling, console and configuration.** One short subsection each, only
   where the design changes them.
9. **Preserved behaviour.** One short paragraph per guarantee under the record's *Existing
   behaviour to preserve*, naming what keeps it true.
10. **Test strategy.** By level: what each level proves, and the cases the guarantees force.
11. **Delivery plan.** Pull requests in order, the story each closes, the repositories each
    touches, and what must land together. This section carries the **delivery diagram**, built
    from the epic's Implementation Sequence.
12. **Risks.** The record's risks restated with their mitigation, plus any new risk the design
    found, each with its likelihood, impact and mitigation.
13. **Choices the record left open.** Every choice the HLD had to make that no decision covers:
    the choice, one line of reason, the rejected option. These are **HLD choices**, never given a
    D-ID. The lead promotes one into the record with `/nxs.decision-record --revise` when it
    should bind the build.
14. **Traceability.** Three tables, no blank cell:
    - every acceptance criterion of every story → sections → status: *Achievable*, *Achievable
      with accepted gap* (only for a gap the record's own risks already accept), *Not achievable*;
    - every decision → sections → *Kept* or *Violated*;
    - every guarantee → sections → test level → *Kept* or *Violated*.
15. **Conflicts with the record.** Where the code, a story or a concept invariant disagrees with
    the record, and how the design resolved it. *None* when there are none.
16. **Violations.** See below. *None* when there are none.
17. **Open questions.** Only questions the sources cannot answer and that change the design. Each
    with a recommended answer, and the design assumes that answer, so no question blocks the page.
18. **Walk-throughs.** The record's own example, if it has one, walked through the design step by
    step, plus the edge cases the guarantees name. Each must end the way the record says.

## Violations

A violation is a decision, guarantee, acceptance criterion or concept invariant the design cannot
keep. A silent one is a failure of the run. One hidden as an assumption, a simplification or a
follow-up is the same failure. Each entry carries:

- **ID** — V1, V2, …
- **What is violated** — quoted.
- **Why it cannot be avoided** — the concrete fact that forces it, with its code or issue reference.
- **What the design does instead.**
- **Impact** — who notices and how: users, operators, security, data integrity, delivery, later epics.
- **Options** — at least one alternative that avoids it, and its cost.
- **Recommendation** — and what must change in the record or the stories to make it legitimate
  (`/nxs.decision-record --revise <N>`, or an amendment to a story the lead applies).

Never reopen a decision because another design looks better. Reopen one only when keeping it
makes an acceptance criterion or another guarantee impossible, and then it is a violation, written
up as above.

## Self-check before rendering

1. Every traceability row has a status; every guarantee row names a test level.
2. Every violation in the Violations section is *Violated* in the matrix, and every *Violated* row
   has an entry there.
3. No section below the altitude table's line: no SQL, no line numbers, no test catalogue.
4. Every walk-through ends where the record says it ends.
5. Every design element traces to a decision, a guarantee, an acceptance criterion, a concept
   invariant, a discovered code fact, or an entry in *Choices the record left open*.

# Phase 3 — Render the page

Render **one Markdown file** at `<targetRoot>/.nexus/tmp/hld/<N>-<slug>.md`, where `<slug>` is the
epic's `slug` when the materialized frontmatter carries it, else a kebab-case form of the epic
title. The folder is gitignored. Write no second copy: a second copy drifts from the first at the
first revision. The one file serves both readers. People read it rendered by GitHub, which draws
the Mermaid blocks. An implementing agent, such as `nexus implement-epic`, reads the same text, and
a Mermaid block states every edge and every message in order as text.

## Page rules

- **One file, plain Markdown.** Headings, lists, tables and fenced `mermaid` blocks only. No raw
  HTML, no image and no link to a local file: the page must read the same as text and as rendered.
- **Numbered sections.** Each section from Phase 2 is a `##` heading with its number, so the
  reference comment and a reader can point at one by number. Keep the numbers in step with
  Phase 2: the reference comment names section 13, *Choices the record left open*.
- **Header first.** The header's epic, record, state and digest are the first lines under the title.
- **Issue references** inside the page are the qualified form `owner/repo#N`, because the page is
  published into the store repository, where a bare `#N` would point at the wrong issue.
- **Size.** Stay well under the team's `asset-size-cap` (default 5 MB). A Markdown page with every
  diagram is normally under 100 KB.

## Diagram rules

Draw every diagram as a fenced `mermaid` block. Put a **legend line** in italics directly under
each block: what a solid edge, a dotted edge and each highlighted class mean. Mermaid places the
boxes itself, so spend no effort on layout; spend it on the right nodes and edges.

- **Architecture diagram** (required). A `flowchart`, with one `subgraph` per place a component
  runs: a machine, a service, a repository, GitHub. Solid edges (`-->`) for a call or a
  read/write, dotted edges (`-.->`) for a reference or an out-of-band step, each labelled with what
  travels on it. The components the record's mechanism centres on are highlighted with a
  `classDef` and `class` line.
- **Flow diagrams** (one per mechanism). A `sequenceDiagram` for a path through components, with
  one participant per component and the messages in order. A `flowchart` for a decision flow, with
  the checks top to bottom and each exit as its own node, given a `classDef` by kind of outcome:
  a refusal, a write, a return. Every outcome the record lists is an exit.
- **Data diagram** (when stored data changes). An `erDiagram` with the entities, their key
  fields and their relationships. Write the constraint a guarantee relies on as the relationship's
  label.
- **Delivery diagram** (required). The stories in the epic's Implementation Sequence, as a
  `gantt` with one section per pull request when the order is a timeline, or as a dependency
  `flowchart` when it is a graph. Name the pull request each story lands in.
- **Anything else** only when it carries a decision: a `stateDiagram-v2` for a lifecycle the
  record introduces, a before/after pair for a data change. No picture decorates; each one shows a
  mechanism the prose would take a page to say.

A label with punctuation Mermaid reads as syntax, such as `/`, `(`, `[` or `#`, goes in double
quotes: `skill["/nxs.hld"]`.

## Checks before the preview

```bash
nexus mermaid-check --file <page> --root "<targetRoot>"
wc -c < <page>
nexus config resolve asset-size-cap --root "<targetRoot>"
nexus assets check --asset <page> --root "<targetRoot>"
```

The first parses every Mermaid block with Mermaid's own parser. Its `state` decides:

- `parsed` — every block parses. Confirm the `blocks` list holds at least the architecture and
  delivery diagrams and one flow per mechanism.
- `invalid` — a block GitHub would show as an error. Each failing block names its fence line, the
  parser's message and, when the parser gives one, the line in the file. Fix every failing block
  and run the check again before going on.
- `unchecked` — `mermaid` or `jsdom` is not installed where the check looks: beside the Nexus
  install, or under the target root. Go on, and say at the preview that the diagrams were not
  parsed, with the check's `reason`, so the lead checks them in GitHub's rendering instead.

The second and third compare the page's size in bytes with the team's `asset-size-cap`. A page
over the cap cannot be published: shrink it before going on. `nexus assets check` does not check
the size; only `nexus assets publish` enforces it, and it does so after the lead has approved.

The fourth reads the store at the epic's target root once: its visibility. A non-zero exit stops
the run with its diagnostic. `{ "state": "unsupported" }` means no asset store is declared: say so
once, and go to the preview knowing the page can only stay local.

## The feature slug

Settle the feature the page will be published under now, so a name the store refuses cannot stop
the run after the lead has approved. Take the last segment of the epic's `feature_path` when the
materialized frontmatter carries it, else the epic's `slug`, else `epic-<N>`. Normalize it:
lower-case it, replace every run of characters other than `a-z` and `0-9` with one `-`, and trim
`-` from both ends. The result must match `^[a-z0-9][a-z0-9-]*$`, the form `nexus assets publish`
accepts; when nothing is left, use `epic-<N>`. Keep it as `<feature-slug>` and say at the preview
which source it came from and whether it was changed.

# Phase 4 — Preview gate (MANDATORY STOP)

Before any write outside `.nexus/tmp/`, show the lead the page and the verdict:

1. The file's absolute path. The lead reads it in any Markdown viewer that draws Mermaid, such as
   an editor's Markdown preview; the published page is drawn by GitHub.
2. The diagram check: how many Mermaid blocks parsed, or, when `nexus mermaid-check` reported
   `unchecked`, that the diagrams were not parsed, with its `reason`.
3. One line: *All acceptance criteria achievable, no decision violated*, or the counts of
   violations and not-achievable criteria.
4. Each violation in short form: ID, what is violated, impact in one or two sentences,
   recommendation.
5. Each conflict with the record, in one line each.
6. Each open question with its recommended answer.
7. Each choice the record left open, in one line each.
8. The store line: the store and its visibility, and the `<feature-slug>` the page goes under. The reference will be the plain link to the page's
   blob at the publish commit; `asset-renderer` applies only to HTML and plays no part. A private
   store means only people and agents with read access to it can open the page: say so, so the
   lead decides before approving.

Then ask, through `AskUserQuestion`. When the check in Phase 3 returned `unsupported`, there is no
store to publish to: leave out **Publish and reference it from the record**, and say in the
question that the page can only stay local.

- **Publish and reference it from the record** — continue to Phase 5.
- **Revise** — the lead's notes are applied to the page, the checks in Phase 3 run again, and
  this gate is shown again. The sources are not re-read unless a note asks for it.
- **Keep it local** — end the run with the completion report. The page stays at its path and
  nothing is published.

An HLD with a violation may still be published: the lead may want it on the record as the evidence
for a revision. The reference written in Phase 5 then states the violation count, so nobody reads
the page as a conforming design.

# Phase 5 — Publish and reference

Load the `nxs-assets` skill. The store and the size cap are team settings; this skill reads them
and never falls back to another repository.

1. **Read the record again.** The lead may have spent any length of time at the preview gate, and
   the record may have changed in that time. Before anything is published, read it again through
   the digest program:

    ```bash
    nexus record-digest --issue <RECORD> ${ISSUES_REPO:+--repo $ISSUES_REPO}
    ```

    Compare its `state`, `approved` and `digest` with what Phase 0 kept. Check these cases in
    order; the first that matches decides:

    - **Withdrawn** — the record is now closed as *not planned*. Say so and stop: a withdrawn design
      is not one to reference. Nothing is published and nothing is written to the record.
    - **Reopened** — `RECORD_STATE` was `closed` and the record is now `open`. A
      `/nxs.decision-record --revise` is under way. Say so and stop; run `/nxs.hld` again once the
      revised record is approved. Nothing is published.
    - **Changed** — `digest` differs from `RECORD_DIGEST`. The record body changed during the run,
      so the page was derived from a body that is no longer the record's. Say so and stop; run
      `/nxs.hld` again to derive the page from the current body. Nothing is published.
    - **Approved during the run** — `RECORD_APPROVED` was false and `approved` is now true, with
      the same digest. Judge approval by the digest program's `approved`, never by the close
      reason: it counts every close except *not planned*. The page still matches the body, so tell
      the lead the record was approved during the run, and go on.
    - Otherwise the record is as Phase 0 read it. Go on.

2. **Publish** under the `<feature-slug>` settled in Phase 3.

    ```bash
    nexus assets publish --file <page> --feature "<feature-slug>" --root "<targetRoot>" --json
    ```

    Keep `url`, `commit` and `markdown` from the output. The reference pins the commit the publish
    created, so a later run that publishes the same file name makes a new commit and never changes
    what an earlier reference shows. For a Markdown page the reference is always the plain link to
    `https://github.com/<store>/blob/<commit>/features/<feature-slug>/<file>`, which GitHub renders
    with its diagrams; the publish prints no renderer line. That pinned link is also how an agent
    finds the page: it takes the store, the path and the commit from it and reads the raw text
    through GitHub's contents API at that commit, which works for a private store. A non-zero exit stops the run with its diagnostic; nothing is
    written to the record.

3. **Write the reference block** to `<scratch>/hld-reference.md`, where `<scratch>` is
   `<targetRoot>/.nexus/tmp/hld/`. It is short: the page is the document. The first line marks the
   comment as this skill's, so a later run can find it and say it supersedes it.

    ```markdown
    <!-- nxs.hld -->
    ## High-level design

    Rendered <YYYY-MM-DD> from this record at digest `<RECORD_DIGEST>`, against <checkout>@<commit>.

    - Design: <markdown reference from the publish output>
    - Verdict: <the one-line verdict from Phase 4, with the violation count when it is not zero>
    - Choices the record left open: <count>, listed in the page's section 13.
    ```

    The digest is the record's as Phase 0 read it and step 1 confirmed it. The comment does not
    change the body, so the digest stays true.

    Every issue number in it follows the `nxs-issue-reference` rule for a GitHub surface in
    `ISSUES_REPO`: bare for the epic, the record and the stories, qualified only for a number in
    another repository.

4. **Post it as a comment on the record**, whether the record is open or closed:

    ```bash
    gh issue comment <RECORD> $REPO_ARG --body-file <scratch>/hld-reference.md
    ```

    The record body is the text its digest is taken over, and it holds no machine comment and
    nothing that churns for a non-design reason, such as a run date. So this skill never edits it,
    even while the record is open. The comment sits on the record's own issue, where the approver
    sees it beside the record when they close it. An earlier HLD comment is left as it is: an asset
    reference is frozen once filed, and the newer comment supersedes it.

    Do not suggest `/nxs.decision-record --revise` to move the link into the body: a revision
    rebuilds the body, reopens the record and blocks the epic until it is approved again, and it
    exists for a change to the design, not for a link.

# Phase 6 — Report

In the run-discipline layout:

- **Blocked on me:** what waits on the lead. A violation or a not-achievable criterion names the
  revision or the story amendment it needs. An open question names its recommended answer. A
  choice the record left open names the revision that would bind it. When nothing waits, say so and
  name the next step: approve the record by closing it, or implement against it and run
  `/nxs.analyze`.
- **Changed:** the page's local path, the store path and commit, the pinned link filed, and the link to the comment on the record. Say what was left unwritten: the epic, the stories, the record's decisions.
- **Found:** the verdict line, the counts (criteria, decisions, guarantees, conflicts, violations,
  open choices), the concept invariants line (the lister's `sentence`), the diagram check (parsed,
  or unchecked and why), the earlier HLD reference this run supersedes if any, and the record's digest the
  page was derived from.

# Usage

```
/nxs.hld 348        # render the HLD page (Markdown, Mermaid diagrams) for epic #348 from its record, preview, publish, reference
/nxs.hld #348       # the same
```

# Constraints

- **The record is the authority.** The HLD draws the record's decisions and checks them against the
  stories, the concept invariants and the code. It never makes a decision binding: a choice the
  record left open is listed for the lead, and a decision the design cannot keep is a violation
  written in full, never a silent change.
- **One Markdown page, Mermaid diagrams, one source.** People read it rendered by GitHub and agents
  read the same text. No HTML twin, no image, no raw HTML. Every Mermaid block parses before the
  preview, or the preview says it was not checked.
- **HLD altitude.** No SQL, no line numbers, no schemas, no test catalogue. An engineer's low-level
  design is theirs to write and never enters Nexus through this skill.
- **Nothing is written before the preview gate**, except the working files under the gitignored
  `.nexus/tmp/`. The lead sees the page and the verdict before the store or the record changes.
- **Publishing goes only through `nexus assets publish`**, into the declared store, under the
  epic's feature. No store declared means no publish and no reference: the page stays local and
  the report says so.
- **The record's body is never edited and the record is never reopened or closed by this skill.**
  The reference goes in a comment, open or closed, and the revision path belongs to
  `/nxs.decision-record --revise`.
- **The epic and its stories are never edited.** A conflict or a violation that needs a story
  amendment is reported for the lead to apply.
- **Never link the materialized `epic.md`** or any `.nexus/tmp/` path from the page, the record
  or a comment. Those files are ephemeral.
