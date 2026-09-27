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
