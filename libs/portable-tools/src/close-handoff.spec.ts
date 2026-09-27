/**
 * Story #817, D4 — /nxs.close accepts --handoff <path>, only meaningful alongside --pr, so
 * utils/close-epic.sh can tell a completed close from a failed one without parsing its output.
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
    it("documents the argument and strips it before epic resolution", () => {
        const at: number = CLOSE.indexOf("**`--handoff <path>`**");
        expect(at).toBeGreaterThan(-1);
        expect(at).toBeLessThan(CLOSE.indexOf("# Phase 0 — Validate the epic"));
    });

    it("writes the note only on full success, never on a failed push", () => {
        const write: number = CLOSE.indexOf("write the note now");
        expect(write).toBeGreaterThan(-1);
        const block: string = CLOSE.slice(write, write + 700);
        expect(block).toContain("epic:");
        expect(block).toContain("branch:");
        expect(block).toContain("worktree:");
        expect(block).toMatch(/push failure means the note is \*\*not\*\* written/);
    });

    it("replaces the cd/distill instruction with an end-session instruction when a note was written", () => {
        expect(CLOSE).toMatch(/end this session now; utils\/close-epic\.sh continues from here/);
    });

    it("leaves the ordinary --pr flow's final instruction unchanged when --handoff is absent", () => {
        expect(CLOSE).toContain("cd <wtPath> && /nxs.distill");
    });
});
