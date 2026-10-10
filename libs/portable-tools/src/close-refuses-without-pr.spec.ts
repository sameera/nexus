/**
 * /nxs.close without --pr could never pass the shipped-record gate (since epic #769) — every such
 * run did work and then stopped. Story #815 made it refuse at argument parsing instead, before it
 * resolves the epic or writes anything. Since #906 close takes the epic, so the refusal fires only
 * when the arguments name neither an epic nor a pull request, and names nexus close --epic <N>.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components";

const CLOSE: string = fs.readFileSync(
    path.join(authoredComponentRoot(import.meta.dirname), "commands", "nxs.close.md"),
    "utf8",
);

describe("/nxs.close refuses without an epic, up front (story #815, #906)", () => {
    it("refuses before resolving the epic, and names the working path", () => {
        const refusal: number = CLOSE.indexOf("needs the epic to close");
        expect(refusal).toBeGreaterThan(-1);
        // Since story #869 the one step after the refusal is the relay to `nexus close`.
        expect(refusal).toBeLessThan(CLOSE.indexOf("nexus close $ARGUMENTS"));
        const block: string = CLOSE.slice(refusal, refusal + 400);
        expect(block).toContain("nexus close --epic <N>");
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
