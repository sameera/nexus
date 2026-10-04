/**
 * The merge pre-check the one-command close script runs before it merges (epic #828, decision
 * record #849, D10). Every case reads a `gh pr view` payload through the one trusted receipt
 * reader, so the result is the one a lead would see for that pull request.
 */

import { describe, expect, it } from "vitest";
import {
    TWO_VERDICT_ANALYZED_HEAD,
    TWO_VERDICT_PR,
    TWO_VERDICT_PR_HEAD,
    TWO_VERDICT_REPO,
    twoVerdictPrPayload,
    verdictBody,
} from "@nexus/pr-acceptance/verdict-fixtures";
import { mergePrecheck } from "./merge-precheck.js";
import { type Runner } from "./run.js";

function ghRunner(doc: unknown): Runner {
    return (cmd, args) => {
        if (cmd === "gh" && args[0] === "pr" && args[1] === "view") {
            return { status: 0, stdout: JSON.stringify(doc), stderr: "" };
        }
        if (cmd === "git") return { status: 0, stdout: "2\n", stderr: "" };
        return { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
    };
}

const check = (doc: unknown) => mergePrecheck(ghRunner(doc), "/repo", TWO_VERDICT_PR, TWO_VERDICT_REPO, TWO_VERDICT_REPO);

/** The live payload, with the pull request still at the head its newer receipt analyzed. */
const atAnalyzedHead = (opts: Parameters<typeof twoVerdictPrPayload>[0] = {}) => ({
    ...twoVerdictPrPayload(opts),
    headRefOid: TWO_VERDICT_ANALYZED_HEAD,
});

describe("mergePrecheck — the four receipt states (D10)", () => {
    it("reports a clean receipt's verdict and allows the merge", () => {
        const r = check(atAnalyzedHead());
        expect(r.result).toBe("clean");
        expect(r.merge).toBe(true);
        expect(r.findings).toEqual({ critical: 0, high: 0, medium: 0, low: 0 });
        expect(r.message).toMatch(/critical 0/);
        expect(r.message).toMatch(/high 0/);
    });

    it("says analysis has not run on a pull request with no receipt, and names /nxs.analyze --pr on it", () => {
        const r = check({ state: "OPEN", headRefOid: TWO_VERDICT_ANALYZED_HEAD, reviews: [], comments: [] });
        expect(r.result).toBe("not-run");
        expect(r.merge).toBe(false);
        expect(r.message).toMatch(/has not run/);
        expect(r.message).toContain(`/nxs.analyze --pr ${TWO_VERDICT_PR}`);
    });

    it("reports blocking findings with their counts and refuses the merge", () => {
        const r = check(atAnalyzedHead({ newerBody: verdictBody({ high: 3 }) }));
        expect(r.result).toBe("blocking");
        expect(r.merge).toBe(false);
        expect(r.findings?.["high"]).toBe(3);
        expect(r.message).toMatch(/high 3/);
    });

    it("reports a failed read as a read failure, never as analysis not having run", () => {
        const failing: Runner = () => ({ status: 1, stdout: "", stderr: "HTTP 502" });
        const r = mergePrecheck(failing, "/repo", TWO_VERDICT_PR, TWO_VERDICT_REPO, TWO_VERDICT_REPO);
        expect(r.result).toBe("read-failure");
        expect(r.merge).toBe(false);
        expect(r.message).toContain("HTTP 502");
        expect(r.message).not.toMatch(/has not run/);
    });

    it("reports a receipt block that cannot be parsed as a read failure", () => {
        const r = check(atAnalyzedHead({ newerBody: "<!-- nexus:analyze-receipt -->\n```yaml\nepic: \"#114\"\n```" }));
        expect(r.result).toBe("read-failure");
        expect(r.merge).toBe(false);
    });

    it("reports a pull request carrying only untrusted receipts as a read failure, never as not run", () => {
        const doc = {
            state: "OPEN",
            headRefOid: TWO_VERDICT_ANALYZED_HEAD,
            reviews: [],
            comments: [{ body: verdictBody({ high: 0 }), createdAt: "2026-09-16T04:00:00Z", authorAssociation: "NONE" }],
        };
        const r = check(doc);
        expect(r.result).toBe("read-failure");
        expect(r.merge).toBe(false);
        expect(r.message).toMatch(/not trusted/);
        expect(r.message).not.toMatch(/has not run/);
    });

    it("reports receipts that belong to another repository's issues as a read failure", () => {
        const doc = atAnalyzedHead({
            olderBody: verdictBody({ high: 0, issuesRepo: "someone-else/docs" }),
            newerBody: verdictBody({ high: 0, issuesRepo: "someone-else/docs" }),
        });
        const r = check(doc);
        expect(r.result).toBe("read-failure");
        expect(r.merge).toBe(false);
    });

    it("takes the trusted receipt when an untrusted one sits beside it", () => {
        const r = check(
            atAnalyzedHead({
                extraComments: [{ body: verdictBody({ high: 9 }), createdAt: "2026-09-16T04:00:00Z", authorAssociation: "NONE" }],
            }),
        );
        expect(r.result).toBe("clean");
    });
});

describe("mergePrecheck — an analyzed head that moved (D10)", () => {
    it("refuses the merge when the receipt's analyzed head is not the pull request's current head, naming re-running analyze", () => {
        const r = check(twoVerdictPrPayload());
        expect(r.result).toBe("head-moved");
        expect(r.merge).toBe(false);
        expect(r.analyzedHead).toBe(TWO_VERDICT_ANALYZED_HEAD);
        expect(r.prHead).toBe(TWO_VERDICT_PR_HEAD);
        expect(r.message).toContain(`/nxs.analyze --pr ${TWO_VERDICT_PR}`);
    });

    it("refuses a moved head even when the receipt it carries is clean", () => {
        const r = check({ ...twoVerdictPrPayload(), headRefOid: "f".repeat(40) });
        expect(r.result).toBe("head-moved");
        expect(r.merge).toBe(false);
    });
});

describe("mergePrecheck — a receipt that records story text (G37)", () => {
    it("reads a receipt carrying story fingerprints, and the fingerprints decide nothing", () => {
        const r = check(atAnalyzedHead({ newerBody: verdictBody({ high: 0, storyFingerprints: "{ 117: deadbeef }" }) }));
        expect(r.result).toBe("clean");
        expect(r.merge).toBe(true);
    });
});
