---
title: "Close Record: Analyze owns every judgment, and the engineer answers on the pull request"
epic: "#829"
feature: "PR-Driven Delivery"
date: 2026-10-04
nexus_version: 0.91.0
analyze: ran 2026-10-04 @ aafbee67850ad51badb7f5089885b97b1219132a
record: "#871"
record_hash: 2507c820871871b3ca8ed257b57d3a859f6efb4cc0724ccba282fb13eed7cb77
range:
  - repo: sameera/nexus
    pr: 874
    base: 2ed26cbf5489047d1fc0d61abbfb731c9aa0f750
    head: 8ba1e348353383a0bc2d4b83d2c3b52377481415
story_ranges:
  - story: "#858"
    ranges:
      - { repo: sameera/nexus, pr: 874, base: 2ed26cbf5489047d1fc0d61abbfb731c9aa0f750, head: 8ba1e348353383a0bc2d4b83d2c3b52377481415 }
  - story: "#859"
    ranges:
      - { repo: sameera/nexus, pr: 874, base: 2ed26cbf5489047d1fc0d61abbfb731c9aa0f750, head: 8ba1e348353383a0bc2d4b83d2c3b52377481415 }
  - story: "#860"
    ranges:
      - { repo: sameera/nexus, pr: 874, base: 2ed26cbf5489047d1fc0d61abbfb731c9aa0f750, head: 8ba1e348353383a0bc2d4b83d2c3b52377481415 }
  - story: "#861"
    ranges:
      - { repo: sameera/nexus, pr: 874, base: 2ed26cbf5489047d1fc0d61abbfb731c9aa0f750, head: 8ba1e348353383a0bc2d4b83d2c3b52377481415 }
  - story: "#862"
    ranges:
      - { repo: sameera/nexus, pr: 874, base: 2ed26cbf5489047d1fc0d61abbfb731c9aa0f750, head: 8ba1e348353383a0bc2d4b83d2c3b52377481415 }
  - story: "#863"
    ranges:
      - { repo: sameera/nexus, pr: 874, base: 2ed26cbf5489047d1fc0d61abbfb731c9aa0f750, head: 8ba1e348353383a0bc2d4b83d2c3b52377481415 }
landed_check:
  - story: "#858"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 874, result: unchanged }
  - story: "#859"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 874, result: unchanged }
  - story: "#860"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 874, result: unchanged }
  - story: "#861"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 874, result: unchanged }
  - story: "#862"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 874, result: unchanged }
  - story: "#863"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 874, result: unchanged }
---

# Close Record: Analyze owns every judgment, and the engineer answers on the pull request

## Key Decisions

