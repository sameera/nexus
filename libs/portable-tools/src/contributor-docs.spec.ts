/**
 * The repository's own instructions describe the arrangement it actually has (story #322).
 *
 * The move that separated authoring from loading is invisible in the diff to anyone who does not
 * already know about it, and a repository's setup instructions are the first thing to go stale when
 * the arrangement they describe changes. An edit fixes today; these checks fix the class — the same
 * pattern the adopter-facing allowlist text and the docs-root cross-reference already use.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { AUTHORED_ROOT_DIRNAME } from "./vendor-components";

const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");

/** The loaded directory's name, spelled so this file does not trip the authoring-site check. */
const LOADED_DIRNAME = `.${"claude"}`;

const CONTRIBUTING_FILE = "CONTRIBUTING.md";
const RELEASE_PROCEDURE = "docs/delivery/release-procedure.md";

function read(rel: string): string {
    return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

describe("the contributor guide", () => {
    it("exists at the repository root, where a fresh contributor opens it", () => {
        expect(fs.existsSync(path.join(REPO_ROOT, CONTRIBUTING_FILE))).toBe(true);
    });

    it("names the authored tree's location and says the loaded directory is not it (AC1)", () => {
        const guide: string = read(CONTRIBUTING_FILE);

        expect(guide).toContain(`${AUTHORED_ROOT_DIRNAME}/`);
        expect(guide).toContain(LOADED_DIRNAME);
    });

    it("describes the maintainer's loop as pointing the install location at the checkout (AC2)", () => {
        const guide: string = read(CONTRIBUTING_FILE);

        expect(guide).toContain("--from-checkout");
    });

    it("is reachable from both entry points a contributor might open first", () => {
        expect(read("README.md")).toContain(CONTRIBUTING_FILE);
        expect(read("CLAUDE.md")).toContain(CONTRIBUTING_FILE);
    });
});

describe("no instruction places components at this repository's loaded path (AC3)", () => {
    /**
     * Every instruction-carrying markdown surface. `docs/delivery/lessons/` is excluded: a lesson
     * is a dated record of what happened, so it describes the arrangement that was true when it was
     * written and must not be rewritten to describe today's.
     */
    function instructionSurfaces(): string[] {
        const out: string[] = ["README.md", "CLAUDE.md", CONTRIBUTING_FILE];
        const lessons: string = path.join(REPO_ROOT, "docs", "delivery", "lessons");
        const walk = (dir: string): void => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const abs: string = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (abs !== lessons) {
                        walk(abs);
                    }
                } else if (entry.name.endsWith(".md")) {
                    out.push(path.relative(REPO_ROOT, abs).split(path.sep).join("/"));
                }
            }
        };
        walk(path.join(REPO_ROOT, "docs"));
        return out;
    }

    const surfaces: string[] = instructionSurfaces();

    /** The contents of every fenced code block — the part of a document a reader runs. */
    function fencedBlocks(text: string): string[] {
        return [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((match) => match[1]);
    }

    it("tells nobody to deploy components into it", () => {
        const offenders: string[] = surfaces.filter((rel) =>
            fencedBlocks(read(rel)).some((block) => block.includes("nexus deploy")),
        );

        expect(offenders).toEqual([]);
    });

    it("does not describe it as where this repository's components live", () => {
        const offenders: string[] = surfaces.filter((rel) =>
            read(rel).includes(`${LOADED_DIRNAME}/commands/`),
        );

        expect(offenders).toEqual([]);
    });
});

describe("the release procedure's component diff", () => {
    it("reads the authored tree, not the directory the harness loads (AC3, invariant 9)", () => {
        const procedure: string = read(RELEASE_PROCEDURE);

        expect(procedure).toContain(`git diff --name-only <previous tag>..HEAD -- ${AUTHORED_ROOT_DIRNAME}`);
        expect(procedure).not.toContain(`..HEAD -- ${LOADED_DIRNAME}`);
    });
});
