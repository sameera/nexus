/**
 * `nexus mermaid-check` — the check `/nxs.hld` runs before its preview: every Mermaid block in a
 * Markdown page parses.
 *
 * The parser is Mermaid's own, run in Node with a jsdom window. Neither package ships with Nexus:
 * they are optional peers a lead installs, so the check reports `unchecked` when they are absent
 * instead of failing the run, and the release bundle never carries them.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildBundle } from "./bundle.js";
import { runNexusCli, type CliIo } from "./nexus-cli.js";
import { loadMermaidParser, runMermaidCheck } from "./mermaid-check.js";

const REPO_ROOT: string = path.resolve(__dirname, "..", "..", "..");

let dirs: string[] = [];
afterEach(() => {
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
    dirs = [];
});

function tmpDir(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "mermaid-check-"));
    dirs.push(dir);
    return dir;
}

interface CapturedIo extends CliIo {
    out: string[];
    err: string[];
}

function makeIo(cwd: string): CapturedIo {
    const out: string[] = [];
    const err: string[] = [];
    return { cwd, out, err, stdout: (l) => out.push(l), stderr: (l) => err.push(l) };
}

function fence(body: string): string {
    return ["```mermaid", body, "```"].join("\n");
}

const FLOW: string = [
    "flowchart LR",
    "  subgraph Local[Lead's machine]",
    '    skill["/nxs.hld"]',
    "  end",
    "  skill -->|publish| store[(asset store)]",
    "  skill -.->|comment| record[decision record]",
    "  classDef central stroke-width:3px",
    "  class skill central",
].join("\n");
const SEQUENCE: string = ["sequenceDiagram", "  participant L as Lead", "  participant S as Skill", "  L->>S: /nxs.hld 348", "  S-->>L: preview"].join("\n");
const DATA: string = ["erDiagram", "  EPIC ||--o{ STORY : parents", "  EPIC ||--|| RECORD : has"].join("\n");
const DELIVERY: string = ["gantt", "  dateFormat YYYY-MM-DD", "  section PR 1", "  Story A :a1, 2026-11-03, 2d", "  section PR 2", "  Story B :after a1, 2d"].join("\n");

function page(dir: string, ...parts: string[]): string {
    const file: string = path.join(dir, "348-hld.md");
    fs.writeFileSync(file, ["# HLD", "", ...parts.flatMap((p) => [p, ""])].join("\n"));
    return file;
}

function report(io: CapturedIo): { state: string; blocks: { line: number; diagramType?: string; error?: string; errorLine?: number }[]; reason?: string } {
    return JSON.parse(io.out.join("\n"));
}

describe("nexus mermaid-check parses every Mermaid block in a Markdown page", () => {
    it("passes a page whose architecture, flow, data and delivery diagrams all parse", async () => {
        const dir: string = tmpDir();
        const io: CapturedIo = makeIo(dir);
        const code: number = await runNexusCli(["mermaid-check", "--file", page(dir, fence(FLOW), fence(SEQUENCE), fence(DATA), fence(DELIVERY))], io);
        expect(code, io.err.join("\n")).toBe(0);
        const result = report(io);
        expect(result.state).toBe("parsed");
        expect(result.blocks.map((b) => b.diagramType)).toEqual(["flowchart-v2", "sequence", "er", "gantt"]);
        expect(result.blocks.every((b) => b.error === undefined)).toBe(true);
    });

    it("fails a page with a broken block, naming the block and the line in the file", async () => {
        const dir: string = tmpDir();
        const io: CapturedIo = makeIo(dir);
        const broken: string = ["sequenceDiagram", "  participant A", "  A->>: no target"].join("\n");
        const file: string = page(dir, fence(FLOW), fence(broken));
        const code: number = await runNexusCli(["mermaid-check", "--file", file], io);
        expect(code).toBe(1);
        const result = report(io);
        expect(result.state).toBe("invalid");
        const bad = result.blocks.filter((b) => b.error !== undefined);
        expect(bad).toHaveLength(1);
        const lines: string[] = fs.readFileSync(file, "utf8").split("\n");
        expect(lines[bad[0].line - 1]).toBe("```mermaid");
        expect(lines[(bad[0].errorLine as number) - 1]).toBe("  A->>: no target");
    });

    it("fails a block that names no diagram type Mermaid knows", async () => {
        const dir: string = tmpDir();
        const io: CapturedIo = makeIo(dir);
        expect(await runNexusCli(["mermaid-check", "--file", page(dir, fence("boxes\n  a -> b"))], io)).toBe(1);
        expect(report(io).state).toBe("invalid");
    });

    it("reports a page with no Mermaid block as parsed with no blocks, so the caller can require some", async () => {
        const dir: string = tmpDir();
        const io: CapturedIo = makeIo(dir);
        expect(await runNexusCli(["mermaid-check", "--file", page(dir, "```ts\nconst a = 1;\n```")], io)).toBe(0);
        expect(report(io)).toMatchObject({ state: "parsed", blocks: [] });
    });

    it("parses a block nested under a list item, and fails it when it is broken", async () => {
        const dir: string = tmpDir();
        const indent = (body: string): string => fence(body).split("\n").map((l) => `    ${l}`).join("\n");
        const good: CapturedIo = makeIo(dir);
        expect(await runNexusCli(["mermaid-check", "--file", page(dir, "1. **Flow.**", "", indent(SEQUENCE))], good)).toBe(0);
        expect(report(good).blocks.map((b) => b.diagramType)).toEqual(["sequence"]);

        const bad: CapturedIo = makeIo(dir);
        const broken: string = ["sequenceDiagram", "  participant A", "  A->>: no target"].join("\n");
        expect(await runNexusCli(["mermaid-check", "--file", page(dir, "1. **Flow.**", "", indent(broken))], bad)).toBe(1);
        expect(report(bad).state).toBe("invalid");
    });

    it("fails a Mermaid block whose fence is never closed, naming its fence line", async () => {
        const dir: string = tmpDir();
        const io: CapturedIo = makeIo(dir);
        const file: string = page(dir, fence(FLOW), ["```mermaid", SEQUENCE].join("\n"));
        expect(await runNexusCli(["mermaid-check", "--file", file], io)).toBe(1);
        const result = report(io);
        expect(result.state).toBe("invalid");
        const bad = result.blocks.filter((b) => b.error !== undefined);
        expect(bad).toHaveLength(1);
        expect(fs.readFileSync(file, "utf8").split("\n")[bad[0].line - 1]).toBe("```mermaid");
    });

    it("fails an unclosed Mermaid fence even when the parser is not installed", async () => {
        const dir: string = tmpDir();
        const io: CapturedIo = makeIo(dir);
        const code: number = await runMermaidCheck(["--file", page(dir, ["```mermaid", SEQUENCE].join("\n"))], io, () => Promise.resolve(null));
        expect(code).toBe(1);
        expect(report(io).state).toBe("invalid");
    });

    it("reports unchecked, without failing, when the parser is not installed", async () => {
        const dir: string = tmpDir();
        const io: CapturedIo = makeIo(dir);
        const code: number = await runMermaidCheck(["--file", page(dir, fence(FLOW))], io, () => Promise.resolve(null));
        expect(code).toBe(0);
        const result = report(io);
        expect(result.state).toBe("unchecked");
        expect(result.reason).toMatch(/mermaid/);
        expect(result.reason).toMatch(/jsdom/);
    });

    it("exits 2 on a usage error and 1 on a file it cannot read", async () => {
        const dir: string = tmpDir();
        const usage: CapturedIo = makeIo(dir);
        expect(await runNexusCli(["mermaid-check"], usage)).toBe(2);
        expect(usage.err.join("\n")).toMatch(/usage: nexus mermaid-check --file/);
        const missing: CapturedIo = makeIo(dir);
        expect(await runNexusCli(["mermaid-check", "--file", "absent.md"], missing)).toBe(1);
    });

    it("is listed in the top-level usage", async () => {
        const io: CapturedIo = makeIo(tmpDir());
        await runNexusCli(["--help"], io);
        expect(io.out.join("\n")).toContain("nexus mermaid-check --file <path>");
    });
});

describe("nexus mermaid-check finds the parser where a lead installs it", () => {
    /** A stand-in for the two packages: enough for the loader to resolve and call. */
    function fakePackages(root: string): void {
        const mermaid: string = path.join(root, "node_modules", "mermaid");
        fs.mkdirSync(mermaid, { recursive: true });
        fs.writeFileSync(path.join(mermaid, "package.json"), JSON.stringify({ name: "mermaid", type: "module", exports: { ".": { default: "./index.mjs" } } }));
        fs.writeFileSync(path.join(mermaid, "index.mjs"), "export default { parse: async () => ({ diagramType: 'stand-in' }) };\n");
        const jsdom: string = path.join(root, "node_modules", "jsdom");
        fs.mkdirSync(jsdom, { recursive: true });
        fs.writeFileSync(path.join(jsdom, "package.json"), JSON.stringify({ name: "jsdom", main: "index.js" }));
        fs.writeFileSync(path.join(jsdom, "index.js"), "exports.JSDOM = class { constructor() { this.window = { document: {} }; } };\n");
    }

    it("resolves both packages from a directory it is given, such as the target repository", async () => {
        const root: string = tmpDir();
        fakePackages(root);
        const parser = await loadMermaidParser([root]);
        expect(parser).not.toBeNull();
        expect(await parser?.parse("anything")).toEqual({ diagramType: "stand-in" });
    });

    it("finds nothing where neither package is installed", async () => {
        expect(await loadMermaidParser([tmpDir()])).toBeNull();
    });
});

describe("the parser never ships with Nexus", () => {
    it("keeps mermaid and jsdom out of the release bundle", async () => {
        const { metafile } = await buildBundle(path.join(__dirname, "nexus-cli.ts"));
        const inputs: string[] = Object.keys(metafile.inputs);
        expect(inputs.filter((i) => /node_modules[\\/](\.pnpm[\\/])?(mermaid|jsdom)/.test(i))).toEqual([]);
    }, 60_000);

    it("declares mermaid and jsdom as optional peers, never as dependencies", () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
        expect(Object.keys(manifest.dependencies ?? {})).not.toContain("mermaid");
        expect(Object.keys(manifest.peerDependencies ?? {}).sort()).toEqual(["jsdom", "mermaid"]);
        expect(manifest.peerDependenciesMeta).toEqual({ jsdom: { optional: true }, mermaid: { optional: true } });
    });
});
