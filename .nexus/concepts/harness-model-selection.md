---
title: "Harness Model Selection"
aliases: ["planning model", "implementing model", "harness section", "per-harness models", "model settings"]
touches: ["unattended-epic-implementation", "retroactive-implementation", "publishing-config-resolution", "settings-key-catalogue", "hub-settings-layer", "implement-fix-loop"]
last_updated_by: "#1041"
status: active
verification: verified
---

# Harness Model Selection

The settings file has one section per coding-agent harness, named like the harness, and each section can name a planning model and an implementing model. The implement command resolves both before any agent runs. The implementing model runs the build and every fix round of every run, and the planning model runs only a retroactive run's planning session.

## How It Works

The four model keys are rows in the one key catalogue, each recording its section, so the shared resolver reads them. The order, highest first, is the run's own option, the repository's harness section, the hub's own harness section, and the built-in. The workspace manifest's defaults never carry a model. Only Claude Code's planning model has a built-in: Opus, named by the alias that tracks the newest Opus. With no planning model, planning runs on the implementing model or the harness default, and the run output and the pull request say so. A model the lead passes through to the harness wins over the settings for the stages it reaches. It never reaches the planning or as-built sessions. Analyze gets no model from the command. With nothing set, the command passes no model, as before. A value that starts with a dash, contains whitespace or is declared empty refuses the run and names the layer it came from. An undeclared key in the harness section prints one warning line.

## Key Invariants

1. Model values are resolved only through the shared resolver and the one catalogue.
2. A Codex section never affects a Claude Code run, and a Claude Code section never affects a Codex run.
3. With no implementing model set and no option given, every stage gets exactly the arguments it got before.
4. Every model value is checked before any agent runs and before the branch exists, so no setting can add an option to the coding agent.
5. The planning-model option without the retroactive option, and the implementing-model option beside a passed-through model, are usage errors.
6. A model the account cannot use is found where it fails: planning continues, and a build or fix stage stops, naming the model and its layer.

## Integration Points

- [unattended-epic-implementation](unattended-epic-implementation.md) — resolves both models in its preflight and refuses an unsafe value there.
- [retroactive-implementation](retroactive-implementation.md) — its planning session uses the planning model; its as-built session uses the model planning ran on.
- [publishing-config-resolution](publishing-config-resolution.md) — the precedence chain and shared resolver every model value goes through.
- [settings-key-catalogue](settings-key-catalogue.md) — declares the four model keys, each with the harness section it lives in.
- [hub-settings-layer](hub-settings-layer.md) — a member takes an unset model from the hub's own settings, never from the manifest defaults.
- [implement-fix-loop](implement-fix-loop.md) — each fix round runs on the implementing model; analyze rounds get none from the command.

## Decision Log

### 2026-11-22 — #1041 — Set planning and implementing models per harness

The lead asked for one settings section per harness, each with a planning and an implementing model. A model name only makes sense for one harness, so keying it by section stops a hub's Claude Code model from reaching a Codex run. The keys sit in the one catalogue, so nothing parses settings itself. The implementing model applies to every run, because a team that sets it would otherwise see it ignored in ordinary runs. With no planning model, planning falls back instead of refusing, because the plan is never enforced. A model value becomes an argument to the coding agent and can come from a hub, so a value that could read as an option refuses the run. Refuted alternative: flat keys with a harness prefix inside the GitHub publishing block. That needs no resolver change. It lost because a model choice is not a publishing setting, and prefixed keys hide the grouping by harness the lead asked for.
