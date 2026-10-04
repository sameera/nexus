/**
 * /nxs.close honours a waiver a lead posted on the pull request, never asks for one, and states
 * each one it applied in both the close record and the close comment (epic #828, story #856,
 * decision record #849, D6, D11, G26, G33, G34). Which waiver clears which stop is a program; these
 * cases pin that the stage documents the form, acts on what it printed, and stamps it.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components";

const CLOSE: string = fs.readFileSync(path.join(authoredComponentRoot(import.meta.dirname), "commands", "nxs.close.md"), "utf8");

describe("/nxs.close's posted waivers (story #856)", () => {
    // Since story #869 /nxs.close relays to `nexus close`. The fixed waiver form it prints on a stop,
    // and the stamping of each applied waiver into the close record and the close comment's machine
    // block (G33), are pinned on the code in libs/epic-verdicts/src/close-command.spec.ts ("stops on
    // a revised record with no waiver and prints the exact comment to post", "stops on a landed-file
    // mismatch ...", "states each waiver it applied, with its author") and close-ranges.spec.ts.
    it("never asks for a revised-record or landed-change waiver (G34)", () => {
        expect(CLOSE).not.toContain('"Proceed against the revised record"');
        expect(CLOSE).not.toMatch(/AskUserQuestion/);
    });

    it("no longer offers the blocking-findings override: an answer on the pull request replaces it (record #871, G17)", () => {
        expect(CLOSE).not.toContain("Override and close");
    });
});
