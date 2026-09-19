/**
 * The seam between the pipeline library and the teaching library (epic #677, goal #689).
 *
 * The teaching stage is leaving for a repository of its own, and what decides whether that move is a
 * directory relocation or a 63-path archaeology is the width of this seam. It was already narrow
 * before the split — one pipeline module imported one teaching module — and this check is what keeps
 * it that way while both libraries still live here. A second import added quietly would not fail
 * anything else: it would compile, it would pass every other spec, and it would only surface as a
 * broken build in the new repository months later.
 *
 * Two directions, and they are not symmetric. The pipeline may reach the teaching library, but only
 * through the declared seam. The teaching library may not reach the pipeline at all — it is the one
 * that has to stand up alone.
 *
 * This file leaves with the teaching library (#692); by then the seam is gone and there is nothing
 * left to keep narrow.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");

/**
 * The declared seam: which pipeline file may import the teaching library, and what it may import.
 * A production entry and the two specs that exercise the shared surface — nothing else.
 */
const DECLARED_SEAM: ReadonlyMap<string, readonly string[]> = new Map([
    ["libs/portable-tools/src/nexus-cli.ts", ["@nexus/teaching/workbook-cli"]],
    ["libs/portable-tools/src/pipeline-stores.spec.ts", ["@nexus/teaching/workbook-store"]],
    ["libs/portable-tools/src/workbook-store-agreement.spec.ts", ["@nexus/teaching/workbook-location"]],
]);

const IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\(\s*)["']([^"']+)["']/g;

/**
 * Every TypeScript source under `dir` the repository would carry — tracked files and new ones alike.
 * A seam widened by a file that has not been staged yet is still a widened seam, and the point of
 * this check is to catch it while it is being written rather than after it is committed.
 */
function trackedSources(dir: string): string[] {
    return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "--", `${dir}/**/*.ts`], {
        cwd: REPO_ROOT,
        encoding: "utf8",
    })
        .split("\n")
        .filter((line) => line !== "");
}

function specifiers(rel: string): string[] {
    const content: string = fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
    return [...content.matchAll(IMPORT_RE)].map((match) => match[1]);
}

describe("the pipeline library's reach into the teaching library", () => {
    it("is exactly the declared seam — no other file imports it, and no file imports more", () => {
        const actual = new Map<string, string[]>();
        for (const rel of trackedSources("libs/portable-tools")) {
            const teaching: string[] = specifiers(rel).filter((s) => s === "@nexus/teaching" || s.startsWith("@nexus/teaching/"));
            if (teaching.length > 0) {
                actual.set(rel, [...new Set(teaching)].sort());
            }
        }

        expect(Object.fromEntries(actual)).toEqual(
            Object.fromEntries([...DECLARED_SEAM].map(([file, imports]) => [file, [...imports]])),
        );
    });

    it("never reaches a teaching module by a path, which would survive the move as a dangling import", () => {
        const offenders: string[] = trackedSources("libs/portable-tools").filter((rel) =>
            specifiers(rel).some((s) => s.includes("teaching/src") || s.includes("../teaching")),
        );

        expect(offenders).toEqual([]);
    });
});

describe("the teaching library's reach back", () => {
    it("imports nothing from the pipeline library, so it can stand up on its own", () => {
        const offenders: { file: string; imports: string[] }[] = [];
        for (const rel of trackedSources("libs/teaching")) {
            const back: string[] = specifiers(rel).filter(
                (s) => s === "@nexus/portable-tools" || s.startsWith("@nexus/portable-tools/") || s.includes("portable-tools/src") || s.includes("../portable-tools"),
            );
            if (back.length > 0) {
                offenders.push({ file: rel, imports: back });
            }
        }

        expect(offenders).toEqual([]);
    });

    it("declares every workspace package it imports, so nothing resolves by hoisting alone", () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "libs", "teaching", "package.json"), "utf8")) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        };
        const declared = new Set<string>([...Object.keys(manifest.dependencies ?? {}), ...Object.keys(manifest.devDependencies ?? {})]);

        const used = new Set<string>();
        for (const rel of trackedSources("libs/teaching")) {
            for (const specifier of specifiers(rel)) {
                if (!specifier.startsWith("@nexus/")) {
                    continue;
                }
                used.add(specifier.split("/").slice(0, 2).join("/"));
            }
        }

        expect([...used].filter((pkg) => !declared.has(pkg)).sort()).toEqual([]);
    });
});
