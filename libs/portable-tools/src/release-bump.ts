/**
 * The release-bump check: a branch that changes what ships must move the version in
 * `package.json`, or say in a commit trailer why it needs none.
 *
 * It replaces the fingerprint pin. The pin was made to catch a committed build that lagged its
 * source; once nothing was committed and publishing rebuilt from source, the only thing it still
 * did was stop the author until they re-pinned — a pause that was meant to prompt the version
 * bump and changelog entry. This check asks for the bump directly.
 *
 * The base is the merge base with the main branch, not the last tag: tags are not cut for every
 * release, so a tag baseline would compare months of work against a version that has long moved
 * and would always pass. The comparison includes the working tree, so the check fires before the
 * change is committed, as the pin did.
 *
 * Not a bundle entry point.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

/** The commit trailer that waives the bump for a change that alters no adopter behaviour. */
export const WAIVER_TRAILER = "Nexus-No-Bump";

export interface ReleaseBumpResult {
    status: "pass" | "fail" | "skip";
    message: string;
}

/**
 * True for a path whose change reaches an adopter: the component payload, the release template
 * masters, and library source the executable or the shared-library surface is built from. Tests
 * and their fixtures never ship.
 */
export function isShippedPath(rel: string): boolean {
    if (rel.startsWith("components/") || rel.startsWith("common/templates/")) {
        return true;
    }
    if (!/^libs\/[^/]+\/src\//.test(rel) || rel.includes("/fixtures/")) {
        return false;
    }
    return rel.endsWith(".ts") && !rel.endsWith(".spec.ts") && !rel.endsWith("-fixtures.ts");
}

function git(repo: string, ...args: string[]): string {
    return execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function lines(text: string): string[] {
    return text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

export function checkReleaseBump(repoRoot: string, baseRef: string): ReleaseBumpResult {
    let base: string;
    try {
        base = git(repoRoot, "merge-base", "HEAD", baseRef).trim();
    } catch {
        return {
            status: "skip",
            message: `No merge base with ${baseRef} (missing ref or shallow clone), so there is nothing to compare against.`,
        };
    }

    const changed: string[] = [
        ...lines(git(repoRoot, "diff", "--name-only", base)),
        ...lines(git(repoRoot, "ls-files", "--others", "--exclude-standard")),
    ].filter(isShippedPath);
    if (changed.length === 0) {
        return { status: "pass", message: `Nothing that ships changed since ${baseRef}.` };
    }

    const baseVersion: string = JSON.parse(git(repoRoot, "show", `${base}:package.json`)).version;
    const version: string = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")).version;
    if (version !== baseVersion) {
        return { status: "pass", message: `The version moved from ${baseVersion} to ${version}.` };
    }

    const waivers: string[] = lines(
        git(repoRoot, "log", `--format=%(trailers:key=${WAIVER_TRAILER},valueonly)`, `${base}..HEAD`),
    );
    if (waivers.length > 0) {
        return { status: "pass", message: `Bump waived: ${waivers.join("; ")}` };
    }

    const unique: string[] = [...new Set(changed)].sort();
    return {
        status: "fail",
        message: [
            `Files that ship changed since ${baseRef}, but package.json still says ${version}:`,
            ...unique.map((file) => `  ${file}`),
            "Either bump the version in package.json and add the matching CHANGELOG.md entry,",
            `or, when no adopter sees a difference, add a "${WAIVER_TRAILER}: <reason>" trailer to a commit on this branch.`,
        ].join("\n"),
    };
}
