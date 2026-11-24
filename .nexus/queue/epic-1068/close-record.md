---
title: "Close Record: Start the epic, decision-record and analyze stages from nexus commands"
epic: "#1068"
feature: "Pipeline Command Surface"
date: 2026-11-24
nexus_version: 1.10.0
analyze: ran 2026-11-23 @ dd723f832dc9dd920ea38981b963fadf138feb11
range:
  - repo: sameera/nexus
    pr: 1072
    base: e45eb2bad7ca30469e1c294de92ca481ef8188ed
    head: 1299bccd721de3367fa30f31340f5a98e718c589
story_ranges:
  - story: "#1069"
    ranges:
      - { repo: sameera/nexus, pr: 1072, base: e45eb2bad7ca30469e1c294de92ca481ef8188ed, head: 1299bccd721de3367fa30f31340f5a98e718c589 }
  - story: "#1070"
    ranges:
      - { repo: sameera/nexus, pr: 1072, base: e45eb2bad7ca30469e1c294de92ca481ef8188ed, head: 1299bccd721de3367fa30f31340f5a98e718c589 }
  - story: "#1071"
    ranges:
      - { repo: sameera/nexus, pr: 1072, base: e45eb2bad7ca30469e1c294de92ca481ef8188ed, head: 1299bccd721de3367fa30f31340f5a98e718c589 }
landed_check:
  - story: "#1069"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1072, result: unchanged }
  - story: "#1070"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1072, result: unchanged }
  - story: "#1071"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1072, result: unchanged }
---

# Close Record: Start the epic, decision-record and analyze stages from nexus commands

## Key Decisions

- **One shared runner for all three verbs in stage-command.ts** (a decision stub the verdict on sameera/nexus#1072 confirmed). **Why:** Three copies of model resolution and refusal order would drift **Refuted alternative:** One module per verb
- **Spawn claude with stdio inherit; --planning-model stripped from stage args and passed as --model** (a decision stub the verdict on sameera/nexus#1072 confirmed). **Why:** Stages ask the lead at gates; the stage must not receive a token it does not understand **Refuted alternative:** Reuse spawnSession's stream parser; leave the flag in the prompt

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
