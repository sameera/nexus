/**
 * The cross-feature backlog query (story #359) — the cases the Python `test_backlog_query` suite
 * asserted, asserted here through the capability's command line.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { runConfig } from "./config-cli";
import { type ToolkitIo } from "./io";

function repoWith(block: string): string {
    const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "backlog-"));
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), `github:\n${block}`);
    return root;
}

function query(root: string, ...args: string[]): { code: number; out: string; err: string } {
    const out: string[] = [];
    const err: string[] = [];
    const io: ToolkitIo = { cwd: root, stdout: (l) => out.push(l), stderr: (l) => err.push(l) };
    const code: number = runConfig(["backlog-query", "--root", root, ...args], io);
    return { code, out: out.join("\n"), err: err.join("\n") };
}

describe("the backlog query", () => {
    const plain: string = "  project: none\n";

    it("prints a gh listing of open issues carrying the unplanned label", () => {
        const r = query(repoWith(plain), "--form", "list");
        expect(r.code).toBe(0);
        expect(r.out).toBe("gh issue list --state open --label backlog");
    });

    it("prints the issue-search fragment matching that label", () => {
        expect(query(repoWith(plain), "--form", "search").out).toBe("is:issue is:open label:backlog");
    });

    it("prints the negated filter that excludes that label", () => {
        expect(query(repoWith(plain), "--form", "exclude").out).toBe("-label:backlog");
    });

    it("prints the list form when no form is given", () => {
        expect(query(repoWith(plain)).out).toBe(query(repoWith(plain), "--form", "list").out);
    });

    it("targets the repository epics are filed into", () => {
        const root: string = repoWith("  epic-repo: acme/epics\n");
        expect(query(root, "--form", "list").out).toBe("gh issue list --repo acme/epics --state open --label backlog");
    });

    it("names a declared label in every form", () => {
        const root: string = repoWith("  unplanned-label: icebox\n");
        for (const form of ["list", "search", "exclude"]) {
            expect(query(root, "--form", form).out).toContain("icebox");
            expect(query(root, "--form", form).out).not.toContain("backlog");
        }
    });

    it("quotes a label that would otherwise split the query into two filters", () => {
        expect(query(repoWith("  unplanned-label: not planned\n"), "--form", "exclude").out).toBe(
            '-label:"not planned"',
        );
        // A value already written quoted is not double-quoted into a filter GitHub cannot match.
        expect(query(repoWith('  unplanned-label: "not planned"\n'), "--form", "search").out).toBe(
            'is:issue is:open label:"not planned"',
        );
    });

    it("exits non-zero and names the three forms for an unsupported one", () => {
        const r = query(repoWith(plain), "--form", "nonsense");
        expect(r.code).not.toBe(0);
        for (const form of ["list", "search", "exclude"]) expect(r.err).toContain(form);
    });
});
