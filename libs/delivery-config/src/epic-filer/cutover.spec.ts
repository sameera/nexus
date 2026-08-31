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
import { runCreateEpic } from "./run";
import { cannedGh, checkoutWith, draft, recordingIo, writeDraft } from "./fixtures";

/**
 * The interpreter no path may reach. Story #394 removed the delegation seam, so this is stated
 * here as the literal it always was rather than imported from a module that no longer exists —
 * the assertion is still worth making, it just cannot source the name from the removed seam.
 */
const AN_INTERPRETER = "python3";

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

describe("create-epic runs in process", () => {
    it("files an epic to completion with no interpreter process spawned", () => {
        const { root, file } = scratchEpic();
        const io = recordingIo(root);
        expect(runCreateEpic([file], io)).toBe(0);
        expect(io.out.join("\n")).toContain("GitHub Issue Created");
        expect(fs.readFileSync(file, "utf8")).toContain('link: "#7"');
        expect(spawnedCommands().length).toBeGreaterThan(0);
        expect(spawnedCommands()).not.toContain(AN_INTERPRETER);
    });

    it("spawns no interpreter for a run it refuses either", () => {
        const { root } = scratchEpic();
        const io = recordingIo(root);
        expect(runCreateEpic([path.join(root, "absent.md")], io)).toBe(1);
        expect(spawnedCommands()).not.toContain(AN_INTERPRETER);
    });

    it("reaches the capability's own arguments", () => {
        const io = recordingIo("/tmp");
        expect(runCreateEpic(["--help"], io)).toBe(0);
        expect(io.out.join("\n")).toContain("nexus create-epic <path-to-epic.md>");
        expect(io.out.join("\n")).toContain("--promote");
        expect(spawned.mock.calls).toEqual([]);
    });
});

describe("the exit codes are unchanged for every case", () => {
    it("exits zero for a filed epic and for a declined overwrite, non-zero for every refusal", () => {
        const { root, file } = scratchEpic();
        expect(runCreateEpic([file], recordingIo(root))).toBe(0);

        // A declined overwrite: the draft now carries a link, and no terminal can answer.
        expect(runCreateEpic([file], recordingIo(root))).toBe(1);

        const missingTitle: string = writeDraft(root, '---\nfeature: "Demo"\n---\n\n# Epic\n\nBody.\n', "untitled.md");
        expect(runCreateEpic([missingTitle], recordingIo(root))).toBe(1);
        expect(runCreateEpic([path.join(root, "absent.md")], recordingIo(root))).toBe(1);
        expect(runCreateEpic([file, "--promote", "42"], recordingIo(root))).toBe(1);
        expect(runCreateEpic([file, "--nope"], recordingIo(root))).toBe(2);
    });
});

// The capability's place on the executable's own registry is asserted where that registry lives,
// in portable-tools' fold suite. Story #397 withdrew the second name and the table that declared
// it, so there is no second listing left here to hold to.
