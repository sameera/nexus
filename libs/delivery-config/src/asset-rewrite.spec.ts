/**
 * Story #598 — file an epic with its assets. The intake check stops before drafting on a missing
 * path; the post-approval rewrite publishes only what a body references and leaves no local path
 * behind; nothing is published until it runs.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { checkAssetList, declaredPathPattern, publishAndRewrite, rewriteAssetPath } from "./asset-rewrite";
import { assetReference } from "./asset-reference";
import { type AssetStore } from "./asset-store";
import { runAssets } from "./assets-cli";
import { type GhRunner, type RunResult } from "./gh";
import { type ToolkitIo } from "./io";

const STORE: AssetStore = { owner: "acme", name: "assets", repo: "acme/assets", branch: null };

function recordingIo(cwd: string): ToolkitIo & { out: string[]; err: string[] } {
    const out: string[] = [];
    const err: string[] = [];
    return { cwd, stdout: (line) => out.push(line), stderr: (line) => err.push(line), out, err };
}

/** A working directory holding a settings file, local asset files and draft bodies. */
function workspace(settings: string | null, files: Record<string, string>): string {
    const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "asset-rewrite-"));
    if (settings !== null) {
        fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), settings);
    }
    for (const [rel, body] of Object.entries(files)) {
        const file: string = path.join(root, rel);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, body);
    }
    return root;
}

/** A store stand-in that mints one commit per write and records every request. */
function fakeStore() {
    const calls: string[][] = [];
    let n = 0;
    const run: GhRunner = (args: string[]): RunResult => {
        calls.push(args);
        if (args[0] === "repo") return { status: 0, stdout: "true\n", stderr: "" };
        if (args.includes("PUT")) {
            n++;
            return { status: 0, stdout: JSON.stringify({ commit: { sha: `c${n}` } }), stderr: "" };
        }
        return { status: 1, stdout: "", stderr: "HTTP 404: Not Found" };
    };
    const writes = (): string[] => calls.filter((args) => args.includes("PUT")).map((args) => args[3]);
    return { run, calls, writes };
}

const SETTINGS = "github:\n  asset-store: acme/assets\n";

describe("the intake check, before the draft is written", () => {
    it("stops on a path that does not exist and names it", () => {
        const root: string = workspace(SETTINGS, { "assets/flow.png": "x" });
        const result = checkAssetList(["assets/flow.png", "assets/missing.png"], root);
        expect(result).toMatchObject({ ok: false, problem: "missing-asset" });
        if (!result.ok) expect(result.message).toContain("assets/missing.png");
    });

    it("stops when two assets share a file name, naming both", () => {
        const root: string = workspace(SETTINGS, { "a/flow.png": "x", "b/flow.png": "y" });
        const result = checkAssetList(["a/flow.png", "b/flow.png"], root);
        expect(result).toMatchObject({ ok: false, problem: "duplicate-filename" });
        if (!result.ok) expect(result.message).toContain("a/flow.png, b/flow.png");
    });

    it("as a command, prints the store, its visibility and the typed asset list, and publishes nothing", () => {
        const root: string = workspace(SETTINGS, { "assets/flow.png": "x", "assets/mock.html": "y" });
        const store = fakeStore();
        const io = recordingIo(root);
        expect(runAssets(["check", "--asset", "assets/flow.png", "--asset", "assets/mock.html"], io, store.run)).toBe(0);
        expect(JSON.parse(io.out[0])).toEqual({
            state: "declared",
            repo: "acme/assets",
            branch: null,
            visibility: "private",
            assets: [
                { path: "assets/flow.png", filename: "flow.png", kind: "image" },
                { path: "assets/mock.html", filename: "mock.html", kind: "file" },
            ],
        });
        expect(store.writes()).toEqual([]);
        expect(store.calls.filter((args) => args[0] === "repo")).toHaveLength(1);
    });

    it("as a command, says assets are unsupported when no store is declared and still returns the list", () => {
        const root: string = workspace("github:\n  issues-repo: acme/tracker\n", { "assets/flow.png": "x" });
        const store = fakeStore();
        const io = recordingIo(root);
        expect(runAssets(["check", "--asset", "assets/flow.png"], io, store.run)).toBe(0);
        expect(JSON.parse(io.out[0])).toMatchObject({ state: "unsupported" });
        expect(io.err.join("\n")).toContain("assets are unsupported for this repository");
        expect(store.calls).toEqual([]);
    });

    it("as a command, stops on a missing path, a malformed store and an unreadable store", () => {
        const store = fakeStore();
        const root: string = workspace(SETTINGS, { "assets/flow.png": "x" });
        const missing = recordingIo(root);
        expect(runAssets(["check", "--asset", "assets/nope.png"], missing, store.run)).toBe(1);
        expect(missing.err.join("\n")).toContain("assets/nope.png");
        const malformed: string = workspace("github:\n  asset-store: nope\n", { "assets/flow.png": "x" });
        expect(runAssets(["check", "--asset", "assets/flow.png"], recordingIo(malformed), store.run)).toBe(1);
        const unreadable = recordingIo(root);
        const failing: GhRunner = (): RunResult => ({ status: 1, stdout: "", stderr: "HTTP 404" });
        expect(runAssets(["check", "--asset", "assets/flow.png"], unreadable, failing)).toBe(1);
        expect(unreadable.err.join("\n")).toContain("store-unreadable");
        expect(runAssets(["check"], recordingIo(root), store.run)).toBe(2);
    });
});

