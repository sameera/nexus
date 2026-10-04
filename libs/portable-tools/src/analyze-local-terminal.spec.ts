/**
 * A run of analyze without a pull request reports in the terminal only (epic #829, story #863,
 * decision record #871, D12). It writes no file in any placement, and the shared derivation close
 * still calls no longer writes the local receipt (G36). The fix lane, the intake lane, close, the
 * issue-reference rules and the implement scripts no longer name the local analysis file (G37), and
 * close behaves the same whether or not a local run happened, even when a file an older release
 * wrote is still beside the epic (G38). The implement scripts' half is pinned in
 * implement-epic.spec.ts.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runNexusCli, type CliIo } from "./nexus-cli.js";
import { authoredComponentRoot } from "./vendor-components.js";

const COMPONENTS: string = authoredComponentRoot(import.meta.dirname);
const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");
const read = (rel: string): string => fs.readFileSync(path.join(COMPONENTS, rel), "utf8");

const ANALYZE: string = read("commands/nxs.analyze.md");
const CLOSE: string = read("commands/nxs.close.md");
const LOCAL_FILE = "analyze-receipt.md";

describe("analyze without a pull request reports in the terminal and writes no file (G36)", () => {
    it("names no local analysis file anywhere in the stage, its description included", () => {
        expect(ANALYZE).not.toContain(LOCAL_FILE);
    });

    it("states that a run without a pull request writes no file in any placement, old-contract entries included", () => {
        expect(ANALYZE).toMatch(/Without a pull request, analyze writes \*\*no file\*\*/);
        expect(ANALYZE).toMatch(/not beside a materialized `epic\.md` under `\.nexus\/tmp\/`, and not in an\s*\n?old-contract committed entry/);
    });

    it("ends the terminal report with one fixed line giving the open counts and the analyzed head", () => {
        expect(ANALYZE).toContain("Analyze result: critical=<C> high=<H> medium=<M> low=<L> head=<full 40-hex HEAD>");
        expect(ANALYZE).toMatch(/The report's \*\*last line\*\* is one fixed result line/);
    });

    it("prints no result line on a run that stops before judging, so a stop never reads as a result", () => {
        expect(ANALYZE).toMatch(/A run that stops before judging[^\n]*\n?[^\n]*prints \*\*no\*\* result line/);
    });
});

describe("the implement scripts parse the line analyze defines (R2)", () => {
    it("matches the defined line, filled in, with the pattern the shared script reads it by", () => {
        const template = /^Analyze result: critical=<C>[^\n]*$/m.exec(ANALYZE)?.[0];
        expect(template).toBeDefined();
        const filled = template!.replace("<C>", "2").replace("<H>", "1").replace("<M>", "0").replace("<L>", "3").replace("<full 40-hex HEAD>", "f".repeat(40));
        const pattern = /grep -oE '([^']+)'/.exec(fs.readFileSync(path.join(REPO_ROOT, "utils/implement-epic.sh"), "utf8"))?.[1];
        expect(pattern).toBeDefined();
        expect(new RegExp(`^${pattern!}$`).test(filled)).toBe(true);
    });
});

describe("no other stage names the local analysis file (G37)", () => {
    const surfaces: Array<[string, string]> = [
        ["the fix lane", "commands/nxs.fix.md"],
        ["the intake lane", "commands/nxs.intake.md"],
        ["close", "commands/nxs.close.md"],
        ["the issue-reference rules", "skills/nxs-issue-reference/SKILL.md"],
    ];
    it.each(surfaces)("%s does not name it", (_name, rel) => {
        expect(read(rel)).not.toContain(LOCAL_FILE);
    });

    it.each([["utils/implement-epic.sh"], ["utils/codex/implement-epic.sh"]])("%s does not name it", (rel) => {
        expect(fs.readFileSync(path.join(REPO_ROOT, rel), "utf8")).not.toContain(LOCAL_FILE);
    });
});

describe("close never reads a local analysis file (G38)", () => {
    it("says so, including a file an older release left behind", () => {
        expect(CLOSE).toMatch(/Close never reads a local analysis file, including one an older release left beside\s*\n?\s*the epic/);
    });

    it("takes the derivation's receipt from its printed output, never from a file", () => {
        expect(CLOSE).toMatch(/read the printed `receipt`/);
        expect(CLOSE).not.toMatch(/has already written it/);
    });
});

