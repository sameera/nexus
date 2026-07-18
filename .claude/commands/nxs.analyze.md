---
name: nxs.analyze
description: Implementation-conformance gate. Checks the implemented code against the epic's acceptance criteria, success metrics, and the decision record's invariants — does the build do what the planning said. Reads the queued epic + decision record and the branch diff / closed story issues; reports inline conformance findings and writes a small analyze-receipt.md into the queue entry (/nxs.close gates on it). Run after the stories are implemented, before /nxs.close. Planning consistency is checked earlier, not here: story↔design coverage by /nxs.hld, AC quality by the nxs-epic-gate agent.
category: engineering
model: inherit
tools: Read, Grep, Glob, Bash, Write
---

# Role

Act as a verification reviewer. Check that the **implemented code** for one epic actually satisfies
what its planning promised — the stories' acceptance criteria, the epic's success metrics, and the
decision record's constraints and invariants. The unit of work is the **story** (0009): each story is
a GitHub issue, and you check the code against each story's acceptance criteria.

This is a **conformance** gate, not a quality gate. You answer *"does the build do what the epic
said?"* — not *"does the build work?"* (tests, that is the `nxs-qa` skill) and not *"is the build
secure?"* (the `security-review` skill). You read code and the diff to compare it against the intent;
you do not run the app, write tests, or change code.

You also do **not** check the planning for internal consistency. Whether ACs are well-formed for their
`story_type` is the **`nxs-epic-gate`** agent (at `/nxs.epic`); whether the design covers every story
is verified in **`/nxs.hld`**. Both run earlier. By the time you run, the planning is fixed and the
code exists; your job is to hold the code to it.

# User Input

```text
$ARGUMENTS
```

# Phase 0 — Resolve the epic context

Resolve in priority order:

1. **Explicit path in `$ARGUMENTS`** — a queue entry, an `epic.md`, or its directory.
2. **Queue entry in the current tree** — glob `.nexus/queue/*/`; a single entry is used, multiple
   prompt a selection.
3. **File open in the editor** — infer the epic directory from it.
4. Otherwise stop and ask for the epic path.

Load `epic.md` (stories, acceptance criteria, success metrics) and the **decision record** —
`decision-record.md`, the `/nxs.hld` output — from the same entry. The decision record supplies the
invariants to check; if it is absent, run in **downgraded** mode (AC + success-metric conformance
only, no invariant check) and say so.

Read `epic.md` frontmatter `link` to get the epic issue number; it anchors the story issues.

# Phase 1 — Gather the implementation surface

Determine what was actually built for this epic. Use, in order of availability:

1. **The branch diff.** Compare the current branch against the base it forked from:

    ```bash
    BASE="$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main)"
    git diff --stat "$BASE"...HEAD
    git diff "$BASE"...HEAD
    ```

    If the epic was implemented across several merges, this is the cumulative change set.

2. **The story issues.** For each story, read its issue state and any closing commits/PRs:

    ```bash
    gh issue view <story-issue> --json number,title,state,closedAt,body
    ```

    Treat an **open** story issue as *not yet implemented* — its ACs are unverifiable, which is itself
    a finding (the epic is not ready to close).

3. **Targeted code reads.** Where the diff is large or a story's AC names a behavior, grep/read the
   touched files to confirm the behavior exists, rather than trusting the diff stat alone.

4. **Committed engineer scratch (soft, on the PR head).** If the entry carries per-user
   stubs — `${QDIR}/*/decisions-*.md`, `${QDIR}/*/notes-*.md` — read them as *context only*.
   They surface the engineer's stated rationale for a divergence at review time (visible now
   because the scratch is committed to the PR head, not machine-local). Use them to explain
   scope drift (§2.4) and, in **downgraded** mode, to reconstruct likely invariants the
   missing decision record would have carried. They **never** change a met/partial/unmet/
   contradicted verdict — the diff and the ACs decide that. Absent → ignore silently.

Do not run the application or the test suite. You are reading the change, not exercising it.

# Phase 2 — Conformance checks

## 2.1 Acceptance-criteria conformance (per story)

For each story in `## User Stories`, take each acceptance criterion and locate the code that
satisfies it in the change set. Classify the AC:

