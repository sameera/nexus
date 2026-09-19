/**
 * The published shared-library surface (epic #677, goal #690). What these pin is that a consumer
 * outside this repository can resolve every specifier the staged sources contain, using nothing but
 * the staged tree — because that consumer has no `libs/`, no workspace links and no pnpm.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { SHARED_LIBRARIES, SHARED_LIBRARY_DIRNAME, listSharedLibraryFiles } from "./shared-library-payload";

const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");
const STAGED = new Set(listSharedLibraryFiles(REPO_ROOT).map((f) => f.staged));

describe("the shared library sources the release publishes", () => {
    it("stages every library's source and no test of it", () => {
        expect(STAGED.size).toBeGreaterThan(0);
        for (const staged of STAGED) {
            expect(staged.endsWith(".spec.ts")).toBe(false);
            expect(staged.endsWith("-fixtures.ts")).toBe(false);
            expect(SHARED_LIBRARIES).toContain(staged.split("/")[1]);
        }
    });

    it("maps every declared subpath to a staged file by name alone, with no table to keep", () => {
        const unresolvable: string[] = [];
        for (const lib of SHARED_LIBRARIES) {
            const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "libs", lib, "package.json"), "utf8")) as {
                exports?: Record<string, unknown>;
            };
            for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
                if (typeof target !== "object" || target === null) {
                    continue;
                }
                const name: string = subpath.replace(/^\.\//, "");
                if (!STAGED.has(`${SHARED_LIBRARY_DIRNAME}/${lib}/${name}.ts`)) {
                    unresolvable.push(`@nexus/${lib}/${name}`);
                }
            }
        }

        expect(unresolvable).toEqual([]);
    });

    it("contains every workspace specifier its own sources import, so nothing dangles for a consumer", () => {
        const dangling: string[] = [];
        for (const { staged, source } of listSharedLibraryFiles(REPO_ROOT)) {
            const content: string = fs.readFileSync(source, "utf8");
            for (const match of content.matchAll(/(?:from\s+|import\s*\(\s*|require\(\s*)["'](@nexus\/[^"']+)["']/g)) {
                const segments: string[] = match[1].split("/");
                const target = `${SHARED_LIBRARY_DIRNAME}/${segments[1]}/${segments.slice(2).join("/")}.ts`;
                if (!STAGED.has(target)) {
                    dangling.push(`${staged} -> ${match[1]}`);
                }
            }
        }

        expect(dangling).toEqual([]);
    });

    it("imports no workspace library the release does not publish", () => {
        const used = new Set<string>();
        for (const { source } of listSharedLibraryFiles(REPO_ROOT)) {
            for (const match of fs.readFileSync(source, "utf8").matchAll(/["'](@nexus\/[^"'/]+)/g)) {
                used.add(match[1].slice("@nexus/".length));
            }
        }

        expect([...used].filter((lib) => !SHARED_LIBRARIES.includes(lib)).sort()).toEqual([]);
    });

    it("is inside the manifest's published allowlist, reachable at the exported subpath", () => {
        const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as {
            files?: string[];
            exports?: Record<string, string>;
        };

        expect(manifest.files).toContain("dist");
        expect(manifest.exports?.[`./${SHARED_LIBRARY_DIRNAME}/*`]).toBe(`./dist/${SHARED_LIBRARY_DIRNAME}/*`);
    });

    it("stages nothing git does not track, so a stray working file cannot be published", () => {
        const tracked = new Set<string>(
            execFileSync("git", ["ls-files"], { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
                .split("\n")
                .filter((line) => line !== ""),
        );
        const untracked: string[] = listSharedLibraryFiles(REPO_ROOT)
            .map((f) => path.relative(REPO_ROOT, f.source).split(path.sep).join("/"))
            .filter((rel) => !tracked.has(rel));

        expect(untracked).toEqual([]);
    });
});
