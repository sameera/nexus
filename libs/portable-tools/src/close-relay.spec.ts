/**
 * Story #869, decision record #872 D15 — /nxs.close becomes a relay to `nexus close`.
 *
 * Without --pr it refuses with the same text as before, before any other step (G38). With --pr it
 * runs `nexus close` with the same arguments, relays the output unchanged, and ends by naming the
 * direct command (G37). It never interprets, retries or fixes a stop. It keeps the one section
 * distill's hash-mismatch remedy points at, and that section names the recovery mode (G39).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components.js";

const ROOT: string = authoredComponentRoot(__dirname);
const read = (...parts: string[]): string => fs.readFileSync(path.join(ROOT, ...parts), "utf8");

const CLOSE: string = read("commands", "nxs.close.md");
const DISTILL: string = read("commands", "nxs.distill.md");

const RECOVERY_TITLE = "Recovery — re-stamp a closed entry whose record was revised after close";
const REFUSAL = "/nxs.close needs the epic to close. Close it with\nnexus close --epic <N>.";

const FRONTMATTER: string = CLOSE.slice(0, CLOSE.indexOf("\n---", 3));
const BODY: string = CLOSE.slice(FRONTMATTER.length);

/** Every fenced bash block in the body. */
function bashBlocks(body: string): string[] {
    return [...body.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]);
}

describe("/nxs.close relays to nexus close (story #869, G37)", () => {
    it("runs nexus close with exactly the arguments it was given, and runs no other command", () => {
        const blocks: string[] = bashBlocks(BODY);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].trim()).toBe("nexus close $ARGUMENTS");
    });

    it("relays the output unchanged and does not interpret, retry or fix a stop", () => {
        expect(BODY).toMatch(/unchanged/);
        expect(BODY).toMatch(/do not interpret/i);
        expect(BODY).toMatch(/retry/i);
        expect(BODY).not.toMatch(/AskUserQuestion/);
    });

    it("offers no way to close without the analysis or past a blocking finding", () => {
        expect(BODY).not.toContain("Close without analysis");
        expect(BODY).not.toContain("closed without /nxs.analyze");
        expect(BODY).not.toContain("Override and close");
    });

    it("ends by telling the lead to call nexus close directly next time", () => {
        const runAt: number = BODY.indexOf("nexus close $ARGUMENTS");
        const lastLine: number = BODY.indexOf("Next time, run `nexus close");
        expect(lastLine).toBeGreaterThan(runAt);
    });

    it("describes the relay in its frontmatter, with no checkpoint and no interactive tool", () => {
        expect(FRONTMATTER).toMatch(/^description: .*`nexus close`/m);
        expect(FRONTMATTER).not.toMatch(/checkpoint/i);
        expect(FRONTMATTER).not.toMatch(/AskUserQuestion/);
        expect(FRONTMATTER).toMatch(/^tools: Bash$/m);
    });
});

describe("/nxs.close with no epic and no pull request refuses before any other step (story #869, G38; #906)", () => {
    it("refuses naming nexus close --epic <N>", () => {
        expect(BODY).toContain(REFUSAL);
    });

    it("refuses before it runs anything", () => {
        expect(BODY.indexOf(REFUSAL)).toBeGreaterThan(-1);
        expect(BODY.indexOf(REFUSAL)).toBeLessThan(BODY.indexOf("```bash"));
    });
});

describe("/nxs.close relays every form that names the epic (#906)", () => {
    it("relays --epic, a bare epic number and --pr with a repository-qualified reference unchanged", () => {
        const usage: string = BODY.slice(BODY.indexOf("# Usage"));
        expect(usage).toMatch(/\/nxs\.close --epic 159 +# runs: nexus close --epic 159/);
        expect(usage).toMatch(/\/nxs\.close 159 +# runs: nexus close 159/);
        expect(usage).toMatch(/\/nxs\.close --pr 'owner\/repo#704' +# runs: nexus close --pr 'owner\/repo#704'/);
    });

    it("refuses only when the arguments name neither an epic nor a pull request", () => {
        const step1: string = BODY.slice(BODY.indexOf("# Step 1"), BODY.indexOf("# Step 2"));
        expect(step1).toContain("--epic <N>");
        expect(step1).toContain("--pr <ref>");
        expect(step1).toMatch(/bare/);
    });
});

describe("distill's hash-mismatch remedy still lands on a section that names the recovery mode (story #869, G39)", () => {
    it("distill still points at the recovery section by its title", () => {
        expect(DISTILL).toContain(`/nxs.close\` § "${RECOVERY_TITLE}"`);
    });

    it("keeps that section under the same title, and the section names nexus close --recover <epic>", () => {
        const at: number = BODY.indexOf(`\n# ${RECOVERY_TITLE}\n`);
        expect(at).toBeGreaterThan(-1);
        const rest: string = BODY.slice(at + 3);
        const next: number = rest.search(/\n# /);
        const section: string = next < 0 ? rest : rest.slice(0, next);
        expect(section).toContain("nexus close --recover <epic>");
    });
});
