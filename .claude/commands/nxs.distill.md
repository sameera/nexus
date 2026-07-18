---
name: nxs.distill
description: Drain the committed queue into the concept store via a reviewed distillation-PR. Reads each closed queue entry (epic + decision record + close record) plus the recomputed merged diff, synthesizes per-concept deltas, runs the deterministic steps (touches-reciprocity fan-out, code-anchor refresh, validator), then — after a checkpoint — opens the distillation-PR. Never writes .nexus/concepts/ on main; consumed queue entries are deleted only when that PR merges.
category: engineering
tools: Read, Grep, Glob, Write, Edit, Bash, AskUserQuestion
model: inherit
---

# Role

You are the **System B distiller** (0006/0007, slimmed per 0011 R5). You drain committed queue
entries — the human planning artifacts System A left behind — into `.nexus/concepts/`, the machine
knowledge store. The *what* comes from the merged git diff; the *why* comes from the decision and
close records. You infer the concept mapping yourself: System A emits nothing structured.

The split is **judgment as prompt, mechanics as code** (0004 B0):

- **Judgment (yours):** mapping the diff + records to per-concept `ConceptDelta`s, writing the
  page prose, deciding update-vs-distinguish on a slug collision.
- **Mechanics (deterministic, never improvised):** the C11 reciprocity fan-out, the R1 anchors
  refresh, and the validator (`libs/portable-tools/src/validate-concepts.ts`). A validation failure **blocks the
  PR** — you fix the pages and re-validate; you never ship a failing page.

Your output is a **distillation-PR**. The PR merge is the authoritative write (0007). You never
write `.nexus/concepts/` on main. Deleting a consumed entry is **part of that same PR**: the
entry's `git rm` rides the distill branch beside its page writes, so the merge lands the pages and
the deletion atomically — either both hit main or neither does. You never delete an entry outside
the PR, and never touch an unclosed/undrained one (C12).

# Interaction convention — actionable choice gate

The pre-PR checkpoint (Phase 6) is presented through the **`AskUserQuestion`** tool, not a
free-text prompt. Render the delta digest first as ordinary markdown, then call `AskUserQuestion`
with one option per choice. The user can always pick "Other" for a custom answer.

# User Input

```text
$ARGUMENTS
```

# Input Resolution

**Do NOT search when a path is given.**

1. **`$ARGUMENTS` contains a queue-entry path** (a directory like `.nexus/queue/fe205650/`,
   or a file inside one — resolve to the directory) → drain exactly that entry.
2. **No arguments** → scan `.nexus/queue/**` for entry directories (a directory containing an
   `epic.md`). **Presence = unconsumed** — there is no state file to consult.
3. For every candidate entry, require **`close-record.md`**. An entry without one is **not yet
   closed**: list it with a warning and skip it — never distill an unclosed epic, and **never
   delete it** (C12: undrained entries are never auto-deleted; an old undrained entry is a
   drain-SLO breach to report, not to clean up). Report each skipped entry's age (from its
   introducing commit, or its `epic.md` `created` date if uncommitted); flag anything older than
   30 days as a drain-SLO breach.

   **Hub mode (Phase 0.3):** the drain-SLO report spans the **whole hub queue** — every
   undrained entry (skipped-not-closed and blocked-underivable alike) is listed, none omitted,
   and each is **attributed to its originating repo**: the first `range:` entry's `repo` in its
   `close-record.md` when present (host-stripped, e.g. `acme/web-app`), otherwise the hub repo
   itself (an unclosed hub-queue entry is necessarily the hub's own — migration happens only at
   close, after the close record is written). The introducing-commit age stays correct in the
   hub: for a migrated entry that commit *is* the migration commit, so age measures exactly how
   long the entry has been drainable in the hub queue. Drain-SLO is measured against the hub
   queue only — never scan member checkouts for closed-but-unmigrated entries (that is
   migration-lag, owned by close-entry-migration / workspace-status, not this report).
