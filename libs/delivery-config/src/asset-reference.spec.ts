/**
 * Story #597 — reference each asset in the form its reader can render. The form is decided by file
 * type alone; the store's visibility is read for the digest and never consulted here.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type PublishedAsset } from "./asset-publish";
import { assetKind, assetReference } from "./asset-reference";
import { readStoreVisibility, runAssets } from "./assets-cli";
import { type GhRunner, type RunResult } from "./gh";
import { type ToolkitIo } from "./io";

const STORE = { owner: "acme", name: "assets", repo: "acme/assets", branch: null };

function published(filename: string): PublishedAsset {
    const filePath = `features/issue-assets/${filename}`;
    return { path: filePath, commit: "abc123", url: `https://github.com/acme/assets/blob/abc123/${filePath}`, filename };
}

function recordingIo(cwd: string): ToolkitIo & { out: string[]; err: string[] } {
    const out: string[] = [];
    const err: string[] = [];
    return { cwd, stdout: (line) => out.push(line), stderr: (line) => err.push(line), out, err };
}

function repoWith(settings: string): string {
    const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "asset-reference-"));
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), settings);
    return root;
}

describe("an image renders inline from the blob address with the raw flag", () => {
    it.each(["flow.png", "mock.JPG", "sketch.jpeg", "anim.gif", "icon.svg", "photo.webp", "old.bmp"])("%s", (filename: string) => {
        const reference = assetReference(published(filename), null);
        expect(reference.kind).toBe("image");
        expect(reference.url).toBe(`https://github.com/acme/assets/blob/abc123/features/issue-assets/${filename}?raw=true`);
        expect(reference.markdown).toBe(`![${filename}](${reference.url})`);
    });

    it("uses a given label as the alt text", () => {
        expect(assetReference(published("flow.png"), null, "The filing flow").markdown).toBe(
            "![The filing flow](https://github.com/acme/assets/blob/abc123/features/issue-assets/flow.png?raw=true)",
        );
    });
});

describe("every other file is a link to the published version at the pinned commit", () => {
    it.each(["mockup.html", "notes.pdf", "flow.drawio", "spec.md", "archive.zip", "noext"])("%s", (filename: string) => {
        const reference = assetReference(published(filename), null);
        expect(reference.kind).toBe("file");
        expect(reference.url).toBe(`https://github.com/acme/assets/blob/abc123/features/issue-assets/${filename}`);
        expect(reference.url).not.toContain("?raw=true");
        expect(reference.markdown).toBe(`[${filename}](${reference.url})`);
    });

    it("classifies by extension, case-folded", () => {
        expect(assetKind("A.PNG")).toBe("image");
        expect(assetKind("page.HTML")).toBe("file");
    });
});

describe("the publish command prints the renderable form", () => {
    const fakeRun: GhRunner = (args: string[]): RunResult =>
        args.includes("PUT")
            ? { status: 0, stdout: JSON.stringify({ commit: { sha: "c1" } }), stderr: "" }
            : { status: 1, stdout: "", stderr: "HTTP 404: Not Found" };

    it("prints the raw-flag address for an image and the plain address for an HTML mockup", () => {
        const root: string = repoWith("github:\n  asset-store: acme/assets\n");
        const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "asset-local-"));
        for (const name of ["flow.png", "mock.html"]) fs.writeFileSync(path.join(dir, name), "x");
        const image = recordingIo(root);
        expect(runAssets(["publish", "--file", path.join(dir, "flow.png"), "--feature", "f", "--root", root], image, fakeRun)).toBe(0);
        expect(image.out).toEqual(["https://github.com/acme/assets/blob/c1/features/f/flow.png?raw=true"]);
        const html = recordingIo(root);
        expect(runAssets(["publish", "--file", path.join(dir, "mock.html"), "--feature", "f", "--root", root, "--json"], html, fakeRun)).toBe(0);
        expect(JSON.parse(html.out[0])).toMatchObject({
            kind: "file",
            url: "https://github.com/acme/assets/blob/c1/features/f/mock.html",
            markdown: "[mock.html](https://github.com/acme/assets/blob/c1/features/f/mock.html)",
        });
    });

    it("never reads the store's visibility while publishing", () => {
        const root: string = repoWith("github:\n  asset-store: acme/assets\n");
        const file: string = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "asset-local-")), "flow.png");
        fs.writeFileSync(file, "x");
        const calls: string[][] = [];
        const run: GhRunner = (args: string[]): RunResult => {
            calls.push(args);
            return fakeRun(args);
        };
        expect(runAssets(["publish", "--file", file, "--feature", "f", "--root", root], recordingIo(root), run)).toBe(0);
        expect(calls.some((args) => args[0] === "repo")).toBe(false);
    });
});

describe("the store's visibility is read from GitHub, not from settings", () => {
    it("reports private and public from the repository's own answer", () => {
        const answer = (isPrivate: string): GhRunner => (): RunResult => ({ status: 0, stdout: `${isPrivate}\n`, stderr: "" });
        expect(readStoreVisibility(STORE, answer("true"))).toEqual({ ok: true, visibility: "private" });
        expect(readStoreVisibility(STORE, answer("false"))).toEqual({ ok: true, visibility: "public" });
    });

    it("names a store that cannot be read", () => {
        const run: GhRunner = (): RunResult => ({ status: 1, stdout: "", stderr: "GraphQL: Could not resolve to a Repository" });
        const result = readStoreVisibility(STORE, run);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.message).toContain("acme/assets");
        expect(readStoreVisibility(STORE, (): RunResult => ({ status: 0, stdout: "maybe", stderr: "" })).ok).toBe(false);
    });

    it("is a command: prints the visibility, or stops on an unreadable or undeclared store", () => {
        const root: string = repoWith("github:\n  asset-store: acme/assets\n");
        const io = recordingIo(root);
        expect(runAssets(["visibility", "--root", root], io, (): RunResult => ({ status: 0, stdout: "true", stderr: "" }))).toBe(0);
        expect(io.out).toEqual(["private"]);
        const failing = recordingIo(root);
        expect(runAssets(["visibility"], failing, (): RunResult => ({ status: 1, stdout: "", stderr: "HTTP 404" }))).toBe(1);
        expect(failing.err.join("\n")).toContain("store-unreadable");
        const none: string = repoWith("github:\n  issues-repo: acme/tracker\n");
        expect(runAssets(["visibility", "--root", none], recordingIo(none), fakeRunNever)).toBe(1);
        expect(runAssets(["visibility", "stray"], recordingIo(root), fakeRunNever)).toBe(2);
    });
});

const fakeRunNever: GhRunner = (): RunResult => {
    throw new Error("must not be called");
};
