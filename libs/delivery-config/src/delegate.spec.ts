/**
 * Delegation to the retained Python entry point (Invariant 3): the entry point is what runs, the
 * capability name and its arguments travel as an argument vector, and the exit code comes back
 * unchanged.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { delegateToPython } from "./delegate";
import { type ToolkitIo } from "./io";
import { PYTHON_ENTRY_CANDIDATES, PYTHON_INTERPRETER, pythonEntryPoint } from "./python-entry";

function recordingIo(): ToolkitIo & { err: string[] } {
    const err: string[] = [];
    return { cwd: "/tmp", stdout: () => undefined, stderr: (line) => err.push(line), err };
}

describe("delegating a capability", () => {
    it("runs the entry point under python3 with the capability name and its arguments", () => {
        const calls: { command: string; args: string[] }[] = [];
        const code: number = delegateToPython(
            "create-epic",
            ["--yes", "epic.md"],
            recordingIo(),
            (command, args) => {
                calls.push({ command, args });
                return 0;
            },
            "/release/gh-toolkit/bin/nexus-gh",
        );
        expect(code).toBe(0);
        expect(calls).toEqual([
            {
                command: PYTHON_INTERPRETER,
                args: ["/release/gh-toolkit/bin/nexus-gh", "create-epic", "--yes", "epic.md"],
            },
        ]);
    });

    it("returns the delegated exit code unchanged", () => {
        expect(delegateToPython("create-story", [], recordingIo(), () => 3, "/entry")).toBe(3);
    });

    it("reports an incomplete installation rather than raising when the entry is absent", () => {
        const io = recordingIo();
        expect(delegateToPython("create-epic", [], io, () => 0, null)).toBe(2);
        expect(io.err.join("\n")).toContain("create-epic");
    });
});

describe("locating the retained entry point", () => {
    it("resolves the release layout, where the toolkit is staged beside the bundle", () => {
        const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-entry-"));
        const entry: string = path.join(root, "gh-toolkit", "bin", "nexus-gh");
        fs.mkdirSync(path.dirname(entry), { recursive: true });
        fs.writeFileSync(entry, "");
        expect(pythonEntryPoint(root)).toBe(entry);
    });

    it("resolves the checkout layout, where the toolkit is a sibling library", () => {
        const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-entry-"));
        const entry: string = path.join(root, "gh-toolkit", "bin", "nexus-gh");
        fs.mkdirSync(path.dirname(entry), { recursive: true });
        fs.writeFileSync(entry, "");
        const moduleDir: string = path.join(root, "delivery-config", "src");
        fs.mkdirSync(moduleDir, { recursive: true });
        expect(pythonEntryPoint(moduleDir)).toBe(entry);
    });

    it("reports no entry rather than a guess when neither layout carries one", () => {
        expect(pythonEntryPoint(fs.mkdtempSync(path.join(os.tmpdir(), "nexus-entry-")))).toBeNull();
        expect(PYTHON_ENTRY_CANDIDATES.length).toBeGreaterThan(0);
    });

    it("finds the entry point that ships in this checkout", () => {
        expect(pythonEntryPoint()).not.toBeNull();
    });
});
