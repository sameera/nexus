---
feature: "Pipeline Command Surface"
feature_path: docs/features/pipeline-command-surface
epic: "Start the epic, decision-record and analyze stages from nexus commands"
slug: nexus-stage-alias-commands
created: 2026-11-22
type: enhancement
complexity: S
complexity_drivers: [three thin commands that each start one Claude Code session, reuses the planning model nexus implement already resolves]
concepts: []
link: "#1068"
---

# Epic: Start the epic, decision-record and analyze stages from nexus commands

## Description

Three Nexus stages run only as slash commands today: `/nxs.epic`, `/nxs.decision-record` and `/nxs.analyze`. To run one, the lead opens Claude Code, picks a model by hand, and types the slash command. Other stages, such as `nexus close`, `nexus distill` and `nexus implement`, already start from the shell.

This epic adds `nexus epic`, `nexus decision-record` and `nexus analyze`. Each command starts one interactive Claude Code session on the planning model and hands it the matching slash command with the lead's arguments. The lead then answers the stage's gates in that session, as before.

The value is one entry point. The lead runs every stage from `nexus`, and the planning stages always run on the model the team chose for planning, not on whatever model the last session used.

## Success Metrics

- A lead starts each of the three stages with one `nexus` command and makes no model choice by hand.
- Each command starts the same session the lead would have started by hand: the same stage, the same arguments, the same model.

## Personas

Per `docs/product/context.md`.

## Smallest Usable Version

nexus epic starts /nxs.epic on the planning model; nexus decision-record starts /nxs.decision-record on the planning model; nexus analyze starts /nxs.analyze on the planning model

## User Stories

### Story #1069: nexus epic starts /nxs.epic on the planning model

**As a** lead, **I want** to run `nexus epic "<description>"`, **so that** planning starts on the planning model without my opening Claude Code and choosing a model by hand.

## Acceptance Criteria

- [ ] **Given** a capability description, **when** the lead runs `nexus epic "<description>"`, **then** an interactive Claude Code session starts on the planning model with `/nxs.epic <description>` as its first prompt.
- [ ] **Given** arguments such as `--from #<n>`, `--assets <path>` or a bare issue number, **when** the lead runs `nexus epic` with them, **then** `/nxs.epic` receives them unchanged and in the order typed.
- [ ] **Given** the lead names a model with `--planning-model <model>`, **when** `nexus epic` runs, **then** the session runs on that model instead of the configured one.
- [ ] **Given** no arguments, **when** the lead runs `nexus epic`, **then** the command refuses, names its usage, and starts no session.

### Story #1070: nexus decision-record starts /nxs.decision-record on the planning model

**As a** lead, **I want** to run `nexus decision-record <epic>`, **so that** the decision record is drafted on the planning model from one shell command.

## Acceptance Criteria

- [ ] **Given** an epic issue number, **when** the lead runs `nexus decision-record <N>`, **then** an interactive Claude Code session starts on the planning model with `/nxs.decision-record #<N>` as its first prompt.
- [ ] **Given** the epic written as `N` or as a quoted `'#N'`, **when** the lead runs `nexus decision-record`, **then** both forms start the same session.
- [ ] **Given** further arguments such as `--from <path>` or `--revise`, **when** the lead runs `nexus decision-record` with them, **then** `/nxs.decision-record` receives them unchanged.

### Story #1071: nexus analyze starts /nxs.analyze on the planning model

**As a** lead, **I want** to run `nexus analyze --pr <N>`, **so that** the conformance check of a pull request starts on the planning model from one shell command.

## Acceptance Criteria

- [ ] **Given** a pull request number, **when** the lead runs `nexus analyze --pr <N>`, **then** an interactive Claude Code session starts on the planning model with `/nxs.analyze --pr <N>` as its first prompt.
- [ ] **Given** further arguments such as `--resolve`, **when** the lead runs `nexus analyze` with them, **then** `/nxs.analyze` receives them unchanged.
- [ ] **Given** the lead runs `nexus --help`, **when** the help prints, **then** it lists `nexus analyze` with the slash command it starts.

## Assumptions

- The planning model is the one `nexus implement` already resolves for its planning session, so one setting governs both.
- Each session is interactive, because every stage it starts asks the lead at its gates.
- Each session runs in the lead's current checkout and permission mode, as a session the lead opened by hand would.

## Out of Scope

- Commands for the other stages that have no `nexus` command yet, such as `/nxs.hld`, `/nxs.discover`, `/nxs.fix` and `/nxs.intake`.
- Running these stages on the Codex harness.
- Running these stages unattended or in the background.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #1069 | none |
| #1070 | #1069 |
| #1071 | #1069 |
