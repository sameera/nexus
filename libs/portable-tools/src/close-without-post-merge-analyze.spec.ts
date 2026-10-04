/**
 * Closing an epic takes one run, not two (epic #828, story #843, decision record #849, D8–D9,
 * G16–G19). Analyze stops writing the shipped ledger and reports no coverage of its own; close
 * stops requiring a shipped record and starts no analyze run, while still reading the records an
 * epic in flight already carries. The stages are prose; these cases pin what they now say.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components";

const COMMANDS: string = path.join(authoredComponentRoot(import.meta.dirname), "commands");
const CLOSE: string = fs.readFileSync(path.join(COMMANDS, "nxs.close.md"), "utf8");
const ANALYZE: string = fs.readFileSync(path.join(COMMANDS, "nxs.analyze.md"), "utf8");

function description(stage: string): string {
    const line = /^description: (.*)$/m.exec(stage);
    expect(line).not.toBeNull();
    return (line as RegExpExecArray)[1];
}

describe("/nxs.analyze writes no shipped record (story #843, G16)", () => {
    it("never runs the ledger writer, before or after the merge", () => {
        expect(ANALYZE).not.toContain("nexus epic-verdicts record");
    });

    it("still publishes its receipt on the pull request", () => {
        expect(ANALYZE).toContain("<!-- nexus:analyze-receipt -->");
        expect(ANALYZE).toContain("gh pr review <N> -R <repoIdentity>");
    });

    it("no longer runs aggregate mode over the records an epic already carries (epic #829, story #859, D11)", () => {
        expect(ANALYZE).not.toContain("nexus epic-verdicts derive --epic <epic-issue>");
        expect(ANALYZE).not.toContain("nexus epic-verdicts combined --epic <epic-issue>");
    });
});

describe("/nxs.analyze reports no coverage of its own (story #843, G19)", () => {
    const section = (): string => {
        const start = ANALYZE.indexOf("## Asking an epic what it has shipped");
        expect(start).toBeGreaterThan(-1);
        return ANALYZE.slice(start, ANALYZE.indexOf("\n#", start + 10));
    };

    it("never runs the coverage report", () => {
        expect(ANALYZE).not.toContain("nexus epic-verdicts coverage");
    });

    it("names close as the place that reports each story's state", () => {
        const text = section();
        expect(text).toContain("/nxs.close --pr <N>");
        expect(text).toContain("nexus epic-verdicts ranges --epic <epic>");
        for (const state of ["current", "stale", "never-reviewed", "unshipped", "unknown", "excluded"]) {
            expect(text).toContain(`\`${state}\``);
        }
    });
});

describe("/nxs.close neither requires a shipped record nor starts an analyze run (story #843, G16–G18)", () => {
    // Since story #869 /nxs.close relays to `nexus close`. Reading a shipped record's stamped range,
    // and the moved-merge-commit hard block, are pinned on the code in
    // libs/epic-verdicts/src/close-ranges.spec.ts ("a stamped range where a shipped record exists").
    it("no longer runs the ledger gate, nor stops on a story with no record", () => {
        expect(CLOSE).not.toContain("nexus epic-verdicts close-gate");
        expect(CLOSE).not.toContain("story-unrecorded");
    });

    it("does not list a shipped record among its preconditions", () => {
        expect(description(CLOSE)).not.toMatch(/shipped record/);
    });

    it("never runs analyze from inside close: the one command it runs is nexus close", () => {
        const commands = [...CLOSE.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1].trim());
        expect(commands).toEqual(["nexus close $ARGUMENTS"]);
    });
});
