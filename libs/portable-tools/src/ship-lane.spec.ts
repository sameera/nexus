/**
 * The solo lane's command text (epic #799). The lane's mechanism is a command definition, so what
 * a spec can hold it to is the rules its body states and the texts it does or does not load.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components.js";

const ROOT: string = authoredComponentRoot(__dirname);

function command(name: string): string {
    return fs.readFileSync(path.join(ROOT, "commands", name), "utf8");
}

const SHIP: string = command("nxs.ship.md");

describe("/nxs.ship checks the workspace shape, then the solo declaration (story #800)", () => {
    it("runs solo-check before any other toolkit call or file read", () => {
        const first: number = SHIP.indexOf("nexus solo-check");
        expect(first).toBeGreaterThan(-1);
        const others: RegExpMatchArray[] = [...SHIP.matchAll(/```bash\n([^`]*)```/g)];
        expect(others[0]?.[1]).toContain("nexus solo-check");
    });

    it("the --pr stages never read the solo declaration", () => {
        for (const name of ["nxs.analyze.md", "nxs.close.md"]) {
            expect(command(name)).not.toContain("solo-check");
            expect(command(name)).not.toMatch(/delivery\.solo/);
        }
    });
});

describe("/nxs.close refuses without --pr, up front (story #801)", () => {
    const CLOSE: string = command("nxs.close.md");

    it("refuses before resolving the epic, and names both working paths", () => {
        const refusal: number = CLOSE.indexOf("runs only against a pull request");
        expect(refusal).toBeGreaterThan(-1);
        expect(refusal).toBeLessThan(CLOSE.indexOf("nexus epic-resolve"));
        expect(refusal).toBeLessThan(CLOSE.indexOf("# Phase 0"));
        const block: string = CLOSE.slice(refusal, refusal + 600);
        expect(block).toContain("/nxs.close --pr <N>");
        expect(block).toContain("/nxs.ship");
    });

    it("describes no resolution path or receipt source that runs without --pr", () => {
        expect(CLOSE).not.toMatch(/No path, no `--pr`/);
        expect(CLOSE).not.toMatch(/\*\*Local mode\*\* — read/);
        expect(CLOSE).not.toMatch(/issue-sourced local close: resolve epic/);
    });

    it("keeps the re-stamp recovery procedure", () => {
        expect(CLOSE).toContain("# Recovery — re-stamp a closed entry whose record was revised after close");
    });
});

describe("/nxs.analyze without --pr is an advisory report (story #802)", () => {
    const ANALYZE: string = command("nxs.analyze.md");

    it("writes nothing a close stage reads, on every path", () => {
        expect(ANALYZE).toMatch(/writes no\s+receipt and no file of any kind, on every path/);
        expect(ANALYZE).not.toMatch(/Write it to \*\*`analyze-receipt\.md`\*\*/);
        expect(ANALYZE).toContain("nexus epic-verdicts coverage --epic <epic-issue>");
        expect(ANALYZE).not.toContain("nexus epic-verdicts derive --epic <epic-issue>\n```");
    });

    it("names the two paths to a close and does not say the local run feeds one", () => {
        expect(ANALYZE).toMatch(/Advisory only[\s\S]{0,200}\/nxs\.analyze --pr <N>[\s\S]{0,200}\/nxs\.ship <epic>/);
        expect(ANALYZE).not.toMatch(/same-sitting `\/nxs\.close`/);
        expect(ANALYZE).not.toMatch(/\/nxs\.close gates on it/);
    });
});

/** The text between a skill's copied-from markers. */
function copied(skill: string): string {
    const body: string = fs.readFileSync(path.join(ROOT, "skills", skill, "SKILL.md"), "utf8");
    const start: number = body.indexOf("-->\n\n", body.indexOf("<!-- copied-from:")) + 5;
    return body.slice(start, body.indexOf("<!-- end-copied-from -->"));
}

function sectionOf(text: string, from: string, to: string): string {
    return text.slice(text.indexOf(from), text.indexOf(to)).trimEnd() + "\n";
}

