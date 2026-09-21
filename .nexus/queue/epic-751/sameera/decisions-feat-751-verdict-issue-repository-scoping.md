## 2026-09-21 — The pre-publish check takes a body file and a checkout, and nothing else

- **Choice:** `nexus verdict-check --body <path> [--dir <startDir>]`. It resolves both repositories from `--dir` itself (`gh repo view` for the code repository, the publishing resolver's `epic-repo` for the issues repository, falling back to the code repository).
- **Why:** Invariant 3 says the check resolves both repositories from the checkout and never from values the stage hands it; a `--repo`/`--issues-repo` flag would be exactly that.
- **Refuted alternative:** Take `--pr <N>` and resolve the code repository from the pull request via `gh`. The worktree is already a checkout of the target repository, so the extra call would ask GitHub a question the working directory already answers.

## 2026-09-21 — The check refuses only on the issues repository, though it resolves both

- **Choice:** A missing or mismatched `issues_repo` refuses; the `repo` stamp is resolved and reported but never gated on.
- **Why:** The epic puts "the code-repository stamp itself and how it is compared" out of scope, settled by epic #747.
- **Refuted alternative:** Gate on `repo` too, since the check already has the resolved value. Defensible and cheap, but it adds a second refusal reason to a command whose one named job is the issues repository.
