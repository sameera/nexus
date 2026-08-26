/**
 * Locating the Python toolkit by name (story #300).
 *
 * The behaviour that matters to a caller: a repository carrying no components is still served,
 * nothing reaches into the repository being acted on, and an absent toolkit is reported as an
 * absent toolkit.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GH_TOOLKIT_NAME, ghToolkitCommand, locateGhToolkit } from "./gh-toolkit";

const tracked: string[] = [];

function makeDir(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-gh-locate-"));
    tracked.push(dir);
    return dir;
}

/** A directory holding an executable named like the toolkit — an install on the path. */
function binDirWithToolkit(): string {
    const dir: string = makeDir();
    const file: string = path.join(dir, GH_TOOLKIT_NAME);
    fs.writeFileSync(file, "#!/usr/bin/env python3\n");
    fs.chmodSync(file, 0o755);
    return dir;
}

afterEach(() => {
    while (tracked.length > 0) fs.rmSync(tracked.pop()!, { recursive: true, force: true });
});

describe("locating the Python toolkit", () => {
    it("uses the installed toolkit when the name is on the path", () => {
        const dir: string = binDirWithToolkit();
        const located = locateGhToolkit({ PATH: dir });
        expect(located.ok).toBe(true);
        if (!located.ok) return;
        expect(located.command).toBe(path.join(dir, GH_TOOLKIT_NAME));
        expect(located.prefixArgs).toEqual([]);
    });

    it("falls back to the entry point shipped beside these libraries", () => {
        const located = locateGhToolkit({ PATH: makeDir() });
        expect(located.ok).toBe(true);
        if (!located.ok) return;
        // A checkout with nothing installed: the maintainer's from-source path, driven on python3.
        expect(located.command).toBe("python3");
        expect(located.prefixArgs).toHaveLength(1);
        expect(fs.existsSync(located.prefixArgs[0])).toBe(true);
        expect(path.basename(located.prefixArgs[0])).toBe(GH_TOOLKIT_NAME);
    });

    it("never selects a bare python", () => {
        const located = locateGhToolkit({ PATH: makeDir() });
        expect(located.ok).toBe(true);
        if (!located.ok) return;
        expect(located.command).not.toBe("python");
    });

    it("ignores a non-executable file of the same name", () => {
        const dir: string = makeDir();
        fs.writeFileSync(path.join(dir, GH_TOOLKIT_NAME), "not runnable\n", { mode: 0o644 });
        const located = locateGhToolkit({ PATH: dir });
        expect(located.ok).toBe(true);
        if (!located.ok) return;
        expect(located.command).toBe("python3");
    });

    it("reports an absent toolkit, and the remedy, when it is nowhere to be found", () => {
        // Neither installed nor present beside the libraries — the shape a user meets when Nexus
        // is not installed at all.
        const located = locateGhToolkit({ PATH: makeDir() }, path.join(makeDir(), GH_TOOLKIT_NAME));
        expect(located.ok).toBe(false);
        if (located.ok) return;
        expect(located.message).toContain(GH_TOOLKIT_NAME);
        expect(located.message).toContain("not installed");
        expect(located.message).toContain("PATH");
        // Not a missing file inside the user's repository.
        expect(located.message).not.toContain(".claude");
        expect(located.message).not.toContain("delivery_config.py");
    });

    it("builds a capability invocation that names no path inside the target repo", () => {
        const dir: string = binDirWithToolkit();
        const targetRoot = "/some/target/repo";
        const invocation = ghToolkitCommand(["config", "resolve", "issues-repo", "--root", targetRoot], { PATH: dir });
        expect(invocation.ok).toBe(true);
        if (!invocation.ok) return;
        expect(invocation.args).toEqual(["config", "resolve", "issues-repo", "--root", targetRoot]);
        expect(invocation.command).not.toContain(targetRoot);
        expect(invocation.args.join(" ")).not.toContain(path.join(targetRoot, ".claude"));
    });
});
