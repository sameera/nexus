/**
 * Story #868, decision record #872 D14 — the process lesson is removed at every writer.
 *
 * Nothing reads the lesson, so no close path writes one and setup no longer scaffolds its folder.
 * A discovery closed with no build still writes its note, and that note is now the only thing that
 * creates the folder, so discover must create it when it is absent.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components.js";

const ROOT: string = authoredComponentRoot(__dirname);
const read = (...parts: string[]): string => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

const CLOSE: string = read("commands", "nxs.close.md");
const SETUP: string = read("commands", "nxs.setup.md");
const SETUP_SKILL: string = read("skills", "nxs-setup", "SKILL.md");
const DISCOVER: string = read("commands", "nxs.discover.md");
const DISTILL: string = read("commands", "nxs.distill.md");

/** The text from a heading line to the next heading of the same or a higher level. */
function section(body: string, heading: string): string {
    const lines: string[] = body.split("\n");
    const start: number = lines.findIndex((line) => line.startsWith(heading));
    expect(start, heading).toBeGreaterThan(-1);
    const level: number = heading.indexOf(" ");
    const rest: string[] = lines.slice(start + 1);
    const end: number = rest.findIndex((line) => /^#+ /.test(line) && line.indexOf(" ") <= level);
    return (end < 0 ? rest : rest.slice(0, end)).join("\n");
}

describe("/nxs.close writes no process lesson (story #868, G34)", () => {
    it("names no lesson anywhere: no lesson phase, no Process Lesson section, no lesson pointer in the close comment", () => {
        expect(CLOSE).not.toMatch(/lesson/i);
        expect(CLOSE).not.toMatch(/delivery\/lessons/);
    });
});

describe("/nxs.setup creates no lessons folder (story #868, G35)", () => {
    it("neither scaffolds the folder or its README nor lists them in its summary", () => {
        expect(SETUP).not.toMatch(/lessons/i);
        const summary: string = SETUP.slice(SETUP.indexOf("## Phase 7"), SETUP.indexOf("## Quality requirements"));
        expect(summary).toContain("### Created");
        expect(summary).not.toMatch(/delivery/);
    });

    it("leaves the interview skill free of the lessons folder too", () => {
        expect(SETUP_SKILL).not.toMatch(/lessons/i);
    });
});

describe("/nxs.discover still writes its no-build note (story #868, G36)", () => {
    it("writes the note to the same dated path under the lessons folder as before", () => {
        expect(section(DISCOVER, "## Phase C1")).toContain("<docs-root>/delivery/lessons/<YYYY-MM-DD>-<slug>.md");
    });

    it("creates the folder when it is absent", () => {
        expect(section(DISCOVER, "## Phase C1")).toMatch(/create (it|the folder) when it is absent/i);
    });

    it("no longer claims a pipeline stage already writes notes into that folder", () => {
        expect(DISCOVER).not.toMatch(/already holds/);
        expect(DISCOVER).not.toMatch(/written by a pipeline stage/);
    });
});

describe("/nxs.distill's mode detection no longer expects a lesson from close (story #868, D14)", () => {
    it("lists what a close prepares on the distill branch without a lesson", () => {
        const at: number = DISTILL.indexOf("**continuation**");
        expect(at).toBeGreaterThan(-1);
        expect(DISTILL.slice(at, DISTILL.indexOf("**ordinary**", at))).not.toMatch(/lesson/i);
    });
});
