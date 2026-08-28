/**
 * The authored root has exactly one definition, and this is the check that keeps it that way
 * (epic #256, invariant 4).
 *
 * The epic filed a hand-measured inventory of the code that reaches the component tree. That
 * inventory was already stale when the work started — sites it named no longer existed, and sites
 * it did not name had appeared. An enumerated list is wrong again on the next epic. So the
 * inventory is derived here instead: every production source file in the workspace is searched for
 * the directory the harness loads, and anything outside a short, explicitly justified waiver set is
 * a failure. A new site that resolves the loaded path as an authoring source cannot be added
 * quietly.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");

/** The loaded directory's name, spelled so this file's own mention is not the thing it reports. */
const LOADED_DIRNAME = `.${"claude"}`;

/**
 * The sites allowed to name the loaded directory. None of them is an authoring read: each one is
 * about the loaded path *as* the loaded path, which is a thing Nexus still has to reason about.
 */
const WAIVED: ReadonlyMap<string, string> = new Map([
    ["libs/portable-tools/src/install-location.ts", "the install location's default directory name under a home directory"],
    ["libs/portable-tools/src/migrate-components.ts", "the migration verb's read of a member repository's loaded path"],
    ["libs/portable-tools/src/environment-guard.ts", "the duplicate guard's read of the loaded path"],
    ["libs/portable-tools/src/release-gate.ts", "the shipped-body scanner's adopter-facing path pattern"],
    ["libs/portable-tools/src/component-invocations.ts", "the invocation gate's adopter-facing repo-bound-artifact pattern"],
]);

/**
 * Production source in this workspace: tracked TypeScript, minus tests, minus build output, minus
 * `libs/origin`, which is an archived copy of an earlier release rather than live source.
 */
function productionSources(): string[] {
    const tracked: string[] = execFileSync("git", ["ls-files", "--", "*.ts", "*.mts", "*.tsx"], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
    })
        .split("\n")
        .filter((line) => line !== "");
    return tracked.filter(
        (rel) =>
            !rel.endsWith(".spec.ts") &&
            !rel.startsWith("libs/origin/") &&
            !rel.includes("/dist/") &&
            !rel.includes("/out-tsc/") &&
            !rel.includes("/node_modules/"),
    );
}

describe("the code that names the directory the harness loads", () => {
    it("is only the waived set — every other site derives the authored root from its one definition", () => {
        const offenders: string[] = productionSources().filter(
            (rel) => !WAIVED.has(rel) && fs.readFileSync(path.join(REPO_ROOT, rel), "utf8").includes(LOADED_DIRNAME),
        );

        expect(offenders).toEqual([]);
    });

    it("waives nothing that has stopped naming it, so the waiver set cannot rot into a blanket", () => {
        const stale: string[] = [...WAIVED.keys()].filter(
            (rel) => !fs.readFileSync(path.join(REPO_ROOT, rel), "utf8").includes(LOADED_DIRNAME),
        );

        expect(stale).toEqual([]);
    });

    it("does not offer the former helper name, so nothing can reach the vacated path through it", () => {
        const survivors: string[] = productionSources().filter((rel) =>
            fs.readFileSync(path.join(REPO_ROOT, rel), "utf8").includes("liveClaudeDir"),
        );

        expect(survivors).toEqual([]);
    });
});