describe("rewriting a body", () => {
    const asset = { declared: "assets/flow.png", file: "/x/assets/flow.png", filename: "flow.png", kind: "image" as const };
    const reference = assetReference({ path: "features/f/flow.png", commit: "c1", url: "https://github.com/acme/assets/blob/c1/features/f/flow.png", filename: "flow.png" });

    it("keeps the author's alt text when the path sits in an image target", () => {
        expect(rewriteAssetPath("See ![the flow](assets/flow.png) here.", asset, reference)).toBe(
            "See ![the flow](https://github.com/acme/assets/blob/c1/features/f/flow.png?raw=true) here.",
        );
    });

    it("keeps the link text when the path sits in a link target", () => {
        expect(rewriteAssetPath("[diagram](assets/flow.png)", asset, reference)).toBe(
            "[diagram](https://github.com/acme/assets/blob/c1/features/f/flow.png?raw=true)",
        );
    });

    it("turns a bare path into the whole rendered reference", () => {
        expect(rewriteAssetPath("Diagram: assets/flow.png", asset, reference)).toBe(
            "Diagram: ![flow.png](https://github.com/acme/assets/blob/c1/features/f/flow.png?raw=true)",
        );
    });

    it("leaves a body that never mentions the path byte-identical", () => {
        expect(rewriteAssetPath("Nothing here.", asset, reference)).toBe("Nothing here.");
    });
});

