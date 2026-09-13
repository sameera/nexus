/**
 * Publish one local file into the asset store and hand back a reference pinned to the commit the
 * publish created (epic #594, story #596; decision record #600).
 *
 * The write goes through GitHub's file-contents endpoint — never a clone or a worktree of the
 * store. The endpoint writes one file per commit and returns that commit, which are the two things
 * the design needs: a commit address resolves a path to the same bytes forever, so a later upload to
 * the same path makes a new commit and never changes what an earlier issue shows. Nothing here
 * deletes, force-pushes or checks permissions; a rejected write is reported as GitHub's own error.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type AssetStore } from "./asset-store.js";
import { type GhRunner, type RunResult } from "./gh.js";

/** Where a feature's assets live in the store: `features/<slug>/<filename>`. */
export function storePath(feature: string, filename: string): string {
    return `features/${feature}/${filename}`;
}

/** The address of a published file at the commit that published it. */
export function pinnedUrl(store: AssetStore, commit: string, storeFilePath: string): string {
    return `https://github.com/${store.repo}/blob/${commit}/${storeFilePath}`;
}

export interface PublishRequest {
    /** The local file to publish. */
    file: string;
    /** The feature slug the file is filed under. */
    feature: string;
    store: AssetStore;
    /** The per-file cap in bytes, checked against the local file before any request. */
    sizeCap: number;
    run: GhRunner;
    /** The commit message; a default names the path. */
    message?: string;
}

export interface PublishedAsset {
    /** The path in the store the file was written to. */
    path: string;
    /** The commit the publish created. */
    commit: string;
    /** The pinned address of the file at that commit. */
    url: string;
    /** The local file name, as the reference builder names it. */
    filename: string;
}

export type PublishProblem = "missing-file" | "oversize" | "github";

export type PublishResult = { ok: true; asset: PublishedAsset } | { ok: false; problem: PublishProblem; message: string };

/** The blob sha of the file already at `storeFilePath`, or null when the store has none there. */
function existingSha(store: AssetStore, storeFilePath: string, run: GhRunner): string | null {
    const ref: string = store.branch ? `?ref=${encodeURIComponent(store.branch)}` : "";
    const result: RunResult = run(["api", `repos/${store.repo}/contents/${storeFilePath}${ref}`, "--jq", ".sha"]);
    if (result.status !== 0) return null;
    const sha: string = result.stdout.trim();
    return sha === "" ? null : sha;
}

/** Publish `file` under the feature's folder. Reads the local file first; sends nothing oversize. */
export function publishAsset(request: PublishRequest): PublishResult {
    const { file, feature, store, sizeCap, run } = request;
    let size: number;
    try {
        size = fs.statSync(file).size;
    } catch {
        return { ok: false, problem: "missing-file", message: `asset file not found: ${file}` };
    }
    if (size > sizeCap) {
        return {
            ok: false,
            problem: "oversize",
            message: `${file} is ${size} bytes; the per-file cap (asset-size-cap) is ${sizeCap} bytes — nothing was written`,
        };
    }

    const filename: string = path.basename(file);
    const target: string = storePath(feature, filename);
    const body: Record<string, string> = {
        message: request.message ?? `assets(${feature}): publish ${filename}`,
        content: fs.readFileSync(file).toString("base64"),
    };
    if (store.branch) body["branch"] = store.branch;
    const sha: string | null = existingSha(store, target, run);
    if (sha) body["sha"] = sha;

    // The content travels in a request file rather than on the argument vector: a file near the cap
    // is far larger than a single argument may be.
    const requestDir: string = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-asset-"));
    const requestFile: string = path.join(requestDir, "put.json");
    fs.writeFileSync(requestFile, JSON.stringify(body));
    let result: RunResult;
    try {
        result = run(["api", "-X", "PUT", `repos/${store.repo}/contents/${target}`, "--input", requestFile]);
    } finally {
        fs.rmSync(requestDir, { recursive: true, force: true });
    }
    if (result.status !== 0) {
        return { ok: false, problem: "github", message: `GitHub rejected the write of ${target}: ${result.stderr.trim()}` };
    }
    let commit: string | undefined;
    try {
        commit = (JSON.parse(result.stdout) as { commit?: { sha?: string } }).commit?.sha;
    } catch {
        commit = undefined;
    }
    if (!commit) {
        return { ok: false, problem: "github", message: `GitHub returned no commit for the write of ${target}` };
    }
    return { ok: true, asset: { path: target, commit, url: pinnedUrl(store, commit, target), filename } };
}
