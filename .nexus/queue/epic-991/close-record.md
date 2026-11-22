---
title: "Close Record: A re-run of nexus implement continues an interrupted run"
epic: "#991"
feature: "Unattended Epic Implementation"
date: 2026-11-22
nexus_version: 1.2.0
analyze: ran 2026-11-22 @ 60cdddd3a43515dd44635a9e4b5a2f7807bd8bce
record: "#996"
record_hash: 0a387ed78af530b5322c2977114a572a6f37b80f920b3fac1978297f4a5c5563
range:
  - repo: sameera/nexus
    pr: 1053
    base: 487d5571f438d9f4c4adca93d5e639643284c844
    head: 33e2f8dd44936c4274674f0301d546052a746f9e
story_ranges:
  - story: "#992"
    ranges:
      - { repo: sameera/nexus, pr: 1053, base: 487d5571f438d9f4c4adca93d5e639643284c844, head: 33e2f8dd44936c4274674f0301d546052a746f9e }
  - story: "#993"
    ranges:
      - { repo: sameera/nexus, pr: 1053, base: 487d5571f438d9f4c4adca93d5e639643284c844, head: 33e2f8dd44936c4274674f0301d546052a746f9e }
  - story: "#994"
    ranges:
      - { repo: sameera/nexus, pr: 1053, base: 487d5571f438d9f4c4adca93d5e639643284c844, head: 33e2f8dd44936c4274674f0301d546052a746f9e }
  - story: "#995"
    ranges:
      - { repo: sameera/nexus, pr: 1053, base: 487d5571f438d9f4c4adca93d5e639643284c844, head: 33e2f8dd44936c4274674f0301d546052a746f9e }
landed_check:
  - story: "#992"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1053, result: unchanged }
  - story: "#993"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1053, result: unchanged }
  - story: "#994"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1053, result: unchanged }
  - story: "#995"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1053, result: unchanged }
---

# Close Record: A re-run of nexus implement continues an interrupted run

## Key Decisions

