---
name: nxs.decision-record
description: Add the architectural decision record to a planned epic — the focused "why" (key decisions + refuted alternatives, invariants, risks), tiered by complexity. Reads the epic and its stories; files the record as a sub-issue of the epic issue (its durable home) and moves the epic from needs-design to in-progress, with approval being the close of that sub-issue. An old-contract committed queue entry still gets decision-record.md beside epic.md. With `--from <path>` it imports an existing design doc (a developer HLD or plan) as the authoritative basis for the record instead of analyzing from scratch; with `--revise` it reopens an approved record, records what it supersedes, updates it, and re-closes it. Next stage is implementation, then /nxs.analyze validates conformance.
category: engineering
tools: Read, Grep, Glob, Write, Bash, Task, Skill, AskUserQuestion
model: inherit
---

# Role

Produce the **decision record** for one planned epic: the focused architectural "why" that the
distiller later mines (the rationale). It must give design coverage for every story in the epic —
coverage is verified here (Phase 3), not by a downstream gate. It is human prose, tiered by
complexity, and its home is a **sub-issue of the epic issue** — one copy, born durable, addressable
by the issue-reference form the knowledge store already uses for provenance.

**Approval is a native act:** closing that sub-issue. Nexus writes no approval field, so the
approving account and the approval time come from the issue timeline, and an unapproved record
visibly blocks every stage downstream of it.

**The design spans the whole epic, not a single story.** One record covers the epic; its decisions and
invariants must hold across every story (that is what coverage means). The **story** is the unit of
*implementation* and of the GitHub issue (0009) — there is no task layer below it — but it is not the
unit of design. Read all stories together and design for the epic.

You delegate the analysis to the `nxs-architect` agent, then format its output into the seeded
decision-record template and file it as the record sub-issue (or, for an old-contract epic that has
a committed queue entry, write it into that entry as before).

# User Input

```text
$ARGUMENTS
```

`$ARGUMENTS` may name a queue entry, an `epic.md`, or its directory. Empty is the normal case —
resolve the entry from the current branch in Phase 0.

