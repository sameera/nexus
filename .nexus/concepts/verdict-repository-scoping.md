---
title: "Verdict Repository Scoping"
aliases: ["issues repository key", "which repository a story number belongs to", "effective issues repository", "unknown accepts", "rejected candidate", "publish boundary check"]
touches: ["conformance-gate", "aggregated-epic-receipt", "provenance-reference"]
last_updated_by: "#751"
status: active
verification: verified
---

# Verdict Repository Scoping

A published verdict names the stories it covers as bare numbers, so it also names the repository those numbers resolve against. Writing that name is checked at the moment of publishing rather than asked for in prose. Reading it is one comparison every reader of a verdict calls, and a verdict that names no repository is read against the code repository it stamps, which is what every verdict published before the name existed relies on.

## How It Works

Two repositories are in play: the one the analyzed pull request's code lives in, and the one its epic, record and story numbers live in. They are the same in a single repository and differ wherever issues are kept apart from code.

The name was once written only when the two differed, and nothing checked that it had been. That conditional is gone. The name is written on every publish, and immediately before publishing, the gate hands the exact bytes it is about to post to a check that resolves both repositories itself and refuses a body that names neither. A refusal stops the publish; it is never downgraded to a warning.

A reader takes the verdict's effective repository: the name it states, or the code repository it stamps when it states none. An unknown on either side accepts, so nothing published before this existed is rejected. A candidate dropped for belonging elsewhere is named on the way out, because a story reported as carrying no verdict must not look like a story whose verdict was rejected.

## Key Invariants

1. A verdict is never published without naming the repository its story numbers resolve against.
2. The check resolves both repositories itself and judges the exact bytes to be published, on every publish path.
3. A verdict's effective repository is the name it states, or the code repository it stamps when it states none; no third source is consulted.
4. An unknown on either side of the comparison accepts; only two known, differing identities reject.
5. The comparison runs with the other trust checks, before newest-wins, so an untrusted verdict can never shadow a trusted, older one.
6. A dropped candidate is named wherever a reader reports, in every state it reports.
7. Nothing already published is rewritten, retracted or re-ranked.

## Integration Points

- [conformance-gate](conformance-gate.md) — the gate that publishes the verdict; its publish step is the boundary the check sits at, and a refusal there fails the step.
- [aggregated-epic-receipt](aggregated-epic-receipt.md) — the epic-wide derivation, which drops a candidate belonging to another repository with the rest of its trust checks and names it.
- [provenance-reference](provenance-reference.md) — the reference forms; a verdict's story list stays bare because its repository is declared once, immediately above it.

## Decision Log

### 2026-09-21 — #751 — The repository a bare story number belongs to is written on every publish and compared on every read

A verdict stamped only its code repository and named its stories as bare numbers, and readers matched those numbers without asking which repository they belonged to. Two repositories sharing a number cross-matched: on one live epic, a verdict named an epic and a story that existed as unrelated items in the code repository while the real ones lived in the issues repository. The rule that should have prevented it existed as stage prose, and was followed everywhere except the one case it was written for. It is now a check the gate must pass to publish, and the conditional it was guarding — write the name only when the two repositories differ — is deleted rather than verified, because a check that confirms a conditional was applied correctly still contains the conditional. Refuted alternative: keep that conditional and have the check enforce it, which leaves every newly published verdict byte-identical to an old one in the common case. It lost because the reader's fallback has to survive for the whole published population regardless, so omitting the name buys no reader anything it could act on, while keeping the shape that failed.