- **met** — the diff/code plainly implements the Given/When/Then or the measurable contract.
- **partial** — some of the AC is implemented; part is missing or weaker than stated.
- **unmet** — no implementing code found, or the story issue is still open. **(high)**
- **contradicted** — the code implements the opposite of, or breaks, the stated criterion. **(critical)**

For `system` stories, the AC states a measurable threshold — confirm the code path that would meet it
exists; if the threshold needs a benchmark you cannot read from the diff, mark it **unverifiable here**
and name what must be measured (defer to `nxs-qa`), do not pass it silently.

## 2.2 Invariant conformance (needs the decision record)

For each constraint/invariant in `decision-record.md` (and any security boundary it names), check the
diff does not violate it. A change that breaks an invariant is **critical** — invariants are the
decisions the build "must preserve". Cite the file/line in the diff that breaks it.

## 2.3 Success-metric coverage (epic level)

For each item in the epic's `## Success Metrics`, state whether the implementation plausibly moves it
and whether it is **measurable** from what shipped (is the metric instrumented / observable?). A
success metric with no way to measure it post-ship is a **finding (medium)** — the epic claimed an
outcome the build cannot demonstrate.

## 2.4 Scope drift (informational)

Note material behavior in the diff that **no** story called for (unplanned scope), and any story whose
implementation went meaningfully beyond its ACs. Informational unless it breaks an invariant.

# Phase 3 — Report (inline) and write the receipt

Return a concise summary:

```
Conformance: <epic title> (<queue-entry-or-path>)  ·  epic #<link>
Mode: full | downgraded (no decision record)
Surface: <N> files changed, <N> stories (<M> closed / <O> open)

Per-story AC conformance:
  STORY <title>: <met>/<total> met · <partial> partial · <unmet> unmet · <contradicted> contradicted

Invariant violations:   <decision-record invariant → file:line that breaks it, ...>  (full mode)
Success metrics:         <metric → measurable? plausibly-moved?>
Scope drift:             <unplanned behavior, ...>

Severity: ⛔ critical <C> · ⚠️ high <H> · medium <M> · low <L>
```

**Severity gate:** critical or high findings should **block close** — the code does not yet satisfy
the epic. Fix the implementation (or, if the epic's intent changed during build, amend `epic.md` and
re-file the affected story issues) before `/nxs.close`. This command does not edit code, issues, or
the epic; it reports so the user can gate.

Then write the **receipt** — the proof this gate ran, which `/nxs.close` checks as a precondition.
Write it to **`analyze-receipt.md`** beside the resolved `epic.md`, overwriting any previous receipt
(a re-run supersedes it). This is the command's only write:

```markdown
---
epic: "<link>"                        # e.g. "#11"
date: <YYYY-MM-DD>
head: <git rev-parse --short HEAD>    # the commit the analysis read
mode: full | downgraded
findings: { critical: <C>, high: <H>, medium: <M>, low: <L> }
---

<the summary block above, verbatim>
```

The receipt is ephemeral queue content: the distiller deletes it with the entry post-merge. Never
link it from an issue.

# Usage

```
/nxs.analyze                      # current branch's queue entry, or open-file context
/nxs.analyze path/to/epic-entry   # explicit queue entry / epic directory
```

# Constraints

- **Conformance, not quality.** Compare code to intent. Do not run tests (that is `nxs-qa`), do not run
  a security audit (that is `security-review`), do not run the app.
- **Read-only, one exception.** Never edit code, the epic, the decision record, or GitHub issues.
  Findings are inline; the only file written is `analyze-receipt.md` beside the epic — never
  `task-review.md` or any other report file.
- **No task analysis (0009).** There is no task layer: do not look for `TASK-*` files, `story_ref`, or
  task↔story traceability.
- **Planning consistency is out of scope.** AC-quality-by-`story_type` belongs to the `nxs-epic-gate`
  agent (`/nxs.epic`); story↔design coverage is verified in `/nxs.hld`. Not here.
- **Engineer scratch is soft.** The per-user stubs are read-only context that can explain a
  divergence but never decide a verdict or gate the receipt; a missing scratch dir changes
  nothing (floor: conformance from the diff + ACs). The receipt schema does not record scratch.
