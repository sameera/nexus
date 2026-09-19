/**
 * The plain-register rule block (epic #634, story #635).
 *
 * The five drafting stages no longer load a prose-style skill. Each carries one short rule block
 * directly above the step that writes a human-facing artifact. The block is one text, copied into
 * five files, so this spec is what keeps the five copies from drifting apart: it fails when any copy
 * differs from the others, when a copy grows past its word cap, when a sixth component carries it,
 * or when any component still names the removed skill.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components.js";

const ROOT: string = authoredComponentRoot(import.meta.dirname);

/** The five stages that draft a human-facing artifact and carry the block. */
const DRAFTING_STAGES: readonly string[] = ["nxs.epic", "nxs.decision-record", "nxs.distill", "nxs.discover"];

/** The first and last sentences of the block, which are how a copy is located in a body. */
const BLOCK_OPENS: string = "Write one idea per sentence.";
const BLOCK_CLOSES: string = "stay as written.";

const REMOVED_SKILL: string = "nxs-prose-style";

function componentFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full: string = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else out.push(full);
        }
    };
    walk(ROOT);
    return out;
}

function readCommand(stem: string): string {
    return fs.readFileSync(path.join(ROOT, "commands", `${stem}.md`), "utf8");
}

/** The block as one string, from its first sentence to its last, or null when a body has none. */
function extractBlock(body: string): string | null {
    const start: number = body.indexOf(BLOCK_OPENS);
    if (start === -1) return null;
    const end: number = body.indexOf(BLOCK_CLOSES, start);
    if (end === -1) return null;
    return body.slice(start, end + BLOCK_CLOSES.length);
}

function words(text: string): number {
    return text.split(/\s+/).filter((w) => w.length > 0).length;
}

describe("the removed prose-style skill", () => {
    it("has no skill folder under the authored tree", () => {
        expect(fs.existsSync(path.join(ROOT, "skills", REMOVED_SKILL))).toBe(false);
    });

    it("is named by no command, agent or skill", () => {
        const offenders: string[] = componentFiles()
            .filter((file) => fs.readFileSync(file, "utf8").includes(REMOVED_SKILL))
            .map((file) => path.relative(ROOT, file));
        expect(offenders).toEqual([]);
    });
});

describe("the plain-register rule block", () => {
    const copies: Record<string, string | null> = Object.fromEntries(
        DRAFTING_STAGES.map((stem) => [stem, extractBlock(readCommand(stem))]),
    );

    it("appears once in each of the five drafting stages", () => {
        for (const stem of DRAFTING_STAGES) {
            const body: string = readCommand(stem);
            expect(copies[stem], stem).not.toBeNull();
            expect(body.split(BLOCK_OPENS).length - 1, stem).toBe(1);
        }
    });

    it("is one text: every copy is identical to the others", () => {
        const distinct: Set<string> = new Set(Object.values(copies).map((c) => c ?? ""));
        expect(distinct.size).toBe(1);
    });

    it("stays under the one-hundred-word cap", () => {
        for (const stem of DRAFTING_STAGES) expect(words(copies[stem] ?? ""), stem).toBeLessThanOrEqual(100);
    });

    it("names the text the rules never touch", () => {
        const block: string = copies["nxs.epic"] ?? "";
        for (const item of ["Frontmatter", "fenced code", "machine blocks", "hashes", "label names", "shell commands", "Given / When / Then"]) {
            expect(block).toContain(item);
        }
    });

    it("appears in those five stages and in no other component", () => {
        const carriers: string[] = componentFiles()
            .filter((file) => fs.readFileSync(file, "utf8").includes(BLOCK_OPENS))
            .map((file) => path.relative(ROOT, file))
            .sort();
        expect(carriers).toEqual(DRAFTING_STAGES.map((stem) => `commands/${stem}.md`).sort());
    });
});
