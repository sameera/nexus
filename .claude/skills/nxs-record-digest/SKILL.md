---
name: nxs-record-digest
description: Compute the canonical digest of an epic's decision-record sub-issue — the one implementation every stage that stamps or verifies the record hash invokes. Fetches the record body from GitHub, applies the stated canonicalisation rule, and prints the full hexadecimal digest plus the record's approval state. Use from /nxs.decision-record, /nxs.analyze, /nxs.close, and /nxs.distill; never re-derive the value with a shell one-liner.
---

# nxs-record-digest

The **one** digest implementation over an approved decision-record body (epic #139). Four stages
stamp or verify this value — the design stage, the conformance gate, close, and the drain — and each
one obtains it by running this helper.

## Why it is a program

Every stamping stage is a prose command executed by a model, and a digest described in prose is not
reproducible. If each stage took its own hash with a shell one-liner, the canonicalisation rule
would exist once per call site and drift on the first divergence — reporting a design that did not
change as changed, and blocking a close for no reason.

## Usage

```bash
tsx ./.claude/skills/nxs-record-digest/scripts/record_digest.ts --issue <N> [--repo <owner/repo>] [--dir <startDir>]
```

-   `--issue <N>` — the decision-record sub-issue number (required).
-   `--repo <owner/repo>` — read the record from another repository (the resolved epic-repo); omit
    for the invoking checkout's repo.
-   `--dir <startDir>` — the checkout `gh` runs from (default: the current directory).

On success it prints one JSON object:

```json
{ "issue": 141, "repo": null, "state": "closed", "stateReason": "completed", "approved": true, "digest": "<64 hex>" }
```

-   **`approved`** is true only for a record closed as *completed*. A record closed as **not
    planned** is a withdrawn design, not an approval — it blocks exactly as an open record does.
-   **`digest`** is the full lowercase hexadecimal SHA-256. Stamp it whole; no surface ever carries
    a truncated or abbreviated form.

## The canonicalisation rule

Fixed for the lifetime of any stamped receipt. The digest is computed over the record body **as
fetched back from GitHub** — never locally submitted text, which is what stops the platform's own
storage normalisation from making a record stale the instant it is filed — and never over the
title, labels, comments, state, or timeline.

1. Line endings normalise to `\n` (CRLF and lone CR alike).
2. Trailing whitespace is stripped from each line.
3. Trailing blank lines are stripped from the end of the body.
4. **Nothing else.** Interior blank lines, leading indentation, and Unicode form stay significant —
    a rule that forgave editor churn there would also hide genuine edits.

Widening the rule later is a **contract change**, not a patch: any receipt stamped under the old
rule must be regenerated.

## Contract

-   Success prints exactly one JSON object on stdout; a failure prints a `record-digest <problem>:
    <message>` diagnostic on stderr. Exit codes: `0` success · `1` a named diagnostic · `2` usage.
-   **Read-only.** It fetches and hashes; it never edits, closes, comments on, or labels an issue.
-   **Never re-derive the digest another way.** Every stamping or verifying stage runs this helper,
    so the four stages cannot disagree about whether the design changed.
