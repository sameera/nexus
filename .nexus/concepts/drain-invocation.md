---
title: "Drain Invocation"
aliases: ["unattended drain", "unattended distill", "unattended flag", "who starts a drain", "drain approval"]
touches: ["distiller", "distillation-pr", "close-and-distill-command", "distill-command"]
last_updated_by: "#909"
status: active
verification: verified
---

# Drain Invocation

A drain starts only when the lead asks for it: directly, through the `nexus distill` command after close has finished, or through the close-and-distill command right after an approved close. An ordinary drain asks the lead to approve before it opens its pull request. A drain run with the unattended flag opens its pull request without asking, and that pull request's review is its only approval.

## How It Works

The drain learns that nobody can answer only from the unattended flag on its command line. It never infers that from a session with no terminal. Without the flag, the drain asks every question it would ask today, whoever is watching. With the flag, every point where the drain would ask a question stops the whole run instead: the not-merged waiver, the provenance-repository question, the hub provenance question and the taxonomy forced fit. A forced fit is found before any branch is cut. A stopped run opens no pull request and pushes nothing. If the run already committed on the branch, it removes its own commits, so a branch close prepared is left exactly as close left it. Its final message names each stop and what clears it, usually an interactive re-run. A run that finishes with no stop skips the checkpoint and opens the pull request.

## Key Invariants

1. Draining is invoked by the lead, directly, by the `nexus distill` command after close has finished, or by the close-and-distill command right after an approved close, never by an automated trigger; a run marked unattended opens its pull request without a checkpoint, and that pull request's review is its only approval; recovery from a closed epic issue is an explicit per-entry request, never a discovery scan.
2. The unattended mode comes only from an explicit flag, never from detecting a non-interactive session.
3. An unattended run never answers a question for the lead; every question point stops the whole run.
4. A stopped unattended run pushes nothing and leaves a branch close prepared as close left it.
5. A record-hash mismatch stops that entry with no waiver in every mode, and a blocking validator finding blocks the pull request in every mode.

## Integration Points

- [distiller](distiller.md) — the stage this page governs the starting and approval of, split from that page.
- [distillation-pr](distillation-pr.md) — the pull request whose review is an unattended run's only approval.
- [close-and-distill-command](close-and-distill-command.md) — starts an unattended drain in the worktree close left.
- [distill-command](distill-command.md) — the shipped command that starts an unattended drain in the worktree close prepared, found from a merged pull request.

## Decision Log

### 2026-09-27 — #814 — Split from distiller: an unattended run turns every question into a stop

Split from distiller, whose invocation invariant moved here, rewritten as the decision record gives it. The close-and-distill command starts the drain with nobody to answer. The drain learns that only from an explicit flag, because detection differs by harness: one harness's question tool fails silently without a terminal, and the other's runtime text says an omitted answer never approves an action. Refuted alternative: detect a non-interactive run and skip the checkpoint. It needs no new argument, but it turns an accident, running without a terminal, into consent to open a pull request. Every question becomes a stop for the whole run, because a question asked about one entry is still a question nobody answered. A stopped run removes its own commits, because the drain recognises a branch close prepared only while that branch's commits touch queue and docs files alone. Refuted alternative: answer each question with its recommended option. The provenance-repository question has no recommended answer, and the taxonomy gate forbids a default.

### 2026-10-17 — #909 — The shipped distill command is a third way to start a drain

The lead can now start a drain with the distill command after close has finished, so the starting rule and invariant 1 are rewritten as the decision record gives them, naming it beside the direct request and the close-and-distill command. The command ships in the package every adopter installs, so starting a model session is no longer limited to the lead or the maintainer's script. It still runs only when the lead types it, and it passes the unattended flag on the session's command line, so unattended mode still never rests on a session having no terminal. Refuted alternative: ship the distill half of the maintainer script as a packaged shell script. It was the faster port, but it parses close's text output and has no tests.
