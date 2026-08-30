/**
 * The release tree (story #308): the directory the published package's `files` allowlist points
 * at, assembled from the two parts that ship together — the bundled TypeScript executable and
 * the component payload.
 *
 * The parts are staged into one directory under the package root rather than published from
 * where they live in the checkout, because the package root is what the executable walks up to
 * when it resolves the single `VERSION` declaration. A layout where a part sat at a different
 * depth under a different root would give it a different answer.
 *
 * Nothing here is fetched at install time: the payload travels inside the package, so an adopter
 * runs no network step after installing and the executable and its payload cannot reach
 * different versions.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { buildAllBundles } from "./build-bundles.js";
import { isDirectRun } from "./entry-point.js";
import { listPayloadFiles } from "./release-payload.js";

/** The staged directory, relative to the package root. Named in the manifest's `files`. */
export const RELEASE_TREE_DIRNAME = "dist";

/** The one binary name the manifest declares. */
export const BIN_NAMES: readonly string[] = ["nexus"];

/**
 * Stages every published part under `<repoRoot>/dist`, replacing whatever was there. Returns the
 * absolute paths written, so a caller can report what a release carries.
 */
export async function buildReleaseTree(repoRoot: string, outDir?: string): Promise<string[]> {
    const releaseDir: string = outDir ?? path.join(repoRoot, RELEASE_TREE_DIRNAME);
    fs.rmSync(releaseDir, { recursive: true, force: true });
    fs.mkdirSync(releaseDir, { recursive: true });

    const srcDir: string = path.join(repoRoot, "libs", "portable-tools", "src");
    const written: string[] = await buildAllBundles(srcDir, releaseDir);
    for (const bundle of written) {
        fs.chmodSync(bundle, 0o755);
    }

    // The payload is the stated set, not the directories it happens to live in (story #309).
    for (const file of listPayloadFiles(repoRoot)) {
        const dest: string = path.join(releaseDir, ...file.staged.split("/"));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(file.source, dest);
        fs.chmodSync(dest, fs.statSync(file.source).mode & 0o777);
        written.push(dest);
    }
    return written;
}

async function main(): Promise<void> {
    const repoRoot: string = path.resolve(import.meta.dirname, "..", "..", "..");
    const written: string[] = await buildReleaseTree(repoRoot);
    console.log(`Release tree: ${written.length} files under ${path.join(repoRoot, RELEASE_TREE_DIRNAME)}`);
}

if (isDirectRun(import.meta.url, process.argv[1])) {
    main();
}
