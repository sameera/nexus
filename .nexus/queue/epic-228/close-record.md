---
title: "Close Record: Pre-epic discovery: /nxs.discover and the fog referral gate"
epic: "#228"
feature: "Pre-Epic Discovery"
date: 2026-08-11
analyze: ran 2026-08-11 @ 4f24a6884a11ba854880bc386c021a9d64a06d91
record: "#235"
record_hash: aba5b72e1e0090b52563d89070a52a9dde3fb1bf81bf7bc2d1176329da9d55f4
range:
  - repo: github.com/sameera/nexus
    base: 8a174b76b3294ce6a7d92148e7bc71b828ca00e0
    head: 45f665a559cafcbb27daf99725ba4b1049fb116b
---

# Close Record: Pre-epic discovery: /nxs.discover and the fog referral gate

## Key Decisions

- **The discovery store moved out of the queue and into `.nexus/discovery/`, mid-epic.** The epic
  body originally placed the store at `.nexus/queue/discover-<slug>-<key>/` and relied on the
  absence of an `epic.md` to keep queue-scanning stages away from it. Record #235, approved after
  that body was written, reverses the placement and refutes the in-queue option by name: location
  is a stronger mechanism than a filename convention that every discovery write would have to
  honour forever, checked during a scan that already walks the whole queue tree. The epic body and
  story #229 were amended on 2026-08-09 to match, so the shipped work reads as planned scope rather
  than drift. **Refuted alternative:** the in-queue folder — it costs nothing to add and inherits
  the distiller's existing exclusion unchanged, but it contradicts the queue's stated contract that
  the queue holds only closed, drainable entries.

- **`/nxs.distill`'s exclusion of the discovery directory moved from out-of-scope into this epic.**
  The epic body listed distiller changes under "Out of Scope". Record #235 invariant 2 puts the
  exclusion inside the decision itself and calls it load-bearing rather than incidental, so the epic
  was amended and the work shipped here: `.nexus/discovery/**` is excluded alongside
  `.nexus/queue/**` in the distiller's prose (both modes), in `derive-entry-diff.ts`, and in the
  range derivation the distiller later recomputes from. Without it, a branch carrying both discovery
  prose and code would feed ungated in-flight reasoning into concept-delta synthesis — the exact
  failure the committed store's risk section accepts a mitigation for.

- **Store filenames and the folder key's shape.** The discovery doc is `discovery.md`, a ticket is
  `ticket-<nn>-<ticket-slug>.md`, and the folder key is 8 lowercase hex characters. A fixed doc name
  is one no stage scans for and needs no derivation from the folder name before a session can read
  it; the numbered ticket prefix gives a stable listing order without encoding dependency order;
  8 hex matches the key shape existing queue entries already use. **Refuted alternative:** naming
  the doc after the slug so the folder reads self-describing — every session would then have to
  derive the doc's name from the folder's name before it could open it.

- **The claim staleness threshold is 24 hours.** A claim has to outlive one working session, so a
  parallel same-machine session cannot steal an in-flight ticket, and has to expire fast enough that
  a claim arriving in someone else's pull does not park a ticket for a week. **Refuted
  alternative:** no fixed threshold, asking the user to judge staleness each time — rejected because
  takeover is the one path a session must be able to take unattended.

- **The no-build lessons note carries full gists, not the resolved-decisions index verbatim.** Each
  index line is a gist that leans on a ticket file to hold the reasoning, and the close commit
  removes every ticket file in the same act. Copying the index verbatim would ship the only durable
  artifact on the no-build path with pointers dead on arrival. The close action therefore writes one
  full gist per index line — Decided, Why, refuted alternative — and drops the `Detail:` clause.
  **Refuted alternative:** copy the index and merely strip the `Detail:` clause — it satisfies the
  copy-not-link invariant while still losing the reasoning outright.

- **The component fingerprint pin rides the last commit that touches `.claude/`.**
  `libs/portable-tools/bundle-fingerprint.json` is re-pinned once, in the final story commit that
  changes `.claude/commands/`, rather than once per story commit. The pin is a derived hash of the
  whole component tree, so a per-commit re-pin rewrites the same line five times and conflicts on
  every replay while buying nothing — only the branch tip is ever vendored. **Refuted alternative:**
  re-pin in each story commit so every commit passes the parity test on its own.

