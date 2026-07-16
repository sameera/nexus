/**
 * Component-payload vendoring (STORY-60.01): the primitives that carry the live root `.claude/`
 * component tree — the single authoritative deploy source (decision record, epic #60) — into the
 * portable distributable as plain, review-gated files.
 *
 * The managed set is exactly the three component subtrees (`commands/`, `agents/`, `skills/`).
 * Everything else in `.claude/` — notably the per-repo `settings.local.json` — is user-owned and
 * never vendored, never deployed, never hashed. `hashComponentTree` is the payload half of the
 * fingerprint gate: it hashes a canonical manifest of the managed set (sorted relative paths +
 * per-file content hashes), so a distributable whose payload lags the live tree fails the
 * source-repo test gate instead of deploying stale components.
 *
 * Node builtins only; bundled into the `nexus` entrypoint.
 */

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

/** The managed component subtrees — the set the retired nxs.update.claude.sh installed. */
export const COMPONENT_SUBTREES: string[] = ["commands", "agents", "skills"];

/** Key of the payload entry in the committed fingerprint pin. */
export const COMPONENT_PAYLOAD_KEY = "claude-components";

/** Directory name the payload travels under, beside the bundled entrypoints. */
export const COMPONENT_PAYLOAD_DIRNAME = "claude-components";

/** The live, authoritative component source: the repo-root `.claude/` tree. */
export function liveClaudeDir(srcDir: string): string {
    return path.resolve(srcDir, "..", "..", "..", ".claude");
}

function walkFiles(dir: string, base: string, out: string[]): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const abs: string = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkFiles(abs, base, out);
        } else {
            out.push(path.relative(base, abs).split(path.sep).join("/"));
        }
    }
}

/**
 * Every managed component file under `claudeDir`, as sorted, posix-style paths relative to
 * `claudeDir`. Only the managed subtrees are considered; a missing subtree is simply absent.
 */
export function listComponentFiles(claudeDir: string): string[] {
    const files: string[] = [];
    for (const subtree of COMPONENT_SUBTREES) {
        const root: string = path.join(claudeDir, subtree);
        if (fs.existsSync(root) && fs.statSync(root).isDirectory()) {
            walkFiles(root, claudeDir, files);
        }
    }
    return files.sort();
}

/**
 * sha256 of the managed set's canonical manifest: one `relpath\ncontent-sha256\n` record per
 * file, sorted by path. Any managed byte, added file, or removed file changes the hash; files
 * outside the managed subtrees never do.
 */
export function hashComponentTree(claudeDir: string): string {
    const manifest = createHash("sha256");
    for (const rel of listComponentFiles(claudeDir)) {
        const content: Buffer = fs.readFileSync(path.join(claudeDir, ...rel.split("/")));
        manifest.update(rel);
        manifest.update("\n");
        manifest.update(createHash("sha256").update(content).digest("hex"));
        manifest.update("\n");
    }
    return manifest.digest("hex");
}

/**
 * Copy the managed set from `claudeDir` into `destDir` as plain files, overwriting in place.
 * Returns the copied payload-relative paths.
 */
export function copyComponentTree(claudeDir: string, destDir: string): string[] {
    const files: string[] = listComponentFiles(claudeDir);
    for (const rel of files) {
        const segments: string[] = rel.split("/");
        const dest: string = path.join(destDir, ...segments);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(path.join(claudeDir, ...segments), dest);
    }
    return files;
}
