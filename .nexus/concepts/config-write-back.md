---
title: "Config Write-Back"
aliases: ["publishing config seeding", "config write-back", "gap-fill persistence", "setup config seed", "surgical settings merge"]
touches: ["publishing-config-resolution", "settings-key-catalogue"]
last_updated_by: "#351"
status: active
verification: verified
---

# Config Write-Back

Config write-back is how the declared publishing block comes to exist without anyone hand-authoring it: setup seeds it at bootstrap while a human can resolve ambiguity, and the first unattended fallback run persists what it just reached. Both producers write only absent keys, leaving every declared value untouched. The write merges in place and is left uncommitted for review.

## How It Works

A declared block is only useful once it exists, and the repos that most need one are those bootstrapped before it did. Two producers close that gap from opposite ends.

Setup runs with a human present, so it can probe classification, list the owner's candidate projects, ask which applies when several match, and fall back to safe values when the tooling is unreachable — recording that it did so, for later review. It never re-runs on an already-bootstrapped repo.

Runtime write-back is the unattended net for exactly those repos: the first time one falls back, it persists the classification and project it resolved, so the fragile discovery runs at most once. It fills only gaps — a declared discovery mode keeps re-discovering, a declared absence stays absent. It never records a concrete target for the current repo, since an absent target is the durable way to say "wherever this repo is" and survives a rename.

Either write merges into the settings file surgically, leaving unrelated sections, comments, and formatting intact, and stays uncommitted so the operator reviews it.

## Key Invariants

1. Write-back fills only keys that were absent; any declared value, including an explicit discovery or an explicit absence, survives untouched.
2. Write-back never records a concrete target for the current repo, so an absent target keeps meaning the current repo across a rename or move.
3. Setup seeds proactively and may ask before writing an ambiguous choice; the unattended path never asks.
4. When the tooling is unreachable, setup seeds safe defaults and records why, rather than probing further.
5. The write is surgical: unrelated sections, comments, and formatting in the settings file are preserved.
6. The write is left uncommitted and surfaced for review, never staged or committed automatically.
7. The outcome of the issue being filed is unchanged by the write that accompanies it.

## Integration Points

- [publishing-config-resolution](publishing-config-resolution.md) — populates the declared block that resolver reads, persisting only values it resolved and only where the block was silent.
- [settings-key-catalogue](settings-key-catalogue.md) — the one declaration these producers translate through, so a key they can resolve is a key they can seed.

## Decision Log

### 2026-07-24 — #121 — Two producers, gap-fill only, never pinning the current repo

Keeping both producers is the decision: setup has a human present, so it alone can disambiguate a repo with several candidate projects and can record a deliberate fallback when the tooling is offline — judgment no unattended run should exercise. But setup never re-runs on repos bootstrapped earlier, which would leave exactly those discovering forever, so the unattended gap-fill is the net that closes it. Gap-fill-only is the second decision: a declared value is operator intent, and freezing an explicit discovery mode to its discovered result would silently revoke an opt-in to re-discovery, so filling absent keys is the only write that is always safe. The current repo is deliberately never pinned — an absent target is the expression that survives a rename, where a concrete one strands publishing. Refuted alternatives: unattended write-back alone with no setup seeding — rejected because it forfeits human disambiguation and acts only after the first failure rather than deciding up front while someone is watching; and persisting every resolved value after every run, including pinning the current repo — rejected because it overwrites deliberate choices and breaks on a rename, turning a convenience into a surprise.

### 2026-08-28 — #351 — Reciprocal link from settings-key-catalogue

Both producers now translate the resolver's names back to written ones through the catalogue's derived inverse. The hand-maintained inverse they used before had drifted, so a key a consumer could resolve was one these producers silently could not seed.
