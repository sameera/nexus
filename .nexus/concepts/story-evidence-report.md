---
title: "Story Evidence Report"
aliases: ["evidence report", "story fingerprint", "changed since analysis", "unknown story text", "receipt counts for named stories", "covers no story"]
touches: ["aggregated-epic-receipt", "record-digest", "shipped-ledger", "published-verdict-selection", "verdict-repository-scoping", "conformance-gate", "epic-coverage-run"]
last_updated_by: "#827"
status: active
verification: verified
---

# Story Evidence Report

Close prints one report per epic that says, for each story, whether a receipt on a pull request covers it and whether the story's text changed after that receipt was written. A receipt counts only for the stories it names. The report stops close on a failed read and decides nothing else.

## How It Works

Analyze takes a fingerprint of each story's text when it first reads the stories. The fingerprint is the record digest applied to the story's issue body, not its title. Analyze records one fingerprint per named story in the receipt it publishes on the pull request. Before it publishes, the publish check fetches each story again. It refuses the receipt when a fingerprint is missing, extra or different from the current text, or when a story cannot be fetched. The lead then runs analyze again.

Close reads every merged pull request that claims each live story, and the selected receipt on each one. A receipt with an empty or missing story list covers no story, and the report says so once per pull request. Each receipt that names a story is compared with the story's current fingerprint on its own. A different fingerprint reports the story as changed, naming that pull request. A missing fingerprint reports it as unknown. A story no receipt names is reported as having no receipt.

## Key Invariants

1. A receipt counts for exactly the stories it names, and a receipt that names none counts for none.
2. A story fingerprint is the record digest of the issue body as fetched from the issues repository, recorded in full.
3. Every published pull-request receipt carries exactly one fingerprint per named story and no other.
4. Analyze refuses to publish when any fingerprint differs from the current text or a story cannot be read.
5. Changed and unknown are judged receipt by receipt, never against the newest receipt alone.
6. A failed read behind the report stops close before it mines anything, naming the story.
7. The report blocks, waives and re-checks nothing. The shipped-ledger gate stays the only close gate.

## Integration Points

- [aggregated-epic-receipt](aggregated-epic-receipt.md) — supplies the complete read of the pull requests that claim each story, shared by analyze and close.
- [record-digest](record-digest.md) — the one digest program a story fingerprint is taken with, under the same normalisation rule.
- [shipped-ledger](shipped-ledger.md) — the gate that still decides whether the epic can close. Its records carry no fingerprints.
- [published-verdict-selection](published-verdict-selection.md) — chooses the one receipt on each claiming pull request that this report reads.
- [verdict-repository-scoping](verdict-repository-scoping.md) — the publish check this report's fingerprint check joins, at the same boundary.
- [conformance-gate](conformance-gate.md) — the stage that takes the fingerprints and publishes the receipt that carries them.
- [epic-coverage-run](epic-coverage-run.md) — the analyze-side run built on the same read, which stops on a failed read in the same way.

## Decision Log

### 2026-10-01 — #827 — Close reads the receipts on each story's pull requests, and each receipt records the story text it checked

Close used to read only the shipped ledger. It could not tell that a story's text changed after its pull request was analyzed, and a receipt written before a story existed could look as if it covered that story. The report is built by one command that close repeats, because a selection rule restated as prose for a model to execute drifts. A receipt counts only for the stories it names, so a story added later shows up with no receipt and old receipts are not rewritten. The fingerprint reuses the record digest because GitHub can rewrite line endings when it stores a body, and a raw byte hash would report that as a change. Analyze fingerprints at the start of the run and checks again at publish, so the fingerprint describes the text the analysis judged. Close compares each receipt on its own, because a story can ship as a feature and then a fix, each analyzed against different text. Fingerprints go on the pull-request receipt only, because a later epic retires the ledger write. Refuted alternative: put the same per-story facts into the coverage run only and connect close to them later. That builds less now. It lost because the stories state their outcomes as what close reports, and the later epic would inherit an untested way of building the report.
