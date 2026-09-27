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

# Step 1b — Resume check

Read the epic's state (`gh issue view <epic> --json state`) and search the history for its ship mark:

```bash
git log --format=%H --grep="^Nexus-Ship: #<n>$" -1
```

- **Epic open, ship mark found** — a resume run: an earlier approval committed, then a GitHub write
  failed. Go straight to Step 8. Draft nothing.
- **Epic closed, ship mark found** — report "epic #<n> is already shipped by <commit>" and stop.
- **Epic closed, no ship mark** — another lane closed it; Step 2 refuses.
- **Epic open, no ship mark** — a fresh run; continue.

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

# Step 5 — Draft the close and the concept changes from the same range

Everything here reads the Step 3 range and nothing else. The run folder is
`.nexus/tmp/ship-<n>/` (ignored). It never holds a close record file.

1. **Close comment prose**, drafted into `.nexus/tmp/ship-<n>/close-comment.md`:
    - **Key decisions** — from the record's appendix (each decision's reason and refuted
      alternative), named by ID; in degraded mode, from the story issue comments and the diff.
    - **Deviation rationale** — where the range's diff departs from How it works, the Mechanism or
      a guarantee, and why, from the story comments and the epic's decision-stub scratch
      (`.nexus/queue/epic-<n>/*/decisions-*.md`). "none (implementation conformed)" when none.
    - **Deferred scope** — work the epic named but the range does not deliver. Each item becomes a
      stub work-item below; its number is filled in after filing.
    - **Process lesson** — one short paragraph. It lives only in the comment; write no lessons file.
2. **Deferred stubs.** Write one epic-stub work-item per deferred item into
   `.nexus/tmp/ship-<n>/stubs/`, in the shape `nexus create-epic` files (title, `type`, labels
   `epic` and the repository's unplanned label from `nexus config resolve unplanned-label`, a body
   naming this epic as its source). Nothing is filed yet.
3. **Concept changes.** Load the **`nxs-concept-write-rules`** skill. Map the range's diff and the
   record to per-concept changes, and write the pages, anchors and atlas **into the current
   checkout** — no branch, no pull request, no per-entry commit. Where the record has a
   Concept-store changes section, rewrite each named statement as the record gives it. Read the
   skill's branch, entry-commit and entry-removal wording as not applying here. Run every
   deterministic step the skill states: reciprocity fan-out, anchor refresh, atlas regeneration,
   and the validator. A non-zero validator exit blocks: fix the pages and re-validate; the
   checkpoint never shows a failing page.
4. **Scratch home.** Stage the removal of the epic's decision-stub scratch, after step 1 read it:

    ```bash
    git rm -r -q --ignore-unmatch ".nexus/queue/epic-<n>"
    ```

   This is the only queue content this stage removes. It writes no queue entry, no receipt, no
   record hash and no shipped record.

# Step 6 — Checkpoint (one approval; nothing committed or sent yet)

Record the working tree's starting state before Step 5 writes anything (it is clean, by Step 2).
Render, as ordinary markdown, then carry the same digest into the `AskUserQuestion` call itself:

```
Ship epic #<n> — <title>
Range:     <base>..<head> (<commits> commits, from <--since ref | upstream <ref>>)
Record:    #<r> (approved) | none (degraded mode)
Findings:  critical <C> · high <H> · medium <M> · low <L>
           <each finding, blocking ones first; an unmet acceptance criterion is blocking>
Close comment: <the drafted comment, in full>
Deferred stubs: <N> — <titles>
Concept changes: <the full `git diff` of .nexus/concepts, .nexus/anchors and the atlas>
Scratch removed: .nexus/queue/epic-<n>/ (<files>)
Nothing is committed, pushed or written to GitHub yet.
```

Options:

- **stop and fix** — recommended whenever a critical or high finding exists. Treated as decline.
- **approve** — apply Step 7. With a critical or high finding, approval is an **override**: the
  close comment records it, naming each finding, and every story still closes as completed.
- **decline** — restore every path this run wrote in the working tree to its starting state
  (`git restore --staged --worktree` over the written paths and `git clean` over files it created),
  delete `.nexus/tmp/ship-<n>/`, and stop. No commit, no issue touched.

# Step 7 — Apply, in this order

1. **One commit**, carrying the concept changes and the staged scratch removal, with the ship mark
   as its last trailer:

    ```bash
    git add .nexus/concepts .nexus/anchors <atlas-path>
    git commit -m "ship: epic #<n> — <title>" -m "Nexus-Ship: #<n>"
    ```

   Never push. The lead can amend or revert this one commit before pushing.
2. Continue with Step 8, which performs every GitHub write.

# Step 8 — GitHub writes, each detected on its own

This step is the whole of a resume run, and the tail of a fresh one. It never makes a second commit.
If `.nexus/tmp/ship-<n>/` is missing on a resume run, refuse: list which writes below are done and
which are left, say the lead must finish the rest by hand, and draft nothing.

1. **Stubs** — file them through the resumable filer, whose ledger lives in the run folder, so a
   re-run never files one twice:

    ```bash
    nexus create-story .nexus/tmp/ship-<n>/stubs --yes
    ```

   Fill the filed numbers into the close comment's deferred scope.
2. **Close comment** — skip if the epic already carries a comment with `<!-- nexus:solo-close -->`.
   Otherwise post the drafted prose followed by its own marker block (never the pipeline
   close-record marker, and no record hash):

    ```
    <!-- nexus:solo-close -->
    lane: solo
    record: "#<r>" | none
    verdict: conformed | override (<C> critical, <H> high)
    range: <base>..<head>
    ship_commit: <full sha>
    nexus_version: <nexus version>
    ```

3. **Stories** — close each still-open story as completed.
4. **Epic, last** — close it as completed. Then delete `.nexus/tmp/ship-<n>/`.

# Step 9 — Report

Print the ship commit, the stub numbers, the comment link, the issues closed, and "not pushed —
push when ready".
