---
title: "Decision Record: Distill Across a Multi-Repo Workspace"
epic: #54
feature: "Multi-Repo Workspaces"
rating: M
concepts: [distiller, code-anchors, provenance-reference, workspace-resolution, close-entry-migration, committed-queue, portable-tooling]
date: 2026-07-15
---

# Decision Record: Distill Across a Multi-Repo Workspace

## Summary

This epic makes the distiller workspace-aware when it drains from a hub docs repo, leaving single-repo
behavior untouched. The drain's judgment is unchanged — it still maps a diff plus the human records to
per-concept deltas — but it now sources the *what* correctly across repos: each entry's diff is
recomputed from its recorded repo and SHA range inside the right member checkout, anchors and provenance
are qualified by repo, and one pass reports drain health for the whole hub queue. The whole change hangs
off a single gate on hub-manifest presence, layered over the four behaviors that today wrongly assume the
queue and the code share one repo.

## Chosen Approach

Branch the four behaviors — diff derivation, anchor source SHAs, provenance form, and drain-SLO
reporting — on one condition: whether the hub manifest is present, reusing the committed artifact and
presence check the command already uses to select its deterministic-step runner. With no manifest, every
path is exactly today's single-repo code. With the manifest present, the distiller stops treating its own
repo as the code repo: it consumes the member-to-checkout resolution the workspace resolver already
produces, recomputes each entry's diff from the recorded range inside the named member's sibling checkout
(one diff per repo when a range spans repos), stamps each anchor path with its repo's head SHA, defaults
provenance to the qualified form drawn from the entry's recorded originating repo, and aggregates the
drain-SLO report across every originating repo in the hub queue. The drain only ever reads a member
checkout — it never clones, fetches, or mutates one.

## Key Decisions

### One mode gate on hub-manifest presence, not "always workspace-aware"

