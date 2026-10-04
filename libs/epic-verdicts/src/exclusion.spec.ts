import { describe, expect, it } from "vitest";
import { isExcludedStory, waiveStory } from "./exclusion.js";
import { type Runner } from "./run.js";

describe("isExcludedStory — a story marked as shipping without its own pull request (decision record #505)", () => {
    it("is excluded when it carries the resolved no-pr label", () => {
        expect(isExcludedStory(["no-pull-request"], "no-pull-request")).toBe(true);
    });

    it("is case-insensitive, matching the repository's GitHub label namespace", () => {
        expect(isExcludedStory(["No-Pull-Request"], "no-pull-request")).toBe(true);
    });

    it("is not excluded without the label", () => {
        expect(isExcludedStory(["bug", "enhancement"], "no-pull-request")).toBe(false);
    });

    it("is not excluded by a label that merely contains the marker as a substring", () => {
        expect(isExcludedStory(["no-pull-request-followup"], "no-pull-request")).toBe(false);
    });
});

describe("waiveStory — writing the close-time waiver marker (story #502, decision record #509)", () => {
    it("adds the resolved no-pull-request label via gh issue edit, and returns ok", () => {
        const calls: Array<{ cmd: string; args: string[]; cwd: string }> = [];
        const run: Runner = (cmd, args, opts) => {
            calls.push({ cmd, args, cwd: opts.cwd });
            return { status: 0, stdout: "", stderr: "" };
        };

        const result = waiveStory(run, "/repo", 502, "no-pull-request");

        expect(result).toEqual({ ok: true });
        expect(calls).toEqual([{ cmd: "gh", args: ["issue", "edit", "502", "--add-label", "no-pull-request"], cwd: "/repo" }]);
    });

    it("targets the issues repository the story lives in, when close names one (G46)", () => {
        const calls: string[][] = [];
        const run: Runner = (_cmd, args) => {
            calls.push(args);
            return { status: 0, stdout: "", stderr: "" };
        };
        expect(waiveStory(run, "/repo", 865, "no-pull-request", "acme/tracker")).toEqual({ ok: true });
        expect(calls).toEqual([["issue", "edit", "865", "--repo", "acme/tracker", "--add-label", "no-pull-request"]]);
    });

    it("wraps a gh failure into a diagnostic naming the story and the label", () => {
        const run: Runner = () => ({ status: 1, stdout: "", stderr: "gh: issue #502 not found\n" });

        const result = waiveStory(run, "/repo", 502, "no-pull-request");

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.problem).toBe("gh-failed");
            expect(result.error.message).toContain("502");
            expect(result.error.message).toContain("no-pull-request");
        }
    });
});
