/**
 * Story #595 — declare the asset store once. A stage resolves the store through one step and gets
 * a location, "unsupported", or a named malformed value; the key rides the same precedence chain
 * and hub layer as the other publishing targets (decision record #600, invariants 8 and 9).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { parseAndValidateManifest } from "@nexus/workspace/manifest";
import { ASSET_STORE_KEY, parseAssetStore, resolveAssetStore } from "./asset-store";
import { runAssets } from "./assets-cli";
import { type ToolkitIo } from "./io";
import { keyEntry } from "./keys";

function recordingIo(cwd: string): ToolkitIo & { out: string[]; err: string[] } {
    const out: string[] = [];
    const err: string[] = [];
    return { cwd, stdout: (line) => out.push(line), stderr: (line) => err.push(line), out, err };
}

function repoWith(files: Record<string, string>): string {
    const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "asset-store-"));
    for (const [rel, body] of Object.entries(files)) {
        const file: string = path.join(root, ...rel.split("/"));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, body);
    }
    return root;
}

/** A hub checkout declaring `github:` defaults, with a repo-level settings file beside them. */
function hubRepoWith(github: Record<string, string>, settings: string): string {
    return repoWith({
        ".nexus/config/workspace.yml": [
            "hub:",
            "  name: docs-hub",
            "  remote: git@github.com:acme/docs-hub.git",
            "members: []",
            "github:",
            ...Object.entries(github).map(([key, value]) => `  ${key}: ${value}`),
            "",
        ].join("\n"),
        ".nexus/config/settings.yml": settings,
    });
}

describe("resolving the declared store", () => {
    it("hands a stage the location declared as owner/repo, on the store's default branch", () => {
        const root: string = repoWith({ ".nexus/config/settings.yml": "github:\n  asset-store: acme/assets\n" });
        expect(resolveAssetStore(root)).toEqual({
            kind: "declared",
            store: { owner: "acme", name: "assets", repo: "acme/assets", branch: null },
        });
    });

    it("hands a stage the branch when declared as owner/repo@branch", () => {
        const root: string = repoWith({ ".nexus/config/settings.yml": 'github:\n  asset-store: "acme/tracker@assets"\n' });
        const resolution = resolveAssetStore(root);
        expect(resolution.kind).toBe("declared");
        if (resolution.kind === "declared") {
            expect(resolution.store.repo).toBe("acme/tracker");
            expect(resolution.store.branch).toBe("assets");
        }
    });

    it("uses the hub's store when the member layer declares none", () => {
        const root: string = hubRepoWith({ "asset-store": "acme/assets@media" }, "github:\n  issues-repo: acme/tracker\n");
        expect(resolveAssetStore(root)).toEqual({
            kind: "declared",
            store: { owner: "acme", name: "assets", repo: "acme/assets", branch: "media" },
        });
    });

    it("reports assets unsupported with no default location when no layer declares a store", () => {
        const root: string = repoWith({ ".nexus/config/settings.yml": "github:\n  issues-repo: acme/tracker\n" });
        expect(resolveAssetStore(root)).toEqual({ kind: "unsupported" });
    });

    it("stops on a malformed value and names it", () => {
        const root: string = repoWith({ ".nexus/config/settings.yml": "github:\n  asset-store: just-a-name\n" });
        const resolution = resolveAssetStore(root);
        expect(resolution.kind).toBe("malformed");
        if (resolution.kind === "malformed") {
            expect(resolution.value).toBe("just-a-name");
            expect(resolution.message).toContain("just-a-name");
        }
    });

    it.each(["acme/assets/extra", "acme/", "/assets", "acme/assets@", "acme assets", "https://github.com/acme/assets"])(
        "rejects %s as not owner/repo or owner/repo@branch",
        (value: string) => {
            expect(parseAssetStore(value)).toBeNull();
        },
    );
});

describe("the store as a command", () => {
    it("prints the declared store and branch as JSON", () => {
        const root: string = repoWith({ ".nexus/config/settings.yml": "github:\n  asset-store: acme/assets@media\n" });
        const io = recordingIo(root);
        expect(runAssets(["resolve", "--root", root], io)).toBe(0);
        expect(JSON.parse(io.out.join("\n"))).toEqual({ state: "declared", repo: "acme/assets", branch: "media" });
    });

    it("prints the unsupported state, never a default location", () => {
        const root: string = repoWith({ ".nexus/config/settings.yml": "github:\n  issues-repo: acme/tracker\n" });
        const io = recordingIo(root);
        expect(runAssets(["resolve", "--root", root], io)).toBe(0);
        expect(JSON.parse(io.out.join("\n"))).toEqual({ state: "unsupported" });
    });

    it("exits non-zero on a malformed value, naming it on stderr and printing nothing", () => {
        const root: string = repoWith({ ".nexus/config/settings.yml": "github:\n  asset-store: nonsense\n" });
        const io = recordingIo(root);
        expect(runAssets(["resolve", "--root", root], io)).toBe(1);
        expect(io.out).toEqual([]);
        expect(io.err.join("\n")).toContain("malformed-store");
        expect(io.err.join("\n")).toContain("nonsense");
    });

    it("rejects an unknown command and a stray argument with usage", () => {
        const root: string = repoWith({});
        expect(runAssets(["publish-nothing"], recordingIo(root))).toBe(2);
        expect(runAssets(["resolve", "extra", "--root", root], recordingIo(root))).toBe(2);
        expect(runAssets([], recordingIo(root))).toBe(2);
        const io = recordingIo(root);
        expect(runAssets(["--help"], io)).toBe(0);
        expect(io.out.join("\n")).toContain("resolve");
    });
});

describe("the key is registered wherever a publishing key must be (invariant 9)", () => {
    it("is in the resolver's key catalogue, with no built-in and no fallback to the issues repository", () => {
        const entry = keyEntry(ASSET_STORE_KEY);
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
            `  ${ASSET_STORE_KEY}: acme/assets`,
            "",
        ].join("\n");
        const result = parseAndValidateManifest(raw, "workspace.yml", "/srv/docs-hub");
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.workspace.github).toEqual({ [ASSET_STORE_KEY]: "acme/assets" });
    });
});
