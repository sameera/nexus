---
name: nxs.decision-record
description: Add the architectural decision record to a planned epic, approval contract first: how the design works in the epic's own words, an approval brief of what needs a decision and what each choice costs, the guarantees the build must keep, and the risks, with each decision's reason and refuted alternative in an appendix. Tiered by complexity. Reads the epic and its stories; files the record as a sub-issue of the epic issue (its durable home) and moves the epic from needs-design to in-progress, with approval being the close of that sub-issue. An old-contract committed queue entry still gets decision-record.md beside epic.md. With `--from <path>` it imports an existing design doc (a developer HLD or plan) as the authoritative basis for the record instead of analyzing from scratch; with `--revise` it reopens an approved record, records what it supersedes, updates it, and re-closes it. Next stage is implementation, then /nxs.analyze validates conformance.
category: engineering
tools: Read, Grep, Glob, Write, Bash, Task, Skill, AskUserQuestion
model: inherit
---

# Role

Produce the **decision record** for one planned epic. The record is the focused architectural "why"
that the distiller later mines. It must give design coverage for every story in the epic. Coverage
is verified here (Phase 3), not by a downstream gate. The record is human prose, tiered by
complexity. Its home is a **sub-issue of the epic issue**: one copy, durable from the start,
addressable by the issue-reference form the knowledge store already uses for provenance.

**Approval is a native act:** closing that sub-issue. Nexus writes no approval field. The approving
account and the approval time come from the issue timeline, and an unapproved record visibly blocks
every stage downstream of it.

**The design spans the whole epic, not a single story.** One record covers the epic. Its decisions
and guarantees must hold across every story; that is what coverage means. The **story** is the unit
of *implementation* and of the GitHub issue (0009), and there is no task layer below it. The story is
not the unit of design. Read all stories together and design for the epic.

You delegate the analysis to the `nxs-architect` agent, then format its output into the seeded
decision-record template and file it as the record sub-issue. For an old-contract epic that has a
committed queue entry, write the record into that entry as before.

# User Input

```text
$ARGUMENTS
```

`$ARGUMENTS` may name a queue entry, an `epic.md`, or its directory. Empty is the normal case:
resolve the entry from the current branch in Phase 0.

**Import mode (`--from <path>`).** If `$ARGUMENTS` contains `--from <path>` (string-matched, like
`/nxs.epic --resume`), the decision record is derived from the **existing design doc** at `<path>`
instead of a fresh from-scratch analysis. That doc may be a developer HLD, a plan, or any
out-of-band design write. This is the supported bridge for work designed outside the pipeline
(CLAUDE.md: "a developer HLD … enters Nexus only via the lead's `/nxs.decision-record --from` at
approval"). The doc supplies the *why*; the queued `epic.md` still supplies the scope the record must
cover. Strip the `--from <path>` token before resolving the entry path from the rest of `$ARGUMENTS`.

**Revision mode (`--revise`).** If `$ARGUMENTS` contains `--revise` (string-matched), the epic's
**approved** record is being changed rather than written for the first time. The token selects
**which filing path Phase 4 takes**. It does not select where the run starts. Run Phase 0.2's
**resolution** steps 1–2 as usual, because they establish `$REPO_ARG` and the label names every
later `gh` call needs. Skip its step-3 **gate**: that gate answers "does this epic warrant a
record", and a revision already presupposes the answer. Then run **Phase 0.4** (it runs on every
path, revision included) and **Phases 1–3** to produce the new body. File the body through
**Phase 4.5**, which reopens the record, records what is being superseded, updates the body, and
re-closes it. Strip the token before resolving the entry path. Without an existing closed record
there is nothing to revise: say so and run the normal path instead.

**Assets (`--assets <path>[,<path>…]`).** Any filing path, `--revise` included, may carry local
files that the record sub-issue should show, such as the diagram a decision was made against or a
sketch of the chosen shape. The flag is repeatable and its value comma-separated. Strip every
`--assets` token and its value before resolving the rest of `$ARGUMENTS`, and keep the paths
**exactly as written**. Load the **`nxs-assets`** skill before handling it. Run the intake step as
soon as Phase 0 has resolved the epic and **before Phase 1's analysis**, naming every declared path:

```bash
nexus assets check --asset <path> [--asset <path> ...]
```

- **Non-zero exit → stop and report the diagnostic verbatim**: a missing path, two assets sharing
  a file name, a malformed `asset-store` value, or a store GitHub cannot read. Nothing has been
  drafted and nothing has been published.
- **`{ "state": "unsupported", … }`** → the repository declares no asset store. Say so once on the
  console (*assets are unsupported for this repository: no asset-store is declared*), set
  `ASSETS = none`, and continue **exactly as without the flag**: the record is drafted and filed
  with no asset references, and the files are written nowhere else instead.
- **`{ "state": "declared", repo, branch, visibility, assets }`** → record `ASSETS` (the paths, in
  the order given), `ASSET_STORE` and `ASSET_VISIBILITY`. The visibility is read here once, for the
  Phase 3.5 checkpoint's store line only. It never selects how an asset is referenced.

An asset is a **picture of a decision, never a substitute for its why**. The body stays
decisions-and-rationale prose, and every decision still carries its rationale in words.

## Interaction convention — actionable choice gates

Every point where this command asks the user to choose (the multi-entry epic selection in Phase 0
and the open-clarification gate in Phase 2) is presented through the **`AskUserQuestion`** tool,
not a free-text prompt. Render any context first as ordinary markdown, then call `AskUserQuestion`
with one option per choice (a short label plus a one-line description of its effect). One option
renders per line in both the VS Code extension and the terminal. The user can always pick "Other"
for a custom answer.

## Prose convention — human-facing artifacts

Two content rules apply to every human-facing artifact this command drafts. Write concrete, not
abstract: "there are two copies of the record; one can go stale", never "state duplication risks
divergence". Add nothing: every sentence carries a fact, a decision or a consequence. The six form
rules sit in a rule block directly above the step that writes the draft. Draft plainly the first
time. There is no translation pass, no pre-translation copy and no verify step on an artifact this
command authored. File the drafted file verbatim.

Run the phases in order.

## Phase 0 — Resolve the epic (dual-read: committed entry, else resolve from the issue)

