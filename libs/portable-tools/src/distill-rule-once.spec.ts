/**
 * Epic #713 — state each distillation rule once, at the point it acts.
 *
 * /nxs.distill's mechanism is a command definition, so what a spec can hold it to is the rules
 * its body states. These assertions pin the *single* statement of each rule the epic consolidates,
 * and pin the absence of the second copy. They do not re-test the tooling the body invokes; that
 * tooling has its own specs.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components.js";
import { DERIVE_PROBLEMS } from "./derive-entry-diff.js";

const SRC_DIR: string = __dirname;

const DISTILL: string = fs.readFileSync(
    path.join(authoredComponentRoot(SRC_DIR), "commands", "nxs.distill.md"),
    "utf8",
);

/** The document's top-level sections, keyed by their `# ` heading line. */
function sections(doc: string): ReadonlyMap<string, string> {
    const out = new Map<string, string>();
    let heading = "(frontmatter)";
    let buffer: string[] = [];
    for (const line of doc.split("\n")) {
        if (/^# /.test(line)) {
            out.set(heading, buffer.join("\n"));
            heading = line.trim();
            buffer = [];
            continue;
        }
        buffer.push(line);
    }
    out.set(heading, buffer.join("\n"));
    return out;
}

const SECTIONS: ReadonlyMap<string, string> = sections(DISTILL);
const DERIVE_SECTION: string = [...SECTIONS].find(([h]) => h.startsWith("# Phase 1"))?.[1] ?? "";

describe("one contract for an unreachable range SHA (story #715)", () => {
    it("states the unreachable-revision outcome only where the diff is derived", () => {
        const stating = [...SECTIONS]
            .filter(([, text]) => /unreachable/i.test(text))
            .map(([heading]) => heading);
        expect(stating).toEqual([expect.stringMatching(/^# Phase 1 /)]);
    });

    it("takes exactly one action on a derivation failure: it blocks that entry and drains the rest", () => {
        expect(DERIVE_SECTION).toMatch(/mark the entry\s*\n?\s*\*\*blocked\*\*/);
        expect(DERIVE_SECTION).toMatch(/There is no second diff source/);
    });

    it("carries no introducing-commit fallback for an entry whose recorded range is unreachable", () => {
        expect(DISTILL).not.toContain("--diff-filter=A");
        expect(DISTILL).not.toMatch(/introducing-commit (diff|path)/);
        expect(DISTILL).not.toMatch(/legacy fallback/i);
    });

    it("never asks the operator for a replacement range", () => {
        expect(DISTILL).toMatch(/never ask the user for a replacement range/);
        expect(DISTILL).not.toMatch(/ask the\s*\n?\s*user for a base\/head range/);
    });

    it("names every derivation failure class as a machine-readable token, so a caller never reads prose to tell them apart", () => {
        for (const token of DERIVE_PROBLEMS) {
            expect(DERIVE_SECTION).toContain(`\`${token}\``);
        }
    });

    it("names both operator remedies for an unreachable recorded revision", () => {
        expect(DERIVE_SECTION).toMatch(/update that checkout/);
        expect(DERIVE_SECTION).toMatch(/correct the recorded range stamp/);
    });
});