describe("/nxs.ship checks conformance over one stated range (story #803)", () => {
    it("the conformance rule skill matches analyze's Phase 2 word for word", () => {
        const analyze: string = sectionOf(command("nxs.analyze.md"), "# Phase 2 — Conformance checks", "# Phase 3 — Report (inline)");
        expect(copied("nxs-conformance-rules")).toBe(analyze);
    });

    it("checks every precondition before it fixes the range, and fixes it before the check", () => {
        const pre: number = SHIP.indexOf("# Step 2 — Preconditions");
        const rng: number = SHIP.indexOf("nexus ship-range");
        const check: number = SHIP.indexOf("nxs-conformance-rules");
        expect(pre).toBeGreaterThan(SHIP.indexOf("nexus solo-check"));
        expect(rng).toBeGreaterThan(pre);
        expect(check).toBeGreaterThan(rng);
        for (const cause of ["uncommitted changes", "already closed", "close-record.md", "not approved", "neither a"]) {
            expect(SHIP.slice(pre, rng)).toContain(cause);
        }
    });

    it("leaves no file for a later stage", () => {
        expect(SHIP).toMatch(/Write no receipt and no report file/);
        expect(SHIP).not.toMatch(/nexus epic-verdicts (derive|record)/);
    });
});

/** Every span between a skill's copied-from markers, in order. */
function spans(skill: string): string[] {
    const body: string = fs.readFileSync(path.join(ROOT, "skills", skill, "SKILL.md"), "utf8");
    return [...body.matchAll(/<!-- copied-from: [^>]+ -->\n\n([\s\S]*?)<!-- end-copied-from -->/g)].map((m) => m[1]);
}

/** The skills a command body loads, by the "Load the **`name`** skill" form. */
function loadedSkills(body: string): string[] {
    return [...body.matchAll(/Load the \*\*`([a-z0-9.-]+)`\*\* skill/g)].map((m) => m[1]);
}

function bytes(text: string): number {
    return Buffer.byteLength(text, "utf8");
}

function skillBody(name: string): string {
    return fs.readFileSync(path.join(ROOT, "skills", name, "SKILL.md"), "utf8");
}

describe("/nxs.ship drafts the close and the concept changes from the same range (story #804)", () => {
    it("the concept write rule skill matches distill's passages word for word", () => {
        const distill: string = command("nxs.distill.md");
        expect(spans("nxs-concept-write-rules")).toEqual([
            sectionOf(distill, "3. **Applying a delta** (0003 §2, §8.2 semantics):", "# Phase 5 — Deterministic steps"),
            sectionOf(distill, "# Phase 5 — Deterministic steps", "6. **Remove the consumed entry, then commit it together"),
        ]);
    });

    it("writes concepts in the current checkout, validator-gated, with no branch and no pull request", () => {
        const draft: string = SHIP.slice(SHIP.indexOf("# Step 5"));
        expect(draft).toMatch(/into the current\s+checkout/);
        expect(draft).toMatch(/no branch, no pull request/);
        expect(draft).toMatch(/validator exit blocks/);
    });

    it("leaves no receipt, queue entry, record hash or shipped record", () => {
        expect(SHIP).toMatch(/no queue entry, no receipt, no\s+record hash and no shipped record/);
        expect(SHIP).not.toMatch(/record_hash|nexus record-digest|epic-verdicts record/);
    });

    it("loads none of the analyze, close or distill command texts", () => {
        const loaded: string[] = loadedSkills(SHIP);
        expect(loaded).toEqual(expect.arrayContaining(["nxs-conformance-rules", "nxs-concept-write-rules"]));
        for (const name of loaded) expect(name).not.toMatch(/^nxs\.(analyze|close|distill)$/);
        expect(SHIP).not.toMatch(/commands\/nxs\.(analyze|close|distill)\.md/);
    });

    it("loads under one third of what the three stages it replaces load", () => {
        const skills: string[] = fs.readdirSync(path.join(ROOT, "skills"));
        const descriptions: number = skills
            .map((s) => skillBody(s).split("\n").find((l) => l.startsWith("description: ")) ?? "")
            .reduce((n, l) => n + bytes(`${l}\n`), 0);
        const ship: number = bytes(SHIP) + loadedSkills(SHIP).reduce((n, s) => n + bytes(skillBody(s)), 0) + descriptions;
        const replaced: number =
            ["nxs.analyze.md", "nxs.close.md", "nxs.distill.md"].reduce((n, c) => n + bytes(command(c)), 0) + 3 * descriptions;
        expect(ship, `/nxs.ship loads ${ship} authored bytes; the three stages it replaces load ${replaced}; the budget is ${Math.floor(replaced / 3)}`).toBeLessThan(replaced / 3);
    });
});