describe("the post-approval rewrite", () => {
    it("publishes every referenced asset in declared order, then replaces every local path in every body", () => {
        const root: string = workspace(SETTINGS, {
            "assets/flow.png": "png",
            "assets/mock.html": "html",
            "epic.filing.md": "# Epic\n\n![flow](assets/flow.png)\n\n### Story 1\n\nMockup: assets/mock.html\n",
            "STORY-1.md": "Mockup: assets/mock.html\n",
        });
        const store = fakeStore();
        const list = checkAssetList(["assets/mock.html", "assets/flow.png"], root);
        if (!list.ok) throw new Error(list.message);
        const outcome = publishAndRewrite({
            bodies: [path.join(root, "epic.filing.md"), path.join(root, "STORY-1.md")],
            assets: list.assets,
            feature: "issue-assets",
            store: STORE,
            sizeCap: 1024,
            run: store.run,
        });
        expect(outcome.ok).toBe(true);
        expect(store.writes()).toEqual(["repos/acme/assets/contents/features/issue-assets/mock.html", "repos/acme/assets/contents/features/issue-assets/flow.png"]);
        const epic: string = fs.readFileSync(path.join(root, "epic.filing.md"), "utf8");
        expect(epic).toContain("![flow](https://github.com/acme/assets/blob/c2/features/issue-assets/flow.png?raw=true)");
        expect(epic).toContain("Mockup: [mock.html](https://github.com/acme/assets/blob/c1/features/issue-assets/mock.html)");
        // The declared paths are gone as tokens; "issue-assets/flow.png" inside the published address is not one.
        expect(declaredPathPattern("assets/flow.png").test(epic)).toBe(false);
        expect(declaredPathPattern("assets/mock.html").test(epic)).toBe(false);
        expect(fs.readFileSync(path.join(root, "STORY-1.md"), "utf8")).toBe(
            "Mockup: [mock.html](https://github.com/acme/assets/blob/c1/features/issue-assets/mock.html)\n",
        );
        expect(outcome.ok && outcome.summary.rewritten).toHaveLength(2);
    });

    it("reports and does not publish a declared asset no body mentions", () => {
        const root: string = workspace(SETTINGS, { "assets/flow.png": "png", "assets/spare.png": "png", "body.md": "![f](assets/flow.png)\n" });
        const store = fakeStore();
        const io = recordingIo(root);
        expect(runAssets(["rewrite", "--body", "body.md", "--asset", "assets/flow.png", "--asset", "assets/spare.png", "--feature", "f"], io, store.run)).toBe(0);
        expect(store.writes()).toEqual(["repos/acme/assets/contents/features/f/flow.png"]);
        const summary = JSON.parse(io.out[0]);
        expect(summary.unreferenced).toEqual(["assets/spare.png"]);
        expect(summary.published).toEqual([
            { declared: "assets/flow.png", kind: "image", path: "features/f/flow.png", commit: "c1", url: "https://github.com/acme/assets/blob/c1/features/f/flow.png?raw=true" },
        ]);
        expect(io.err.join("\n")).toContain("assets/spare.png");
    });

    it("publishes nothing and rewrites nothing when no store is declared", () => {
        const root: string = workspace("github:\n  issues-repo: acme/tracker\n", { "assets/flow.png": "png", "body.md": "![f](assets/flow.png)\n" });
        const store = fakeStore();
        const io = recordingIo(root);
        expect(runAssets(["rewrite", "--body", "body.md", "--asset", "assets/flow.png", "--feature", "f"], io, store.run)).toBe(1);
        expect(io.err.join("\n")).toContain("assets are unsupported for this repository");
        expect(store.calls).toEqual([]);
        expect(fs.readFileSync(path.join(root, "body.md"), "utf8")).toBe("![f](assets/flow.png)\n");
    });

    it("leaves every body untouched when a publish is rejected, and names what was already published", () => {
        const root: string = workspace(SETTINGS, { "a.png": "1", "b.png": "2", "body.md": "a.png then b.png\n" });
        let n = 0;
        const run: GhRunner = (args: string[]): RunResult => {
            if (!args.includes("PUT")) return { status: 1, stdout: "", stderr: "HTTP 404" };
            n++;
            return n === 1
                ? { status: 0, stdout: JSON.stringify({ commit: { sha: "c1" } }), stderr: "" }
                : { status: 1, stdout: "", stderr: "HTTP 403: write denied" };
        };
        const io = recordingIo(root);
        expect(runAssets(["rewrite", "--body", "body.md", "--asset", "a.png", "--asset", "b.png", "--feature", "f"], io, run)).toBe(1);
        expect(io.err.join("\n")).toContain("HTTP 403: write denied");
        expect(io.err.join("\n")).toContain("features/f/a.png");
        expect(fs.readFileSync(path.join(root, "body.md"), "utf8")).toBe("a.png then b.png\n");
    });

    it("stops on a missing asset, a missing body, and bad arguments before publishing anything", () => {
        const root: string = workspace(SETTINGS, { "a.png": "1", "body.md": "a.png\n" });
        const store = fakeStore();
        expect(runAssets(["rewrite", "--body", "body.md", "--asset", "nope.png", "--feature", "f"], recordingIo(root), store.run)).toBe(1);
        const unreadable = recordingIo(root);
        expect(runAssets(["rewrite", "--body", "gone.md", "--asset", "a.png", "--feature", "f"], unreadable, store.run)).toBe(1);
        expect(unreadable.err.join("\n")).toContain("unreadable-body");
        expect(runAssets(["rewrite", "--asset", "a.png", "--feature", "f"], recordingIo(root), store.run)).toBe(2);
        expect(runAssets(["rewrite", "--body", "body.md", "--feature", "f"], recordingIo(root), store.run)).toBe(2);
        expect(runAssets(["rewrite", "--body", "body.md", "--asset", "a.png"], recordingIo(root), store.run)).toBe(2);
        expect(runAssets(["rewrite", "--body", "body.md", "--asset", "a.png", "--feature", "f", "stray"], recordingIo(root), store.run)).toBe(2);
        expect(store.writes()).toEqual([]);
    });
});

