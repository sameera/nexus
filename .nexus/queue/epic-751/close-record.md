---
title: "Close Record: A Published Verdict's Story Numbers Name the Repository They Belong To"
epic: #751
feature: "Multi-Repo Workspaces"
date: 2026-09-21
nexus_version: 0.71.0
analyze: ran 2026-09-21 @ 58883a42f9ba94442b8723b06da33594323e1b31
record: #764
record_hash: 7cdb73fd5e157e0756557575057aeaaf5564059c0d995be125baea4718d317cb
range:
  - repo: github.com/sameera/nexus
    base: f1adef7297bf589da958d74b9a345a83aa10d0d3
    head: 11b192b174650730105f1b8eb0172ac3d513857f
---

# Close Record: A Published Verdict's Story Numbers Name the Repository They Belong To

## Key Decisions

- **The pre-publish check takes a body file and a checkout, and nothing else.** `nexus verdict-check --body <path> [--dir <startDir>]` resolves the code repository from the working directory and the issues repository from the publishing resolver, falling back to the code repository. Record #764's invariant 3 says the check resolves both repositories from the checkout and never from values the stage hands it, and a `--repo` or `--issues-repo` flag would be exactly that. Refuted alternative: take `--pr <N>` and resolve the code repository from the pull request. The worktree is already a checkout of the target repository, so the extra call would ask GitHub a question the working directory already answers.

- **The check refuses only on the issues repository, though it resolves both.** A missing or mismatched issues repository refuses; the code-repository stamp is resolved and reported but never gated on. The epic puts the code-repository stamp and how it is compared out of scope, settled by epic #747. Refuted alternative: gate on the code repository too, since the check already holds the resolved value. It is defensible and cheap, and it lost because it adds a second refusal reason to a command whose one named job is the issues repository.

- **The single-pull-request reader resolves the issues repository rather than taking a flag for it.** The library function requires the value, but the command grows no `--issues-repo` flag: it resolves the checkout and passes the result. Record #764's invariant 4 says the effective value is the configured repository or the checkout's own, and is never empty; leaving that fallback to a stage's shell would put the rule back in prose, which is what this epic removes. Refuted alternative: a required flag mirroring the existing code-repository one. It is symmetric, and it lost because a flag can be forgotten or fed an empty resolver result, which is exactly the caller the check exists for.

- **A dropped candidate is carried out on the reader's own result, not recomputed.** Both readers fill the list of candidates they rejected during the single trust pass they already run. Record #764's invariant 8 puts the comparison inside the trust checks, before newest-wins, so naming the drop from there costs nothing. Refuted alternative: let the caller re-read the blocks and work out which were dropped. It keeps the reader's return type unchanged, and it lost because it gives one rule two implementations with no rule for a disagreement.

- **Every state of the epic-wide derivation is printed through one payload builder.** Three of the five printed states dropped the rejected list, because each branch spread its own object and the field was remembered rather than checked. One builder now writes every state's payload, with the rejected list written last so a branch's own fields cannot shadow it. Refuted alternative: add the field to the three branches that lacked it. It is the smaller diff, and it lost because it leaves the next branch free to forget it again, which is the failure that had just happened.

- **The open clarifications in record #764 were resolved by the model, not by the lead.** The architect returned three, and the lead had asked not to be prompted again. The answers taken were: stamp the key unconditionally rather than only when the repositories differ; treat an unresolvable issues repository as a stop rather than a pass; and leave the local receipt and the close record's conventions alone. The first is the one that matters, because the epic's own acceptance criterion reads "names the same repositories it names today" and the unconditional stamp satisfies that only on the reading the record states. It is recorded here so a later reader knows which decisions in #764 had no human in them.

## Deviation Rationale

None. Every constraint in record #764 was checked against the merged diff at close and at conformance, and none is relaxed or worked around. The one thing that reads like a widening — the check refuses on a mismatched issues repository as well as a missing one — is an elaboration of invariant 1 rather than a departure from it, and it is recorded above as its own decision.

## Deferred Scope

Deferred items filed as epic stub issues:

- #766 — Every verdict published while the issues-repository key could be omitted is re-run, so no close reads a story number against the wrong repository.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-21-a-medium-finding-that-cites-an-invariant-is-not-advisory.md`
