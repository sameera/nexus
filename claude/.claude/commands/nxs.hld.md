---
name: nxs.hld
description: Add the architectural decision record to a planned epic in the queue — the focused "why" (key decisions + refuted alternatives, invariants, risks), tiered by complexity. Reads the queued epic and its stories; writes decision-record.md beside epic.md. Next stage is /nxs.analyze.
category: engineering
tools: Read, Grep, Glob, Write, Bash, Task, AskUserQuestion
model: inherit
---

# Role

Produce the **decision record** for one planned epic: the focused architectural "why" that the
distiller later mines (the rationale) and that `/nxs.analyze` checks for story design coverage. It is
human prose, tiered by complexity, written into the epic's queue entry.

**The design spans the whole epic, not a single story.** One record covers the epic; its decisions and
invariants must hold across every story (that is what coverage means). The **story** is the unit of
*implementation* and of the GitHub issue (0009) — there is no task layer below it — but it is not the
unit of design. Read all stories together and design for the epic.

You delegate the analysis to the `nxs-architect` agent, then format its output into the seeded
decision-record template and write it into the same committed queue entry that `/nxs.epic` created.

# User Input

```text
$ARGUMENTS
```

`$ARGUMENTS` may name a queue entry, an `epic.md`, or its directory. Empty is the normal case —
resolve the entry from the current branch in Phase 0.

## Interaction convention — actionable choice gates

Every point where this command asks the user to choose — the multi-entry epic selection in Phase 0
and the open-clarification gate in Phase 2 — is presented through the **`AskUserQuestion`** tool, not
a free-text prompt the user has to read and type a reply to. Render any context first as ordinary markdown, then call
`AskUserQuestion` with one option per choice (a short label plus a one-line description of its
effect). This renders one selectable option per line in both the VS Code extension and the terminal.
The user can always pick "Other" for a custom answer.

Run the phases in order.

## Phase 0 — Resolve the queue entry

The epic and its story issues already exist (filed by `/nxs.epic` at its approval gate). Find the
queue entry that holds the epic; the decision record joins it.

1. If `$ARGUMENTS` points at a queue entry / `epic.md` / its directory, use that.
2. Otherwise discover by branch (mirror the discovery in `nxs.epic.md`):

    ```bash
    BRANCH="$(git branch --show-current)"; [ -z "$BRANCH" ] && BRANCH="detached"
    ls -d .nexus/queue/${BRANCH}/*/ 2>/dev/null
    ```

    - **0 entries** → ERROR. The epic is not planned yet — tell the user to run `/nxs.epic` first. Stop.
    - **1 entry** → use it.
    - **>1 entries** → read each `epic.md` title and ask which epic to design via `AskUserQuestion`
      (one option per entry — label = epic title, description = queue path + complexity). Stop until
      chosen.

3. The resolved entry **must** contain `epic.md`. If it does not, ERROR (not an epic entry). Stop.

Record `QDIR` = the resolved entry directory.

## Phase 1 — Architectural analysis (delegate to nxs-architect)

Invoke `nxs-architect` in **decision-record mode**. The architect produces the decision *content* — the
"why", not a 16-section document.

```
Invoke: nxs-architect
Topic: Decision record for epic "<epic title>"
Inputs to read:
- ${QDIR}/epic.md            # the epic and ALL its user stories — authoritative scope
- docs/product/context.md    # personas, strategy (reference, don't re-tabulate)
- docs/system/stack.md       # technology stack
- docs/system/standards/*    # standards-conformance pass (flag deviations + justify)
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
  Per-subsystem only — route any cross-cutting NFR budget to docs/system/standards/ instead.
- RISKS limited to BLOCKER / ADDRESS (those that force a human decision). No likelihood×severity
  matrix, no speculative risks.
- OPEN CLARIFICATIONS: ⚠️ NEEDS CLARIFICATION items only the human can resolve.

Coverage requirement: the decisions + invariants must give design coverage for EVERY user
story in epic.md. An uncovered story trips /nxs.analyze's coverage gate. Where a story needs
a design split, describe it as an edit to that story's scope — NOT a new task.
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
   and selects the **C5 required-section whitelist** — apply it explicitly, not as a heuristic:

    | `complexity` | Required sections |
    | --- | --- |
    | **S** or **M** | **Key Decisions** + **Constraints & Invariants** only. All other sections optional — omit if empty; do not force-fill. |
    | **L** or **XL** | **All** template sections required. A required section left empty needs a stated reason. |

3. Fill the template from the architect's output. Set frontmatter `rating` to the epic's `complexity`,
   `epic` to the epic issue ref (the `link` in `epic.md` frontmatter), `feature`/`title`/`date`
   accordingly, and carry over `concepts:` from the epic if present.
4. Delete all template guidance comments before writing.
5. **Verify story coverage:** every story in the epic's `## User Stories` is addressed by a decision or
   invariant. If a story is uncovered, return to Phase 1 for that story rather than shipping a record
   that fails `/nxs.analyze`.

## Phase 4 — Write the decision record

Write the filled template to **`${QDIR}/decision-record.md`** — in the queue entry, beside `epic.md`.

- **Do not write while any open clarification is unresolved (Phase 2 gate).** The written record's
  `## Open Clarifications` section must be empty.
- Do **not** write anything under `docs/`. `docs/` is permanent human artifacts only (0005); planning
  artifacts live in the committed queue (0006).
- Do **not** emit a `{prefix}-hld.md`, a task index, or any per-task design.
- `/nxs.analyze` reads this file as "the decision record" from the same entry — `decision-record.md` is
  the name it expects.

## Phase 5 — Report

Report concisely:

- Decision-record path (`${QDIR}/decision-record.md`).
- The epic it covers (title + issue ref) and its `complexity` rating.
- Sections **filled** vs. **tiered out** under C5 (e.g. "S epic → Key Decisions + Invariants; other
  sections omitted").
- Open clarifications: **none**, or **N resolved** at the Phase 2 gate (Open Clarifications section is
  empty in the written record).
- Story coverage: confirm every user story is addressed.
- Next step: `/nxs.analyze` to run the story↔design coverage and consistency gate.

# Constraints

- **No 16-section HLD, no per-task LLD, no task index, no `story_ref`** — the story is the
  implementation unit (0009) and `/nxs.tasks` is cut (0010). A design split is an edit to an existing
  story, not a new task.
- **Human prose only.** System A emits no machine artifact; the distiller (System B) derives the
  ConceptDelta later from the queued decision + close records and the diff (0006). Just write clean
  prose.
- **Queue, not `docs/`.** The decision record is committed planning state in
  `.nexus/queue/<branch>/<local-id>/`, the same entry `/nxs.epic` and `/nxs.analyze` use.
