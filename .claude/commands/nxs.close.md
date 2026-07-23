---
name: nxs.close
description: Close an epic. Emits a human-prose close record into the committed queue entry (key decisions + deferred-scope pointer + deviation rationale from a close-from-diff pass), appends deferred scope to the feature backlog, writes the process lesson as its own file, then — after a checkpoint — comments on and closes the epic GitHub issue. Preconditions — every child story issue closed (hard block), and /nxs.analyze ran (its analyze-receipt.md present and current; missing/stale/blocking requires an explicit user waiver). With `--pr <N>` it runs post-merge in a worktree on a fresh distill branch (gated on the PR being merged), reads the analyze result from the PR review, commits and pushes the close artifacts, and hands off to /nxs.distill; single-repo and hub only.
category: engineering
tools: Read, Grep, Glob, Write, Edit, Bash, AskUserQuestion
model: inherit
---

# Role

Close one epic at the end of its pipeline. You produce a **close record** — pure human prose the
distiller later mines for the *why* it cannot recover from the code — and you close the epic's GitHub
issue.

The close record is **human prose only** (0006): key decisions, a pointer to deferred scope, and the
**deviation rationale** produced by the close-from-diff forcing function. There is **no `ConceptDelta`
block, no `PIR.md`, and no task-file mining** — the task layer is gone (0009); decisions are mined from
the epic, the story issue comments, and the close review (C6). Durability is structural: the close
record is committed into `.nexus/queue/<epic-slug>-<local-id>/` and travels to main with the PR, where the
distiller consumes and deletes it.

# Interaction convention — actionable choice gate

The closure checkpoint (Phase 7) and the conformance gate (Phase 1.2) are presented through the
**`AskUserQuestion`** tool, not a free-text `(y/n)` prompt. Render the summary first as ordinary
markdown (the state found, the artifacts written, the actions about to run), then call
`AskUserQuestion` with one option per choice (short label + one-line effect). The user can always pick "Other" for a custom answer.

# User Input

```text
$ARGUMENTS
```

# Input Resolution

**CRITICAL: do NOT search for epic files.** Resolve the epic source as follows, in priority order:

1. **`$ARGUMENTS` contains a file path** → use that `*epic.md` directly.
2. **A file is open in the editor** (passed as context) → use that file as the `*epic.md`.
3. **`--pr <N>` with no path** → the epic is resolved from the PR and **born at close** (see below).
4. **Otherwise** (no `--pr`, no path) → stop and ask the user to either open the `*epic.md` in their
   editor and re-run, or pass the path: `/nxs.close path/to/epic.md`.

