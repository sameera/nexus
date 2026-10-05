---
date: 2026-10-04
epic: "Analyze owns every judgment, and the engineer answers on the pull request"
source: "#829"
---

# Lesson: a pull request claims its stories in its body, not in its commits

Epic #829 was sized L, with six stories (five M, one S). It shipped as one pull request (#874), with eight commits, one day after the epic was planned. The mechanism it built worked on its own pull request: analyze's departure pass found two critical departures (DV1, DV2). Both were fixed before the merge. A third (DV3) was accepted on the pull request with a reason, and that reason is the deviation rationale in the close record. Close needed no new rationale from the lead for any of them.

The first close run then stopped with all six stories reported as "unshipped". Each story was closed by a `Closes #<n>` trailer in a commit. GitHub records that as closed by a commit, not by the pull request, so the platform's closing link was empty. The pull request body listed the stories as bare `- #858 …` lines. The claiming read accepts a body mention only with a scope word (`Closes`, `Fixes`, `Resolves`, `Implements`, `Part of`), and it does not read commit messages. Editing the merged pull request's body to `- Implements #858 …` fixed it, because the read takes the body fresh on each run.

What the next epic should do:

- When one pull request ships several stories, write each story line in its body with a scope word, such as `Implements #<n>`. Commit trailers close the issues but do not make the pull request claim them.
- Run `nexus epic-verdicts ranges --epic <n>` before merging a multi-story pull request. An "unshipped" line there is cheap to fix before the merge.
- A single large pull request for an L epic was fine here, because analyze judged the whole epic on it (#859). The cost was one long verdict with a 56-file surface.
