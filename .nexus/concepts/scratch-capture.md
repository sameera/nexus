---
title: "Scratch Capture"
aliases: ["decision stubs", "in-flight decision capture", "committed scratch", "queue scratch", "plan capture"]
touches: ["committed-queue", "distiller", "nexus-pipeline", "ephemeral-handoff-entry", "close-entry-migration"]
last_updated_by: "#170"
status: active
verification: verified
---

# Scratch Capture

Scratch capture is the committed per-user surface inside an epic's queue entry where an engineer's agent records decision stubs and working notes at the moment of choosing. Being committed carries the rationale to the PR head, visible at analyze and close, yet it stays a pre-checkpoint hint verified against the diff — never load-bearing, never read by the distiller.

## How It Works

An engineer's agent appends a stub — the choice, the why, the refuted alternative — the instant a non-obvious choice is made, into a committed per-user location inside the epic's queue entry. The owning epic resolves from the story issue's parent alone, and capture stays silent when unresolved. Lead-run stages read it as hints only: close mines the stubs as its highest-fidelity why, verifying each against the diff; analyze takes it as soft context that never moves a verdict; notes are weaker still. Close deletes nothing — the scratch is removed only when the distiller drains the epic, and where the close wrote to the ephemeral area this directory is what that removal targets; a member close carries it into the hub entry rather than stranding it.

## Key Invariants

1. Scratch is committed inside the epic's queue entry, keyed by engineer and branch, so it reaches the PR head and writes never collide.
2. A single standing agent rule is the sole capture mechanism — no per-engineer opt-in and no hook.
3. Resolution is issue-only: the epic number comes from the story's parent, never a queue entry or directory name.
4. Scratch is hints, never authority — every stub is verified against the diff before it enters a gated record.
5. A missing scratch directory changes nothing for analyze or close.
6. No stage deletes scratch; only the distiller's drain removes it — and where the entry is ephemeral, this directory is what that removal targets.
7. The distiller never reads per-user scratch; rationale travels only through the gated decision and close records.

## Integration Points

- [committed-queue](committed-queue.md) — the entry the scratch rides inside and drains away with.
- [distiller](distiller.md) — drains the entry but never reads the scratch into a concept.
- [nexus-pipeline](nexus-pipeline.md) — close and analyze consume it as hints; neither deletes it.
- [ephemeral-handoff-entry](ephemeral-handoff-entry.md) — the version-ignored entry whose drain re-aims its removal here.
- [close-entry-migration](close-entry-migration.md) — carries this directory into the hub entry as part of the epic.

## Decision Log

### 2026-07-04 — manual — Scratch capture activated in the weaker form

Rationale reconstructed at close confabulates — the genuinely considered alternative is exactly what memory rewrites — so plans and decisions are captured at the moment they happen, into version-ignored scratch that dodges every objection to queue capture: gate purity, provenance, consent, and coverage. Activated ahead of the original revisit trigger because the failure it prevents is unobservable after the fact, and the cost is near zero. Refuted alternative: hook-appending decisions directly to the queued decision record — full automation of the same fidelity goal, but ungated writes to an artifact whose value is that every line passed a human gate.

### 2026-07-18 — #67 — Scratch moves into the committed queue entry

Decision scratch moved from a gitignored per-branch local directory into committed per-user subdirectories inside the epic's own queue entry. The old location never reached the PR head, so the lead could not see the rationale at analyze or close, and close had to delete it after mining; a per-engineer opt-in hook could not even resolve which epic a decision belonged to. Committing the scratch makes the highest-fidelity why reviewable exactly where decisions are reviewed and lets the existing entry-deletion drain it — no separate cleanup, no branch-to-epic mapping at close — and the standing agent rule replaces the retired hook. Refuted alternative: keep scratch gitignored and local — it stays invisible to the lead and forces a bespoke branch-keyed deletion that the committed model removes for free.

### 2026-07-28 — #157 — Resolution moves from queue/directory matching to the issue graph alone

Under issue-sourced planning an epic's queue entry does not exist until close, so during implementation neither an existing entry nor a directory-name guess had anything to match against — capture silently wrote nothing for the entire implementation phase. Resolution now derives purely from the story issue's parent epic, resolvable at any point in the epic's life. Refuted alternative: keep matching an existing entry and let close reconcile whatever capture found — sound for an epic already committed at planning, but resolves to nothing for every epic filed under issue-sourced planning, which is the defect being fixed.

### 2026-07-31 — #170 — Scratch becomes the target of the drain's committed removal

When a local close stopped committing its artifacts, the deletion that used to ride the distillation had nothing to aim at — and this directory, the one committed thing an implementation still leaves behind, would have accumulated on the trunk for every closed epic with nothing to ever remove it. Re-aiming the removal here preserves the lifecycle unchanged: scratch is still deleted exactly when the distillation merges, still atomically with the page writes. A member close carries it into the hub entry for the same reason, so it is neither stranded in the member repo nor dropped from the entry the hub drain cleans up. Refuted alternative: skip the committed removal entirely, on the grounds that an ephemeral entry has nothing committed to delete — literally true of the entry, but false of the epic, and it would make a pre-existing leak permanent by design.