describe("a revised record with new assets (story #599)", () => {
    it("publishes a reused file name as a new commit and leaves the earlier reference resolving to the earlier content", () => {
        const root: string = workspace(SETTINGS, {
            "v1/diagrams/flow.png": "FIRST-DIAGRAM",
            "v2/diagrams/flow.png": "SECOND-DIAGRAM",
            "record-v1.md": "## Chosen approach\n\n![flow](diagrams/flow.png)\n",
            "record-v2.md": "## Chosen approach\n\n![flow](diagrams/flow.png)\n",
        });
        // A store stand-in that keeps every commit's snapshot, so a pinned commit can be read back.
        const current: Map<string, { sha: string; content: string }> = new Map();
        const snapshots: Map<string, Map<string, string>> = new Map();
        const puts: Record<string, string>[] = [];
        let n = 0;
        const run: GhRunner = (args: string[]): RunResult => {
            const filePath = (segment: string): string => segment.replace(/^repos\/[^/]+\/[^/]+\/contents\//, "").replace(/\?.*$/, "");
            if (args.includes("PUT")) {
                const target: string = filePath(args[3]);
                const body = JSON.parse(fs.readFileSync(args[args.indexOf("--input") + 1], "utf8")) as Record<string, string>;
                puts.push(body);
                const existing = current.get(target);
                if (existing && body["sha"] !== existing.sha) return { status: 1, stdout: "", stderr: "HTTP 422: sha mismatch" };
                n++;
                current.set(target, { sha: `blob${n}`, content: body["content"] });
                snapshots.set(`c${n}`, new Map([...current].map(([p, f]) => [p, f.content])));
                return { status: 0, stdout: JSON.stringify({ commit: { sha: `c${n}` } }), stderr: "" };
            }
            const existing = current.get(filePath(args[1]));
            return existing ? { status: 0, stdout: existing.sha, stderr: "" } : { status: 1, stdout: "", stderr: "HTTP 404" };
        };
        const at = (commit: string, p: string): string => Buffer.from(snapshots.get(commit)?.get(p) ?? "", "base64").toString();

        const first = recordingIo(path.join(root, "v1"));
        expect(runAssets(["rewrite", "--body", "../record-v1.md", "--asset", "diagrams/flow.png", "--feature", "f", "--root", root], first, run)).toBe(0);
        const second = recordingIo(path.join(root, "v2"));
        expect(runAssets(["rewrite", "--body", "../record-v2.md", "--asset", "diagrams/flow.png", "--feature", "f", "--root", root], second, run)).toBe(0);

        const v1: string = fs.readFileSync(path.join(root, "record-v1.md"), "utf8");
        const v2: string = fs.readFileSync(path.join(root, "record-v2.md"), "utf8");
        expect(v1).toContain("blob/c1/features/f/flow.png?raw=true");
        expect(v2).toContain("blob/c2/features/f/flow.png?raw=true");
        expect(at("c1", "features/f/flow.png")).toBe("FIRST-DIAGRAM");
        expect(at("c2", "features/f/flow.png")).toBe("SECOND-DIAGRAM");
        // The second write updated the path with the existing blob's sha: an update commit, never a force-overwrite.
        expect(puts[1]["sha"]).toBe("blob1");
    });
});
