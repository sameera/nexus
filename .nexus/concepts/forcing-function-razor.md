---
title: "Forcing-Function Razor"
aliases: ["over-generation razor", "forcing function test", "artifact razor", "generate-and-persist gates"]
touches: ["two-store-split", "gold-plating", "nexus-pipeline"]
last_updated_by: "bootstrap"
status: active
verification: unverified
---

# Forcing-Function Razor

Every artifact must exist to force a decision a human must make, or it is cut scaffolding. Two independent gates decide an output's fate: a forcing function justifies generating it and stopping on it; separate persistence is earned only when a downstream human reader consumes the committed result.

## How It Works

Each pipeline output is tested twice. First: does it exist to make a human stop and decide? That justifies generating it and halting, nothing more. Second: does a later human reader consume the committed result of that decision? Only the second earns a durable home on the human surface. A pure forcing function is an interaction — spent once answered — so it routinely passes the first gate and fails the second; it survives as an interactive gate that writes no file, as the right-sizing gate, the council, and the consistency check do. Everything passing neither is agent scaffolding and is cut. The razor is a recurring, named audit with fixed verdicts — keep, slim, cut — not a one-time pass, and it is turned on the machine surface as readily as the human one.

## Key Invariants

1. An artifact survives only if it forces a human decision or a later reader consumes its committed result.
2. Generating-and-stopping and persisting-a-file are separate gates; passing the first does not earn the second.
3. A pure forcing function persists nothing — it survives as an interaction, not a file.
4. The razor is a recurring audit with fixed verdicts, never a single pass.
5. Relocating generation without curbing it does not count as removal.

## Integration Points

- [two-store-split](two-store-split.md) — the razor decides what earns a place on the lean human surface.
- [gold-plating](gold-plating.md) — the pattern the razor exists to detect and cut.
- [nexus-pipeline](nexus-pipeline.md) — the razor is applied stage by stage to keep the pipeline lean.

## Decision Log

### 2026-06-10 — bootstrap — 0001 and 0002: the razor sharpened into two gates

Adopted "every artifact is a forcing function for a human decision or it is cut scaffolding" as the governing rule, then sharpened it in the pipeline audit into two independent tests — forcing function (generate and stop) and persistence (a later reader consumes the result). The considered alternative — a single "is this useful?" test — was rejected: usefulness has no boundary and readmits speculative volume, whereas the twin gates cleanly separate a transient interaction from a durable artifact and let most gates write no file at all.
