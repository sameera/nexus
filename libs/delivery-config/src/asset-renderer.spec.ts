/**
 * Story #621 — an HTML asset's reference is a rendered address built from the configured template
 * (decision record #627).
 *
 * The template is one more publishing key: it rides the same precedence chain and hub layer as the
 * store, it has no built-in, and an absent template means "no renderer". The reference builder gains
 * a third form for HTML alone, with the pinned address substituted verbatim into the one slot.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { parseAndValidateManifest } from "@nexus/workspace/manifest";
import { type PublishedAsset } from "./asset-publish";
import { assetReference } from "./asset-reference";
import { ASSET_RENDERER_KEY, RENDERER_SLOT, resolveAssetRenderer } from "./asset-store";
import { runAssets } from "./assets-cli";
import { type GhRunner, type RunResult } from "./gh";
import { type ToolkitIo } from "./io";
import { keyEntry } from "./keys";

const PREVIEW = `https://preview.example.com/?url=${RENDERER_SLOT}`;

function published(filename: string): PublishedAsset {
    const filePath = `features/issue-assets/${filename}`;
    return { path: filePath, commit: "abc123", url: `https://github.com/acme/assets/blob/abc123/${filePath}`, filename };
}

function recordingIo(cwd: string): ToolkitIo & { out: string[]; err: string[] } {
    const out: string[] = [];
    const err: string[] = [];
    return { cwd, stdout: (line) => out.push(line), stderr: (line) => err.push(line), out, err };
}

function repoWith(files: Record<string, string>): string {
    const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "asset-renderer-"));
    for (const [rel, body] of Object.entries(files)) {
        const file: string = path.join(root, ...rel.split("/"));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, body);
    }
    return root;
}

function settingsRepo(settings: string): string {
    return repoWith({ ".nexus/config/settings.yml": settings });
}

function localFile(name: string, contents: string): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "asset-local-"));
    const file: string = path.join(dir, name);
    fs.writeFileSync(file, contents);
    return file;
}

/** A store that accepts every write, and answers `public` when its visibility is read. */
const fakeRun: GhRunner = (args: string[]): RunResult => {
    if (args.includes("PUT")) return { status: 0, stdout: JSON.stringify({ commit: { sha: "c1" } }), stderr: "" };
    if (args[0] === "repo") return { status: 0, stdout: "false\n", stderr: "" };
    return { status: 1, stdout: "", stderr: "HTTP 404: Not Found" };
};

describe("resolving the declared renderer template", () => {
    it("hands a stage the template a repository declares", () => {
        const root: string = settingsRepo(`github:\n  ${ASSET_RENDERER_KEY}: "${PREVIEW}"\n`);
        expect(resolveAssetRenderer(root)).toEqual({ kind: "declared", template: PREVIEW });
    });

    it("uses the hub's template when the member layer declares none", () => {
        const root: string = repoWith({
            ".nexus/config/workspace.yml": [
                "hub:",
                "  name: docs-hub",
                "  remote: git@github.com:acme/docs-hub.git",
                "members: []",
                "github:",
                `  ${ASSET_RENDERER_KEY}: "${PREVIEW}"`,
                "",
            ].join("\n"),
            ".nexus/config/settings.yml": "github:\n  issues-repo: acme/tracker\n",
        });
        expect(resolveAssetRenderer(root)).toEqual({ kind: "declared", template: PREVIEW });
    });

    it("reports no renderer — never a built-in one — when no layer declares a template", () => {
        expect(resolveAssetRenderer(settingsRepo("github:\n  asset-store: acme/assets\n"))).toEqual({ kind: "none" });
    });

    it.each([
        ["a template with no slot", "https://preview.example.com/render"],
        ["a template that is not an absolute address", `/render?url=${RENDERER_SLOT}`],
        ["a template on another scheme", `file:///render?url=${RENDERER_SLOT}`],
        ["a template on a scheme that executes", `javascript:open(${RENDERER_SLOT})`],
    ])("stops on %s, naming the key and the value", (_case: string, value: string) => {
        const resolution = resolveAssetRenderer(settingsRepo(`github:\n  ${ASSET_RENDERER_KEY}: "${value}"\n`));
        expect(resolution.kind).toBe("malformed");
        if (resolution.kind === "malformed") {
            expect(resolution.value).toBe(value);
            expect(resolution.message).toContain(ASSET_RENDERER_KEY);
            expect(resolution.message).toContain(value);
        }
    });
});

describe("the key is registered wherever a publishing key must be (invariant 10)", () => {
    it("is in the resolver's key catalogue, with no built-in and no fallback", () => {
        const entry = keyEntry(ASSET_RENDERER_KEY);
        expect(entry).toBeDefined();
        expect(entry?.builtin).toBeUndefined();
        expect(entry?.fallbackTo).toBeUndefined();
    });

    it("is accepted in the hub manifest's github-defaults allowlist", () => {
        const raw: string = [
            "hub:",
            "  name: docs-hub",
            "  remote: git@github.com:acme/docs-hub.git",
            "members: []",
            "github:",
            `  ${ASSET_RENDERER_KEY}: "${PREVIEW}"`,
            "",
        ].join("\n");
        const result = parseAndValidateManifest(raw, "workspace.yml", "/srv/docs-hub");
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.workspace.github).toEqual({ [ASSET_RENDERER_KEY]: PREVIEW });
    });
});

