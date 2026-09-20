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

const INPUT_RESOLUTION: string = [...SECTIONS].find(([h]) => h.startsWith("# Input Resolution"))?.[1] ?? "";

describe("one entry-kind contract for epic, fix and intake (story #716)", () => {
    it("resolves the entry kind once, at discovery, and records it for every later phase to read", () => {
        expect(INPUT_RESOLUTION).toMatch(/Resolve the kind once/);
        expect(INPUT_RESOLUTION).toMatch(/entry-kind/);
        expect(INPUT_RESOLUTION).toMatch(/never re-derive/i);
    });

    it("answers every axis the kinds differ on from one table covering all three", () => {
        const table = INPUT_RESOLUTION.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("|"));
        expect(table.length).toBeGreaterThan(0);
        const header = table[0];
        for (const axis of [/\*why\* verified against/i, /delta vocabulary/i, /validation mode/i, /committed removal target/i]) {
            expect(header).toMatch(axis);
        }
        for (const kind of ["epic", "fix", "intake"]) {
            expect(table.some((row) => row.startsWith(`| \`${kind}\``))).toBe(true);
        }
    });

    it("states what holds for all three kinds once, with no per-kind copy", () => {
        expect(INPUT_RESOLUTION).toMatch(/true of all three kinds/);
        expect(DISTILL).not.toContain("drainable on exactly the same terms");
    });

    it("states the cross-kind non-interference rule once, for all three kinds at once", () => {
        const stating = [...SECTIONS]
            .filter(([, text]) => /no kind drained in the same run alters another kind's drain/.test(text))
            .map(([heading]) => heading);
        expect(stating).toEqual([expect.stringMatching(/^# Input Resolution/)]);
        expect(DISTILL).not.toMatch(/Draining an epic entry is unchanged by this/);
        expect(DISTILL).not.toMatch(/Draining an epic entry or a fix entry is/);
    });

    it("restates no kind's own behaviour in a later phase or in the closing recap", () => {
        expect(DISTILL).not.toContain("A fix entry has no committed removal target at all");
        expect(DISTILL).not.toMatch(/An intake entry \(#483\) gets the full epic vocabulary/);
        expect(DISTILL).not.toMatch(/An intake entry is validated the same unbounded way/);
        expect(DISTILL).not.toMatch(/empty by construction, not by a special case/);
        expect(DISTILL).not.toMatch(/Apply the mode only to a fix entry's pages/);
        expect(DISTILL).not.toMatch(/\n- \*\*Fix entries \(#263\)/);
        expect(DISTILL).not.toMatch(/\n- \*\*Intake entries \(#483, record #504\)/);
        expect(DISTILL).not.toMatch(/\n- \*\*Ephemeral entries \(#173\)/);
    });

    it("keeps each kind's own action steps where the stage acts on them", () => {
        expect(DISTILL).toContain("nexus validate-concepts --append-only-log --base HEAD");
        expect(DISTILL).toContain("no-existing-page");
        expect(DISTILL).toContain("entry-kind-mismatch");
    });
});
