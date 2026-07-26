---
feature: "Pipeline Command Surface"
feature_path: docs/features/pipeline-command-surface
epic: "Rename /nxs.hld to /nxs.decision-record"
slug: decision-record-command-rename
created: 2026-07-26
type: enhancement
complexity: S
complexity_drivers: [mechanical-rename-sweep, vendored-payload-parity]
concepts: []
link: "#151"
---

# Epic: Rename /nxs.hld to /nxs.decision-record

## Description

Since #139, the design-gate stage no longer produces an HLD document — it files a **decision
record** as an approvable sub-issue of the epic, and every downstream stage (analyze, close,
distill) already speaks "record" language (`nxs-record-digest`, record-hash verification, the
record issue as the drain's *why* source). The command that runs the stage is the last surface
still named for the old artifact: `/nxs.hld`.

This epic renames the command to `/nxs.decision-record` and sweeps every **live** reference to
the old name — commands, agents, skills and their scripts, anchors, templates, contributor docs,
and the Prime pipeline header. Historical documentation (`docs_old/`, the `libs/origin/`
archive, committed queue entries, already-filed issue bodies, superseded/promoted backlog stubs)
keeps the old name: those are records of what was true when written, and rewriting them would
falsify history.

The value is vocabulary coherence: a new user reading the pipeline (`setup → epic →
decision-record → analyze → close`) sees a stage named for what it actually produces, and no doc
sends them to a command that no longer describes its output.

## Success Metrics

- A search for `nxs.hld` across the repository returns zero hits outside the designated
  historical paths and the append-only feature backlogs (whose existing stub bodies are never
  rewritten).
- `/nxs.decision-record` runs the full design-gate flow (including `--from` and `--revise`)
  with behavior unchanged from `/nxs.hld`.
- The vendored component-payload parity check passes with the renamed command file.

## Personas

Per `docs/product/context.md`.

## User Stories

### Story 1: The design-gate command answers to /nxs.decision-record

**As a** delivery lead, **I want** the design-gate command to be named `/nxs.decision-record` and every live pipeline surface to reference it by that name, **so that** the command vocabulary matches the artifact the stage actually produces.

## Acceptance Criteria

- [ ] **Given** the repo's command set, **when** I invoke `/nxs.decision-record` (including `--from <path>` and `--revise`), **then** it runs the design-gate flow formerly under `/nxs.hld` with unchanged behavior.
- [ ] **Given** the rename, **when** I invoke `/nxs.hld`, **then** no such command exists (hard cut — no deprecated alias).
- [ ] **Given** the live pipeline surfaces (`.claude/commands/`, `.claude/agents/`, `.claude/skills/` including their scripts, `.nexus/anchors/`, the decision-record templates, `CLAUDE.md`, `how-to-nexus.md`), **when** searching for `nxs.hld`, **then** zero references remain.
- [ ] **Given** the `needs-design` label, **when** the epic-creation script provisions or documents it, **then** its description names `nxs.decision-record`, and the existing GitHub label's description is updated once to match.
- [ ] **Given** the historical paths (`docs_old/`, `libs/origin/`, committed `.nexus/queue/` entries, superseded/promoted backlog stubs), **when** the sweep completes, **then** those files are byte-identical to before.

## Notes

Machine-facing identifiers already migrated to "record" naming in #139/#147 (no `hld_hash` or `hld:` keys remain in live surfaces), so this story is a textual rename with no data or compatibility migration. Historical documentation and append-only backlog stub bodies are explicitly not edited.

### Story 2: The vendored component payload carries the renamed command

**As a** toolchain maintainer, **I want** the portable component payload re-vendored after the rename, **so that** deployed checkouts receive `/nxs.decision-record` and the drift advisory stays quiet.

## Acceptance Criteria

- [ ] **Given** the renamed command file, **when** the component payload is re-vendored, **then** the parity check and the `libs/portable-tools` test suite pass (pass/fail contract — zero failing tests).
- [ ] **Given** the vendored bundle, **when** its `commands/` subtree is listed, **then** it contains `nxs.decision-record.md` and does not contain `nxs.hld.md`.

### Story 3: The Prime pipeline header shows the renamed stage

**As a** Prime user, **I want** the pipeline-stage header to reflect the renamed command, **so that** the UI vocabulary matches the pipeline I actually run.

## Acceptance Criteria

- [ ] **Given** the Prime header, **when** the pipeline stages render, **then** the stage formerly identified as `hld` reflects the decision-record name and no stage reads "hld".
- [ ] **Given** the rename, **when** the Prime app test suite runs, **then** it passes with the updated stage.

## Notes

The exact chip text (e.g. `decision-record` vs a shortened form that fits the strip) is an implementation choice for the engineer.

## Assumptions

- **Hard cut, no alias.** `/nxs.hld` is removed outright; no deprecated alias is kept. The
  command set is small and self-documenting, and Nexus's lean rule cuts artifacts that force no
  decision.
  entries, already-filed GitHub issue and PR bodies, and superseded/promoted backlog stubs.
  None of these are edited.
- **Proposed (still-live) backlog stubs** that mention `/nxs.hld` (e.g. `pipeline-gh-cli`) are
  also left untouched: the backlog is append-only, and naming is reconciled when a stub is
  promoted.
- No machine-identifier migration is needed — #139/#147 already moved receipts, digests, and
  labels to "record" naming.

## Out of Scope

- Renaming any other pipeline command or the `nxs-record-digest` / related skill names (already
  coherent).
- Rewriting historical documents, filed issue bodies, or drained/committed queue entries.
- Editing existing backlog stub bodies (append-only; reconciled at promotion).

## Open Questions

## Implementation Sequence

| STORY | Issue | blocked_by |
|---|---|---|
| STORY-151.01 | #152 | none |
| STORY-151.02 | #153 | STORY-151.01 |
| STORY-151.03 | #154 | none |
