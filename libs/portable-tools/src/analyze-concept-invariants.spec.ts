/**
 * Analyze checks the invariants on the concept pages the epic lists (epic #896, story #900, decision
 * record #902, D10–D12). The listing is the toolkit's (`nexus concept-invariants`); the judgment is
 * the stage's. These cases pin what the stage now says.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components";

const ANALYZE: string = fs.readFileSync(path.join(authoredComponentRoot(import.meta.dirname), "commands", "nxs.analyze.md"), "utf8");
const FLAT: string = ANALYZE.replace(/\s+/g, " ");

function section(heading: string): string {
    const start = ANALYZE.indexOf(heading);
    expect(start).toBeGreaterThan(-1);
    const end = ANALYZE.indexOf("\n## ", start + heading.length);
    return ANALYZE.slice(start, end < 0 ? undefined : end).replace(/\s+/g, " ");
}

const CONCEPTS = (): string => section("## 2.2b Concept invariants");

describe("the concept-invariant pass", () => {
    it("lists invariants with the toolkit at the change's base, not the head, in full and degraded mode (D10, G21)", () => {
        expect(CONCEPTS()).toMatch(/nexus concept-invariants/);
        expect(CONCEPTS()).toMatch(/from git at `\$BASE`/);
        expect(CONCEPTS()).toMatch(/full mode \*\*and\*\* in degraded mode/);
    });

    it("skips an invariant a stated change covers and judges the rest (G18)", () => {
        expect(CONCEPTS()).toMatch(/Skip every covered invariant/);
        expect(CONCEPTS()).toMatch(/Judge each \*\*uncovered\*\* invariant/);
    });

    it("lists a contradiction as a high departure naming the page and the invariant number (D11, G19)", () => {
        expect(CONCEPTS()).toMatch(/names the page and the invariant number/);
        expect(CONCEPTS()).toMatch(/`breaksGuarantee: false`: it is \*\*high\*\*, not critical/);
    });

    it("records each judgment under the existing guarantee result kind and adds no kind or field (D11, G23)", () => {
        expect(CONCEPTS()).toMatch(/existing `guarantee` kind/);
        expect(CONCEPTS()).toMatch(/Add no new kind and no new field/);
    });

    it("stops and publishes nothing when the store cannot be read, and names a missing page (D10, G22)", () => {
        expect(CONCEPTS()).toMatch(/Exit 1 stops the run.*?Report the diagnostic, publish nothing/);
        expect(CONCEPTS()).toMatch(/under `missing` is named/);
    });

    it("restates the severity rule: critical for the record's guarantees, high for a concept invariant (D11)", () => {
        expect(FLAT).toMatch(/\*\*critical\*\* when it breaks a guarantee or an invariant, \*\*high\*\* otherwise/);
        expect(FLAT).toMatch(/A departure from a concept page's invariant \(§2\.2b\) is \*\*high\*\*, not critical/);
    });

    it("reports how many invariants were checked, or that none were, in the human-readable part only (D12, G22)", () => {
        expect(FLAT).toMatch(/Concept invariants: +<§2\.2b's sentence/);
        expect(CONCEPTS()).toMatch(/none were checked because the epic lists no concept pages/);
        expect(CONCEPTS()).toMatch(/never in a machine block/);
    });
});
