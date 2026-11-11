/**
 * The initiative context kept on the initiative issue (epic #1011, decision record #1016, D1–D4).
 * Behaviour pinned here: where the context goes, that it reads back exactly, and that a repeated
 * run posts each part once.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type RunResult, type Runner } from "@nexus/epic-resolve/run";
import {
    BODY_LIMIT,
    COMMENT_LIMIT,
    parseContextFromBody,
    parsePartMarker,
    postParts,
    renderInitiativeBody,
    replaceStubRefs,
    runRender,
    runStubNumbers,
} from "./initiative-context-store";

const SUMMARY: string = "## Context summary\n\nThe plan in one paragraph.\n";
const joinParts = (parts: string[]): string => parts.map((p) => p.split("\n").slice(1).join("\n")).join("");
const norm = (s: string): string => s.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n").replace(/\n+$/, "");

describe("renderInitiativeBody", () => {
    it("keeps a context that fits inside the body, collapsed, and posts no part", () => {
        const context = "# Plan\n\nA short plan.\n";
        const r = renderInitiativeBody(SUMMARY, context);
        expect(r.parts).toEqual([]);
        expect(r.body).toContain("<details>");
        expect(r.body).toContain("A short plan.");
        expect(r.body.indexOf("The plan in one paragraph.")).toBeLessThan(r.body.indexOf("A short plan."));
        const read = parseContextFromBody(r.body);
        expect(read).toMatchObject({ kind: "inline" });
        expect(read.kind === "inline" && norm(read.text)).toBe(norm(context));
    });

    it("moves the whole context to numbered parts when the body would not fit, each within the limit", () => {
        const context = Array.from({ length: 4000 }, (_, i) => `line ${i} ${"x".repeat(40)}`).join("\n") + "\n";
        const r = renderInitiativeBody(SUMMARY, context);
        expect(r.parts.length).toBeGreaterThan(1);
        expect(r.body).not.toContain("line 10 ");
        expect(r.body).toContain(`${r.parts.length} numbered comments`);
        expect(Buffer.byteLength(r.body)).toBeLessThan(BODY_LIMIT);
        for (const p of r.parts) expect(Buffer.byteLength(p)).toBeLessThanOrEqual(COMMENT_LIMIT);
        r.parts.forEach((p, i) => expect(parsePartMarker(p)).toEqual({ number: i + 1, total: r.parts.length }));
        expect(norm(joinParts(r.parts))).toBe(norm(context));
        expect(parseContextFromBody(r.body)).toMatchObject({ kind: "parts", count: r.parts.length });
    });

    it("never overflows on multi-byte text", () => {
        const context = Array.from({ length: 3000 }, (_, i) => `行 ${i} ${"漢".repeat(30)}`).join("\n");
        const r = renderInitiativeBody(SUMMARY, context);
        for (const p of r.parts) expect(Buffer.byteLength(p)).toBeLessThanOrEqual(COMMENT_LIMIT);
        expect(norm(joinParts(r.parts))).toBe(norm(context));
    });

    it("splits a single line longer than a part", () => {
        const context = "y".repeat(COMMENT_LIMIT * 2 + 10);
        const r = renderInitiativeBody(SUMMARY, context);
        expect(r.parts.length).toBeGreaterThanOrEqual(3);
        expect(norm(joinParts(r.parts))).toBe(norm(context));
    });

    it("reads back exactly a context that contains the closing tag, a part marker or a record line", () => {
        const context = "a\n</details>\n<!-- nexus:context-part 1/1 -->\n<!-- nexus:context-end -->\n<!-- nexus:context-record {\"kind\":\"inline\",\"digest\":\"0\"} -->\nz\n";
        const r = renderInitiativeBody(SUMMARY, context);
        const read = parseContextFromBody(r.body);
        expect(read.kind === "inline" && read.text).toBe(context);
        expect(read.kind === "inline" && read.matches).toBe(true);
    });

    it("reports a changed inline context as not matching its record", () => {
        const r = renderInitiativeBody(SUMMARY, "original text\n");
        const read = parseContextFromBody(r.body.replace("original text", "edited text"));
        expect(read.kind === "inline" && read.matches).toBe(false);
    });
});

/** A canned `gh` holding one issue's comments. */
function fakeGh(comments: { id: number; body: string; author_association: string }[], posts: string[]): Runner {
    return (cmd: string, args: string[], opts?: { cwd?: string }): RunResult => {
        void opts;
        if (cmd !== "gh") return { status: 1, stdout: "", stderr: "unexpected" };
        if (args[0] === "api" && args[1].endsWith("/comments") && !args.includes("POST")) {
            return { status: 0, stdout: JSON.stringify(comments), stderr: "" };
        }
        if (args[0] === "issue" && args[1] === "comment") {
            const body = fs.readFileSync(args[args.indexOf("--body-file") + 1], "utf8");
            posts.push(body);
            comments.push({ id: comments.length + 1, body, author_association: "OWNER" });
            return { status: 0, stdout: "", stderr: "" };
        }
        return { status: 1, stdout: "", stderr: `unexpected gh ${args.join(" ")}` };
    };
}

