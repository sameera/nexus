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

/** Every surface that writes or reads the stamp, named so a new one cannot be added silently. */
const STAMPED_SURFACES: Record<string, string> = {
    "the analyze receipt and its PR-review machine block": ".claude/commands/nxs.analyze.md",
    "the close record and the close comment's machine block": ".claude/commands/nxs.close.md",
    "the seeded close-record template": "common/templates/close-record-template.md",
    "the close-side reader of the analyze receipt": "libs/pr-acceptance/src/verify.ts",
};

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
    for (const [surface, relPath] of Object.entries(STAMPED_SURFACES)) {
        it(`${surface} writes or reads '${WRITER_STAMP_FIELD}'`, () => {
            expect(fs.readFileSync(path.join(REPO_ROOT, relPath), "utf8")).toContain(WRITER_STAMP_FIELD);
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
