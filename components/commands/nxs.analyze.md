---
name: nxs.analyze
description: Implementation-conformance gate. Runs only for an epic entry; a fix or an intake entry has no acceptance criteria, no success metrics and no decision record to check against, so the gate stops rather than degrading into a pass. Checks the implemented code against the epic's acceptance criteria, success metrics, and the decision record's invariants — does the build do what the planning said. Refuses to run while the epic's decision-record sub-issue is unapproved, and stamps which record it checked against. Reads the epic + the record issue body and the branch diff / closed story issues; reports inline conformance findings and writes a small analyze-receipt.md beside the resolved epic.md — under the gitignored .nexus/tmp/ for an issue-sourced epic, in the committed entry for an old-contract one (/nxs.close gates on it). With `--pr <N>` it instead runs in a worktree against the PR (which may be open) and publishes the result as a PR review carrying a machine-readable receipt block. Run after the stories are implemented, before /nxs.close. Planning consistency is checked earlier, not here: story↔design coverage by /nxs.decision-record, AC quality by the nxs-epic-gate agent.
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
    PR's own linked/closing issues, the issue number in its branch name, repo-qualified issue
    references in its body — validates each against the live issue graph, and prints `{ epic,
    stories }`. **Zero validated stories stops the run and names the candidates it considered; do
    not proceed.** Two or more is not an error: the run covers all of them.
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
`analyze-receipt.md` and modify no file in the entry.** A fix entry already records the state in
words: its close record's `analyze:` value is the literal `n/a — fix entry (no acceptance
criteria)`. An intake entry does the same with `n/a — intake entry (no acceptance criteria)`. Either
way the state stays greppable and can never be read as a waiver.

An epic entry is unchanged: everything below runs exactly as it always has.

Load `epic.md` (stories, acceptance criteria, success metrics) from the resolved entry, and read its
frontmatter `link` to get the epic issue number; it anchors the story issues.

## Phase 0.5 — Resolve the decision record (four states, one of which blocks)

The decision record supplies the **invariants** to check, and its home is a **sub-issue of the epic
issue** (#139). Resolve it before anything else — a blocked run must emit nothing at all.

1. Resolve the target repo and the needs-design label name **through the shared publishing
   resolver**, never by parsing `settings.yml` (see `/nxs.close` Phase 1.0):

    ```bash
    ISSUES_REPO="$(nexus config resolve epic-repo --root "<root>")"
    REPO_ARG=""; [ -n "$ISSUES_REPO" ] && REPO_ARG="-R $ISSUES_REPO"
    NEEDS_DESIGN="$(nexus config resolve needs-design-label --root "<root>")"
    ```

    `<root>` is the repo root, or `$wtPath` in `--pr` mode (the config lives inside the worktree).

2. Read the two live facts off the issue graph: the epic's labels
   (`gh issue view <epic-issue> $REPO_ARG --json labels`) and its record sub-issue — the resolver
   already reported it as `record` (`{ number, state }` or `null`), and the materialized `epic.md`
   frontmatter carries `record` / `record_state`.

3. **Resolve to exactly one of four states:**

    | State | Condition | Outcome |
    | --- | --- | --- |
    | **full** | record sub-issue exists and is **closed as completed** | Run in full mode; invariants come from the record issue body. |
    | **block — unapproved** | record sub-issue is **open**, or closed as **not planned** | **Stop.** A not-planned closure is a withdrawn design, not an approval. |
    | **block — claimed but unfiled** | epic carries the needs-design label but has **no** record sub-issue | **Stop.** The epic says it needs a record and none exists. |
    | **degraded** | **no** record sub-issue **and no** needs-design claim | Run in the no-invariant mode and state that you did (invariant 13). |

    An **old-contract** entry carrying a committed `decision-record.md` resolves to **full** from
    that file, exactly as today — baseline precedence is per entry: record sub-issue, else committed
    file, else no record.

    A **fetch failure** — the record issue cannot be read, the body cannot be fetched — never reaches
    degraded mode. Report the diagnostic and stop: degraded is for an epic that genuinely has no
    record, never for one whose record could not be read.

4. **On either block state, emit nothing at all** — no `analyze-receipt.md`, no PR review, no PR
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
    the result in Phase 3. Read the invariants from the **record issue body** (the same fetch), not
    from any local copy.

# Phase 1 — Gather the implementation surface

Determine what was actually built for this epic. Use, in order of availability:

1. **The branch diff.** Compare the current branch against the base it forked from:

    ```bash
    BASE="$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main)"
    EXCLUDE="$(nexus excluded-stores)"
    git diff --stat "$BASE"...HEAD -- . $EXCLUDE
    git diff "$BASE"...HEAD -- . $EXCLUDE
    ```

    If the epic was implemented across several merges, this is the cumulative change set.

    **In `--pr` mode**, skip the `merge-base` line: run inside `wtPath`, set `BASE` to the
    preflight `base`, and diff against the worktree head — `git -C <wtPath> diff "$BASE"...HEAD -- . $EXCLUDE`
    — which is exactly the PR's change set.

    **The exclusion is not optional and its paths are not yours to write.** The pipeline stores are
    surfaces Nexus writes and teaches from, never behaviour it reads back, so a conformance verdict
    must never be drawn from one. Ask the toolkit for the set (`nexus excluded-stores --form reasons`
    prints it with the reason each store is a member); it is stated in exactly one place, and this
    body restating it could drift from the code (record #450, invariants 4-5). Each store is withheld
    entire — never a slice of one.

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
   because the scratch is committed to the PR head, not machine-local). Use them to explain
   scope drift (§2.4) and, in **downgraded** mode, to reconstruct likely invariants the
   missing decision record would have carried. They **never** change a met/partial/unmet/
   contradicted verdict — the diff and the ACs decide that. Absent → ignore silently.

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

For `system` stories, the AC states a measurable threshold — confirm the code path that would meet it
exists; if the threshold needs a benchmark you cannot read from the diff, mark it **unverifiable here**
and name the command that would measure it, do not pass it silently.

## 2.2 Invariant conformance (full mode only)

For each constraint/invariant in the decision record — the **record issue body** resolved in Phase
0.5, or an old-contract entry's committed `decision-record.md` — and any security boundary it names,
check the diff does not violate it. A change that breaks an invariant is **critical** — invariants
are the decisions the build "must preserve". Cite the file/line in the diff that breaks it.

Skip this section only in **degraded** mode, which by Phase 0.5 means the epic genuinely has no
record. That is now the exception rather than the norm: the record has a durable home (the record
sub-issue), so degraded mode is reached only by the deliberate no-record outcome — never, as before,
because the record had nowhere to live.

## 2.3 Success-metric coverage (epic level)

**Skip this section in `--pr` mode.** A success metric is a property of the whole epic, unmeasurable
by construction against one story's pull request — every story PR of the epic would otherwise carry
the same manufactured finding. Cross-story assessment belongs to the epic-level aggregate (#212).

Otherwise, for each item in the epic's `## Success Metrics`, state whether the implementation
plausibly moves it and whether it is **measurable** from what shipped (is the metric instrumented /
observable?). A success metric with no way to measure it post-ship is a **finding (medium)** — the
epic claimed an outcome the build cannot demonstrate.