The epic and its story issues already exist (filed by `/nxs.epic`). Obtain the epic from a committed
queue entry (an old-contract epic, including #114 itself). When nothing was committed at planning
(#114), resolve its issue number through the resolver instead. `/nxs.decision-record` **reads** the
epic; it never hard-fails with "queue entry not found" just because planning committed nothing.

1. **Explicit path**: if `$ARGUMENTS` points at a queue entry / `epic.md` / its directory, use that.
   Record `QDIR` = that directory and skip to step 4.
2. **Committed entry (transitional)**: otherwise glob:

    ```bash
    ls -d .nexus/queue/*/epic.md 2>/dev/null   # an entry is a dir carrying epic.md
    ```

    A `.nexus/queue/epic-<n>/` holding only per-user decision scratch (`--revise` on an epic already
    in implementation) is **not** a committed entry, which is why `epic.md` is required.

    - **≥1 entry** → today's behavior: **1** → use it; **>1** → read each `epic.md` title and ask
      which via `AskUserQuestion` (label = epic title, description = queue path + complexity). Record
      `QDIR`. This is the path #114's own entry (and any other old-contract epic) takes. The resolver
      path (invariant 14) applies to epics planned after the migration.
    - **0 entries** → go to step 3.
3. **Resolve from the issue number**: no committed entry exists, so reconstruct the epic (invariant
   11: zero reads of a committed planning file; the story set + success metrics come from the live
   GitHub issue state at resolve time):
    - **Epic issue number (invariant 12):** the explicit `#<n>` / `<n>` in `$ARGUMENTS` if given.
      Otherwise derive it from the current branch's linked issue: the issue its open PR closes, then
      that issue's **parent epic** (`gh pr view --json ...` for the branch's PR and its closing issue;
      or the `#<n>` in the branch name). If you cannot determine it unambiguously, ask the user for
      the epic issue number and stop until answered.
    - **Materialize:**

        ```bash
        nexus epic-resolve --epic <n>
        ```

      On a non-zero exit, report the diagnostic (`epic-resolve <problem>: <message>`) and stop. On
      success it prints `{ epic, targetRoot, outPath, record }`. Record `QDIR` = the directory of
      `outPath` (a materialized `epic.md` under the gitignored `.nexus/tmp/`) and keep `record`,
      which is the epic's decision-record sub-issue (`{ number, state }`), or `null` when it has none.
4. `QDIR` **must** contain `epic.md`. If it does not, ERROR. Stop.

**Decision-record home.** On the **committed-entry** path (an old-contract epic), `QDIR` is the
committed queue entry and the record is committed there as today. On the **resolver** path the
record's home is a **sub-issue of the epic issue** (#139); see Phase 4. On that path
**no `decision-record.md` is written anywhere**.

## Phase 0.2 — Does this epic warrant a decision record?

Not every epic needs one. The answer is read from the **issue graph**, never remembered: the
**needs-design** label on the epic issue is the claim, and the record sub-issue is the artifact.
That is what makes an epic filed by hand outside Nexus, with no label and no record, work for free.

1. Resolve the target repo and the label names **through the shared publishing resolver**, never by
   parsing `settings.yml` yourself. The epic issue may live in a repo other than the one this
   command runs in, exactly as `/nxs.close` Phase 1.0 resolves it:

    ```bash
    ISSUES_REPO="$(nexus config resolve epic-repo --root "<root>")"
    REPO_ARG=""; [ -n "$ISSUES_REPO" ] && REPO_ARG="-R $ISSUES_REPO"
    NEEDS_DESIGN="$(nexus config resolve needs-design-label --root "<root>")"
    IN_PROGRESS="$(nexus config resolve in-progress-label --root "<root>")"
    RECORD_LABEL="$(nexus config resolve record-label --root "<root>")"
    ```

    `<root>` is the repo root. An empty `ISSUES_REPO` means the epic lives in the current repo and
    `REPO_ARG` stays empty. **Every `gh` call below (`issue`, `label`, `api`) carries
    `$REPO_ARG`**, and it is the only form used.

    Load the **`nxs-issue-reference`** skill before writing any epic, record or story issue number
    into the record body or a terminal report. The record is filed as a sub-issue of the epic, in
    `$ISSUES_REPO`, so most such numbers stay bare there. A story citation qualifies only when
    `$STORY_REPO` (`nexus config resolve story-repo`) names a different repository.

2. Read the epic issue's labels and its record sub-issue. The resolver already reported the sub-issue
   as `record` in its JSON output / the materialized frontmatter's `record` + `record_state`:

    ```bash
    gh issue view <epic-issue> $REPO_ARG --json labels --jq '[.labels[].name]'
    ```

3. **Decide the run's shape:**

    - **Record sub-issue already exists** → this is a re-run or a revision. **Continue to Phase 1**
      as normal; the body a re-run files still comes from Phases 1–3. Phase 4 step 2 then targets
      the existing sub-issue, and a second record is never filed. A record that is already
      **closed** is approved and frozen. Changing it is **Phase 4.5**, whose first act is the reopen.
    - **`needs-design` present, no record sub-issue** → the normal path. Continue to Phase 1.
    - **Neither present** (an S epic, or a hand-filed epic) → the epic claims no design is needed.
      Confirm with the lead via `AskUserQuestion`: **"Proceed without a record (Recommended)"** vs
      **"Design it anyway"**. On the first, stop and report that the epic proceeds without a decision
      record (file nothing, change no label). On the second, continue to Phase 1 and let Phase 4
      apply the labels as usual.

4. **The no-design-needed outcome is available at every checkpoint below.** Whenever the analysis
   (or the lead's judgement at the Phase 2 / Phase 3.5 gates) concludes that no record is warranted:

    - file **no** sub-issue and write **no** record file;
    - remove the needs-design label from the epic issue:

        ```bash
        gh issue edit <epic-issue> $REPO_ARG --remove-label "$NEEDS_DESIGN"
        ```

    - report plainly that **the epic proceeds without a decision record**, and stop.

    This is the only deliberate way to reach "this epic legitimately has no record". That is also
    the only state in which `/nxs.analyze` may run in its degraded no-invariant mode.

## Phase 0.4 — Read the discovery gists off the epic issue

An epic that came from a `/nxs.discover` discovery carries the decisions that discovery resolved, as
comments on the epic issue written when the discovery was promoted. Read them **before** analysing,
so the record is designed on top of what was already settled instead of re-deriving it.

This is the **only** change discovery makes to this command. It runs on every path (normal, import,
and revision) and needs no flag: the epic issue either carries marked comments or it does not.

1. Fetch the epic issue's comments and keep **only** the ones whose body contains the marker
   `<!-- nexus:discovery-gists -->`:

    ```bash
    gh issue view <epic-issue> $REPO_ARG --json comments \
        --jq '[.comments[] | select(.body | contains("<!-- nexus:discovery-gists -->")) | .body]'
    ```

    `$REPO_ARG` is the resolved issues-repo from Phase 0.2.

2. **No marked comment** → this epic did not come from a discovery. Continue exactly as today: no
   new prompt, no new question, and **no empty section** anywhere in the record. Skip the rest of
   this phase.

3. Otherwise keep the collected gists as **`DISCOVERY_GISTS`** for Phase 1.

**Only marked comments are read.** Feeding an epic issue's ordinary discussion to the architect
degrades the input. Capturing an out-of-band decision comment in general is not solved here.

**This command never edits or removes those comments.** They are the only durable carrier of the
discovery's reasoning once the discovery folder is gone.

## Phase 0.5 — Load the design doc (import mode only)

**Skip without `--from`.** With `--from <path>`, read the design doc at `<path>`. It lives outside
the queue, as a docs-space HLD or a machine-local plan. If it does not exist or is empty, ERROR and
stop, because import mode has nothing to import. Keep its content as **`IMPORT_DOC`** for Phase 1.
The doc is the authoritative *why* source; the from-scratch architect analysis is replaced by a
**doc-derivation** pass (Phase 1). The doc may contain code, file paths, and type names. Those are
**stripped** when deriving the record, because the record is decisions-and-rationale prose only
(§template rule: no file paths / type names / API specs).

## Phase 1 — Architectural analysis (delegate to nxs-architect)

**Resolve the docs root first**. The architect reads context under it and never resolves it for
itself. Run the docs-root read-out:

```bash
nexus workspace docs-root
```

Capture the printed line as **`<docs-root>`** (`docs` for single-repo/member, `.` for a repo-root hub,
or the override). **On a non-zero exit, stop and report the diagnostic**. Never pass a fake `docs`
value, and never treat failure as "context absent".

Invoke `nxs-architect` in **decision-record mode**. The architect produces the decision *content*:
the "why", not a 16-section document.

**Choose the record's template before the call** (Phase 3 step 1). The choice tells the architect
which format to return, and a stale seeded template stops the run there, before any analysis is
spent.

**Import mode (`--from`):** pass `IMPORT_DOC` (Phase 0.5) as the FIRST, authoritative input and tell
the architect to **derive** the record from it: extract the decisions, the refuted viable
alternatives, the trade-offs, the guarantees, and the BLOCKER/ADDRESS risks the doc already states, rather than
re-designing from scratch. Fresh reasoning is used only to (a) abstract any code / file paths / type
names in the doc into domain prose and (b) verify story coverage. Any decision the doc states without
a *why*, any choice made without recording the viable alternative it beat, or any doc claim that
needs human ratification becomes an **Open Clarification** (the Phase 2 gate). Import never silently
invents a rationale the doc did not contain.

**Discovery gists (`DISCOVERY_GISTS` from Phase 0.4, when present):** pass them as an
**authoritative input** alongside the epic and its stories, and tell the architect that these
decisions are **already settled**. Its job is to design on top of them, not to re-decide them.

They **do not replace the analysis**. The architect still designs the epic from scratch and the
coverage requirement below still applies to every story. The gists do **not** go through `--from`.
Import mode treats its document as *the* design, but a gist decides *what* to build and at what
scope. A gist carries no guarantees and settles almost nothing about how the epic is built, and that
is the part of a record the conformance gate later checks against.

A gist that **states a decision without its reasoning** becomes an **Open Clarification** for the
human, exactly as an unexplained decision in an imported design doc does. Never invent the missing
*why*.

```
Invoke: nxs-architect
Topic: Decision record for epic "<epic title>"
Resolved docs root: <docs-root>   # every doc path below is under this; on a repo-root hub it is `.`
Inputs to read:
- <IMPORT_DOC path>          # import mode ONLY (--from): the authoritative design doc — primary why source
- DISCOVERY_GISTS            # when present (Phase 0.4): decisions the discovery already settled —
                             #   authoritative, already decided, NOT a substitute for this analysis
- ${QDIR}/epic.md            # the epic and ALL its user stories — authoritative scope
- <docs-root>/product/context.md    # personas, strategy (reference, don't re-tabulate)
- <docs-root>/system/stack.md       # technology stack
- <docs-root>/system/standards/*    # standards-conformance pass (flag deviations + justify)
- Any concept reading-list pages named in epic.md `concepts:` frontmatter.
  (B3 makes this read live; until then it is manual / README-driven — if a concepts
  list is present, grep docs for the matching pages and read them. Do NOT block if absent.)

Record format: approval-first   # or: old format, for a --revise of a record approved in
                                #   the old format (chosen by Phase 3 step 1, before this call)
                                #   — then ask for the old sections instead of the list below

Produce, as human prose (no machine block, no file paths / type names / API or schema specs).
Number decisions D1…, guarantees G1…, risks R1… so each can cite the others by ID:
- MECHANISM: a Terms list defining once every internal name the decisions use, then the steps
  and data the decisions rely on (diagram only if load-bearing). Enough for the stage to write
  How it works from it in the epic's vocabulary.
- DECISIONS (core): one entry per real decision, every field given, `none` where it is empty:
  Decision; Why; Refuted viable alternative (only if a competent engineer might genuinely have
  chosen it and it lost on a real trade-off — never a strawman; otherwise `none`); Trade-off
  (what the choice gives up); Epic commitment affected (the issue, the exact current wording
  quoted from the epic or story, the exact new wording, status pending); Delivered by (the story
  that delivers it; a decision no story delivers is new scope and must be said so); Guarantees
  (the IDs it supports).
- GUARANTEES the build must preserve, including security boundaries: one checkable sentence each,
  grouped under headings naming what a reviewer checks, each ending with its supporting decision
  IDs. Behaviour already true that must not break goes under "Existing behaviour to preserve".
  Per-subsystem only — route any cross-cutting NFR budget to <docs-root>/system/standards/ instead.
- RISKS limited to BLOCKER / ADDRESS (those that force a human decision), each ADDRESS risk with
  who delivers its mitigation and whether that plan is already made. No likelihood×severity
  matrix, no speculative risks.
- CONCEPT-STORE CHANGES: only a concept-page statement the design changes, quoted, with its new
  wording.
- OPEN CLARIFICATIONS: ⚠️ NEEDS CLARIFICATION items only the human can resolve.

Do not write a summary or an approval brief: the stage writes How it works and the brief from
the fields above.

Coverage requirement: the decisions + guarantees must give design coverage for EVERY user
story in epic.md. An uncovered story fails this record's coverage requirement (verified in Phase 3).
Where a story needs a design split, describe it as a change to that story's scope — NOT a new task —
and give it as that decision's Epic commitment affected. The lead applies it; nobody edits the story.
```

**MANDATORY STOP:** do not format the record until the architect analysis returns.

## Phase 2 — Resolve open clarifications (MANDATORY STOP)

The architect may return `⚠️ NEEDS CLARIFICATION` items: design questions only the human can
answer. **Every one must be answered before the record is written.** They are a hard gate, not a
section to ship unresolved (mirrors the open-question block in `/nxs.epic`).

1. Collect every open clarification from the architect's output.
2. **None** → continue to Phase 3.
3. Otherwise present them **one at a time** through `AskUserQuestion`: render the question and its
   context as markdown, then call the tool with one option per plausible answer (the architect's
   proposed default first, labelled "(Recommended)"). The user can always pick "Other" for a custom
   reply.
4. Fold each answer into the decision-record content: into the affected decision, guarantee or
   mechanism. An answer that changes a story's scope is recorded as that decision's **Epic
   commitment affected** (the design-split rule), with the story's exact old and new wording. It is
   not a new open question, and this stage never edits the story issue itself.
5. **Write gate:** no open clarification reaches the written record. The approval-first template
   has no section for one, and the old-format template's `## Open Clarifications` section stays
   **empty**. If the `AskUserQuestion` UI is dismissed or skipped without answers, **stop and
   report that the gate is still open**. Do not fall back to writing the unresolved markers into the file, and do not
   proceed to Phase 4.

## Phase 3 — Format into the decision-record template

Write one idea per sentence. Put an aside in its own sentence, never between em-dashes. Use no
idiom or coined shorthand. Prefer the common word when it means the same thing. Name the noun when
"it" could point at two things. Say the exact strength you mean: "may", "should" and "must" differ.
Not "closure instantiates the entry, whose subsequent ingestion populates the store" but "close
creates the entry, and distill moves the entry into the concept store". Frontmatter, fenced code,
machine blocks, hashes, label names, shell commands and Given / When / Then lines stay as written.

1. **Choose the template, then read it.** Both are seeded project copies under
   `.nexus/config/templates/`, not the `common/templates/` masters.

    - **Every record, by default:** `.nexus/config/templates/decision-record-template.md`, the
      approval-first format.
    - **A `--revise` of a record approved in the old format:** its approved body
      (`gh issue view <record> $REPO_ARG --json body --jq .body`, or the committed
      `decision-record.md` on the old-contract path) has a `## Constraints & Invariants` section and
      no `## Guarantees` section. Draft the revision from
      `.nexus/config/templates/decision-record-template-v1.md`, and tell the architect in Phase 1
      that the record is in the old format. A revision keeps the format its record was approved in.
      The checkpoint marks the approved lines as frozen by matching their text, and a record
      converted to the new format would match none of them.

    If the default template has no `## Guarantees` section, it is a copy seeded before the
    approval-first format shipped, because seeding never overwrites a project's copy. Stop and say
    so: the lead moves that copy aside, runs `nexus seed-templates`, and carries any local tuning
    over into the new copy. If the old-format template is needed and absent, stop and name
    `nexus seed-templates` as the remedy; it adds only the templates a project does not have.
2. Read the epic's `complexity` frontmatter from `${QDIR}/epic.md`. It is the story-size rollup (0009)
   and selects the **required-section tier**. Apply the tier explicitly, not as a heuristic. If
   `complexity` is absent (a hand-filed epic resolved from an issue with no `nexus:epic-meta`
   block), default to **L**: require all sections rather than risk under-documenting.

    | `complexity` | Required sections |
    | --- | --- |
    | **S** or **M** | **How it works**, **Guarantees** and the appendix's **Decisions and reasons**. All other sections optional: omit if empty; do not force-fill. |
    | **L** or **XL** | **Every** template section, except Concept-store changes. A required section left empty states why. |

    The **Approval brief appears at every size whenever any of its groups has an entry**, because it
    is a list fixed by rule and a tier cannot make it optional. At L or XL an empty brief states
    why, like any other empty section. Concept-store changes appears only when the design changes a
    concept-store statement, at every size.

    An old-format revision keeps the old tiers: **Key Decisions** and **Constraints & Invariants**
    at S or M, and every section at L or XL.
3. **Fill the template.** The architect's output supplies the appendix, the guarantees and the
   risks. This stage writes How it works and the Approval brief itself, from that output. **The
   architect does not write the brief**, because the brief's content is fixed by rule and is not a
   choice of which items matter.

    - **Design rationale and mechanism** (the appendix). The architect's Mechanism, with its Terms
      list, then one **Decisions and reasons** entry per decision. Every entry gives every field:
      Decision, Why, Refuted viable alternative, Trade-off, Epic commitment affected (the issue,
      the exact old wording, the exact new wording and its status), Delivered by, and Guarantees.
      Write `none` for an empty field, so that an empty field is stated rather than forgotten. The
      `none` fields exist for the checkpoint, and they are removed from the filed body.
    - **Guarantees.** The architect's groups, each named for what a reviewer checks. Each
      guarantee ends with the decisions it supports, or sits under "Existing behaviour to
      preserve".
    - **Risks and dependencies**, and **Concept-store changes** when the architect named any.
    - **How it works.** Explain how the design meets the epic's outcomes, from the Mechanism and the
      decisions. Use only the vocabulary of the epic and its stories, and name no internal
      component: no term from the appendix's Terms list appears here. Do not restate an outcome the
      epic or a story already states; point to it when an anchor helps. About 300 words is a
      guideline, not a limit. When a clear explanation needs more, the section runs longer. Never
      cut content or a definition to meet the guideline.
    - **Approval brief.** Build it mechanically from the decisions, guarantees and risks. Omit an
      empty group.
        - **Resolve before approval:** every BLOCKER risk; every epic or story commitment whose
          status is not *amended* (the Phase 3.5 amendment check reads each against the live issue
          and moves a pending one to the top); every guarantee that cites no decision and is not under "Existing
          behaviour to preserve"; and, in a multi-story epic, every decision no story delivers.
        - **Choices with trade-offs:** every decision whose trade-off is not `none`, in plain
          words, with its trade-off as a sub-bullet.
        - **Before implementation:** every ADDRESS risk whose mitigation is a plan not yet made.
        - **Committed follow-up:** every ADDRESS risk whose mitigation is decided, with who
          delivers it.
        - **Revision delta:** on a `--revise` run only, the IDs of the decisions changed and
          withdrawn.

      Every decision with a trade-off appears in the brief exactly once. A decision listed under
      "Resolve before approval" carries its trade-off there, as a sub-bullet of its entry, and is
      not repeated under "Choices with trade-offs".
    - **An old-format revision** fills the old-format template from the old sections the architect
      returned, as the stage did before the approval-first format.
4. Delete all template guidance comments before writing.
4b. **Apply the razor** (load the **`nxs-razor`** skill; it is the same rule set `/nxs.epic` drafts
   under, and this command restates none of it).

    - **Materialize the run's source text** to `<scratch>/source.md` before labelling anything: the
      epic body and its stories, plus the imported design doc in `--from` mode. Every citation in
      this run is checked against that file and nothing else.
    - **Label every guarantee and every risk** inline, `[asked: "…"]` with a fragment quoted from
      `source.md`, or `[inferred]`. In an old-format revision, label every invariant and every
      risk instead. The vocabulary has two values. Decisions and refuted alternatives
      are not labelled; a refuted alternative is the model's own by construction, so the label would
      discriminate nothing.
    - **Check the draft**, and fix what blocks before going on:

        ```bash
        nexus razor-check --draft "<scratch>/record-body.labelled.md" --source "<scratch>/source.md" --record --epic "${QDIR}/epic.md"
        ```

      This stage has no gate agent and gains none. It runs the same checker the epic gate runs, over
      its own draft. In a new-format draft it blocks every guarantee and every risk that carries no
      label, so none can drop off the Phase 3.5 cut list. `--record` declares the draft a record, so
      a draft that reads as neither format, with no `## Guarantees` and no `## Constraints &
      Invariants` section, also blocks. Filed, it would give the later stages no parts to read. Fix
      the draft's headings to its template's; do not file it.

      In a new-format draft the checker also blocks each **cross-reference gap**, and names the
      guarantee or decision and its line:

        - a guarantee that cites no decision and is not under "Existing behaviour to preserve";
        - in a multi-story epic, a decision whose "Delivered by" is `none` or missing;
        - an epic or story change whose status is not *amended*;
        - a decision whose "Epic commitment affected" does not quote both the exact old and the
          exact new wording (an addition quotes an empty old wording, `Old: ""`);
        - a decision with a trade-off that the Approval brief does not list, or lists under both
          "Resolve before approval" and "Choices with trade-offs".

      The first three are allowed when the brief lists the item's ID under "Resolve before
      approval". The last two are not: give the wording, and list the decision once. "Listed" means
      the ID, such as `D3` or `G12`, appears as a whole word in the right group of the brief. An ID in
      another group does not count, and `D31` does not count for `D3`. The check proves that an ID is
      listed. It does not prove that the brief's sentence about it is right.

      `--epic` names the resolved `epic.md`, and the checker counts its story headings to decide
      whether the epic has more than one story. That file comes from one fixed producer, so its count
      does not depend on how `source.md` was assembled. Without `--epic`, the checker counts the
      stories in `source.md`.
5. **Verify story coverage:** every story in the epic's `## User Stories` is addressed by a decision or a
   guarantee. If a story is uncovered, return to Phase 1 for that story rather than shipping a record
   that leaves a story undesigned.

**The record body is pure human prose**. On the issue-sourced path it becomes a GitHub issue body,
and that body is the artifact the record hash is taken over. So:

- **No frontmatter and no hidden machine comment.** Strip the template's frontmatter entirely. Every
  field it carried is recoverable elsewhere: the epic from the native parent relationship, the
  complexity rating and concept list from the epic issue, the date and the approving account from the
  issue timeline. Anything in the body that churns for a non-design reason (a re-run date, a rating
  recomputed upstream) would produce false staleness and block a close for no reason.
- Start the body at the `# Decision Record: <epic title>` heading.
- **Old-contract epics only** (the committed-entry path) keep the template's frontmatter, exactly as
  today: `rating` = the epic's `complexity`; `epic` = the epic issue ref, bare, because this entry's
  own `issues_repo`, when the epic was filed into one, names what it resolves against;
  `feature`/`title`/`date`; and `concepts:` carried over from the epic.

**Refer to each asset by its local path, exactly as declared** (when `ASSETS` is set), inside the
decision it illustrates, as a Markdown image or link whose target is the declared path:
`![the chosen flow](diagrams/flow.png)`. Write the path verbatim; the Phase 3.6 rewrite matches it
exactly. **Nothing is published while drafting.** The approver judges a draft that names files on
the lead's machine, so declining at the checkpoint leaves the store unchanged. A declared asset the
draft never mentions is not published either. It is reported and skipped.

## Phase 3.5 — Pre-filing checkpoint (MANDATORY STOP)

This checkpoint runs **before every path that creates or updates the record sub-issue**, including
`--revise`. The record body is durable the instant it is filed and frozen the instant it is
approved, so a cut after filing is either an edit to a published body or a reopen. Both are worse
than not filing it.

**First, check every promised epic or story change against the live issue** (new format only; an
old-format revision has no "Epic commitment affected" field). A link to the epic does not prove the
epic was changed, so the check reads the issue itself. Run the amendment check on the labelled draft:

```bash
nexus record-amendments --draft "<scratch>/record-body.labelled.md" --root "<root>"
```

**A non-zero exit stops the run: file nothing.** Either an issue could not be read, or a commitment
line does not read as `<issue>. Old: "…". New: "…". Status: <status>.` Report the diagnostic
verbatim. Fix a malformed line and run the check again; never guess a result for an issue that
could not be read.

The command writes nothing. It prints `checked` (today's date) and one result per commitment, and
the stage writes each result into the labelled draft:

- **`amended`** (the exact new wording is on the issue) → set the decision's Status to
  `amended (verified <checked>)`. The change is no longer listed under "Resolve before approval".
  If its decision has a trade-off, that trade-off moves to "Choices with trade-offs".
- **`pending`** (the new wording is absent) → the Status stays `pending`. Add a **BLOCKER** risk to
  Risks and dependencies, at the next free R number and labelled `[inferred]`, because the model
  added it. It names the issue, the exact wording to apply, and what the issue says today:
  `R<n> BLOCKER — <issue> does not carry the change D<k> promises. Apply this exact wording:
  "<new>". <saysToday> [inferred]`. Then list the change **first** under "Resolve before approval",
  citing D<k> and R<n>, ending `Checked <checked>: <saysToday>`, with its decision's trade-off as a
  sub-bullet. `saysToday` quotes the old wording when the issue still carries it. When the issue
  carries neither the old nor the new wording, it says so. That usually means the record quotes the
  old wording wrongly, so check the decision's Old text against the issue before approval.
- **`unresolved`** → leave the line as written. The command does not read the issue for it, and it
  stays under "Resolve before approval" as Phase 3 listed it.

**The stage never makes the change itself.** It does not edit the text of the epic issue or of any
story issue to make the wording appear. The lead applies the wording on GitHub, or revises the
decision to the wording the issue already uses, and the check runs again on the next pass through
this checkpoint. A new BLOCKER risk is model-added, so it appears on the cut list below like any
other.

**Second, run the record checker again** on the labelled draft, now that the amendment results are
written into it:

```bash
nexus razor-check --draft "<scratch>/record-body.labelled.md" --source "<scratch>/source.md" --record --epic "${QDIR}/epic.md"
```

**A non-zero exit stops the run before the cut list is rendered: file nothing.** Report each finding
verbatim. Each one names a guarantee or a decision and its line, and is one of the cross-reference
gaps listed at Phase 3, step 4b. For each one, the lead either fixes the draft or lists the item
under "Resolve before approval", where the approver decides it. A change without its exact old and
new wording, or a trade-off missing from the brief, must be fixed; listing it does not clear it. Then
run the check again.

The first step already lists every pending change under "Resolve before approval". So for a change
that step checked, the pending-change block does not fire here. It fires for a change whose status
is `unresolved` and which the brief does not list, and for a draft the lead edited by hand after the
first step.

**Then judge viability.** You are formatting a record the **architect** wrote; you are not the
architect. Read each refuted alternative and ask whether its stated reason for losing names a
**trade-off**: what the alternative was better at, and what it gave up. Where it names none, report
that alternative as a **non-blocking observation**, prefixed with the razor's marker `⚠️ razor:`
(nxs-razor §4). It blocks nothing, it is rendered here and nowhere else, and it is **never written
into the draft body**. A render that did leak into the body is caught at Phase 3.6, because the
marker is one asserted string.

**Then render the cut list** (nxs-razor §8), directly above the choice. This gate's convention is
**removal**; a refuted alternative is not scope, so there is nothing here to add to. The list holds
**every refuted alternative, and every guarantee and every risk the model added**, because a gate that
shows the reviewer only part of what the model added leaves the rest of the labelling as decoration.
Every group of guarantees is read, "Existing behaviour to preserve" included. A decision whose refuted
viable alternative is `none` contributes no line, because `none` states that there was no
alternative. **A guarantee or a risk the lead asked for is not listed** — that is the lead's own
definition, and striking it is a revise, exactly as an asked-for acceptance criterion is treated at
the planning gate.

**An old-format revision** (drafted from the old-format template in Phase 3, step 1) is read by its
old sections: every refuted alternative under Key Decisions, and every invariant and every risk the
model added. Its approved lines are marked frozen exactly as before. The checker tells the two
formats apart by their headings, so the stage passes the same flags for both. Nothing converts an old
record to the new format.

**Ask the checker for the list; do not assemble it by hand.** Pass `--approved-body` **only when the
record sub-issue is closed** at this moment — the resolved `epic.md` carries `record_state: closed`.
Write that approved body to `<scratch>/record-approved.md` first
(`gh issue view <record> --json body --jq .body`). An **absent** record and an **open** one each take
no fetch and no flag: an open body is edited in place by design, so nothing about it is frozen.

```bash
nexus razor-offer --draft "<scratch>/record-body.labelled.md" --record \
    [--approved-body "<scratch>/record-approved.md"]     # only when record_state is closed
```

It prints one numbered list: every refuted alternative, under the decision it belongs to, then every
guarantee the model added, under its group, then every risk it added — **one sequence from 1**, in
the record's own section order, and **every line arrives ticked**, because a plain approval files the
record minus nothing. **Transcribe it; derive nothing.** A list assembled by hand can quietly omit the one line
this gate exists to show, and nothing downstream would notice; an omission from the checker is a test
failure.

Render the checker's lines **inside a fenced code block** (nxs-razor §8), under the heading, pasted
between the fences byte for byte — its group headings, its indentation and its numbers. The
reviewer's client renders markdown, and a numbered entry written as a markdown list is re-sequenced
from the list's own position — so entry 2 under the second decision comes back as 1, and the number
the reviewer types then names the wrong item. The fence suspends that.

````markdown
### What the model added — untick to cut

```
<every line of `nexus razor-offer --record` below its first, verbatim — for example:>

Refuted alternatives
  <Decision Title>
  [x] 1. <the alternative, as written> — <its stated reason for losing>
  <Decision Title>
  [x] 2. <the alternative, as written> — <its stated reason for losing>

Guarantees — model-added
  <Group heading>
  [x] 3. <the guarantee, verbatim minus its label>
  [x] 4. <the guarantee, verbatim minus its label> · frozen: the approved record already carries this

Risks — model-added
  [x] 5. <the risk, verbatim minus its label>
```

Type the numbers you want to cut, or nothing to file the record as drafted.
````

**Every line is numbered and a number flips exactly one line**, whatever kind that line is. There is
no group whose numbers mean something different from another group's. One typed selection carries the
whole decision — the same thing a number does at the planning gate, so a lead who runs both stages in
the same week reads "type 3" one way. What differs is only the direction the default points: this
gate files the record as drafted and a number **cuts**, because a refuted alternative is not scope and
a guarantee describes an epic whose scope the planning gate has already settled (nxs-razor §8).

**Keep the ticks in the text.** Do **not** render this as `AskUserQuestion` checkboxes — that control
cannot arrive pre-ticked, so an untouched box would mean *cut it* and the default would be
unrenderable (nxs-razor §8, the shared shape). The question below carries only the four actions.

Where the viability judgment above found an alternative that names no trade-off, show the
observation beside that alternative's number, under the fence, in the razor's own marked form —
`⚠️ razor: names no trade-off`. It is a thing to look at, not a cut and not a verdict.

**Then render the store line** (when `ASSETS` is set), so approval is informed consent to publish
there:

```markdown
**Assets:** <n> file(s) → `<ASSET_STORE>` (<public | private>) — <file names, comma-separated>
```

When the store is public and the issues repository is private (`nexus config resolve issues-repo`,
or the current repository when it resolves to nothing), add a warning under it: the files will be
world-readable while the record is not. **Warn; do not refuse**, because the team chose the store
deliberately. When the store is private and the issues repository is public, note that a reader
outside the team sees a broken image where a member sees the diagram.

Then ask via **`AskUserQuestion`** (per the interaction convention). Four options:

- **approve as drafted**: file the record as it stands.
- **approve with cuts**: the same, after removing the lines the reviewer names — alternatives,
  guarantees and risks alike.
- **revise**: return to Phase 1 for the decisions the reviewer names.
- **no record**: the epic proceeds without one (the Phase 0.2 step-4 exit: file nothing, remove the
  needs-design label, stop).

`approve with cuts` takes a typed list of the numbers. **One typed selection covers every kind the
list holds** — a number names one line, whether that line is a refuted alternative, a guarantee or a
risk. Delete each named line from the labelled draft **before** Phase 3.6 derives the filing body, so
it is gone before any issue is created or updated.

- **A new-format record keeps its numbers.** Do not renumber the guarantees or the risks. The gap a
  cut leaves stays, because decisions and the Approval brief cite guarantees and risks by ID, and
  renumbering would make every later citation name the wrong item. Note the ID of each cut guarantee
  and risk (`G3`, `R2`), and pass them to Phase 3.6 as `--cut`. Do not edit a line that cites a cut
  ID yet: the derive step names every such line, and the lead fixes each one.
- **An old-format revision renumbers, as before.** Renumber its invariant list without gaps, and
  check that no surviving prose refers to a cut item by its old number.

A reviewer may cut every line, including every guarantee; the section then files empty or is omitted
by its tier. There is no floor, because no razor rule may require an item to exist in order to
satisfy one (nxs-razor §5).

**Naming nothing is identical to plain approval**: the record files as drafted, with no re-render and
no second confirmation.

**A number naming a frozen line is refused**, with the reason and the route stated, never silently
ignored and never silently applied: the approved record is frozen, and approved content changes only
by Phase 4.5's reopen path not carrying it into the new body, under that path's supersession comment.
It never changes by being unticked here. On a `--revise` run most of the list is frozen for exactly
this reason, which is why the checker marks those lines when the list is rendered rather than leaving
the reviewer to meet the refusal one number at a time.

The checkpoint writes no file and is spent when it is answered. **`revise` and `no record` leave
the store untouched**: nothing is published before this checkpoint is answered with an approval,
and the publish itself is the first thing Phase 3.6 does after the labels come off.

## Phase 3.6 — Derive the filing body

The labelled draft is not what is filed. Once the checkpoint is answered and any cut is applied,
derive the filing body with the checker. It removes every label and every field written as `none`,
and asserts that nothing drafting-time survived:

```bash
nexus razor-check --draft "<scratch>/record-body.labelled.md" --derive "<scratch>/record-body.md" \
    [--cut "G3,R2"]     # the IDs of the guarantees and risks cut at Phase 3.5, new format only
```

**A non-zero exit stops the run: file nothing.** With `--cut`, the checker first searches the
labelled draft for each cut ID, as a whole token, so `G3` does not match `G31`. When a surviving
line still cites one, it names each such line by its line number, writes no body, and exits 1. Show
the lead those lines. The lead fixes each one by hand, for example by removing the ID from a
decision's Guarantees field, and the derive runs again. The stage never removes a citation itself,
because that would change what a decision says it supports. An old-format revision passes no
`--cut`; its renumbering was checked at Phase 3.5.

A `- **<Field>:** none` line exists for the checkpoint only, so the derived body carries none of
them. A field whose value says more than `none` is kept.

**Then publish the assets and rewrite their references (when `ASSETS` is set)**. This is the first
side effect after the checkpoint. It runs on the derived body, before the assertion and before any
issue is created or edited. `<feature-slug>` is the last segment of the epic's `feature_path` (the
resolved `epic.md` frontmatter carries it):

```bash
nexus assets rewrite --body "<scratch>/record-body.md" \
    --asset <path> [--asset <path> ...] \
    --feature "<feature-slug>"
```

It publishes every asset the body references, one commit per file, in declared order, with no
clone. It replaces each local path with the reference its reader renders: an image inline, any
other file a link at the pinned commit. **A non-zero exit stops the run: file nothing.** Anything it
had already published is harmless and unreferenced. An `unreferenced` entry is a declared file the
body never mentions: report it in Phase 5; nothing is written for it.

**Then assert that no drafting-time token and no declared local path survived:**

```bash
nexus razor-check --draft "<scratch>/record-body.md" --assert-clean \
    [--asset-path <path> ...]     # one per declared asset, when ASSETS is set
```

A non-zero exit stops the run: **file nothing**. The record body is the artifact the record hash is
taken over, so a label surviving into it would report a design that did not change as changed. The
same assertion fails on a surviving template placeholder token (`{{…}}`), on a surviving
observation marker (`⚠️ razor:`), on a field written as `none`, and on a local asset path the
rewrite missed, given this run's `--asset-path`s, matched exactly. So none of them reaches the filed
body.

This is a phase of its own rather than a step of Phase 3 because it runs **after** the Phase 3.5
checkpoint, so the body is derived from the draft the reviewer actually approved, cuts included.


## Phase 4 — File the record as a sub-issue of the epic

**Phase 4 and Phase 4.5 are filing steps, never entry points.** Every path reaches them through
Phases 1–3.6, including the Phase 3.5 checkpoint, which no filing path skips. The body they write
(`<scratch>/record-body.md`) is produced by Phase 3.6 from the Phase 1 analysis and is
coverage-verified there. Phase 0.2 and the `--revise` token select *which* filing path is taken
(file a new sub-issue, edit an open one, or reopen an approved one), never whether 1–3.6 run. If
`<scratch>/record-body.md` was not written by this run's Phase 3.6, stop: there is no new body to
file, and filing a stale one would overwrite a live record.

**Old-contract path (a committed queue entry):** write the filled template to
`${QDIR}/decision-record.md` exactly as today and skip the rest of this phase. Both paths coexist;
in-flight entries clear on their own.

**Issue-sourced path (the norm):** the record's durable home is a **sub-issue of the epic issue**,
carrying the record as its body. **Write no `decision-record.md` anywhere**: not into a committed
queue entry, not into the gitignored scratch path.

Do not proceed while any open clarification is unresolved (the Phase 2 gate).

1. **Write the body to a scratch file** (`<scratch>/record-body.md`), prose only, per Phase 3.6
   and the *Prose convention*, before any step below files or edits an issue.

2. **Existing record? Target it, never file a second one.** From Phase 0.2 you already know whether
   the epic has a record sub-issue.
    - **Open record** → update it in place: `gh issue edit <record> $REPO_ARG --body-file
      "<scratch>/record-body.md"`. Then go to step 5.
    - **Closed (approved) record** → its body is **frozen**. Do not edit it here. A body change is
      reachable only through the reopen that starts **Phase 4.5**; go there.
    - **No record** → continue to step 3.

3. **Create the sub-issue.** Its classification must match what the repo declares, resolved through
   the shared publishing resolver: `classification` selects label-vs-type, and the marker names
   come from the same resolver (Phase 0.2 already read `$RECORD_LABEL`):

    ```bash
    CLASSIFICATION="$(nexus config resolve classification --root "<root>")"
    RECORD_TYPE="$(nexus config resolve record-type --root "<root>")"
    ```

    **`labels` and `legacy-auto` modes**: create the label before applying it, so a repository that
    has never seen it does not fail half-way and leave the epic mislabelled:

    ```bash
    gh label create "$RECORD_LABEL" --color 5319E7 \
        --description "Epic decision record (why: key decisions, invariants, risks)" --force $REPO_ARG
    RECORD_URL="$(gh issue create $REPO_ARG --title "Decision Record: <epic title>" \
        --body-file "<scratch>/record-body.md" --label "$RECORD_LABEL")"
    ```

    **`types` mode**: the resolved record issue type replaces the label; do **not** pass
    `--label`. Create the issue without a marker, then apply `$RECORD_TYPE` with the `updateIssue`
    GraphQL mutation, the same two-step the epic and story creation skills use:

    ```bash
    RECORD_URL="$(gh issue create $REPO_ARG --title "Decision Record: <epic title>" \
        --body-file "<scratch>/record-body.md")"
    ```

    In both modes `gh issue create` prints the issue **URL**. Take its trailing path segment as the
    issue number and record it as `RECORD` (`RECORD="${RECORD_URL##*/}"`); the rest of this command
    reports and addresses the record as `#$RECORD`. If the type application fails in `types` mode
    (the repo has no such issue type), fall back to the label form above rather than filing an
    unmarked record, because an unmarked sub-issue reads back as a **story** to the resolver.

4. **Link it as a sub-issue of the epic** (the native parent relationship, not a comment):

    ```bash
    PARENT_ID="$(gh issue view <epic-issue> $REPO_ARG --json id --jq .id)"
    CHILD_ID="$(gh issue view $RECORD $REPO_ARG --json id --jq .id)"
    gh api graphql -H "GraphQL-Features: sub_issues" \
      -f query='mutation($p:ID!,$c:ID!){addSubIssue(input:{issueId:$p,subIssueId:$c}){subIssue{number}}}' \
      -F p="$PARENT_ID" -F c="$CHILD_ID"
    ```

    An "already linked" error on a re-run is success, not failure.

5. **Move the epic's labels**. The pair reads as a state machine on the epic issue, so the
   in-progress label is applied at design **completion**, not at filing. Create any label before
   applying it:

    ```bash
    gh label create "$IN_PROGRESS" --color 0E8A16 --description "Design filed; approval is the close of the record sub-issue" --force $REPO_ARG
    gh issue edit <epic-issue> $REPO_ARG --remove-label "$NEEDS_DESIGN" --add-label "$IN_PROGRESS"
    ```

    The label says the **record exists**, not that it is approved. This step runs before the step-6
    approval gate, and "Leave open for review" is a legitimate outcome. Approval lives in exactly one
    place, the record sub-issue's state, and nothing here may imply otherwise.

6. **Approval gate (`AskUserQuestion`).** Approval is the **close of the record sub-issue**. Nexus
   writes no approval field, label, or status anywhere, and the issue timeline supplies the approving
   account and the approval time for free. Ask:

    - **"Approve now"** → close it in this run: `gh issue close $RECORD $REPO_ARG --reason completed`.
    - **"Leave open for review (Recommended when others must sign off)"** → leave it open and say so.
      The lead (or a reviewer) closes it on GitHub later; that is **the same act**, so both paths
      converge with no second approval mechanism.

    Never close it as *not planned* to mean approval. A not-planned closure is a **withdrawn**
    design and blocks exactly as an open record does.

7. **Report the record's identity.** Read the canonical digest through the one digest program, never
   an ad-hoc shell hash:

    ```bash
    nexus record-digest --issue $RECORD ${ISSUES_REPO:+--repo $ISSUES_REPO}
    ```

8. **A workbook that teaches this epic pins its sources from the closed record.** That pinning is
   the teaching stage's step, not this one — the teaching stage ships as its own package now, and a
   stage does not drive a verb it does not ship. Nothing here does it and nothing here waits for it.
   Say in the Phase 5 report that the record is closed and available to be pinned from, so a lead
   who is teaching this epic knows the material is fixed; a lead who is not can ignore the line.

**Never** write anything under `docs/` (permanent human artifacts only), and never emit a
`{prefix}-hld.md`, a task index, or any per-task design.

## Phase 4.5 — Revise an approved record (reopen → comment → update → re-close)

Reached when the epic's record sub-issue is **closed** and the design must change (Phase 4 step 2,
or an explicit `--revise`). This is the **only** path that edits an approved body. Like Phase 4 it is
a filing step: Phases 1–3 have already run and `<scratch>/record-body.md` holds the new body, and
step 3 below only publishes it. `$RECORD` is the record sub-issue Phase 0 already reported (the
resolver's `record`, or Phase 0.2 step 2), and `$REPO_ARG` comes from Phase 0.2 step 1.

**A revision may carry new assets** (`--revise … --assets <path>…`). They went through the same
intake and the same Phase 3.6 publish-and-rewrite as a first filing, so the new body already
carries their references. Each is a **new commit** in the store, even when it reuses a file name
from the earlier record: the endpoint updates the path with a fresh commit and the earlier commit
stays. So every reference in the superseded body, embedded verbatim in the comment below, still
resolves to exactly what the earlier approver saw, because each reference pins a commit, not a
branch.

The freeze is what makes the record hash mean anything: if a closed body could change, "approved"
would name a moving target and every downstream stamp would be unfalsifiable. Reopening is the only
way to make the body editable, and it re-fires the conformance and close blocks until the record is
approved again. No separate invalidation mechanism exists or is needed.

Run these four acts **in order**, and do not skip one:

1. **Capture the superseded state, then reopen.** Take the current body and its canonical digest
   *before* anything changes, through the one digest program:

    ```bash
    gh issue view $RECORD $REPO_ARG --json body --jq .body > "<scratch>/superseded-body.md"
    nexus record-digest --issue $RECORD ${ISSUES_REPO:+--repo $ISSUES_REPO}
    gh issue reopen $RECORD $REPO_ARG
    ```

    Keep the printed `digest` as `SUPERSEDED_HASH`.

2. **Comment the supersession.** The reconstructability requirement is "from the comment trail
   alone", and GitHub's own edit history is not reliably retrievable by tooling. So the comment must
   **embed the superseded body verbatim**, not merely describe it. Write the comment to a scratch
   file and post it with `--body-file` (never inline, so the prose is not shell-escaped):

    ````markdown
    ## Record revised — <YYYY-MM-DD>

    **What changed:** <the substantive change, in one or two sentences>
    **Why:** <what forced it — new constraint, refuted assumption, scope edit>
    **Superseded body hash:** `<SUPERSEDED_HASH>`

    <details><summary>Superseded record body (verbatim)</summary>

    ```markdown
    <the exact contents of <scratch>/superseded-body.md>
    ```

    </details>
    ````

    Draft `<scratch>/revision-comment.md` under the *Prose convention*, like any other body. The
    embedded superseded body sits in a fenced block, which stays identical byte for byte.

    ```bash
    gh issue comment $RECORD $REPO_ARG --body-file "<scratch>/revision-comment.md"
    ```

    Ask the lead for the *what changed* and *why* through `AskUserQuestion` if they are not already
    evident from this run's analysis. A revision comment without them is not a record of anything.

3. **Update the body** to the new record. Phase 3 prose rules apply unchanged: no frontmatter, no
   machine comment.

    ```bash
    gh issue edit $RECORD $REPO_ARG --body-file "<scratch>/record-body.md"
    ```

4. **Re-close it**: the approval act, exactly as in Phase 4 step 6, and subject to the same gate.
   Approve now (`gh issue close $RECORD $REPO_ARG --reason completed`) or leave it open for a
   reviewer to close. While it is open, conformance and close stay blocked.

5. **Confirm the new identity.** Recompute the digest through the same program:

    ```bash
    nexus record-digest --issue $RECORD ${ISSUES_REPO:+--repo $ISSUES_REPO}
    ```

    It **must differ** from `SUPERSEDED_HASH`. That difference is what makes any receipt stamped
    against the earlier body detectably out of date. If the two are equal, the body did not actually
    change: say so, and do not claim a revision happened.

6. **A workbook teaching this epic pins from the revised body**, and that is the teaching stage's
   step, not this one. Nothing here does it and nothing here waits for it. Say in the revision report
   that the record was re-closed, so a lead who is teaching this epic knows there is a newer body to
   pin from; slices already pinned against the superseded body keep their sources, because a lesson
   may already have been written from them.

Report the revision: the record reference, the superseded hash, the new hash, and the record's
state.

**If the epic was already closed**, say so in the report and name the consequence: its committed
`close-record.md` stamped the superseded hash, so `/nxs.distill` will hard-error that entry. There
is deliberately no drain-side waiver. Recovery is the named procedure `/nxs.close` §
**"Recovery — re-stamp a closed entry whose record was revised after close"**: re-approve (done
above), re-stamp `record_hash`, rewrite the close record's Key Decisions / Deviation Rationale if
the design and not just the wording moved, then re-run the drain.

## Phase 5 — Report

Report concisely:

- The record: **issue reference** (`#<record>`) and its state, approved (closed) or open awaiting
  approval, plus the canonical digest from step 7. On the old-contract path, the file path instead.
- The epic it covers (title + issue ref), its `complexity` rating, and its labels now
  (`needs-design` removed, `in-progress` applied).
- The record's format (approval-first, or old format for a revision of an old-format record) and
  its sections **filled** vs. **tiered out** (e.g. "S epic → How it works, Guarantees, Decisions and
  reasons; Approval brief with two choices; other sections omitted").
- Open clarifications: **none**, or **N resolved** at the Phase 2 gate (none reaches the filed
  record).
- Story coverage: confirm every user story is addressed by a decision or a guarantee.
- Workbook sources (when a workbook teaches this epic): that the record is closed and available to
  pin from, or that it is left open and nothing can be pinned from it yet.
- Next step: implement the stories, then `/nxs.analyze`. That stage **will not run** while the
  record is unapproved, so an open record must be closed before conformance can be checked.

# Usage

```
/nxs.decision-record                              # committed entry from the current branch, else resolve from its linked epic issue
/nxs.decision-record 118                          # resolve epic issue #118 via the resolver (no committed entry needed)
/nxs.decision-record path/to/epic.md             # design an explicit queue entry
/nxs.decision-record --from docs/design/x.md     # import an existing design doc as the record's basis
/nxs.decision-record --from ~/plan.md 118        # import a design doc, epic resolved from issue #118
/nxs.decision-record --revise 118                # revise the approved record: reopen, comment, update, re-close
/nxs.decision-record 118 --assets diagrams/flow.png,mockups/detail.html   # file the record with the pictures it was decided against
```

# Constraints

- **No 16-section HLD, no per-task LLD, no task index, no `story_ref`**: the story is the
  implementation unit (0009) and `/nxs.tasks` is cut (0010). A design split changes an existing
  story's scope, not a new task. It is recorded as an Epic commitment affected for the lead to apply.
- **Human prose only.** System A emits no machine artifact; the distiller (System B) derives the
  ConceptDelta later from the record + close record and the diff (0006). On the issue-sourced path
  the body carries **no frontmatter and no hidden machine comment**, because the body is the hashed
  artifact.
- **One record per epic, and exactly one copy of it.** A re-run targets the existing record
  sub-issue and never files a second one. For an issue-sourced epic **no `decision-record.md` is
  written anywhere**: not into a committed queue entry, not into the gitignored scratch path.
- **A closed record's body is frozen.** Every path here except Phase 4.5 leaves an approved body
  untouched; a body change is reachable only through the reopen that phase begins with. Reopening
  re-fires the conformance and close blocks until the record is approved again, and there is no
  second invalidation mechanism.
- **A revision's comment carries the superseded body verbatim**, its hash, and the reason it was
  superseded, dated. So every previously approved state is reconstructible from the comment trail
  alone. Describing the change instead of embedding it would lose the state, because the platform's
  own edit history is not reliably retrievable by tooling.
- **Never write `docs/`.** `docs/` is permanent human artifacts only (0005). An old-contract epic's
  record stays in its committed queue entry, as today.
- **An asset is a picture of a decision, never a substitute for its why.** With `--assets` the
  body still carries every rationale in prose. The files are published to the declared store only
  after the Phase 3.5 checkpoint is answered with an approval, each reference pins the commit that
  published it, and no local path reaches the record; the Phase 3.6 assertion fails the run on one.
  A repository with no declared store files the record without them and says so once.
- **Labels are created before they are applied**, and this stage writes only the **epic's** labels
  and its **record sub-issue**. It never touches a story issue.
- **The stage never edits the text of the epic issue or of any story issue**, on any path: drafting,
  the checkpoint, filing, or `--revise`. Its one write to the epic issue is moving the epic's labels
  (needs-design to in-progress at filing, or removing needs-design on "no record"). A decision that
  changes what the epic or a story says is recorded as that decision's Epic commitment affected,
  with status pending, and the Phase 3.5 amendment check reports whether the lead has applied it.
- **Approval is the close of the record sub-issue.** Never write an approval field, an `approved`
  label, or a status anywhere, and never infer approval from any other signal. Nexus applies no
  permission check of its own: whoever can close the sub-issue is the approver, and the timeline
  records who and when.
- **Discovery gists are an input, never a substitute.** The marked comments on the epic issue are
  read as decisions the discovery already settled, and the command still runs its own architectural
  analysis and still checks story coverage. It **never edits or removes** those comments, and it
  reads **only** the marked ones. An epic with no marked comment behaves exactly as before: no new
  prompt, no empty section.
- **`--from` imports a design doc; it does not copy it.** The doc is the authoritative *why*
  source, but the record it produces is still abstracted domain prose (no code / file paths / type
  names) covering every story, and every decision still carries its *why*. A doc that states a
  choice without a rationale, or without the viable alternative it beat, raises an Open Clarification
  rather than shipping an unsupported entry. The source doc stays where it lives; only the record is
  filed.
