---
title: "Close Record: Close the two low gaps analyze 0.91.0 left in its answer and registry reads"
epic: "#875"
feature: "PR-Driven Delivery"
date: 2026-10-06
nexus_version: 0.93.1
analyze: ran 2026-10-06 @ 9e31519a15546673137dbab943e8d68ac4a2a093
range:
  - repo: sameera/nexus
    pr: 886
    base: c9485cbfc6d3205eec8dba3a4a7244e3b2e55934
    head: 1501642bdfde341d315ca22f8cce315d1ca9e3b4
story_ranges:
  - story: "#884"
    ranges:
      - { repo: sameera/nexus, pr: 886, base: c9485cbfc6d3205eec8dba3a4a7244e3b2e55934, head: 1501642bdfde341d315ca22f8cce315d1ca9e3b4 }
  - story: "#885"
    ranges:
      - { repo: sameera/nexus, pr: 886, base: c9485cbfc6d3205eec8dba3a4a7244e3b2e55934, head: 1501642bdfde341d315ca22f8cce315d1ca9e3b4 }
landed_check:
  - story: "#884"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 886, result: unchanged }
  - story: "#885"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 886, result: unchanged }
---

# Close Record: Close the two low gaps analyze 0.91.0 left in its answer and registry reads

## Key Decisions

- **Add `--lines` (one tab-separated row per answer line: comment link, ID, verb, reason) and diff those rows in the implement script; leave `--urls` unchanged.** (a decision stub the verdict on sameera/nexus#886 confirmed). **Why:** An edit keeps the comment's link, so only the answer line content shows an added or changed answer, and a new mode keeps `--urls` callers working. **Refuted alternative:** Stop on any comment whose `updatedAt` moved — it would stop a round that edits only other text in a comment holding answers (#884 AC3).
- **The compared row carries link, ID, verb and reason only, not `trusted` or `at`.** (a decision stub the verdict on sameera/nexus#886 confirmed). **Why:** `at` is the creation time and never moves on an edit, and a trust change alone posts no answer but would stop the run. **Refuted alternative:** Fingerprint the whole `PrAnswer` record.

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