## 2.4 Scope drift (informational)

Note material behavior in the diff that **no** story called for (unplanned scope), and any story whose
implementation went meaningfully beyond its ACs. Informational unless it breaks an invariant.

# Phase 3 — Report (inline) and write the receipt

Return a concise summary:

```
Conformance: <epic title> (<queue-entry-or-path>)  ·  epic #<link>
Mode: full (record #<record> @ <RECORD_HASH>) | downgraded (epic has no decision record)
Surface: <N> files changed, <N> stories (<M> closed / <O> open)

Per-story AC conformance:
  STORY <title>: <met>/<total> met · <partial> partial · <unmet> unmet · <contradicted> contradicted

Invariant violations:   <decision-record invariant → file:line that breaks it, ...>  (full mode)
Success metrics:         <metric → measurable? plausibly-moved?>
Scope drift:             <unplanned behavior, ...>
Notes:                   <stories still open → close before /nxs.close, ...>   (omit when none)

Severity: ⛔ critical <C> · ⚠️ high <H> · medium <M> · low <L>
```

**Open story issues are a note, never a finding.** They carry no severity, count nothing towards the
receipt's `findings:` tally, and never block. State them on the `Notes:` line — "stories #a, #b are
still open; close them before `/nxs.close`" — and omit the line entirely when every story is closed.
An open sub-issue is `/nxs.close`'s hard block (its §1.1), not this gate's: here the question is
whether the code does what the planning said, and the code is readable from the diff whether or not
the issue has been closed yet.

**Severity gate:** critical or high findings should **block close** — the code does not yet satisfy
the epic. Fix the implementation (or, if the epic's intent changed during build, amend `epic.md` and
re-file the affected story issues) before `/nxs.close`. This command does not edit code, issues, or
the epic; it reports so the user can gate.

Then write the **receipt** — the proof this gate ran, which `/nxs.close` checks as a precondition.
Write it to **`analyze-receipt.md`** beside the resolved `epic.md`, overwriting any previous receipt
(a re-run supersedes it). This is the command's only write.

