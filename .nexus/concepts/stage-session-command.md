---
title: "Stage Session Command"
aliases: ["nexus epic", "nexus decision-record", "nexus analyze", "stage alias commands", "planning stage commands"]
touches: ["harness-model-selection"]
last_updated_by: "#1068"
status: active
verification: verified
---

# Stage Session Command

Three Nexus commands start a planning stage from the shell: one for the epic stage, one for the decision-record stage and one for the analyze stage. Each opens one interactive Claude Code session and hands it the matching slash command with the lead's arguments. The session runs on the planning model, so the lead makes no model choice by hand.

## How It Works

The lead types the command and its arguments. The command checks them, resolves the planning model, and starts one session in the lead's current checkout. The session's first prompt is the stage's slash command followed by the arguments in the order typed. The lead answers the stage's gates in that session, as if the lead had opened it by hand.

The planning model comes from the same settings the implement command reads for its planning session. A model named on the command line for one run wins. That option is removed from the arguments before the prompt is built, so the stage never receives it. The decision-record command accepts the epic as a bare number or with a leading hash, and always hands the stage the hashed form.

Every refusal happens before a session exists. The refusal names the command's usage and exits with a usage error.

## Key Invariants

1. One command starts exactly one session, and the session is interactive. The command passes no headless option and no permission mode.
2. The stage receives the lead's arguments unchanged and in order. The only exceptions are the model option, which is removed, and the decision-record epic, which is written in one form.
3. The planning model is resolved through the same catalogue and layers as the implement command, so one setting governs both.
4. A missing description, a missing or non-numeric epic, a model option without a value, or an unsafe model value refuses the command and starts no session.
5. Only Claude Code is supported. A missing Claude Code program stops the command before any session starts.
6. With no planning model set, the session runs on the harness default model, and the command prints that.

## Integration Points

- [harness-model-selection](harness-model-selection.md) — supplies the planning model these commands start their session on, and the per-run override.

## Decision Log

### 2026-11-24 — #1068 — One shared runner and an inherited terminal for the stage commands

All three commands share one runner, because three copies of model resolution and refusal order would drift apart. The session inherits the lead's terminal and is not read as a stream, because the stages ask the lead questions at their gates. The model option is removed from the stage arguments and passed to Claude Code as its model, because the stage must not receive a token it does not understand. Refuted alternative: one module per command. It lost because the three commands differ only in their slash command and argument checks. A second alternative, reusing the unattended-session stream parser and leaving the model option in the prompt, was refused because that parser serves headless runs and cannot carry an interactive session.
