/**
 * The writer stamp (story #306). Most of the four stamped artifacts are written by prose commands
 * rather than by this program, so the drift these tests guard is between the declared field name
 * and every surface that writes or reads it.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { releaseVersion } from "./release";
import { readWriterStamp, UNKNOWN_WRITER, WRITER_STAMP_FIELD, writerStampLine } from "./writer-stamp";

const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");

/**
 * Every surface that writes or reads the stamp, named so a new one cannot be added silently.
 *
 * A prose command writes more than one stamped artifact, so a whole-file match is not enough: one
 * stamped block in a command file would vouch for every other artifact the same file writes. Each
 * surface therefore names the section that must carry the field — the text of the `#` heading the
 * artifact is written under, matched from that heading to the next one — and a file-wide surface
 * names no section.
 */
const STAMPED_SURFACES: readonly { readonly surface: string; readonly path: string; readonly section?: string }[] = [
    { surface: "the analyze receipt", path: ".claude/commands/nxs.analyze.md", section: "# Phase 3 — Report (inline) and write the receipt" },
    { surface: "the close record", path: ".claude/commands/nxs.close.md", section: "# Phase 4 — Write the close record" },
    { surface: "the close comment's machine block", path: ".claude/commands/nxs.close.md", section: "# Phase 8 — Post the comments and close the epic issue" },
    { surface: "the seeded close-record template", path: "common/templates/close-record-template.md" },
    { surface: "the close-side reader of the analyze receipt", path: "libs/pr-acceptance/src/verify.ts" },
];

/** The named section of a markdown file: its `#` heading through to the next one. */
function section(text: string, heading: string): string {
    const start: number = text.indexOf(`\n${heading}`);
    expect(start, `section '${heading}' is missing`).toBeGreaterThanOrEqual(0);
    const rest: string = text.slice(start + 1 + heading.length);
    const end: number = rest.search(/\n# /);
    return end < 0 ? rest : rest.slice(0, end);
}

describe("the stamp a writer emits", () => {
    it("names the release that wrote the artifact", () => {
        expect(writerStampLine("1.2.3")).toBe(`${WRITER_STAMP_FIELD}: 1.2.3`);
    });

    it("emits nothing rather than a fabricated version when the release is unresolved", () => {
        expect(writerStampLine(null)).toBeNull();
    });

    it("stamps the release this toolkit is part of", () => {
        expect(writerStampLine(releaseVersion())).toBe(`${WRITER_STAMP_FIELD}: ${releaseVersion()}`);
    });
});

describe("reading the stamp back (AC2 — an unstamped artifact is an unknown writer, not a failure)", () => {
    it("reports the writer of a stamped artifact", () => {
        expect(readWriterStamp(new Map([[WRITER_STAMP_FIELD, "0.4.1"]]))).toBe("0.4.1");
    });

    it("reports an artifact written before the stamp existed as an unknown writer", () => {
        expect(readWriterStamp(new Map([["head", "abc"]]))).toBe(UNKNOWN_WRITER);
    });

    it("treats an empty stamp as unknown rather than as a version named ''", () => {
        expect(readWriterStamp(new Map([[WRITER_STAMP_FIELD, "   "]]))).toBe(UNKNOWN_WRITER);
    });
});

describe("every stamped surface uses the declared field name (AC1)", () => {
    for (const stamped of STAMPED_SURFACES) {
        it(`${stamped.surface} writes or reads '${WRITER_STAMP_FIELD}'`, () => {
            const text: string = fs.readFileSync(path.join(REPO_ROOT, stamped.path), "utf8");
            expect(stamped.section === undefined ? text : section(text, stamped.section)).toContain(WRITER_STAMP_FIELD);
        });
    }
});

describe("the stamp introduces no ladder (AC4)", () => {
    it("reads a stamp from another release exactly as it reads its own", () => {
        const own: string | null = releaseVersion();
        const other = new Map([[WRITER_STAMP_FIELD, "99.0.0"]]);
        expect(readWriterStamp(other)).toBe("99.0.0");
        expect(readWriterStamp(other)).not.toBe(own);
        // Reading is the whole of it: nothing here compares the two, so nothing can refuse on the
        // difference. The close-side reader is pinned the same way in pr-acceptance's verify spec.
        expect(readWriterStamp(new Map([[WRITER_STAMP_FIELD, own ?? ""]]))).toBe(own);
    });
});
