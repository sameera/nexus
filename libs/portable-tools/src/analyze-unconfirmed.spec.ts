/**
 * Epic #889, story #893 — analyze marks what it could not confirm and where it looked.
 *
 * Decision record #905, D6 and D9: a criterion or guarantee analyze cannot confirm from the code it
 * read is `unconfirmed`, never met, held, unmet or broken (G16). It names where the stage looked, by
 * file or by surface, and what would confirm it (G17). Unconfirmed items have their own count on the
 * severity line, are listed under Blocked on me as checks the lead makes by hand, and stay out of
 * the open counts the receipt, the merge pre-check, close and the result line read (G18). On a pull
 * request the machine record carries the state, so a run that records answers lists it again (G19).
 * The toolkit half (the judgments block accepts the state) is pinned in the libraries' own specs;
 * these cases pin what the stage says.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components";

const ANALYZE: string = fs.readFileSync(path.join(authoredComponentRoot(import.meta.dirname), "commands", "nxs.analyze.md"), "utf8");

/** Prose wraps at any space, so every phrase check reads the text with its whitespace collapsed. */
function flat(text: string): string {
    return text.replace(/\s+/g, " ");
}

function between(start: string, end: string): string {
    const from = ANALYZE.indexOf(start);
    expect(from, start).toBeGreaterThan(-1);
    const to = ANALYZE.indexOf(end, from + start.length);
    expect(to, end).toBeGreaterThan(-1);
    return ANALYZE.slice(from, to);
}

const CRITERIA = (): string => flat(between("## 2.1 Acceptance-criteria conformance", "## 2.2 Guarantee"));
const GUARANTEES = (): string => flat(between("## 2.2 Guarantee and invariant conformance", "## 2.3 Epic-level judgment"));
const REPORT = (): string => between("Return a concise summary", "A broken guarantee appears on the");
const UNDER_BLOCKED = (): string => between("### Blocked on me", "### Changed");
const UNDER_FOUND = (): string => between("### Found", "Severity:");

describe("a criterion or guarantee analyze cannot confirm is marked unconfirmed (G16)", () => {
    it("classifies such a criterion as unconfirmed, never passed or failed, and no longer as unverifiable here", () => {
        expect(CRITERIA()).toMatch(/\*\*unconfirmed\*\*/);
        expect(CRITERIA()).toMatch(/never (as )?met, partial, unmet or contradicted/i);
        expect(ANALYZE).not.toMatch(/unverifiable here/);
    });

    it("marks a guarantee or invariant it cannot confirm as unconfirmed, never held or broken", () => {
        expect(GUARANTEES()).toMatch(/\*\*unconfirmed\*\*/);
        expect(GUARANTEES()).toMatch(/never (as )?held or broken/i);
    });

    it("keeps unverifiable for a success metric, which asks about a measurement after release", () => {
        expect(flat(between("## 2.3 Epic-level judgment", "## 2.4 Scope drift"))).toMatch(/\*\*unverifiable\*\*/);
    });
});

describe("an unconfirmed item names where analyze looked and what would confirm it (G17)", () => {
    it("says where it looked, by file or by surface, and what would confirm it", () => {
        expect(CRITERIA()).toMatch(/where (it|you|the stage) looked, by file or by surface/i);
        expect(CRITERIA()).toMatch(/what would confirm it/i);
    });

    it("records both in the result's machine form, beside the unconfirmed verdict for criteria and guarantees", () => {
        const draft = flat(between("**Every full run also records each result", "Without a pull request there is no registry"));
        expect(draft).toMatch(/criterion: [^;]*\bunconfirmed\b/);
        expect(draft).toMatch(/guarantee: held\|broken\|unconfirmed/);
        expect(draft).toMatch(/metric: met\|not-moved\|unverifiable/);
        expect(draft).toContain('"looked"');
        expect(draft).toContain('"confirmBy"');
    });

    it("lists each unconfirmed item under Found with where it looked and what would confirm it", () => {
        expect(UNDER_FOUND()).toMatch(/Unconfirmed:[\s\S]*looked[\s\S]*confirm/i);
    });
});

describe("unconfirmed items are counted on their own and never block (G18, G33, G34)", () => {
    it("lists each unconfirmed item under Blocked on me as a check the lead makes by hand", () => {
        expect(UNDER_BLOCKED()).toMatch(/unconfirmed/i);
        expect(UNDER_BLOCKED()).toMatch(/by hand/i);
    });

    it("gives unconfirmed items their own count on the severity line", () => {
        expect(REPORT()).toMatch(/Severity: ⛔ critical <C> · ⚠️ high <H> · medium <M> · low <L> · unconfirmed <U>/);
    });

    it("leaves them out of the open counts the receipt, the merge pre-check, close and the result line read", () => {
        const text = flat(ANALYZE);
        expect(text).toMatch(/unconfirmed[^.]*never (counts?|counted)[^.]*(findings|open counts)/i);
        expect(text).toMatch(/never blocks? the merge pre-check or close/i);
        expect(ANALYZE).toContain("Analyze result: critical=<C> high=<H> medium=<M> low=<L> head=<full 40-hex HEAD>");
    });
});

describe("a run that records answers lists an unconfirmed item again (G19)", () => {
    it("carries the unconfirmed state forward with the results, and the new review lists it", () => {
        const recording = flat(between("## Phase 0.8 — Recording answers", "# Phase 2 — Conformance checks"));
        expect(recording).toMatch(/unconfirmed/i);
    });
});
