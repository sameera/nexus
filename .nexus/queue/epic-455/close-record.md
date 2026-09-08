---
title: "Close Record: A roadmap resolves, and an interview establishes the learner's starting point and focus"
epic: "#455"
feature: "Roadmap-Driven Learning"
date: 2026-09-08
nexus_version: 0.7.0
analyze: "ran 2026-09-08 @ 1cdd45c (local receipt; PR 479 carried no machine block) — stale: 7 commit(s) unanalyzed, none touching this epic's code; waived 2026-09-08"
record: "#478"
record_hash: 7ae7eb7777319e660dfeb8aabc94c33891ba0ff9c2df40a85cf6b3fac766dc4f
range:
  - repo: github.com/sameera/nexus
    base: 4124a5309400bfacba33e1c7418bf029a8eb60c3
    head: 0dc96c2dcb60010ca06c198a30d842de253b3a0c
---

# Close Record: A roadmap resolves, and an interview establishes the learner's starting point and focus

## Key Decisions

- **The roadmap takes the epic resolver's structured result, never the `epic.md` markdown it also
  returns.** `resolveEpic` now returns the epic it read — number, title, stories, edges — beside the
  rendered document, and `roadmap.ts` builds from that. The first implementation parsed the markdown
  back out, which held record #478's invariant 5 in name only: a story body is a whole issue body and
  a real one carries its own `## Acceptance Criteria` heading, which in the rendered document is
  indistinguishable from the epic's next H2 section, so every real story body was silently truncated
  at its first sub-heading. Refuted alternative: teaching the parser where the stories region ends by
  tracking the `## User Stories` block. It keeps the resolver's return type untouched, but it is a
  second reader of the serializer's layout that drifts the moment the layout moves — the exact drift
  invariant 4 exists to prevent.

- **Resolution is a subverb of `nexus workbook`, not a verb of its own.** `nexus workbook roadmap
  [<name>] --epic <n> | --query <expr>`. The record has resolution create the workbook before anything
  is asked, so resolution and the workbook share one surface and one placement rule. Refuted
  alternative: a top-level `nexus roadmap` verb, which would have to re-resolve the workbook home
  itself.

- **The interview slate is a module constant, not a slate derived per roadmap.** `interviewSlate()`
  takes no argument and returns the same five slots for every roadmap. This makes "no question asks
  for anything the roadmap already holds" a property of what the stage is *able* to ask, which a test
  can assert, rather than a hope about generated wording. Refuted alternative: selecting the slate
  from the roadmap's material — skip the testing slot when no slice is test-first. It fits the
  roadmap better but reintroduces the untestable generation the record refused.

- **The agent's contribution arrives as an answers file, not as CLI arguments.** `nexus workbook
  interview <name>` prints the slate; `--answers <file>` records what came back, mirroring `teach
  --prose <file>`. Free-text answers are multi-line and the surface already has this shape for the one
  other place an agent contributes prose. Refuted alternative: repeated `--answer slot=text` flags,
  which cannot carry a paragraph and would put a learner's words in a shell history.

- **A named focus records `stories: null`, not an empty list.** `focus.stories` holds every story
  number when the whole roadmap is in focus and `null` when the learner named one. Which slices fall
  inside a named focus is #457's judgement, and an empty list here would read as "nothing is in
  focus" — the exact misreading invariant 19 exists to prevent. Refuted alternative: omitting the
  field when a focus is named. Smaller record, but absence would then mean two different things.

- **The shared reference set is declared, not inferred from the overlap.** `SHARED_REFERENCES` names
  what both phases load, and the check compares each body against that constant. Inferring "shared"
  from the two sets overlapping makes a planning body that wrongly declares a lesson-writing reference
  look like a body sharing one — the exact failure the check exists to catch. Refuted alternative:
  treating any reference in both sets as shared, which needs no constant but is silently
  self-defeating.

- **The reference set is frontmatter, not prose the check greps for.** Each command declares `phase:`
  and a `references:` list in its YAML frontmatter. The record asks that the phase boundary be
  verified by inspecting each entry point's declared set, and a declared list is readable without
  guessing at prose. Refuted alternative: deriving the set from the skills each body mentions, which
  needs no new field but cannot tell a reference the body loads from one it merely names in passing.

- **Record #478's invariant 2 was revised rather than worked around.** As approved it enumerated three
  write locations, and the stage also writes the learner-folder ignore rule — which the record's own
  "resolution creates the workbook before it asks anything" decision requires. It was an incomplete
  enumeration, not a divergent build, so the record was revised to name that write and the code was
  left alone. The stamped `record_hash` above is the revised body.

## Deviation Rationale

- **The too-wide-query refusal names no count (deviates from #478's "A query-resolved roadmap is
  capped at ten epics and one target repository", which decided the refusal "names the count").**
  The search is asked for exactly one row past the cap, so the row count that comes back is a floor
  rather than a total: a query matching fifty epics and one matching eleven return identical result
  lengths. Naming a count would therefore report the fetch limit back to the learner as if it were
  their own result. The shipped refusal says "more than ten", which is the whole of what a limited
  search establishes. The refuted alternative — fetching without a limit so the count is true — costs
  a full result set on exactly the query already known to be too wide.

- **The phase-boundary check runs in both directions and inspects each body's text, beyond #478's
  "verified by inspecting each entry point's declared set".** The check as first built ran only
  planning-against-lesson, which is the reverse of the ordinary flow: planning finishes and lesson
  writing begins, so a lesson body naming a planning reference is the case story #474's re-filed
  criterion actually describes. It now runs both directions, and a reference both phases declare
  without being a shared one is its own problem. This extends what the record left unstated rather
  than contradicting it. The refuted alternative — leaving the check one-directional because the
  authored tree happens to satisfy the other direction — pins nothing and lets the next edit break it
  silently.

- **Epic #407's drift gate was relaxed inside this epic with no acceptance criterion covering it
  (sanctioned by #478, not called for by any #455 story).** `teaching-plan.ts` and `workbook-plan.ts`
  now count closure as drift only when it happens after the plan pinned the story. Record #478 decides
  this explicitly and its ADDRESS risk required it to land before a roadmap of already-delivered
  stories could be taught, but no story in this epic carries an AC for it, so it is a change to a
  neighbouring epic's delivered behaviour that this epic's own surface does not describe. Under the
  gate as built, every slice of a roadmap resolved from a completed epic was blocked at teaching time,
  which made the whole entry point useless for shipped work.

## Deferred Scope

none

Record #478 leaves two things explicitly deferred that remain unfiled by choice at close:
cross-repository roadmaps, and a system standards note on the per-epic issue-graph round-trip budget.
Both stay recorded in the record itself rather than as stub issues. The epic's four Out of Scope items
were already filed at planning as #456, #457, #458 and #459.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-08-roadmap-resolution-and-learner-interview.md`
