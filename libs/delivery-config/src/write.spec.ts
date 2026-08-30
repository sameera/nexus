/**
 * The add-only settings writer (story #361) — the cases the Python `test_delivery_config` and
 * `test_writeback_integration` suites asserted, asserted here through the capability's command line.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { runConfig } from "./config-cli";
import { type ToolkitIo } from "./io";

function emptyRoot(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), "write-github-"));
}

function rootWith(settings: string): string {
    const root: string = emptyRoot();
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), settings);
    return root;
}

function settingsOf(root: string): string {
    return fs.readFileSync(path.join(root, ".nexus", "config", "settings.yml"), "utf8");
}

function write(root: string, ...args: string[]): { code: number; out: string } {
    const out: string[] = [];
    const io: ToolkitIo = { cwd: root, stdout: (l) => out.push(l), stderr: (l) => out.push(l) };
    const code: number = runConfig(["write-github", "--root", root, ...args], io);
    return { code, out: out.join("\n") };
}

describe("seeding the github block", () => {
    it("creates the block and reports the keys seeded and the file written", () => {
        const root: string = rootWith("cross-ref:\n  docs-root: docs\n");
        const r = write(root, "--classification", "labels", "--project", "none");
        expect(r.code).toBe(0);
        expect(settingsOf(root)).toContain("github:");
        expect(settingsOf(root)).toContain("  classification: labels");
        expect(settingsOf(root)).toContain("  project: none");
        expect(r.out).toContain("classification");
        expect(r.out).toContain(path.join(root, ".nexus", "config", "settings.yml"));
    });

    it("leaves a declared key unchanged and adds only the absent ones", () => {
        const root: string = rootWith("github:\n  classification: types\n");
        write(root, "--classification", "labels", "--project", "none");
        expect(settingsOf(root)).toContain("  classification: types");
        expect(settingsOf(root)).toContain("  project: none");
    });

    it("leaves the file untouched and says so when every requested key is declared", () => {
        const root: string = rootWith("github:\n  classification: types\n  project: none\n");
        const before: string = settingsOf(root);
        const r = write(root, "--classification", "labels", "--project", "auto");
        expect(settingsOf(root)).toBe(before);
        expect(r.out).toContain("No changes");
    });

    it("keeps every other section, comment and byte identical", () => {
        const original: string =
            "# top comment\ncross-ref:\n  docs-root: docs\n\n# about github\ngithub:\n  # why types\n  classification: types\n\nother:\n  key: value\n";
        const root: string = rootWith(original);
        write(root, "--project", "none");
        const after: string = settingsOf(root);
        for (const line of original.split("\n").filter((l) => l !== "")) expect(after).toContain(line);
        expect(after.replace("  project: none\n", "")).toBe(original);
    });

    it("writes a comment above a freshly created block", () => {
        const root: string = rootWith("cross-ref:\n  docs-root: docs\n");
        write(root, "--classification", "labels", "--comment", "gh unavailable at setup");
        expect(settingsOf(root)).toContain("# gh unavailable at setup\ngithub:");
    });

    it("creates the config directory and file at the given root", () => {
        const root: string = emptyRoot();
        write(root, "--issues-repo", "acme/tracker");
        expect(settingsOf(root)).toContain("  issues-repo: acme/tracker");
    });

    it("targets the given root's settings, never an ancestor repository's", () => {
        const outer: string = rootWith("github:\n  issues-repo: acme/outer\n");
        const inner: string = path.join(outer, "nested");
        fs.mkdirSync(inner, { recursive: true });
        write(inner, "--issues-repo", "acme/inner");
        expect(settingsOf(outer)).toContain("acme/outer");
        expect(settingsOf(outer)).not.toContain("acme/inner");
        expect(settingsOf(inner)).toContain("acme/inner");
    });

    it("never pins an empty value", () => {
        const root: string = emptyRoot();
        const r = write(root, "--project", "");
        expect(r.out).toContain("No changes");
        expect(fs.existsSync(path.join(root, ".nexus", "config", "settings.yml"))).toBe(false);
    });
});
