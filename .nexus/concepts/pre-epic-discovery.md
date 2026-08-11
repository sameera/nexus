---
title: "Pre-Epic Discovery"
aliases: ["discovery", "decision ticket", "discovery store", "foggy initiative", "underspecified initiative", "discovery loop"]
touches: ["nexus-pipeline", "committed-queue", "distiller", "pr-driven-flow", "discovery-graduation", "fog-referral-gate"]
last_updated_by: "#228"
status: active
verification: verified
---

# Pre-Epic Discovery

Pre-epic discovery is the stage that runs before an epic is planned, and only when the initiative is underspecified, meaning the split itself hangs on decisions nobody has made. It is a multi-session loop whose unit is the decision ticket: a question whose resolution is a decision, never a slice of build work. Its state is a committed folder that sits outside the queue, and the stage creates no issue, comment, or label at any point.

## How It Works

A discovery starts by fixing its destination and confirming its feature once, then creating its folder: a discovery document plus one file per decision ticket. Discovery is done when every functional goal is sharp enough to file as a backlog stub of size M or smaller. Each later session claims one open, unblocked ticket, routes it by its recorded type to machinery Nexus already has, appends the resolution to that ticket, appends one gist line to the document's index, commits, and stops. An agent's output is recorded as evidence and is never a resolution, because a fact is not a decision. A suspicion that cannot yet be phrased as a question waits in a not-yet-specified section until some resolution makes it statable. Work ruled beyond the destination moves out of scope and never returns. Because the folder is committed, a discovery is shared by ordinary version-control operations, with no review gate and no rule about who may work it. A discovery whose resolutions conclude that no build follows ends with a dated lessons note.

## Key Invariants

1. Discovery creates no issue, comment, or label at any point in its life.
2. The store is a committed folder outside the queue, so no stage that scans the queue can reach it, and the drain excludes it from the diff it distills from.
3. A decision ticket is a question whose resolution is a decision, never a slice of build work.
4. One decision is resolved per session and that session commits it; research agents may run in parallel and resolve nothing.
5. Only a session resolves a ticket and writes its index line; an agent's output is evidence.
6. The destination is fixed for the life of a discovery; changing it means closing this discovery and starting another.
7. The resolved-decisions index is append-only and order-insensitive, and stays reconstructible from the ticket files.

## Integration Points

- [nexus-pipeline](nexus-pipeline.md) — the pipeline this stage runs before, and only when the initiative is foggy.
- [committed-queue](committed-queue.md) — the sibling surface this store deliberately sits outside, because that queue holds only closed, drainable entries.
- [distiller](distiller.md) — excludes this store from the diff it distills from, so ungated reasoning never becomes a concept.
- [pr-driven-flow](pr-driven-flow.md) — carries the same exclusion in the range it stamps, so a range holding only discovery prose is refused as empty.
- [discovery-graduation](discovery-graduation.md) — where a finished discovery becomes issues, since this stage files none itself.
- [fog-referral-gate](fog-referral-gate.md) — the test in the epic stage that refers an underspecified intent here.

## Decision Log

### 2026-08-11 — #228 — Discovery becomes a stage, over a committed store outside the queue

Nexus answered an underspecified initiative the same way it answered an oversized one, by decomposing it into work-shaped stubs, which assumes the split is already knowable. A pre-epic stage was added so that the decisions the split hangs on become tracked work instead. Its state is committed because discovery is the stage most likely to need more than one person: committing makes the whole loop shareable with version control alone, and it survives the loss of any one machine. The store sits outside the queue because the queue holds only closed, drainable entries, and a discovery is never closed and never drained. Refuted alternative: a committed folder inside the queue carrying no planning file, which costs nothing to add and inherits the drain's existing exclusion unchanged — rejected because it contradicts the queue's stated contract, and because its invisibility would then rest on a filename convention checked during a scan that already walks the whole queue tree. Refuted alternative: a machine-local, ignored store — the cheapest option, and it keeps the trunk clear of in-flight speculation, but a store on one person's disk cannot be handed to a domain expert and does not survive that machine. Refuted alternative: an issue-backed store, with a discovery issue, ticket sub-issues, native blocking, and assignee claims — still the better end state for visibility, and it gets blocking and claiming for free, but it creates two new issue classes plus resolver keys and labels, creates a concurrency problem on a shared issue body, and produces permanent public artifacts for a loop nobody has yet run against a real foggy initiative.
