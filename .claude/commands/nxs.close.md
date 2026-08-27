---
name: nxs.close
description: Close an epic. Emits a human-prose close record beside the resolved epic.md — under the gitignored .nexus/tmp/ for an issue-sourced local close, in the committed entry for an old-contract one — (key decisions + deferred-scope pointer + deviation rationale from a close-from-diff pass), files deferred scope as backlog stub issues after the checkpoint, writes the process lesson as its own file, then — after a checkpoint — posts the durable close comment (prose + machine block) on the epic GitHub issue and closes it. Preconditions — every sub-issue of the epic closed, story or decision record alike (hard block), and /nxs.analyze ran (its analyze-receipt.md present and current; missing/stale/blocking requires an explicit user waiver). With `--pr <N>` it runs post-merge in a worktree on a fresh distill branch (gated on the PR being merged), reads the analyze result from the PR review, commits and pushes the close artifacts, and hands off to /nxs.distill; single-repo and hub only.
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
the epic, the story issue comments, and the close review (C6).

**Durability lives on the epic issue, not in the file** (record #176): the close comment posted in
Phase 8.2 is the single durable copy of a close's rationale, in every mode. The close-record *file*
is hand-off content. For an **issue-sourced local close** (#172) it lands under the gitignored
`.nexus/tmp/epic-<epic-issue>/` beside the materialized `epic.md`, where the same-sitting
`/nxs.distill` consumes it — never committed, never described as committed on any surface. An
**old-contract entry** keeps its committed `.nexus/queue/` placement, travels to main with the PR,
and the distiller consumes and deletes it there — unchanged.

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
4. **No path, no `--pr`, but the epic issue number is resolvable** — an explicit `#<n>` / `<n>` in
   `$ARGUMENTS`, else the current branch's linked issue → its parent epic — → resolve the epic into
   the gitignored `.nexus/tmp/` (the issue-sourced local norm, #114 / #172):

    ```bash
    nexus epic-resolve --epic <n>
    ```

   Use the printed `outPath`'s directory (`.nexus/tmp/epic-<n>/`) as the entry. A same-sitting
   `/nxs.analyze` already materialized this same directory and left `analyze-receipt.md` beside it
   (#171); re-resolving is byte-identical against an unchanged issue graph. On a non-zero resolver
   exit, report the diagnostic and stop.
5. **Otherwise** → stop and ask the user to either open the `*epic.md` in their editor and re-run,
   pass the path (`/nxs.close path/to/epic.md`), or pass the epic issue number.

If `$ARGUMENTS` also contains **`--pr <N>`** (string-matched, like `/nxs.epic --resume`), close runs
the **post-merge worktree flow** in Phase 0.5. Strip the `--pr <N>` token first. In `--pr` mode the
`*epic.md` path is **optional**: under issue-sourced planning (#114) nothing is committed at planning,
so if no path is given (the normal case) the epic is **resolved from the PR's linked issue and born at
close** — materialized into a fresh committed queue entry in Phase 0.5. If a path IS given (an
old-contract epic whose committed entry rode the PR), it resolves as above and is re-rooted into the
worktree (invariant 14).

**Never** run `find`, `ls`, or any search to locate the epic. When a committed `epic.md` is resolved
it fixes the **queue entry directory** (its parent); `close-record.md` is its sibling there (and, for
an old-contract entry only, `decision-record.md`). On the born-at-close path the entry directory is **created** in Phase 0.5 (the
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
      records it on each deferred-scope stub and derives the sibling lessons location from it — it
      never re-resolves the docs root. Compute two names now and reuse them below:
        - **`<feature-path>`** = the `feature_path` value. (If `feature_path` is absent — a pre-epic
          entry — fall back to `docs/features/<feature>`, today's literal.)
        - **`<docs-root>`** = `<feature-path>` with its final two segments (`features/<slug>`) removed:
          `docs` for `docs/features/onboarding`, or the **empty string** for `features/onboarding`.
          When `<docs-root>` is empty, a taxonomy path hangs directly off the repo root (no `./`
          prefix, no `.`-named segment).
    - `complexity` — the story-size rollup (used for lesson framing)

2. Set `QDIR` = the directory containing `*epic.md` — a committed queue entry, or the ephemeral
   `.nexus/tmp/epic-<n>/` materialization for an issue-sourced local close (#172).

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
    nexus pr-worktree preflight --pr <N> --mode close
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
    nexus pr-worktree open --pr <N> --mode close \
      --branch "distill/$(date +%Y-%m-%d)-<epic-slug-or-epic-issue>"
    ```

    It prints `{ wtPath, range: { repo, base, head } }`. The branch is cut from the trunk
    (post-merge `origin/main`), so `wtPath` holds the merged code. `range` is the
    merge-commit-anchored, squash/merge/rebase-safe range (full SHAs) — **keep it for Phase 3 and the
    Phase 4 stamp.**

4. **Resolve `QDIR` — dual: born-at-close, else a committed entry (invariant 14, 15).** Operate
   inside `wtPath` for every path operation below.
    - **Committed entry present** — a path was given, or a directory **containing `epic.md`** for this
      epic already exists under `wtPath/.nexus/queue/…` (an old-contract epic whose entry rode the PR):
      set `QDIR` to that entry re-rooted under `wtPath/.nexus/queue/…`. Its `epic.md` is already
      committed; skip the materialization below. A `.nexus/queue/epic-<epic-issue>/` directory holding
      only per-user scratch dirs is **not** a committed entry — it is this epic's scratch home, written
      during implementation by the capture rule, and it is the directory the born-at-close entry below
      materializes into.
    - **Born at close (nothing committed at planning)** — no committed entry exists. Materialize the
      epic into the epic's **committed queue entry** so the queue is born here, not at planning. The
      entry directory is `epic-<epic-issue>` — the same path the capture rule writes scratch to, so a
      branch that captured stubs already created it and its stubs are in the entry with nothing moved:

        ```bash
        nexus epic-resolve \
          --epic <epic-issue> --dir "$wtPath" --out "$wtPath/.nexus/tmp/born-<epic-issue>/epic.md"
        QDIR="$wtPath/.nexus/queue/epic-<epic-issue>"
        mkdir -p "$QDIR" && mv "$wtPath/.nexus/tmp/born-<epic-issue>/epic.md" "$QDIR/epic.md"
        ```

      `mkdir -p` is deliberate: the directory may already exist and hold committed scratch, which is
      left exactly where it is. On a non-zero resolver exit, report the diagnostic and stop (no entry
      is created). The
      materialized `epic.md` now lives at a **tracked** `.nexus/queue/…` path (not the gitignored
      `.nexus/tmp/`) — it is committed with the close record in Phase 7.6 as the born-at-close entry.
      The entry carries **no `decision-record.md`** (nothing was committed at planning; the durable
      record home is the epic's **record sub-issue**). That is not a downgrade: Phase 2 resolves the
      deviation baseline per entry from what is actually present, so it fetches the record sub-issue's
      body and Phase 3 runs the full invariant-aware pass. Only an epic with **no record at all**
      falls back to the downgraded, no-invariant pass.

   Then run **Phase 0's frontmatter parsing** against `${QDIR}/epic.md` (title, `link`, `feature`,
   `feature_path`, `complexity`). `<feature-path>`, `<docs-root>`, and the lesson all
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
ISSUES_REPO="$(nexus-gh config resolve epic-repo --root "<root>")"
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

## 1.1 Every sub-issue of the epic is closed (hard block)

The epic cannot close while **any** sub-issue is still open — a story, the decision record, or
anything else attached to it. **Block here if any is open — do not auto-close them, do not proceed.**

Broadening the old all-stories-closed gate to any open sub-issue is what makes an **unapproved
decision record** block the epic through a mechanism that already exists rather than a parallel one
(#139): approval *is* the close of the record sub-issue. Keep this gate free of kind exemptions —
having no bypass is its one virtue, and detaching a stray sub-issue is a one-second remedy.

1. Determine the sub-issues and **their kinds**. The authoritative source is the epic issue's
   sub-issue list; the resolver already classified them (its `record` field names the decision
   record, and the materialized `epic.md` carries `record` / `record_state`). Source in order:
    - The `## Implementation Sequence` table in the queue `epic.md` (the `Issue` column) for the
      stories, plus the `record` frontmatter for the decision record.
    - Fallback — the epic issue's sub-issues via the API (this returns **every** kind):

        ```bash
        gh api graphql -f query='
          query($owner:String!,$repo:String!,$num:Int!){
            repository(owner:$owner,name:$repo){
              issue(number:$num){ subIssues(first:100){ nodes{ number title state } } }
            }
          }' -F owner=<owner> -F repo=<repo> -F num=<epic-issue> \
          --jq '.data.repository.issue.subIssues.nodes[] | "\(.number) \(.state) \(.title)"'
        ```

2. Check each sub-issue's state (in the resolved issues-repo — see Phase 1.0):

    ```bash
    gh issue view <sub-issue> $REPO_ARG --json number,title,state
    ```

3. **If any sub-issue is `OPEN`**, block and report the open ones **with their kind**, then stop:

    ```
    Cannot close epic #<epic-issue>: <N> open sub-issue(s).

      #<n> [story]           — <title>
      #<n> [decision record] — <title>   ← unapproved: closing it IS the approval
      #<n> [other]           — <title>   ← detach it from the epic or close it

    Close (or reopen and complete) each before closing the epic. This command never closes a
    sub-issue itself — not a story, and not the record.
    ```

Only when **all** sub-issues are closed do you continue. If the epic has no sub-issues at all, warn
and continue (a manually managed epic).

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

   The receipt also carries `record` / `record_hash` in full mode (#139) — the decision record the
   analysis checked against. **Staleness has two independent axes, and neither is inferred from the
   other:** the code may have moved after the analysis, the design may have moved after it, or both.

    **Record axis.** When the receipt carries `record`/`record_hash`, re-hash the record issue's
    **current** body through the one digest program and compare:

    ```bash
    nexus record-digest --issue <record> ${ISSUES_REPO:+--repo $ISSUES_REPO}
    ```

    A different digest means the record was revised after the analysis. (A receipt with no record
    keys came from a degraded-mode run over an epic with no record; there is no record axis to
    evaluate.)

   Classify the state:
    - **clean** — receipt found, no critical/high findings, **current on both axes**:
      local → `git rev-list --count <head>..HEAD` is `0`;
      `--pr` → the block `head` **equals** the PR head (`gh pr view <N> --json headRefOid`) exactly
      (full-SHA equality — do **not** use `git rev-list`, which is meaningless across a
      squash/rebase); **and** the stamped `record_hash` equals the record's current digest. Set the
      close record's `analyze:` value to `ran <date> @ <head>` and continue silently to Phase 2.
    - **missing** — no receipt / no trusted machine block: `/nxs.analyze` never ran on this entry.
    - **stale (code)** — local: commits landed after the receipt (`git rev-list --count <head>..HEAD`
      > 0; report the count); `--pr`: the block `head` ≠ the PR head (a commit landed after analysis).
    - **stale (record)** — the stamped `record_hash` ≠ the record's current digest: the design was
      revised after it was analysed.
    - **blocking** — the receipt reports critical or high findings: analyze judged the code
      does not yet satisfy the epic.

   Both staleness axes can hold at once; report **each** by name, never collapsed into one "stale".
2. On **missing / stale (either axis) / blocking**, render a one-paragraph markdown note naming the
   state and what it means, then ask via `AskUserQuestion` — never proceed silently:
    - missing → **"Run /nxs.analyze first (Recommended)"** | "Close without analysis"
    - stale (code) → **"Re-run /nxs.analyze (Recommended)"** | "Proceed with the stale receipt"
    - stale (record) → **"Re-run /nxs.analyze (Recommended)"** | "Proceed against the revised record"
    - blocking → **"Stop and fix the findings (Recommended)"** | "Override and close"

   The two axes take the **same explicit waiver**: a lead who may knowingly proceed on an unanalysed
   commit may knowingly proceed on a revised record, through the same gate.
3. If the user picks the recommended option, **stop**: tell them to run `/nxs.analyze` (fixing
   findings first, for blocking) and then re-run `/nxs.close`. Do not run the analysis yourself —
   the gate detects, it does not substitute.
4. If the user picks the proceed option, set the waiver text for the close record's `analyze:`
   frontmatter (Phase 4) and continue — one clause per axis that was waived:
    - missing → `waived — closed without /nxs.analyze (<YYYY-MM-DD>)`
    - stale (code) → `stale — ran <date> @ <head>, <N> commit(s) unanalyzed; waived <YYYY-MM-DD>`
    - stale (record) → `stale — record #<record> revised since analysis (<stamped-hash> → <current-hash>); waived <YYYY-MM-DD>`
    - blocking → `overridden — <C> critical / <H> high finding(s) open; waived <YYYY-MM-DD>`

## 1.3 Workspace preflight (role gate)

**In `--pr` mode, skip this section** — Phase 0.5 already resolved the role (single-repo or hub;
member is rejected) and no migration ever runs. Use the Phase 0.5 `range.repo` as the range identity
and continue to Phase 2.

Close behaves differently in a multi-repo workspace. Resolve the role once, through the shared
resolver's helper — never a heuristic of your own:

```bash
nexus close-migration preflight
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

1. **`epic.md`** in `QDIR` and **the decision record** — the planned decisions (baseline; the close
   record captures what *changed* against these, not a restatement). Resolve the record's baseline
   **per entry, from what is actually present** — no flag, no mode switch, no migration:
    1. the epic's **record sub-issue** when it has one (fetch the body: `gh issue view <record>
       $REPO_ARG --json body --jq .body`) — the norm under #139;
    2. else a committed **`decision-record.md`** in `QDIR` — an old-contract entry, exactly as today;
    3. else the close record alone (no invariants; the deviation pass is downgraded).
2. **Story issue comments** — read the comment thread on each child story issue for decisions recorded
   during implementation (in the resolved issues-repo — see Phase 1.0):

    ```bash
    gh issue view <story-issue> $REPO_ARG --json title,body,comments
    ```

3. **Committed decision stubs** — `${SDIR}/*/decisions-*.md` (one per-user subdir per
   engineer; per-branch files), where `SDIR` is the epic's **scratch home**, no branch→epic mapping
   needed. Capture keys the scratch path on the epic issue number, so `SDIR` is
   `<root>/.nexus/queue/epic-<epic-issue>` — resolved from the **epic issue number**, never from
   `QDIR`: under issue-sourced planning a locally resolved `epic.md` is a materialization under
   `.nexus/tmp/`, which never holds scratch, so deriving the scratch home from the entry's parent
   would silently miss every stub. For an old-contract entry whose directory is slug-named, read both
   it and the epic-issue path; either is valid input and neither is required:

    ```bash
    SDIR="<root>/.nexus/queue/epic-<epic-issue>"   # <root> per Phase 1.0: repo root, or $wtPath in --pr mode
    ls "${QDIR}"/*/decisions-*.md "${SDIR}"/*/decisions-*.md 2>/dev/null   # SDIR == QDIR for a born-at-close entry
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
   constraints, and invariants (the baseline resolved in Phase 2). A deviation is where the code
   diverges from what the decision record implied: a constraint relaxed, an invariant worked around,
   an approach changed, a named component replaced. Matched work needs no entry.

    - **Name the baseline on each deviation.** Every deviation's rationale states the record issue
      it deviated from (`#<record>`) — the queue entry is deleted by the drain, so the rationale
      must stay self-contained once it is gone.
    - If the epic has no decision record at all, say so and derive deviations only against the
      epic's stated approach/scope (downgraded — no invariant check).

4. **Force rationale on each deviation.** Present the detected deviations to the user and collect **why
   each happened** (one prompt covering the list; use `AskUserQuestion` if the set is small and
   discrete, otherwise ask for the rationale inline). Only deviations get an entry.

5. **Consult committed engineer notes as weak hints** — `${QDIR}/*/notes-*.md` and
   `${SDIR}/*/notes-*.md` (Phase 2), if any.
   Working scratch, routinely diverges from what ships; use only to *notice* deviations
   (notes said X, the diff shows Y — ask about it), never as a source of record. (No
   `hld-*.md` glob — developer HLDs are not captured in the queue; see the layout spec.)

6. **Mark the superseding subset** — of the deviations above, which ones **change what the record
   decided**? The admission test is a contradiction: the record decided X and the shipped code does
   **not**-X — an approved choice refuted, replaced, or inverted. A deviation that merely elaborates,
   extends, or implements something the record left unstated is **not** superseding. Carry the marked
   subset (record's decision · what shipped · the human's why) into Phase 8.1; it is a subset of the
   Deviation Rationale, never a separate collection, and it is empty on a conformant close.

If the diff shows **no** deviation from the decision record, record that plainly — the Deviation
Rationale section is then empty (a matched implementation, not a gap), and nothing is marked in step 6.

# Phase 4 — Write the close record

Fill the seeded template and write it into the queue entry.

1. Read the seeded project template: **`.nexus/config/templates/close-record-template.md`**. (If the
   seeded copy is absent, fall back to the toolkit master `common/templates/close-record-template.md`.)

   The seeded copy is a tuned project file — seeding never clobbers it — so it may predate any field
   this command names and carry no placeholder for it. **The field list in step 2 is authoritative,
   not the template's placeholder set**: write every field named below, whether or not the template
   you read has a `{{PLACEHOLDER}}` for it. Placeholders present but not named below are the
   project's own; fill them as the template's guidance says.

2. Fill every `{{PLACEHOLDER}}` and **delete the guidance comments**:
    - `title` / `epic` (the `link` ref) / `feature` / `date` (today).
    - `nexus_version` — the **writer stamp** (story #306): the release that wrote this record, from
      `nexus version`. Written into the frontmatter **whether or not the template carries the
      placeholder** — a seeded copy predating the stamp has none, and the record is stamped anyway.
      Omit the key when the release is unresolved rather than writing a version that is not true; an
      absent stamp reads as an unknown writer, which is never an error. It sits beside `record_hash`,
      never inside the record bytes that digest covers, so stamping leaves every hash a later stage
      verifies exactly as it was.
    - `analyze` — the conformance-gate outcome from Phase 1.2 (`ran … @ …`, or the waiver text,
      one clause per waived axis).
    - `record` / `record_hash` — the decision record this epic was built against, as an **issue
      reference** (`#<record>`) plus the **full** approved-body digest from the digest program.
      Never a queue path: the drain deletes queue paths, which is the exact failure this epic
      exists to fix. Omit both keys when the epic legitimately has no record.
    - `range` — **unconditional, every mode**: exactly one list entry with `repo` = the Phase 1.3
      preflight's repo identity, `base` = `$BASE`, `head` = `$HEAD_SHA` (Phase 3) — **full commit
      SHAs**, never `HEAD` or a branch name. The list shape is deliberate: a future cross-repo
      epic appends entries; this epic always writes exactly one (the home repo). **In `--pr` mode**,
      `repo`/`base`/`head` are exactly the Phase 0.5 `range` output (the helper already resolved the
      identity and the merge-commit-anchored SHAs).
    - **Key Decisions** — from Phase 2 (decision + why + refuted viable alternative if any).
    - **Deviation Rationale** — from Phase 3 (one bullet per deviation; the *why* the human
      supplied, naming the record issue it deviated from).
    - **Deferred Scope** — the **issue numbers** of the deferred-scope stubs (the scope itself
      lives on those issues, not restated here). They do not exist yet at this point: leave the
      section marked `<pending — filed in Phase 7.4>`, or write "none" when nothing was deferred.
      Phase 7.4 fills the numbers in **before** the record is committed anywhere.
    - **Process Lesson** — a **pointer only** to the lesson file written in Phase 6.

3. Write it to **`${QDIR}/close-record.md`**, beside `epic.md`. Placement follows the entry (#172):
    - **Issue-sourced local close** (`QDIR` under `.nexus/tmp/`) — the close record lands there as
      ephemeral hand-off content for the same-sitting `/nxs.distill`. No manual `git add` or
      `git commit` is needed to hand off, and none is run: nothing durable depends on this file
      surviving (the durable copy is the Phase 8.2 close comment).
    - **Old-contract entry** (committed `epic.md` under `.nexus/queue/`) — the close record still
      lands in that committed directory, unchanged from before.
    - **`--pr` mode** — unchanged: Phase 0.5 / Phase 7.6 commit the born-at-close `epic.md` +
      `close-record.md` onto the distill branch, because those artifacts have no feature PR to ride.

   Do **not** emit a `ConceptDelta` block; the record is human prose only.

# Phase 5 — Author the deferred-scope stubs (nothing is filed yet)

Deferred scope becomes **stub issues**, not close-record prose (C2) and no longer a `backlog.md`
append. A stub is an epic identified but not yet planned, so it carries the repository's declared
epic classification plus exactly one label denoting that unplanned state — the same contract
`/nxs.epic`'s decomposition stubs use (0008).

Filing an issue is **irreversible**, so this phase only *authors* the work-items; Phase 7.4 files
them, after the checkpoint. Write **no** `backlog.md`.

1. **Resolve the classification and the unplanned label** (never hard-code either):

    ```bash
    nexus-gh config resolve epic-label
    nexus-gh config resolve epic-type
    nexus-gh config resolve unplanned-label
    ```

2. **Write one transient work-item per deferred item** to a session scratch folder — never under
   `<feature-path>`, never inside `${QDIR}`, never committed — named `STORY-STUB-<NN>.md`. There is
   no `parent:` key: a stub is never a sub-issue of anything, least of all of the epic being closed
   (the filer refuses a parented stub outright).

    ```markdown
    ---
    ref: "STUB-<NN>"                         # internal authoring key for the blocked_by graph
    title: "<Deferred goal as an epic title>"
    blocked_by: [STUB-<NN>, ...] | none      # ordering between deferred items, this batch only
    labels: [<unplanned-label>]              # the resolved unplanned label — nothing else
    ---

    <one-line functional goal>

    ## Meta

    - **feature:** <feature-path>
    - **estimate:** S | M
    - **source:** deferred from epic <epic-title> (#<epic-issue>) (<YYYY-MM-DD>)
    ```

   The `source` line's epic mention is the **only** link back to the epic — GitHub renders it as a
   back-reference on the epic issue without creating a sub-issue, so the all-sub-issues-closed
   precondition (Phase 1.1) can never be deadlocked by a stub this stage itself filed.

   If nothing was deferred, skip this phase and Phase 7.4, and leave the close record's Deferred
   Scope section reading "none".

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

**STOP AND WAIT.** All the above (close record, deferred-scope work-items, lesson) is local and
reversible; the stub filing, the GitHub comment and the issue close are not. Render the summary as
markdown first:

```
CHECKPOINT: Epic Closure

Ready to close epic "<Epic Title>" (#<epic-issue>).

Written:
0. [born-at-close only] Materialized epic → ${QDIR}/epic.md  (resolved from issue #<epic-issue>)
1. Close record  → ${QDIR}/close-record.md
   [issue-sourced local: items 0–1 are ephemeral hand-off content under .nexus/tmp/ —
    consumed by /nxs.distill in this sitting; the durable copy of the rationale is the
    close comment posted in step 6]
2. Deferred-scope stubs → <N> work-item(s) authored in session scratch (nothing filed yet)
3. Process lesson → <docs-root>/delivery/lessons/<date>-<slug>.md
   (in `--pr` mode all of these are inside the worktree <wtPath>)

Preconditions: all <M> sub-issues closed (<S> stories + the decision record, when there is one) ·
analyze: <the Phase 1.2 outcome> ·
workspace: <the Phase 1.3 role or the Phase 0.5 role in --pr mode>.

About to:
3b. File <N> deferred-scope stub issue(s) — one open '<unplanned-label>' issue per deferred item
    (irreversible), then fill their numbers into the close record's Deferred Scope section
4. [member mode only] Migrate the queue entry → <hub-root>/.nexus/queue/<entry-dir-name>/
   — committed on the hub's current branch '<hub-branch>' (local git, recoverable)
5. [member mode only] Remove the queue entry from this repo — committed on branch '<branch>'
   (local git, recoverable)
5b. [--pr mode only] Commit the born-at-close epic.md (if born here) + close record + lesson on
    branch 'distill/<date>-<slug>' and push it — durability; these artifacts have no feature PR
    to ride
6. Post the close comment on epic issue #<epic-issue>  (irreversible)
7. Close epic issue #<epic-issue>  (irreversible)
```

In single-repo and hub mode without `--pr`, omit items 4–5b (and renumber) — the list reads exactly
as today. In `--pr` mode, omit items 4–5 (never migrated) but keep 5b. When `QDIR` is a `.nexus/tmp/`
materialization, the summary describes the entry's artifacts as **ephemeral hand-off content** —
never as "committed" (#172; record #176 invariant 1).

Then ask via **`AskUserQuestion`** (not free text). Three options:

- **close** — proceed to Phase 7.4 (file the deferred-scope stubs), then Phase 7.5 (member mode) /
  Phase 7.6 (`--pr` mode) and then Phase 8 (post the comment, close the epic issue).
- **abort** — stop; leave the epic issue open. The local artifacts stay written and **no stub issue
  is created**.
- **review** — display the generated `close-record.md`, then ask again.

**Handle the selection** (treat an "Other" answer by intent):

- **close** → Phase 7.4, then Phase 7.5 in member mode, Phase 7.6 in `--pr` mode, otherwise Phase 8.
- **abort** → stop with:

    ```
    Epic closure aborted.

    The close record and lesson are written; no stub issue was filed and the GitHub issue
    remains open.
    Close it manually when ready:  gh issue close <epic-issue> --reason completed
    ```

- **review** → print `close-record.md`, then re-ask via `AskUserQuestion`.

# Phase 7.4 — File the deferred-scope stubs

**Skip this phase when nothing was deferred.** Otherwise it is the **first** step after the
checkpoint — ahead of the migration, ahead of the `--pr` commit, ahead of the close comment. That
position is forced from both sides: creating an issue cannot be undone, so it must come after
consent; and the close record must name the resulting issue numbers, so it must come before the
record is committed anywhere (in `--pr` mode Phase 7.6 commits and pushes it).

1. **File the batch** authored in Phase 5, classified as an **epic** rather than a story:

    ```bash
    nexus-gh create-story "<scratch-folder>" \
        --classification-label "<epic-label>" \
        --classification-type "<epic-type>"
    ```

    The filer upserts every label it will apply **before** creating anything, so a repository that
    has never seen the unplanned label still files cleanly; if a label can be neither created nor
    found it reports the gap and creates nothing. It refuses any work-item that carries the
    unplanned label and a `parent:` — Invariant 6 is enforced there, not merely promised here. Pass 2
    wires the native `blocked_by` edges between the deferred items. With `github.project: none` no
    project is touched. The run is resumable and idempotent — on `⚠️ INCOMPLETE`, re-run the exact
    same command.

    Discard the transient work-items only after a `✅ Complete` run.

2. **Fill the close record's Deferred Scope section** with the created issue numbers — one line per
   item, `#<issue> — <one-line goal>`. This is the edit that makes the record's pointer durable, and
   it must land before Phase 7.6 commits the record.

3. If filing fails outright, **stop before Phase 8**: report the failure and leave the epic issue
   open. A close comment that promises deferred scope no issue carries is worse than a re-run.

# Phase 7.5 — Migrate the entry to the hub queue (member mode only)

**Skip this phase entirely in single-repo and hub mode.**

On an approved **close**, run the migration helper. It performs the full ordered sequence —
copy the working-tree entry (the just-written `close-record.md` and `analyze-receipt.md`
included), commit it in the hub (path-scoped, so unrelated hub work is untouched), **verify**
the hub commit contains the entry byte-for-byte, and only on that confirmation remove the entry
here and commit the deletion on the current branch. **Never reproduce these steps as inline
git** — the ordering is the no-data-loss invariant, and it lives in the helper.

```bash
nexus close-migration migrate "${QDIR}"
```

**A member close is always non-`--pr`, and its end state stays durable** (#175): "ephemeral"
describes where a member close *writes*, never where it *ends*. When `QDIR` is the
`.nexus/tmp/epic-<n>/` materialization (#172), pass that path — the helper's **migration unit is
the epic**: it commits the **union** of the ephemeral artifacts and the epic's committed per-user
scratch (`.nexus/queue/epic-<n>/`) into exactly one hub entry, verifies it byte-for-byte (the
gitignored source changes nothing — the helper walks the filesystem and hashes content directly),
and then removes **both** local copies, so no tmp copy is left behind for a later `/nxs.distill`
in this checkout to discover as a second, separately drainable entry. Drain-SLO attribution in
the hub is unchanged: the first `range:` entry's `repo` in `close-record.md`, aged from the
migration commit. In single-repo and hub mode no migration happens and #172's tmp-only behavior
applies unchanged.

- **exit 0** → the entry now exists in exactly one place: the hub queue. Record the printed hub
  commit SHA and hub branch for the Phase 9 report, then continue to Phase 8.
- **exit non-zero** → **stop before any GitHub write.** Print the helper's diagnostic verbatim.
  The helper has already cleaned any partial hub copy; the entry is intact in this repo. Tell the
  user to fix the named problem and re-run `/nxs.close` — the re-run is idempotent (an entry
  already verified in the hub proceeds straight to removal).

# Phase 7.6 — Commit & push the distill branch (`--pr` mode only)

**Skip this phase entirely without `--pr`** (and it never coexists with Phase 7.5 — member mode is
rejected in Phase 0.5). On an approved **close**, the close record (with Phase 7.4's stub issue
numbers already filled in) and the lesson were written inside the worktree; they have **no feature PR to ride to main**, so commit them on the
distill branch and push it — pushing is the durability guarantee (until then the only copy is one
worktree on one machine).

**Born-at-close (invariant 15):** when Phase 0.5 materialized the epic into a fresh entry, the
**`${QDIR}/epic.md`** is a new tracked file too — commit it in **this same commit**, so the born-at-
close entry (materialized `epic.md` + `close-record.md`) lands atomically. The queue then holds only
closed, drainable entries (Success Metric: 100% of trunk-queue entries carry a close record). On the
committed-entry path `epic.md` was already tracked, so `git add` simply no-ops on it.

```bash
git -C <wtPath> add "${QDIR}/epic.md" "${QDIR}/close-record.md" <lesson>  # paths inside <wtPath>
git -C <wtPath> commit -m "close: <epic-slug> — born-at-close epic, close record, lesson"
git -C <wtPath> push -u origin "distill/<date>-<slug>"
```

- The close record's `git rm` happens later, on this same branch, in `/nxs.distill` — so the record
  is add-then-deleted within the branch (durable via the epic-issue comment in Phase 8, and via the
  concept pages + lesson the distillation-PR lands). The born `epic.md` is consumed and
  deleted with the whole entry when the distillation-PR merges.
- If the push fails, continue to Phase 8 but end the run with an `ACTION REQUIRED: git -C <wtPath>
  push` — closure is not durable off this machine until the branch is pushed.

# Phase 8 — Post the comments and close the epic issue

In member mode this phase runs only after Phase 7.5 succeeded; in `--pr` mode, only after Phase 7.6.

## 8.1 Amend the decision record (advisory; only when the record was superseded)

If Phase 3.6 marked **nothing**, do nothing here — no comment, and nothing reported as missing.
Silence on the record thread means the implementation conformed to it. Skip this step entirely when
the epic has no record at all.

Otherwise post **one** comment on the epic's **decision-record sub-issue** — the record is the durable
answer to "why is it built this way", and a reader of that design must not be told a choice was made
that the shipped code refuted. Write the body to a scratch file and post it with `--body-file`:

```bash
gh issue comment <record> $REPO_ARG --body-file "<scratch>/record-amendment.md"
```

```markdown
## Amended at close — <N> decision(s) superseded

`/nxs.close` verified these against the shipped diff (`<base>`…`<head>`). The record body stands as
approved; this comment is the correction, not a re-decision.

- **<what the record decided>** → **shipped:** <what the code does instead>. <why>
- …
```

- **Prose only, never raw scratch.** Decision stubs and notes are input evidence to Phase 3; no stub
  text is posted. Only diff-verified superseding decisions appear.
- **The body is never edited**, nor the title, labels, or state. The record hash every stage stamps is
  canonicalised over the issue *body* alone (`nxs-record-digest`), so this comment leaves every stamped
  receipt valid — a body edit would report an approved design as changed. Never reopen the record and
  never `--revise` it from here; that is the lead's pre-implementation mechanism.
- **Advisory tier.** It gates nothing. A `gh` failure is reported on the Phase 9 `Record amendment`
  line (the `NOT POSTED` variant, naming the error) and the run continues to 8.2 — close's real gates
  are sub-issue state and the conformance verdict. The superseding decisions are already in the close
  record's Deviation Rationale, so a failed post loses no content.
- **Self-contained.** Like the epic comment below, it links nothing under `.nexus/queue/`.

## 8.2 Post the close comment and close the epic issue

GitHub ops target the **epic issue** via `link`. The epic issue is a **durable** surface; the
close-record file is **ephemeral** in every placement — a committed entry drains post-merge, and a
`.nexus/tmp/` entry is hand-off only. **This comment is the single durable copy of the close's
rationale** (record #176, invariant 4) — for an issue-sourced local close, nothing else survives —
so nothing in this comment-writing step may be skipped or thinned because the file moved to
`.nexus/tmp/` (#172). The comment carries the close record's **prose inline** (Key Decisions +
Deviation Rationale, in full); it must **never** link into `.nexus/queue/` or `.nexus/tmp/`, or the
link dangles the moment the entry is consumed. Durable pointers — the
deferred-scope stub issues and the lesson file (the latter under the resolved docs root) — may be
included as issue references and bare paths (or absolute GitHub URLs via `nxs-abs-doc-path`);
nothing in the queue may be linked.

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

`````markdown
## Close Record

Epic closed. Durable record below — the ephemeral `close-record.md` is hand-off only.

Decision record: #<record> @ `<full record hash>`   <!-- omit when the epic has no record -->

Conformance: <analyze frontmatter value>   <!-- include this line ONLY when Phase 1.2 was not clean:
the durable surface must show the epic closed on a waiver -->

### Key Decisions
- **<decision>:** <why> (+ refuted alternative if any)
- …

### Deviation Rationale
- **<deviation>:** <why>          <!-- omit this whole heading if there were none -->

### Pointers (durable)
- Deferred scope → #<stub-issue> — <one-line goal>   <!-- one line per stub; omit if none -->
- Process lesson → <docs-root>/delivery/lessons/<date>-<slug>.md

<!-- nexus:close-record -->
```yaml
epic: "#<epic-issue>"
nexus_version: <VERSION>         # the toolkit that wrote this block (`nexus version`); omit if unresolved
date: <YYYY-MM-DD>
record: "#<record>"              # omit when the epic has no record
record_hash: <RECORD_HASH>       # full digest, never truncated; omit with `record`
analyze: <clean | the Phase 1.2 waiver text>
range:
  - repo: <the Phase 4 range repo identity>
    base: <full 40-hex $BASE>
    head: <full 40-hex $HEAD_SHA>
```
`````

The marker-anchored fenced block is **mandatory in every mode** (record #176, invariant 5): it stamps
the facts the prose cannot recover — the record reference and its full approved-body hash, the
conformance verdict, and the **full-SHA landed range**, exactly the range Phase 3 diffed, never
recomputed later. It makes the epic issue a complete substitute for the close-record file, which is
what `/nxs.distill`'s GitHub recovery reads (#174). The shape mirrors the `nexus:analyze-receipt`
block `/nxs.analyze --pr` already publishes; the prose sections above it stay unchanged and in full.

`nexus_version` is the **writer stamp** (story #306) — the release that wrote this block, from
`nexus version`. It records which toolkit produced the data, so a later change to how any of it is
canonicalised is detectable instead of silently invalidating work in flight. It is never a gate: a
missing stamp reads as an unknown writer and a differing one changes nothing about how this block
is read. It sits beside `record_hash`, never inside the record bytes that digest covers, so
stamping the block leaves the hash a later stage verifies exactly as it was. Omit the key when the
release is unresolved rather than writing a version that is not true.

**Error handling:**

- Epic issue already closed → report and continue to the completion summary.
- `gh` fails on the **close comment** → **never report success as if the rationale were safe.** For
  an issue-sourced local close this comment is the *only* durable copy (record #176, invariant 4):
  preserve the composed body at its scratch path, do **not** close the epic issue, and end the run
  with an explicit instruction —

    ```
    ACTION REQUIRED — the close comment did not post; the rationale has NO durable copy yet.
    Body preserved at <scratch>/close-comment.md. Post it, then close the issue:
        gh issue comment <epic-issue> $REPO_ARG --body-file "<scratch>/close-comment.md"
        gh issue close <epic-issue> $REPO_ARG --reason completed
    ```

- `gh` fails on the issue close (comment already posted) → report the error, preserve state, and
  print the manual close command.

# Phase 9 — Report completion

```
EPIC CLOSED: <Epic Title>

GitHub epic issue: #<epic-issue> — closed
Record amendment:  #<record> — <N> superseding decision(s) posted
                            | none (implementation conformed)
                            | NOT POSTED — <gh error>; <N> superseding decision(s) stand in the
                              close record's Deviation Rationale. Close not blocked.
Close record:      ${QDIR}/close-record.md
                   (issue-sourced local: ephemeral hand-off under .nexus/tmp/ — /nxs.distill
                    consumes it; the durable copy is the epic issue's close comment)
                   | (old-contract: committed; distiller consumes it post-merge)
Queue entry:       [member mode] migrated → <hub-root>/.nexus/queue/<entry-dir-name>/
                   (hub commit <sha> on '<hub-branch>'); removed here (commit <sha> on '<branch>')
Deferred scope:    filed as <N> backlog stub issue(s): #<n>, #<n>, …
                   whole backlog: <backlog-query>
Process lesson:    <docs-root>/delivery/lessons/<date>-<slug>.md
Scratch mined:     ${SDIR}/*/ — <N> stub(s) across <K> engineer dir(s); stays in the
                   committed entry (distiller drains it with the entry post-merge)

Key decisions captured: <count>
Deviations recorded:    <count>
```

(On the Scratch-mined line, use "none" when no per-user dir was present.)

`<backlog-query>` is the cross-feature backlog — the stubs just filed plus every stub still open
under any other epic, in one query. Ask for it rather than writing the label out
(`nexus-gh config backlog-query`), so a repository that
renamed the unplanned label gets its own query back. Omit both Deferred-scope lines when the epic
deferred nothing.

The **Record amendment** line takes exactly one of the three variants above, from Phase 8.1 —
`posted` and `NOT POSTED` both carry the count Phase 3.6 marked, and `none` means the pass ran and
found nothing that superseded the record. **Omit the line entirely when the epic has no decision
record**: 8.1 attempted nothing, and an absent record is not a missing amendment. Never report a
`none` for an epic that has no record — that would claim a conformance check that never ran.

In member mode, end the report with the durability instruction — closure is not durable until
the hub commit is pushed:

    ACTION REQUIRED — push the hub commit:
        git -C <hub-root> push

In single-repo and hub mode without `--pr`, omit the Queue entry line and the push instruction; the
close record's line already says the entry stays and is consumed post-merge.

In `--pr` mode, replace the Queue-entry line with the distill-branch state and end with the
hand-off (the artifacts live on the pushed distill branch, and distill continues in the worktree):

    Distill branch:    distill/<date>-<slug>  (pushed; close record + lesson committed)
    Worktree:          <wtPath>

    NEXT — continue the drain from the worktree:
        cd <wtPath> && /nxs.distill

    (If the push failed:  ACTION REQUIRED — git -C <wtPath> push)

# Recovery — re-stamp a closed entry whose record was revised after close

The one state that strands an entry: the epic is closed, its `close-record.md` is committed, and the
decision record is then revised (`/nxs.decision-record --revise`). The stamped `record_hash` no longer matches
the record body, so `/nxs.distill` hard-errors that entry — deliberately, with **no drain-side
waiver**, because the drain writes permanently into the knowledge store. The remedy is upstream, and
it is this procedure. Run it against the stranded entry; it is not a second close mechanism and it
does not reopen the epic issue.

1. **Finish the revision.** The record must be **approved again** — closed, `--reason completed`. A
   still-open record means the design has no approved state at all, and there is nothing legitimate
   to stamp. `/nxs.decision-record --revise` ends with this act; if it was left open for review, wait for it.

2. **Judge the blast radius.** Read the revision comment on the record issue (it carries the
   superseded body verbatim, its hash, and why it was superseded):

    - **The revision changed only the record's wording** — the shipped code still satisfies the same
      decisions and invariants. Continue to step 3; the close record's prose stands.
    - **The revision changed the design** — a decision, an invariant, or scope moved. The committed
      close record's Key Decisions and Deviation Rationale were written against the superseded body
      and are now wrong. Re-run **Phase 2 and Phase 3** against the new record body and rewrite those
      two sections of `${QDIR}/close-record.md` before continuing. Everything else in the file —
      `range`, deferred-scope stub numbers, lesson pointer — is unaffected and is **not**
      regenerated.

3. **Re-stamp.** Recompute the digest through the one digest program and write it into the entry's
   `close-record.md` frontmatter:

    ```bash
    nexus record-digest --issue <record> ${ISSUES_REPO:+--repo $ISSUES_REPO}
    ```

    Set `record_hash` to the **full** printed digest; `record` is unchanged (a revision reuses the
    issue). Commit the entry. The stamp now names the body that is actually approved, which is the
    whole point of the hash — never edit `record_hash` to silence the drain without step 1, since a
    stamp taken over an unapproved body asserts an approval that never happened.

4. **Re-run `/nxs.distill`.** The hash check passes and the entry drains normally.

If the epic issue must also be re-closed (the revision reopened it, or the epic was reopened for
other reasons), close it as usual before step 4 — `/nxs.distill` reads the entry, not the issue
state, but a closed epic with an open issue misreports the pipeline.

# Constraints

- **No search for epic files** — resolve from `$ARGUMENTS` or the open editor only.
- **No task-file mining** — the task layer is cut (0009). Never look for `TASK-*.md` or a `tasks/`
  folder; never `rm -rf` a tasks folder. Decisions come from the epic + story issue comments + the
  close review (C6).
- **Human prose only** — the close record has **no `ConceptDelta` block**; do not generate `PIR.md`.
- **Deferred scope becomes stub issues, filed only after the checkpoint** — the close record
  carries only their issue numbers (C2), and nothing reaches GitHub before consent.
- **The lesson is its own file** — the close record carries only a pointer (C3).
- **Do not proceed past the checkpoint** without an explicit `close` selection.
- **Precondition is a hard block** — never close the epic issue while **any** sub-issue is open,
  whatever its kind, and never close a sub-issue yourself. An open decision record means the design
  is unapproved; closing that sub-issue IS the approval, and it is the lead's act, not close's.
- **The analyze gate detects, it does not substitute** — on a missing/stale receipt or open
  critical/high findings, either stop (user runs `/nxs.analyze` and re-runs close) or proceed on an
  **explicit user waiver**; never run the analysis from inside close, and never proceed silently. A
  waiver is always recorded in the close record's `analyze:` frontmatter and surfaced in the close
  comment.
- **Two staleness axes, never collapsed** — the code may have moved after the analysis, the design
  may have moved after it, or both. Name and report each separately, require the same explicit
  waiver for each, and never infer one from the other; collapsing them would let a changed design
  hide behind an unchanged commit.
- **Durable surfaces carry an issue reference, never a queue path** — the close record and the epic's
  close comment both carry the record as `#<record>` plus the full approved-body hash, and each
  recorded deviation names the record issue it deviated from. A queue path on either would dangle the
  moment the distillation PR merges — the exact failure this contract exists to fix.
- **Baseline precedence is per entry** — record sub-issue, else a committed `decision-record.md`,
  else the close record alone. No flag, no mode switch, no migration: in-flight entries clear on
  their own.
- **Never link an ephemeral queue file from the issue** — the close comment inlines the close-record
  prose; the distiller deletes the queue entry post-merge, and a `.nexus/tmp/` path is machine-local.
  Link only durable targets (stub issues, lesson file, concept pages, anchors, other issues).
- **Artifact placement is contractual (#172).** Issue-sourced local close → `close-record.md` (and
  the materialized `epic.md`) live under `.nexus/tmp/epic-<n>/` as ephemeral hand-off content —
  never committed, never described as committed, no manual git step to hand off to `/nxs.distill`.
  Old-contract entry → committed `.nexus/queue/` placement unchanged. `--pr` mode → Phase 0.5 /
  Phase 7.6 unchanged. The epic issue's close comment is the single durable copy of a local close's
  rationale (record #176, invariant 4) and carries the full prose plus the marker-anchored machine
  block (invariant 5) — nothing in the comment-writing step may be skipped or thinned because the
  file is ephemeral.
- Handle an already-closed epic issue gracefully.
- **Every issue op targets the resolved issues-repo** — the epic and its story issues are filed into
  `github.issues-repo`, resolved once in Phase 1.0 **through the shared resolver** (never by parsing
  `settings.yml`). Every `gh issue`/`gh api` call addressing the epic or a story issue carries
  `$REPO_ARG`; an empty value means the current repo (today's behavior). Close previously ignored this
  configured repo — resolving and threading it is the concrete bug STORY-121.04 fixes.
- **Scratch is hints, never authority** — a decision stub in `${SDIR}/*/decisions-*.md` or an
  engineer note enters the close record only when the diff confirms it or the human ratifies it
  as deviation rationale. The diff remains ground truth (0006).
- **The scratch home is keyed on the epic issue number** — capture writes
  `.nexus/queue/epic-<epic-issue>/<username>/`, resolvable during implementation when no entry exists,
  so the born-at-close entry takes that same directory name. Close resolves `SDIR` from the epic issue
  number and the tree root, **never** from `QDIR`'s parent: the two coincide only for a born-at-close
  entry, and a locally resolved `epic.md` sits under `.nexus/tmp/`, which holds no scratch. Close never
  moves, renames, or adopts a scratch directory; for an old-contract slug-named entry it reads both
  locations and requires neither.
- **Close amends the record, it never edits it** — when the Phase 3 diff pass finds decisions that
  supersede what the approved record decided, Phase 8.1 posts exactly **one** comment on the record
  sub-issue; nothing marked means no comment (silence is the conformance signal). The comment carries
  close's own prose, never raw stub text, and never an archive of the scratch — an archive forces no
  human decision. Close never edits the record's body, title, labels, or state, and never reopens or
  revises it: the stamped digest is canonicalised over the body alone, so an amendment must leave every
  stamped receipt valid. The amendment is **advisory** — it gates nothing, and a failure to post it is
  reported, never fatal.
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
  file. The close record + lesson are committed on the distill branch and **pushed** (they
  have no feature PR to ride); the close record is later `git rm`'d by `/nxs.distill` on the same
  branch, so the epic-issue comment is its durable copy. Never fall back to the local path when
  `--pr` was passed.
- **The queue entry is born at close (invariant 15), not at planning.** Under issue-sourced planning
  (#114) nothing is committed at planning, so in `--pr` mode with no committed entry, Phase 0.5
  materializes the epic via the resolver into `.nexus/queue/epic-<epic-issue>/epic.md` — the same
  directory the capture rule wrote scratch to, so an epic whose branch captured stubs already has the
  directory and its stubs land in the entry untouched — and Phase 7.6
  commits it with the close record in one commit — so every trunk-queue entry carries a close record
  and the distiller receives a complete entry. This adds one materialization step to the existing
  #101 post-merge flow; it is **not** a second close mechanism. Single-repo / single-PR only —
  workspace and multi-PR born-at-close are out of scope (`hub-close-multi-pr`). A `decision-record.md`
  is **not** written here — its durable home is the epic's record sub-issue, which Phase 2 resolves
  as the deviation baseline; only an epic with no record at all falls back to the downgraded
  no-invariant deviation pass.

# Usage

```
/nxs.close                          # epic from the open editor file, else the branch's linked epic issue
/nxs.close path/to/epic.md          # explicit epic path
/nxs.close 118                      # issue-sourced local close: resolve epic #118 into .nexus/tmp/
/nxs.close --pr 123                 # post-merge close of PR #123; epic born at close from the PR's linked issue
/nxs.close --pr 123 path/to/epic.md # post-merge close of an old-contract epic whose entry rode the PR
```
