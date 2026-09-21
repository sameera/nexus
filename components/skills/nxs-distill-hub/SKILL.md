---
name: nxs-distill-hub
description: The hub-workspace contract of /nxs.distill. Read it only when that stage has resolved its workspace shape as hub, from the workspace manifest a hub checkout carries.
---

# nxs-distill-hub

`/nxs.distill` resolves its workspace shape before it reads any shape-specific instruction. This
file is what it reads when that shape is **hub**, and nothing else reads it. A single-repo checkout
never reads it, and a member checkout never reaches it: the base stage stops a member run at
run-shape resolution.

Every rule below is keyed to the base stage's own phase numbering and overrides the base stage at
that number. The base stage's phase order and numbering are unchanged, and a phase this file does
not name runs exactly as the base stage states it.

Nothing here writes to GitHub, the concept store, the queue or a branch on its own. Branch creation,
the checkpoint stop and the pull-request opening stay in the base stage.

## Input Resolution 3 — the drain-SLO report spans the whole hub queue

Every undrained entry (skipped-not-closed and blocked-underivable alike) is listed, and each is
**attributed to every distinct repo its `range:` list names** (epic #214, story #508). Never
attribute only to the first entry's repo; that attributes an entry that shipped over several pull
requests to whichever repo was stamped first. List every distinct, host-stripped `repo` (e.g.
`acme/web-app`) across the entry's `close-record.md` `range:` list, in the order they first appear.
When the entry carries no close record yet, list the hub repo itself: an unclosed hub-queue entry is
the hub's own, because migration happens only at close, after the close record is written. **Age is
one figure per entry, never one per repo or per range entry**. Measure it as today, from the
introducing commit. For a migrated entry that commit *is* the migration commit, so age measures how
long the entry has been drainable in the hub queue. Drain-SLO is measured against the hub queue
only. Never scan member checkouts for closed-but-unmigrated entries; that is migration-lag, owned by
close-entry-migration / workspace-status, not this report. A **blocked** entry (Phase 1, Exit 1)
names the specific range entry that could not be resolved, with its repo, base and head, and the
class token the reader reported, not merely the entry as a whole.

## Phase 0.4 — skip the merge precondition

The merge precondition does not run. A hub entry arrived by migration and is processed from the hub
trunk; migration-lag is a drain-SLO concern (Input Resolution 3), not this gate.

## Phase 0.6 — every provenance reference is qualified

Every provenance reference is the **qualified `<owner>/<repo>#n` form**, resolved deterministically
from the entry's recorded originating repo (epic #214, story #508; this is no longer positional).
When the entry's `range:` list names exactly **one** distinct repo, that is the originating repo.
Strip the leading host segment and append the epic's `link` number: `github.com/acme/web-app` + `#3`
→ `acme/web-app#3`. No network round-trip is needed, because the recorded repo is ground truth. When
the list names **more than one** distinct repo, probe each named repo for the epic's issue number
(`gh issue view <link> -R <owner>/<repo> --json title`) and require **exactly one** title match.
When that is not decisive (zero matches, or more than one), ask the lead via `AskUserQuestion` which
repo the epic issue lives in. Never guess, and never default to the first-named repo. The terse `#n`
form is **never emitted** here: in a hub the issue never lives in this stage's own repo, so a terse
reference would resolve against the wrong repo. Use the resolved qualified form everywhere a
reference is written: page frontmatter `last_updated_by`, Decision Log headings, and the PR body.

## Phase 1 — the diff reader is told the hub root

Pass the hub root as its own quoted token beside the entry:

```bash
nexus derive-entry-diff --entry "<entry-dir>" --hub "<hub-root>"
```

Everything else about the derivation — the exit contract, the blocked-entry outcome, the closed set
of class tokens — is the base stage's, unchanged.

## Phase 3 — the qualified form is the only provenance form written

The terse `#n` never appears in a workspace run's output.

## Phase 5.2 — anchor sources and the per-repo `source_sha` mapping

Grep over the member checkouts of every repo in the entry's recorded range plus every repo already
named in the concept's existing sidecar. For a checkout missing during the grep, carry that repo's
existing entries and SHA forward unchanged. Never drop paths because a checkout is absent, and never
fetch to find one.

Per-path attribution is written in the repo-qualified form `<owner/repo>#<pr>`, e.g.
`- \`src/x.ts\` — validates the request shape (acme/web-app#512)`.

`source_sha` is a per-repo mapping (one `<repo>@<sha>` item per repo) and every path is qualified by
its repo. `<repo>` is the normalized `host/owner/repo` identity, the exact string the close record's
`range:` uses. The SHA for a repo in the entry's range is the **newest** of that repo's drained
heads: the last entry in the ancestry order the reader already resolved, not merely "the" recorded
head now that a repo can carry several. It is the full 40-hex SHA. The SHA for a repo whose paths
entered only via alias-grep is that member checkout's current `HEAD`
(`git -C <checkout> rev-parse HEAD`, read-only). Every listed path is attributed to exactly one
repo, **its own, never another repo in the same range list**, and every mapped repo has at least one
path. A pre-existing scalar-form anchor a hub run touches is regenerated whole into this shape:

```markdown
---
concept: <slug>
source_sha:
  - <host/owner/repo>@<newest drained head for that repo>
  - <host/owner/repo>@<newest drained head for that repo>
generated: <YYYY-MM-DD>
---

<!-- DERIVED — regenerated by /nxs.distill on every drain touching this concept.
     Never hand-edit; stale anchors are rebuilt, not fixed. -->

# Code Anchors: <Title>

- `<host/owner/repo>:<path>` — <one-line role in the concept>[ (<host/owner/repo>#<pr>)]
```

## Phase 5.3 and 5.5 — the anchor sidecars join the validation set

The regenerated anchor sidecars are validated alongside the pages, because the per-repo `source_sha`
mapping shape is part of the contract. Name their paths beside the changed page paths, each as its
own separate, quoted argument.

## Phase 5.6 — the atlas path is the resolved one

The atlas path Step 4 reported is used verbatim, so a hub run never recreates a `docs/` folder it
does not use.

## Phases 6 and 8 — the skipped/blocked surfaces carry the originating repo

The run summary's `skipped` / `blocked` value carries each entry's originating repo alongside its
local id, age and drain-SLO flag. The checkpoint renders it as
`repo <owner/repo>`, and the completion report adds each entry's originating repo as
`<owner>/<repo>`. The zero case and its unqualified labels are the base stage's, unchanged.

## Phase 7 — the anchor line names the per-repo mapping

The PR body's refreshed-anchors line renders `source_sha` as one `<repo>@<sha>` item per repo.
