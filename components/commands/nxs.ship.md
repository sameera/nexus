---
name: nxs.ship
description: The solo lane. In a single repository that has declared solo mode, checks an implemented epic against a stated commit range, drafts its close record and concept-page changes from that same range, and applies everything after one checkpoint — one commit, the deferred stubs, the close comment, and the stories and epic closed. Replaces /nxs.analyze, /nxs.close and /nxs.distill for a lead working alone; refuses in a hub or member workspace and in any repository that has not declared solo mode.
category: engineering
tools: Read, Grep, Glob, Write, Edit, Bash, Skill, AskUserQuestion
model: inherit
---

# Role

You run the **solo lane** (epic #799). A lead working alone has no second person to hand work to,
so this stage checks, closes and distills an epic in one sitting with one checkpoint. It passes no
receipt, queue entry, record hash, shipped record, worktree or distillation pull request between
stages, because there is no later stage. It never loads `/nxs.analyze`, `/nxs.close` or
`/nxs.distill`.

Every refusal below happens before anything is written, and names its cause.

# User Input

```text
$ARGUMENTS
```

Arguments: `<epic-issue-number> [--since <ref>]`. A missing or non-numeric epic number is a usage
refusal.

# Step 1 — Workspace shape, then the solo declaration

Run this first, before reading or writing anything else:

```bash
nexus solo-check
```

It asks the shared workspace resolver for the checkout's shape, then reads the repository's own
solo declaration. On a non-zero exit, print its diagnostic verbatim and stop:

- `workspace-not-single-repo` — this is a hub or a member. The solo lane is single-repo only.
- `solo-undeclared` — the repository has not declared solo mode. The diagnostic quotes the lines
  that declare it. Solo mode is never inferred: a repository with no pull requests and no upstream
  refuses here like any other undeclared repository.

Only a repository that declares solo mode runs the rest of this stage.

# Step 2 — Preconditions, all before anything is drafted or written

Check each of these in order. The first that fails refuses, names its cause, and stops. Nothing has
been written yet.

1. **Clean working tree.** `git status --porcelain` prints nothing. Otherwise refuse: "the working
   tree has uncommitted changes; commit or stash them, then re-run". A clean tree makes the checked
   code the committed code, and lets a decline restore the tree exactly.
2. **Epic state.** Read `gh issue view <epic> --json state,labels`. A closed epic refuses: "epic
   #<n> is already closed; another lane closed it". (Step 3 below handles an epic this stage
   shipped.)
3. **No leftover entry.** If `.nexus/tmp/epic-<n>/close-record.md` exists, an earlier local close
   left an entry that `/nxs.distill` will drain. Refuse, naming the path and `/nxs.distill`.
4. **Decision record.** Resolve the epic (this also materializes it into the run folder):

    ```bash
    nexus epic-resolve --epic <n> --out .nexus/tmp/ship-<n>/epic.md
    ```

   Read the printed `record`. It decides the mode by four states:
    - closed as completed → **approved**, full mode;
    - open, or closed as not planned (`gh issue view <record> --json stateReason`) → refuse and
      name the record: "decision record #<r> is not approved; approve it (close it as completed)
      and re-run";
    - `null`, but the epic carries the `needs-design` label → refuse: the record is claimed but not
      filed; run `/nxs.decision-record <n>`;
    - `null`, and no claim → **degraded mode**: check against the epic alone, and say so in the
      report.
5. **Every open sub-issue is a story or the record.** List them:

    ```bash
    gh api "repos/{owner}/{repo}/issues/<n>/sub_issues" --jq '.[] | select(.state=="open") | .number'
    ```

   Any number that is neither a story (a `### Story #<s>:` in the materialized epic) nor the record refuses,
   naming it: it is unfinished work this stage does not close.

# Step 3 — Fix the range once

```bash
nexus ship-range [--since <ref>]
```

It prints `{ base, head, source, ref, commits }`, full identifiers at both ends. Every later step
reads **this** range and never works it out again. On a non-zero exit, print the diagnostic
verbatim and stop; every refusal names `--since`:

- `range-empty` — no change outside the pipeline stores, such as a run on the trunk after a push;
- `range-no-upstream` — no upstream trunk and no `--since`;
- `range-since-not-ancestor` / `range-since-unresolved` — the `--since` ref cannot start the range.

Without `--since` the tracking ref is read as it is, with no fetch, so it can be out of date. The
checkpoint shows the range, and the lead can re-run with `--since`.

# Step 4 — Check conformance over the range

Load the **`nxs-conformance-rules`** skill. Read the diff of the range, leaving out the pipeline
stores:

```bash
git diff <base> <head> -- . $(nexus excluded-stores)
```

Judge it against the materialized epic's stories and success metrics and, in full mode, the record
body (`gh issue view <record> --json body`) and its guarantees, with the rules and severities the
skill states. An unmet acceptance criterion is a blocking finding. Hold the findings for the
checkpoint. Write no receipt and no report file: nothing is left for a later stage.
