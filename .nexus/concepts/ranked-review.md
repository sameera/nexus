---
title: "Ranked Pull Request Review"
aliases: ["code-review skill", "ranked review", "review finding ranking", "fix-now and follow-up groups", "four rating axes", "body-only finding", "finding moved to its head line"]
touches: ["review-posting-gate", "component-mirror"]
last_updated_by: "#918"
status: active
verification: verified
---

# Ranked Pull Request Review

The code-review skill takes the findings of Claude Code's own review of a pull request and ranks them, so the author can tell which findings to fix in this pull request and which can wait. It adds no finding of its own and drops none. When Claude Code's review cannot be run, the skill names what is missing and reviews nothing itself.

## How It Works

The skill runs Claude Code's review on the pull request with any effort level the lead gave. It never passes that review's posting or fixing options. Before ranking, it moves each finding to the line where the finding's quoted code now sits at the pull request's head. A finding whose head line is outside the changed lines is marked body-only, because the platform accepts an inline comment only on a changed line.

Each finding is rated on probability, severity, fix effort and regression risk, on scales the skill fixes. The groups are tested in a fixed order: follow-up issues, fix in this pull request, fix if the author agrees, then optional. A finding goes into the first group it matches. The groups are listed with fix-now first, and findings are numbered from 1 down the whole list. Inside a group they sort by severity, then probability, then lowest fix effort, and ties keep the review's order.

The lead sees the ranking before choosing any verdict. The skill changes no file in the pull request and opens no issue.

## Key Invariants

1. Every finding in the ranking came from Claude Code's review of that pull request, and every finding that review returned is in the ranking.
2. Every finding lands in exactly one group.
3. The same rated findings always get the same groups and the same numbers.
4. The line shown for a finding is its line at the pull request's head.
5. When the review returns no findings, the lead is told, the run ends, and nothing is posted.
6. When Claude Code's review cannot be run, nothing is reviewed and nothing is posted.

## Integration Points

- [review-posting-gate](review-posting-gate.md) — receives the ranking, the inline comments and the body-only findings once the lead chooses a verdict.
- [component-mirror](component-mirror.md) — installing writes this skill over a personal skill of the same name, because that name is in the Nexus-owned namespace.

## Decision Log

### 2026-10-16 — #918 — Findings come only from Claude Code's review, and the ranking rules ship fixed

The skill has no review logic of its own. Claude Code's review is maintained with Claude Code, and a second review written inside Nexus would drift from it until the two disagreed. Where that review cannot be run, the skill refuses rather than review the code itself; making it work with Codex's own review is the follow-up epic #922. The rating scales, group rules and numbering order are fixed in the skill, so two runs on the same pull request group and number a finding the same way and the author can compare reviews. The base is the lead's personal skill, with three approved changes: the High and Medium severity wording, a group order that puts every finding in exactly one group, and the order inside a group. Low and Negligible severity keep the personal skill's wording. The skill, not the executable, moves each finding to its head line, because the lead must see head lines before choosing a verdict, and the posting check catches a wrong move. The skill ships as a skill folder of the same name, so installing replaces the personal skill. Refuted alternatives: review instructions written into the skill, which duplicate a maintained capability; axis and group names only, with the values left to model judgment, which lets two runs disagree; and an executable command that maps base lines to head lines, which adds a second command for little gain.
