---
title: "Close Record: Durable asset store for filed issues"
epic: "#594"
feature: "Issue Assets"
date: 2026-09-13
nexus_version: 0.45.0
analyze: ran 2026-09-13 @ 7124eed5b53643a5d277ea1950104fc238eeab1c
record: "#600"
record_hash: 93bf00552ee19fd085dfff95b097f1c071eef45412bacd68ab82f1506e7ae24a
range:
  - repo: github.com/sameera/nexus
    base: 4e0330a2da84bebd909c77da8e6763e761339368
    head: 93b3d5f237a9ff6a6467514924197d35582482ed
---

# Close Record: Durable asset store for filed issues

## Key Decisions

- **The asset modules live in `@nexus/delivery-config`, behind one `assets` verb with five
  subverbs.** The store is a publishing target read through that library's key catalogue and its
  precedence chain, and the library's filers already own the GitHub runner seam the publish step
  needs. Refuted alternative: a new `@nexus/asset-store` library with a bare `nexus asset-publish`
  verb beside `abs-doc-path`. That alternative would duplicate the runner and the io seams for three
  small modules.

- **A resumed run recovers its asset state from an `assets.json` sidecar in the draft folder, not
  from the draft's frontmatter.** Phase 4 stores the `nexus assets check` output verbatim, and a
  resumed run re-runs `check` on those paths to recover the store, the visibility and the declared
  list. The draft frontmatter is embedded onto the epic issue as its meta block, and the clean-body
  assertion scans every line of the filing body, so a declared local path in frontmatter would either
  fail the run or reach an issue body. Refuted alternative: persist the declared list in the draft's
  frontmatter, which the analyze receipt suggested first. Deriving the list from the draft's prose
  was also refused, because the assertion must fail on exactly the paths the lead declared, not on
  whatever the draft happens to mention.

- **The publish request travels in a temporary request file, never on the argument vector.** The
  file-contents endpoint receives the base64 content through `gh api --input`. A file near the 5 MB
  cap is far larger than a single command-line argument may be, so passing the content as an
  argument would fail on exactly the files the cap was written to permit.

- **An internal repository counts as private when the store's visibility is read.** The read asks
  GitHub for `isPrivate` alone, so an internal store takes the private branch of the approval
  digest's warning. That is the honest answer for the warning's purpose, which is telling the lead
  whether a reader outside the team sees the diagram.

## Deviation Rationale

- **Declared asset paths are matched as whole tokens, not as plain substrings (record #600, "The
  clean-body assertion fails on a surviving asset path").** The record says the assertion matches
  the declared paths exactly, which reads first as a plain substring match. The shipped rewrite and
  assertion require that no path character precede or follow the match. A plain substring match
  rewrote the address it had just written and then reported that address as a survivor: the
  published address of `assets/flow.png` under the feature `issue-assets` ends in
  `issue-assets/flow.png`. Exactness is kept and boundaries are added, so the decision holds and its
  literal reading is the part that moved.

- **The asset rewrite runs as its own step at the top of the post-approval phase, not folded into
  the sibling-reference rewrite (record #600, "Chosen Approach").** The record says each referenced
  asset publishes in the same post-approval step that already rewrites sibling story references into
  issue numbers. The shipped stage runs `nexus assets rewrite` on the derived epic filing body right
  after deriving it, and transcribes the story work-items from the rewritten body. The
  sibling-reference rewrite stays where it was. One rewrite step still runs, still after approval and
  still before the first issue exists, so the record's constraint holds. Transcribing the stories
  from the already-rewritten body is what places each reference in the issue whose section carries
  it, with no per-item bookkeeping. Refuted alternative: rewrite each story work-item and the epic
  body separately after transcription, which would publish per body and could publish an asset twice
  when a story body and the epic body both name it.

- **The record's ADDRESS risk check was not run (record #600, Risks).** The record asks for a live
  verification that a private-store blob address with the raw flag renders inline in an issue in
  another repository, before story #597 is implemented, and names a fallback to a plain link if it
  does not. Story #597 shipped the single-form design with no visibility branch, and nothing in the
  change set shows the verification ran. The lead accepted this at close as an open risk rather than
  a blocker. The design is unchanged and still rests on the record's assumption, so the verification
  and its fallback are deferred to their own issue rather than treated as settled.

## Waived Stories

none

## Deferred Scope

Deferred items filed as epic stub issues:

- #606 — Verify a private-store image renders inline in a cross-repo issue, and apply the
  plain-link fallback if it does not.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-13-issue-asset-store.md`