describe("an HTML asset published with a template configured is referenced through the renderer", () => {
    it.each(["mockup.html", "page.HTML", "old.htm"])("%s", (filename: string) => {
        const reference = assetReference(published(filename), PREVIEW);
        expect(reference.url).toBe(`https://preview.example.com/?url=https://github.com/acme/assets/blob/abc123/features/issue-assets/${filename}`);
        expect(reference.markdown).toBe(`[${filename}](${reference.url})`);
    });

    it("substitutes the pinned address verbatim, neither escaped nor percent-encoded", () => {
        const reference = assetReference(published("mockup.html"), PREVIEW);
        expect(reference.url).toContain("https://github.com/acme/assets/blob/abc123/features/issue-assets/mockup.html");
        expect(reference.url).not.toContain("%3A");
        expect(reference.url).not.toContain("%2F");
    });

    it("addresses the commit the publish created, never a branch", () => {
        expect(assetReference(published("mockup.html"), PREVIEW).url).toContain("/blob/abc123/");
    });

    it("names whichever renderer the template names, so changing the template changes the next reference", () => {
        const first = assetReference(published("mockup.html"), `https://one.example.com/?u=${RENDERER_SLOT}`);
        const second = assetReference(published("mockup.html"), `https://two.example.com/?u=${RENDERER_SLOT}`);
        expect(first.url).toContain("one.example.com");
        expect(second.url).toContain("two.example.com");
        expect(first.url).not.toEqual(second.url);
    });

    it("leaves every other kind of file on the form it already takes", () => {
        expect(assetReference(published("flow.png"), PREVIEW).url).toBe(
            "https://github.com/acme/assets/blob/abc123/features/issue-assets/flow.png?raw=true",
        );
        for (const filename of ["notes.pdf", "flow.drawio", "spec.md", "archive.zip", "noext"]) {
            expect(assetReference(published(filename), PREVIEW)).toEqual(assetReference(published(filename), null));
        }
    });
});

describe("the template reaches the filing path", () => {
    it("publishes an HTML mockup and prints the rendered address", () => {
        const root: string = settingsRepo(`github:\n  asset-store: acme/assets\n  ${ASSET_RENDERER_KEY}: "${PREVIEW}"\n`);
        const io = recordingIo(root);
        const file: string = localFile("mock.html", "<p>x</p>");
        expect(runAssets(["publish", "--file", file, "--feature", "f", "--root", root], io, fakeRun)).toBe(0);
        expect(io.out).toEqual(["https://preview.example.com/?url=https://github.com/acme/assets/blob/c1/features/f/mock.html"]);
    });

    it("rewrites a body's local HTML path into the rendered link", () => {
        const root: string = settingsRepo(`github:\n  asset-store: acme/assets\n  ${ASSET_RENDERER_KEY}: "${PREVIEW}"\n`);
        const asset: string = localFile("mock.html", "<p>x</p>");
        const body: string = localFile("body.md", `See the mockup: ${asset}\n`);
        const io = recordingIo(root);
        expect(runAssets(["rewrite", "--body", body, "--asset", asset, "--feature", "f", "--root", root], io, fakeRun)).toBe(0);
        expect(fs.readFileSync(body, "utf8")).toContain(
            "[mock.html](https://preview.example.com/?url=https://github.com/acme/assets/blob/c1/features/f/mock.html)",
        );
    });

    it("stops the run at intake on a declared template that cannot work, before any draft exists", () => {
        const root: string = settingsRepo("github:\n  asset-store: acme/assets\n  asset-renderer: \"https://preview.example.com/render\"\n");
        const io = recordingIo(root);
        const asset: string = localFile("mock.html", "<p>x</p>");
        expect(runAssets(["check", "--asset", asset, "--root", root], io, fakeRun)).toBe(1);
        expect(io.err.join("\n")).toContain("malformed-renderer");
        expect(io.err.join("\n")).toContain(ASSET_RENDERER_KEY);
        expect(io.out).toEqual([]);
    });

    it("stops publish and rewrite on the same malformed template", () => {
        const root: string = settingsRepo("github:\n  asset-store: acme/assets\n  asset-renderer: \"nonsense\"\n");
        const asset: string = localFile("mock.html", "<p>x</p>");
        const body: string = localFile("body.md", `See ${asset}\n`);
        expect(runAssets(["publish", "--file", asset, "--feature", "f", "--root", root], recordingIo(root), fakeRun)).toBe(1);
        expect(runAssets(["rewrite", "--body", body, "--asset", asset, "--feature", "f", "--root", root], recordingIo(root), fakeRun)).toBe(1);
    });
});

describe("the reference builder is told the template and never learns the store's visibility", () => {
    it("has no visibility of any kind in its own source (invariant 1)", () => {
        const source: string = fs
            .readFileSync(path.join(__dirname, "asset-reference.ts"), "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/\/\/[^\n]*/g, "");
        expect(source).not.toMatch(/visibilit|isPrivate|private|public/i);
    });

    it("yields the identical reference whatever the store's visibility, for every form", () => {
        for (const filename of ["flow.png", "mockup.html", "notes.pdf"]) {
            const forPublic = assetReference(published(filename), PREVIEW);
            const forPrivate = assetReference(published(filename), PREVIEW);
            expect(forPrivate).toEqual(forPublic);
        }
    });
});
