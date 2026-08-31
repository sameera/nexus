/**
 * Story #373 — the run says plainly whether it finished, and exactly how to resume if it did not.
 *
 * The incomplete contract is what callers branch on, so it is asserted end to end: the marker, the
 * named failures, the ledger path, the echoed command and the exit code.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type RunResult } from "../gh";
import { OK, FAIL, checkoutWith, fakePlatform, recordingIo, scratch, story, writeItem } from "./fixtures";
import { LEDGER_NAME } from "./ledger";
import { runCreateStory } from "./run";

const REPO = "acme/tracker";

function issueNumber(args: string[]): string {
    return args.slice(2).find((arg) => /^\d+$/.test(arg)) ?? "";
}

/** A platform that files cleanly unless `answers` says otherwise. */
function platform(answers: (args: string[]) => RunResult | undefined = () => undefined) {
    let next = 100;
    const stored: Record<string, string> = {};
    return fakePlatform((args: string[]): RunResult | undefined => {
        const answer: RunResult | undefined = answers(args);
        if (answer !== undefined) return answer;
        if (args[0] === "issue" && args[1] === "create") {
            const number = String(next++);
            stored[number] = fs.readFileSync(args[args.indexOf("--body-file") + 1], "utf8");
            return OK(`https://github.com/${REPO}/issues/${number}\n`);
        }
        if (args[0] === "issue" && args[1] === "view" && args.includes("body")) return OK(stored[issueNumber(args)] ?? "");
        if (args[0] === "issue" && args[1] === "view") return OK("I_node\n");
        if (args[0] === "issue" && args[1] === "edit") return OK("");
        if (args[0] === "api" && args[3] === ".id") return OK(`900${/issues\/(\d+)/.exec(args[1])?.[1]}\n`);
        if (args[0] === "api" && args[1] === "--method") return OK("{}");
        if (args[0] === "api" && args[1].endsWith("/dependencies/blocked_by")) return OK("");
        return undefined;
    });
}

function repo(): string {
    return checkoutWith({ classification: "labels", "story-repo": REPO, project: "none" });
}

function ledgerExists(root: string): boolean {
    return fs.existsSync(path.join(scratch(root), LEDGER_NAME));
}

describe("a run that finished", () => {
    it("prints the counts for issues, dependencies and body refs against the batch total", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        writeItem(root, "STORY-2.md", story("2", { blocked_by: "[STORY-1]" }, "Follows STORY-1.\n"));
        const io = recordingIo(root);
        expect(runCreateStory([scratch(root)], io, platform().env)).toBe(0);
        const report: string = io.out.join("\n");
        expect(report).toContain("SUMMARY");
        expect(report).toContain("Issues:       2 created, 0 reused, 0 FAILED  (of 2)");
        expect(report).toContain("Dependencies: 1 wired, 0 already present, 0 unresolved, 0 FAILED");
        expect(report).toContain("Body refs:    1 bod(ies) rewritten, 0 unresolved, 0 FAILED");
        expect(report).toContain("✅ Complete");
    });

    it("deletes the resume ledger, and keeps it when asked to", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        expect(runCreateStory([scratch(root)], recordingIo(root), platform().env)).toBe(0);
        expect(ledgerExists(root)).toBe(false);

        const kept: string = repo();
        writeItem(kept, "STORY-1.md", story("1"));
        expect(runCreateStory([scratch(kept), "--keep-manifest"], recordingIo(kept), platform().env)).toBe(0);
        expect(ledgerExists(kept)).toBe(true);
    });

    it("counts a reused issue separately from a created one", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        runCreateStory([scratch(root), "--keep-manifest"], recordingIo(root), platform().env);
        writeItem(root, "STORY-2.md", story("2"));
        const io = recordingIo(root);
        runCreateStory([scratch(root), "--keep-manifest"], io, platform().env);
        expect(io.out.join("\n")).toContain("Issues:       1 created, 1 reused, 0 FAILED  (of 2)");
    });
});

describe("a run that did not finish", () => {
    it("names each failing work item, keeps what it did file, and exits non-zero", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        writeItem(root, "STORY-2.md", story("2"));
        const io = recordingIo(root);
        let creates = 0;
        const gh = platform((args) =>
            args[0] === "issue" && args[1] === "create" && creates++ === 1 ? FAIL("HTTP 403: Forbidden") : undefined,
        );
        expect(runCreateStory([scratch(root)], io, gh.env)).not.toBe(0);
        const report: string = io.out.join("\n");
        expect(report).toContain("⚠️  INCOMPLETE — action required");
        expect(report).toContain("Failed to create (1)");
        expect(report).toContain("- STORY-2.md");
        // The ledger survives an incomplete run — it is the whole point of resuming.
        expect(ledgerExists(root)).toBe(true);
    });

    it("names an unresolved dependency and an unresolved body ref by issue number", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1", { blocked_by: "[STORY-absent]" }, "Follows STORY-nowhere.\n"));
        const io = recordingIo(root);
        expect(runCreateStory([scratch(root)], io, platform().env)).not.toBe(0);
        const report: string = io.out.join("\n");
        expect(report).toContain("Unresolved blocked_by (1)");
        expect(report).toContain("- #100 blocked_by 'absent'");
        expect(report).toContain("Unresolved body refs (1)");
        expect(report).toContain("- #100 references 'STORY-nowhere'");
    });

    it("names the resume ledger and echoes the command to re-run, with the flags it was passed", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1", { blocked_by: "[STORY-absent]" }));
        const io = recordingIo(root);
        const code: number = runCreateStory(
            [
                scratch(root),
                "--root",
                root,
                "--no-project",
                "--classification-label",
                "epic",
                "--retries",
                "5",
                "--retry-base-delay",
                "0.5",
            ],
            io,
            platform().env,
        );
        expect(code).not.toBe(0);
        const report: string = io.out.join("\n");
        expect(report).toContain(`Progress saved to: ${path.join(scratch(root), LEDGER_NAME)}`);
        const echoed: string = report.split("\n").find((line) => line.includes("nexus create-story")) ?? "";
        expect(echoed).toContain(`"${scratch(root)}"`);
        expect(echoed).toContain(`--root ${root}`);
        expect(echoed).toContain("--no-project");
        expect(echoed).toContain("--classification-label epic");
        expect(echoed).toContain("--retries 5");
        expect(echoed).toContain("--retry-base-delay 0.5");
        // The line the port replaces named an interpreter the next epic removes.
        expect(echoed).not.toContain("python");
    });

    it("echoes only the flags the run was actually given", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1", { blocked_by: "[STORY-absent]" }));
        const io = recordingIo(root);
        runCreateStory([scratch(root)], io, platform().env);
        const echoed: string = io.out.find((line) => line.includes("nexus create-story")) ?? "";
        expect(echoed.trim()).toBe(`nexus create-story "${scratch(root)}"`);
    });
});
