---
title: "Scratch Capture"
aliases: ["decision stubs", "in-flight decision capture", "committed scratch", "queue scratch", "plan capture"]
touches: ["committed-queue", "distiller", "nexus-pipeline"]
last_updated_by: "#67"
status: active
verification: verified
---

# Scratch Capture

Scratch capture is the committed per-user surface inside an epic's queue entry where an engineer's agent records in-flight decision stubs and working notes at the moment of choosing. Because it is committed, the rationale reaches the PR head — visible to the lead at analyze and close — yet stays a pre-checkpoint hint verified against the diff, never load-bearing, and never read by the distiller.

## How It Works

An engineer's agent appends a stub — the choice, the why, the refuted alternative — the instant a non-obvious choice is made, into a committed per-user location inside the epic's queue entry, keyed by engineer and branch so concurrent writers never collide. It resolves the owning epic silently and writes nothing when it cannot. A single standing agent rule is the sole mechanism — no per-engineer opt-in, no capture hook. Lead-run stages read it as hints only: close mines the stubs as its highest-fidelity why, verifying each against the diff and dropping any it contradicts; analyze may read it as soft context but never lets it move a verdict; notes are weaker still. Close deletes nothing — the scratch is removed only when the distiller drains the whole entry.

## Key Invariants

1. Scratch is committed inside the epic's queue entry, keyed by engineer and branch, so it reaches the PR head and concurrent writes never collide.
2. A single standing agent rule is the sole capture mechanism — no per-engineer opt-in and no hook.
3. The agent resolves the owning epic silently and writes nothing when it cannot.
4. Scratch is hints, never authority — every stub is verified against the diff before it enters a gated record.
5. Analyze may read it as soft context but never changes a verdict; a missing scratch directory changes nothing.
6. No stage deletes scratch — close retains it; it is removed only when the distiller drains the entry.
7. The distiller never reads the per-user scratch; rationale travels onward only through the gated decision and close records.

## Integration Points

- [committed-queue](committed-queue.md) — the scratch rides inside the committed entry and drains away with it, not a separate ungated surface.
- [distiller](distiller.md) — drains the entry that carries the scratch but never reads the per-user scratch into a concept.
- [nexus-pipeline](nexus-pipeline.md) — close and analyze consume it as hints; close retains it, and no stage deletes it.

## Decision Log

### 2026-07-04 — manual — Scratch capture activated in the weaker form

Rationale reconstructed at close confabulates — the genuinely considered alternative is exactly what memory rewrites — so plans and decisions are captured at the moment they happen, into version-ignored scratch that dodges every objection to queue capture: gate purity, provenance, consent, and coverage. Activated ahead of the original revisit trigger because the failure it prevents is unobservable after the fact, and the cost is near zero. Refuted alternative: hook-appending decisions directly to the queued decision record — full automation of the same fidelity goal, but ungated writes to an artifact whose value is that every line passed a human gate.

### 2026-07-18 — #67 — Scratch moves into the committed queue entry

Decision scratch moved from a gitignored per-branch local directory into committed per-user subdirectories inside the epic's own queue entry. The old location never reached the PR head, so the lead could not see the rationale at analyze or close, and close had to delete it after mining; a per-engineer opt-in hook could not even resolve which epic a decision belonged to. Committing the scratch makes the highest-fidelity why reviewable exactly where decisions are reviewed and lets the existing entry-deletion drain it — no separate cleanup, no branch-to-epic mapping at close — and the standing agent rule replaces the retired hook. Refuted alternative: keep scratch gitignored and local — it stays invisible to the lead and forces a bespoke branch-keyed deletion that the committed model removes for free.