**Where the receipt lives is a contract, not an accident of where the epic resolved** (#171):

- **Issue-sourced epic** (resolver-materialized, no committed entry — the #114 norm): the receipt is
  written under **`.nexus/tmp/epic-<n>/`**, beside the materialized `epic.md`. This placement is
  intentional: the receipt is ephemeral hand-off content for the same-sitting `/nxs.close` →
  `/nxs.distill` flow, and both commands depend on finding it there without re-deriving it. It is
  never committed, never linked from an issue, and never described as committed on any surface
  (record #176, invariant 1).
- **Old-contract entry** (an `epic.md` already committed under `.nexus/queue/`): the receipt is still
  written into that committed directory, unchanged from before.
- **`--pr` mode**: no receipt file at all — the result is a published PR review (below), unchanged.

```markdown
---
epic: "<link>"                        # e.g. "#11"
nexus_version: <VERSION>              # the toolkit that wrote this receipt (`nexus version`); omit if unresolved
date: <YYYY-MM-DD>
head: <git rev-parse --short HEAD>    # the commit the analysis read
mode: full | downgraded
record: "#<record>"                   # full mode only — the decision record this checked against
record_hash: <RECORD_HASH>            # full mode only — the FULL digest, never truncated
findings: { critical: <C>, high: <H>, medium: <M>, low: <L> }
---

<the summary block above, verbatim>
```

`nexus_version` is the **writer stamp** (story #306): the release that wrote this receipt, taken
from `nexus version`. It is a fact about the writer, never a gate — a reader that finds no stamp
treats the writer as unknown and proceeds, and a reader whose own version differs from the stamp
proceeds too. It sits beside the digests, never inside the bytes any of them cover, so stamping a
receipt cannot change a value a later stage compares. Omit the key when the release is unresolved;
an absent stamp already means "unknown writer", and a fabricated version would not.

`record` / `record_hash` are the second staleness axis: `/nxs.close` re-hashes the record issue and
compares, so a design revised after this analysis is detectable and is named separately from a
commit landing after it. Omit both keys entirely in downgraded mode — there is no record to name.
Stamp the digest **in full**; no truncated form appears on any surface.

The receipt is ephemeral in both placements: a committed entry is deleted whole by the distiller
post-merge, and a `.nexus/tmp/` entry is hand-off content consumed by the drain. Never link it from
an issue.

## PR mode — publish a review, not a receipt file

In `--pr` mode the worktree is removed after this phase, so **do not write `analyze-receipt.md`**
(it would vanish with the worktree). Instead publish the result on the PR so `/nxs.close --pr` can
read it. A **blocked** run (Phase 0.5) publishes nothing here either — no review, no comment.

1. Write the review body to a scratch file: the summary block above **verbatim**, then a machine
   block `/nxs.close` parses back out (the `<!-- nexus:analyze-receipt -->` marker anchors it):

    `````markdown
    <!-- nexus:analyze-receipt -->
    ```yaml
    epic: "<link>"
    nexus_version: <VERSION>             # the toolkit that wrote this block; omit if unresolved
    repo: <repoIdentity>                 # the target repo actually read — the member, not the hub
    stories: [<n>, ...]                  # the story issue number(s) this verdict covers
    pr: <N>
    date: <YYYY-MM-DD>
    head: <full 40-hex analyzedHead>     # the commit actually analyzed
    mode: full | downgraded
    record: "#<record>"                  # full mode only — the record this checked against
    record_hash: <RECORD_HASH>           # full mode only — the FULL digest, never truncated
    findings: { critical: <C>, high: <H>, medium: <M>, low: <L> }
    ```
    `````

    `repo` is the `repoIdentity` the `open` step printed (epic #211): it names what was actually
    read, so a reader never has to assume "this repository" when the PR could belong to any
    declared member. `stories` is the sorted list `nexus pr-worktree stories` resolved — never
    re-derived by a reader, and never re-derived across runs: a story pull request analyzed more
    than once still carries only its own story numbers. Stamp the **full**, un-abbreviated repo
    identity and every covered story number; never truncate either.

2. Publish it as a **PR review**, so the verdict lands in the merge box:

    ```bash
    # clean — no critical/high findings:
    gh pr review <N> --approve --body-file "<scratch>/analyze-review.md"
    # critical or high present:
    gh pr review <N> --request-changes --body-file "<scratch>/analyze-review.md"
    ```

    **Fallback:** GitHub forbids reviewing your own PR. If the review call fails because the lead
    authored the PR, post the same body as a comment and say so in your summary:

    ```bash
    gh pr comment <N> --body-file "<scratch>/analyze-review.md"
    ```

3. Remove the worktree, per the lifecycle rule in the `--pr` preamble above.

`head` is the **full** `analyzedHead` (not the short SHA the file receipt uses) so `/nxs.close` can
compare it for exact equality against the PR head. Re-running analyze publishes a fresh review;
`/nxs.close` takes the latest machine block.

# Usage

```
/nxs.analyze                      # committed entry from the branch, else resolve from its linked epic issue
/nxs.analyze 118                  # resolve epic issue #118 via the resolver (no committed entry needed)
/nxs.analyze path/to/epic-entry   # explicit queue entry / epic directory
/nxs.analyze --pr 123             # conformance against PR #123 in a worktree; epic from the PR's linked issue
/nxs.analyze --pr acme/widget#7   # from the hub, conformance against PR #7 in declared member acme/widget
```

# Constraints

- **Conformance, not quality.** Compare code to intent. Do not run the test suite, do not run
  a security audit (that is `security-review`), do not run the app.
- **Read-only, one exception.** Never edit code, the epic, the decision record, or GitHub issues —
  in particular, never close, reopen, or comment on the record sub-issue. Findings are inline; the
  only file written is `analyze-receipt.md` beside the epic — never `task-review.md` or any other
  report file.
- **An unapproved record blocks, and a block emits nothing.** No receipt file, no PR review, no PR
  comment — so a missing receipt keeps its single downstream meaning ("analyze never ran"). Approval
  is the close of the record sub-issue; a not-planned closure is a withdrawn design and blocks too.
- **Degraded mode is the exception, not the norm.** It is reachable only when the epic genuinely has
  no record and makes no needs-design claim — never from a fetch failure, an unreadable record, a
  not-planned closure, or a needs-design claim with no record filed.
- **The record hash comes from the one digest program** (`nxs-record-digest`), computed over the
  body as fetched from GitHub, and is stamped in full on both the receipt and the PR machine block
  beside the analysed commit. Never re-derive it with a shell one-liner and never truncate it.
- **Receipt placement is contractual (#171).** Issue-sourced epic → `analyze-receipt.md` under
  `.nexus/tmp/epic-<n>/`, beside the materialized `epic.md`; old-contract committed entry → into
  that committed directory, unchanged; `--pr` → PR review only, no receipt file. Downstream
  commands (`/nxs.close`, `/nxs.distill`) rely on this placement — never write the receipt anywhere
  else.
- **No task analysis (0009).** There is no task layer: do not look for `TASK-*` files, `story_ref`, or
  task↔story traceability.
- **An open story is a note, not a blocker.** Story issues close on merge and this gate runs before
  the merge, so open stories are ordinary here: report them on the `Notes:` line as work to close
  before `/nxs.close`, never as a finding under a severity and never in the `findings:` tally.
- **Planning consistency is out of scope.** AC-quality-by-`story_type` belongs to the `nxs-epic-gate`
  agent (`/nxs.epic`); story↔design coverage is verified in `/nxs.decision-record`. Not here.
- **Engineer scratch is soft.** The per-user stubs are read-only context that can explain a
  divergence but never decide a verdict or gate the receipt; a missing scratch dir changes
  nothing (floor: conformance from the diff + ACs). The receipt schema does not record scratch. Its
  home is `.nexus/queue/epic-<epic-issue>/` — resolved from the epic issue number, never from `QDIR`,
  which under issue-sourced planning is a gitignored `.nexus/tmp/` materialization.
- **`--pr` mode resolves stories through a validated candidate ladder, never GitHub's
  closing-keyword linkage alone** (decision record #495) — that linkage is same-repository only and
  gives nothing for a member PR whose story lives in the hub. `nexus pr-worktree stories` gathers
  candidates (explicit ref, linked/closing issues, branch name, repo-qualified body references) and
  validates each against the issue graph. Zero validated stories stops the run and names what was
  considered; findings in Phase 2.1 are scoped to only the resolved story(ies); Phase 2.3
  (success-metric coverage) does not run in this mode at all.
- **`--pr` mode runs in a worktree and publishes a review, not a file.** A bare PR number targets
  this checkout's own repository (single-repo, hub, or a member analyzing its own PR); a
  member-qualified reference or a PR URL may target any member the hub's workspace manifest
  declares — an undeclared repository or a declared member not checked out where expected stops
  the run and says so. Every read happens inside the target repository's worktree; the worktree is
  always removed at the end and on error. The conformance result is a PR review (comment fallback
  when the lead authored the PR) carrying the machine block — `analyze-receipt.md` is **not**
  written in this mode. The PR may be open (analyze precedes merge). `/nxs.close --pr` still
  refuses a member outright until #215.