describe("postParts", () => {
    const context = Array.from({ length: 4000 }, (_, i) => `line ${i} ${"x".repeat(40)}`).join("\n") + "\n";

    it("posts every part once, and a repeated run after an interruption posts none twice", () => {
        const r = renderInitiativeBody(SUMMARY, context);
        const comments: { id: number; body: string; author_association: string }[] = [];
        const posts: string[] = [];
        // An interrupted first run: only part 1 landed.
        comments.push({ id: 1, body: r.parts[0], author_association: "OWNER" });
        const result = postParts(fakeGh(comments, posts), os.tmpdir(), { owner: "acme", repo: "app" }, 7, r.parts);
        expect(result.ok).toBe(true);
        expect(posts).toHaveLength(r.parts.length - 1);
        const again: string[] = [];
        expect(postParts(fakeGh(comments, again), os.tmpdir(), { owner: "acme", repo: "app" }, 7, r.parts).ok).toBe(true);
        expect(again).toEqual([]);
        expect(comments).toHaveLength(r.parts.length);
    });

    it("fails when a part reads back different from what was posted", () => {
        const r = renderInitiativeBody(SUMMARY, context);
        const comments: { id: number; body: string; author_association: string }[] = [];
        const gh: Runner = (cmd, args) => {
            if (args[0] === "issue") return { status: 0, stdout: "", stderr: "" };
            return { status: 0, stdout: JSON.stringify(comments), stderr: "" };
        };
        const result = postParts(gh, os.tmpdir(), { owner: "acme", repo: "app" }, 7, r.parts);
        expect(result.ok).toBe(false);
    });
});

describe("a heading late in a large context", () => {
    it("never yields a part over the limit", () => {
        const filler = Array.from({ length: 1400 }, (_, i) => `row ${i} ${"y".repeat(40)}`).join("\n");
        const context = `intro\n## Late heading\n${filler}\n${"z".repeat(30000)}\nafter\n`;
        const r = renderInitiativeBody(SUMMARY, context);
        expect(r.parts.length).toBeGreaterThan(1);
        for (const p of r.parts) expect(Buffer.byteLength(p, "utf8")).toBeLessThanOrEqual(COMMENT_LIMIT);
        expect(norm(joinParts(r.parts))).toBe(norm(context));
    });
});

describe("postParts scratch space", () => {
    it("leaves nothing behind in the checkout, even when gh throws", () => {
        const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-scratch-"));
        const gh: Runner = (cmd, args) => {
            if (args[0] === "issue") throw new Error("gh died");
            return { status: 0, stdout: "[]", stderr: "" };
        };
        expect(() => postParts(gh, cwd, { owner: "acme", repo: "app" }, 7, ["<!-- nexus:context-part 1/1 -->\nx\n"])).toThrow();
        const left = fs.readdirSync(cwd).filter((f) => f.startsWith(".ctx-part-"));
        const tmp = fs.existsSync(path.join(cwd, ".tmp")) ? fs.readdirSync(path.join(cwd, ".tmp")) : [];
        expect(left).toEqual([]);
        expect(tmp).toEqual([]);
    });
});

describe("runRender", () => {
    it("removes parts left by an earlier render into the same folder", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-rerender-"));
        const out = path.join(dir, "out");
        fs.mkdirSync(out);
        fs.writeFileSync(path.join(out, "part-3.md"), "stale\n");
        fs.writeFileSync(path.join(dir, "summary.md"), SUMMARY);
        fs.writeFileSync(path.join(dir, "context.md"), "# Plan\n\nshort\n");
        const code = runRender(["--body", path.join(dir, "summary.md"), "--context", path.join(dir, "context.md"), "--dir", out], {
            cwd: dir,
            stdout: () => undefined,
            stderr: () => undefined,
        });
        expect(code).toBe(0);
        expect(fs.readdirSync(out)).toEqual(["body.md"]);
    });

    it("writes the body and the parts and reports no folder", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-render-"));
        fs.writeFileSync(path.join(dir, "summary.md"), SUMMARY);
        fs.writeFileSync(path.join(dir, "context.md"), "# Plan\n\nshort\n");
        const out: string[] = [];
        const code = runRender(["--body", path.join(dir, "summary.md"), "--context", path.join(dir, "context.md"), "--dir", path.join(dir, "out")], {
            cwd: dir,
            stdout: (l) => out.push(l),
            stderr: () => undefined,
        });
        expect(code).toBe(0);
        expect(JSON.parse(out.join("")).parts).toBe(0);
        expect(fs.readFileSync(path.join(dir, "out", "body.md"), "utf8")).toContain("short");
        expect(out.join("")).not.toMatch(/initiatives\//);
    });
});

