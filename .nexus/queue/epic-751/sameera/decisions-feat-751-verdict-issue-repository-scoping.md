## 2026-09-21 — The pre-publish check takes a body file and a checkout, and nothing else

- **Choice:** `nexus verdict-check --body <path> [--dir <startDir>]`. It resolves both repositories from `--dir` itself (`gh repo view` for the code repository, the publishing resolver's `epic-repo` for the issues repository, falling back to the code repository).
- **Why:** Invariant 3 says the check resolves both repositories from the checkout and never from values the stage hands it; a `--repo`/`--issues-repo` flag would be exactly that.
- **Refuted alternative:** Take `--pr <N>` and resolve the code repository from the pull request via `gh`. The worktree is already a checkout of the target repository, so the extra call would ask GitHub a question the working directory already answers.

## 2026-09-21 — The check refuses only on the issues repository, though it resolves both

- **Choice:** A missing or mismatched `issues_repo` refuses; the `repo` stamp is resolved and reported but never gated on.
- **Why:** The epic puts "the code-repository stamp itself and how it is compared" out of scope, settled by epic #747.
- **Refuted alternative:** Gate on `repo` too, since the check already has the resolved value. Defensible and cheap, but it adds a second refusal reason to a command whose one named job is the issues repository.

## 2026-09-21 — `nexus pr-verdict` resolves the issues repository rather than taking a flag for it

- **Choice:** `readPrVerdict` takes it as a required parameter, but the CLI verb grows no `--issues-repo` flag: it calls `resolveVerdictRepos` on the checkout and passes the result.
- **Why:** Invariant 4 says the effective value is the configured repository or the checkout's own and is never empty. Leaving that fallback to a stage's shell would put the rule back in prose, which is what this epic removes.
- **Refuted alternative:** A required `--issues-repo` flag, mirroring `--repo`. Symmetric, but a flag can be forgotten or fed an empty `nexus config resolve` result, which is exactly the caller the check exists for.

## 2026-09-21 — A dropped candidate is carried out on the reader's own result, not recomputed

- **Choice:** `verifyReceipt` returns `issuesRepoRejected`, and `resolveStoryVerdict` returns `rejected`, both filled during the single trust pass.
- **Why:** Invariant 8 puts the comparison inside the trust checks, before newest-wins. Naming the drop from there is free; recomputing it afterwards would be a second implementation of the same rule.
- **Refuted alternative:** Let the caller re-read the blocks and work out which were dropped. Keeps the reader's return type unchanged, but gives one rule two implementations with no rule for a disagreement.

## 2026-09-21 — Every epic-verdicts state is printed through one payload builder

- **Choice:** `epicVerdictsPayload` builds the printed object for all five branches of the verb, writing `rejected` last so a branch's own fields cannot shadow it.
- **Why:** three of the five branches dropped a field both stage prompts promise, because each branch spread its own object and the field was remembered rather than checked; building it in one place means a new state cannot omit it.
- **Refuted alternative:** add `rejected:` to the three branches that lacked it — the smaller diff, but it leaves the next branch free to forget it again, which is the failure that just happened.
