---
title: "Close Record: Distill a Closed Epic with One Nexus Command"
epic: "#909"
feature: "PR-Driven Delivery"
date: 2026-10-17
nexus_version: 0.115.0
analyze: ran 2026-10-17 @ f4eaac1ff3799db627e84f84880b8810a0de4d5c
record: "#946"
record_hash: 5655a60393d8df1d461971a6371fa46ae9ed03d11c9950ff63e4c61c96638d61
range:
  - repo: sameera/nexus
    pr: 947
    base: 13f1ca1fe6e9be1f311d8a0696fc9f24d080ca70
    head: 9a136c77c47c8abdad2fdbdfa9d4d20fa9b184e0
story_ranges:
  - story: "#910"
    ranges:
      - { repo: sameera/nexus, pr: 947, base: 13f1ca1fe6e9be1f311d8a0696fc9f24d080ca70, head: 9a136c77c47c8abdad2fdbdfa9d4d20fa9b184e0 }
  - story: "#911"
    ranges:
      - { repo: sameera/nexus, pr: 947, base: 13f1ca1fe6e9be1f311d8a0696fc9f24d080ca70, head: 9a136c77c47c8abdad2fdbdfa9d4d20fa9b184e0 }
  - story: "#912"
    ranges:
      - { repo: sameera/nexus, pr: 947, base: 13f1ca1fe6e9be1f311d8a0696fc9f24d080ca70, head: 9a136c77c47c8abdad2fdbdfa9d4d20fa9b184e0 }
  - story: "#945"
    ranges:
      - { repo: sameera/nexus, pr: 947, base: 13f1ca1fe6e9be1f311d8a0696fc9f24d080ca70, head: 9a136c77c47c8abdad2fdbdfa9d4d20fa9b184e0 }
landed_check:
  - story: "#910"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 947, result: unchanged }
  - story: "#911"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 947, result: unchanged }
  - story: "#912"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 947, result: unchanged }
  - story: "#945"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 947, result: unchanged }
---

# Close Record: Distill a Closed Epic with One Nexus Command

## Key Decisions