/**
 * The shared derivation, end to end, over a stubbed platform: an epic whose issue carries one
 * trusted shipped record. It prints the receipt it derived and writes nothing; a file an older
 * release wrote beside the epic is neither read nor touched.
 */
describe("the shared derivation close still calls writes no local receipt (G36, G38)", () => {
    let root: string;
    let bin: string;
    let savedPath: string | undefined;

    const SHIPPED = [
        "<!-- nexus:shipped-record -->",
        "",
        "```yaml",
        'epic: "#42"',
        "stories: [43]",
        "repo: acme/repo",
        "pr: 7",
        `merge_commit: ${"a".repeat(40)}`,
        "merged_at: 2026-09-10T09:00:00Z",
        `range: { base: ${"b".repeat(40)}, head: ${"a".repeat(40)} }`,
        "findings: { critical: 0, high: 0, medium: 1, low: 0 }",
        "```",
    ].join("\n");

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-derive-863-"));
        bin = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-derive-863-bin-"));
        const gh = `#!/usr/bin/env node
const args = process.argv.slice(2);
if (args[0] === "repo" && args[1] === "view") { console.log("acme/repo"); process.exit(0); }
if (args[0] === "issue" && args[1] === "view" && args.includes("comments")) {
    console.log(JSON.stringify({ comments: [{ id: "IC_1", body: ${JSON.stringify(SHIPPED)}, authorAssociation: "OWNER", author: { login: "lead" } }] }));
    process.exit(0);
}
if (args[0] === "issue" && args[1] === "view") {
    console.log(JSON.stringify({ number: Number(args[2]), title: "Epic", body: "", state: "OPEN", stateReason: null, labels: [] }));
    process.exit(0);
}
if (args[0] === "api") process.exit(0);
console.error("unexpected gh call: " + args.join(" "));
process.exit(1);
`;
        fs.writeFileSync(path.join(bin, "gh"), gh, { mode: 0o755 });
        savedPath = process.env["PATH"];
        process.env["PATH"] = `${bin}:${savedPath ?? ""}`;
    });
    afterEach(() => {
        process.env["PATH"] = savedPath;
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(bin, { recursive: true, force: true });
    });

    function files(dir: string): string[] {
        return fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => path.relative(dir, path.join(e.parentPath, e.name))).sort();
    }

    async function derive(): Promise<{ code: number; out: Record<string, unknown>; err: string }> {
        const out: string[] = [];
        const err: string[] = [];
        const io: CliIo = { cwd: root, stdout: (s: string) => void out.push(s), stderr: (s: string) => void err.push(s) };
        const code = await runNexusCli(["epic-verdicts", "derive", "--epic", "42", "--root", root], io);
        return { code, out: out.length > 0 ? (JSON.parse(out.join("")) as Record<string, unknown>) : {}, err: err.join("\n") };
    }

    it("prints the receipt it derived and writes no file", async () => {
        const before = files(root);
        const r = await derive();
        expect(r.code, r.err).toBe(0);
        expect(r.out["state"]).toBe("aggregate");
        expect(r.out["receipt"]).toMatchObject({ stories: [expect.objectContaining({ story: 43, pr: 7 })] });
        expect(r.out).not.toHaveProperty("outPath");
        expect(files(root)).toEqual(before);
    });

    it("answers the same, and leaves the file alone, when an older release left a local receipt beside the epic", async () => {
        const clean = await derive();
        const dir = path.join(root, ".nexus", "tmp", "epic-42");
        fs.mkdirSync(dir, { recursive: true });
        const stale = '---\nepic: "#42"\nmode: full-aggregate\nfindings: { critical: 3, high: 0, medium: 0, low: 0 }\nstories:\n  - { story: 99, repo: acme/repo, pr: 1, head: c }\n---\n';
        fs.writeFileSync(path.join(dir, LOCAL_FILE), stale);
        const withFile = await derive();
        expect(withFile).toEqual(clean);
        expect(fs.readFileSync(path.join(dir, LOCAL_FILE), "utf8")).toBe(stale);
    });
});
