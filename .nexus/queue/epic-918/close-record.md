---
title: "Close Record: Ranked Pull Request Review"
epic: "#918"
feature: "Ranked PR Review"
date: 2026-10-16
nexus_version: 0.107.1
analyze: ran 2026-10-16 @ e353eace2fbbb33cce709c8c75d15ee68c74927a
record: "#921"
record_hash: 95466ab1b757fdd0c5423ee10c2e767689f5c211fd8223bd6c434f6221f49701
range:
  - repo: sameera/nexus
    pr: 943
    base: e2206a552b3c495d4a37915ba6b6fa306ebff6eb
    head: cccadf6c85657f0789129716aa154d6eb1835ce4
story_ranges:
  - story: "#919"
    ranges:
      - { repo: sameera/nexus, pr: 943, base: e2206a552b3c495d4a37915ba6b6fa306ebff6eb, head: cccadf6c85657f0789129716aa154d6eb1835ce4 }
  - story: "#920"
    ranges:
      - { repo: sameera/nexus, pr: 943, base: e2206a552b3c495d4a37915ba6b6fa306ebff6eb, head: cccadf6c85657f0789129716aa154d6eb1835ce4 }
landed_check:
  - story: "#919"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 943, result: unchanged }
  - story: "#920"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 943, result: unchanged }
---

# Close Record: Ranked Pull Request Review

## Key Decisions

- **D1 — Findings come only from Claude Code's own review (#921).** The skill has no review logic of its own. To get findings, it runs Claude Code's `/code-review` on the pull request and passes through any effort level the lead gave. It then ranks and posts the findings that review returns, and no others. **Why:** Claude Code's review is maintained with Claude Code and gets better without work from Nexus. A second review written inside Nexus would drift from it, and the two reviewers' findings would then disagree. **Refuted alternative:** Writing review instructions into the skill itself. That gives control over what the review looks for. It lost because it duplicates a maintained capability and makes Nexus responsible for review quality.
- **D2 — The rating scales, group rules and numbering order ship fixed in the skill (#921).** The skill ships one definition of the four rating scales, the four group rules and the numbering order, as the Mechanism gives them. The base is the lead's existing personal skill. The lead approved three changes to it: the High and Medium severity wording, the group order, and the numbering order inside a group. **Why:** The lead chose the personal skill's version because it is already in use. A fixed definition makes the same findings rate, group and number the same way on every run. The personal skill's group rules let some findings match two groups and others match none, and the group order makes every finding land in exactly one group. **Refuted alternative:** Ship only the axis and group names and leave the values to model judgment. That is less to maintain. It lost on consistency: two runs on the same pull request could group a finding differently, and the author could not compare reviews.
- **D3 — The checks before posting, and the posting, run in the Nexus executable (#921).** A Nexus executable command runs the checks on each inline comment, the check for an existing review by the lead on the same head commit, and the posting itself, with no model judgment. The skill writes the review and hands it, with the lead's verdict, to that command. **Why:** The lead wants these checks deterministic, written test-first and held to the 95% coverage rule. The product context gives the executable every mechanical step, and the epic says the checks need test fixtures. A check the model runs can pass silently, which is what #920's refusals exist to stop. **Refuted alternative:** A script shipped inside the skill's own folder, as the personal skill works today. It needs less wiring and does not touch the executable. It lost because it sits outside the tested libraries and their coverage, where the epic's test fixtures belong.
- **D4 — A finding outside the changed lines goes in the review body only (#921).** At ranking time, before the verdict, a finding whose location is outside the pull request's changed lines is marked. It is carried in the review body with no inline comment, and its count is reported next to the inline-comment count. The checks before posting apply only to locations that get an inline comment. **Why:** The lead chose this handling. GitHub accepts inline comments only on changed lines, and Claude Code's review can flag lines outside them. Without this rule, #920's "post nothing on a bad line" rule and the design's "drop no finding silently" rule together mean such a pull request can never get a review. **Refuted alternative:** Keep #920 strict and make the lead remove such a finding by name before posting. That keeps the epic's wording unchanged. It lost because the lead would have to hide real findings from the author just to be able to post.
- **D5 — Refuse when Claude Code's review is unavailable (#921).** If Claude Code's review cannot be run, the skill refuses. It names what is missing, posts nothing and reviews nothing. This epic does not change how the skill is installed for Codex. Making the skill work on Codex, with Codex's own `/review`, is the follow-up epic #922. **Why:** D1 makes Claude Code's review the only source of findings, so a review written by Nexus would break G1. A refusal said out loud is better than quietly doing less. The lead chose to keep Codex support out of this epic and in one follow-up epic. **Refuted alternative:** Keep the skill out of the Codex install in this epic. That would stop a Codex user from finding a skill that can only refuse. It lost because how the skill behaves on Codex belongs to #922, and an exclusion added now is installer work that #922 would likely undo.
- **D6 — The skill moves a finding's line to the head at ranking time; the posting command checks it (#921).** Before ranking, the skill reads each finding's file at the pull request's head and moves the finding to the line where its expected text now sits. The posting command's expected-text check (G11) refuses to post if a moved line is wrong. **Why:** The ranking the lead sees before choosing a verdict must already show head lines (G6), and ranking happens before the posting command runs. A wrong move cannot be posted silently, because G11 catches it. **Refuted alternative:** The Nexus executable maps base lines to head lines from the diff hunks. It is deterministic and test-first, like D3. It lost because it needs a second executable command that runs before ranking, and gains little, since G11 already checks the result deterministically.
- **Ship /nxs.code-review as a skill at components/skills/nxs.code-review/SKILL.md** (a decision stub the verdict on sameera/nexus#943 confirmed). **Why:** G15's replacement of a personal skill of that name holds only when the installed path is the same skill folder **Refuted alternative:** components/commands/nxs.code-review.md, like the other nxs.* stages
- **nexus review-post treats added lines and in-hunk context lines as changed lines** (a decision stub the verdict on sameera/nexus#943 confirmed). **Why:** Those are exactly the lines GitHub accepts an inline comment on **Refuted alternative:** Added lines only
- **nexus review-post prefixes every inline comment body with **#<n>**** (a decision stub the verdict on sameera/nexus#943 confirmed). **Why:** The tag (G10) is then applied by tested code, not by the model **Refuted alternative:** The skill writes the tag into each comment body itself
- **Low and Negligible severity taken from the lead's personal nxs.code-review skill: Low = a loud false failure, or local-only confusion; Negligible = performance or tidiness only** (a decision stub the verdict on sameera/nexus#943 confirmed). **Why:** D2 makes the personal skill the base for these two levels **Refuted alternative:** Keep the fresh wording and accept DV1

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
