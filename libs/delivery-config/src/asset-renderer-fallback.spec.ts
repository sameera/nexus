/**
 * Story #622 — a repository with no template configured files the link it files today, and says so.
 *
 * This is the guard that the new branch is a configuration branch rather than a visibility branch
 * (decision record #627, invariant 1): the form is stated at the gate and again after publishing,
 * and a private store with a template configured warns rather than refuses.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type PublishedAsset } from "./asset-publish";
import { assetReference } from "./asset-reference";
import { RENDERER_SLOT } from "./asset-store";
import { runAssets } from "./assets-cli";
import { type GhRunner, type RunResult } from "./gh";
import { type ToolkitIo } from "./io";

const PREVIEW = `https://preview.example.com/?url=${RENDERER_SLOT}`;
const STORE_ONLY = "github:\n  asset-store: acme/assets\n";
const STORE_AND_RENDERER = `github:\n  asset-store: acme/assets\n  asset-renderer: "${PREVIEW}"\n`;

function published(filename: string): PublishedAsset {
    const filePath = `features/issue-assets/${filename}`;
    return { path: filePath, commit: "abc123", url: `https://github.com/acme/assets/blob/abc123/${filePath}`, filename };
}

function recordingIo(cwd: string): ToolkitIo & { out: string[]; err: string[] } {
    const out: string[] = [];
    const err: string[] = [];
    return { cwd, stdout: (line) => out.push(line), stderr: (line) => err.push(line), out, err };
}

/** A checkout declaring `settings`, with `files` written under it. */
function workspace(settings: string, files: Record<string, string>): string {
    const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "asset-fallback-"));
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), settings);
    for (const [rel, body] of Object.entries(files)) {
        const file: string = path.join(root, ...rel.split("/"));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, body);
    }
    return root;
}

/** A store that accepts every write and answers the given visibility when asked. */
function fakeStore(isPrivate: boolean): GhRunner {
    return (args: string[]): RunResult => {
        if (args.includes("PUT")) return { status: 0, stdout: JSON.stringify({ commit: { sha: "c1" } }), stderr: "" };
        if (args[0] === "repo") return { status: 0, stdout: `${isPrivate}\n`, stderr: "" };
        return { status: 1, stdout: "", stderr: "HTTP 404: Not Found" };
    };
}

describe("with no template configured, the reference is the one filed before epic #613", () => {
    it.each(["mockup.html", "page.HTM", "notes.pdf", "archive.zip"])("%s keeps the plain link at the pinned commit", (filename: string) => {
        const reference = assetReference(published(filename), null);
        expect(reference).toEqual({
            kind: "file",
            url: `https://github.com/acme/assets/blob/abc123/features/issue-assets/${filename}`,
            markdown: `[${filename}](https://github.com/acme/assets/blob/abc123/features/issue-assets/${filename})`,
        });
    });

    it("rewrites a body's HTML path to that same plain link", () => {
        const root: string = workspace(STORE_ONLY, { "assets/mock.html": "<p>x</p>", "body.md": "Mockup: assets/mock.html\n" });
        expect(runAssets(["rewrite", "--body", "body.md", "--asset", "assets/mock.html", "--feature", "f"], recordingIo(root), fakeStore(false))).toBe(0);
        expect(fs.readFileSync(path.join(root, "body.md"), "utf8")).toBe(
            "Mockup: [mock.html](https://github.com/acme/assets/blob/c1/features/f/mock.html)\n",
        );
    });
});

describe("the fallback to the plain link is spoken on the console, never silently (invariant 3)", () => {
    it("says that no renderer is configured and that the plain link was filed", () => {
        const root: string = workspace(STORE_ONLY, { "assets/mock.html": "<p>x</p>", "body.md": "Mockup: assets/mock.html\n" });
        const io = recordingIo(root);
        expect(runAssets(["rewrite", "--body", "body.md", "--asset", "assets/mock.html", "--feature", "f"], io, fakeStore(false))).toBe(0);
        const said: string = io.err.join("\n");
        expect(said).toContain("asset-renderer");
        expect(said).toContain("mock.html");
        expect(said.toLowerCase()).toContain("plain link");
    });

    it("names the renderer the references were built from when one is configured", () => {
        const root: string = workspace(STORE_AND_RENDERER, { "assets/mock.html": "<p>x</p>", "body.md": "Mockup: assets/mock.html\n" });
        const io = recordingIo(root);
        expect(runAssets(["rewrite", "--body", "body.md", "--asset", "assets/mock.html", "--feature", "f"], io, fakeStore(false))).toBe(0);
        expect(io.err.join("\n")).toContain(PREVIEW);
        expect(io.err.join("\n").toLowerCase()).not.toContain("plain link");
    });

    it("says nothing about renderers on a run that published no HTML asset", () => {
        const root: string = workspace(STORE_ONLY, { "assets/flow.png": "x", "body.md": "![flow](assets/flow.png)\n" });
        const io = recordingIo(root);
        expect(runAssets(["rewrite", "--body", "body.md", "--asset", "assets/flow.png", "--feature", "f"], io, fakeStore(false))).toBe(0);
        expect(io.err.join("\n")).not.toContain("asset-renderer");
    });
});