- **D1 — Ship `nexus distill --pr <N>` as a subcommand of the shipped executable (#946).** The command starts one harness session in the close worktree under the unattended contract. The command itself judges nothing. It never commits, pushes, rebases or resets the branch, and it never writes to an issue or a pull request. **Why:** Adopters install only the npm package, and the `nexus` executable is what they have. It already holds tested helpers for close's pull-request-to-epic resolution, the distillation-branch finder and the worktree registry. All judgment stays in `/nxs.distill`, whose decisions and unattended contract the epic leaves unchanged. **Refuted alternative:** Ship the distill half of `close-epic.sh` as a packaged shell script. It would be a faster port. It loses because the script depends on bash and inline node snippets, parses close's text output and a hand-off note, and has no tests. It would also repeat logic the executable already has, tested.
- **D2 — Find close's state from the pull request, not from a hand-off note (#946).** The command resolves the epic through close's own resolution. It finds the newest distillation branch with close's own finder, and the worktree from git's worktree registry. When the branch exists but no worktree is registered, the command refuses and names `nexus close --pr <N>`, because a re-run of close reopens the worktree on the same branch. **Why:** A lead who ran `nexus close` by hand has no hand-off note. A note is also a second copy of the state, and it goes stale when the worktree is removed. Sharing close's resolution means the two commands cannot disagree about which epic a pull request belongs to. **Refuted alternative:** Have close always write the hand-off note to a fixed place, and have this command read it. The lookup is simpler and needs no network read. It loses because it changes close, keeps a second copy of state that git and GitHub already hold, and the note can name a worktree that no longer exists.
- **D3 — Run every pre-start check before any session exists, cheapest first (#946).** The pre-start checks run in the Mechanism's order before any session starts. Hub and member checkouts are refused, as the script refuses them today. The manual route the refusal names is `/nxs.distill <worktree-path>` from the lead's session, or `/nxs.distill` inside the worktree. **Why:** Each refusal can name a remedy only the command knows, such as `nexus close --pr <N>` or the branch name. A refusal also costs no model session. **Refuted alternative:** Start the session and let the distillation's own first checks stop the run. The rules would live in one place, with less code. It loses because the distillation does not know the pull request, so it cannot name `nexus close --pr <N>`, and every wrong call spends a model session.
- **D4 — Read success only from GitHub, and refuse to start when a distillation pull request is already open (#946).** After the session ends, the runner asks for an open pull request whose head is the distillation branch. It asks the repository the distillation opens its pull request against, from the worktree. An open pull request means success. Anything else is a stop, whatever the session's exit status. A failed GitHub read is reported as an unconfirmed outcome and exits non-zero. A pull request already open before the run refuses the start. **Why:** This is the epic's third success metric. Without the start refusal, a pull request that was already open before the run would be reported as this run's success. **Refuted alternative:** Trust the session's exit status and its final message. That needs no network read. It loses because a session that stopped cleanly exits 0, and the model's own words are what #910's third acceptance criterion forbids relying on.
- **D5 — One runner for both modes, with the run folder in the main checkout (#946).** Foreground and background runs use the same runner. The run folder sits in the main checkout's ignored scratch area, one folder per pull request. The command confirms git ignores the folder before writing to it. In the foreground, the same log is mirrored to the terminal. **Why:** One code path means a background outcome cannot differ from a foreground one. The main checkout is where the lead ran the command and where they will look. The outcome survives removal of the worktree. The distillation's clean-tree check in the worktree is unaffected. **Refuted alternative:** Put the run folder inside the close worktree, next to the distillation's own run folder. Everything about the run would sit in one place. It loses because removing the worktree deletes the outcome, and a lead in the main checkout has to know the worktree path to find it.
- **D6 — Background runs use a detached runner in its own process session (#946).** The detached runner writes a status line to the starting terminal's error stream at a fixed interval, set once in the code, of a few minutes rather than seconds. It writes a final line at the end. A failed write stops further status lines and never stops the run. **Why:** #912 asks for status without the lead having to ask for it. A separate process session keeps the run alive when the lead closes the terminal. It also keeps the status lines from making the terminal stop a background job that writes to it. **Refuted alternative:** Write no lines, and add a status command the lead runs when they want to know. That is quieter and never draws over other programs. It loses because the lead has to remember to ask, which is the same forgetting this epic exists to remove.
- **D7 — Refuse a start while a live run exists for the same pull request (#946).** The command refuses to start while a live-run marker for the same pull request names a process that still exists. **Why:** Background mode makes a second start likely. Two distillations on one branch would each rebase, commit and push, and the second would leave a half-applied branch. The distillation's clean-tree stop does not cover the time before the first run's first write. **Refuted alternative:** none
- **D8 — Select the harness with the existing `--harness claude|codex` option, defaulting to claude (#946).** The command takes the same `--harness` option the install and version commands use. Under codex, the session runs with the workspace-write sandbox, and the repository's shared git folder is added as a writable place, as the script does today. **Why:** The maintainer script supports both harnesses today, and D13 routes it through this command. Dropping codex would take a working path away. The executable already selects harnesses this way. **Refuted alternative:** Support claude only. The surface is smaller. It loses because D13 would then break the maintainer's codex path, and adding codex later re-opens the command's options.
- **D9 — Keep the permission default that `close-epic.sh` uses (#946).** The default is bypass for claude and the workspace-write sandbox for codex. This settles the question the epic's Assumptions left to this record. The command prints the mode before the session starts. The lead can name a different mode for one run. **Why:** A session with no terminal cannot show a permission prompt, so any narrower claude mode turns each unlisted tool call into a denial nobody can approve. The distillation uses ordinary shell utilities beyond git, gh and nexus, so normal runs would stop part-way, which fails the zero-prompt success metric. The inputs the session reads have already passed gates: the hash-verified record, the merged diff and the fingerprint-verified intake body. The explicit consent to open a pull request is already the unattended flag. **Refuted alternative:** Auto-accept edits plus an allowlist of command prefixes. The damage a misbehaving session can do is much smaller. It loses because one command outside the list stops the distillation with nobody to approve it, so the command fails often for reasons unrelated to the epic.
- **D10 — Name one cleanup command, `nexus pr-worktree remove <worktree>` (#946).** The command and the attended worktree form name `nexus pr-worktree remove <worktree>`. The continuation contract's report names a raw `git worktree remove --force` today, and it changes to the same command. **Why:** Every output gives one remedy. The nexus command removes the worktree from the main checkout, so it works from the lead's own checkout, which the worktree form makes the normal place to run it. **Refuted alternative:** Remove the worktree automatically after the pull request opens. It saves the lead a step. It loses because review changes are easiest to make in that worktree, and a stopped run needs the worktree for the attended re-run.
- **D11 — `/nxs.distill` classifies a path argument by what is at the path (#946).** A path argument is a queue entry in this checkout, the worktree form, or a refusal. The worktree form requires all of these: the path is a worktree of the same repository, meaning the same shared git folder; the path is that worktree's root; the worktree is on a distillation branch; and the branch passes today's continuation test. Every run-shape value is then resolved against the worktree, so a member worktree is still refused by the member rule. A queue-entry path that lies inside another checkout is refused, and the refusal names that checkout's root to pass instead. **Why:** The story's usage is a bare path. An entry directory and a worktree root are told apart by what they contain. Resolving the shape from the worktree keeps the hub and member rules exactly as they are inside it. **Refuted alternative:** A separate flag that names the worktree. The intent is explicit and nothing needs classifying. It loses because the story specifies a bare path, and the classification has no ambiguous case, so the flag adds syntax without removing a real ambiguity.
- **D12 — In the worktree form, every phase works through a pinned root (#946).** Each shell command names the worktree explicitly, and each file path is absolute inside it. The clean-tree requirement and the distillation's run folder belong to the worktree, not to the lead's checkout. **Why:** Claude Code resets the shell's directory when a command leaves the session's working directories. The default worktree location is in the system temp folder. So one `cd` at the start would silently send later commands, commits included, into the lead's checkout. The lead's checkout may legitimately have uncommitted work, because they ran this from the session they were working in. **Refuted alternative:** Change into the worktree once at the start and rely on it. It is the simplest instruction. It loses because the reset above makes it wrong in the default layout, and the failure lands writes in the wrong checkout without any error.
- **D13 — `close-epic.sh` starts its distill stage through `nexus distill --pr <N>` (#946).** The script forwards `--background` and the harness to the new command. Its own hand-off check, event formatter and outcome writer are removed. Its merge pre-check and close stage are unchanged. **Why:** Otherwise there are two copies of the distill logic, and one will go stale. **Refuted alternative:** none
- **D14 — `nexus close` names the new command as its next step (#946).** The final next-step line of `nexus close` names `nexus distill --pr <N>` and `/nxs.distill <worktree-path>`. Today, without a hand-off note, it says to change into the worktree and run `/nxs.distill`. The `<N>` is a pull request close itself read. **Why:** The epic exists because the second step is easy to forget. If close keeps pointing at the old manual route, leads will not find the new command. **Refuted alternative:** none
- **Share close's PR-to-epic resolution as one exported function (resolveEpicOfPr), called by close and nexus distill** (a decision stub the verdict on sameera/nexus#947 confirmed). **Why:** D2 requires both commands to resolve a pull request's epic the same way, and a copy would drift **Refuted alternative:** calling runCloseCommand in a read-only mode
- **Run folder .nexus/tmp/distill-run-pr-<N>/ in the main checkout** (a decision stub the verdict on sameera/nexus#947 confirmed). **Why:** G18 needs a name that can never read as epic-<n>, fix-<n> or intake-<n> **Refuted alternative:** reusing the script's close-epic-<N>
- **close-epic.sh execs nexus distill, so a stopped distillation exits non-zero** (a decision stub the verdict on sameera/nexus#947 confirmed). **Why:** the outcome rule, exit status included, belongs to the command (D4, D13) **Refuted alternative:** keeping the script's exit 0 on a stop
- **The already-open pull request check reads GitHub from the worktree with gh pr list --head <branch>** (a decision stub the verdict on sameera/nexus#947 confirmed). **Why:** the start refusal and the success read must ask the same repository (D4) **Refuted alternative:** asking the issues repository
- **The detached runner gets its checked plan through NEXUS_DISTILL_PLAN** (a decision stub the verdict on sameera/nexus#947 confirmed). **Why:** re-running the checks in the child repeats GitHub reads and trips over the parent's own marker **Refuted alternative:** re-invoking distill --pr <N> in the child
- **The worktree form selects the continuation contract through its existing row** (a decision stub the verdict on sameera/nexus#947 confirmed). **Why:** the selection table keeps one row per contract, and the ordinary-load ceiling left about 1 KB **Refuted alternative:** a second row loading the continuation contract at run-shape resolution
- **A session that never started, with a pull request open, is a stop that names the pull request** (a decision stub the verdict on sameera/nexus#947 confirmed). **Why:** G13 forbids success for a session that could not start **Refuted alternative:** reporting it as unconfirmed
- **The live-run marker is taken with an exclusive create (wx)** (a decision stub the verdict on sameera/nexus#947 confirmed). **Why:** two starts at the same instant could both pass the G6 liveness check **Refuted alternative:** a lock directory via mkdir
- **The worktree-form fixes in the base stage are three short clauses, not a new contract row** (a decision stub the verdict on sameera/nexus#947 confirmed). **Why:** the rules must hold before the continuation contract loads, within the load ceiling **Refuted alternative:** loading the continuation contract at run-shape resolution

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
