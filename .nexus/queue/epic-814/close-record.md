---
title: "Close Record: Close and Distill a Merged Epic PR in One Command"
epic: "#814"
feature: "Solo Delivery"
date: 2026-09-27
nexus_version: 0.79.0
analyze: ran 2026-09-27 @ 430d2b4d390a620c6d829c812a1c653b9bb71f98
record: "#818"
record_hash: c90b113b9bf203db74a35a4d74af51a73a90282321ba9a4073cce5f3feadc395
range:
  - repo: github.com/sameera/nexus
    base: 82904939af350d1db0c58dde8474cab59984aa09
    head: a810615c364f0ebb9ac302c80b11f267e2466958
---

# Close Record: Close and Distill a Merged Epic PR in One Command

## Key Decisions

- **The unattended contract lives in its own skill, `nxs-distill-unattended`, not inline in `nxs.distill.md`** (#818 D1, D2). The base stage gained only a one-line flag resolution and one row in its contract selection table. Why: the distill load ceiling pins the bytes an ordinary run loads, and a committed test only lets that ceiling move down. The base file had 13 bytes of headroom, and the inline first draft exceeded it by several kilobytes. The same pressure led to shortening two prose passages in `nxs.distill.md` (unreachable-sha and excluded stores) with the rules unchanged. Refuted alternative: keep the contract inline and record a higher ceiling. The test forbids raising it, and editing the test would defeat the guardrail epic #714 built.
- **Every distillation PR description carries one `## Run summary` section that renders the Phase 6.3 checkpoint layout** (#818 D3). It replaces the separate Anchors and Atlas sections, and it is the same in both modes. An unattended run adds only its first line. Why: one layout cannot drift between modes, and it fits the load ceiling, which had 74 bytes of headroom at that point. Refuted alternative: spell out each run-summary field in the PR body template. That duplicates the checkpoint and exceeds the ceiling.
- **Under `--unattended`, every question point stops the whole run** (#818 D2). The first cut (0.77.0) excluded the affected entry and drained the others; it was corrected in the same PR (0.79.0) so the not-merged waiver and both provenance questions stop the run, as the taxonomy forced fit already did. Why: a question the run would have asked about one entry is still a question nobody answered. A forced fit is detected in a new Phase 3.1 precheck, before any branch is cut, so only a blocking validator finding needs the branch unwind.
- **The close-epic script reads analyze's outcome from GitHub, not from its exit status** (#818 D6). After the headless analyze run, it requires a published verdict on the PR and this PR's shipped record on the epic issue (`nexus epic-verdicts coverage`). Why: a headless `claude -p` or `codex exec` run exits 0 when the stage stops and reports the stop in words, so the exit status cannot tell close whether its shipped-record gate will pass. This fixed analyze's medium finding. Refuted alternative: trust the exit status, which starts a wasted interactive close session that the gate then stops.
- **The hand-off check matches the worktree against `git worktree list --porcelain`, on the note's branch** (#818 D5). Why: checking only that the path is a git directory lets a stale or hand-written note pointing at any checkout pass. This fixed analyze's low finding.
- **The outcome record quotes distill's final message from the stream formatter** (#818 D9). The formatter writes the stage's final message (claude `result`, codex last `agent_message`) to a file named by `FINAL_OUT`; the outcome record quotes it when no PR opened. Success is still read from GitHub. Why: the formatter already sees the final message as one structured field on both harnesses. Refuted alternative: cut the last block out of the rendered log, which differs by harness and can clip or pad the message.
- **Every headless stage the script starts gets an appended "you are running unattended" clause** (#818 D1, R3). It tells the stage never to end on a question and to state what blocked it. It applies to analyze and distill on both harnesses. Why: an omitted answer must never approve an action, and the stage needs to know nobody can reply.
- **The #815 reapply went beyond the hunks of commit 484c86b** (#818 D11). It also rewrote `nxs.close.md` passages added after that commit that still described the local close path (Phase 8.2 durability note, Phase 7 checkpoint list, Phase 9 report, invariants, Usage). Why: leaving them would ship a command file that both refuses without `--pr` and branches on a local mode. Refuted alternative: reapply only the original hunks. Some local-flow wording still remains and is deferred below.

## Deviation Rationale

None. The shipped code matches record #818: G1–G21 hold per the final conformance run, and no decision was contradicted. Record #818 R2 and R3 each promised one end-to-end codex run; that run has not happened yet, and it is filed as deferred scope below rather than recorded as met.

## Waived Stories

none

## Deferred Scope

Deferred items filed as epic stub issues:

- #823 — Verify the close-and-distill command end to end on codex
- #824 — Keep a background distill alive after the terminal closes
- #825 — Remove the remaining local-close wording from /nxs.close

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-27-headless-exit-status-is-not-an-outcome.md`
