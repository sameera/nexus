---
name: nxs.code-review
description: Rank a pull request's review findings so its author knows what to fix now and what can wait. Runs Claude Code's own `/code-review` on the pull request (passing an optional effort level through, never its posting or fixing options), moves each finding to its line at the pull request's head, rates every finding on probability, severity, fix effort and regression risk, and numbers them into four groups by fixed rules — fix in this pull request, fix if the author agrees, optional, follow-up issues. After the lead chooses request changes, comment or approve, posts the ranking as one pull request review through `nexus review-post`, with one inline comment per finding location inside the changed lines and every other finding in the review body; posts nothing without a verdict or when any inline comment would land on the wrong line. Refuses, reviewing nothing itself, when Claude Code's review cannot be run. Changes no file and opens no issue.
---

# nxs.code-review

Rank the findings of one pull request's review, and post the ranking once the lead approves it.
The review itself is Claude Code's own `/code-review`. This skill adds the ranking and the posting:
it rates each finding, sorts it into one of four groups and numbers it, so the author can tell
which findings to fix in this pull request and which can wait.

**Finish line:** the posted review's link and counts; or the ranking, unposted, when the lead
chose not to post; or a refusal that names what is missing.

# User Input

```text
$ARGUMENTS
```

`$ARGUMENTS` is a pull request reference — a number, `owner/repo#N` or a pull-request URL —
optionally followed by an effort level: `low`, `medium`, `high`, `xhigh` or `max`. With no pull
request reference, stop and ask the lead for one.

# Scope

A run reads the pull request and the review. It changes no file in the pull request and opens no
issue. Follow-up items are only suggested, in the ranking's "Follow-up issues" group. It posts to
the pull request only in Step 8, through `nexus review-post`, after the lead chose a verdict in
this run.

# Step 1 — Run Claude Code's review

Run Claude Code's own `code-review` skill (`/code-review`) on the pull request reference, through
the Skill tool. Pass the pull request reference, and the effort level when the lead gave one,
unchanged. Never pass `--comment` or `--fix`, and never pass any other option the lead did not
give: posting happens only in this skill's own posting step, after the lead chooses a verdict.

Take the findings exactly as that review returned them, in the order it returned them. Each one
has a file, a line, a summary and the scenario in which it goes wrong. Add no finding of your own,
and do not review the code yourself. Drop no finding, merge none and split none: every finding the
review returned is one entry in the ranking.

## When the review cannot be run

If the `code-review` skill is not among the skills available in this session, or invoking it
fails, refuse. The refusal names what is missing — the `code-review` skill, or the error invoking
it returned — and says that nothing was reviewed and nothing was posted. Then stop. Review nothing
yourself, show no findings and post nothing: a review this skill wrote would not be Claude Code's
review.

# Step 2 — End on no findings

If the review returned no findings, tell the lead that Claude Code's review of the pull request
returned no findings, and end the run. A run with no findings ranks nothing and posts nothing.

# Step 3 — Move each finding to its line at the head

A finding's line can move between the commit the review read and the pull request's head. Resolve
the head commit once:

```bash
gh pr view <pr-ref> --json headRefOid,url --jq '{head: .headRefOid, url: .url}'
```

For each finding:

1. Write down its **expected text**: a short verbatim fragment of the code the finding names, as
   it sits on the flagged line.
2. Read the finding's file at the head commit (`gh api "repos/<owner>/<repo>/contents/<path>?ref=<head>" -H "Accept: application/vnd.github.raw"`).
3. If the expected text is on the flagged line, keep the line. Otherwise move the finding to the
   line where the expected text now sits — the occurrence nearest the flagged line. The line shown
   from here on is the line at the head. If the expected text is nowhere in the file, keep the
   flagged line and say so beside the finding; the posting checks refuse a comment whose text is
   not on its line.

Then read the pull request's changed lines from its diff (`gh pr diff <pr-ref>`): the lines each
hunk adds or keeps as context on the head side. Mark every finding whose line at the head is
outside the changed lines as **body-only** — including a finding the move put outside them. A
body-only finding is carried in the review body, with no inline comment, because GitHub accepts an
inline comment only on a changed line.

# Step 4 — Rate, group and number

Rate each finding on the four scales below, put it in a group by the group rules, and number it by
the numbering order. These definitions are fixed. Apply them as written, so that the same rated
findings always get the same groups and the same numbers.

## Rating scales

- **Probability** — how likely the failure is to happen: certain, high, medium or low. A finding
  that only happens on a developer machine rates lower than one that happens in CI.
