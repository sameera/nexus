/**
 * The verdict one pull request carries, read by the command the close gate invokes (epic #747,
 * decision record #750, key decision "A rule the gate's verdict depends on moves behind a callable
 * command"). Every case runs against the pinned live payload, because that is the pull request on
 * which a close reported the older verdict's severity counts.
 */

import { describe, expect, it } from "vitest";
import {
    NEWER_VERDICT_AT,
    TWO_VERDICT_PR,
    TWO_VERDICT_REPO,
    proseDisagreeingWithBlock,
    twoVerdictPrPayload,
    verdictBody,
} from "@nexus/pr-acceptance/verdict-fixtures";
import { readPrVerdict } from "./pr-verdict.js";
import { type Runner } from "./run.js";

function ghRunner(doc: unknown): Runner {
    return (cmd, args) => {
        if (cmd === "gh" && args[0] === "pr" && args[1] === "view") {
            return { status: 0, stdout: JSON.stringify(doc), stderr: "" };
        }
        if (cmd === "git") return { status: 0, stdout: "3\n", stderr: "" };
        return { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
    };
}

const read = (doc: unknown) => readPrVerdict(ghRunner(doc), "/repo", TWO_VERDICT_PR, TWO_VERDICT_REPO);

describe("readPrVerdict — newest-wins, executed rather than described", () => {
    it("returns the verdict GitHub timestamped later, whatever order the payload returned the two in", () => {
        const r = read(twoVerdictPrPayload());
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.verdict.found).toBe(true);
        expect(r.verdict.receipt?.findings["high"]).toBe(0);
        expect(r.verdict.at).toBe(NEWER_VERDICT_AT);
    });

    it("still returns the later verdict when it omits the optional toolkit-version key", () => {
        const r = read(twoVerdictPrPayload());
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.verdict.receipt?.nexusVersion).toBeNull();
        expect(r.verdict.receipt?.findings["high"]).toBe(0);
    });

    it("reports the severity counts the machine block carries, not the ones the prose above it states", () => {
        const r = read(twoVerdictPrPayload({ newerBody: proseDisagreeingWithBlock() }));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.verdict.receipt?.findings).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
    });

    it("fails if the older verdict is ever selected again — the counts differ, so the two cannot be confused", () => {
        const r = read(twoVerdictPrPayload());
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.verdict.receipt?.findings["high"]).not.toBe(2);
    });

    it("ignores a later block from someone who is not a maintainer of this repository", () => {
        const r = read(
            twoVerdictPrPayload({
                extraComments: [{ body: verdictBody({ high: 9 }), createdAt: "2026-09-16T04:00:00Z", authorAssociation: "NONE" }],
            }),
        );
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.verdict.receipt?.findings["high"]).toBe(0);
    });

    it("ignores a later block stamping another repository, in either written form", () => {
        for (const repo of ["github.com/geo-nexus/other", "geo-nexus/other"]) {
            const r = read(
                twoVerdictPrPayload({
                    extraComments: [
                        { body: verdictBody({ high: 9, repo }), createdAt: "2026-09-16T04:00:00Z", authorAssociation: "MEMBER" },
                    ],
                }),
            );
            expect(r.ok).toBe(true);
            if (!r.ok) return;
            expect(r.verdict.receipt?.findings["high"], repo).toBe(0);
        }
    });

    it("ignores a later block naming a different pull request", () => {
        const r = read(
            twoVerdictPrPayload({
                extraComments: [
                    { body: verdictBody({ high: 9, pr: 999 }), createdAt: "2026-09-16T04:00:00Z", authorAssociation: "MEMBER" },
                ],
            }),
        );
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.verdict.receipt?.findings["high"]).toBe(0);
    });

    it("reports the verdict as not current, since commits landed after the analyzed commit", () => {
        const r = read(twoVerdictPrPayload());
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.verdict.current).toBe(false);
        expect(r.verdict.staleNote).toContain("landed after analysis");
    });

    it("reports a pull request carrying no verdict as found: false, not as a failure", () => {
        const r = read({ state: "MERGED", headRefOid: "a".repeat(40), reviews: [], comments: [] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.verdict.found).toBe(false);
        expect(r.verdict.receipt).toBeNull();
    });

    it("names a broken tool as a diagnostic rather than reporting no verdict", () => {
        const run: Runner = () => ({ status: 1, stdout: "", stderr: "gh: not authenticated" });
        const r = readPrVerdict(run, "/repo", TWO_VERDICT_PR, TWO_VERDICT_REPO);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-failed");
    });
});