Record decisions (#871, approved digest above). The shipped code carries each one; DV3 below is the one exception.

- **#871 D1 — Analyze runs the departure pass.** Close's departure pass moved into analyze. The baseline depends on the record's format, and a broken guarantee is one departure, never also a separate finding. Why: one item per fact means one answer per fact. Refuted: keep a broken guarantee as a separate critical finding (two IDs and two answers for one fact, which could disagree).
- **#871 D2 — IDs come from a per-pull-request registry (DV, F, DS).** Why: an ID must survive a re-run and an answer must survive a moved head, without relying on the model to number things the same way twice. Refuted: IDs hashed from content (unreadable to type, and they collide inside one file).
- **#871 D3 — Answers go through #849 D11's waiver reader, one fixed line per answer.** Why: one deterministic reader keeps the trust boundary in one place. Refuted: count a resolved thread or a reaction as the answer (it carries no reason).
- **#871 D4 — Severity counts count only open items, and close's checkpoint override is gone.** Why: the merge pre-check and close already block on those counts, so changing what they count makes an answer work in both. Refuted: keep totals and add a separate open count (every reader would have to switch fields).
- **#871 D5 — New content goes in a second block that one parser reads, with a size budget.** Why: deployed readers parse flat keys, so nested entries would overwrite top-level keys. Refuted: a separate judgments comment (two artifacts can disagree about which verdict they belong to).
- **#871 D6 — Key decisions are the record's decisions plus the decision stubs the diff confirms.**
- **#871 D7 — Each deferred-scope proposal belongs to the item it would settle.** Why: one choice gets one answer. Refuted: standalone proposals (approving one would leave its finding blocking).
- **#871 D8 — The answer-recording run is scoped by a per-file comparison of each head's own change.** Why: a trunk merge or rebase must not count as a code change. Refuted: diff the old head against the new head directly. DV3 adds two triggers to this decision.
- **#871 D9 / D10 — The completing pull request is found by the shared claiming read, and its head must contain every merged sibling.** Why: analyze and close must agree on what shipped, and the judgment must read the code as it will be after the merge. Refuted: the platform's test-merge commit (missing on a conflict, and a different commit from the stamped head).
- **#871 D11 — The epic-wide verdict built from story verdicts is removed.** On an epic that has already fully merged, its most recently merged pull request is the target.
- **#871 D12 — A local analyze run reports in the terminal only.** The implement scripts read the final report line instead of a file. Refuted: run every implement round with `--pr` (a worktree and a published verdict per round).
- **#871 D13 — An unattended run never posts an answer.** Why: the agent posts as the lead, so its acceptance would count as the lead's. Refuted: ignore answers by the PR author (that breaks a lead working alone).

Implementation decisions the diff confirms (from the decision stubs):

- **The toolkit numbers items, not the model.** `nexus verdict-items` reads the newest trusted verdict as the registry, matches an item by the element it cites plus a shared file, applies answers and prints the open counts. Why: G6 stability cannot depend on prose. Refuted: have the model reuse the IDs it reads.
- **Every ID ever issued stays in the registry**, as `found: false` when an item is not found again. Why: "next unused number" then never reuses one, with no separate counter key. Refuted: keep only answered items plus a counter.
- **The judgments block is JSON in a fence longer than any backtick run, after the receipt block. `<` is escaped, and the publish check refuses a body where either marker appears twice.** Why: deployed readers parse only the first fence after the receipt marker, and copied answer text must not break either parser. Refuted: a nested YAML block, or making readers search for the last marker.
- **`verdict-check` is the one publish boundary.** It requires the judgments block, requires counts equal to the open items, and applies the size budget. Over the limit it drops only the results' file lists, and refuses if the body is still too large. Why: dropping the items' lists renumbered every item and lost its answers (this was DV2, fixed before merge). Refuted: a separate `verdict-fit` verb, or matching on the anchor alone.
- **The newest trusted, well-formed answer wins. Ill-formed lines are named, never revoke.** Why: G10/G11 require naming every answer that applies nothing. Refuted: take the newest trusted line first and apply nothing when it is malformed.
- **Answer lines are read in the same comment pass as waivers** (`readPrWaivers`). Why: D3 forbids a second reader. Refuted: a separate `readPrAnswers` with its own `gh` call.
- **The `--resolve` scope is its own verb.** `nexus verdict-scope` writes the scope, which `verdict-items --scope` consumes, refusing a stale one. Posted answers are applied before choosing what to judge again. Why: the stage must know the mode before it reads code. Refuted: one verb that decides and merges in one call.
- **Completion and the epic-number redirect are toolkit verbs** (`epic-verdicts completion`, `pr-target`). They reuse close's claiming read, compare a pull request by owner/name with the host left out (this was DV1, fixed before merge), and turn a sibling that cannot be checked into "not run", never a stop. Refuted: reason about completeness in prose with `gh`.
- **The implement scripts detect a posted answer by comment link, not by time** (`nexus pr-answers --urls` before and after each fix round). Why: no clock skew. Refuted: a local-clock `--since` filter. Its known gap is finding F1, which is deferred.
- **The epic receipt writer/reader (`write.ts`) and the ledger gate were deleted outright.** Why: they had no remaining caller. Refuted: keep them as dead code until #830.

## Deviation Rationale

- **#871 D8 / G18 — the answer-recording run can judge in full on an unchanged head (superseding).** `decideAnswerMode` adds two full-run triggers D8 does not list: the epic-level state changed, or the earlier verdict recorded no results. It checks them before the unchanged-head test. So a `--resolve` run with the head, record and story set unchanged can still read code, which G18 says never happens. Why: a pull request that has become the one completing the epic must have its success metrics judged (G30), and carrying the earlier results forward would skip that. Where G18 and G30 conflict, G18 yields. Accepted on the pull request by @sameera as DV3 (https://github.com/sameera/nexus/pull/874#issuecomment-5981262993).

## Waived Stories

none

## Deferred Scope

Deferred items filed as epic stub issues:

- #875 — Close the two low gaps analyze 0.91.0 left in its answer and registry reads (F1, F2 on sameera/nexus#874)

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-10-04-a-pull-request-claims-its-stories-in-its-body.md`
