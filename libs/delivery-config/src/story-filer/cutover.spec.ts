/**
 * Story #374 — the toolkit answers `create-story` itself.
 *
 * The whole cut-over is one binding, so what is asserted here is what the binding changes: the
 * capability runs in process, no interpreter is spawned on any path it takes, and the row's name,
 * summary and position in the listing are exactly what they were.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { runNexusGh } from "../dispatch";
import { CAPABILITIES, capabilityListing, usage } from "../registry";
import { checkoutWith, recordingIo, scratch, story, writeItem } from "./fixtures";

/**
 * The interpreter no path may reach. Story #394 removed the delegation seam, so this is stated
 * here as the literal it always was rather than imported from a module that no longer exists —
 * the assertion is still worth making, it just cannot source the name from the removed seam.
 */
const AN_INTERPRETER = "python3";

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));

const spawned = spawnSync as unknown as Mock;

/** The platform client, as the real seam reaches it: one process per call. */
function ghAnswers(args: string[], stored: Record<string, string>, next: { n: number }) {
    const ok = (stdout: string) => ({ status: 0, stdout, stderr: "" });
    const number = (vector: string[]): string => vector.slice(2).find((a) => /^\d+$/.test(a)) ?? "";
    if (args[0] === "label") return ok("");
    if (args[0] === "issue" && args[1] === "create") {
        const issue = String(next.n++);
        stored[issue] = fs.readFileSync(args[args.indexOf("--body-file") + 1], "utf8");
        return ok(`https://github.com/acme/tracker/issues/${issue}\n`);
    }
    if (args[0] === "issue" && args[1] === "view" && args.includes("body")) return ok(stored[number(args)] ?? "");
    if (args[0] === "issue" && args[1] === "view") return ok("I_node\n");
    if (args[0] === "issue" && args[1] === "edit") return ok("");
    if (args[0] === "api" && args[3] === ".id") return ok(`900${/issues\/(\d+)/.exec(args[1])?.[1]}\n`);
    if (args[0] === "api" && args[1] === "--method") return ok("{}");
    if (args[0] === "api" && String(args[1]).endsWith("/dependencies/blocked_by")) return ok("");
    return ok("");
}

beforeEach(() => {
    const stored: Record<string, string> = {};
    const next = { n: 100 };
    spawned.mockReset();
    spawned.mockImplementation((command: string, args: string[]) =>
        command === "gh" ? ghAnswers(args, stored, next) : { status: 1, stdout: "", stderr: "not gh" },
    );
});

function batch(): string {
    const root: string = checkoutWith({
        classification: "labels",
        "story-repo": "acme/tracker",
        project: "none",
    });
    writeItem(root, "STORY-1.md", story("1"));
    writeItem(root, "STORY-2.md", story("2", { blocked_by: "[STORY-1]" }, "Follows STORY-1.\n"));
    return root;
}

describe("the toolkit answers create-story in process", () => {
    it("runs a full batch to completion with no interpreter process spawned", () => {
        const root: string = batch();
        const io = recordingIo(root);
        expect(runNexusGh(["create-story", scratch(root)], io)).toBe(0);
        expect(io.out.join("\n")).toContain("✅ Complete");
        expect(io.out.join("\n")).toContain("Issues:       2 created");
        const commands: string[] = spawned.mock.calls.map((call) => call[0] as string);
        expect(commands.length).toBeGreaterThan(0);
        expect(commands).not.toContain(AN_INTERPRETER);
        for (const command of commands) expect(command).toBe("gh");
    });

    it("spawns nothing at all for a batch it refuses", () => {
        const root: string = checkoutWith({ classification: "labels" });
        const io = recordingIo(root);
        expect(runNexusGh(["create-story", path.join(root, "absent")], io)).not.toBe(0);
        expect(spawned.mock.calls).toEqual([]);
    });

    it("reaches the filer's own arguments through the dispatcher", () => {
        const root: string = batch();
        const io = recordingIo(root);
        expect(runNexusGh(["create-story", "--help"], io)).toBe(0);
        expect(io.out.join("\n")).toContain("nexus create-story <target-folder>");
        expect(io.out.join("\n")).toContain("--keep-manifest");
        expect(spawned.mock.calls).toEqual([]);
    });
});

describe("the capability's place in the toolkit is unchanged", () => {
    it("keeps its name, its summary and its position in the listing", () => {
        expect(CAPABILITIES.map((capability) => capability.name)).toEqual([
            "version",
            "config",
            "create-epic",
            "create-story",
        ]);
        expect(CAPABILITIES[3].summary).toBe("File one GitHub issue per STORY-*.md work item.");
        expect(capabilityListing()).toBe(
            JSON.stringify({ capabilities: ["config", "create-epic", "create-story", "version"] }),
        );
        expect(usage()).toContain("create-story  File one GitHub issue per STORY-*.md work item.");
    });

});