describe("the approval gate states which form HTML references will take", () => {
    it("carries the configured template in the intake answer", () => {
        const root: string = workspace(STORE_AND_RENDERER, { "assets/mock.html": "<p>x</p>" });
        const io = recordingIo(root);
        expect(runAssets(["check", "--asset", "assets/mock.html"], io, fakeStore(false))).toBe(0);
        expect(JSON.parse(io.out[0])).toMatchObject({ state: "declared", renderer: PREVIEW });
    });

    it("carries a null renderer — never a placeholder — when none is configured", () => {
        const root: string = workspace(STORE_ONLY, { "assets/mock.html": "<p>x</p>" });
        const io = recordingIo(root);
        expect(runAssets(["check", "--asset", "assets/mock.html"], io, fakeStore(false))).toBe(0);
        expect(JSON.parse(io.out[0])).toMatchObject({ state: "declared", renderer: null });
    });

    it("carries the renderer even when the store is unsupported, so the gate still states the form", () => {
        const root: string = workspace(`github:\n  asset-renderer: "${PREVIEW}"\n`, { "assets/mock.html": "<p>x</p>" });
        const io = recordingIo(root);
        expect(runAssets(["check", "--asset", "assets/mock.html"], io, fakeStore(false))).toBe(0);
        expect(JSON.parse(io.out[0])).toMatchObject({ state: "unsupported", renderer: PREVIEW });
    });

    it("warns — and does not refuse — when the store is private and a renderer is configured", () => {
        const root: string = workspace(STORE_AND_RENDERER, { "assets/mock.html": "<p>x</p>" });
        const io = recordingIo(root);
        expect(runAssets(["check", "--asset", "assets/mock.html"], io, fakeStore(true))).toBe(0);
        expect(io.err.join("\n")).toContain("#614");
        expect(JSON.parse(io.out[0])).toMatchObject({ visibility: "private", renderer: PREVIEW });
    });

    it("says nothing about a private store when no renderer is configured", () => {
        const root: string = workspace(STORE_ONLY, { "assets/mock.html": "<p>x</p>" });
        const io = recordingIo(root);
        expect(runAssets(["check", "--asset", "assets/mock.html"], io, fakeStore(true))).toBe(0);
        expect(io.err.join("\n")).not.toContain("#614");
    });
});

describe("the form turns on the template alone, never on the store's visibility", () => {
    it.each([true, false])("a private=%s store with a template configured files the rendered address", (isPrivate: boolean) => {
        const root: string = workspace(STORE_AND_RENDERER, { "assets/mock.html": "<p>x</p>", "body.md": "Mockup: assets/mock.html\n" });
        expect(runAssets(["rewrite", "--body", "body.md", "--asset", "assets/mock.html", "--feature", "f"], recordingIo(root), fakeStore(isPrivate))).toBe(0);
        expect(fs.readFileSync(path.join(root, "body.md"), "utf8")).toBe(
            "Mockup: [mock.html](https://preview.example.com/?url=https://github.com/acme/assets/blob/c1/features/f/mock.html)\n",
        );
    });

    it.each([true, false])("a private=%s store with no template files the plain link", (isPrivate: boolean) => {
        const root: string = workspace(STORE_ONLY, { "assets/mock.html": "<p>x</p>", "body.md": "Mockup: assets/mock.html\n" });
        expect(runAssets(["rewrite", "--body", "body.md", "--asset", "assets/mock.html", "--feature", "f"], recordingIo(root), fakeStore(isPrivate))).toBe(0);
        expect(fs.readFileSync(path.join(root, "body.md"), "utf8")).toBe(
            "Mockup: [mock.html](https://github.com/acme/assets/blob/c1/features/f/mock.html)\n",
        );
    });

    it("never reads the store's visibility while rewriting — the gate read it once", () => {
        const root: string = workspace(STORE_AND_RENDERER, { "assets/mock.html": "<p>x</p>", "body.md": "Mockup: assets/mock.html\n" });
        const calls: string[][] = [];
        const run: GhRunner = (args: string[]): RunResult => {
            calls.push(args);
            return fakeStore(false)(args);
        };
        expect(runAssets(["rewrite", "--body", "body.md", "--asset", "assets/mock.html", "--feature", "f"], recordingIo(root), run)).toBe(0);
        expect(calls.some((args) => args[0] === "repo")).toBe(false);
    });
});
