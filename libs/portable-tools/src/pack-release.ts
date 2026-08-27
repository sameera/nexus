/**
 * The release tree (story #308): the directory the published package's `files` allowlist points
 * at, assembled from the three parts that ship together — the bundled TypeScript executable, the
 * Python toolkit's files, and the component payload.
 *
 * The parts are staged into one directory under the package root rather than published from
 * where they live in the checkout, because the package root is what both toolkits walk up to
 * when they resolve the single `VERSION` declaration. A layout where the two halves sat at
 * different depths under different roots would give them different answers.
 *
 * Nothing here is fetched at install time: the payload travels inside the package, so an adopter
 * runs no network step after installing and the two halves cannot reach different versions.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { buildAllBundles } from "./build-bundles.js";
import { copyComponentTree, COMPONENT_PAYLOAD_DIRNAME, liveClaudeDir } from "./vendor-components.js";

/** The staged directory, relative to the package root. Named in the manifest's `files`. */
export const RELEASE_TREE_DIRNAME = "dist";

/** Directory the Python toolkit travels under, beside the bundled executable. */
export const GH_TOOLKIT_DIRNAME = "gh-toolkit";

/** The two toolkit names the manifest declares as binaries. */
export const BIN_NAMES: readonly string[] = ["nexus", "nexus-gh"];

/** The Python toolkit's source root in the checkout. */
export function ghToolkitSource(repoRoot: string): string {
    return path.join(repoRoot, "libs", "gh-toolkit");
}

function copyTree(srcDir: string, destDir: string): string[] {
    const copied: string[] = [];
    for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
        const src: string = path.join(srcDir, entry.name);
        const dest: string = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
            copied.push(...copyTree(src, dest));
        } else {
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.copyFileSync(src, dest);
            fs.chmodSync(dest, fs.statSync(src).mode & 0o777);
            copied.push(dest);
        }
    }
    return copied;
}

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

    written.push(...copyTree(ghToolkitSource(repoRoot), path.join(releaseDir, GH_TOOLKIT_DIRNAME)));
    const payloadDir: string = path.join(releaseDir, COMPONENT_PAYLOAD_DIRNAME);
    for (const rel of copyComponentTree(liveClaudeDir(srcDir), payloadDir)) {
        written.push(path.join(payloadDir, ...rel.split("/")));
    }
    return written;
}

async function main(): Promise<void> {
    const repoRoot: string = path.resolve(import.meta.dirname, "..", "..", "..");
    const written: string[] = await buildReleaseTree(repoRoot);
    console.log(`Release tree: ${written.length} files under ${path.join(repoRoot, RELEASE_TREE_DIRNAME)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
