/**
 * Story #596 — publish a file and receive a pinned reference. Every case runs against a canned
 * store standing in for GitHub's file-contents endpoint: no network, no spawn, no clone.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { publishAsset, storePath } from "./asset-publish";
import { type AssetStore, DEFAULT_ASSET_SIZE_CAP, resolveAssetSizeCap } from "./asset-store";
import { runAssets } from "./assets-cli";
import { type GhRunner, type RunResult } from "./gh";
import { type ToolkitIo } from "./io";

const STORE: AssetStore = { owner: "acme", name: "assets", repo: "acme/assets", branch: null };

function recordingIo(cwd: string): ToolkitIo & { out: string[]; err: string[] } {
    const out: string[] = [];
    const err: string[] = [];
    return { cwd, stdout: (line) => out.push(line), stderr: (line) => err.push(line), out, err };
}

function tmpDir(prefix: string): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function localFile(name: string, content: string): string {
    const file: string = path.join(tmpDir("asset-local-"), name);
    fs.writeFileSync(file, content);
    return file;
}

/**
 * A stand-in for the store: it answers the two requests the publish step makes and keeps every
 * commit's snapshot, so a test can read what a pinned commit resolves to.
 */
function fakeStore() {
    const current: Map<string, { sha: string; content: string }> = new Map();
    const snapshots: Map<string, Map<string, string>> = new Map();
    const calls: string[][] = [];
    const puts: Record<string, string>[] = [];
    let n = 0;
    const target = (segment: string): string => segment.replace(/^repos\/[^/]+\/[^/]+\/contents\//, "").replace(/\?.*$/, "");
    const run: GhRunner = (args: string[]): RunResult => {
        calls.push(args);
        if (args[0] !== "api") return { status: 1, stdout: "", stderr: `unexpected command ${args[0]}` };
        if (args[1] === "-X" && args[2] === "PUT") {
            const filePath: string = target(args[3]);
            const body = JSON.parse(fs.readFileSync(args[args.indexOf("--input") + 1], "utf8")) as Record<string, string>;
            puts.push(body);
            const existing = current.get(filePath);
            if (existing && body["sha"] !== existing.sha) {
                return { status: 1, stdout: "", stderr: 'HTTP 422: "sha" wasn\'t supplied' };
            }
            n++;
            const commit = `commit${n}`;
            current.set(filePath, { sha: `blob${n}`, content: body["content"] });
            snapshots.set(commit, new Map([...current].map(([p, f]) => [p, f.content])));
            return { status: 0, stdout: JSON.stringify({ content: { path: filePath }, commit: { sha: commit } }), stderr: "" };
        }
        const existing = current.get(target(args[1]));
        if (!existing) return { status: 1, stdout: "", stderr: "HTTP 404: Not Found" };
        return { status: 0, stdout: `${existing.sha}\n`, stderr: "" };
    };
    const contentAt = (commit: string, filePath: string): string =>
        Buffer.from(snapshots.get(commit)?.get(filePath) ?? "", "base64").toString();
    return { run, calls, puts, contentAt };
}

describe("publishing a file into the store", () => {
    it("writes the file under features/<slug>/<filename> and pins the commit it created", () => {
        const store = fakeStore();
        const file: string = localFile("flow.png", "PNG-BYTES");
        const result = publishAsset({ file, feature: "issue-assets", store: STORE, sizeCap: DEFAULT_ASSET_SIZE_CAP, run: store.run });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.asset.path).toBe(storePath("issue-assets", "flow.png"));
        expect(result.asset.path).toBe("features/issue-assets/flow.png");
        expect(result.asset.commit).toBe("commit1");
        expect(result.asset.url).toBe("https://github.com/acme/assets/blob/commit1/features/issue-assets/flow.png");
        expect(store.contentAt("commit1", "features/issue-assets/flow.png")).toBe("PNG-BYTES");
    });

    it("writes to the declared branch when the store names one", () => {
        const store = fakeStore();
        const file: string = localFile("flow.png", "x");
        publishAsset({ file, feature: "f", store: { ...STORE, branch: "media" }, sizeCap: 100, run: store.run });
        expect(store.puts[0]["branch"]).toBe("media");
        expect(store.calls[0][1]).toContain("?ref=media");
    });

    it("creates no local clone or worktree: every call is a file-contents request", () => {
        const store = fakeStore();
        const before: string[] = fs.readdirSync(os.tmpdir());
        const file: string = localFile("flow.png", "x");
        const result = publishAsset({ file, feature: "f", store: STORE, sizeCap: 100, run: store.run });
        expect(result.ok).toBe(true);
        expect(store.calls.every((args) => args[0] === "api" && /contents\//.test(args.join(" ")))).toBe(true);
        expect(store.calls.some((args) => args.includes("clone") || args.includes("worktree"))).toBe(false);
        // The request file is gone once the call returns; nothing of the store stays on disk.
        const after: string[] = fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith("nexus-asset-"));
        expect(after.filter((name) => !before.includes(name))).toEqual([]);
    });

    it("keeps the earlier reference resolving to the earlier content when the path is published again", () => {
        const store = fakeStore();
        const first = publishAsset({ file: localFile("flow.png", "VERSION-ONE"), feature: "f", store: STORE, sizeCap: 100, run: store.run });
        const second = publishAsset({ file: localFile("flow.png", "VERSION-TWO"), feature: "f", store: STORE, sizeCap: 100, run: store.run });
        expect(first.ok && second.ok).toBe(true);
        if (!first.ok || !second.ok) return;
        expect(first.asset.path).toBe(second.asset.path);
        expect(first.asset.commit).not.toBe(second.asset.commit);
        expect(first.asset.url).not.toBe(second.asset.url);
        expect(store.contentAt(first.asset.commit, first.asset.path)).toBe("VERSION-ONE");
        expect(store.contentAt(second.asset.commit, second.asset.path)).toBe("VERSION-TWO");
        // The second write carried the existing blob's sha — an update, never a forced overwrite.
        expect(store.puts[1]["sha"]).toBe("blob1");
    });

    it("writes nothing for an oversize file and reports the cap and the file's size", () => {
        const store = fakeStore();
        const file: string = localFile("big.bin", "x".repeat(20));
        const result = publishAsset({ file, feature: "f", store: STORE, sizeCap: 10, run: store.run });
        expect(result).toMatchObject({ ok: false, problem: "oversize" });
        if (result.ok) return;
        expect(result.message).toContain("20 bytes");
        expect(result.message).toContain("10 bytes");
        expect(store.calls).toEqual([]);
    });

    it("reports a missing local file without any request", () => {
        const store = fakeStore();
        const result = publishAsset({ file: "/nowhere/flow.png", feature: "f", store: STORE, sizeCap: 10, run: store.run });
        expect(result).toMatchObject({ ok: false, problem: "missing-file" });
        expect(store.calls).toEqual([]);
    });

    it("reports a rejected write as GitHub's own error", () => {
        const run: GhRunner = (args: string[]): RunResult =>
            args.includes("PUT")
                ? { status: 1, stdout: "", stderr: "HTTP 403: Resource not accessible by integration" }
                : { status: 1, stdout: "", stderr: "HTTP 404: Not Found" };
        const result = publishAsset({ file: localFile("flow.png", "x"), feature: "f", store: STORE, sizeCap: 100, run });
        expect(result).toMatchObject({ ok: false, problem: "github" });
        if (result.ok) return;
        expect(result.message).toContain("HTTP 403: Resource not accessible by integration");
    });

    it("reports a write whose answer names no commit", () => {
        const run: GhRunner = (): RunResult => ({ status: 0, stdout: "not json", stderr: "" });
        const result = publishAsset({ file: localFile("flow.png", "x"), feature: "f", store: STORE, sizeCap: 100, run });
        expect(result).toMatchObject({ ok: false, problem: "github" });
    });
});

function repoWith(settings: string): string {
    const root: string = tmpDir("asset-publish-repo-");
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), settings);
    return root;
}

