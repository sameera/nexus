---
title: "Review Posting Gate"
aliases: ["review post", "posting a ranked review", "checks before posting", "second review on the same head", "inline comment anchoring", "finding number tag"]
touches: ["ranked-review"]
last_updated_by: "#918"
status: active
verification: verified
---

# Review Posting Gate

A ranked review reaches the pull request only after the lead chooses request changes, comment or approve in the same run. A toolkit command then checks every inline comment and posts the review as one pull request review on the head commit, with no model judgment. Any failed check posts nothing.

## How It Works

The skill writes the ranking, one inline comment per finding location inside the changed lines, and the body-only findings into one review file. It hands that file and the lead's verdict to the posting command.

The command first confirms that every ranked finding is an inline comment or a body-only finding. It then reads the pull request at its head. Changed lines are the head-side lines of the diff hunks: added lines and the context lines around them. Each inline comment must name a file in the pull request, a line inside the changed lines, and expected text that is on that line at the head. The command lists every problem it finds. Body-only findings are not checked, because they get no inline comment.

When the lead already reviewed the same head commit, the command posts nothing unless the lead confirmed a second review. A posted review carries the ranking in its body and tags each inline comment with its finding number. The lead then sees the review link, the inline comment count and the body-only count.

## Key Invariants

1. Nothing is posted without the lead's verdict from the same run.
2. One bad inline comment posts nothing, and every problem is listed.
3. Every ranked finding is carried, as an inline comment or in the review body. A review file that leaves one out is refused.
4. A second review by the lead on the same head commit is posted only after the lead confirms it.
5. The same pull request state and the same review file always give the same result.
6. The finding-number tag on an inline comment is added by the command, never by the model.

## Integration Points

- [ranked-review](ranked-review.md) — supplies the ranking, the inline comments and the body-only findings this gate checks and posts.

## Decision Log

### 2026-10-16 — #918 — The checks and the posting run in the toolkit, and a finding outside the changed lines goes in the body

A check the model runs can pass silently, and the refusals here exist to stop exactly that. So the comment checks, the second-review check and the posting run in a toolkit command, written test-first and held to the coverage rule. The command also adds the finding-number tag, so tested code applies it. Claude Code's review can flag a line outside the changed lines, where the platform takes no inline comment. Requiring every finding inline would mean such a pull request could never get a review. So that finding is carried in the body and counted beside the inline comments, and the epic's first success metric was amended to promise inline comments only inside the changed lines. Changed lines include the context lines in each hunk, because the platform accepts a comment on exactly those lines. Refuted alternatives: a script inside the skill's own folder, which sits outside the tested libraries; making the lead remove an outside finding by name before posting, which hides real findings from the author; and counting only added lines as changed.
