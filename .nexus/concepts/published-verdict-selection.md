---
title: "Published Verdict Selection"
aliases: ["which verdict a pull request carries", "newest-wins verdict", "verdict trust", "repository stamp matching", "superseded verdict"]
touches: ["conformance-gate", "aggregated-epic-receipt", "provenance-reference", "remote-identity-normalization", "pr-driven-flow"]
last_updated_by: "#747"
status: active
verification: verified
---

# Published Verdict Selection

A pull request can carry several published verdicts, because analysis is re-run after a correction. Which one is that pull request's verdict is decided by one callable command every stage invokes, never by prose a stage restates. The command keeps only the blocks it can trust, then takes the newest by the platform's own timestamp.

## How It Works

Every review and comment carrying the verdict marker is collected, each with the timestamp the platform recorded for the review or comment containing it. Untrusted blocks are removed before recency is applied, so an untrusted block can never shadow a trusted older one. A block is trusted when its author is a maintainer of the repository being read, when it names that pull request, and when the repository it stamps is the repository actually queried. Two repository namings match when their owner and name agree and their hosts do not conflict: a host stated on both sides must be equal, and a host stated on one side only is unknown, which neither matches nor rejects. A block stamping no repository predates the stamp and is accepted. What survives is ranked by the platform timestamp alone. The counts a reader then reports are the ones the machine block carries.

## Key Invariants

1. Which verdict a pull request carries is decided by a callable command; no stage restates that rule as prose for a model to execute, and none keeps a hand-selection path as a fallback.
2. Recency is decided only by the platform's timestamp on the review or comment carrying the verdict. No other property may influence which verdict wins.
3. Untrusted blocks are removed before recency is applied, so an untrusted block never shadows a trusted older one.
4. Two repository namings match when owner and name agree and their hosts do not conflict; a host stated on one side only is unknown and never matches a conflicting one.
5. A verdict stamping no repository is accepted; one stamping a different owner or name is rejected in either written form.
6. Repository identity has exactly one comparison, shared by every reader of a published verdict.
7. Every caller names the repository it is reading, so the trust check is never inert.

## Integration Points

- [conformance-gate](conformance-gate.md) — the gate whose pull-request verdict this rule selects, and which reports what the command returns rather than choosing a block itself.
- [aggregated-epic-receipt](aggregated-epic-receipt.md) — the derivation that applies this same trust and recency rule per story, across every candidate pull request.
- [provenance-reference](provenance-reference.md) — the adjacent two-form grammar for naming an issue; this rule is the same shape one level up, for naming a repository.
- [remote-identity-normalization](remote-identity-normalization.md) — supplies the canonical host-qualified identity a verdict stamps, which this rule compares against a possibly bare one.
- [pr-driven-flow](pr-driven-flow.md) — the flow that publishes the verdicts this rule chooses between, one review per pull request.

## Decision Log

### 2026-09-21 — #747 — The rule became a command, and the repository stamp is read in both forms

Two readers of the same published block disagreed about how a repository is written. The gate stamps the host-qualified identity, and the epic-wide derivation compared it against a bare owner-and-name, so it dropped every verdict ever published and reported that no story had been judged. Each reader's own tests encoded its own side of the split, so neither suite could see it. The readers were widened rather than the writer, because a writer-only change fixes nothing already published and a lead cannot re-run analysis on an epic that has shipped; the host also carries the only thing distinguishing two forges hosting the same owner and name. Refuted alternative: strip the host when a block is parsed and leave both readers comparing strings. It loses because it discards the host before the trust check runs, so a verdict from a different forge sharing an owner and name would compare equal.

Separately, a close reported a superseded verdict's severity counts. Both compiled readers rank the live payload correctly, so the reader at fault was the close gate's prose, executed by a model; the later of the two blocks omitted an optional key, and the more complete-looking block won. The rule therefore moved behind a command with no hand-selection path left behind. Refuted alternative: sharpen the prose to say recency is the platform timestamp and nothing else. It loses because the instruction already said to take the newest, so better words are still carried out by a non-deterministic reader and nothing a test can assert.
