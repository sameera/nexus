/**
 * Planning and the advisory agents read features from the listing command (epic #1000, story
 * #1057, decision record #1061 D6, D7, D10). What the stage and the agents read is markdown a model
 * follows, so the guarantees are asserted against the authored components.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const AUTHORED: string = path.resolve(import.meta.dirname, "..", "..", "..", "components");

function read(rel: string): string {
    return fs.readFileSync(path.join(AUTHORED, rel), "utf8");
}

/** The text from one heading up to the next heading of the same or higher level. */
function section(body: string, heading: string): string {
    const start: number = body.indexOf(heading);
    if (start === -1) return "";
    const level: string = heading.match(/^#+/)?.[0] ?? "##";
    const rest: string = body.slice(start + heading.length);
    const next: RegExpExecArray | null = new RegExp(`\\n#{1,${level.length}} `).exec(rest);
    return next === null ? rest : rest.slice(0, next.index);
}

const READERS: [string, string][] = [
    ["/nxs.epic", "commands/nxs.epic.md"],
    ["nxs-pm", "agents/nxs-pm.md"],
    ["nxs-architect", "agents/nxs-architect.md"],
];

describe("the three readers ask the listing command", () => {
    for (const [name, rel] of READERS) {
        it(`${name} lists features through nexus feature-issue and falls back to the tree only on off`, () => {
            const body: string = read(rel);
            expect(body).toContain("nexus feature-issue features");
            expect(body).toMatch(/"off"`?,[^.]*?(tree|features\/README\.md)/);
        });
    }

    it("the agents list the epics of the features they judge similar", () => {
        for (const rel of ["agents/nxs-pm.md", "agents/nxs-architect.md"]) {
            expect(read(rel)).toContain("nexus feature-issue epics --feature");
        }
    });
});

describe("/nxs.epic resolves the feature from the listing (D6, D7, D10)", () => {
    const phase1: string = section(read("commands/nxs.epic.md"), "## Phase 1 — Resolve the feature container");

    it("matches the intent against every listed feature, open or closed, and names a retired one", () => {
        expect(phase1).toContain("nexus feature-issue features");
        expect(phase1).toMatch(/open or closed/);
        expect(phase1).toMatch(/retired/);
    });

    it("uses a confirmed existing feature's issue number as the feature issue", () => {
        expect(phase1).toMatch(/--named "<N>"[\s\S]*listed feature/);
    });

    it("no longer has an unmigrated outcome to act on", () => {
        expect(read("commands/nxs.epic.md")).not.toContain("**`unmigrated`**");
    });
});