describe("runRender headroom", () => {
    const run = (extra: string[]): { code: number; out: string; dir: string } => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-headroom-"));
        fs.writeFileSync(path.join(dir, "summary.md"), SUMMARY);
        fs.writeFileSync(path.join(dir, "context.md"), Array.from({ length: 1000 }, (_, i) => `line ${i} ${"x".repeat(40)}`).join("\n") + "\n");
        const out: string[] = [];
        const code = runRender(["--body", path.join(dir, "summary.md"), "--context", path.join(dir, "context.md"), "--dir", path.join(dir, "out"), ...extra], {
            cwd: dir,
            stdout: (l) => out.push(l),
            stderr: (l) => out.push(l),
        });
        return { code, out: out.join(""), dir };
    };

    it("keeps a context that fits in the body by default", () => {
        const r = run([]);
        expect(r.code).toBe(0);
        expect(JSON.parse(r.out).where).toBe("body");
    });

    it("moves the same context to comments when the filer needs more room", () => {
        const r = run(["--headroom", "30000"]);
        expect(r.code).toBe(0);
        expect(JSON.parse(r.out).where).toBe("comments");
    });

    it("refuses a headroom that is not a number", () => {
        expect(run(["--headroom", "lots"]).code).toBe(2);
    });
});

describe("replaceStubRefs", () => {
    const context = "# Plan\n\n1. STUB-01 first goal\n2. STUB-02 second goal\n";
    const summary = "Objective.\n\n## Execution order\n\n1. STUB-01 first goal\n2. STUB-02 second goal\n";

    it("names the stubs outside the collapsed context and leaves the context as filed", () => {
        const { body } = renderInitiativeBody(summary, context);
        const out = replaceStubRefs(body, { "stub-01": 11, "stub-02": 12 });
        expect(out).toContain("1. #11 first goal");
        const read = parseContextFromBody(out);
        expect(read).toMatchObject({ kind: "inline", matches: true });
        expect(read.kind === "inline" && read.text).toContain("STUB-01 first goal");
    });

    it("leaves a stub that has no number yet as it is", () => {
        const { body } = renderInitiativeBody(summary, context);
        expect(replaceStubRefs(body, { "stub-01": 11 })).toContain("2. STUB-02 second goal");
    });

    it("names the stubs in a body whose context sits in comments", () => {
        const big = Array.from({ length: 4000 }, (_, i) => `line ${i} STUB-01 ${"x".repeat(40)}`).join("\n") + "\n";
        const { body } = renderInitiativeBody(summary, big);
        const out = replaceStubRefs(body, { "stub-01": 11, "stub-02": 12 });
        expect(out).toContain("1. #11 first goal");
        expect(parseContextFromBody(out)).toMatchObject({ kind: "parts" });
    });

    it("rewrites a body file from the stubs' ledger", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ctx-stubs-"));
        fs.writeFileSync(path.join(dir, "body.md"), renderInitiativeBody(summary, context).body);
        fs.writeFileSync(path.join(dir, "ledger.json"), JSON.stringify({ "stub-01": { number: 11 }, "stub-02": { number: 12 } }));
        const code = runStubNumbers(["--body", path.join(dir, "body.md"), "--ledger", path.join(dir, "ledger.json")], { cwd: dir, stdout: () => undefined, stderr: () => undefined });
        expect(code).toBe(0);
        const written = fs.readFileSync(path.join(dir, "body.md"), "utf8");
        expect(written).toContain("2. #12 second goal");
        expect(parseContextFromBody(written)).toMatchObject({ matches: true });
    });

    it("exits 2 without a body and a ledger", () => {
        expect(runStubNumbers([], { cwd: ".", stdout: () => undefined, stderr: () => undefined })).toBe(2);
    });
});