**Import mode — `--from <path>`.** If `$ARGUMENTS` contains `--from <path>` (string-matched, like
`/nxs.epic --resume`), the decision record is derived from the **existing design doc** at `<path>` —
a developer HLD, a plan, or any out-of-band design write — instead of a fresh from-scratch analysis.
This is the supported bridge for work designed outside the pipeline (CLAUDE.md: "a developer HLD …
enters Nexus only via the lead's `/nxs.decision-record --from` at approval"): the doc supplies the *why*, the
queued `epic.md` still supplies the scope the record must cover. Strip the `--from <path>` token
before resolving the entry path from the rest of `$ARGUMENTS`.

**Revision mode — `--revise`.** If `$ARGUMENTS` contains `--revise` (string-matched), the epic's
**approved** record is being changed rather than written for the first time. The token selects
**which filing path Phase 4 takes — it does not select where the run starts.** Run Phase 0.2's
**resolution** steps 1–2 as usual (they establish `$REPO_ARG` and the label names every later `gh`
call needs) but skip its step-3 **gate** — that gate answers "does this epic warrant a record", and a
revision already presupposes the answer. Then run **Phase 0.4** (it runs on every path, revision
included) and **Phases 1–3** to produce the new body, and file it through **Phase 4.5**, which reopens
the record, records what is being superseded, updates the body, and re-closes it. Strip the token
before resolving the entry path. Without an existing closed record there is nothing to revise — say so
and run the normal path instead.

## Interaction convention — actionable choice gates

Every point where this command asks the user to choose — the multi-entry epic selection in Phase 0
and the open-clarification gate in Phase 2 — is presented through the **`AskUserQuestion`** tool, not
a free-text prompt the user has to read and type a reply to. Render any context first as ordinary markdown, then call
`AskUserQuestion` with one option per choice (a short label plus a one-line description of its
effect). This renders one selectable option per line in both the VS Code extension and the terminal.
The user can always pick "Other" for a custom answer.

Run the phases in order.

## Phase 0 — Resolve the epic (dual-read: committed entry, else resolve from the issue)

The epic and its story issues already exist (filed by `/nxs.epic`). Obtain the epic — either from a
committed queue entry (an old-contract epic, including #114 itself) or, when nothing was committed at
planning (#114), by resolving its issue number through the resolver. `/nxs.decision-record` **reads** the epic;
it never hard-fails with "queue entry not found" just because planning committed nothing.

1. **Explicit path** — if `$ARGUMENTS` points at a queue entry / `epic.md` / its directory, use that.
   Record `QDIR` = that directory and skip to step 4.
2. **Committed entry (transitional)** — else glob:

    ```bash
    ls -d .nexus/queue/*/epic.md 2>/dev/null   # an entry is a dir carrying epic.md
    ```

    A `.nexus/queue/epic-<n>/` holding only per-user decision scratch (`--revise` on an epic already
    in implementation) is **not** a committed entry — hence the `epic.md` requirement.

    - **≥1 entry** → today's behavior: **1** → use it; **>1** → read each `epic.md` title and ask
      which via `AskUserQuestion` (label = epic title, description = queue path + complexity). Record
      `QDIR`. This is the path #114's own entry (and any other old-contract epic) takes — the resolver
      path (invariant 14) governs epics planned after the migration.
    - **0 entries** → go to step 3.
3. **Resolve from the issue number** — no committed entry exists, so reconstruct the epic (invariant
   11: zero reads of a committed planning file; the story set + success metrics come from the live
   GitHub issue state at resolve time):
    - **Epic issue number (invariant 12):** the explicit `#<n>` / `<n>` in `$ARGUMENTS` if given; else
      derive it from the current branch's linked issue — the issue its open PR closes, then that
      issue's **parent epic** (`gh pr view --json ...` for the branch's PR and its closing issue; or
      the `#<n>` in the branch name). If you cannot determine it unambiguously, ask the user for the
      epic issue number and stop until answered.
    - **Materialize:**

        ```bash
        nexus epic-resolve --epic <n>
        ```

      On a non-zero exit, report the diagnostic (`epic-resolve <problem>: <message>`) and stop. On
      success it prints `{ epic, targetRoot, outPath, record }`; record `QDIR` = the directory of
      `outPath` (a materialized `epic.md` under the gitignored `.nexus/tmp/`) and keep `record` —
      the epic's decision-record sub-issue (`{ number, state }`), or `null` when it has none.
4. `QDIR` **must** contain `epic.md`. If it does not, ERROR. Stop.

**Decision-record home.** On the **committed-entry** path (an old-contract epic), `QDIR` is the
committed queue entry and the record is committed there as today. On the **resolver** path the
record's home is a **sub-issue of the epic issue** (#139) — see Phase 4 — and **no
`decision-record.md` is written anywhere** for such an epic.

## Phase 0.2 — Does this epic warrant a decision record?

Not every epic needs one. The answer is read from the **issue graph**, never remembered: the
**needs-design** label on the epic issue is the claim, and the record sub-issue is the artifact.
That is what makes an epic filed by hand outside Nexus — no label, no record — work for free.

1. Resolve the target repo and the label names **through the shared publishing resolver** — never by
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
    `REPO_ARG` stays empty. **Every `gh` call below — `issue`, `label`, `api` — carries
    `$REPO_ARG`**, and it is the only form used: a second spelling of the same argument is a second
    thing to keep in sync.

2. Read the epic issue's labels and its record sub-issue (the resolver already reported the latter
   as `record` in its JSON output / the materialized frontmatter's `record` + `record_state`):

    ```bash
    gh issue view <epic-issue> $REPO_ARG --json labels --jq '[.labels[].name]'
    ```

3. **Decide the run's shape:**

    - **Record sub-issue already exists** → this is a re-run or a revision. **Continue to Phase 1**
      as normal — the body a re-run files still comes from Phases 1–3. Phase 4 step 2 then targets
      the existing sub-issue; a second record is never filed. A record that is already **closed** is
      approved and frozen — changing it is **Phase 4.5**, whose first act is the reopen.
    - **`needs-design` present, no record sub-issue** → the normal path. Continue to Phase 1.
    - **Neither present** (an S epic, or a hand-filed epic) → the epic claims no design is needed.
      Confirm with the lead via `AskUserQuestion` — **"Proceed without a record (Recommended)"** vs
      **"Design it anyway"**. On the first, stop and report that the epic proceeds without a decision
      record (file nothing, change no label). On the second, continue to Phase 1 and let Phase 4
      apply the labels as usual.

4. **The no-design-needed outcome is available at every checkpoint below.** Whenever the analysis
   (or the lead's judgement at the Phase 2 / Phase 3.5 gates) concludes that no record is warranted:

    - file **no** sub-issue and write **no** record file;
    - remove the needs-design label from the epic issue —

        ```bash
        gh issue edit <epic-issue> $REPO_ARG --remove-label "$NEEDS_DESIGN"
        ```

    - report plainly that **the epic proceeds without a decision record**, and stop.

    This is the only deliberate way to reach "this epic legitimately has no record" — which is also
    the only state in which `/nxs.analyze` may run in its degraded no-invariant mode.

## Phase 0.4 — Read the discovery gists off the epic issue

An epic that came from a `/nxs.discover` discovery carries the decisions that discovery resolved, as
comments on the epic issue written when the discovery graduated. Read them **before** analysing, so
the record is designed on top of what was already settled instead of re-deriving it.

This is the **only** change discovery makes to this command. It runs on every path (normal, import,
and revision) and needs no flag — the epic issue either carries marked comments or it does not.

1. Fetch the epic issue's comments and keep **only** the ones whose body contains the marker
   `<!-- nexus:discovery-gists -->`:

    ```bash
    gh issue view <epic-issue> $REPO_ARG --json comments \
        --jq '[.comments[] | select(.body | contains("<!-- nexus:discovery-gists -->")) | .body]'
    ```

    `$REPO_ARG` is the resolved issues-repo from Phase 0.2 — the epic issue may not live in the repo
    this command runs from.

2. **No marked comment** → this epic did not come from a discovery. Continue exactly as today: no
   new prompt, no new question, and **no empty section** anywhere in the record. Skip the rest of
   this phase.

3. Otherwise keep the collected gists as **`DISCOVERY_GISTS`** for Phase 1.

**Only marked comments are read.** An epic issue accumulates ordinary discussion, and feeding all of
it to the architect degrades the input. Capturing an out-of-band decision comment in the general case
is worth solving on its own terms and is not solved here.

**This command never edits or removes those comments.** It reads them and nothing else. They are the
copy that survived promotion rewriting the stub body, and they are the only durable carrier of the
discovery's reasoning once the discovery folder is gone.

## Phase 0.5 — Load the design doc (import mode only)

**Skip without `--from`.** With `--from <path>`, read the design doc at `<path>` (it lives outside
the queue — a docs-space HLD, or a machine-local plan). If it does not exist or is empty, ERROR and
stop — import mode has nothing to import. Keep its content as **`IMPORT_DOC`** for Phase 1. The doc
is the authoritative *why* source; the from-scratch architect analysis is replaced by a
**doc-derivation** pass (Phase 1). The doc may contain code, file paths, and type names — those are
**stripped** when deriving the record (the record is decisions-and-rationale prose only; §template
rule: no file paths / type names / API specs).

## Phase 1 — Architectural analysis (delegate to nxs-architect)

**Resolve the docs root first** (the architect reads context under it; it never resolves for itself).
Run the docs-root read-out:

```bash
nexus workspace docs-root
```

Capture the printed line as **`<docs-root>`** (`docs` for single-repo/member, `.` for a repo-root hub,
or the override). **On a non-zero exit, stop and report the diagnostic** — never pass a fake `docs`
value nor treat failure as "context absent".

Invoke `nxs-architect` in **decision-record mode**. The architect produces the decision *content* — the
"why", not a 16-section document.

**Import mode (`--from`):** pass `IMPORT_DOC` (Phase 0.5) as the FIRST, authoritative input and tell
the architect to **derive** the record from it — extract the decisions, the refuted viable
alternatives, the invariants, and the BLOCKER/ADDRESS risks the doc already states, rather than
re-designing from scratch. Fresh reasoning is used only to (a) abstract any code / file paths / type
names in the doc into domain prose and (b) verify story coverage. Any decision the doc states without
a *why*, any choice it made without recording the viable alternative it beat, or any doc claim that
needs human ratification becomes an **Open Clarification** (the Phase 2 gate) — import never silently
invents a rationale the doc did not contain.

**Discovery gists (`DISCOVERY_GISTS` from Phase 0.4, when present):** pass them as an
**authoritative input** alongside the epic and its stories, and tell the architect that these
decisions are **already settled** — its job is to design on top of them, not to re-decide them.

They **do not replace the analysis**. The architect still designs the epic from scratch and the
coverage requirement below still applies to every story. This is why the gists do **not** go through
`--from`: import mode treats its document as *the* design and derives the record from it, whereas a
gist decides *what* to build and at what scope. A gist settles almost nothing about how the epic is
built and carries no invariants, which is the part of a record the conformance gate later checks
against — so routing them through import mode would skip the design work on the grounds that the
scope work was done.

A gist that **states a decision without its reasoning** becomes an **Open Clarification** for the
human, exactly as an unexplained decision in an imported design doc does today. Never invent the
missing *why*.

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

Produce, as human prose (no machine block, no file paths / type names / API or schema specs):
- A 2–3 sentence summary of what is built and the shape of the chosen approach.
- The chosen approach in a few sentences (diagram only if load-bearing).
- KEY DECISIONS (core): one entry per real decision — what was decided, why, and the
  refuted VIABLE alternative + why it lost. Guardrail (C1/G2): include an alternative only
  if a competent engineer might genuinely have chosen it and it lost on a real trade-off —
  never a strawman. Omit the alternative line if none was viable.
- CONSTRAINTS & INVARIANTS the build must preserve, including security boundaries.
  Per-subsystem only — route any cross-cutting NFR budget to <docs-root>/system/standards/ instead.
- RISKS limited to BLOCKER / ADDRESS (those that force a human decision). No likelihood×severity
  matrix, no speculative risks.
- OPEN CLARIFICATIONS: ⚠️ NEEDS CLARIFICATION items only the human can resolve.

Coverage requirement: the decisions + invariants must give design coverage for EVERY user
story in epic.md. An uncovered story fails this record's coverage requirement (verified in Phase 3).
Where a story needs a design split, describe it as an edit to that story's scope — NOT a new task.
```

**MANDATORY STOP:** do not format the record until the architect analysis returns.

## Phase 2 — Resolve open clarifications (MANDATORY STOP)

The architect may return `⚠️ NEEDS CLARIFICATION` items — design questions only the human can
answer. **Every one must be answered before the record is written.** They are a hard gate, not a
section to ship unresolved (mirrors the open-question block in `/nxs.epic`).

1. Collect every open clarification from the architect's output.
2. **None** → continue to Phase 3.
3. Otherwise present them **one at a time** through `AskUserQuestion`: render the question and its
   context as markdown, then call the tool with one option per plausible answer (the architect's
   proposed default first, labelled "(Recommended)"). The user can always pick "Other" for a custom
   reply.
4. Fold each answer into the decision-record content — into the affected decision, invariant, or
   approach. An answer that changes a story's scope is reflected as an **edit to that story**
   (the design-split rule), not a new open question.
5. **Write gate:** the written record's `## Open Clarifications` section must be **empty**. If the
   `AskUserQuestion` UI is dismissed or skipped without answers, **stop and report that the gate is
   still open** — do not fall back to writing the unresolved markers into the file, and do not
   proceed to Phase 4.

## Phase 3 — Format into the decision-record template

1. Read the seeded project template: `.nexus/config/templates/decision-record-template.md` (the
   project copy, not the `common/templates/` master).
2. Read the epic's `complexity` frontmatter from `${QDIR}/epic.md`. It is the story-size rollup (0009)
   and selects the **C5 required-section whitelist** — apply it explicitly, not as a heuristic. If
   `complexity` is absent (a hand-filed epic resolved from an issue with no `nexus:epic-meta` block),
   default to **L** — require all sections rather than risk under-documenting:

    | `complexity` | Required sections |
    | --- | --- |
    | **S** or **M** | **Key Decisions** + **Constraints & Invariants** only. All other sections optional — omit if empty; do not force-fill. |
    | **L** or **XL** | **All** template sections required. A required section left empty needs a stated reason. |

3. Fill the template from the architect's output.
4. Delete all template guidance comments before writing.
5. **Verify story coverage:** every story in the epic's `## User Stories` is addressed by a decision or
   invariant. If a story is uncovered, return to Phase 1 for that story rather than shipping a record
   that leaves a story undesigned.

**The record body is pure human prose** — on the issue-sourced path it becomes a GitHub issue body,
and that body is the artifact the record hash is taken over. So:

- **No frontmatter and no hidden machine comment.** Strip the template's frontmatter entirely. Every
  field it carried is recoverable elsewhere — the epic from the native parent relationship, the
  complexity rating and concept list from the epic issue, the date and the approving account from the
  issue timeline. Anything in the body that churns for a non-design reason (a re-run date, a rating
  recomputed upstream) would produce false staleness and block a close for no reason.
- Start the body at the `# Decision Record: <epic title>` heading.
- **Old-contract epics only** (the committed-entry path) keep the template's frontmatter, exactly as
  today — `rating` = the epic's `complexity`, `epic` = the epic issue ref, `feature`/`title`/`date`,
  and `concepts:` carried over from the epic.

## Phase 4 — File the record as a sub-issue of the epic

**Phase 4 and Phase 4.5 are filing steps, never entry points.** Every path reaches them through
Phases 1–3: the body they write (`<scratch>/record-body.md`) is produced by Phase 3 from the Phase 1
analysis and is coverage-verified there. Phase 0.2 and the `--revise` token select *which* filing
path is taken — file a new sub-issue, edit an open one, or reopen an approved one — never whether
1–3 run. If `<scratch>/record-body.md` was not written by this run's Phase 3, stop: there is no new
body to file, and filing a stale one would overwrite a live record.

**Old-contract path (a committed queue entry):** write the filled template to
`${QDIR}/decision-record.md` exactly as today and skip the rest of this phase. Both paths coexist;
in-flight entries clear on their own.

**Issue-sourced path (the norm):** the record's durable home is a **sub-issue of the epic issue**,
carrying the record as its body — one copy, born durable, addressable by the same issue-reference
form the knowledge store already uses for provenance. **Write no `decision-record.md` anywhere** —
not into a committed queue entry, not into the gitignored scratch path.

Do not proceed while any open clarification is unresolved (the Phase 2 gate).

1. **Write the body to a scratch file** (`<scratch>/record-body.md`) — prose only, per Phase 3.

2. **Existing record? Target it, never file a second one.** From Phase 0.2 you already know whether
   the epic has a record sub-issue.
    - **Open record** → update it in place: `gh issue edit <record> $REPO_ARG --body-file
      "<scratch>/record-body.md"`. Then go to step 5.
    - **Closed (approved) record** → its body is **frozen**. Do not edit it here. A body change is
      reachable only through the reopen that starts **Phase 4.5** — go there.
    - **No record** → continue to step 3.

3. **Create the sub-issue.** Its classification must match what the repo declares, resolved through
   the shared publishing resolver — `classification` selects label-vs-type, and the marker names
   come from the same resolver (Phase 0.2 already read `$RECORD_LABEL`):

    ```bash
    CLASSIFICATION="$(nexus config resolve classification --root "<root>")"
    RECORD_TYPE="$(nexus config resolve record-type --root "<root>")"
    ```

    **`labels` and `legacy-auto` modes** — create the label before applying it, so a repository that
    has never seen it never fails a run half-way and never leaves the epic mislabelled:

    ```bash
    gh label create "$RECORD_LABEL" --color 5319E7 \
        --description "Epic decision record (why: key decisions, invariants, risks)" --force $REPO_ARG
    RECORD_URL="$(gh issue create $REPO_ARG --title "Decision Record: <epic title>" \
        --body-file "<scratch>/record-body.md" --label "$RECORD_LABEL")"
    ```

    **`types` mode** — the resolved record issue type replaces the label; do **not** pass
    `--label`. Create the issue without a marker, then apply `$RECORD_TYPE` with the `updateIssue`
    GraphQL mutation — the same two-step the epic and story creation skills use:

    ```bash
    RECORD_URL="$(gh issue create $REPO_ARG --title "Decision Record: <epic title>" \
        --body-file "<scratch>/record-body.md")"
    ```

    In both modes `gh issue create` prints the issue **URL**; take its trailing path segment as the
    issue number and record it as `RECORD` (`RECORD="${RECORD_URL##*/}"`) — the rest of this command
    reports and addresses the record as `#$RECORD`. If the type application fails in `types` mode
    (the repo has no such issue type), fall back to the label form above rather than filing an
    unmarked record — an unmarked sub-issue reads back as a **story** to the resolver.

4. **Link it as a sub-issue of the epic** (the native parent relationship, not a comment):

    ```bash
    PARENT_ID="$(gh issue view <epic-issue> $REPO_ARG --json id --jq .id)"
    CHILD_ID="$(gh issue view $RECORD $REPO_ARG --json id --jq .id)"
    gh api graphql -H "GraphQL-Features: sub_issues" \
      -f query='mutation($p:ID!,$c:ID!){addSubIssue(input:{issueId:$p,subIssueId:$c}){subIssue{number}}}' \
      -F p="$PARENT_ID" -F c="$CHILD_ID"
    ```

    An "already linked" error on a re-run is success, not failure.

5. **Move the epic's labels** — the pair reads as a state machine on the epic issue, so the
   in-progress label is applied at design **completion**, not at filing (a label applied at filing
   would say nothing about whether design had happened). Create any label before applying it:

    ```bash
    gh label create "$IN_PROGRESS" --color 0E8A16 --description "Design filed; approval is the close of the record sub-issue" --force $REPO_ARG
    gh issue edit <epic-issue> $REPO_ARG --remove-label "$NEEDS_DESIGN" --add-label "$IN_PROGRESS"
    ```

    The label says the **record exists**, not that it is approved — this step runs before the step-6
    approval gate, and "Leave open for review" is a legitimate outcome. Approval lives in exactly one
    place, the record sub-issue's state, and nothing here may imply otherwise: a label that read
    "design approved" would assert approval the epic has not got, which is the precise confusion this
    epic exists to remove.

6. **Approval gate (`AskUserQuestion`).** Approval is the **close of the record sub-issue** — Nexus
   writes no approval field, label, or status anywhere, and the issue timeline supplies the approving
   account and the approval time for free. Ask:

    - **"Approve now"** → close it in this run: `gh issue close $RECORD $REPO_ARG --reason completed`.
    - **"Leave open for review (Recommended when others must sign off)"** → leave it open and say so.
      The lead (or a reviewer) closes it on GitHub later; that is **the same act**, so both paths
      converge with no second approval mechanism.

    Never close it as *not planned* to mean approval — a not-planned closure is a **withdrawn**
    design and blocks exactly as an open record does.

7. **Report the record's identity.** Read the canonical digest through the one digest program — never
   an ad-hoc shell hash:

    ```bash
    nexus record-digest --issue $RECORD ${ISSUES_REPO:+--repo $ISSUES_REPO}
    ```

**Never** write anything under `docs/` (permanent human artifacts only), and never emit a
`{prefix}-hld.md`, a task index, or any per-task design.

## Phase 4.5 — Revise an approved record (reopen → comment → update → re-close)

Reached when the epic's record sub-issue is **closed** and the design must change (Phase 4 step 2,
or an explicit `--revise`). This is the **only** path that edits an approved body. Like Phase 4 it is
a filing step: Phases 1–3 have already run and `<scratch>/record-body.md` holds the new body — step 3
below only publishes it. `$RECORD` is the record sub-issue Phase 0 already reported (the resolver's
`record`, or Phase 0.2 step 2), and `$REPO_ARG` comes from Phase 0.2 step 1.

The freeze is what makes the record hash mean anything: if a closed body could change, "approved"
would name a moving target and every downstream stamp would be unfalsifiable. Reopening is therefore
not ceremony — it is the only way to make the body editable, and it re-fires the conformance and
close blocks automatically until the record is approved again. No separate invalidation mechanism
exists or is needed.

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
   alone" — GitHub's own edit history is not reliably retrievable by tooling — so the comment must
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

    ```bash
    gh issue comment $RECORD $REPO_ARG --body-file "<scratch>/revision-comment.md"
    ```

    Ask the lead for the *what changed* and *why* through `AskUserQuestion` if they are not already
    evident from this run's analysis. A revision comment without them is not a record of anything.

3. **Update the body** to the new record (Phase 3 prose rules apply unchanged — no frontmatter, no
   machine comment):

    ```bash
    gh issue edit $RECORD $REPO_ARG --body-file "<scratch>/record-body.md"
    ```

4. **Re-close it** — the approval act, exactly as in Phase 4 step 6, and subject to the same gate:
   approve now (`gh issue close $RECORD $REPO_ARG --reason completed`) or leave it open for a
   reviewer to close. While it is open, conformance and close stay blocked.

5. **Confirm the new identity.** Recompute the digest through the same program:

    ```bash
    nexus record-digest --issue $RECORD ${ISSUES_REPO:+--repo $ISSUES_REPO}
    ```

    It **must differ** from `SUPERSEDED_HASH` — that difference is what makes any receipt stamped
    against the earlier body detectably out of date. If the two are equal, the body did not actually
    change: say so, and do not claim a revision happened.

Report the revision: the record reference, the superseded hash, the new hash, and the record's
state. Every earlier approved state stays recoverable from the comment trail alone, revision by
revision.

**If the epic was already closed**, say so in the report and name the consequence: its committed
`close-record.md` stamped the superseded hash, so `/nxs.distill` will hard-error that entry — there
is deliberately no drain-side waiver. Recovery is the named procedure `/nxs.close` § **"Recovery —
re-stamp a closed entry whose record was revised after close"**: re-approve (done above), re-stamp
`record_hash`, rewrite the close record's Key Decisions / Deviation Rationale if the design and not
just the wording moved, then re-run the drain.

## Phase 5 — Report

Report concisely:

- The record: **issue reference** (`#<record>`) and its state — approved (closed) or open awaiting
  approval — plus the canonical digest from step 7. On the old-contract path, the file path instead.
- The epic it covers (title + issue ref), its `complexity` rating, and its labels now
  (`needs-design` removed, `in-progress` applied).
- Sections **filled** vs. **tiered out** under C5 (e.g. "S epic → Key Decisions + Invariants; other
  sections omitted").
- Open clarifications: **none**, or **N resolved** at the Phase 2 gate (the Open Clarifications
  section is empty in the filed record).
- Story coverage: confirm every user story is addressed.
- Next step: implement the stories, then `/nxs.analyze` — which **will not run** while the record is
  unapproved, so an open record must be closed before conformance can be checked.

# Usage

```
/nxs.decision-record                              # committed entry from the current branch, else resolve from its linked epic issue
/nxs.decision-record 118                          # resolve epic issue #118 via the resolver (no committed entry needed)
/nxs.decision-record path/to/epic.md             # design an explicit queue entry
/nxs.decision-record --from docs/design/x.md     # import an existing design doc as the record's basis
/nxs.decision-record --from ~/plan.md 118        # import a design doc, epic resolved from issue #118
/nxs.decision-record --revise 118                # revise the approved record: reopen, comment, update, re-close
```

# Constraints

- **No 16-section HLD, no per-task LLD, no task index, no `story_ref`** — the story is the
  implementation unit (0009) and `/nxs.tasks` is cut (0010). A design split is an edit to an existing
  story, not a new task.
- **Human prose only.** System A emits no machine artifact; the distiller (System B) derives the
  ConceptDelta later from the record + close record and the diff (0006). On the issue-sourced path
  the body carries **no frontmatter and no hidden machine comment** — it is the hashed artifact, and
  anything in it that churns for a non-design reason would report a design that did not change as
  changed.
- **One record per epic, and exactly one copy of it.** A re-run targets the existing record
  sub-issue and never files a second one; for an issue-sourced epic **no `decision-record.md` is
  written anywhere** — not into a committed queue entry, not into the gitignored scratch path.
- **A closed record's body is frozen.** Every path here except Phase 4.5 leaves an approved body
  untouched; a body change is reachable only through the reopen that phase begins with. Reopening
  re-fires the conformance and close blocks until the record is approved again — that is the whole
  invalidation mechanism, and there is no second one.
- **A revision's comment carries the superseded body verbatim**, its hash, and the reason it was
  superseded, dated — so every previously approved state is reconstructible from the comment trail
  alone. The platform's own edit history is not reliably retrievable by tooling, so describing the
  change instead of embedding it would lose the state. If the body could
  change while closed, "approved" would name a moving target and every downstream stamp would be
  unfalsifiable.
- **Never write `docs/`.** `docs/` is permanent human artifacts only (0005). An old-contract epic's
  record stays in its committed queue entry, as today.
- **Labels are created before they are applied**, and this stage writes only the **epic's** labels
  and its **record sub-issue** — it never touches a story issue.
- **Approval is the close of the record sub-issue.** Never write an approval field, an `approved`
  label, or a status anywhere, and never infer approval from any other signal. Nexus applies no
  permission check of its own: whoever can close the sub-issue is the approver, and the timeline
  records who and when.
- **Discovery gists are an input, never a substitute.** The marked comments on the epic issue are
  read as authoritative decisions the discovery already settled, and the command still runs its own
  architectural analysis and still checks story coverage. It **never edits or removes** those
  comments, and it reads **only** the marked ones. An epic with no marked comment behaves exactly as
  it did before: no new prompt, no empty section.
- **`--from` imports a design doc; it does not copy it.** The doc is the authoritative *why*
  source, but the record it produces is still abstracted domain prose (no code / file paths / type
  names) covering every story, and every decision still carries its *why* — a doc that states a
  choice without a rationale, or without the viable alternative it beat, raises an Open Clarification
  rather than shipping an unsupported entry. The source doc stays where it lives; only the record is
  filed.
