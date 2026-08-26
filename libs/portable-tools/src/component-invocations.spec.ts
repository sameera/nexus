/**
 * The component-invocation gate (story #301, decision record #325). One scanner walks the shipped
 * component bodies, extracts every invocation written in a code span, and classifies it against a
 * closed set of addressing forms — the two named-toolkit forms, and the legacy repository-bound
 * ones. These pin the recogniser and the verdict; the live-tree assertions ride the source-repo
 * gate in `parity.spec.ts`.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    checkComponentInvocations,
    findInvocations,
    formatInvocationProblems,
    scanComponentInvocations,
    type Invocation,
    type InvocationProblem,
    type ToolkitSurfaces,
} from "./component-invocations";

const SURFACES: ToolkitSurfaces = {
    nexus: ["deploy", "abs-doc-path", "workspace status", "workspace docs-root", "pr-worktree remove"],
    nexusGh: ["config", "create-epic"],
};

let tmpDirs: string[] = [];

function makeClaudeDir(files: Record<string, string>): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "invocations-"));
    tmpDirs.push(dir);
    for (const [rel, content] of Object.entries(files)) {
        const abs: string = path.join(dir, ...rel.split("/"));
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content);
    }
    return dir;
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

function fence(...lines: string[]): string {
    return ["```bash", ...lines, "```", ""].join("\n");
}

describe("findInvocations — what counts as an invocation", () => {
    it("reads an invocation out of a fenced block", () => {
        const found: Invocation[] = findInvocations(fence("nexus workspace status"));
        expect(found).toEqual([expect.objectContaining({ form: "named-executable", name: "workspace status", line: 2 })]);
    });

    it("reads an invocation out of an inline code span", () => {
        const found: Invocation[] = findInvocations("Run `nexus workspace docs-root` from the checkout.\n");
        expect(found).toEqual([expect.objectContaining({ form: "named-executable", name: "workspace docs-root" })]);
    });

    it("ignores a toolkit name in running prose outside any code span", () => {
        expect(findInvocations("The nexus executable resolves its own payload.\n")).toEqual([]);
    });

    it("takes the longest declared-shaped dispatch name, so a subverb is part of the name", () => {
        const found: Invocation[] = findInvocations(fence("nexus pr-worktree remove <wtPath>"));
        expect(found[0].name).toBe("pr-worktree remove");
    });

    it("stops the dispatch name at the first flag", () => {
        const found: Invocation[] = findInvocations(fence("nexus epic-resolve --epic <n> --require-epic"));
        expect(found[0].name).toBe("epic-resolve");
    });

    it("reads a capability name after the Python toolkit's name", () => {
        const found: Invocation[] = findInvocations(fence('nexus-gh config resolve epic-repo --root "<root>"'));
        expect(found).toEqual([expect.objectContaining({ form: "named-python-toolkit", name: "config" })]);
    });

    it("finds an invocation nested in a command substitution", () => {
        const found: Invocation[] = findInvocations(fence('REPO="$(nexus-gh config resolve epic-repo)"'));
        expect(found).toEqual([expect.objectContaining({ form: "named-python-toolkit", name: "config" })]);
    });

    it("names each legacy repository-bound form", () => {
        const found: Invocation[] = findInvocations(
            fence(
                "tsx ./.claude/skills/nxs-epic-resolve/scripts/epic_resolve.ts --epic <n>",
                "python ./.claude/skills/nxs-gh-shared/delivery_config.py resolve epic-label",
                "python3 ./scripts/create_gh_issues.py <folder>",
                "node .nexus/tools/generate-atlas.mjs",
                "pnpm nexus:generate-atlas",
            ),
        );
        expect(found.map((f) => f.form)).toEqual([
            "transpiler-script",
            "interpreter-script",
            "interpreter-script",
            "bundle-runtime",
            "workspace-alias",
        ]);
    });

    it("reports a repository-bound artifact written with no command around it", () => {
        const found: Invocation[] = findInvocations("The stage runs `.nexus/tools/derive-entry-diff.mjs` itself.\n");
        expect(found).toEqual([expect.objectContaining({ form: "unrecognised" })]);
    });

    it("does not fire on a bare toolkit or runtime name with nothing to dispatch", () => {
        expect(findInvocations("Install `nexus` and run it with `node`.\n")).toEqual([]);
    });

    it("does not fire on a directory path that merely contains a toolkit's name", () => {
        expect(findInvocations("Bundles live under `.nexus/tools/`.\n")).toEqual([]);
    });
});

describe("scanComponentInvocations — classification against the declared surfaces", () => {
    it("classifies a declared dispatch name as resolving", () => {
        const dir: string = makeClaudeDir({ "commands/a.md": fence("nexus workspace status") });
        const [site] = scanComponentInvocations(dir, SURFACES);
        expect(site).toMatchObject({ relPath: "commands/a.md", classification: "resolving" });
    });

    it("classifies an undeclared verb as undeclared", () => {
        const dir: string = makeClaudeDir({ "commands/a.md": fence("nexus workspace statuss") });
        const [site] = scanComponentInvocations(dir, SURFACES);
        expect(site).toMatchObject({ classification: "undeclared", name: "workspace statuss" });
    });

    it("classifies an undeclared Python capability as undeclared", () => {
        const dir: string = makeClaudeDir({ "commands/a.md": fence("nexus-gh create-storey <folder>") });
        const [site] = scanComponentInvocations(dir, SURFACES);
        expect(site).toMatchObject({ classification: "undeclared", name: "create-storey" });
    });

    it("classifies every legacy form as not yet migrated", () => {
        const dir: string = makeClaudeDir({ "commands/a.md": fence("tsx ./.claude/skills/x/scripts/y.ts") });
        const [site] = scanComponentInvocations(dir, SURFACES);
        expect(site.classification).toBe("unmigrated");
    });

    it("inventories every code-span invocation in every shipped body", () => {
        const dir: string = makeClaudeDir({
            "commands/a.md": fence("nexus deploy"),
            "skills/s/SKILL.md": fence("pnpm nexus:generate-atlas"),
            "agents/g.md": "Use `nexus-gh config resolve epic-repo` here.\n",
            "commands/notes.txt": fence("nexus deploy"),
        });
        const sites: Invocation[] = scanComponentInvocations(dir, SURFACES);
        expect(sites.map((s) => s.relPath)).toEqual(["agents/g.md", "commands/a.md", "skills/s/SKILL.md"]);
        expect(sites.map((s) => s.classification)).toEqual(["resolving", "resolving", "unmigrated"]);
    });
});

describe("checkComponentInvocations — the verdict", () => {
    it("passes a tree whose every invocation names a declared toolkit verb", () => {
        const dir: string = makeClaudeDir({ "commands/a.md": fence("nexus deploy") });
        expect(checkComponentInvocations(scanComponentInvocations(dir, SURFACES))).toEqual([]);
    });

    it("fails an undeclared name, naming the body and the name", () => {
        const dir: string = makeClaudeDir({ "commands/a.md": fence("nexus workspace statuss") });
        const problems: InvocationProblem[] = checkComponentInvocations(scanComponentInvocations(dir, SURFACES));
        expect(problems).toHaveLength(1);
        expect(problems[0].message).toContain("commands/a.md");
        expect(problems[0].message).toContain("workspace statuss");
    });

    it("fails a migrated body that reintroduces a repository-relative path", () => {
        const dir: string = makeClaudeDir({
            "commands/a.md": fence("nexus deploy", "tsx ./.claude/skills/x/scripts/y.ts"),
        });
        const problems: InvocationProblem[] = checkComponentInvocations(scanComponentInvocations(dir, SURFACES));
        expect(problems[0].message).toContain("commands/a.md");
        expect(problems[0].message).toContain("y.ts");
    });

    it("fails a migrated body that reintroduces a bare python", () => {
        const dir: string = makeClaudeDir({ "commands/a.md": fence("python ./scripts/x.py") });
        expect(checkComponentInvocations(scanComponentInvocations(dir, SURFACES))).toHaveLength(1);
    });

    it("fails a reintroduced bundle path and a reintroduced workspace script alias", () => {
        const dir: string = makeClaudeDir({
            "commands/a.md": fence("node .nexus/tools/generate-atlas.mjs"),
            "commands/b.md": fence("pnpm nexus:generate-atlas"),
        });
        expect(checkComponentInvocations(scanComponentInvocations(dir, SURFACES))).toHaveLength(2);
    });

    it("names the offending body and name in the formatted failure", () => {
        const dir: string = makeClaudeDir({ "commands/a.md": fence("nexus-gh create-storey <folder>") });
        const text: string = formatInvocationProblems(checkComponentInvocations(scanComponentInvocations(dir, SURFACES)));
        expect(text).toContain("commands/a.md");
        expect(text).toContain("create-storey");
    });
});