- **D1 — A re-run continues on the run branch wherever it exists, after the local and remote copies are brought together (#996).** Preflight fetches the run branch and the base from the remote before it decides anything about the branch. An existing run branch is continued, not refused. Remote only: the command creates a local copy at the remote tip. Remote ahead: the command fast-forwards the local copy. Local ahead: the command keeps the local copy and pushes later. Diverged: the command stops before any agent stage, naming both tips. Before any agent stage, the command switches to the run branch. All branch decisions are made silently, so the resume line is the first output line. The HLD lookup, the page copy and the dirty-tree refusal stay as they are. **Why:** The epic needs a run that can be continued from any clone (#992), and the remote copy is the one every clone shares. A diverged pair can only be settled by rewriting one side, which the command never does (D5). Deciding the branch first, before anything prints, is the only way the resume line can come first. **Refuted alternative:** Keep the local branch as the only source of truth, and push with force-with-lease so that the local copy wins. It is simpler, needs no step to bring the copies together, and works offline until the push. It loses because a stale clone would overwrite stories another machine already published, which breaks the epic's promise that finished work is never held on one machine.
- **D2 — "Made on top of the base branch" means a shared fork point with the remote base and no merge commit after it (#996).** The fork point is the newest commit the run branch shares with the remote base. A run branch with no fork point, or with a merge commit among its run commits, is refused before any agent stage, naming the branch and the reason. When the base has moved on since the fork, nothing happens: the command never rebases the branch and never merges into it, and the pull request shows the gap. The fork point is the run's start for two purposes: the range the story commit check reads, and the "committed before the run" source of inferred answers. When an open pull request already exists, its base must equal the resolved base, or the command stops before any agent stage. **Why:** Measuring against the remote base matches what the pull request shows. A stale local base would pull base commits into the range the check reads. Refusing merge commits is the narrow reading of "holds only commits made on top of the base branch", and keeps the range equal to the commits this epic's runs made. A fork point that never moves also keeps record #966 D9 intact: a stub the run wrote itself can never pass as one written before the run. The lead confirmed this reading at the clarification gate. **Refuted alternative:** Accept merges of the base into the run branch, and treat the run commits as everything on the branch that the base lacks. A lead who resolves conflicts with the base by merging could still resume. It loses because the fork point then moves forward with every merge, so stubs committed to the base after the run started would count as written before the run, which loosens record #966 D9's source rule.
- **D3 — A story commit is recognised by the existing closing-keyword rule, and existing commits must pass the prefix check before any agent stage (#996).** Committed stories come from the existing claim rule: a closing-keyword line naming a live story in the issues repository. Before any agent stage, the command runs the prefix check over the existing run commits, and a failure stops the run. The build stage is given only the remaining stories in blocked-by order, and each story they wait on is named as already committed. When nothing remains, no build stage starts, and the run goes on to push and the pull request. After the stage, the full story commit check runs over every run commit, from both runs, and covers every live story. **Why:** The commits are the record of progress, so the rule that reads them must be the rule that wrote them. A second reader could disagree with the check that runs at the end. Checking the earlier commits before an agent stage keeps refusals ahead of the agent, as the unattended-epic-implementation page's invariant 1 requires, and the agent is never asked to build on a branch that already breaks the order. **Refuted alternative:** none
- **D4 — One build stage, and the command watches the run branch and publishes each passing commit while the stage runs (#996).** The build stays one agent stage. While it runs, the branch watcher reads the run branch's ref every few seconds. Each time the tip moves, it runs the prefix check over the run commits. On a pass, it pushes with a plain push, and at the first story commit it opens the draft pull request that claims every live story, or reuses the open one. On a failed check, it ends the agent stage at once and stops the run with the reason, and nothing is pushed for that commit. A failed push or pull request call is retried at the next tip change and once after the stage; if it still fails after the stage, the run stops at the push or pull request stage. This needs one new capability: the command can end a running agent stage. The agent still never pushes and never opens the pull request. **Why:** The epic treats the build as one stage that publishes as it goes, and its out-of-scope note keeps one model on the dependent chain. Keeping the push in the command preserves record #966 D2, which keeps the pushed branch out of a model's hands. The check-before-push order of record #966 D3 still holds, one commit at a time. Retrying instead of stopping keeps a brief network loss from ending a long build. **Refuted alternative:** Run one build stage per remaining story, with check, push and pull request after each. It needs no watcher, nothing running beside the agent, and no way to end a running stage, and resume follows from it directly. It loses on cost and on quality: each story's session must read the record, the HLD page and the epic again, the context built up across a dependent chain is thrown away, and the turn budget changes from per run to per story. The epic's out-of-scope reasoning favours one model on one chain.
- **D5 — Pushed commits are never rewritten (#996).** Every push is a plain push, never forced. The branch watcher stops the run when the tip no longer descends from the last checked commit. After the build stage, the command checks that the tip descends from the start tip. The build prompt forbids amend, rebase, reset and force operations, as the fix-round prompt already does. **Why:** #993 requires the earlier run's commits to stay unchanged. A plain push makes the remote refuse a rewrite, and the command's own descent check catches a local rewrite before anything is pushed. **Refuted alternative:** none
- **D6 — The status section lists built and pending stories, rewritten at each pushed story commit (#996).** While any live story is pending, the run status section names every live story once, as built or pending. The command rewrites it after each push that publishes a new story commit, when the build stage ends, at every stop (the stop's reason followed by the built and pending lists), and at the finish. **Why:** #995 asks for it. The section already exists, and every stop already rewrites it (record #966 D11), so this needs no new surface. **Refuted alternative:** none
- **D7 — The answer-line check also covers the build stage whenever a pull request exists (#996).** When a pull request exists at the start of the build stage, or is opened during it, the command compares the answer lines before and after the stage. A line that appeared or changed stops the run. A pull request that did not exist at the start counts as having no answer lines. **Why:** The draft pull request now exists while the build agent works, and on a resume it may already carry verdicts. Without this, the unattended-epic-implementation page's invariant 5, "An answer line that appears during an agent stage stops the run", would have a gap. **Refuted alternative:** none
- **D8 — Review rounds resume by reusing the open pull request and always starting with a full analyze (#996).** After the publish step, the command reuses the open pull request (record #966 G8) and enters the existing loop. Its first round is always a full analyze on the head just pushed, never a reuse of an earlier verdict. Before the loop, the command treats every item that already has a trusted answer line on the pull request as already answered, whether the command or a person wrote it, and posts no inferred answer for it. The round cap and the progress tracking start fresh on each run. Ready marking is unchanged. **Why:** The usual reason to re-run after an escalation stop is a revised record, and a verdict stamped with the old record digest does not judge the head against the record now approved. A full analyze also applies trusted answers, so answers posted by the earlier run take effect in the first round, even when that run stopped before the analyze that would have recorded them. The pull request is the only memory that survives the run, and a trusted answer is what makes an item answered, whoever wrote it. **Refuted alternative:** Skip the first analyze when the newest trusted verdict is already for the current head, and go straight to the answer step and the work list. That saves one analyze run on every resume. It loses because #994 asks for an analyze first, and a record revised since that verdict would be ignored until the next round.
- **D9 — The blocked outcome means "made no commit in this stage", and a blocked stop keeps what is already published (#996).** On a resume, the build prompt's blocked outcome reads "has made no commit in this stage". "Before implementation" items are still done before the first remaining story, and the stage confirms an item is already done rather than doing it again. A blocked line, or a stage failure, stops the run as today. Commits the branch watcher already published stay published, and the status section names them as built. **Why:** The old wording, "has made no commit", is always false on a resumed branch. Keeping published stories on a blocked stop is the point of the epic: the lead unblocks, re-runs, and the build starts from the first remaining story. **Refuted alternative:** none
- **D10 — A re-run that starts no build stage runs no test suite, and says so on the pull request (#996).** When every live story already has its commit, the re-run adds no stage to run the test suite. The status section, and the note made when the pull request is marked ready, say that this run did not run the suite. The lead or CI confirms the suite before merge. **Why:** #993 says such a re-run starts no build stage, and the build stage is where the suite runs today. The lead chose at the clarification gate to keep the re-run free of a new stage and to make the gap visible on the pull request instead. **Refuted alternative:** When a test command is declared, the command runs it itself before the publish step and stops on a non-zero exit. It would catch a broken suite before ready. It lost because it adds a second place that runs tests, outside any agent stage, and still falls back to flagging when no test command is declared.
- **A prPending flag tracks a pending pull-request call apart from the push** (a decision stub the verdict on sameera/nexus#1053 confirmed). **Why:** The watcher returned early once the tip was pushed, so a failed PR call was never retried **Refuted alternative:** Leaving pushedTip unset until the PR call succeeds
- **A failed publish call waits for the tip it failed at to move, except the after-stage tick** (a decision stub the verdict on sameera/nexus#1053 confirmed). **Why:** Retrying every 5 s tick hammered git and gh on a persistent failure **Refuted alternative:** Keep retrying every tick
- **The watcher pushes the checked sha by explicit refspec** (a decision stub the verdict on sameera/nexus#1053 confirmed). **Why:** Pushing branch:branch sent commits made after the check **Refuted alternative:** Re-read the tip right before pushing

## Deviation Rationale

- **Departs from record #996 G12 — sameera/nexus#1053 DV9.** The watcher ticks only every WATCH_MS (5 s) while the stage runs; a story commit made in the last tick window before the agent exits, typically the final story, is pushed only by tick(true) after the build stage has ended. **Why:** G12 cannot be met as written; a commit made in the agent's last moment can only be pushed after the session exits. tick(true) pushes it right after the session ends, and a failed push stops the run, so no checked commit stays local-only. **Accepted by:** @sameera (https://github.com/sameera/nexus/pull/1053#issuecomment-7074685758)

## Waived Stories

none

## Deferred Scope

none
