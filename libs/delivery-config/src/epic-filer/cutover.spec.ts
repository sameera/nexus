/**
 * Story #386 — the toolkit answers `create-epic` itself.
 *
 * The whole cut-over is one binding, so what is asserted here is what the binding changes: the
 * capability runs in process, no interpreter is spawned on any path it takes, no row delegates any
 * more, and the row's name, summary and position in the listing are exactly what they were.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { runNexusGh } from "../dispatch";
import { PYTHON_INTERPRETER } from "../python-entry";
import { CAPABILITIES, capabilityListing, usage } from "../registry";
import { cannedGh, checkoutWith, draft, recordingIo, writeDraft } from "./fixtures";

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));

const spawned = spawnSync as unknown as Mock;

beforeEach(() => {
    spawned.mockReset();
    spawned.mockImplementation((command: string, args: string[]) => {
        if (command === "which" || command === "where") return { status: 0, stdout: "/usr/bin/gh", stderr: "" };
        if (command === "git") return { status: 0, stdout: "true\n", stderr: "" };
        if (command === "gh") return cannedGh(args) ?? { status: 0, stdout: "", stderr: "" };
        return { status: 1, stdout: "", stderr: "not reachable" };
    });
});

function scratchEpic(): { root: string; file: string } {
    const root: string = checkoutWith({ classification: "labels", project: "none" });
    return { root, file: writeDraft(root, draft()) };
}

const spawnedCommands = (): string[] => spawned.mock.calls.map((call) => call[0] as string);

describe("the toolkit answers create-epic in process", () => {
    it("files an epic to completion with no interpreter process spawned", () => {
        const { root, file } = scratchEpic();
        const io = recordingIo(root);
        expect(runNexusGh(["create-epic", file], io)).toBe(0);
        expect(io.out.join("\n")).toContain("GitHub Issue Created");
        expect(fs.readFileSync(file, "utf8")).toContain('link: "#7"');
        expect(spawnedCommands().length).toBeGreaterThan(0);
        expect(spawnedCommands()).not.toContain(PYTHON_INTERPRETER);
    });

    it("spawns no interpreter for a run it refuses either", () => {
        const { root } = scratchEpic();
        const io = recordingIo(root);
        expect(runNexusGh(["create-epic", path.join(root, "absent.md")], io)).toBe(1);
        expect(spawnedCommands()).not.toContain(PYTHON_INTERPRETER);
    });

    it("reaches the capability's own arguments through the dispatcher", () => {
        const io = recordingIo("/tmp");
        expect(runNexusGh(["create-epic", "--help"], io)).toBe(0);
        expect(io.out.join("\n")).toContain("nexus-gh create-epic <path-to-epic.md>");
        expect(io.out.join("\n")).toContain("--promote");
        expect(spawned.mock.calls).toEqual([]);
    });
});

describe("the exit codes are unchanged for every case", () => {
    it("exits zero for a filed epic and for a declined overwrite, non-zero for every refusal", () => {
        const { root, file } = scratchEpic();
        expect(runNexusGh(["create-epic", file], recordingIo(root))).toBe(0);

        // A declined overwrite: the draft now carries a link, and no terminal can answer.
        expect(runNexusGh(["create-epic", file], recordingIo(root))).toBe(1);

        const missingTitle: string = writeDraft(root, '---\nfeature: "Demo"\n---\n\n# Epic\n\nBody.\n', "untitled.md");
        expect(runNexusGh(["create-epic", missingTitle], recordingIo(root))).toBe(1);
        expect(runNexusGh(["create-epic", path.join(root, "absent.md")], recordingIo(root))).toBe(1);
        expect(runNexusGh(["create-epic", file, "--promote", "42"], recordingIo(root))).toBe(1);
        expect(runNexusGh(["create-epic", file, "--nope"], recordingIo(root))).toBe(2);
    });
});

describe("the registry after the cut-over", () => {
    it("declares no row that delegates to an interpreter", () => {
        const registry: string = fs.readFileSync(path.join(import.meta.dirname, "..", "registry.ts"), "utf8");
        expect(registry).not.toContain("delegateToPython");
    });

    it("keeps every row's name, summary and position in the listing", () => {
        expect(CAPABILITIES.map((capability) => capability.name)).toEqual([
            "version",
            "config",
            "create-epic",
            "create-story",
        ]);
        expect(CAPABILITIES[2].summary).toBe("File a GitHub issue from an epic document.");
        expect(capabilityListing()).toBe(
            JSON.stringify({ capabilities: ["config", "create-epic", "create-story", "version"] }),
        );
        expect(usage()).toContain("create-epic   File a GitHub issue from an epic document.");
    });
});