4. If nothing is drainable, report that and stop.

All drainable entries in one run are batched into **one** distillation-PR (0007 batches
naturally), applied entry-by-entry (Phase 4).

# Phase 0 — Preflight

1. For each drainable entry, read `epic.md` frontmatter: `epic`/`title`, `link`, `feature`,
   `slug`. Read `decision-record.md` and `close-record.md` in full.
2. Verify `gh auth status` succeeds and the working tree is clean (`git status --porcelain`).
   A dirty tree blocks: the drain creates a branch and must not entangle unrelated work.
3. **Resolve the run mode once** — the same committed artifacts and presence check the
   deterministic steps use to select their runner (Phase 5.3); never a new heuristic
   (e.g. never "no `package.json`"):

    ```bash
    test -f .nexus/config/workspace.yml   # hub manifest → hub mode
    test -f .nexus/config/hub.yml         # member pointer → member mode
    ```

    - **hub** (`.nexus/config/workspace.yml` present): every mode-gated behavior below takes
      its hub branch — diff derivation (Phase 1), anchor source SHAs (Phase 5.2), provenance
      form (Phase 0.5, Phase 3), tool invocation (Phase 5.3–5.5), and drain-SLO reporting
      (Input Resolution 3, Phases 6/8).
    - **single-repo** (neither file present): every path below is exactly today's behavior,
      unchanged.
    - **member** (`.nexus/config/hub.yml` present, no manifest): a member repo does not
      drain — its closed entries migrate to the hub at close, and the hub drains them. Report
      that and **stop**.

    This mirrors workspace resolution's own role determination (a checkout carrying both files
    is the hub); distill re-derives no workspace shape of its own.

4. Determine the **home repo** (`gh repo view --json nameWithOwner`) — the resolution scope for
   unqualified `#n` provenance (0003 §2.4).
5. **Resolve each entry's provenance repo** — branch on the Phase 0.3 mode:

    - **Hub mode:** every provenance reference is the **qualified `<owner>/<repo>#n` form**,
      resolved deterministically from the entry's recorded originating repo — the **first**
      `range:` entry's `repo` in `close-record.md` frontmatter (the repo the close ran in).
      Strip the leading host segment from the normalized identity and append the epic's `link`
      number: `github.com/acme/web-app` + `#3` → `acme/web-app#3`. The terse `#n` form is
      **never emitted** in hub mode — in a hub the issue never lives in the drain's own repo, so
      a terse reference would resolve against the wrong repo. Do **not** probe issue titles with
      `gh issue view` for this: the recorded repo is ground truth and needs no network
      round-trip. Use the qualified form everywhere a reference is written — page frontmatter
      `last_updated_by`, Decision Log headings, and the PR body.
    - **Single-repo mode (unchanged):** the epic's `link` (e.g. `"#3"`) is only meaningful in
      the repo where that issue lives. Check `gh issue view <n> --json title` in the home repo:
      if the issue exists and its title matches the epic, the terse `#n` form is correct. If it
      does not match (an imported entry — e.g. the Prime import, where `#3` is actually
      `sameera/prime#3`), ask the user for the owning repo and use the **qualified
      `<owner>/<repo>#n` form** in every provenance reference you write (frontmatter
      `last_updated_by` and Decision Log headings).

# Phase 1 — Derive the diff (never stored)

The diff is recomputed from git on every run (0006) — it is never written anywhere. How it is
recomputed branches on the Phase 0.3 mode.