- **Decision:** Gate all four new behaviors on the presence of the hub manifest — the same committed
  artifact and presence check the command already uses to pick its validator/atlas runner. Absent the
  manifest, the command runs unchanged. The coarse hub/single branch is a presence test only; the actual
  workspace context a member needs (member list, each member's expected sibling-checkout name) is consumed
  from the workspace resolver, never re-derived by the distiller.
- **Why:** workspace-resolution is the sole producer of workspace context, and its contract already
  guarantees single-repo behavior is unchanged when neither artifact is present. Gating on manifest
  presence keeps that guarantee structural — single-repo installs execute today's path unchanged, so this
  epic's blast radius is confined to hub drains — and it reuses the invocation-selection step the command
  already performs, introducing no second, drifting notion of "are we in a hub".
- **Refuted alternative:** Make the command always workspace-aware and treat single-repo as a workspace of
  one. Viable, and it collapses two code paths into one. It lost because it forces resolver and
  member-checkout machinery onto every single-repo drain for no benefit to those users, and it discards
  the introducing-commit diff path (correct and cheap in single-repo) — breaking the documented
  "single-repo unchanged" guarantee to buy uniformity nobody asked for.

### Recorded-range diff in the member checkout; drop the introducing-commit path in hub mode

- **Decision:** In hub mode, derive each entry's diff solely from the close-record's recorded range,
  computing the diff between each recorded base and head inside that repo's resolved sibling checkout — one
  diff per repo when the range spans repos, each repo's paths attributed only to that repo, and the queue
  folder excluded from behavioral analysis as today. The introducing-commit path is not used in hub mode. A
  member checkout that cannot be resolved, a recorded head SHA absent from the resolved checkout, or an
  entry with no usable recorded range is an explicit hard error for that entry, naming the repo and the
  expected checkout path (or the unreachable SHA / missing stamp). The drain never falls back to the hub
  repo, never fabricates an empty diff, never derives a partial diff, and never fetches or clones to make a
  SHA reachable.
- **Why:** After migration the entry no longer shares history with the code, so the recorded range is the
  only recomputable ground truth — and close-entry-migration stamps it for exactly this. In a hub the
  entry's introducing commit is the *migration* commit, so the old priority-1 path would return the
  migration's file moves: a confidently wrong diff. The recorded SHAs only resolve inside the member
  checkout. The read-only, no-fetch stance honors the resolver's own read-only contract and keeps the drain
  from needing member remotes or network auth, and hard-stop-no-fallback directly kills the silent
  empty-diff failure the epic names as the core bug.
- **Refuted alternative:** Keep the existing priority order — try the introducing-commit diff first, fall
  back to the recorded range. Viable as the smallest change and the most reuse. It lost because in a hub the
  introducing commit is always the migration commit, so the "try first" branch is not a safe fast path — it
  is a wrong answer that would win. The recorded range must be authoritative in hub mode, not a fallback. (A
  further alternative — fetch the member SHAs into the hub repo to avoid needing the sibling checkout — lost
  for violating read-only resolution and requiring network and remote auth in a docs-only hub.)

### Per-repo source-SHA mapping on anchors, not a single SHA

- **Decision:** Replace the anchor sidecar's single source SHA with a per-repo mapping: each anchor path is
  qualified by its member repo, and the file records that repo's head SHA as its source SHA. A concept whose
  code spans two repos records a distinct SHA per repo, with every listed path attributed to exactly one
  repo. Anchors stay fully derived — regenerated whole from the per-repo diffs plus alias-grep, never
  hand-edited — and the new shape must pass the portable validator, whose anchor check must accept the
  mapping. This is a format change within Story 2's scope, not a new task.
- **Why:** Once code lives in members, a single SHA against the hub is meaningless — the hub has no code —
  and one SHA cannot say that path X sits at revision A in one repo while path Y sits at revision B in
  another. A reader jumping from an anchor to source must be able to check out the right revision per path;
  only a per-repo mapping supports that. The per-repo head SHAs fall out of the per-repo diffs, so the input
  is already present.
- **Refuted alternative:** Keep a single source SHA set to the "primary" (e.g. first-listed) repo's head.
  Viable and zero format change. It lost because it is wrong for any cross-repo concept: the other repo's
  paths get stamped with a SHA from a different repo, pointing a reader at a revision where those paths may
  not exist — defeating the anchors' ramp-up purpose and failing the epic's own metric that every path carry
  a repo-qualified SHA.

### Qualified provenance as the hub-mode default, resolved from the recorded repo

- **Decision:** In hub mode, default every provenance reference (page attribution, Decision Log heading, PR
  body) to the qualified `<owner>/<repo>#n` form, resolved from the entry's recorded originating repo, and
  never emit the terse `#n` form. In single-repo mode, keep terse `#n` as the default, unchanged. This
  inverts today's logic — terse default, qualify only on an issue-title mismatch — but only on the hub
  branch.
- **Why:** In a hub the issue never lives in the drain's own repo, so a terse reference resolves against the
  hub and points at the wrong issue — exactly the case provenance-reference requires qualification for. The
  originating repo is already recorded on the entry, so qualification is deterministic. That lets the hub
  path drop the fragile, network-dependent issue-title probe (which existed only to catch imported entries)
  and use the recorded repo as ground truth.
- **Refuted alternative:** Keep the existing title-probe — check the issue in the drain's own repo, qualify
  only on a title mismatch — and let it happen to qualify in a hub. Viable with no logic change. It lost
  because in a hub the probe runs against a repo that does not own the issue, so a coincidental title match
  would pass and emit a wrong terse reference; and it spends a network round-trip per entry for information
  the recorded repo already gives, for free and correctly.

### Drain-SLO across the whole hub queue; still no auto-delete

- **Decision:** One hub drain reports every undrained entry in the hub queue, each attributed to its
  recorded originating repo, with its age and a breach flag past 30 days; a fully drainable queue shows zero
  skips and no flags. Drain-SLO is measured against the hub queue only — the entries that have actually
  landed there. Undrained entries are never auto-deleted; an old undrained entry is a breach to report, not
  to clean up.
- **Why:** The hub queue is the single surface where migrated entries land, so one hub scan sees the whole
  workspace's drain health, replacing the repo-by-repo view. Attribution comes from the already-stamped
  originating repo. Scoping the SLO to the hub queue (not to member disks) is deliberate: it measures what
  has actually become drainable and keeps the report independent of every member's checkout state. The
  no-auto-delete rule holds because the distiller only ever deletes an entry as part of the merge that
  consumes it; auto-deleting a stale entry would destroy an un-distilled record.
- **Refuted alternative:** Also scan member checkouts for closed-but-not-yet-migrated entries, so the report
  is "complete". Viable and arguably more useful, since it would surface entries stuck before migration. It
  lost because that is a different failure — migration-lag, owned by close-entry-migration / workspace-status
  — it re-derives workspace shape the resolver already owns, and it couples drain health to every member's
  disk. The epic scopes it out for exactly these reasons.

## Constraints & Invariants

1. The workspace-aware behaviors activate only when the hub manifest is present; with no manifest,
   single-repo diff derivation, anchors, provenance, and reporting are unchanged.
2. The coarse hub/single branch is a manifest-presence test only; member-to-checkout resolution (member
   identity, expected sibling-checkout name) is consumed from the workspace resolver, never computed by the
   distiller.
3. In hub mode an entry's diff equals the diff between its recorded base and head inside the named member's
   checkout (identical file/hunk set), with the queue folder excluded from behavioral analysis.
4. A recorded range spanning repos yields one diff per repo, each computed in that repo's own checkout; no
   path is attributed to the wrong repo.
5. A missing member checkout, an unreachable recorded head SHA, or a missing/malformed recorded range is an
   explicit hard error for that entry, naming the repo and expected path (or the unreachable SHA / missing
   stamp); the drain never falls back to the hub repo, never fabricates an empty or partial diff, and never
   clones, fetches, or otherwise mutates a member checkout — it reads only.
6. Every anchor path carries a repo-qualified source SHA; a concept spanning two repos records a distinct
   SHA per repo, and every listed path is attributed to exactly one repo.
7. Anchors are regenerated whole from the per-repo diffs plus alias-grep, never hand-edited, and the
   per-repo mapping shape passes the portable validator.
8. A hub drain emits only the qualified `<owner>/<repo>#n` provenance form, resolved from the recorded
   originating repo; the terse `#n` form never appears in a workspace drain's output, while single-repo
   drains still default to terse `#n`.
9. Drain-SLO is measured against the hub queue only; scanning member checkouts for unmigrated entries is out
   of scope.
10. Undrained entries are never auto-deleted; a >30-day entry is flagged as a breach and left in place, and
    the distiller deletes an entry only as part of the merge that consumes it.

## Risks (BLOCKER / ADDRESS only)

- **ADDRESS — hub-queue entries lacking a usable recorded range:** Hub mode drops the introducing-commit
  fallback, so an entry with no well-formed `range:` stamp (e.g. one closed before range-stamping shipped,
  or a malformed stamp) has no automatic diff source. The epic *assumes* every migrated entry carries the
  stamp, so this is the legacy edge. Resolved here consistent with invariant 5 and the no-silent-fallback
  rule: treat it as an explicit hard error for that entry that names the missing stamp, rather than
  fabricating a diff or prompting for a range (a prompt would also have to demand the repo, since the
  checkout to run in is not otherwise known). The range read is either present-and-well-formed or not, so
  the command can assert it up front per entry.

## Open Clarifications

<!-- none -->
