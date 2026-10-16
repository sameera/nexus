---
title: "Close Record: Keep accepted outside-epic dependencies out of Before implementation"
epic: "#934"
feature: "Unattended Epic Implementation"
date: 2026-10-16
nexus_version: 0.108.0
analyze: ran 2026-10-16 @ a5d710ca2c4d45d6022be6b63bf286fa253da29e
range:
  - repo: sameera/nexus
    pr: 938
    base: b50382c9db95ca4bc7c19de7278774b5825d4ef6
    head: 3e8f9194c217d915392739efc5226da014669408
story_ranges:
  - story: "#935"
    ranges:
      - { repo: sameera/nexus, pr: 938, base: b50382c9db95ca4bc7c19de7278774b5825d4ef6, head: 3e8f9194c217d915392739efc5226da014669408 }
  - story: "#936"
    ranges:
      - { repo: sameera/nexus, pr: 938, base: b50382c9db95ca4bc7c19de7278774b5825d4ef6, head: 3e8f9194c217d915392739efc5226da014669408 }
landed_check:
  - story: "#935"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 938, result: unchanged }
  - story: "#936"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 938, result: unchanged }
---

# Close Record: Keep accepted outside-epic dependencies out of Before implementation

## Key Decisions

- **Add a "Delivered by another epic" group to the approval brief, between "Before implementation" and "Committed follow-up".** (a decision stub the verdict on sameera/nexus#938 confirmed). **Why:** The mitigation of such a risk is often not decided yet, so "Committed follow-up" would misdescribe it. **Refuted alternative:** Widen "Committed follow-up" to take accepted outside-epic risks.
- **nexus razor-check --record blocks an ADDRESS risk listed in more than one brief group; an unlisted risk still passes.** (a decision stub the verdict on sameera/nexus#938 confirmed). **Why:** Blocking an unlisted risk would fail approved worked examples and drafts that never listed every ADDRESS risk. **Refuted alternative:** Require every ADDRESS risk in exactly one group mechanically.
- **The duplicate-listing check counts only the five placing groups.** (a decision stub the verdict on sameera/nexus#938 confirmed). **Why:** A Revision delta entry must name each moved risk, and any other bold line in the brief would otherwise count as a group. **Refuted alternative:** Exclude "Revision delta" by name.

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