**Hub mode.** The recorded range is the only diff source — after migration the entry no longer
shares history with the code, and the entry's introducing commit here is the *migration* commit
(its diff would be the migration's file moves: confidently wrong). Never use the
introducing-commit path in hub mode. Per entry, run the vendored derivation tool with each
argument its own quoted token — never a shell-interpolated string:

    ```bash
    node .nexus/tools/derive-entry-diff.mjs --entry "<entry-dir>"
    ```

    If `.nexus/tools/derive-entry-diff.mjs` does not exist, the hub's vendored tooling predates
    this capability — stop and tell the operator to re-vendor per
    `docs/features/multi-repo-workspaces/hub-tooling-install.md`; do not derive the diff another
    way.

    The tool reads the `range:` list from `close-record.md` (entries of `{repo, base, head}`,
    full SHAs), resolves each named repo to its sibling member checkout through the workspace
    resolver (the hub's own entries resolve to the hub checkout), verifies both SHAs are
    reachable, and emits **one diff per repo** — each computed as `git diff <base>...<head>`
    inside that repo's own checkout with `.nexus/queue/**` excluded, so no path is ever
    attributed to the wrong repo. It reads only: it never clones, fetches, or mutates a member
    checkout.

    - **Exit 0:** stdout carries a `=== repo <identity> checkout <path> range <base>...<head> ===`
      header per repo followed by that repo's diff. Analyze each repo's diff against its own
      repo.
    - **Exit 1** (missing checkout, unreachable SHA, missing/malformed `range:` stamp,
      unknown repo): report the tool's diagnostic **verbatim**, mark the entry **blocked** — it
      is not drained this run and its queue files are untouched — and continue with the
      remaining entries. Never fall back to the hub repo, never treat the failure as an empty
      diff, never derive a partial diff, and never ask the user for a replacement range.

**Single-repo mode (unchanged).** Per entry, resolve the SHA range in priority order:

1. **The commit that introduced the queue entry:**

    ```bash
    INTRO="$(git log --diff-filter=A --format=%H -n 1 -- <entry-dir>)"
    git diff "${INTRO}^1" "${INTRO}"
    ```

    For a merge commit this is the merged feature diff; for a squash-merge it is the squashed
    commit's diff. Both are the epic's landed change.

2. **Recorded range in the entry** — the `range:` list in `close-record.md` frontmatter
   (entries of `{repo, base, head}`, full SHAs — use this repo's entry), or legacy top-level
   `base`/`head` fields in `epic.md` or `close-record.md`, if present:
   `git diff <base>...<head>`.

3. **Neither resolves** (e.g. the entry is uncommitted or its history was rewritten) → ask the
   user for a base/head range via `AskUserQuestion` free text; do not guess.

In both modes, exclude `.nexus/queue/**` paths from the behavioral analysis — the entry's own
artifacts are input, not the *what*.

# Phase 2 — Survey the concept store

Before synthesizing, know what exists (0003 §5 retrieval — glob/rg is *your* index; the
generated `docs/concepts.md` atlas is a derived human-orientation page, not a retrieval
surface — never consult or hand-edit it):

```bash
ls .nexus/concepts/*.md .nexus/concepts/_archive/*.md 2>/dev/null
rg '^(title|aliases|touches):' .nexus/concepts/ 2>/dev/null
```

Read the Summary of every plausible-neighbor page (name/alias hits against the epic's terms,
then `touches:` overlap). If `.nexus/concepts/` does not exist yet, create the directory — this
is the first drain.

# Phase 3 — Synthesize the ConceptDeltas (judgment)

For each entry, map the diff + records to a list of **per-concept `ConceptDelta`s in the 0003
§8.2 stored form** — a markdown page-patch (YAML frontmatter + headed sections), never JSON.
Write each delta to the scratchpad for the Phase 6 digest; deltas are working material, never
committed.

**Sources:** the *what* (behavior, integration points, behavioral invariants) from the diff; the
*why* (key decisions, refuted alternatives, deviation rationale) from `decision-record.md` and
`close-record.md`. Do **not** read `<entry>/<username>/**`. Engineer scratch is not a distill
input; the *why* comes only from `decision-record.md` and `close-record.md`.

**Delta frontmatter:** `concept` (target slug), `action` (`create | update | retire`), `source`
(the Phase 0 provenance ref), `date` (today), `title` (create only), `touches_added` /
`touches_removed` (omit if none). **Body sections** (omit any unchanged one — omission means
*unchanged*, never *clear*): `## Summary`, `## How It Works`, `## Invariants Added`,
`## Invariants Retired`, `## Decision Log Entry`.

**Binding rules (0003 §8.2/§8.3, §5):**

- **Every non-noop delta carries exactly one `## Decision Log Entry`.** A delta without a *why*
  is malformed. The entry body records the why **plus the refuted viable alternative** if one
  existed (guardrail: only a genuinely viable alternative a competent engineer might have chosen,
  never a strawman; if none existed, state only the why).
- **A concept the epic touched but did not behaviorally change gets no delta** — not an empty one.
- **§8.3 hard boundary** — page prose must contain **no code blocks, no file paths, no
  type/function names, no API/schema specs, no speculative or design-time-only claims**. Behavior
  in domain terms only. File paths go in the anchors sidecar (Phase 5), nowhere else.
- **Slug uniqueness (0003 §5) is a write-time precondition.** A `create` whose `concept:`
  collides with an existing **active** slug is malformed and must resolve to one of:
  **same concept** → make it an `update` of the existing page; **different concept** → take a
  distinguishing slug (e.g. `session-auth` vs `session-therapy`). Never overwrite, never merge
  two Decision Logs.
- **Every `touches` slug must resolve** to an existing active page or a page this same run
  creates. A touch pointing nowhere is dropped from the delta (no speculative stub pages).
- **Provenance** — per the Phase 0.5 resolution, everywhere a reference is written: in hub mode
  always the qualified `<owner>/<repo>#n` form (the terse `#n` never appears in a workspace
  drain's output); in single-repo mode `#n` for the home repo, qualified cross-repo.

# Phase 4 — Apply the deltas on a distill branch

1. Create the branch from the current main state:

    ```bash
    git checkout -b "distill/$(date +%Y-%m-%d)-<local-ids>"
    ```

2. **Apply entry-by-entry, one commit per queue entry** (this keeps the validator's
   one-new-Decision-Log-entry check exact when several entries touch the same page). For each
   entry, apply its deltas plus that entry's deterministic steps (Phase 5), validate, then commit.

3. **Applying a delta** (0003 §2, §8.2 semantics):
    - `create` → write the full page: frontmatter (`title`, `aliases`, `touches`,
      `last_updated_by: <source>`, `status: active`, `verification:` per below), H1 mirroring
      `title`, Summary lead (≤3 sentences, written to stand alone as a grep hit), `## How It
      Works` (≤180 words), `## Key Invariants` (≤7, numbered), `## Integration Points` (one
      bullet per `touches` slug: `- [slug](slug.md) — <nature of the interaction>`), and a
      `## Decision Log` seeded with exactly the delta's entry.
    - `update` → patch only the sections the delta carries; update `last_updated_by`; **append
      exactly one** Decision Log entry — never edit, reorder, or delete prior entries. A retired
      invariant is **struck through in place** (`~~...~~`), never deleted.
    - `retire` → set `status: deprecated`, append the Decision Log entry, `git mv` the page to
      `.nexus/concepts/_archive/`.
    - Decision Log entries are headed `### <YYYY-MM-DD> — <ref> — <short title>`.
    - Body stays under the **400-word cap** (excluding frontmatter + Decision Log); if the content
      doesn't fit, the concept is too broad — **split it into two pages, don't grow it**.
4. **Verification flag (R6):** every page this drain creates or updates gets
   `verification: verified` — the drain is reviewed (the distillation-PR) and grounded in shipped
   code. This includes flipping a pre-existing `unverified` (bootstrap/manual) page that a delta
   touches: re-check its body against the current code while patching it (C13: bootstrap pages
   are low-trust; the first touching drain re-validates them).

# Phase 5 — Deterministic steps (not judgment)

Run these for each entry, in order, before its commit:

1. **C11 `touches:` reciprocity fan-out.** A real interaction is bidirectional. For every delta
   with `touches_added: [X]`: on page X, add the delta's concept slug to `touches:`, add the
   mirrored Integration Points bullet, and append one Decision Log entry
   (`### <date> — <source> — Reciprocal link from <slug>`) recording the fan-out. For
   `touches_removed`, remove symmetrically (the removal is logged the same way). Fan-out edits
   land in the **same PR**, mechanically — no judgment call.

2. **R1 code-anchor refresh.** For **every** concept page this PR touches (including reciprocal
   fan-out targets), regenerate `.nexus/anchors/<slug>.md`. Anchors are **derived state**: the
   ONLY place file paths are allowed (pages still reject them), SHA-stamped, regenerable,
   **never hand-edited**. Derive each concept's anchors from the diff paths attributable to it,
   plus an alias-grep for pre-existing anchors — in single-repo mode over the home repo's source
   tree; in hub mode over the member checkouts of every repo in the entry's recorded range plus
   every repo already named in the concept's existing sidecar (a checkout missing during the
   grep: carry that repo's existing entries and SHA forward unchanged — never drop paths because
   a checkout is absent, and never fetch to find one).

   **Single-repo format (unchanged):**

    ```markdown
    ---
    concept: <slug>
    source_sha: <head SHA of the drained range>
    generated: <YYYY-MM-DD>
    ---

    <!-- DERIVED — regenerated by /nxs.distill on every drain touching this concept.
         Never hand-edit; stale anchors are rebuilt, not fixed. -->

    # Code Anchors: <Title>

    - `<path>` — <one-line role in the concept>
    ```

   **Hub format** — `source_sha` is a per-repo mapping (one `<repo>@<sha>` item per repo) and
   every path is qualified by its repo. `<repo>` is the normalized `host/owner/repo` identity —
   the exact string the close record's `range:` uses. The SHA for a repo in the entry's range is
   that repo's recorded **head** (full 40-hex); the SHA for a repo whose paths entered only via
   alias-grep is that member checkout's current `HEAD` (`git -C <checkout> rev-parse HEAD` —
   read-only). Every listed path is attributed to exactly one repo and every mapped repo has at
   least one path; a pre-existing scalar-form anchor a hub drain touches is regenerated whole
   into this shape:

    ```markdown
    ---
    concept: <slug>
    source_sha:
      - <host/owner/repo>@<full head SHA for that repo>
      - <host/owner/repo>@<full head SHA for that repo>
    generated: <YYYY-MM-DD>
    ---

    <!-- DERIVED — regenerated by /nxs.distill on every drain touching this concept.
         Never hand-edit; stale anchors are rebuilt, not fixed. -->

    # Code Anchors: <Title>

    - `<host/owner/repo>:<path>` — <one-line role in the concept>
    ```

3. **Select the invocation.** Steps 4 and 5 both branch on the run mode **already resolved once
   in Phase 0.3** — that check reads workspace resolution's own committed artifacts, never a new
   heuristic (e.g. never "no `package.json`"):

    - **hub**: run the bundle vendored at
      `.nexus/tools/` via plain `node`. Pass every page path and git ref as its own separate,
      quoted argument — never build the command by interpolating a shell string.
    - **single-repo**: keep today's `pnpm nexus:*` invocation, unchanged.
    - **member**: a member repo does not drain — Phase 0.3 already stopped the run before this
      point.

4. **Atlas regeneration.** Rebuild the human orientation page from the store's current
   state, using the invocation Step 3 selected:

   - Single-repo:

    ```bash
    pnpm nexus:generate-atlas
    ```

   - Hub:

    ```bash
    node .nexus/tools/generate-atlas.mjs
    ```

   `docs/concepts.md` is derived state (DERIVED header, script-owned) — regenerated
   whole, never hand-edited or prose-tweaked in the PR.

5. **Validator.** Run it over every page the entry changed (staged working-tree state vs the
   last commit), using the invocation Step 3 selected:

   - Single-repo:

    ```bash
    pnpm nexus:validate-concepts -- --base HEAD <changed-page-paths>
    pnpm nexus:check-atlas
    ```

   - Hub — each changed page **and anchor** path its own quoted argument, never
     shell-interpolated (in hub mode the regenerated anchor sidecars are validated too — the
     per-repo `source_sha` mapping shape is part of the contract):

    ```bash
    node .nexus/tools/validate-concepts.mjs --base HEAD "<changed-page-path>" "<changed-anchor-path>"
    node .nexus/tools/generate-atlas.mjs --check
    ```

    The first checks frontmatter completeness (0003 §2.1 + `verification`), the 400-word cap,
    `touches:` == Integration Points, exactly one new Decision Log entry per changed page,
    append-only log history, §8.3 rejections, and slug = filename. A path whose parent directory
    is `anchors` is checked as an anchor sidecar instead: `concept` = filename, a well-formed
    `source_sha` (single-repo scalar, or the hub per-repo `<host/owner/repo>@<sha>` list), and
    repo↔path attribution consistency. The second checks the
    atlas is in sync with the active pages. **Any finding from either command blocks the
    PR** — fix the pages (or regenerate the atlas) and re-run until both exit 0. Do not
    weaken, skip, or reinterpret a finding; the validator is the contract's mechanical half.

6. **Remove the consumed entry, then commit it together with its pages + anchors** so the deletion
   is atomic with the write on merge:

    ```bash
    git rm -r <entry-dir>
    git add .nexus/concepts .nexus/anchors docs/concepts.md
    git commit
    ```

   The entry leaves `.nexus/queue/**` only on this branch; main still holds it until the PR merges,
   and it stays recoverable via git history thereafter.

# Phase 6 — Checkpoint (before any GitHub write)

**STOP AND WAIT.** Render the delta digest as markdown first:

```
CHECKPOINT: Distillation-PR

Drained entries:
- <local-id> — <epic title> (<provenance ref>)

Concept deltas:
- <slug> — <create|update|retire> — <sections changed> — log: "<entry title>"
  ↳ reciprocity fan-out: <slugs, or none>

Anchors refreshed: <slugs>
Atlas: regenerated (docs/concepts.md)
Validator: PASS (<N> page(s))

Skipped (not closed): <local-id> — repo <owner/repo, hub mode only> — age <n>d [DRAIN-SLO BREACH if >30d]
Blocked (hub mode — diff underivable): <local-id> — repo <owner/repo> — age <n>d — <problem> [DRAIN-SLO BREACH if >30d]
(if nothing was skipped or blocked: "Skipped: none — every queue entry drained; no drain-SLO breaches")

About to: push the distill branch and open the distillation-PR.
Consumed entries are removed on the branch (in each entry's commit) — the deletion lands on main
only when the PR merges, atomically with the pages. Nothing is removed from main now.
```

Then ask via **`AskUserQuestion`**:

- **open PR** — proceed to Phase 7.
- **review** — print each delta (stored form) and each resulting page, then re-ask.
- **abort** — stop. Return to the original branch (`git checkout -`); leave the distill branch
  for inspection, and report that no PR was opened and no queue entry was touched.

# Phase 7 — Open the distillation-PR

```bash
git push -u origin <distill-branch>
gh pr create --title "distill: <epic title(s) or local-ids>" --body "<body below>"
git checkout -
```

The PR body is **review-oriented** — the reviewer is checking the *what*-abstraction and the
page-patch mapping (0007), so give them, per concept:

```markdown
## Distillation: <epic title(s)>

Drained queue entries: `<entry paths>` (provenance: <ref(s)>)

### <slug> — <create | update | retire>
- **What changed:** <one-paragraph summary of the page change>
- **Why (Decision Log entry):** <the entry's short title + one-line why>
- **Provenance:** <ref> (<link to the issue>)
- **Reciprocal edits:** <slugs, or none>

## Anchors refreshed (derived, never hand-edited)
- `.nexus/anchors/<slug>.md` @ <source_sha — single-repo scalar, or one `<repo>@<sha>` per repo in hub mode>

## Atlas regenerated (derived)
- `docs/concepts.md`

## Consumed queue entries (removed by this PR)
This PR already removes the drained entries on the branch, so the merge deletes them from main
atomically with the page writes — **no manual post-merge step**:
- `<entry-path>` (recoverable via git history)
```

# Phase 8 — Report completion

```
DISTILLATION-PR OPENED: <url>

Entries drained:   <n>  (<local-ids>)
Pages created:     <n>  (<slugs>)
Pages updated:     <n>  (<slugs>)
Pages retired:     <n>  (<slugs>)
Reciprocal edits:  <n>  (<slugs>)
Anchors refreshed: <n>
Validator:         PASS

Entries skipped (not closed): <list with ages, drain-SLO flags; hub mode adds each entry's
                               originating repo as <owner>/<repo>>
Entries blocked (hub mode — diff underivable): <list with originating repo, age, drain-SLO
                               flag, and the named problem per entry>
(if nothing was skipped or blocked: "Entries skipped: none — every queue entry drained; no
 drain-SLO breaches")

Consumed entries: removed on the branch — deletion lands with the merge (no post-merge step).
```

# Constraints

- **Never write `.nexus/concepts/` on main.** All page writes happen on the distill branch; the
  PR merge is the authoritative write (0007).
- **Consumed entries are deleted in the PR, never on main directly** — the `git rm` rides the
  distill branch so the merge removes them atomically with the page writes (0007: deletion is bound
  to the merge). **Never** touch an unclosed/undrained entry (C12: flag age, don't clean up).
  In hub mode the drain-SLO report covers every undrained hub-queue entry, attributed to its
  originating repo — and only the hub queue; member checkouts are never scanned for unmigrated
  entries.
- **No search when a path is given** — `$ARGUMENTS` resolves directly.
- **The diff is recomputed, never stored** (0006). In hub mode it is recomputed **only** from
  the close record's `range:` stamp inside the named member checkout; a missing checkout, an
  unreachable SHA, or a missing/malformed stamp is a hard per-entry error (report it, drain the
  rest) — the drain never falls back to the hub repo, never fabricates an empty or partial
  diff, and never clones, fetches, or mutates a member checkout.
- **No machinery**: no recipe/template files, no state file, no retrieval index (0003 §7 —
  glob/rg is the index; the `docs/concepts.md` atlas is a derived human-orientation page
  regenerated by this phase's atlas-regeneration step, never a retrieval surface). Idempotency
  is structural: entry presence = unconsumed.
- **Every changed page gains exactly one Decision Log entry per queue entry**; prior entries are
  never edited, reordered, or deleted.
- **§8.3 is a hard boundary** for pages: no code, no file paths, no type names, no API specs, no
  speculative claims. Paths live only in `.nexus/anchors/` (R1).
- **The per-user scratch dirs inside a queue entry are never a distill input** — never read,
  never mapped to a `ConceptDelta`. The `.nexus/queue/**` diff exclusion keeps them out of the
  *what*; this keeps them out of the *why*. They are deleted with the entry when the PR merges.
- **Reciprocity (C11), anchors (R1), and the validator are deterministic steps** — never skipped,
  never reinterpreted. A validation failure blocks the PR.
- **Provenance is qualified cross-repo** (`<owner>/<repo>#n`, 0003 §2.4). In hub mode every
  reference is qualified from the entry's recorded originating repo and the terse `#n` form is
  never emitted. In single-repo mode, verify the issue actually lives in the home repo before
  writing the terse `#n` form.
- The historical design workspace `libs/origin/v2/.nexus/` is **never written** — the live store
  is `.nexus/` at the repo root.

# Usage

```
/nxs.distill                                 # drain every closed entry in .nexus/queue/**
/nxs.distill .nexus/queue/fe205650/          # drain one specific entry
```