If `$ARGUMENTS` also contains **`--pr <N>`** (string-matched, like `/nxs.epic --resume`), close runs
the **post-merge worktree flow** in Phase 0.5. Strip the `--pr <N>` token first. In `--pr` mode the
`*epic.md` path is **optional**: under issue-sourced planning (#114) nothing is committed at planning,
so if no path is given (the normal case) the epic is **resolved from the PR's linked issue and born at
close** — materialized into a fresh committed queue entry in Phase 0.5. If a path IS given (an
old-contract epic whose committed entry rode the PR), it resolves as above and is re-rooted into the
worktree (invariant 14).

**Never** run `find`, `ls`, or any search to locate the epic. When a committed `epic.md` is resolved
it fixes the **queue entry directory** (its parent); `decision-record.md` and `close-record.md` are
its siblings there. On the born-at-close path the entry directory is **created** in Phase 0.5 (the
resolver writes `epic.md` into it), and the close record joins it there — again, no search.

# Phase 0 — Validate the epic

**Born-at-close ordering:** on the born-at-close path (`--pr` with no committed `epic.md`), the
`epic.md` does not exist yet — **Phase 0.5 materializes it first**, then this Phase-0 parsing runs
against that materialized file. On every other path (`epic.md` given or in the editor) run Phase 0
now, as written.

1. Read and parse the `*epic.md` frontmatter. Extract:
    - `epic` (or `title`) — the epic title
    - `link` — the epic GitHub issue reference (e.g. `"#123"`)
    - `feature` — the parent feature name/slug (the queue entry's one-direction pointer, 0006 §4)
    - `feature_path` — the **actual resolved feature container** `/nxs.epic` recorded (e.g.
      `docs/features/onboarding` in single-repo, `features/onboarding` on a repo-root hub). Close
      targets the backlog under this and derives the sibling lessons location from it — it never
      re-resolves the docs root. Compute two names now and reuse them below:
        - **`<feature-path>`** = the `feature_path` value. (If `feature_path` is absent — a pre-epic
          entry — fall back to `docs/features/<feature>`, today's literal.)
        - **`<docs-root>`** = `<feature-path>` with its final two segments (`features/<slug>`) removed:
          `docs` for `docs/features/onboarding`, or the **empty string** for `features/onboarding`.
          When `<docs-root>` is empty, a taxonomy path hangs directly off the repo root (no `./`
          prefix, no `.`-named segment).
    - `complexity` — the story-size rollup (used for lesson framing)

2. Set `QDIR` = the directory containing `*epic.md` (the committed queue entry).

3. **Validate `link`.** It MUST exist and contain an issue number. If missing, stop and report:

    ```
    Cannot close epic: no GitHub issue linked.

    The epic frontmatter must contain a `link` (e.g. `link: "#123"`), added when the epic
    issue is created. Run `/nxs.epic` (approve at its gate) to create and link the epic issue.
    ```

    Extract the issue number from `link` (`"#123"` → `123`).

# Phase 0.5 — PR mode setup (`--pr <N>`)

**Skip this phase entirely without `--pr`.** With `--pr <N>`, close runs **post-merge in a worktree
on a fresh distill branch**, and `/nxs.distill` later continues in that worktree. Supported in
single-repo and hub mode only.

1. **Gate on a merged PR** (also preflights the role and rejects member repos):

    ```bash
    tsx ./.claude/skills/nxs-pr-worktree/scripts/pr_worktree.ts preflight --pr <N> --mode close
    ```

    Exit 1 blocks the close — the printed diagnostic names why. **A member repo is a hard block:**
    its close runs on the feature branch and migrates to the hub (the local, non-`--pr` flow), never
    this worktree flow. **The PR must be merged** — close, unlike analyze, may not run pre-merge.

2. **Determine the epic issue number** `<epic-issue>`:
    - If an `epic.md` path was given (Phase 0), take its `link`.
    - Otherwise (born-at-close, the #114 norm) derive it from the **PR's linked issue** — the issue
      the PR closes, then that issue's **parent epic** (`gh pr view <N> --json ...`). If it cannot be
      determined unambiguously, stop and ask.

3. **Open the worktree on the distill branch** and derive the range:

    ```bash
    tsx ./.claude/skills/nxs-pr-worktree/scripts/pr_worktree.ts open --pr <N> --mode close \
      --branch "distill/$(date +%Y-%m-%d)-<epic-slug-or-epic-issue>"
    ```

    It prints `{ wtPath, range: { repo, base, head } }`. The branch is cut from the trunk
    (post-merge `origin/main`), so `wtPath` holds the merged code. `range` is the
    merge-commit-anchored, squash/merge/rebase-safe range (full SHAs) — **keep it for Phase 3 and the
    Phase 4 stamp.**

4. **Resolve `QDIR` — dual: born-at-close, else a committed entry (invariant 14, 15).** Operate
   inside `wtPath` for every path operation below.
    - **Committed entry present** — a path was given, or an entry for this epic already exists under
      `wtPath/.nexus/queue/…` (an old-contract epic whose entry rode the PR): set `QDIR` to that entry
      re-rooted under `wtPath/.nexus/queue/…`. Its `epic.md` is already committed; skip the
      materialization below.
    - **Born at close (nothing committed at planning)** — no committed entry exists. Materialize the
      epic into a **fresh committed queue entry** so the queue is born here, not at planning:

        ```bash
        tsx ./.claude/skills/nxs-epic-resolve/scripts/epic_resolve.ts \
          --epic <epic-issue> --dir "$wtPath" --out "$wtPath/.nexus/tmp/born-<epic-issue>/epic.md"
        LOCAL_ID="$(python3 -c 'import secrets; print(secrets.token_hex(4))')"
        SLUG="$(<slug from the materialized epic.md frontmatter, else epic-<epic-issue>>)"
        QDIR="$wtPath/.nexus/queue/${SLUG}-${LOCAL_ID}"
        mkdir -p "$QDIR" && mv "$wtPath/.nexus/tmp/born-<epic-issue>/epic.md" "$QDIR/epic.md"
        ```

      On a non-zero resolver exit, report the diagnostic and stop (no entry is created). The
      materialized `epic.md` now lives at a **tracked** `.nexus/queue/…` path (not the gitignored
      `.nexus/tmp/`) — it is committed with the close record in Phase 7.6 as the born-at-close entry.
      The entry carries **no `decision-record.md`** (nothing was committed at planning; the durable
      record home is `hld-subissue-record`), so Phase 3 runs its downgraded, no-invariant deviation
      pass.

   Then run **Phase 0's frontmatter parsing** against `${QDIR}/epic.md` (title, `link`, `feature`,
   `feature_path`, `complexity`). `<feature-path>`, `<docs-root>`, the backlog, and the lesson all
   resolve **inside `wtPath`**. The role from step 1 **replaces the Phase 1.3 preflight** — do not run
   the close-migration preflight in `--pr` mode (single-repo/hub only; no migration ever happens here).

5. `--pr` is **mutually exclusive** with the local on-branch flow. If the preflight rejects the
   mode, **stop** — never silently fall back to the local path.

# Phase 1 — Preconditions

## 1.0 Resolve the issues repo (target of every issue op)

Nexus files the epic issue into the configured **epic-repo** (`github.epic-repo`, falling back to
`github.issues-repo`), which may differ from the repo `/nxs.close` runs in. Resolve it once, **through
the shared resolver** — never by parsing `settings.yml` yourself (decision-record Invariant 2) — so
close addresses the same repository the creation scripts filed the epic into. Close acts on the **epic**
issue, so it resolves `epic-repo` specifically; the resolver applies the same precedence chain (including
workspace hub defaults) the creation scripts use, so all consumers agree (Invariant 3). Historically
close omitted this and always hit the current repo; resolving it here is the concrete bug STORY-121.04
fixes, extended to per-epic/story repo targeting by STORY-121.05.

```bash
ISSUES_REPO="$(python3 ./.claude/skills/nxs-gh-shared/delivery_config.py resolve epic-repo --root "<root>")"
REPO_ARG=""; [ -n "$ISSUES_REPO" ] && REPO_ARG="-R $ISSUES_REPO"
```

- `<root>` is the repo root in the local flow, or `$wtPath` in `--pr` mode (the config lives inside the
  worktree).
- When `ISSUES_REPO` is empty the epic issue lives in the current repo and `REPO_ARG` stays empty —
  today's behavior, unchanged (an absent epic-repo/issues-repo means "the current repo" and is never
  pinned; Invariant 6).
- **Every `gh issue …` / `gh api …` call below that addresses the epic issue or a story issue MUST
  include `$REPO_ARG`.** For the sub-issues GraphQL query, take `owner`/`repo` from `$ISSUES_REPO` when
  set, otherwise the current repo.

## 1.1 Every child story issue is closed (hard block)

The epic cannot close while any of its stories is still open. **Block here if any is open — do not
auto-close them, do not proceed.**

1. Determine the child story issue numbers. Source in order:
    - The `## Implementation Sequence` table in the queue `epic.md` (the `Issue` column) — written by
      `/nxs.epic` when it filed the stories.
    - Fallback — the epic issue's sub-issues via the API:

        ```bash
        gh api graphql -f query='
          query($owner:String!,$repo:String!,$num:Int!){
            repository(owner:$owner,name:$repo){
              issue(number:$num){ subIssues(first:100){ nodes{ number title state } } }
            }
          }' -F owner=<owner> -F repo=<repo> -F num=<epic-issue> \
          --jq '.data.repository.issue.subIssues.nodes[] | "\(.number) \(.state) \(.title)"'
        ```

2. Check each story issue's state (in the resolved issues-repo — see Phase 1.0):

    ```bash
    gh issue view <story-issue> $REPO_ARG --json number,title,state
    ```

3. **If any story issue is `OPEN`**, block and report the open ones, then stop:

    ```
    Cannot close epic #<epic-issue>: <N> child story issue(s) still open.

      #<n> — <title>
      #<n> — <title>

    Close (or reopen and complete) each story before closing the epic. This command does not
    auto-close story issues.
    ```

Only when **all** child story issues are closed do you continue. If the epic has no child story issues
at all, warn and continue (a manually managed epic).

## 1.2 Conformance analysis ran (choice gate)

`/nxs.analyze` records its result as a **receipt** — a local `${QDIR}/analyze-receipt.md` file
(local mode) or a **machine block on the PR** (`--pr` mode). Check it **before** mining anything —
if the user opts to analyze first, nothing later in this command should have run yet.

1. **Read the receipt, parse `date`/`head`/`mode`/`findings`, and classify.** The source depends on
   mode:
    - **Local mode** — read `${QDIR}/analyze-receipt.md` frontmatter.
    - **`--pr` mode** — read the latest **trusted** analyze machine block from the PR: `gh pr view
      <N> --json reviews,comments`, take the newest body containing `<!-- nexus:analyze-receipt -->`
      that is authored by a maintainer (`authorAssociation` is `OWNER`, `MEMBER`, or `COLLABORATOR`)
      and whose `pr:` equals `<N>`, and parse the fenced `yaml` after the marker. A PR review/comment
      is writable by others, so **ignore untrusted blocks and blocks that merely quote an earlier
      one**.

   Classify the state:
    - **clean** — receipt found, no critical/high findings, **and current**:
      local → `git rev-list --count <head>..HEAD` is `0`;
      `--pr` → the block `head` **equals** the PR head (`gh pr view <N> --json headRefOid`) exactly
      (full-SHA equality — do **not** use `git rev-list`, which is meaningless across a
      squash/rebase). Set the close record's `analyze:` value to `ran <date> @ <head>` and continue
      silently to Phase 2.
    - **missing** — no receipt / no trusted machine block: `/nxs.analyze` never ran on this entry.
    - **stale** — local: commits landed after the receipt (`git rev-list --count <head>..HEAD` > 0;
      report the count); `--pr`: the block `head` ≠ the PR head (a commit landed after analysis).
    - **blocking** — the receipt reports critical or high findings: analyze judged the code
      does not yet satisfy the epic.
2. On **missing / stale / blocking**, render a one-paragraph markdown note naming the state and
   what it means, then ask via `AskUserQuestion` — never proceed silently:
    - missing → **"Run /nxs.analyze first (Recommended)"** | "Close without analysis"
    - stale → **"Re-run /nxs.analyze (Recommended)"** | "Proceed with the stale receipt"
    - blocking → **"Stop and fix the findings (Recommended)"** | "Override and close"
3. If the user picks the recommended option, **stop**: tell them to run `/nxs.analyze` (fixing
   findings first, for blocking) and then re-run `/nxs.close`. Do not run the analysis yourself —
   the gate detects, it does not substitute.
4. If the user picks the proceed option, set the waiver text for the close record's `analyze:`
   frontmatter (Phase 4) and continue:
    - missing → `waived — closed without /nxs.analyze (<YYYY-MM-DD>)`
    - stale → `stale — ran <date> @ <head>, <N> commit(s) unanalyzed; waived <YYYY-MM-DD>`
    - blocking → `overridden — <C> critical / <H> high finding(s) open; waived <YYYY-MM-DD>`

## 1.3 Workspace preflight (role gate)

**In `--pr` mode, skip this section** — Phase 0.5 already resolved the role (single-repo or hub;
member is rejected) and no migration ever runs. Use the Phase 0.5 `range.repo` as the range identity
and continue to Phase 2.

Close behaves differently in a multi-repo workspace. Resolve the role once, through the shared
resolver's helper — never a heuristic of your own:

```bash
tsx ./.claude/skills/nxs-close-migration/scripts/close_migration.ts preflight
```

- **single-repo** or **hub** → note the mode and continue. Every migration step below (the
  member-mode checkpoint items, Phase 7.5, the member-mode report lines) is **skipped**; behavior
  is identical to today. The hub drains its own queue, so a hub close keeps its entry too.
- **member** → record the reported `repo` identity, hub root, and hub branch. They feed the range
  stamp (Phase 4), the checkpoint summary (Phase 7), and the migration (Phase 7.5).
- **exit 1** (a named diagnostic was printed) → **hard block.** Report the diagnostic verbatim —
  it names which checkout is missing and how to supply it — and stop. Never attempt a partial
  migration and never guess the hub's location.

In every mode, keep the preflight's `repo` identity: it is the `range:` block's `repo` value.

# Phase 2 — Mine the key decisions

Assemble the in-flight **key decisions** — decisions made or changed during implementation, especially
any not already captured in the decision record. **Sources (C6), in priority order:**

1. **`epic.md`** and **`decision-record.md`** in `QDIR` — the planned decisions (baseline; the close
   record captures what *changed* against these, not a restatement).
2. **Story issue comments** — read the comment thread on each child story issue for decisions recorded
   during implementation (in the resolved issues-repo — see Phase 1.0):

    ```bash
    gh issue view <story-issue> $REPO_ARG --json title,body,comments
    ```

3. **Committed decision stubs** — `${QDIR}/*/decisions-*.md` (one per-user subdir per
   engineer; per-branch files). `QDIR` is already the epic's queue entry, so no branch→epic
   mapping is needed:

    ```bash
    ls "${QDIR}"/*/decisions-*.md 2>/dev/null
    ```

    Each stub records a choice, its why, and the refuted alternative — captured at the
    decision moment, the highest-fidelity *why* source. Still **hints, not authority**:
    verify each against the shipped diff (Phase 3). A stub the code contradicts is dropped,
    or recorded as a deviation with the stub as the "planned" side. If none exist, say
    nothing and continue — capture is soft and most closes may have none.

4. **The close review** — your own reading of the branch diff (Phase 3) surfaces decisions visible in
   the code that were never written down.

For each decision, capture the **decision + the why**, and the **refuted viable alternative** if one
existed (C1/G2 guardrail: no strawmen — record an alternative only if a competent engineer might have
chosen it). This is the distiller's *why* source for the Decision Log. There are **no task files** to
mine — do not look for `TASK-*.md`.

# Phase 3 — Close-from-diff forcing function

Diff the branch **against the decision record**, auto-derive the *what*, and surface only the
**deviations** — the human supplies rationale **only** on those (targeted, not a blank "write a
summary"). That rationale lands in the close record's **Deviation Rationale** section.

1. **Compute the branch diff** against the base it forked from:

    ```bash
    BASE="$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main)"
    git diff --stat "$BASE"...HEAD
    git diff "$BASE"...HEAD
    HEAD_SHA="$(git rev-parse HEAD)"   # full SHA; $BASE is already one (merge-base emits full SHAs)
    ```

    Keep `$BASE` and `$HEAD_SHA` — Phase 4 stamps them into the close record's `range:` block,
    and the stamped range MUST be the exact range this diff used.

    **In `--pr` mode, do NOT use `merge-base HEAD origin/main`** — the distill branch was cut from
    `origin/main`, so that diff is empty and would detect **zero** deviations (a false-clean close).
    Instead take `$BASE` = the Phase 0.5 `range.base` and `$HEAD_SHA` = `range.head`, and compute the
    diff inside the worktree — `git -C <wtPath> diff "$BASE"..."$HEAD_SHA"` — using this one diff for
    **both** the deviation detection below and the Phase 4 range stamp.

2. **Auto-derive the *what*** from the diff — the behavioral changes, the files touched. This is
   code-derivable, so you derive it; **you do not ask the human to write it**.

3. **Detect deviations** — compare the shipped code against the decision record's chosen approach,
   constraints, and invariants (`decision-record.md` in `QDIR`). A deviation is where the code diverges
   from what the decision record implied: a constraint relaxed, an invariant worked around, an approach
   changed, a named component replaced. Matched work needs no entry.

    - If `decision-record.md` is absent, say so and derive deviations only against the epic's stated
      approach/scope (downgraded — no invariant check).

4. **Force rationale on each deviation.** Present the detected deviations to the user and collect **why
   each happened** (one prompt covering the list; use `AskUserQuestion` if the set is small and
   discrete, otherwise ask for the rationale inline). Only deviations get an entry.

5. **Consult committed engineer notes as weak hints** — `${QDIR}/*/notes-*.md`, if any.
   Working scratch, routinely diverges from what ships; use only to *notice* deviations
   (notes said X, the diff shows Y — ask about it), never as a source of record. (No
   `hld-*.md` glob — developer HLDs are not captured in the queue; see the layout spec.)

If the diff shows **no** deviation from the decision record, record that plainly — the Deviation
Rationale section is then empty (a matched implementation, not a gap).

# Phase 4 — Write the close record

Fill the seeded template and write it into the queue entry.

1. Read the seeded project template: **`.nexus/config/templates/close-record-template.md`**. (If the
   seeded copy is absent, fall back to the toolkit master `common/templates/close-record-template.md`.)

2. Fill every `{{PLACEHOLDER}}` and **delete the guidance comments**:
    - `title` / `epic` (the `link` ref) / `feature` / `date` (today).
    - `analyze` — the conformance-gate outcome from Phase 1.2 (`ran … @ …`, or the waiver text).
    - `range` — **unconditional, every mode**: exactly one list entry with `repo` = the Phase 1.3
      preflight's repo identity, `base` = `$BASE`, `head` = `$HEAD_SHA` (Phase 3) — **full commit
      SHAs**, never `HEAD` or a branch name. The list shape is deliberate: a future cross-repo
      epic appends entries; this epic always writes exactly one (the home repo). **In `--pr` mode**,
      `repo`/`base`/`head` are exactly the Phase 0.5 `range` output (the helper already resolved the
      identity and the merge-commit-anchored SHAs).
    - **Key Decisions** — from Phase 2 (decision + why + refuted viable alternative if any).
    - **Deviation Rationale** — from Phase 3 (one bullet per deviation; the *why* the human supplied).
    - **Deferred Scope** — a **pointer only** to `<feature-path>/backlog.md` (the scope itself
      is appended in Phase 5, not restated here).
    - **Process Lesson** — a **pointer only** to the lesson file written in Phase 6.

3. Write it to **`${QDIR}/close-record.md`** — in the committed queue entry, beside `epic.md` and
   `decision-record.md`. Do **not** emit a `ConceptDelta` block; the record is human prose only.

# Phase 5 — Append deferred scope to the feature backlog

Deferred scope goes to the feature backlog, not into the close record (C2). `backlog.md` is a
**two-writer, append-only** surface shared with `/nxs.epic`'s decomposition stubs (0008) — use the
**same entry shape**; never rewrite existing blocks.

1. Target `<feature-path>/backlog.md` (the recorded feature container from Phase 0; create it with the header on first write):

    ```markdown
    # Backlog: <Feature Name>

    <!-- Append-only re-triage queue. Writers: /nxs.epic (decomposition stubs),
         /nxs.close (deferred scope). One consumer: the next /nxs.epic.
         Promote a proposed stub with `/nxs.epic <slug>`. -->
    ```

2. **Append** one block per deferred item (slug + one-line goal + complexity S/M + status):

    ```markdown
    ## <deferred-item-slug>

    - **status:** proposed
    - **goal:** <one-line functional goal>
    - **estimate:** S | M
    - **blocked_by:** [<slug>, …] | none
    - **source:** deferred from epic <epic-title> (#<epic-issue>) (<YYYY-MM-DD>)
    ```

   If nothing was deferred, skip this phase and leave the close record's Deferred Scope pointer noting
   "none".

# Phase 6 — Write the process lesson

The lesson is its own file (C3), one file per lesson; the close record only points at it.

1. Ensure the lessons dir exists — **`<docs-root>/delivery/lessons/`** (just `delivery/lessons/` when
   `<docs-root>` is empty, i.e. a repo-root hub). `/nxs.setup` scaffolds it; create if absent.
2. Write **`<docs-root>/delivery/lessons/<YYYY-MM-DD>-<slug>.md`** where `<slug>` derives from the epic:

    ```markdown
    ---
    date: <YYYY-MM-DD>
    epic: "<Epic Title>"
    source: <epic-issue-ref>
    ---

    # Lesson: <short title>

    <The process/delivery lesson in human prose — estimate-vs-actual, decomposition or sequencing
     lessons, what the next epic in this area should do differently. Consumed by PM estimation.>
    ```

# Phase 7 — Checkpoint (before any GitHub write)

**STOP AND WAIT.** All the above (close record, backlog append, lesson) is local and reversible; the
GitHub comment and issue close are not. Render the summary as markdown first:

```
CHECKPOINT: Epic Closure

Ready to close epic "<Epic Title>" (#<epic-issue>).

Written:
0. [born-at-close only] Materialized epic → ${QDIR}/epic.md  (resolved from issue #<epic-issue>)
1. Close record  → ${QDIR}/close-record.md
2. Deferred scope → <feature-path>/backlog.md (<N> item(s))
3. Process lesson → <docs-root>/delivery/lessons/<date>-<slug>.md
   (in `--pr` mode all of these are inside the worktree <wtPath>)

Preconditions: all <M> child story issues closed · analyze: <the Phase 1.2 outcome> ·
workspace: <the Phase 1.3 role or the Phase 0.5 role in --pr mode>.

About to:
4. [member mode only] Migrate the queue entry → <hub-root>/.nexus/queue/<entry-dir-name>/
   — committed on the hub's current branch '<hub-branch>' (local git, recoverable)
5. [member mode only] Remove the queue entry from this repo — committed on branch '<branch>'
   (local git, recoverable)
5b. [--pr mode only] Commit the born-at-close epic.md (if born here) + close record + backlog +
    lesson on branch 'distill/<date>-<slug>' and push it — durability; these artifacts have no
    feature PR to ride
6. Post the close comment on epic issue #<epic-issue>  (irreversible)
7. Close epic issue #<epic-issue>  (irreversible)
```

In single-repo and hub mode without `--pr`, omit items 4–5b (and renumber) — the list reads exactly
as today. In `--pr` mode, omit items 4–5 (never migrated) but keep 5b.

Then ask via **`AskUserQuestion`** (not free text). Three options:

- **close** — proceed to Phase 7.5 (member mode) / Phase 7.6 (`--pr` mode) and then Phase 8 (post
  the comment, close the epic issue).
- **abort** — stop; leave the epic issue open. The local artifacts stay written.
- **review** — display the generated `close-record.md`, then ask again.

**Handle the selection** (treat an "Other" answer by intent):

- **close** → Phase 7.5 in member mode, Phase 7.6 in `--pr` mode, otherwise Phase 8.
- **abort** → stop with:

    ```
    Epic closure aborted.

    The close record, backlog, and lesson are written; the GitHub issue remains open.
    Close it manually when ready:  gh issue close <epic-issue> --reason completed
    ```

- **review** → print `close-record.md`, then re-ask via `AskUserQuestion`.

# Phase 7.5 — Migrate the entry to the hub queue (member mode only)

**Skip this phase entirely in single-repo and hub mode.**

On an approved **close**, run the migration helper. It performs the full ordered sequence —
copy the working-tree entry (the just-written `close-record.md` and `analyze-receipt.md`
included), commit it in the hub (path-scoped, so unrelated hub work is untouched), **verify**
the hub commit contains the entry byte-for-byte, and only on that confirmation remove the entry
here and commit the deletion on the current branch. **Never reproduce these steps as inline
git** — the ordering is the no-data-loss invariant, and it lives in the helper.

```bash
tsx ./.claude/skills/nxs-close-migration/scripts/close_migration.ts migrate "${QDIR}"
```

- **exit 0** → the entry now exists in exactly one place: the hub queue. Record the printed hub
  commit SHA and hub branch for the Phase 9 report, then continue to Phase 8.
- **exit non-zero** → **stop before any GitHub write.** Print the helper's diagnostic verbatim.
  The helper has already cleaned any partial hub copy; the entry is intact in this repo. Tell the
  user to fix the named problem and re-run `/nxs.close` — the re-run is idempotent (an entry
  already verified in the hub proceeds straight to removal).

# Phase 7.6 — Commit & push the distill branch (`--pr` mode only)

**Skip this phase entirely without `--pr`** (and it never coexists with Phase 7.5 — member mode is
rejected in Phase 0.5). On an approved **close**, the close record, backlog append, and lesson were
written inside the worktree; they have **no feature PR to ride to main**, so commit them on the
distill branch and push it — pushing is the durability guarantee (until then the only copy is one
worktree on one machine).

**Born-at-close (invariant 15):** when Phase 0.5 materialized the epic into a fresh entry, the
**`${QDIR}/epic.md`** is a new tracked file too — commit it in **this same commit**, so the born-at-
close entry (materialized `epic.md` + `close-record.md`) lands atomically. The queue then holds only
closed, drainable entries (Success Metric: 100% of trunk-queue entries carry a close record). On the
committed-entry path `epic.md` was already tracked, so `git add` simply no-ops on it.

```bash
git -C <wtPath> add "${QDIR}/epic.md" "${QDIR}/close-record.md" <backlog.md> <lesson>  # paths inside <wtPath>
git -C <wtPath> commit -m "close: <epic-slug> — born-at-close epic, close record, backlog, lesson"
git -C <wtPath> push -u origin "distill/<date>-<slug>"
```

- The close record's `git rm` happens later, on this same branch, in `/nxs.distill` — so the record
  is add-then-deleted within the branch (durable via the epic-issue comment in Phase 8, and via the
  concept pages + backlog + lesson the distillation-PR lands). The born `epic.md` is consumed and
  deleted with the whole entry when the distillation-PR merges.
- If the push fails, continue to Phase 8 but end the run with an `ACTION REQUIRED: git -C <wtPath>
  push` — closure is not durable off this machine until the branch is pushed.

# Phase 8 — Post the comment and close the epic issue

In member mode this phase runs only after Phase 7.5 succeeded; in `--pr` mode, only after Phase 7.6.
GitHub ops target the **epic issue** via `link`. The epic issue is a **durable** surface; the queue
`close-record.md` is **ephemeral** — the distiller deletes it post-merge. So the comment carries the
close record's **prose inline** (Key Decisions + Deviation Rationale); it must **never** link into
`.nexus/queue/`, or the link dangles the moment the distillation PR merges. Durable pointers — the
feature backlog and the lesson file, both under the resolved docs root — may be included as bare paths
(or absolute GitHub URLs via `nxs-abs-doc-path`); nothing in the queue may be linked.

Write the comment body to a scratch file (Key Decisions + Deviation Rationale copied from
`close-record.md`; drop the Deviation heading if there were none), then post it with `--body-file`
(avoids shell-escaping the prose), then close the epic issue:

```bash
gh issue comment <epic-issue> $REPO_ARG --body-file "<scratch>/close-comment.md"
gh issue close <epic-issue> $REPO_ARG --reason completed
```

`$REPO_ARG` is the resolved issues-repo from Phase 1.0 — the epic issue lives there, not necessarily in
the repo close runs from, so both the comment and the close must carry it.

The comment body has this shape:

```markdown
## Close Record

Epic closed. Durable record below — the queue `close-record.md` drains post-merge.

Conformance: <analyze frontmatter value>   <!-- include this line ONLY when Phase 1.2 was not clean:
the durable surface must show the epic closed on a waiver -->

### Key Decisions
- **<decision>:** <why> (+ refuted alternative if any)
- …

### Deviation Rationale
- **<deviation>:** <why>          <!-- omit this whole heading if there were none -->

### Pointers (durable)
- Deferred scope → <feature-path>/backlog.md
- Process lesson → <docs-root>/delivery/lessons/<date>-<slug>.md
```

**Error handling:**

- Epic issue already closed → report and continue to the completion summary.
- `gh` fails → report the error, preserve state (artifacts already written), and print the manual
  commands above.

# Phase 9 — Report completion

```
EPIC CLOSED: <Epic Title>

GitHub epic issue: #<epic-issue> — closed
Close record:      ${QDIR}/close-record.md   (committed; distiller consumes it post-merge)
Queue entry:       [member mode] migrated → <hub-root>/.nexus/queue/<entry-dir-name>/
                   (hub commit <sha> on '<hub-branch>'); removed here (commit <sha> on '<branch>')
Deferred scope:    <feature-path>/backlog.md  (<N> item(s))
Process lesson:    <docs-root>/delivery/lessons/<date>-<slug>.md
Scratch mined:     ${QDIR}/*/ — <N> stub(s) across <K> engineer dir(s); stays in the
                   committed entry (distiller drains it with the entry post-merge)

Key decisions captured: <count>
Deviations recorded:    <count>
```

(Use "none" when no per-user dir was present.)

In member mode, end the report with the durability instruction — closure is not durable until
the hub commit is pushed:

    ACTION REQUIRED — push the hub commit:
        git -C <hub-root> push

In single-repo and hub mode without `--pr`, omit the Queue entry line and the push instruction; the
close record's line already says the entry stays and is consumed post-merge.

In `--pr` mode, replace the Queue-entry line with the distill-branch state and end with the
hand-off (the artifacts live on the pushed distill branch, and distill continues in the worktree):

    Distill branch:    distill/<date>-<slug>  (pushed; close record + backlog + lesson committed)
    Worktree:          <wtPath>

    NEXT — continue the drain from the worktree:
        cd <wtPath> && /nxs.distill

    (If the push failed:  ACTION REQUIRED — git -C <wtPath> push)

# Constraints

- **No search for epic files** — resolve from `$ARGUMENTS` or the open editor only.
- **No task-file mining** — the task layer is cut (0009). Never look for `TASK-*.md` or a `tasks/`
  folder; never `rm -rf` a tasks folder. Decisions come from the epic + story issue comments + the
  close review (C6).
- **Human prose only** — the close record has **no `ConceptDelta` block**; do not generate `PIR.md`.
- **Deferred scope goes to the backlog** — the close record carries only a pointer (C2).
- **The lesson is its own file** — the close record carries only a pointer (C3).
- **Do not proceed past the checkpoint** without an explicit `close` selection.
- **Precondition is a hard block** — never close the epic issue while a child story issue is open, and
  never auto-close story issues.
- **The analyze gate detects, it does not substitute** — on a missing/stale receipt or open
  critical/high findings, either stop (user runs `/nxs.analyze` and re-runs close) or proceed on an
  **explicit user waiver**; never run the analysis from inside close, and never proceed silently. A
  waiver is always recorded in the close record's `analyze:` frontmatter and surfaced in the close
  comment.
- **Never link an ephemeral queue file from the issue** — the close comment inlines the close-record
  prose; the distiller deletes the queue entry post-merge. Link only durable targets (feature backlog,
  lesson file, concept pages, anchors, other issues).
- Handle an already-closed epic issue gracefully.
- **Every issue op targets the resolved issues-repo** — the epic and its story issues are filed into
  `github.issues-repo`, resolved once in Phase 1.0 **through the shared resolver** (never by parsing
  `settings.yml`). Every `gh issue`/`gh api` call addressing the epic or a story issue carries
  `$REPO_ARG`; an empty value means the current repo (today's behavior). Close previously ignored this
  configured repo — resolving and threading it is the concrete bug STORY-121.04 fixes.
- **Scratch is hints, never authority** — a decision stub in `${QDIR}/*/decisions-*.md` or an
  engineer note enters the close record only when the diff confirms it or the human ratifies it
  as deviation rationale. The diff remains ground truth (0006).
- **The distiller ignores the per-user scratch dirs.** They live inside the committed entry
  but are never read into a `ConceptDelta`; the close record's prose is the only carrier of
  rationale onward. The entry (scratch included) is deleted when the distillation-PR merges.
- **Role comes from the workspace preflight** (Phase 1.3 — the shared resolver's committed
  artifacts: manifest → hub, pointer → member, neither → single-repo), never a new heuristic.
  Migration fires only in member mode; in single-repo and hub mode no hub write is ever attempted
  and the entry is never removed — it must reach that checkout's `main` for its own distiller.
- **Range stamping is unconditional** — every close record carries the full-SHA `range:` list, in
  every mode, taken from the same base/head Phase 3 diffed.
- **Never bypass the migration helper** — the migrate → verify → gated-remove order is encoded in
  `close_migration.ts migrate`; never copy, commit, or remove the entry with inline git, and
  never remove the entry unless the helper confirmed the hub commit.
- **Cross-repo mutations run only between the Phase 7 checkpoint and the Phase 8 GitHub writes**,
  and the checkpoint summary names them with the target hub root and branch.
- **A member close ends with the push instruction** — until the hub commit is pushed, the migrated
  entry has no copy off this machine.
- **`--pr` mode is post-merge, single-repo/hub, in a worktree.** Phase 0.5 gates on a merged PR and
  rejects member repos; every phase runs inside the worktree; the role and range come from the helper
  (Phase 1.3 preflight is skipped). The conformance gate reads the PR review's machine block, not the
  file. The close record + backlog + lesson are committed on the distill branch and **pushed** (they
  have no feature PR to ride); the close record is later `git rm`'d by `/nxs.distill` on the same
  branch, so the epic-issue comment is its durable copy. Never fall back to the local path when
  `--pr` was passed.
- **The queue entry is born at close (invariant 15), not at planning.** Under issue-sourced planning
  (#114) nothing is committed at planning, so in `--pr` mode with no committed entry, Phase 0.5
  materializes the epic via the resolver into a fresh `.nexus/queue/<slug>-<id>/epic.md` and Phase 7.6
  commits it with the close record in one commit — so every trunk-queue entry carries a close record
  and the distiller receives a complete entry. This adds one materialization step to the existing
  #101 post-merge flow; it is **not** a second close mechanism. Single-repo / single-PR only —
  workspace and multi-PR born-at-close are out of scope (`hub-close-multi-pr`). A `decision-record.md`
  is **not** written here (its durable home is `hld-subissue-record`); Phase 3 runs its downgraded
  no-invariant deviation pass.

# Usage

```
/nxs.close                          # epic from the open editor file
/nxs.close path/to/epic.md          # explicit epic path
/nxs.close --pr 123                 # post-merge close of PR #123; epic born at close from the PR's linked issue
/nxs.close --pr 123 path/to/epic.md # post-merge close of an old-contract epic whose entry rode the PR
```
