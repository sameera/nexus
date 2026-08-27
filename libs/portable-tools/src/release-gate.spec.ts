/**
 * The release tail's precondition (invariant 15, epic #252).
 *
 * The gate is a release-time check, not a suite check: it is expected to fail today, because the
 * component bodies still reach the Python toolkit by an in-repository path. What the suite pins
 * is that the detector answers correctly and that the written procedure carries the gate ahead of
 * the tag — a releaser who follows the procedure must be stopped before publishing.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findInRepoInvocations, RELEASE_GATE_REMEDIATION, type InRepoInvocation } from "./release-gate";

const REPO_ROOT: string = path.resolve(__dirname, "../../..");
const PROCEDURE_PATH: string = path.join(REPO_ROOT, "docs", "delivery", "release-procedure.md");

const temporary: string[] = [];

function componentTree(files: Record<string, string>): string {
    const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "release-gate-"));
    temporary.push(root);
    for (const [rel, content] of Object.entries(files)) {
        const abs: string = path.join(root, ...rel.split("/"));
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, content);
    }
    return root;
}

afterEach(() => {
    while (temporary.length > 0) {
        fs.rmSync(temporary.pop() as string, { recursive: true, force: true });
    }
});

describe("a shipped body may not reach a toolkit capability by an in-repository path", () => {
    it("reports a body that runs a capability the payload does not carry", () => {
        const claudeDir: string = componentTree({
            "commands/nxs.close.md": [
                "Resolve the target repository:",
                "",
                "    ISSUES_REPO=\"$(python3 ./.claude/skills/nxs-gh-shared/delivery_config.py resolve epic-repo)\"",
            ].join("\n"),
        });

        const findings: InRepoInvocation[] = findInRepoInvocations(claudeDir);

        expect(findings).toHaveLength(1);
        expect(findings[0].file).toBe("commands/nxs.close.md");
        expect(findings[0].line).toBe(3);
        expect(findings[0].reference).toBe(".claude/skills/nxs-gh-shared/delivery_config.py");
    });

    it("reports a prose mention as readily as a command line, because both send a reader to the path", () => {
        const claudeDir: string = componentTree({
            "skills/nxs-epic-resolve/SKILL.md":
                "The resolver (`.claude/skills/nxs-gh-shared/delivery_config.py resolve …`) declares the mode.\n",
        });

        expect(findInRepoInvocations(claudeDir)).toHaveLength(1);
    });

    it("passes a body that names the declared toolkit rather than a path", () => {
        const claudeDir: string = componentTree({
            "commands/nxs.close.md": "    ISSUES_REPO=\"$(nexus-gh config resolve epic-repo)\"\n",
        });

        expect(findInRepoInvocations(claudeDir)).toEqual([]);
    });

    it("passes a path the payload itself carries — that one resolves wherever the components are deployed", () => {
        const claudeDir: string = componentTree({
            "skills/nxs-record-digest/SKILL.md":
                "    tsx ./.claude/skills/nxs-record-digest/scripts/record_digest.ts --issue <N>\n",
            "skills/nxs-record-digest/scripts/record_digest.ts": "export {};\n",
        });

        expect(findInRepoInvocations(claudeDir)).toEqual([]);
    });

    it("looks only at the shipped component subtrees", () => {
        const claudeDir: string = componentTree({
            "settings.local.json": "{\"note\": \"python3 ./.claude/skills/nxs-gh-shared/delivery_config.py\"}\n",
        });

        expect(findInRepoInvocations(claudeDir)).toEqual([]);
    });

    it("names one finding per occurrence, with the line a reader can open", () => {
        const claudeDir: string = componentTree({
            "commands/nxs.epic.md": [
                "    python ./.claude/skills/nxs-gh-shared/delivery_config.py resolve epic-label",
                "    python ./.claude/skills/nxs-gh-shared/delivery_config.py resolve epic-type",
            ].join("\n"),
        });

        expect(findInRepoInvocations(claudeDir).map((finding) => finding.line)).toEqual([1, 2]);
    });

    it("the remediation names the declared toolkit, not an edit to the payload", () => {
        expect(RELEASE_GATE_REMEDIATION).toContain("nexus-gh");
    });
});

describe("the procedure carries the gate ahead of the tag (story #312 AC2)", () => {
    const procedure: string = fs.readFileSync(PROCEDURE_PATH, "utf8");

    it("states the precondition and how to check it", () => {
        expect(procedure).toContain("nexus:release-gate");
    });

    it("places the gate before the tag and the publish, where it can still stop a release", () => {
        expect(procedure.indexOf("nexus:release-gate")).toBeLessThan(procedure.indexOf("git tag"));
        expect(procedure.indexOf("nexus:release-gate")).toBeLessThan(procedure.indexOf("npm publish"));
    });

    it("is a runnable step: the repository declares the script the procedure names", () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
        expect(Object.keys(manifest.scripts)).toContain("nexus:release-gate");
    });
});
