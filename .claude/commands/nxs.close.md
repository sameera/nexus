---
name: nxs.close
description: Close an epic. Emits a human-prose close record into the committed queue entry (key decisions + deferred-scope pointer + deviation rationale from a close-from-diff pass), appends deferred scope to the feature backlog, writes the process lesson as its own file, then — after a checkpoint — comments on and closes the epic GitHub issue. Preconditions — every child story issue closed (hard block), and /nxs.analyze ran (its analyze-receipt.md present and current; missing/stale/blocking requires an explicit user waiver).
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
3. **Otherwise** → stop and ask the user to either open the `*epic.md` in their editor and re-run, or
   pass the path: `/nxs.close path/to/epic.md`.

**Never** run `find`, `ls`, or any search to locate the epic. The resolved `epic.md` fixes the **queue
entry directory** (its parent); `decision-record.md` and `close-record.md` are its siblings there — no
search is needed to find them.

# Phase 0 — Validate the epic

1. Read and parse the `*epic.md` frontmatter. Extract:
    - `epic` (or `title`) — the epic title
    - `link` — the epic GitHub issue reference (e.g. `"#123"`)
    - `feature` — the parent feature name/slug (the queue entry's one-direction pointer, 0006 §4)
    - `complexity` — the story-size rollup (used for lesson framing)

2. Set `QDIR` = the directory containing `*epic.md` (the committed queue entry).

3. **Validate `link`.** It MUST exist and contain an issue number. If missing, stop and report:

    ```
    Cannot close epic: no GitHub issue linked.

    The epic frontmatter must contain a `link` (e.g. `link: "#123"`), added when the epic
    issue is created. Run `/nxs.epic` (approve at its gate) to create and link the epic issue.
    ```

    Extract the issue number from `link` (`"#123"` → `123`).

# Phase 1 — Preconditions

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

2. Check each story issue's state:

    ```bash
    gh issue view <story-issue> --json number,title,state
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

`/nxs.analyze` writes **`${QDIR}/analyze-receipt.md`** when it runs. Check it **before** mining
anything — if the user opts to analyze first, nothing later in this command should have run yet.

1. Read `${QDIR}/analyze-receipt.md`; parse `date`, `head`, `mode`, and `findings` from its
   frontmatter. Classify the state:
    - **clean** — receipt exists, `git rev-list --count <head>..HEAD` is `0`, and `findings`
      has no critical/high. Set the close record's `analyze:` value to `ran <date> @ <head>`
      and continue silently to Phase 2.
    - **missing** — no receipt: `/nxs.analyze` never ran on this entry.
    - **stale** — commits landed after the receipt (`git rev-list --count <head>..HEAD` > 0;
      report the count).
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
   during implementation:

    ```bash
    gh issue view <story-issue> --json title,body,comments
    ```

3. **Scratch decision stubs** — `.nexus/plans/<branch>/decisions.md`, where `<branch>` is the
   current branch with `/` replaced by `-`:

    ```bash
    ls ".nexus/plans/$(git branch --show-current | tr '/' '-')/" 2>/dev/null
    ```

    Each stub records a choice, its why, and the refuted alternative — captured at the decision
    moment, so treat them as the highest-fidelity *why* source. But they are **hints, not
    authority**: verify each stub against the shipped diff (Phase 3) before recording it. A stub
    contradicted by the code — the choice it records is not what shipped — is dropped, or
    recorded as a deviation with the stub as the "planned" side. If the directory or file is
    absent, say nothing and continue — capture is opt-in and most closes will have none.

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

5. **Consult captured plans as weak hints** — `.nexus/plans/<branch>/NN-plan.md` files, if any.
   Plans are pre-implementation speculation and routinely diverge from what ships; use them only
   to *notice* deviations (the plan said X, the diff shows Y — ask about it), never as a source
   of record. Nothing from a plan enters the close record unless the diff confirms it or the
   human supplies it as deviation rationale.

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
      epic appends entries; this epic always writes exactly one (the home repo).
    - **Key Decisions** — from Phase 2 (decision + why + refuted viable alternative if any).
    - **Deviation Rationale** — from Phase 3 (one bullet per deviation; the *why* the human supplied).
    - **Deferred Scope** — a **pointer only** to `docs/features/<feature>/backlog.md` (the scope itself
      is appended in Phase 5, not restated here).
    - **Process Lesson** — a **pointer only** to the lesson file written in Phase 6.

3. Write it to **`${QDIR}/close-record.md`** — in the committed queue entry, beside `epic.md` and
   `decision-record.md`. Do **not** emit a `ConceptDelta` block; the record is human prose only.

# Phase 5 — Append deferred scope to the feature backlog

Deferred scope goes to the feature backlog, not into the close record (C2). `backlog.md` is a
**two-writer, append-only** surface shared with `/nxs.epic`'s decomposition stubs (0008) — use the
**same entry shape**; never rewrite existing blocks.

1. Target `docs/features/<feature>/backlog.md` (create it with the header on first write):

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

1. Ensure `docs/delivery/lessons/` exists (`/nxs.setup` scaffolds it; create if absent).
2. Write **`docs/delivery/lessons/<YYYY-MM-DD>-<slug>.md>`** where `<slug>` derives from the epic:

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
1. Close record  → ${QDIR}/close-record.md
2. Deferred scope → docs/features/<feature>/backlog.md (<N> item(s))
3. Process lesson → docs/delivery/lessons/<date>-<slug>.md

Preconditions: all <M> child story issues closed · analyze: <the Phase 1.2 outcome> ·
workspace: <the Phase 1.3 role>.

About to:
4. [member mode only] Migrate the queue entry → <hub-root>/.nexus/queue/<entry-dir-name>/
   — committed on the hub's current branch '<hub-branch>' (local git, recoverable)
5. [member mode only] Remove the queue entry from this repo — committed on branch '<branch>'
   (local git, recoverable)
6. Post the close comment on epic issue #<epic-issue>  (irreversible)
7. Close epic issue #<epic-issue>  (irreversible)
```

In single-repo and hub mode, omit items 4–5 (and renumber) — the list reads exactly as today.

Then ask via **`AskUserQuestion`** (not free text). Three options:

- **close** — proceed to Phase 7.5 (member mode) and then Phase 8 (post the comment, close the
  epic issue).
- **abort** — stop; leave the epic issue open. The local artifacts stay written.
- **review** — display the generated `close-record.md`, then ask again.

**Handle the selection** (treat an "Other" answer by intent):

- **close** → Phase 7.5 in member mode, otherwise Phase 8.
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

# Phase 8 — Post the comment and close the epic issue

In member mode this phase runs only after Phase 7.5 succeeded. GitHub ops target the **epic
issue** via `link`. The epic issue is a **durable** surface; the queue
`close-record.md` is **ephemeral** — the distiller deletes it post-merge. So the comment carries the
close record's **prose inline** (Key Decisions + Deviation Rationale); it must **never** link into
`.nexus/queue/`, or the link dangles the moment the distillation PR merges. Durable pointers — the
feature backlog and the lesson file, both under `docs/` — may be included as bare paths (or absolute
GitHub URLs via `nxs-abs-doc-path`); nothing in the queue may be linked.

Write the comment body to a scratch file (Key Decisions + Deviation Rationale copied from
`close-record.md`; drop the Deviation heading if there were none), then post it with `--body-file`
(avoids shell-escaping the prose), then close the epic issue:

```bash
gh issue comment <epic-issue> --body-file "<scratch>/close-comment.md"
gh issue close <epic-issue> --reason completed
```

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
- Deferred scope → docs/features/<feature>/backlog.md
- Process lesson → docs/delivery/lessons/<date>-<slug>.md
```

**Then delete the branch's scratch** — consumed hints must not leak to a future epic on a
reused branch:

```bash
rm -rf ".nexus/plans/$(git branch --show-current | tr '/' '-')"
```

Delete only the current branch's directory, never `.nexus/plans/` itself or another branch's
scratch. If the abort path was taken at the checkpoint, leave scratch in place — it is consumed
only by a completed close.

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
Deferred scope:    docs/features/<feature>/backlog.md  (<N> item(s))
Process lesson:    docs/delivery/lessons/<date>-<slug>.md
Scratch consumed:  .nexus/plans/<branch>/ — <N> stub(s), <M> plan(s) — deleted

Key decisions captured: <count>
Deviations recorded:    <count>
```

(Use "none found" for the scratch-consumed line when the directory was absent.)

In member mode, end the report with the durability instruction — closure is not durable until
the hub commit is pushed:

    ACTION REQUIRED — push the hub commit:
        git -C <hub-root> push

In single-repo and hub mode, omit the Queue entry line and the push instruction; the close
record's line already says the entry stays and is consumed post-merge.

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
- **Scratch is hints, never authority** — a decision stub or captured plan enters the close
  record only when the diff confirms it or the human ratifies it as deviation rationale. The
  diff remains ground truth (0006).
- **Scratch cleanup is scoped and post-checkpoint** — delete only
  `.nexus/plans/<current-branch>/`, only after Phase 8 completes; never on abort, never another
  branch's directory, never the whole `.nexus/plans/` tree.
- **The distiller never sees scratch** — nothing from `.nexus/plans/` may be copied into the
  queue entry verbatim as a new artifact; the close record's prose is the only carrier.
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

# Usage

```
/nxs.close                    # epic from the open editor file
/nxs.close path/to/epic.md    # explicit epic path
```
