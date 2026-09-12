---
title: "Close Record: The epic-classification and cross-kind collision refusals move into nxs-landed-reference"
epic: "#515"
feature: "Landed Change Intake"
date: 2026-09-12
nexus_version: 0.34.0
analyze: ran 2026-09-11 @ ecede36d91c1dc55d7bee591d69fe89426786af6
record: "#544"
record_hash: db09aaa1574f4495765bb541508645c80ab36f5969410229ec3d1d25f8cd1c77
range:
  - repo: github.com/sameera/nexus
    base: d01de2be8dc234aef8fe3d5924a5b588d5468760
    head: ba24f5ee9f0745474e583de1b3596d2444b5c1ca
---

# Close Record: The epic-classification and cross-kind collision refusals move into nxs-landed-reference

## Key Decisions

- **Section E was built in two halves across the three stories, not written whole in the first
  one.** Story #541 added only E.1 — the epic-classification refusal and the foreign-kind collision
  — and story #543 added E.2, the same-kind reconciliation, as an extension of the same section.
  E.2 needs the qualified reference and a per-lane refusal condition that story #543 itself defines,
  so building it in #541 would have guessed at #543's shape before it landed. *Refuted:* write the
  full two-point section in #541, since record #544 frames it as one shared section — rejected
  because #541's acceptance criteria cover only the refusal content, and the blocked_by graph lets
  #542 and #543 both build on #541 without E.2 existing yet.

- **The intake lane's extra rewrite-refusal reads the occupying entry's existing `## Deferred
  Scope` prose rather than a new frontmatter field.** Invariant 14 requires the refusal but does not
  say how the filed issues are detected. The close record's Deferred Scope section is already the
  pipeline's source of truth for filed issue numbers, so a second structured field would duplicate
  a fact one file already states, with no invariant tying the two together if they disagreed.
  *Refuted:* add a `deferred_scope_filed: true` key to the entry's `epic.md` for a cheaper machine
  check — refused because it is a new fact to keep in sync, for a check that only ever runs against
  an entry this same lane wrote.

- **Each of the three story commits carries its own version bump and CHANGELOG entry, rather than
  one bump after all three landed.** The repository's contributor rule ties the bump to a
  components change in the same commit as the change, and each story independently alters
  adopter-visible stage behaviour, so each commit needs its own signal to stay self-contained and
  bisectable. *Refuted:* one bump in the final commit covering all three — refused because it
  leaves the first two commits with component changes and no version signal, the exact drift the
  rule exists to prevent.

- **On merging the trunk, this branch's three unreleased versions were renumbered up one minor
  rather than renumbering the trunk's.** The trunk shipped its own 0.31.0 while this branch was
  open, so that number is taken; this branch's entries became 0.32.0, 0.33.0 and 0.34.0. *Refuted:*
  keep this branch's numbers and move the trunk's 0.31.0 — refused because that entry is already on
  the trunk and may already be tagged, so its number is not this branch's to move. The later Section
  E clarification was folded into the still-unreleased 0.33.0 rather than taking a patch version of
  its own, since no adopter had yet seen a Section E without it.

- **The pre-existing store-level concept-page capacity failure was left alone rather than cleared
  to make the suite exit zero.** The concept-page capacity contract forbids dropping or compressing
  an interaction under neighbour-list pressure, and treats page degree as watched rather than
  limited. The bullet-count trigger is a prompt for a human revisit, which is the lead's call, not
  an epic-515 code fix. *Refuted:* trim a bullet, or raise the revisit trigger, to get a green run.

## Deviation Rationale

- **Both command files cite "Section E" whole at the first application point, where invariant 2 of
  record #544 asks each to name which point of the shared section it applies.** Each lane correctly
  cites Section E.2 at the second point but only Section E at the first, which as written also
  encloses E.2. Section E's own preamble binds E.1 to "right after Section B" and E.2 to "right
  after Section D", and both call sites name E.1's content in prose, so no reader is misdirected.
  The imprecision survived because the section was built in two stories: when story #541 wrote the
  first call site, E.1 *was* the whole of Section E and the citation was exact, and story #543 added
  E.2 beneath it without revisiting the earlier call sites. Analyze judged it low and non-blocking.

- **Section E makes the directory position decide the epic kind, where record #544 decided the
  recorded kind and not the directory name decides what an entry is.** The shipped section states
  that an absent `entry_kind` under `epic-<n>/` means epic. Record #544 left this unstated: its
  invariant 1 requires the fix lane's epic-materialization refusal to keep its trigger unchanged,
  but the resolver writes no `entry_kind` on an epic entry, so a purely recorded-kind lookup could
  never identify one and the refusal would silently stop firing. The reading closes a gap the record
  left open rather than reversing a choice it made, and it matches how the analyze and distill stages
  already read an epic entry. Added in commit `e1fd62a`. An unreadable entry still occupies its slot,
  so the original trigger survives in full.

## Waived Stories

none

## Deferred Scope

Deferred items filed as epic stub issues:

- #553 — a rewritten intake entry carries its already-filed deferred-scope issues forward instead of refusing

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-12-landed-reference-shared-refusals.md`
