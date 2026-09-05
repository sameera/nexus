/**
 * The surface sketch — discovery's answer to a resolution that decides what a person sees.
 *
 * A ruling about a screen or a message is read wrong when it is read as prose alone, so a discovery
 * ticket flagged as a surface ticket is decided against a drawing. Nothing about that arrangement is
 * visible in a type: the flag is a frontmatter key, the drawing is ASCII inside a markdown file, and
 * what carries the drawing out of the discovery is the clause it is written into. So the parts that
 * must agree are asserted here.
 *
 * Two of them are load-bearing beyond wording. The sketch is drawn *before* the ruling, because a
 * drawing made afterwards is illustration of a decision already taken. And it is written *inside the
 * Decided clause*, because that clause is what `/nxs.epic` copies onto a stub in full — a sketch
 * under a heading of its own would die with the folder.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");
const DISCOVER: string = fs.readFileSync(path.join(REPO_ROOT, "components", "commands", "nxs.discover.md"), "utf8");

/**
 * The command's text from one heading up to the next heading at the same level.
 *
 * Fenced blocks are skipped when looking for that next heading: this command's templates are
 * markdown quoted inside markdown, so a phase's own example carries `##` lines that are content
 * rather than the end of the phase.
 */
function section(heading: string): string {
    const lines: string[] = DISCOVER.split("\n");
    const start: number = lines.findIndex((line: string): boolean => line.trimStart().startsWith(heading));
    expect(start, `${heading} is missing from nxs.discover.md`).toBeGreaterThan(-1);
    const level: string = `${heading.slice(0, heading.indexOf(" "))} `;

    const body: string[] = [];
    let fence: string | undefined;
    for (const line of lines.slice(start + 1)) {
        const opener: RegExpMatchArray | null = line.trimStart().match(/^(`{3,})/);
        if (fence === undefined && opener !== null) {
            fence = opener[1];
        } else if (fence !== undefined && opener !== null && opener[1].length >= fence.length) {
            fence = undefined;
        } else if (fence === undefined && line.startsWith(level)) {
            break;
        }
        body.push(line);
    }
    return body.join(" ").replace(/\s+/g, " ");
}

const WHOLE: string = DISCOVER.replace(/\s+/g, " ");

describe("a surface ticket", () => {
    it("is flagged on the ticket rather than inferred from the resolution's prose", () => {
        expect(section("## Phase 5")).toMatch(/surface:/);
        expect(WHOLE).toMatch(/it is not a fifth type/);
    });

    it("carries the flag in the ticket's frontmatter, which is the whole control surface", () => {
        expect(section("## A decision ticket")).toMatch(/surface:/);
    });

    it("is drawn at start by nothing, because start resolves no ticket", () => {
        expect(section("## Phase 5")).toMatch(/No sketch is drawn here/);
    });
});

describe("the sketch pass", () => {
    const resolve: string = section("## Phase R2");

    it("draws variants before the ruling, not a picture of a ruling already made", () => {
        expect(resolve).toMatch(/before the ruling/);
        expect(resolve).toMatch(/two or three ASCII wireframes/i);
    });

    it("puts each variant where the lead can actually see it — an option preview", () => {
        expect(resolve).toMatch(/AskUserQuestion/);
        expect(resolve).toMatch(/preview/);
    });

    it("bounds the drawing so it renders in a terminal, a preview and an issue body alike", () => {
        expect(resolve).toMatch(/72 columns/);
    });

    it("refuses a file of its own, in any format", () => {
        expect(resolve).toMatch(/Never write the sketch to a file of its own/);
        expect(WHOLE).not.toMatch(/\bsvg\b|excalidraw/i);
    });
});

describe("the recorded sketch", () => {
    const record: string = section("## Phase R3");

    it("sits inside the Decided clause, which is the text graduation copies in full", () => {
        expect(record).toMatch(/inside the `Decided:` clause/);
        expect(record).toMatch(/copies that clause onto every stub/);
    });

    it("is exactly one drawing — the chosen variant, never the rejected one as well", () => {
        expect(record).toMatch(/Exactly one sketch is recorded/);
    });

    it("leaves an unflagged ticket with no block and no empty heading", () => {
        expect(record).toMatch(/no empty heading/);
    });
});

describe("a discovery that ends with no build", () => {
    it("copies the sketch into the lessons note, the only artifact that outlives the folder", () => {
        expect(section("## Phase C1")).toMatch(/wireframe/);
    });
});

describe("the razor", () => {
    it("exempts a wireframe from provenance labelling, as it exempts the resolution around it", () => {
        expect(WHOLE).toMatch(/Resolutions are never labelled/);
        expect(WHOLE).toMatch(/a wireframe carries no label/);
    });
});
