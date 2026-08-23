/**
 * The structural payload-boundary check (decision record #277, "the acceptance harness moves
 * beside its library, and the payload boundary stays structural"): no vendored component file may
 * import a workspace package, unless its path is enumerated in the waiver register — a declared,
 * counted, expiring exception, not a denylist. These specs pin the check itself; the live-tree
 * assertion (does the real `.claude/` tree only violate this at exactly the waived paths) lives in
 * `parity.spec.ts` beside the other payload/fingerprint gates.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkComponentComposition, findWorkspaceImports, type CompositionViolation } from "./component-composition";

let tmpDirs: string[] = [];

function makeTmpDir(prefix: string): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

function makeClaudeFixture(files: Record<string, string>): string {
    const dir: string = makeTmpDir("component-composition-");
    for (const [rel, content] of Object.entries(files)) {
        const abs: string = path.join(dir, ...rel.split("/"));
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content);
    }
    return dir;
}

describe("findWorkspaceImports", () => {
    it("finds a named ESM import from a workspace package", () => {
        expect(findWorkspaceImports('import { foo } from "@nexus/workspace/resolve";\n')).toEqual([
            "@nexus/workspace/resolve",
        ]);
    });

    it("finds a type-only import", () => {
        expect(findWorkspaceImports('import { type Foo } from "@nexus/epic-resolve/diagnostic";\n')).toEqual([
            "@nexus/epic-resolve/diagnostic",
        ]);
    });

    it("finds a require() call", () => {
        expect(findWorkspaceImports('const x = require("@nexus/close-migration/run");\n')).toEqual([
            "@nexus/close-migration/run",
        ]);
    });

    it("finds multiple distinct imports in one file", () => {
        const content = ['import { a } from "@nexus/workspace/resolve";', 'import { b } from "@nexus/workspace/status";', ""].join(
            "\n",
        );
        expect(findWorkspaceImports(content)).toEqual(["@nexus/workspace/resolve", "@nexus/workspace/status"]);
    });

    it("returns empty for a file with no workspace import", () => {
        expect(findWorkspaceImports('import * as fs from "node:fs";\nconst x = 1;\n')).toEqual([]);
    });

    it("does not match a relative import or a bare prose mention", () => {
        const content = ['import { x } from "./local.js";', "// see @nexus/workspace for details", ""].join("\n");
        expect(findWorkspaceImports(content)).toEqual([]);
    });
});

describe("checkComponentComposition", () => {
    it("flags a component file that imports a workspace package with no waiver", () => {
        const claudeDir: string = makeClaudeFixture({
            "skills/nxs-example/scripts/example.ts": 'import { foo } from "@nexus/workspace/resolve";\n',
        });

        const violations: CompositionViolation[] = checkComponentComposition(claudeDir, []);

        expect(violations).toEqual([
            { relPath: "skills/nxs-example/scripts/example.ts", imports: ["@nexus/workspace/resolve"] },
        ]);
    });

    it("does not flag a waived path", () => {
        const claudeDir: string = makeClaudeFixture({
            "skills/nxs-example/scripts/example.ts": 'import { foo } from "@nexus/workspace/resolve";\n',
        });

        const violations: CompositionViolation[] = checkComponentComposition(claudeDir, [
            "skills/nxs-example/scripts/example.ts",
        ]);

        expect(violations).toEqual([]);
    });

    it("does not flag a plain file with no workspace import", () => {
        const claudeDir: string = makeClaudeFixture({
            "commands/nxs.epic.md": "# epic\n",
            "skills/nxs-example/scripts/example.ts": 'import * as fs from "node:fs";\nfs.existsSync(".");\n',
        });

        expect(checkComponentComposition(claudeDir, [])).toEqual([]);
    });

    it("ignores non-code files even if they mention a workspace package in prose", () => {
        const claudeDir: string = makeClaudeFixture({
            "skills/nxs-example/SKILL.md": "Calls `resolveWorkspace` from `@nexus/workspace/resolve`.\n",
        });

        expect(checkComponentComposition(claudeDir, [])).toEqual([]);
    });

    it("flags every distinct import on one violating file", () => {
        const claudeDir: string = makeClaudeFixture({
            "skills/nxs-example/scripts/example.ts": [
                'import { a } from "@nexus/workspace/resolve";',
                'import { b } from "@nexus/close-migration/run";',
                "",
            ].join("\n"),
        });

        const violations: CompositionViolation[] = checkComponentComposition(claudeDir, []);

        expect(violations).toHaveLength(1);
        expect(violations[0].imports).toEqual(["@nexus/workspace/resolve", "@nexus/close-migration/run"]);
    });
});