- **The sharpness gate is marked as a mandatory stop with an inline sub-gate label, not a heading
  suffix.** `**Sharpness gate (MANDATORY STOP).**` leads the stop sentence inside the
  `### Sharpness precondition` section, mirroring the open-questions sub-gate label the same
  document already uses. The heading covers both branches — sharp goals (no stop) and underspecified
  (stop) — so marking the heading itself would misstate the sharp-goals branch and fire on every
  intent-mode run. **Refuted alternative:** append `(MANDATORY STOP)` to the heading.

- **The end-to-end path was proved live, against real GitHub, rather than argued.** Story #240's
  last acceptance criterion guards a silent failure: a read that never runs produces a record that
  simply does not mention what the discovery decided, and nothing reports the omission. A throwaway
  hosted repository was provisioned through the acceptance harness, a finished discovery graduated,
  a stub promoted, and the record run against the resulting epic. The first pass could not prove the
  claim, because the architect read the discovery folder off disk while it still existed, so the
  provenance was confounded. The second pass removed the folder first — which is the real lifecycle
  anyway — and the record then carried a decision whose only possible source was the marked comment.

## Deviation Rationale

- **The marked gist comment is posted on the epic issue too, not only on stubs (deviates from
  #235).** Record #235's gist decision and its invariant 9 describe the comment as the one addition
  the discovery entry mode makes to the *stub* emission path, and story #231 AC3 says the ≤ M path
  files no stub at all. Shipped `/nxs.epic` Phase 6b adds a second write site: the epic issue, on
  the direct-plan path. Invariant 5 of the same record requires anything outliving a discovery to be
  copied in full into a durable artifact, and on that path there is no stub body to carry it — the
  folder is removed and the reasoning would be lost outright. Reading the acceptance criterion
  literally would silently drop every decision of a small discovery on the floor. This elaborates a
  case the record left unstated; it refutes nothing the record decided.

- **`/nxs.setup` gained a `.nexus/discovery/` do-not-gitignore bullet (deviates from #235).** No
  story asks for it, and the record's scope names `/nxs.discover`, `/nxs.epic`,
  `/nxs.decision-record`, and `/nxs.distill`. The record's first key decision is that all discovery
  state is committed; that decision is unenforceable if the surface that tells a project which
  `.nexus/` paths must not be ignored omits the new directory. The bullet also states why the store
  is a sibling of the queue rather than a folder inside it, so the placement decision survives
  where a reader will meet it.

- **The discovery exclusion reached the range helpers but not the GitHub file-list cross-check
  (deviates from #235).** Record #235 invariant 2 requires the distiller's behavioral diff to
  exclude the discovery directory, and it does: `range.ts`, `derive-entry-diff.ts`, and
  `verify.ts`'s `changedFileSet` all filter `.nexus/discovery` alongside `.nexus/queue`.
  `prChangedFiles` and `verifyRange`'s `ghFileSetsEqual` cross-check still filter only
  `.nexus/queue`, because they filter GitHub's own file list by string prefix rather than by git
  pathspec — a separate mechanism serving a cross-check, not the distiller-facing gate. The analyze
  finding this fix answered named only the git-diff exclusion list as load-bearing, so extending the
  cross-check was left as a follow-up rather than folded in and widening the diff beyond the finding.
  The consequence is bounded: an acceptance run against a PR touching `.nexus/discovery` reports
  `ghFileSetsEqual: false`, which is not a real mismatch and which `pass` does not include.

## Deferred Scope

Deferred items filed as backlog stub issues:

- #242 — Make the acceptance harness's GitHub file-list cross-check exclude the discovery directory, so a pull request that touches discovery prose is not reported as a range mismatch
- #243 — Constrain what the architect may read when it designs a decision record, so the record's inputs are the ones the command actually gave it

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-08-11-prompt-documents-need-live-runs.md`
