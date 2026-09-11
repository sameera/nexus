---
date: 2026-09-10
epic: "Close an Epic Over Several Merged Pull Requests"
source: "#213"
---

# Lesson: A record decision with no story behind it does not get built

All four stories of this epic met every acceptance criterion — 3/3, 5/5, 3/3, 3/3, with no invariant
violations found. The close-from-diff pass still surfaced three deviations from decision record #509.
Every one of them sits in the same blind spot: a decision the record made that no story's acceptance
criteria carried.

The record decided the `--pr` argument would become "optional and plural", with an epic-addressed
invocation reading the set from the epic receipt and a typed list as the override when no receipt
exists. The stories only ever described the plural case, so only the plural case shipped. The record
also fixed, as invariants 9 and 17, that the deviation pass reads the union of exactly the stamped
entries. Story #501 was scoped as the stamp; nothing was scoped as the reader, so Phase 4 learned to
write a list and Phase 3 was left reading one range.

The decomposition treated the record as context for building the stories rather than as a second
source of work. It is not: a record decision is a commitment the epic has made, and the stories are
how commitments get built. Any decision the record makes that no acceptance criterion names will be
skipped, quietly, by an implementation that is doing exactly what it was told.

**What the next epic in this area should do differently.** When the record lands, walk its Key
Decisions and Constraints & Invariants against the story set and ask of each one: which acceptance
criterion makes this true? A decision with no answer is either a story that is missing or a decision
that should be dropped from the record. Both are cheap to fix at that moment and expensive to find at
close — the two divergences here are already in the trunk and now need their own follow-up.

**A second, smaller lesson on slicing.** #501 and #503 each independently specified how to obtain the
pull-request ranges, and nothing reconciled them, so the shipped flow derives the same ranges twice.
When two stories in one epic both need the same derived value, one of them should own producing it and
the other should consume it. Sizing them as independent slices is right; letting each answer the same
question separately is not.

**Estimate versus actual.** Complexity M, four stories (M, M, S, S), delivered in one pull request with
four commits and four version bumps — 0.22.0 through 0.25.0, one per story. That held up well. The
sizing was accurate; the gap was in what the stories covered, not in how large they were.
