# Rationale accounting for the retired sequencing page

Every rationale line in the retired sequencing page, and where it went. Nothing is unaccounted for.

## Moved onto an open stub

| Page location | Line | Destination |
|---|---|---|
| Wave 1 "Why first" | cheap de-risking, came in cheaper than sized, no longer a Wave 3 blocker | #132 |
| "The one decision behind all of it" | #114 supersedes migrate-at-close and the interim hub-born-at-planning model (#109); consequence — #49 and #54 become the legacy path this stub retires | #215 |
| Wave 4 row + prose | can start once its own dependency lands, in parallel with the Wave 3 tail — not on the chain | #216 |

## Already present on the stub — verified, not duplicated

| Page line | Where it already lives |
|---|---|
| #213 absorbs the producer side of #209 | #209 body ("The per-story multi-entry stamping seam is absorbed by…") and #213 body ("Absorbs the producer-side seam of…") |
| #211 must reconcile where its per-story analyze record lands | #211 body, note (2026-07-21) |
| Run #157 first — it makes the scratch #211 reads non-empty | #211 body, note (2026-07-27) |
| #216 turns each state transition into an idempotent `nexus` verb + CI-callable gate | #216 body, opening paragraphs |
| #215 deletes the member choreography and the migration helper, leaving the distillation-PR merge as the only cleanup | #215 body, opening paragraph |

## Expressed as a `blocked_by` edge — not restated as prose

Verified live on 2026-09-04; every wave edge the page described survives on the issues.

| Edge | Page wording |
|---|---|
| #211 blocked_by #114 | Wave 3 table |
| #212 blocked_by #211 | Wave 3 table + "hard dependency chain" |
| #213 blocked_by #212 | Wave 3 table |
| #214 blocked_by #213 | Wave 3 table |
| #215 blocked_by #213, #214 | Wave 4 table |
| #216 blocked_by #139 | Wave 4 table ("can start once Wave 2 lands") |
| #132 blocked_by none | Wave 1 table |
| #209 blocked_by #54 | not described by the page |

## Dropped — the item is closed

#114, #121 (Wave 1 rows), #139 (Wave 2 row and prose), #157 (Wave 3 row and prose), #109 ("pulled out of the line"). A closed item's ordering no longer informs any decision.

## Belongs to #403, not here

The "Pulled out of the line" verdicts on #197, `hub-design-gate` and `entry-abandonment` are issue-state changes, handled by the sibling story.

## Dies with the page

The header pointer ("the inventory is the issue query") and the wave headings themselves. They describe the page's own structure, not any item.

# Verdict verification for #403

Verified 2026-09-04 against the resolved backlog query (`nexus config backlog-query` →
`gh issue list --state open --label backlog`).

| Verdict on the page | Item | State after this story |
|---|---|---|
| drop | #197 | CLOSED / not planned, with the drop rationale as a comment |
| superseded by #139 | `hub-design-gate` | never filed — no open issue carries the name |
| superseded by #114 | `entry-abandonment` | never filed — no open issue carries the name |
| superseded by #114 | #109 | already CLOSED / not planned before this story |

The query returns 44 open backlog issues and none of the above.

Both never-filed supersessions are already recorded on the closed issues that superseded them
(#139 and #114), so confirming they carry no open issue is the whole of the work — nothing new
was written for them.

# Deletion checks for #404

Run 2026-09-04, after `git rm`:

- A fixed-string `git grep` for the deleted page's repository path over tracked files → 0 matches.
  (This scratch file deliberately never spells that path out, so the check stays clean while the
  branch is in flight.)
- `git grep -E '\]\([^)]*sequencing\.md[^)]*\)'` over tracked markdown → 0 matches. No link
  resolved to the file even before deletion; the criterion asserts it rather than assuming it.
- The only surviving textual mention is `docs/delivery/lessons/2026-07-22-issue-sourced-planning.md`,
  which names the page in past tense as a historical record. Left unchanged.