describe("the size cap is a settings key with a stated default", () => {
    it("defaults to 5 MB when no layer declares one", () => {
        expect(resolveAssetSizeCap(repoWith("github:\n  asset-store: acme/assets\n"))).toEqual({
            kind: "declared",
            bytes: 5 * 1024 * 1024,
        });
    });

    it("takes the team's declared value and names a malformed one", () => {
        expect(resolveAssetSizeCap(repoWith("github:\n  asset-size-cap: 1024\n"))).toEqual({ kind: "declared", bytes: 1024 });
        expect(resolveAssetSizeCap(repoWith("github:\n  asset-size-cap: five\n"))).toMatchObject({ kind: "malformed", value: "five" });
    });
});

describe("the publish command", () => {
    it("prints the pinned reference, or the whole record with --json", () => {
        const root: string = repoWith("github:\n  asset-store: acme/assets\n");
        const store = fakeStore();
        const file: string = localFile("flow.png", "x");
        const io = recordingIo(root);
        expect(runAssets(["publish", "--file", file, "--feature", "issue-assets", "--root", root], io, store.run)).toBe(0);
        expect(io.out).toEqual(["https://github.com/acme/assets/blob/commit1/features/issue-assets/flow.png?raw=true"]);
        const jsonIo = recordingIo(root);
        expect(runAssets(["publish", "--file", file, "--feature", "issue-assets", "--json"], jsonIo, store.run)).toBe(0);
        expect(JSON.parse(jsonIo.out[0])).toMatchObject({ path: "features/issue-assets/flow.png", commit: "commit2", filename: "flow.png" });
    });

    it("writes nothing and reports assets unsupported when no store is declared", () => {
        const root: string = repoWith("github:\n  issues-repo: acme/tracker\n");
        const store = fakeStore();
        const io = recordingIo(root);
        expect(runAssets(["publish", "--file", localFile("flow.png", "x"), "--feature", "f", "--root", root], io, store.run)).toBe(1);
        expect(io.err.join("\n")).toContain("assets are unsupported for this repository");
        expect(io.out).toEqual([]);
        expect(store.calls).toEqual([]);
    });

    it("stops on an oversize file before any request, naming cap and size", () => {
        const root: string = repoWith("github:\n  asset-store: acme/assets\n  asset-size-cap: 4\n");
        const store = fakeStore();
        const io = recordingIo(root);
        expect(runAssets(["publish", "--file", localFile("flow.png", "12345"), "--feature", "f", "--root", root], io, store.run)).toBe(1);
        expect(io.err.join("\n")).toContain("oversize");
        expect(io.err.join("\n")).toContain("5 bytes");
        expect(io.err.join("\n")).toContain("4 bytes");
        expect(store.calls).toEqual([]);
    });

    it("stops on a malformed store or cap, and on missing arguments", () => {
        const store = fakeStore();
        const bad: string = repoWith("github:\n  asset-store: nope\n");
        expect(runAssets(["publish", "--file", localFile("a.png", "x"), "--feature", "f", "--root", bad], recordingIo(bad), store.run)).toBe(1);
        const badCap: string = repoWith("github:\n  asset-store: acme/assets\n  asset-size-cap: lots\n");
        const capIo = recordingIo(badCap);
        expect(runAssets(["publish", "--file", localFile("a.png", "x"), "--feature", "f", "--root", badCap], capIo, store.run)).toBe(1);
        expect(capIo.err.join("\n")).toContain("malformed-size-cap");
        const root: string = repoWith("github:\n  asset-store: acme/assets\n");
        expect(runAssets(["publish", "--feature", "f", "--root", root], recordingIo(root), store.run)).toBe(2);
        expect(runAssets(["publish", "--file", "a.png", "--feature", "Bad Slug", "--root", root], recordingIo(root), store.run)).toBe(2);
        expect(runAssets(["publish", "--file", "a.png", "--feature", "f", "stray", "--root", root], recordingIo(root), store.run)).toBe(2);
        expect(store.calls).toEqual([]);
    });
});
