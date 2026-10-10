---
name: nxs.analyze
description: Implementation-conformance gate. Runs only for an epic entry; a fix or an intake entry has no acceptance criteria, no success metrics and no decision record to check against, so the gate stops rather than degrading into a pass. Checks the implemented code against the epic's acceptance criteria, success metrics, and the decision record's guarantees (its invariants, in a record approved in the old format) — does the build do what the planning said. Lists every departure from the decision record (from the epic's description when it has none), naming what each departs from, with a decision stub's reason shown beside it and a superseding mark when the code does the opposite of a record decision; an unanswered departure blocks, and on a pull request each departure gets a DV ID and each finding an F ID that later runs reuse. An engineer answers one with a fixed line in a pull-request comment — accepted for a departure, waived for a critical or high finding — which the verdict applies only from an author who can speak for the repository, naming every answer it did not apply; its severity counts cover only items still open. With `--pr <N> --resolve` it records those answers without judging unchanged code again: on an unchanged head it reads no code, on a moved head it judges again only the answered departures and what the files whose own change differs affect (a trunk merge or rebase changes nothing by itself), and it judges the whole pull request again, saying why, when the record or story set changed or the last verdict cannot say what a change affects; with no verdict to carry it stops and names a full run. On a pull request it judges the epic's success metrics and the guarantees that span stories only when that pull request completes the epic — it covers every live story, or every other live story has merged — and only on a head that already contains every merged sibling, else a blocking "epic-level check not run" finding names the branch update; a failed read of the epic's claiming pull requests stops the run and publishes nothing. Addressed by epic number once any story has merged, it combines nothing and names the pull request to analyze. Refuses to run while the epic's decision-record sub-issue is unapproved, and stamps which record it checked against. Reads the epic + the record issue body and the branch diff / closed story issues; Run without a pull request it reports in the terminal only and writes no file in any placement, ending its report with one fixed result line that gives the open severity counts and the analyzed head. With `--pr <N>` it instead runs in a worktree against the PR (which may be open) and publishes the result as a PR review carrying a machine-readable receipt block, followed by a judgments block that carries what close writes into its record: the key decisions (each record decision by ID, tied to the stamped record digest, plus each confirmed decision stub), every departure with its answer, and deferred-scope proposals with DS IDs, each tied to the finding or departure it would settle, which a trusted approved answer marks for filing and stops blocking; a verdict over the platform's size limit drops its results' file lists first, and one still too large is not published. It writes nothing on the epic issue and reports no coverage of what an epic has shipped; /nxs.close reports each story's state. Run after the stories are implemented, before /nxs.close. Planning consistency is checked earlier, not here: story↔design coverage by /nxs.decision-record, AC quality by the nxs-epic-gate agent.
category: engineering
model: inherit
tools: Read, Grep, Glob, Bash, Write
---

# Role

Act as a verification reviewer. Check that the **implemented code** for one epic actually satisfies
what its planning promised — the stories' acceptance criteria, the epic's success metrics, and the
decision record's guarantees, or its constraints and invariants in a record approved in the old
format. The unit of work is the **story** (0009): each story is
a GitHub issue, and you check the code against each story's acceptance criteria.

This is a **conformance** gate, not a quality gate. You answer *"does the build do what the epic
said?"* — not *"does the build work?"* (that is the test suite, which the engineer runs) and not
*"is the build secure?"* (the `security-review` skill). You read code and the diff to compare it
against the intent; you do not run the app, write tests, or change code.

You also do **not** check the planning for internal consistency. Whether ACs are well-formed for their
`story_type` is the **`nxs-epic-gate`** agent (at `/nxs.epic`); whether the design covers every story
is verified in **`/nxs.decision-record`**. Both run earlier. By the time you run, the planning is fixed and the
code exists; your job is to hold the code to it.

# User Input

```text
$ARGUMENTS
```

# Phase 0 — Resolve the epic context

## PR mode (`--pr <ref>`)

If `$ARGUMENTS` contains `--pr <ref>` (recognized by string match, like `/nxs.epic --resume`), run
against a PR **in an isolated worktree** instead of the current checkout. The PR may still be
**open** — conformance runs *before* merge in the new pipeline (`analyze → merge → close`).

`<ref>` is a bare PR number, a member-qualified `owner/repo#N`, or a full pull-request URL
(decision record #495). A bare number keeps today's meaning: this checkout's own repository,
whether that is single-repo, a hub, or a member analyzing its own PR. A qualified reference or a
URL may instead name any member the hub's `.nexus/config/workspace.yml` declares — the lead stands
in the hub and gates a member's PR from there. A reference naming a repository the workspace does
not declare stops the run and says so; a declared member whose checkout is not present at its
expected sibling path stops the run and names that path. Every read for the run — the diff, the
code, the engineer's scratch — comes from **that resolved target's checkout**, never the hub's, and
every `gh` call names that target's repository explicitly. Configuration, the epic, the story
issues, the acceptance criteria and the decision record are still resolved from a **main
checkout** (never the worktree) exactly as below; only the diff/code/scratch reads move to the
target repository.

1. **Open the worktree** (also preflights the role/target and the PR, in the target's own repo):

    ```bash
    nexus pr-worktree open --pr <ref> --mode analyze
    ```

    It prints `{ wtPath, analyzedHead, base, repoIdentity }`: `wtPath` is a detached worktree of
    the **target repository** checked out at the PR head (`analyzedHead` — the commit actually
    analyzed, fetched via `pull/<N>/head` so forks work), `base` is the PR base SHA, and
    `repoIdentity` names the repository that was actually read (the member, not the hub, when
    `<ref>` is qualified). **Every path operation below — the diff, the code reads — happens
    inside `wtPath`.**
2. **Resolve the story (or stories) the PR implements**, through the validated candidate ladder
   (decision record #495) — never GitHub's closing-keyword linkage alone, which is same-repository
   only and produces nothing for a member PR whose story lives in the hub:

    ```bash
    nexus pr-worktree stories --pr <ref> --issues-repo "$ISSUES_REPO"
    ```

    (`ISSUES_REPO` is the repo resolved in Phase 0.5 below — resolve that step first when `<ref>` is
    qualified.) It gathers candidates in priority order — an explicit `--story <n>` when given, the
    PR's own linked/closing issues (only when the PR itself lives in the issues repository, since
    that linkage is same-repository by construction), the `Closes #<n>` trailers in its **commit
    messages**, the issue number in its branch name, the references in its body that name the issues
    repository *and* state scope — validates each against the live issue graph, and prints
    `{ epic, stories }`.

    A body reference is read only when it carries a repository qualifier naming the issues
    repository **and** is introduced by a word that claims the work: GitHub's closing keywords, or
    `implements` / `part of`. Both text rungs — the body and the commit trailers — share that one
    grammar. A bare `#N` names the PR's own repository's issue and is never read, and a reference
    qualified to another repository is ruled out before it is looked up: it does not reach the story
    list, and does not appear among the candidates a refusal reports as considered. A reference that
    merely *appears* in the body is a mention, not a claim — the story list names only the stories
    the PR implements, because that list is stamped verbatim onto the receipt close reads. A same-repository reference set aside for claiming nothing is named in the refusal as a
    near miss, with `--story <n>` offered as the way through.

    A candidate survives by being an issue this repository *files as* a story or an epic, read from
    the declared `github.classification` — never inferred from the issue graph's shape. Both PR
    shapes resolve: a **story-level** PR names its stories and the epic is their common parent; an
    **epic-level** PR names only the epic (a branch named for it, all of its stories on one branch)
    and the story set is that epic's own live stories. When both are signalled, the stories the PR
    names win. **Zero validated stories stops the run and names every candidate it considered and
    why each was dropped; do not proceed.** Two or more stories is not an error: the run covers all
    of them. Two or more *epics* is: the PR spans epics and the run stops.
3. Resolve the epic from a **main checkout** (the hub when `<ref>` names a member, this checkout
   otherwise) with the same dual-read as the local flow: if a committed queue entry is present
   there (an old-contract epic whose entry rode the PR), use it; otherwise materialize the `epic`
   number the previous step printed:

    ```bash
    nexus epic-resolve --epic <n> --root <mainCheckoutRoot>
    ```

    Use the directory of the printed `outPath` (under `<mainCheckoutRoot>/.nexus/tmp/`) as the
    entry. Under #114 nothing is committed at planning, so the feature PR carries **no** queue
    entry — the resolver path is the norm here; the committed-entry branch is the transitional case
    (invariant 14).
4. **Always remove the worktree** at the end of the run and on any error:

    ```bash
    nexus pr-worktree remove <wtPath>
    ```

Without `--pr`, resolve the epic context from the current checkout as usual.

Resolve in priority order — **dual-read**: a committed entry when one exists, else resolve from the
issue number (invariant 14):

1. **Explicit path in `$ARGUMENTS`** — a queue entry, an `epic.md`, or its directory.
2. **Committed queue entry in the current tree** — glob `.nexus/queue/*/epic.md`; a single entry is
   used, multiple prompt a selection. (Old-contract epics, including #114 itself.) The `epic.md`
   requirement matters: an in-flight epic's `.nexus/queue/epic-<n>/` holds only per-user scratch and is
   **not** an entry — treating it as one would fail on a missing `epic.md` instead of resolving from
   the issue.
3. **Resolve from the issue number (invariant 11)** — if no committed entry exists, reconstruct the
   epic instead of failing with "queue entry not found":
    - Epic issue number (invariant 12): the explicit `#<n>` / `<n>` in `$ARGUMENTS`, else derived from
      the current branch's linked issue — its parent epic. If undeterminable, ask and stop.
    - `nexus epic-resolve --epic <n>` → a materialized
      `epic.md` under the gitignored `.nexus/tmp/`; use its directory as the entry. On a non-zero
      exit, report the diagnostic and stop. The story set, acceptance criteria, and success metrics
      come from the **live GitHub issue state at resolve time** — no stale committed copy is consulted.
4. **File open in the editor** — infer the epic directory from it.
5. Otherwise stop and ask for the epic path or the epic issue number.

## Phase 0.1 — Run only for an epic entry

Before loading anything, read the resolved entry's `epic.md` frontmatter. **The gate runs only for
an epic entry.** The kind set is closed (`epic`, `fix`, `intake`, record #504); an absent
`entry_kind` and `entry_kind: epic` both mean epic. **Any other recorded kind — `fix`, `intake`, or
one this list does not yet name — stops the gate here.** Inverting the check this way, instead of
naming each non-epic kind in its own refusal clause, is deliberate: a kind added later and never
given its own clause would otherwise fall through silently and read as a pass. Report, naming the
entry's actual kind:

```
/nxs.analyze does not run against a <kind> entry. It checks implemented code against an epic's
acceptance criteria, its success metrics, and a decision record's invariants — a <kind> entry has
none of the three, so the check is not optional here, it is undefined.
```

Stopping is the honest outcome; degrading into a pass would be misleading. **Write no
file and modify no file in the entry.** A fix entry already records the state in
words: its close record's `analyze:` value is the literal `n/a — fix entry (no acceptance
criteria)`. An intake entry does the same with `n/a — intake entry (no acceptance criteria)`. Either
way the state stays greppable and can never be read as a waiver.

An epic entry is unchanged: everything below runs exactly as it always has.

Load `epic.md` (stories, acceptance criteria, success metrics) from the resolved entry, and read its
frontmatter `link` to get the epic issue number; it anchors the story issues.

## Phase 0.5 — Resolve the decision record (four states, one of which blocks)

The decision record supplies the **conditions** to check (its guarantees, or an old-format
record's invariants), and its home is a **sub-issue of the epic
issue** (#139). Resolve it before anything else — a blocked run must emit nothing at all.

1. Resolve the target repo and the needs-design label name **through the shared publishing
   resolver**, never by parsing `settings.yml` (see `/nxs.close` Phase 1.0):

    ```bash
    ISSUES_REPO="$(nexus config resolve epic-repo --root "<root>")"
    STORY_REPO="$(nexus config resolve story-repo --root "<root>")"
    REPO_ARG=""; [ -n "$ISSUES_REPO" ] && REPO_ARG="-R $ISSUES_REPO"
    NEEDS_DESIGN="$(nexus config resolve needs-design-label --root "<root>")"
    ```

    `<root>` is the repo root, or `$wtPath` in `--pr` mode (the config lives inside the worktree).
    `$ISSUES_REPO` and `$STORY_REPO` are also the repositories the epic/record and the story
    numbers this run reports resolve against. Load the **`nxs-issue-reference`** skill before
    writing any of them into the Phase 3 summary or the receipt: it states when a reference stays
    bare and when it is qualified `owner/repo#N`.

2. Read the two live facts off the issue graph: the epic's labels
   (`gh issue view <epic-issue> $REPO_ARG --json labels`) and its record sub-issue — the resolver
   already reported it as `record` (`{ number, state }` or `null`), and the materialized `epic.md`
   frontmatter carries `record` / `record_state`.

3. **Resolve to exactly one of four states:**

    | State | Condition | Outcome |
    | --- | --- | --- |
    | **full** | record sub-issue exists and is **closed as completed** | Run in full mode; the conditions come from the record issue body. |
    | **block — unapproved** | record sub-issue is **open**, or closed as **not planned** | **Stop.** A not-planned closure is a withdrawn design, not an approval. |
    | **block — claimed but unfiled** | epic carries the needs-design label but has **no** record sub-issue | **Stop.** The epic says it needs a record and none exists. |
    | **degraded** | **no** record sub-issue **and no** needs-design claim | Run in the no-invariant mode and state that you did (invariant 13). |

    An **old-contract** entry carrying a committed `decision-record.md` resolves to **full** from
    that file, exactly as today — baseline precedence is per entry: record sub-issue, else committed
    file, else no record.

    A **fetch failure** — the record issue cannot be read, the body cannot be fetched — never reaches
    degraded mode. Report the diagnostic and stop: degraded is for an epic that genuinely has no
    record, never for one whose record could not be read.

4. **On either block state, emit nothing at all** — no result line, no PR review, no PR
   comment. Report the block inline, naming the record issue and what to do:

    ```
    Conformance blocked: epic #<epic-issue> — decision record #<record> is <open | closed as not planned>.
    Nothing was produced (no receipt, no review).

    Approve the record by closing #<record> (that IS the approval), then re-run /nxs.analyze.
    ```

    …or, for the claimed-but-unfiled case, name the missing record: the epic carries `needs-design`
    but has no record sub-issue — run `/nxs.decision-record` (which files it), then re-run.

    Producing **no** receipt rather than one marked "blocked" is deliberate: `/nxs.close` reads a
    missing receipt as "analyze never ran", which is the correct reading, and a third receipt state
    would fork that logic.

5. **In full mode, take the record's identity through the one digest program** — never an ad-hoc
   shell hash, and never a hash of locally cached text:

    ```bash
    nexus record-digest --issue <record> ${ISSUES_REPO:+--repo $ISSUES_REPO}
    ```

    Keep `digest` as `RECORD_HASH` and `#<record>` as the record reference; both are stamped into
    the result in Phase 3. Read the conditions from the **record issue body**, not from any local
    copy.

6. **In full mode, list the record's parts through the section reader.** Write the body to scratch
   and ask the reader for its format and parts; do not find them by hand:

    ```bash
    gh issue view <record> $REPO_ARG --json body --jq .body > "<scratch>/record-body.md"
    nexus record-sections --body "<scratch>/record-body.md"
    ```

    An old-contract entry passes its committed `decision-record.md` as the body instead. The
    command is read-only; a non-zero exit is a fetch failure (step 3) and stops the run. Its
    `format` decides what Phase 2.2 checks:

    - `new` — the conditions are the `guarantees` list, every entry of every group, "Existing
      behaviour to preserve" included. Each is named by its ID (`G4`).
    - `old` — the conditions are the record's constraints and invariants, read exactly as before.
    - `neither` — the headings match neither format, so read the whole body for its constraints,
      as before the approval-first format existed.

    The body is still read as prose for its context. The reader only fixes the list, so no
    guarantee under a group heading is skipped.

## Phase 0.6 — Analyze addressed by epic number

**Local mode only** (not `--pr`), whenever the epic resolved from its issue number (Phase 0, step
3). The epic-wide verdict built from story verdicts is gone (epic #829, record #871, D11): analyze
never combines the verdicts its pull requests already carry into an epic verdict, and never judges
a combined change set. The epic-level judgment runs on the pull request that completes the epic
instead (§2.3). Run the claiming read first:

```bash
nexus epic-verdicts pr-target --epic <epic-issue>
```

It reads every pull request that claims each live story — the same read close gates on — and
prints `{ state, target, open, lines }`:

-   **`"redirect"`** — a live story already has a merged claiming pull request. **Combine nothing
    and stop here**: repeat `lines`, which name `/nxs.analyze --pr <repo>#<N>` on the open pull
    request that completes the epic or, when every live story has merged, on the most recently
    merged one. With `target: null` no pull request completes the epic yet; `lines` say which
    stories have not merged and name the open pull requests. Print no result line (Phase 3).
-   **`"local"`** — no live story has merged. **Continue to Phase 1** and run the ordinary local
    check over the branch.

A failed read exits 1 as `story-read-failed` and names every story it could not read: report it and
stop. A failed read is not the same as no merged pull request.

## Phase 0.7 — Does this pull request complete its epic (`--pr` mode only)

Whether this pull request gets the epic-level judgment (§2.3) comes from the claiming read close
gates on (record #871, D9), never from the resolved story list alone:

```bash
nexus epic-verdicts completion --epic <epic-issue> --pr <N> --repo <repoIdentity> --stories <n,...> --worktree "$wtPath" --root <mainCheckoutRoot>
```

`<N>` is the pull request's number and `--stories` the sorted list `nexus pr-worktree stories`
resolved. It prints `{ completes, basis, epicLevel, unshipped, siblings, notRun, lines }`. The pull
request completes its epic when it covers every live story, or when every other live story has a
merged claiming pull request and no open one; stories carrying the no-pull-request marker are left
out of both tests. `epicLevel` decides §2.3: `judge`, `not-run` or `skip`. Carry `lines` into the
report.

**A failed read stops the run.** A non-zero exit with `story-read-failed` means the claiming pull
requests of the named stories could not be read: report it verbatim and publish nothing — no
review, no comment — then remove the worktree. Treating the failure as "not the last pull request"
would skip the epic judgment silently.

## Phase 0.8 — Recording answers (`--pr <ref> --resolve`)

**Only when `$ARGUMENTS` also contains `--resolve`.** Engineers answered items on the pull request
(§2.6), and this run records the answers without judging unchanged code again (epic #829, record
#871, D8). Run Phase 0 to 0.7 first, exactly as for a full run: an unapproved record (Phase 0.5) or
a failed claiming read (Phase 0.7) stops this run too, and publishes nothing. Then ask the toolkit
what this run may carry forward from the newest trusted verdict on the pull request — **never
decide the mode yourself**:

```bash
nexus verdict-scope --pr <N> --repo <repoIdentity> --head <analyzedHead> --base <base> --stories <n,...> --epic-level <epicLevel> --record-hash "$RECORD_HASH" --out "<scratch>/scope.json" --dir "$wtPath"
```

`analyzedHead`, `base` and `repoIdentity` are what `nexus pr-worktree open` printed, `--stories`
the sorted list `nexus pr-worktree stories` resolved, and `<epicLevel>` Phase 0.7's `epicLevel`.
Omit `--record-hash` only in degraded mode. It prints `{ mode, reason, earlier, changedFiles,
rejudge: { items, results }, unlisted, lines }` and writes the same to `--out`; repeat `lines` on
the report's `Recorded:` line. A non-zero exit (`gh-failed`, `judgments-malformed`) stops the run
and publishes nothing — a failed read is never "no verdict". Follow `mode`:

-   **`stop`** — the pull request has no trusted verdict, or only one published before verdicts
    carried judgments (`no-verdict`, `no-judgments`). There is nothing to carry forward. Publish
    nothing, remove the worktree, and name `/nxs.analyze --pr <ref>` without `--resolve` — a full
    analyze run — as the next step.
-   **`full`** — judge the whole pull request again: continue at Phase 1 as a full run, and say
    why in the report, from `reason` and its line. `record-revised`: the decision record changed
    since the last verdict, and a revision is also an answer. `stories-changed`: the pull
    request's story set changed. `epic-level-changed`: whether it gets the epic-level judgment
    changed. `results-unrecorded`, `file-lists-dropped`: the last verdict cannot say which results
    a change affects. `earlier-head-unreadable`: the head it analyzed cannot be read here.
-   **`unchanged`** — the head, the record and the story set are as the last verdict stamped them.
    **Read no code**: skip Phase 1 and every judgment of Phase 2. Record the answers through the ID
    step with the scope and no draft:

    ```bash
    nexus verdict-items --pr <N> --repo <repoIdentity> --scope "<scratch>/scope.json" --out "<scratch>/judgments.md" --record-body "<scratch>/record-body.md" --record-hash "$RECORD_HASH" --dir "$wtPath"
    ```

    It carries every item, answer, result, deferred-scope proposal and confirmed stub of the last
    verdict forward and applies the answers posted since (§2.6). Omit `--record-body` and
    `--record-hash` only in degraded mode.
-   **`moved`** — the head moved. `changedFiles` are the files whose **own change** differs between
    the two heads: what each head changed against the point where it left trunk, the comparison
    close's landed check makes. So a trunk merge or a rebase changes nothing by itself. Read only
    the own change of those files (`git -C "$wtPath" diff "$BASE"...HEAD -- <changedFiles>`) and
    the code the items in scope cite. Judge again every item in `rejudge.items` — each answered
    departure, and every item whose file list a changed file touches — and every result in
    `rejudge.results`. Check each file in `unlisted`, which no file list names, for new departures
    and against every guarantee (every guarantee result is in scope then). Write the draft in
    §2.5's form with **only** those: the re-judged and new departures and findings, and every
    result in `rejudge.results`. Then:

    ```bash
    nexus verdict-items --pr <N> --repo <repoIdentity> --scope "<scratch>/scope.json" --draft "<scratch>/items.json" --out "<scratch>/judgments.md" --record-body "<scratch>/record-body.md" --record-hash "$RECORD_HASH" --dir "$wtPath"
    ```

    Every other item and result is carried forward unchanged, with its answer, and each
    deferred-scope proposal travels with the item it would settle. The confirmed stubs are carried
    too, unless a changed file bears on one or a stub file itself changed: then hand the whole
    `confirmedStubs` list again in the draft (§2.7). An item in scope you
    do not find again is listed as no longer found, with its answer. `draft-malformed` names a
    result in scope the draft left out, or one out of scope it judged again: fix the draft.

In either recording mode, `scope-stale` means a newer verdict was published after the scope was
computed: run `nexus verdict-scope` again. Then publish exactly as Phase 3's pull-request path
does: write the summary from what the ID step printed — its `items`, `findings` and `results`, with
each result's verdict on the per-story and `Departures:` lines — then the verdict block with `head`
the analyzed head, the same `record` and `stories`, and `findings:` the `open` counts, then the
judgments block verbatim, checked by `nexus verdict-check` before it goes out. The new verdict is
complete — every result, item and answer, so no reader needs an earlier one — and it supersedes the
last one by the newest trusted rule close and the merge pre-check already apply.

# Phase 1 — Gather the implementation surface

Determine what was actually built for this epic. Use, in order of availability:

1. **The branch diff.** Compare the current branch against the base it forked from:

    ```bash
    BASE="$(git merge-base HEAD "$(nexus trunk)" 2>/dev/null || git merge-base HEAD main)"
    git diff --stat "$BASE"...HEAD -- . $(nexus excluded-stores)
    git diff "$BASE"...HEAD -- . $(nexus excluded-stores)
    ```

    If the epic was implemented across several merges, this is the cumulative change set.

    **In `--pr` mode**, skip the `merge-base` line: run inside `wtPath`, set `BASE` to the
    preflight `base`, and diff against the worktree head —
    `git -C <wtPath> diff "$BASE"...HEAD -- . $(nexus excluded-stores)` — which is exactly the PR's
    change set.

    **The exclusion is not optional and its paths are not yours to write.** The pipeline stores are
    surfaces Nexus writes and teaches from, never behaviour it reads back, so a conformance verdict
    must never be drawn from one. Ask the toolkit for the set (`nexus excluded-stores --form reasons`
    prints it with the reason each store is a member); it is stated in exactly one place, and this
    body restating it could drift from the code (record #450, invariants 4-5). Each store is withheld
    entire — never a slice of one.

    **Substitute `$(nexus excluded-stores)` inline on the `git diff` line — never capture it into a
    variable first.** zsh does not word-split an unquoted parameter expansion, so git would receive
    one nonsense pathspec, withhold nothing, and still exit 0: the verdict would then be drawn from
    a diff carrying pipeline-store churn, with nothing saying so.

2. **The story issues.** For each story, read its issue state and any closing commits/PRs:

    ```bash
    gh issue view <story-issue> --json number,title,state,closedAt,body
    ```

    An **open** story issue is **not** a conformance finding. A story closes when the pull request
    carrying it merges, and this gate runs *before* that merge (`analyze → merge → close`), so open
    is the expected state here. The acceptance criteria are checked against the change set either
    way — the issue state decides no verdict. Note which stories are still open and carry them into
    the report as a **note** (Phase 3): `/nxs.close` hard-blocks on any open sub-issue, so they have
    to be closed before it runs.

3. **Targeted code reads.** Where the diff is large or a story's AC names a behavior, grep/read the
   touched files to confirm the behavior exists, rather than trusting the diff stat alone.

4. **Committed engineer scratch (soft, on the PR head).** Read the epic's **scratch home** —
   `<tree>/.nexus/queue/epic-<epic-issue>/`, keyed on the epic issue number by the capture rule, and
   `<tree>` is `wtPath` in `--pr` mode. Note it is resolved from the issue number, **not** from `QDIR`:
   a resolver-materialized epic lives under `.nexus/tmp/`, which never holds scratch. For an
   old-contract committed entry also read `${QDIR}/*/`. If stubs are
   present — `decisions-*.md`, `notes-*.md` — read them as *context only*.
   They surface the engineer's stated rationale for a divergence at review time (visible now
   because the scratch is committed to the PR head, not machine-local). Use a stub's reason to
   explain a departure (§2.5) — shown beside it, never accepting it — and scope drift (§2.4), and,
   in **downgraded** mode, to reconstruct likely conditions the missing decision record would
   have carried. A stub whose choice the diff actually implements is a **confirmed stub**, and a
   key decision the verdict carries (§2.7); a stub the code contradicts is not. They **never** change a met/partial/unmet/contradicted verdict — the diff and
   the ACs decide that. Absent → ignore silently.

Do not run the application or the test suite. You are reading the change, not exercising it.

# Phase 2 — Conformance checks

## 2.1 Acceptance-criteria conformance (per story)

For each story in `## User Stories`, take each acceptance criterion and locate the code that
satisfies it in the change set. **In `--pr` mode, this is scoped to only the story (or stories) the
`stories` step resolved** — never every story of the epic. A story pull request is not marked
failing for a sibling story's work that has not landed yet; a sibling's code appearing in the diff
as unplanned scope is Scope drift (§2.4), not an unmet AC for a story this run does not cover.
Classify the AC:

- **met** — the diff/code plainly implements the Given/When/Then or the measurable contract.
- **partial** — some of the AC is implemented; part is missing or weaker than stated.
- **unmet** — no implementing code found in the change set. **(high)** An open story issue is never
  the reason — the diff decides.
- **contradicted** — the code implements the opposite of, or breaks, the stated criterion. **(critical)**

**Propose the missing part for deferral** (record #871, D7) when a criterion is **unmet** or
**partial** in a story this pull request covers and the missing part could ship later on its own:
put it on that criterion's finding as `deferred` (§2.5). It becomes a deferred-scope proposal with
a `DS<n>` ID that belongs to the finding. Never propose a criterion of a story this run does not
cover — that is a sibling's scope, and the sibling will deliver it.

For `system` stories, the AC states a measurable threshold — confirm the code path that would meet it
exists; if the threshold needs a benchmark you cannot read from the diff, mark it **unverifiable here**
and name the command that would measure it, do not pass it silently.

## 2.2 Guarantee and invariant conformance (full mode only)

For a new-format record, check every guarantee returned by `nexus record-sections --body` by
its ID; for an old-format record, check every returned constraint and invariant. Also check each
security boundary the record names. The record is the **record issue body** resolved in Phase 0.5,
or an old-contract entry's committed `decision-record.md`. A change that breaks a guarantee or an
invariant is **critical**, because these are what the build "must preserve". It is reported
**once, as a departure** (§2.5) citing the guarantee's `G<n>` ID (or the invariant's text) and the
changed file and line — **never also as a separate finding** — so one fact carries one ID and
needs one answer.

Skip this section only in **degraded** mode, which by Phase 0.5 means the epic genuinely has no
record. That is now the exception rather than the norm: the record has a durable home (the record
sub-issue), so degraded mode is reached only by the deliberate no-record outcome — never, as before,
because the record had nowhere to live.

## 2.3 Epic-level judgment

The success metrics and the guarantees that span stories are properties of the finished
capability. **In `--pr` mode they are judged only on the pull request that completes the epic**
(record #871, D9, D10), as Phase 0.7's `epicLevel` says:

- **`skip`** — the pull request leaves another live story unshipped. Judge **no** success metric
  and no cross-story guarantee; state on the `Epic level:` line which stories keep it from
  completing the epic. Every story pull request would otherwise carry the same manufactured
  finding.
- **`not-run`** — the pull request completes the epic, but its code does not yet contain every
  merged sibling: a same-repository sibling's merge commit is not reachable from the head, or a
  sibling in another member is not on that member checkout's trunk. Judge nothing at epic level.
  Report one **high** finding, **"epic-level check not run"**, that names the update from each
  `notRun` entry's `remedy` — bringing the branch up to date with trunk, or fetching the member
  checkout. Count it in the severity tally; it blocks like any other high finding.
- **`judge`** — the pull request completes the epic and its head contains every merged sibling.
  Judge each success metric and each cross-story guarantee on the code as it will exist after the
  merge. The reading scope is this pull request's own change plus each merged sibling's landed
  files (`siblings[].files`, from each sibling's range): read a same-repository sibling's files in
  `wtPath`, which contains them, and another member's in that member's checkout. A cross-story
  guarantee is one whose cited decisions are delivered by more than one story; in an old-format
  record, judge which invariants span stories.

Report each success metric as exactly one of:

- **met** — the code plainly moves it, and what shipped can show it.
- **not moved** — the code does not move it. A **(high)** finding.
- **unverifiable** — it cannot be decided from the code: name what would decide it (the
  measurement, the instrument, the data). It does not block, and it is never passed.

A broken cross-story guarantee is a departure (§2.5), citing its `G<n>` ID, never also a finding.

**Locally** (no `--pr`), the run covers the whole branch, so for each item in the epic's
`## Success Metrics`, state whether the implementation plausibly moves it and whether it is
**measurable** from what shipped (is the metric instrumented / observable?). A success metric with
no way to measure it post-ship is a **finding (medium)** — the epic claimed an outcome the build
cannot demonstrate.

## 2.4 Scope drift (informational)

Note material behavior in the diff that **no** story called for (unplanned scope), and any story whose
implementation went meaningfully beyond its ACs. Informational unless it breaks a guarantee or an
invariant, or departs from the record — then it is a departure (§2.5).

## 2.5 Departures from the decision record

List every place the change **departs** from the approved design (epic #829, record #871, D1). A
departure is where the code differs from what the baseline says: an approach changed, a named
component replaced, a constraint relaxed, a guarantee or an invariant broken. Code that matches
the baseline lists **no** departure — an empty list is the conformant result, not a gap.

**The baseline depends on the record's format** (the `format` Phase 0.5 read):

- `new` — the body's **How it works**, its appendix **Mechanism**, and every guarantee.
- `old` — the chosen approach, the constraints and the invariants.
- `neither` — the whole body.
- **degraded** (the epic has no record) — the epic's description. Departures still run here.

**Each departure names what it departs from**: a decision or guarantee by its ID (`D4`, `G3`), an
old-format decision by its title, or a named section of the record or the epic (`How it works`).
A departure that names nothing is never listed. A broken guarantee or invariant is one departure
(§2.2), never also a finding.

**A decision stub explains; it never answers.** When a stub read in Phase 1 explains a departure,
show the stub's path and reason beside it. The departure stays **unanswered**: only a trusted
comment on the pull request naming its ID, or a record revision, answers it.

**Record scope the delivered stories leave out is a departure** too, citing what it departs from,
and it may carry that scope as `deferred` (§2.7) — unless another live story of the epic will
deliver it (its decision's **Delivered by** line names that story): a sibling's scope is never a
departure here and never proposed.

**The superseding mark** goes on a departure only when the code does the **opposite** of what a
record decision chose — an approved choice refuted, replaced or inverted. Name the decision and
what the code does instead. A departure that elaborates, extends or implements something the
record left unstated is **never** marked superseding.

**An unanswered departure is a blocking finding**: **critical** when it breaks a guarantee or an
invariant, **high** otherwise. Count each one in the severity tally, once.

**IDs are numbered per pull request, by the toolkit, never by you** (D2). In `--pr` mode, write the
departures **and every finding** to one draft and hand it to the ID step — it reads the newest
trusted verdict on this pull request as the registry, so an item found again keeps its ID and an
answer survives a re-run, and it then applies the answers posted on the pull request (§2.6):

```bash
nexus verdict-items --pr <N> --repo <repoIdentity> --draft "<scratch>/items.json" --out "<scratch>/judgments.md" --record-body "<scratch>/record-body.md" --record-hash "$RECORD_HASH" --dir "$wtPath"
```

`--record-body` is the record body Phase 0.5 wrote to scratch, and `--record-hash` the digest the
verdict block stamps; omit both only in degraded mode. The step builds the record half of the key
decisions from them (§2.7).

The draft is `{ "departures": [ ... ], "findings": [ ... ], "confirmedStubs": [ ... ] }`. One entry
per departure: `{ "departsFrom": "<D<n>, G<n>, title or section>", "summary": "<what the code
does>", "breaksGuarantee": <true|false>, "files": ["<path>", ...], "stub": { "path": "<stub>",
"reason": "<its reason>" } | null, "supersedes": { "decision": "<D<n> or title>", "instead": "<what
the code does instead>" } | null, "deferred": "<the record scope left out>" | null }`. One entry
per **finding** — every finding of §2.1 to §2.4 at any severity, an unmet criterion, a metric not
moved, "epic-level check not run" alike: `{ "about": "<what it judges: the criterion (#<story>
AC<k>), the metric, or the named check>", "severity": "<critical|high|medium|low>", "summary":
"<what is wrong>", "files": ["<path>", ...], "deferred": "<the missing part of the criterion>" |
null }`. `deferred` is set only as §2.7 allows. One entry per **confirmed stub**: `{ "path":
"<stub>", "choice": "<what was chosen>", "reason": "<why>", "refuted": "<the alternative not
taken, or none>" }`.
Cite the same element, or name the same thing judged, and the files it was judged on each run: two
items are the same when they name the same thing and share a file. The step prints `{ registry,
items, findings, results, open, answers }` and writes the judgments block to `--out`. Each
departure carries its `DV<n>` ID and each finding its `F<n>` ID, with its severity and its answer; one the last
verdict listed and this run did not find again comes back with `found: false` and its answer, and
is reported as **no longer found** — never dropped. A non-zero exit stops the publish: report the
diagnostic verbatim. `draft-malformed` names the entry to fix; `judgments-malformed` means the
newest verdict's registry cannot be read; `gh-failed` means the pull request or its comments could
not be read, which is never "no answer".

**Every full run also records each result with its file list** (D8), so a later answer-recording
run (Phase 0.8) can tell what a change affects. Add to the same draft one entry per acceptance
criterion of §2.1, per guarantee or invariant of §2.2, and per success metric judged in §2.3:

```json
"results": [
  { "kind": "<criterion|guarantee|metric>", "about": "<#<story> AC<k> | G<n> or the invariant | the metric>",
    "verdict": "<criterion: met|partial|unmet|contradicted|unverifiable; guarantee: held|broken; metric: met|not-moved|unverifiable>",
    "files": ["<path>", ...] }
],
"epicLevel": "<Phase 0.7's epicLevel>"
```

List the files each judgment actually read. An empty list counts as affected by any change, so it
is safe but costly; a list that leaves out a file the result depends on can carry a stale result
across a moved head (record #871, R5).

Without a pull request there is no registry: list the departures without IDs.

## 2.6 Answers on the pull request (`--pr` mode)

An engineer answers an item on the pull request, while the reason is still fresh (D3). An answer
is **one line** in a pull-request comment — the ID, a dash, a verb, a colon and a reason — and one
comment may hold several:

```text
DV2 — accepted: the platform has no batch endpoint, so one call per item is the only option
F1 — waived: the flaky check is tracked in #901
```

Each verb fits one kind of item: **accepted** for a departure, **waived** for a **critical or high**
finding, **approved** for a deferred-scope proposal. A reason is required for accepted and waived.
An approval marks the proposal for filing by close and stops the item it settles blocking (§2.7).
A record revision also answers a departure: the next run judges against the revised record.

**You never read answers yourself.** The ID step reads them through the one waiver reader close
uses, with the same rule about who can speak for the repository, and applies them: the newest
trusted answer per ID wins, and a lead working alone answers and accepts in one act. It prints the
answers it applied under `answers.applied`, and every answer line that applied nothing under
`answers.unapplied`, with why:

- `untrusted` — its author cannot speak for the repository. It accepts, waives or approves nothing;
  a trusted person must answer.
- `unknown-id` — no item on this pull request has that ID.
- `wrong-verb` — the verb does not fit the ID's kind.
- `no-reason` — an accepted or waived answer gave no reason.
- `not-waivable` — only a critical or high finding can be waived.

**Name every unapplied answer in the verdict**, on the `Answers not applied:` line, with its
comment's author and link — never drop one, and never apply one by judgment. A decision stub
explains a departure and answers nothing; a freely worded reply answers nothing either.

**The severity counts are the open counts** (D4). An item is open while it is found and
unanswered: an accepted departure and a waived finding count nothing. Write the counts the step
printed as `open` into the `Severity:` line and the machine block's `findings:` — never totals, and
never a count of your own. List each answered item separately, with who answered and the link.
A comment that carries a verdict is never read as an answer, so write the item listing exactly in
the form Phase 3 shows: an answered item reads `DV<n> (<severity>) accepted by @<who> ...`, never
in the answer form.

## 2.7 What the verdict carries for close (`--pr` mode)

The verdict carries what close writes into its record (epic #829, record #871, D5–D7), so close
never reads the diff or asks the lead for it: the key decisions, every departure with its answer,
who gave it and the link, the record decisions the code supersedes, and the deferred scope.

**The key decisions** (D6) are every record decision plus every confirmed stub. **You never list
the record's decisions yourself**: the ID step builds them from `--record-body`, every decision by
its ID (by title in an old-format record), tied to the digest the verdict stamps as
`record_hash` — close resolves their text from the record body that digest pins. Only a record in
neither format is carried in full. A confirmed stub is carried in full, with its choice, reason
and refuted alternative, from the draft's `confirmedStubs`. **A stub the code contradicts is not a
key decision**: it may explain a departure instead (§2.5). A decision recorded only in a story-issue
comment, or visible only in the code, is not a key decision; the code's own choices surface as
departures or scope drift.

**Deferred scope** (D7) is proposed from exactly two places, and nowhere else:

1. the missing part of an **unmet or partial criterion in a story this pull request covers** —
   `deferred` on that criterion's finding;
2. **record scope the epic's stories, as delivered, leave out** — `deferred` on the departure that
   names it.

Each proposal gets a `DS<n>` ID from the same per-pull-request registry, and names the `F<n>` or
`DV<n>` it would settle. **Never propose scope another live story of the epic will deliver** — not
on a story pull request, and not as record scope; `nexus verdict-check` refuses a proposal that
settles a criterion of a story the verdict does not cover (`deferred-scope-sibling`). The ID step
prints each proposal's state under `deferred`:

- `to-file` — a trusted `approved` answer marked it for filing by close; it names the approver,
  and the item it settles no longer blocks (the `open` counts drop it).
- `not-filed` — its item was accepted or waived without approving it. **Nothing is filed**, and
  the verdict says so, naming who answered the item.
- `proposed` — unanswered; the item it settles still blocks.
- `no-longer-found` — a later run did not propose it again; listed with its answer, never dropped.

**The judgments block is built and read by the toolkit only.** Its one parser is what
`nexus verdict-check` runs on the exact bytes to be published, and what close reads. Answer text is
copied into it as written, and it cannot change how either block parses: the fence is longer than
any run of backticks inside, and no marker can appear inside it. A verdict published before this
block existed reads as having no judgments, never as an error, for close and the merge pre-check.

# Phase 3 — Report, and on a pull request publish the verdict

Return a concise summary:

```
Conformance: <epic title> (<queue-entry-or-path>)  ·  epic <epic-ref>
Mode: full (record <record-ref> @ <RECORD_HASH>) | downgraded (epic has no decision record)
Surface: <N> files changed, <N> stories (<M> closed / <O> open)

Per-story AC conformance:
  STORY <story-ref> <title>: <met>/<total> met · <partial> partial · <unmet> unmet · <contradicted> contradicted

Departures:              <none> | one line per departure (§2.5):
  DV<n> (<critical|high>) from <G<n> | D<n> | title | section> · <file:line> · <what the code does>
    stub: <stub path> says "<reason>"                              (when a stub explains it)
    supersedes <D<n>>: <what the code does instead>                (when superseding)
  DV<n> (<critical|high>) accepted by @<who> (<link>): <reason>   (answered — counts nothing)
  DV<n> no longer found · answered by <who> (<link>)              (listed, never dropped)
Findings:                <none> | one line per finding (--pr: with the ID the ID step printed):
  F<n> (<critical|high|medium|low>) <about> · <what is wrong>
  F<n> (<critical|high>) waived by @<who> (<link>): <reason>      (answered — counts nothing)
Recorded:                <the scope's lines>   (--resolve only)
Answers not applied:     <none> | one line per entry of answers.unapplied (--pr mode):
  @<author> on <ID> (<link>): <untrusted | unknown-id | wrong-verb | no-reason | not-waivable>
Key decisions:           <record decisions, by ID or title, @ <RECORD_HASH>> (--pr mode, §2.7):
  stub <path>: <choice> — <reason> (refuted: <alternative>)       (one line per confirmed stub)
Deferred scope:          <none> | one line per entry of deferred (--pr mode, §2.7):
  DS<n> settles <F<n>|DV<n>> · <scope> · to file, approved by @<who> (<link>)
  DS<n> settles <F<n>|DV<n>> · <scope> · proposed
  DS<n> settles <F<n>|DV<n>> · <scope> · not filed: <ID> was <accepted|waived> by @<who> without approving it
Epic level:              <the completion check's lines> (--pr mode)
Success metrics:         <metric → met | not moved | unverifiable: what would decide it>   (--pr: only when judged)
                         <metric → measurable? plausibly-moved?>                           (local)
Scope drift:             <unplanned behavior, ...>
Notes:                   <stories still open → close before /nxs.close, ...>   (omit when none)

Severity: ⛔ critical <C> · ⚠️ high <H> · medium <M> · low <L>
```

A broken guarantee appears on the `Departures:` line with its `G<n>` ID (an invariant by its text),
and nowhere else. Write the `DV<n>` and `F<n>` IDs `nexus verdict-items` printed, in `--pr` mode;
locally, list the departures and findings without IDs. In `--pr` mode the `Severity:` line is the
step's `open` counts (§2.6); an answered item is listed, never counted. Never write a listed item
as `<ID> — <verb>:` — that is the answer form, and a verdict never holds an answer.

`<epic-ref>`, `<record-ref>` and every `<story-ref>` are written under the **`nxs-issue-reference`**
skill loaded in Phase 0.5. Without a pull request the summary is a terminal report: qualify a
reference whenever its repository is known. On a pull request it is bare when the review is
published into `$ISSUES_REPO`, and qualified `owner/repo#N` when it is published anywhere else — a
`--pr` review posted on the code repository, most of all. `$ISSUES_REPO` names where the epic and the record live; a `<story-ref>`
qualifies against `$STORY_REPO` instead, when that resolves to a different repository.

**Open story issues are a note, never a finding.** They carry no severity, count nothing towards the
receipt's `findings:` tally, and never block. State them on the `Notes:` line — "stories <story-refs>
are still open; close them before `/nxs.close`" — and omit the line entirely when every story is
closed. An open sub-issue is `/nxs.close`'s hard block (its §1.1), not this gate's: here the question
is whether the code does what the planning said, and the code is readable from the diff whether or
not the issue has been closed yet.

**Severity gate:** an open critical or high item **blocks** the merge pre-check and close — the
code does not yet satisfy the epic. Fix the implementation, or answer the item on the pull request
(§2.6: accept a departure, waive a critical or high finding, each with a reason) and run
`/nxs.analyze --pr <N> --resolve` to record the answers (Phase 0.8); if the design changed, revise
the record. This command does not edit
code, issues, or the epic, and never posts an answer; it reports so the user can gate.

Without a pull request, analyze writes **no file** in any placement (epic #829, record #871,
D12) — not beside a materialized `epic.md` under `.nexus/tmp/`, and not in an
old-contract committed entry. The terminal report is the whole result. Nothing downstream reads a
local analysis file: `/nxs.close` reads only the verdict published on the pull request. The
record body Phase 0.5 hands the section reader through `<scratch>` is the run's own working copy,
not a result; nothing reads it after the run.

The report's **last line** is one fixed result line, so a script can read the result back without
parsing the summary:

```
Analyze result: critical=<C> high=<H> medium=<M> low=<L> head=<full 40-hex HEAD>
```

- `<C>`, `<H>`, `<M>` and `<L>` are the open counts: the same numbers as the `Severity:` line, as
  plain decimal integers. A local run has no IDs and applies no answers, so every item it lists is
  open and counts.
- `head` is `git rev-parse HEAD` in the checkout the run read, written in full.
- Write it exactly once, as the final line, with the spelling, order and single spaces shown — no
  bold, no backticks, nothing after it.
- A run that stops before judging — a non-epic entry (Phase 0.1), a blocked record (Phase 0.5), a
  redirect to a pull request (Phase 0.6), a failed read — prints **no** result line. A missing line
  therefore always means no result, never a clean one.

In `--pr` mode the result line is not printed; the published verdict is the result.

## PR mode — publish a review, not a file

In `--pr` mode the result is published on the PR, where `nexus close` reads it; no result
file is written here either, and the worktree is removed after this phase. A **blocked** run
(Phase 0.5) publishes nothing here either — no review, no comment.

1. Write the review body to a scratch file: the summary block above **verbatim**, then a machine
   block `/nxs.close` parses back out (the `<!-- nexus:analyze-receipt -->` marker anchors it):

    `````markdown
    <!-- nexus:analyze-receipt -->
    ```yaml
    epic: "<epic-ref>"
    nexus_version: <VERSION>             # the toolkit that wrote this block; omit if unresolved
    issues_repo: <ISSUES_REPO>           # where epic/record/stories live; ALWAYS written, never omitted
    repo: <repoIdentity>                 # the target repo actually read — the member, not the hub
    stories: [<n>, ...]                  # the story issue number(s) this verdict covers, in issues_repo
    pr: <N>
    date: <YYYY-MM-DD>
    head: <full 40-hex analyzedHead>     # the commit actually analyzed
    mode: full | downgraded
    record: "<record-ref>"               # full mode only — the record this checked against
    record_hash: <RECORD_HASH>           # full mode only — the FULL digest, never truncated
    findings: { critical: <C>, high: <H>, medium: <M>, low: <L> }
    ```
    `````

    `repo` is the `repoIdentity` the `open` step printed (epic #211): it names what was actually
    read, so a reader never has to assume "this repository" when the PR could belong to any
    declared member — the **code** repository the analyzed pull request lives in. `issues_repo` is
    the different question: the repository `epic`, `record` and `stories` resolve against — the
    checkout's own `$ISSUES_REPO`, or this repository's own `owner/repo` when `$ISSUES_REPO`
    resolved to nothing.

    **`issues_repo` is written on every publish** (epic #751), whether or not it equals `repo`.
    The rule that omitted it when the two matched is gone: that conditional is what produced a
    published verdict whose bare story numbers cross-matched an unrelated issue in the code
    repository. Two repositories stated is never ambiguous; one stated and one inferred is. An
    absent key now means only one thing — a verdict written before this change — and a reader
    still falls back to `repo` for those, which is why nothing already published is rejected.

    Stamp `epic-ref` and `record-ref` under the **`nxs-issue-reference`** skill: bare when they
    name `issues_repo`, qualified `owner/repo#N` when they do not — which, since this block is
    always published on a pull request in `repo`, is exactly the case where `issues_repo` differs
    from `repo`. `stories` is the sorted list `nexus pr-worktree stories` resolved — never
    re-derived by a reader, and never re-derived across runs: a story pull request analyzed more
    than once still carries only its own story numbers. It stays a bare number list: its repository
    is `issues_repo`, declared once, immediately above. Stamp the **full**, un-abbreviated repo
    identity and every covered story number; never truncate either.

    The block records **no story text** (epic #828): no `story_fingerprints` line. A story edited
    after this analysis is not stale for that reason; a design change still is, through
    `record_hash`. Receipts written by 0.82.0 to 0.86.0 carry that line, and every reader still
    accepts it and ignores it.

    `nexus_version` is the **writer stamp** (story #306): the release that wrote this block, taken
    from `nexus version`. It is a fact about the writer, never a gate — a reader that finds no stamp
    treats the writer as unknown and proceeds, and a reader whose own version differs from the stamp
    proceeds too. It sits beside the digests, never inside the bytes any of them cover. Omit the key
    when the release is unresolved; an absent stamp already means "unknown writer", and a fabricated
    version would not.

    `record` / `record_hash` are the second staleness axis: `/nxs.close` re-hashes the record issue
    and compares, so a design revised after this analysis is detectable and is named separately
    from a commit landing after it. Omit both keys entirely in downgraded mode — there is no record
    to name. Stamp the digest **in full**; no truncated form appears on any surface.

    `findings:` is the `open` counts `nexus verdict-items` printed (§2.6): only items still open,
    never a total. The merge pre-check and close block on these counts unchanged, so an accepted
    departure or a waived finding stops blocking them with no change to how they read a verdict.

    Then append the **judgments block** — the file `nexus verdict-items` wrote to `--out` in §2.5,
    verbatim, **after** the verdict block. It starts with the `<!-- nexus:analyze-judgments -->`
    marker and carries every departure, finding and deferred-scope proposal with its ID and its
    answer, each answer with who gave it and the link to the comment, the key decisions (§2.7) and
    each result's file list. The marker is followed by one HTML comment that holds the judgments
    compressed and encoded, so the pull request shows none of their content; `nexus
    verdict-judgments --pr <N> --repo <repo>` prints them as readable JSON. Every verdict carries
    it, a verdict with no item included: it is the ID registry the next run on this pull request
    reads. Never edit it by hand and never
    fold its content into the verdict block above, whose keys stay as they are.

2. **Check the drafted body before publishing anything:**

    ```bash
    nexus verdict-check --body "<scratch>/analyze-review.md" --dir "$wtPath"
    ```

    It resolves this checkout's issues repository and the analyzed pull request's code repository
    **itself** — you hand it neither — parses the body with the same parser every reader uses, and
    prints `{ issuesRepo, repo }` when the body names the repository its story numbers resolve
    against. A non-zero exit is a **failure of the publish step**: publish nothing, report the
    diagnostic verbatim, and do not report the run as successful. Three refusals have a mechanical
    correction. `issues-repo-missing` and `issues-repo-mismatch` name the issues repository the
    block should have carried, so rewrite the block with that value and run the check again.
    `story-text-recorded` means the block still has a `story_fingerprints` line; drop it and run
    the check again. `judgments-missing` means the judgments block was not appended: run §2.5's
    ID step and append its output. `counts-not-open` means the severity counts are not the open
    counts — they leave out an unanswered item, or count an answered or unlisted one: write the
    `open` counts the ID step printed, and list every finding through it, then check again. `judgments-malformed` means the judgments block
    was edited or misplaced: append the ID step's output again, unedited, after the verdict block.
    `marker-repeated` means text copied into the summary — an answer's reason, most often —
    carries a verdict marker: write its `<!--` as `&lt;!--` in the summary and check again.
    `key-decisions-missing` and `key-decisions-stale` mean the ID step ran without the record body
    and digest, or with a digest other than the one the verdict block stamps: run it again with
    `--record-body` and `--record-hash "$RECORD_HASH"`. `deferred-scope-sibling` means a proposal
    settles a criterion of a story this pull request does not cover: drop its `deferred`, run the
    ID step again and check again.

    **The size budget** (D5). The platform takes at most 65,536 characters. When the body is over,
    the check drops the results' file lists, puts a line saying so above the verdict block, records
    `filesDropped` in the judgments block — so the next `--resolve` run on a moved head judges the
    whole pull request again — and **writes the result back to the body file**: those are the bytes
    to publish, and it prints `filesDropped: true` and the `size`. It never drops a departure's or a
    finding's file list: the next full run gives an item found again its ID by that list, so the
    items keep their IDs and answers. If the body is still too large, it exits 1 with
    `verdict-too-large`, naming the size: **publish nothing**, report the size, and shorten the
    summary prose before checking again. This runs on the review path and the comment fallback path
    alike; the body it approves is the exact body that goes on the wire.

3. Publish it as a **PR review**, so the verdict lands in the merge box:

    ```bash
    # clean — no open critical/high item (the `open` counts):
    gh pr review <N> -R <repoIdentity> --approve --body-file "<scratch>/analyze-review.md"
    # an open critical or high item:
    gh pr review <N> -R <repoIdentity> --request-changes --body-file "<scratch>/analyze-review.md"
    ```

    Every call carries `-R <repoIdentity>` (the same value the machine block stamps as `repo`):
    left to itself `gh` picks a base repository from the worktree's remotes, which is exactly the
    ambiguity 0.48.0 fixed for the pull-request **reads** in this same flow — the review is a
    write on the same pull request and needs the same repository named explicitly.

    **Fallback:** GitHub forbids reviewing your own PR. If the review call fails because the lead
    authored the PR, post the same body as a comment and say so in your summary:

    ```bash
    gh pr comment <N> -R <repoIdentity> --body-file "<scratch>/analyze-review.md"
    ```

4. **Write nothing on the epic issue**, before or after the merge (epic #828, story #843). The
   review above is the whole published result. Analyze no longer writes a shipped record: close
   derives each story's range itself, in the checkout of the repository the pull request merged
   in, and reads this review's receipt through the one trusted reader. Records that earlier runs
   wrote stay on the epic issue and are still read, by close. Run
   analyze **before** the merge; close does not run it afterwards.

5. Remove the worktree, per the lifecycle rule in the `--pr` preamble above.

## Asking an epic what it has shipped

This gate reports **no coverage of its own** (epic #828, story #843; record #849, D8). Asked what an
epic has shipped, name `nexus close --epic <epic>` as the place that reports each story's state, and
report nothing more from here. Close's evidence gate runs

```bash
nexus epic-verdicts ranges --epic <epic>
```

and sorts every story of the epic into one state: `current`, `stale`, `never-reviewed`,
`unshipped`, `unknown` or `excluded`, each with the pull requests behind it and the remedy for
each stop. The command writes nothing, so a lead can run it at any time to see where every story
stands; `nexus close --epic <epic>` runs it first and stops on any story that is not current or
excluded. Never derive a coverage answer from the epic issue's records: nothing writes them any
more, so a merged pull request with no record is the ordinary case, not a gap.

`head` is the **full** `analyzedHead` so the commit the analysis judged is named without
ambiguity. `/nxs.close` compares it with the merged head, and
the merge pre-check with the pull request's current head (epic #828). Re-running analyze publishes
a fresh review; `/nxs.close` takes the latest trusted machine block.

# Usage

```
/nxs.analyze                      # committed entry from the branch, else resolve from its linked epic issue
/nxs.analyze 118                  # resolve epic issue #118 via the resolver; once a story merged, names the PR to analyze
/nxs.analyze path/to/epic-entry   # explicit queue entry / epic directory
/nxs.analyze --pr 123             # conformance against PR #123 in a worktree; epic from the PR's linked issue
/nxs.analyze --pr acme/widget#7   # from the hub, conformance against PR #7 in declared member acme/widget
/nxs.analyze --pr 123 --resolve   # record the answers posted on PR #123, judging only what changed since its last verdict
```

# Constraints

- **Conformance, not quality.** Compare code to intent. Do not run the test suite, do not run
  a security audit (that is `security-review`), do not run the app.
- **Read-only.** Never edit code, the epic, the decision record, or GitHub issues — in particular,
  never close, reopen, or comment on the record sub-issue. Findings are inline. **No file is
  written** — no receipt, no `task-review.md`, no other report file — with or without a pull
  request (D12). Nothing is written on the epic issue: no shipped record (epic #828).
- **An unapproved record blocks, and a block emits nothing.** No result line, no PR review, no PR
  comment — so a missing receipt keeps its single downstream meaning ("analyze never ran"). Approval
  is the close of the record sub-issue; a not-planned closure is a withdrawn design and blocks too.
- **Degraded mode is the exception, not the norm.** It is reachable only when the epic genuinely has
  no record and makes no needs-design claim — never from a fetch failure, an unreadable record, a
  not-planned closure, or a needs-design claim with no record filed.
- **The record hash comes from the one digest program** (`nxs-record-digest`), computed over the
  body as fetched from GitHub, and is stamped in full on the PR machine block
  beside the analysed commit. Never re-derive it with a shell one-liner and never truncate it.
- **A verdict is never published without naming its issues repository (epic #751).** The
  `nexus verdict-check` call in `--pr` mode step 2 is the boundary: the gate publishes only a body
  that check approved, and a refusal stops the publish rather than downgrading to a warning. Never
  restate its rule in prose here and never publish around it — the prose version of this rule
  existed for as long as the key did, and was followed everywhere except the one case it was
  written for.
- **Without a pull request, the terminal report is the whole result (D12).** It ends with the
  fixed `Analyze result:` line (Phase 3) and writes no file in any placement, old-contract
  committed entries included. No stage reads a local analysis file; `/nxs.close` reads only the
  verdict on the pull request.
- **No task analysis (0009).** There is no task layer: do not look for `TASK-*` files, `story_ref`, or
  task↔story traceability.
- **An open story is a note, not a blocker.** Story issues close on merge and this gate runs before
  the merge, so open stories are ordinary here: report them on the `Notes:` line as work to close
  before `/nxs.close`, never as a finding under a severity and never in the `findings:` tally.
- **Planning consistency is out of scope.** AC-quality-by-`story_type` belongs to the `nxs-epic-gate`
  agent (`/nxs.epic`); story↔design coverage is verified in `/nxs.decision-record`. Not here.
- **Engineer scratch is soft.** The per-user stubs are read-only context that can explain a
  departure — its reason is shown beside it — but never answer one, decide a verdict or gate the
  receipt; a missing scratch dir changes
  nothing (floor: conformance from the diff + ACs). The receipt schema does not record scratch. Its
  home is `.nexus/queue/epic-<epic-issue>/` — resolved from the epic issue number, never from `QDIR`,
  which under issue-sourced planning is a gitignored `.nexus/tmp/` materialization.
- **`--pr` mode resolves stories through a validated candidate ladder, never GitHub's
  closing-keyword linkage alone** (decision record #495) — that linkage is same-repository only,
  and it reads the pull-request *body* alone, so it gives nothing for a member PR whose story lives
  in the hub and nothing for a PR that carries its `Closes #<n>` lines one per commit.
  `nexus pr-worktree stories` gathers candidates (linked/closing issues when the PR is in the issues
  repository, commit trailers, branch name, body references qualified to the issues repository that
  state scope) and validates each against the issue graph; an explicit `--story <n>` replaces that
  gathering outright. A number that matches no issue is set aside and named in the refusal, while
  any other GitHub failure stops the run.
  Zero validated stories stops the run and names what was considered; findings in Phase 2.1 are
  scoped to only the resolved story(ies); §2.3's epic-level judgment runs only on a pull request
  that completes its epic (Phase 0.7).
- **What an issue *is* comes from `github.classification`, never from the issue graph's shape.** A
  candidate is an epic or a story because the repository marks it as one — by label under
  `classification: labels`, by GitHub issue type under `classification: types`, by either under the
  legacy default. Shape alone ("it has a parent, and that parent lists it back") cannot tell a story
  of an epic from an epic of an initiative, so in a repository that files epics under initiatives it
  resolves one level too high and the run checks the wrong acceptance criteria against the wrong
  decision record. When the declared mode's marker is absent and the *other* mode's marker would
  have answered, the run stops with `classification-mode-mismatch`: the settings do not describe how
  this repository files issues, and no stage may quietly work around that.
- **`--pr` mode runs in a worktree and publishes a review, not a file.** A bare PR number targets
  this checkout's own repository (single-repo, hub, or a member analyzing its own PR); a
  member-qualified reference or a PR URL may target any member the hub's workspace manifest
  declares — an undeclared repository or a declared member not checked out where expected stops
  the run and says so. Every read happens inside the target repository's worktree; the worktree is
  always removed at the end and on error. The conformance result is a PR review (comment fallback
  when the lead authored the PR) carrying the machine block — no file is written in this mode
  either. The PR may be open (analyze precedes merge). `nexus close` still
  refuses to run inside a member checkout: it closes from the hub.
