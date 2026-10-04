/**
 * Story #817, D4 — /nxs.close accepts --handoff <path>, only meaningful alongside --pr, so
 * utils/close-epic.sh can tell a completed close from a failed one without parsing its output.
 *
 * Since story #869 /nxs.close relays to `nexus close`, which writes the note. The note's three-line
 * format, its writing only on full success (never on a failed push), and the final instruction with
 * and without a hand-off are pinned on the code in libs/epic-verdicts/src/close-command.spec.ts
 * ("writes the hand-off note in today's three-line format", "hands the next step to the close
 * script ...", "ends by naming the drain in the worktree ...", "stops on a failed push ...").
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components.js";

const CLOSE: string = fs.readFileSync(
    path.join(authoredComponentRoot(__dirname), "commands", "nxs.close.md"),
    "utf8",
);

describe("/nxs.close --handoff <path> (story #817)", () => {
    it("passes --handoff through to nexus close with the other arguments", () => {
        const step: string = CLOSE.slice(CLOSE.indexOf("# Step 2"), CLOSE.indexOf("# Step 3"));
        expect(step).toContain("`--handoff <path>`");
        expect(step).toContain("nexus close $ARGUMENTS");
    });
});
