/**
 * /nxs.close without --pr can never pass the shipped-record gate (since epic #769) — every such
 * run does work and then stops. Story #815 makes it refuse at argument parsing instead, before it
 * resolves the epic or writes anything, and names /nxs.close --pr <N> as the path that works.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components";

const CLOSE: string = fs.readFileSync(
    path.join(authoredComponentRoot(import.meta.dirname), "commands", "nxs.close.md"),
    "utf8",
);

describe("/nxs.close refuses without --pr, up front (story #815)", () => {
    it("refuses before resolving the epic, and names the working path", () => {
        const refusal: number = CLOSE.indexOf("runs only against a pull request");
        expect(refusal).toBeGreaterThan(-1);
        // Since story #869 the one step after the refusal is the relay to `nexus close`.
        expect(refusal).toBeLessThan(CLOSE.indexOf("nexus close $ARGUMENTS"));
        const block: string = CLOSE.slice(refusal, refusal + 400);
        expect(block).toContain("/nxs.close --pr <N>");
    });

    it("describes no resolution path or receipt source that runs without --pr", () => {
        expect(CLOSE).not.toMatch(/No path, no `--pr`/);
        expect(CLOSE).not.toMatch(/\*\*Local mode\*\* — read/);
        expect(CLOSE).not.toMatch(/issue-sourced local close: resolve epic/);
    });

    it("never names /nxs.ship, a stage that does not exist in this repository", () => {
        expect(CLOSE).not.toContain("/nxs.ship");
    });

    it("keeps the re-stamp recovery procedure", () => {
        expect(CLOSE).toContain("# Recovery — re-stamp a closed entry whose record was revised after close");
    });
});
