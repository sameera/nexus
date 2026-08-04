---
title: "Finding Severity"
aliases: ["blocking findings", "advisory findings", "two-severity output", "exit status as the gate", "advisory channel"]
touches: ["concept-page-capacity", "distiller", "drift-advisory"]
last_updated_by: "#220"
status: active
verification: verified
---

# Finding Severity

Concept validation reports two classes of finding: blocking ones that fail the run, and advisories that never do. Every finding line leads with its class, and the closing summary counts the two classes separately. The exit status — not the presence of printed output — is what a consumer gates on.

## How It Works

A finding's class is optional and its absence means blocking, so every check written before the distinction stayed blocking and only a check that opts in is advisory. A run whose findings are all advisories prints them and still exits zero. The one consumer that gates on validation is the drain, and its former rule — any printed finding blocks — was rewritten to read the exit status alone, because otherwise the first advisory would have blocked a drain that has nothing to fix.

An advisory is a signal to read, not a failure to silence: it is carried into the reviewed write for the human rather than edited away. The class is written into each line rather than separated onto its own output stream, because operators and the drain both read a merged transcript, which a label survives and a stream does not.

## Key Invariants

1. Absence of a class means blocking; only a check that opts in is advisory.
2. A run whose findings are all advisories exits zero.
3. The exit status is the sole gate; printed output is never the signal a consumer reads.
4. Every finding line leads with its class, and the summary counts the two classes separately.
5. An advisory is never silenced to quiet the channel; it is carried to the human review.

## Integration Points

- [concept-page-capacity](concept-page-capacity.md) — the capacity thresholds that first needed a non-failing class of finding.
- [distiller](distiller.md) — the consumer whose blocking rule this replaced, now reading the exit status alone.
- [drift-advisory](drift-advisory.md) — the other never-blocking channel, kept separate so one measurement is not split across two commands.

## Decision Log

### 2026-08-04 — #220 — Two severities, one gate

Moving the neighbour list outside the cap required signals that report without failing, so the checks gained a class and the consumer gained one mechanical bit to gate on. The drain previously reasoned over printed output, which is a heuristic; making the process status authoritative demotes the label to what it should be — an explanation for the human reading the transcript. Refuted: stream separation alone, the smallest possible change needing no new vocabulary, rejected because operators and agents routinely merge the two streams. Also refuted: routing both new advisories to the existing never-blocking advisory report, which already exits zero and already owns a slot in the drain — attractive because it avoids touching the blocking rule at all, but the advisory bullet and the blocking one are the same measurement on the same region, so splitting them means two parses and two surfaces, and that report is gated on a registry that not every store has.
