/**
 * The **one** digest implementation over an approved decision-record body (epic #139,
 * STORY-139.02). Four stages stamp or verify this value — the design stage, the conformance gate,
 * close, and the drain — and every one of them is a prose command executed by a model. A digest
 * described in prose is not reproducible, so the value must come from a deterministic program that
 * all four invoke; a per-call-site shell one-liner would carry the canonicalisation rule once per
 * site and drift on the first divergence, reporting a design that did not change as changed and
 * blocking a close for no reason.
 *
 * **The canonicalisation rule** (decision-record Invariant 8) — stated, not incidental, and fixed
 * for the lifetime of any stamped receipt:
 *
 * 1. line endings normalise to `\n` (CRLF and lone CR both);
 * 2. trailing whitespace is stripped from each line;
 * 3. trailing blank lines are stripped from the end of the body;
 * 4. **nothing else.** Interior blank lines, leading indentation, and Unicode form are all
 *    significant — a rule that forgave them would also hide genuine edits.
 *
 * The digest is SHA-256, emitted in full lowercase hexadecimal. No surface ever carries a truncated
 * form (Invariant 9): two representations of one value in the record of what was approved is
 * exactly the ambiguity this program exists to remove.
 *
 * The input is always the body **as fetched back from GitHub**, never locally submitted text
 * (Invariant 7) — see fetch.ts, which is how every caller should obtain it.
 */

import { createHash } from "node:crypto";

/** Apply the stated canonicalisation rule to a record body. Pure; the whole rule lives here. */
export function canonicalizeRecordBody(body: string): string {
    return body
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((line) => line.replace(/[ \t]+$/, ""))
        .join("\n")
        .replace(/\n+$/, "");
}

/** The canonical digest of a record body: full lowercase hex SHA-256 over its canonical form. */
export function recordDigest(body: string): string {
    return createHash("sha256").update(canonicalizeRecordBody(body), "utf8").digest("hex");
}