- **Severity** — how bad it is when it happens:
  - **High**: data is lost, data or credentials are exposed, consumers break, or a check passes
    when it should fail.
  - **Medium**: a person is shown a wrong result that looks plausible, or a valid change is
    blocked.
  - **Low**: a nuisance with an obvious workaround — a misleading message, noisy output, a slower
    path — that leaves every result correct.
  - **Negligible**: no effect on behaviour — wording, naming or style.
- **Fix effort** — the work the fix takes: very low, low, medium or high.
- **Regression risk** — the chance the fix breaks something else: none, very low, low, medium or
  high.

## Group rules

The groups are checked in this order, and a finding goes into the first group it matches, so every
finding lands in exactly one group:

1. **Follow-up issues**: the fix needs a design or policy decision, or its fix effort is high, or
   its regression risk is high.
2. **Fix in this pull request**: either high severity with probability above low, fix effort medium
   or lower, and regression risk low or lower; or fix effort very low with regression risk none or
   very low.
3. **Fix if the author agrees**: any remaining finding with high or medium severity, and any fix
   whose value depends on a judgment call.
4. **Optional**: every remaining finding.

## Numbering order

The groups are listed in this order: fix in this pull request, fix if the author agrees, optional,
follow-up issues. Inside a group, findings sort by severity, highest first, then probability,
highest first, then fix effort, lowest first. Ties keep the order Claude Code's review returned them
in. Number the findings from 1 down the whole list, so a finding's number is its priority.

# Step 5 — Show the ranking

Show the lead the ranking: one heading per group, in the numbering order, each group listing its
findings by number. Leave out a group with no findings. For each finding show:

- its number and summary,
- its file and head line, with the **body-only** mark when it is outside the changed lines,
- its four ratings — probability, severity, fix effort, regression risk,
- one line on why it is in its group.

Below the groups, give the count of findings in each group and the count of body-only findings.

# Step 6 — The lead chooses the verdict

Recommend **request changes** when any finding in "Fix in this pull request" has high severity,
and **comment** otherwise. Then ask the lead with `AskUserQuestion`. The question itself carries
the group counts, the body-only count and the recommendation, because text shown before the
question may not be displayed. The options are:

- **Request changes**
- **Comment**
- **Approve**
- **Do not post**

Mark the recommended verdict as recommended. The lead chooses. Without a verdict — the lead chose
"Do not post", or gave no answer — nothing is posted: end the run with the ranking unposted.

# Step 7 — Write the review

Write one review file at `.nexus/tmp/code-review-<pr-number>/review.json`, a JSON object with:

- `findings` — the number of ranked findings.
- `body` — the ranking, as Step 5 showed it, in markdown. It lists every finding by number, and
  carries each body-only finding in full: its file and head line, its ratings, its summary and its
  failure scenario.
- `comments` — one entry per finding location that is not body-only:
  `{ "finding": <number>, "path": <file>, "line": <head line>, "expectedText": <expected text>, "body": <the finding's summary, failure scenario and group> }`.
  Leave the finding number out of `body`: `nexus review-post` puts the tag in front.
- `bodyOnly` — one entry per body-only finding: `{ "finding": <number>, "path": <file>, "line": <head line> }`.

Every finding appears in `comments` or `bodyOnly`, or both when it has locations of each kind.

# Step 8 — Post through `nexus review-post`

Hand the review and the lead's verdict to the posting command. It runs the checks before posting
and posts with no model judgment:

```bash
nexus review-post --pr <pr-number> --repo <owner/repo> --review .nexus/tmp/code-review-<pr-number>/review.json --verdict <request-changes|comment|approve>
```

Take `<owner/repo>` from the pull request's URL (`host/owner/repo` on a host other than
`github.com`). On exit 0 it has posted; go to Step 9. Otherwise nothing was posted:

- **`second-review-unconfirmed`** — the lead already has a review on this head commit. Ask the lead
  with `AskUserQuestion` whether to post a second review. Only when the lead confirms, run the same
  command again with `--confirm-second` added. Otherwise end the run, unposted.
- **`comment-check-failed`** — an inline comment names a file not in the pull request, a line
  outside the changed lines, or expected text that is not on its line. Show the lead every problem
  it listed, unchanged, and end the run. Do not move a line, drop a comment or retry.
- Any other stop — show its message unchanged and end the run.

# Step 9 — Report

Show the lead the posted review's link (`url`), the number of inline comments (`inlineComments`)
and, next to it, the number of findings carried only in the review body (`bodyOnly`), all as
`nexus review-post` printed them.
