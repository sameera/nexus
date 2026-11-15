---
title: "Checkout-Only Path Gate"
aliases: ["master directory gate", "checkout-only location", "contrast-marker exemption", "mention versus read", "template master gate"]
touches: ["release-template-lookup", "shipped-payload", "component-invocation-gate"]
last_updated_by: "#1028"
status: active
verification: verified
---

# Checkout-Only Path Gate

No shipped component body may send a stage to a location that resolves only inside the Nexus source checkout. The gate scans the whole shipped payload for mentions of such a location and fails on every one that is a read. A mention governed by a contrast marker in the same sentence is not a read, so a body may still name the location precisely to rule it out.

## How It Works

The first location the gate guards is the source tree's own template master set, which ships in no release. A body that reads it names something that resolves for a maintainer and nobody else, which is why the close stage once appeared to work outside a Nexus checkout and did not.

Since stages read templates from the installed release, the gate also refuses a shipped body that reads a release template from the repository's template folder, or asks the lookup for a template the release does not ship. The release build runs the gate and stops on any finding.

A mention is not a read. Classification looks back from the mention for a contrast word — not, never, rather than, instead of, no longer — inside a governing window that ends at the nearest sentence boundary and is capped by distance too. Bounding by sentence stops a negation in an earlier sentence vouching for a read in a later one.

The whole payload is scanned rather than the prose bodies alone: a location a stage is sent to read is a read whatever kind of file carries it.

## Key Invariants

1. No shipped body reads a location that resolves only inside the Nexus source checkout.
2. A mention governed by a contrast marker in the same sentence is not a read and does not fail the gate.
3. The governing window ends at the nearest sentence boundary, so a negation from an earlier sentence vouches for nothing later.
4. The scanned set is the whole shipped payload, not its prose bodies alone.
5. Every failure names the offending body, its line, and the text found.
6. The gate classifies mentions and never bans the name itself, so a passage naming the location only to rule it out survives.
7. The release build stops on a shipped body that reads a release template from the repository's folder or asks for an unshipped one.

## Integration Points

- [release-template-lookup](release-template-lookup.md) — the one way a shipped stage reaches a template; this gate refuses any other read and any unshipped name.
- [shipped-payload](shipped-payload.md) — the stated set that decides exactly which bodies this gate scans.
- [component-invocation-gate](component-invocation-gate.md) — the sibling build-time scan over the same shipped bodies, checking invocations where this one checks locations.

## Decision Log

### 2026-08-28 — #258 — Classify the mentions instead of banning the name

The removed fallback had to be kept from returning, and the obvious enforcement — refuse any body containing the master location's name — was refuted because a body may name that location precisely to say it is not what a stage reads, and one shipped body uses that shape deliberately; banning the literal name would have forced deleting a passage this work wanted to keep, and the epic's own acceptance criterion says outright that such a passage is not a match. So the gate classifies instead: a mention governed by a contrast word in the same sentence is exempt. The window is bounded by sentence punctuation rather than by distance alone, so a negation belonging to an earlier clause cannot vouch for a read in a later one — distance alone would have made the exemption a loophole that widens with prose length.

### 2026-11-14 — #1028 — The gate also refuses repository template reads and unshipped lookup names, and the release build runs it

Once stages read templates from the installed release, two new mistakes could ship: a stage reading a release template from the repository's own folder, which would quietly bring back the stale copy, and a stage asking the lookup for a template the release does not pack. The gate now refuses both, reusing its mention classification so a sentence that names the repository folder only to rule it out still passes. The folder's non-template files stay outside the check. The release build runs the gate before it clears its output and stops on any finding, because a check that ran only in the test suite would let the release build ship such a stage. Refuted: relying on the existing payload fingerprint pin alone. The pin proves the payload did not change unnoticed, but it cannot show that every name a stage asks for actually ships.
