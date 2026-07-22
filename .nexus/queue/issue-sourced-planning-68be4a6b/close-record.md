---
title: "Close Record: Issue-Sourced Planning: Nothing Commits Until Close"
epic: #114
feature: "Multi-Repo Workspaces"
date: 2026-07-22
analyze: overridden — 0 critical / 1 high finding; the high was the "4 of 5 story issues open" precondition, since satisfied (all 5 closed); analyze ran 2026-07-22 @ 7a4a67b; waived 2026-07-22
range:
  - repo: github.com/sameera/nexus
    base: e2b7d2c1eccdd399e82ca476c55594ba80feba42
    head: 7a4a67b70ddac2cd172020eb9dc0ccb9c1d0b1e6
---

# Close Record: Issue-Sourced Planning: Nothing Commits Until Close

## Key Decisions

- **The resolver is an nx lib (`@nexus/epic-resolve`) with a thin `nxs-epic-resolve` skill CLI, mirroring `@nexus/pr-worktree`, and reconstructs only the frontmatter fields recoverable from a bare epic issue — never fabricating the rest.** A bare issue does not carry `complexity`, `feature_path`, `slug`, `concepts`, or `complexity_drivers`, so the resolver emits `epic` title, `link` number, and `type` and omits the others rather than guessing. Refuted: having the resolver default or guess the missing fields — it would bake wrong values into every downstream stage (`hld` tiers on `complexity`), corrupting the reconstruction silently.
- **The materialized epic lives at a gitignored, issue-keyed repo-relative path, `.nexus/tmp/epic-<N>/epic.md`.** This satisfies the "outside version control" invariant (a resolver run leaves the tree reporting no new tracked file) while still being at a predictable path a downstream stage can find, deterministic per issue number. Refuted: an OS temp dir (`os.tmpdir()`) — also untracked, but not discoverable at a stable repo-relative path across separate stage invocations.

## Deviation Rationale

- **The filing skill was extended (not merely reused) with a hidden `<!-- nexus:epic-meta -->` block.** The decision record's model assumed the GitHub issue already carried everything the resolver needs and that the existing filing skills were reused as-is. In fact `nxs_gh_create_epic.py` strips the epic frontmatter when it builds the issue body, so the stripped planning fields would be unrecoverable. The skill now embeds the raw frontmatter verbatim in an HTML comment (invisible in the rendered issue), and the resolver lifts it back out — falling back to recoverable-only fields for a hand-filed epic that has no such block. Why: Story 2's AC "fully re-resolvable from its issue number alone" requires the stripped fields to round-trip; a body machine-block is lossless and mirrors the existing `<!-- nexus:analyze-receipt -->` precedent, where mapping the fields onto labels/project fields would not (`feature_path`/`concepts`/`complexity_drivers` have no clean mapping).
- **A cross-epic roadmap was committed to the queue root as `.nexus/queue/sequencing.md`.** No story called for it; it is an 86-line roadmap sequencing the file→issue backlog waves rooted at #114. Why: it is a deliberate, actively-maintained planning artifact — not disposable scratch — that simply landed in the wrong directory. `.nexus/queue/` is the distiller's drain buffer (closed epic entries, deleted on distill), which is no home for a living roadmap. It is inert where it was (the distiller globs entries, not loose root files), but the location is a latent surprise. **Resolution:** relocated to `docs/delivery/sequencing.md` — the delivery-planning space alongside the lessons it will feed — during this close (staged rename, not yet committed).
- **`nxs.distill.md` was relaxed to read `decision-record.md` only "if present."** Invariant 17 described the distiller finding "a complete entry (materialized epic plus close record)"; a born-at-close issue-sourced entry (#114's own successors) carries no committed decision record until the durable record home (`hld-subissue-record`) lands. Distill now falls back to the close record's prose (Key Decisions + Deviation Rationale) for the *why* when no record is present. Why: distill must not hard-fail on the absent record (Story 5 AC3 — the distiller must drain the born-at-close entry). Refuted: writing a placeholder `decision-record.md` at close — that would fabricate a record; the close record already carries the mined *why* and distill degrades cleanly.

## Deferred Scope

Deferred items appended to: `docs/features/multi-repo-workspaces/backlog.md`

This epic's deferred scope (the Out-of-Scope stubs: `hld-subissue-record`, `nxs-pr-command`,
`story-analyze-hub`, `epic-analyze-receipt`, `hub-close-multi-pr`, `multi-range-distill`,
`legacy-flow-retirement`, `pipeline-gh-cli`, and the pinned approved-baseline / snapshot-at-approval
mechanism) was appended to the backlog at planning time. Nothing new was deferred at close.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-22-issue-sourced-planning.md`
