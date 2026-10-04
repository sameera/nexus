/**
 * An engineer answers a departure or a finding on the pull request (epic #829, story #860,
 * decision record #871, D3, D4; G9–G17). Reading and applying the answers is the toolkit's — the one
 * waiver reader and `nexus verdict-items` — so these cases pin what the stages now say about them:
 * analyze never reads an answer itself, names every one it did not apply, counts only open items
 * and never writes its own listing in the answer form; close has no override left.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { parseAnswerLines } from "@nexus/pr-acceptance/waiver";
import { authoredComponentRoot } from "./vendor-components";

const COMMANDS = path.join(authoredComponentRoot(import.meta.dirname), "commands");
const ANALYZE: string = fs.readFileSync(path.join(COMMANDS, "nxs.analyze.md"), "utf8");
const CLOSE: string = fs.readFileSync(path.join(COMMANDS, "nxs.close.md"), "utf8");

function between(text: string, from: string, to: string): string {
    const start = text.indexOf(from);
    expect(start).toBeGreaterThan(-1);
    const end = text.indexOf(to, start + from.length);
    expect(end).toBeGreaterThan(start);
    return text.slice(start, end);
}

const ANSWERS = (): string => between(ANALYZE, "## 2.6 Answers on the pull request", "# Phase 3");
const CLOSE_GATE = (): string => between(CLOSE, "## 1.2 Conformance analysis ran", "## 1.3 Workspace preflight");

describe("analyze applies the answers on the pull request through the toolkit (D3)", () => {
    it("documents the one-line answer form and the verb each kind of item takes", () => {
        expect(ANSWERS()).toMatch(/the ID, a dash, a verb, a colon and a reason/);
        expect(ANSWERS()).toMatch(/\*\*accepted\*\* for a departure, \*\*waived\*\* for a \*\*critical or high\*\*\s+finding, \*\*approved\*\* for a deferred-scope proposal/);
        expect(ANSWERS()).toMatch(/A reason is required for accepted and waived/);
    });

    it("never reads an answer itself: the ID step reads them through the one waiver reader", () => {
        expect(ANSWERS()).toMatch(/\*\*You never read answers yourself\.\*\*/);
        expect(ANSWERS()).toMatch(/one waiver reader close\s+uses/);
        expect(ANSWERS()).toMatch(/newest\s+trusted answer per ID wins/);
    });

    it("names every answer that applied nothing, with why, and an untrusted one accepts nothing (G10, G11)", () => {
        for (const why of ["untrusted", "unknown-id", "wrong-verb", "no-reason", "not-waivable"]) expect(ANSWERS()).toContain(`\`${why}\``);
        expect(ANSWERS()).toMatch(/\*\*Name every unapplied answer in the verdict\*\*/);
        expect(ANALYZE).toMatch(/Answers not applied:/);
    });

    it("keeps a stub from answering a departure (G4)", () => {
        expect(ANSWERS()).toMatch(/A decision stub\s+explains a departure and answers nothing/);
    });

    it("lists an answered item with who answered and the link (G9, G15)", () => {
        expect(ANALYZE).toMatch(/DV<n> \(<critical\|high>\) accepted by @<who> \(<link>\): <reason>/);
        expect(ANALYZE).toMatch(/F<n> \(<critical\|high>\) waived by @<who> \(<link>\): <reason>/);
    });
});

describe("the counts cover only open items, and the review follows them (D4; G14–G16)", () => {
    it("writes the open counts the ID step printed into the Severity line and the machine block", () => {
        expect(ANSWERS()).toMatch(/\*\*The severity counts are the open counts\*\*/);
        expect(ANSWERS()).toMatch(/never totals/);
        expect(between(ANALYZE, "## PR mode — publish a review", "2. **Check the drafted body")).toMatch(/`findings:` is the `open` counts/);
    });

    it("approves or requests changes from the open counts", () => {
        expect(between(ANALYZE, "3. Publish it as a **PR review**", "**Fallback:**")).toMatch(/no open critical\/high item/);
    });

    it("hands every finding to the ID step, so each has an F ID that can be waived", () => {
        expect(ANALYZE).toMatch(/"findings": \[ \.\.\. \] \}/);
        expect(ANALYZE).toMatch(/each finding its `F<n>` ID/);
    });
});

describe("the verdict's own listing never reads as an answer (G12)", () => {
    it("writes no line of the report template in the answer form, whatever the IDs", () => {
        const template = between(ANALYZE, "Return a concise summary:", "A broken guarantee appears on the");
        const concrete = template.replace(/DV<n>/g, "DV1").replace(/F<n>/g, "F1").replace(/<ID>/g, "DV1");
        expect(concrete).toMatch(/DV1 \(/);
        expect(parseAnswerLines(concrete)).toEqual([]);
    });
});

describe("close offers no blocking-findings override (D4; G17)", () => {
    it("stops on a blocking receipt with no override and never asks the lead to proceed", () => {
        expect(CLOSE_GATE()).not.toMatch(/Override and close/);
        expect(CLOSE_GATE()).not.toMatch(/AskUserQuestion/);
        expect(CLOSE_GATE()).toMatch(/close offers \*\*no override\*\*/);
        expect(CLOSE).not.toMatch(/explicit user override/);
    });

    it("names answering on the pull request, then a run of analyze to record the answers", () => {
        const gate = CLOSE_GATE();
        const answer = gate.search(/answer each open item \*\*on the pull request\*\*/);
        const record = gate.search(/run analyze on that pull request again to record the answers/);
        expect(answer).toBeGreaterThan(-1);
        expect(record).toBeGreaterThan(answer);
    });
});
