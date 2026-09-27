/**
 * Story #816 — /nxs.distill finishes without a lead present when nobody can answer it, via an
 * explicit `--unattended` flag (decision record #818, D1/D2/D3), read as its own contract
 * (`nxs-distill-unattended`) the same way the recovery/continuation/hub/taxonomy contracts already
 * partition the exceptional paths of this stage (epic #714). These assertions pin the flag's gate
 * in the base stage, that every question point becomes a blocking condition instead of a guess or
 * a default, that a blocked run never pushes a half-drained branch, and that the pull request
 * description carries the same fields in every mode.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components.js";
import { CONTRACTS } from "./distill-load-ceiling.js";

const ROOT: string = authoredComponentRoot(__dirname);

const DISTILL: string = fs.readFileSync(path.join(ROOT, "commands", "nxs.distill.md"), "utf8");
const UNATTENDED: string = fs.readFileSync(
    path.join(ROOT, "skills", "nxs-distill-unattended", "SKILL.md"),
    "utf8",
);

describe("/nxs.distill gates the unattended contract from one place (D1)", () => {
    it("is registered as a selectable contract", () => {
        expect(CONTRACTS).toContain("nxs-distill-unattended");
    });

    it("resolves the flag in run-shape resolution and loads the contract there", () => {
        const resolved: number = DISTILL.indexOf("**Unattended flag**");
        expect(resolved).toBeGreaterThan(-1);
        const block: string = DISTILL.slice(resolved, resolved + 200);
        expect(block).toContain("--unattended");
        expect(block).toContain("nxs-distill-unattended");
    });

    it("names the contract in the selection table", () => {
        expect(DISTILL).toMatch(/`--unattended` was passed \| `nxs-distill-unattended` \|/);
    });

    it("states that consent is never inferred from a non-interactive session", () => {
        expect(UNATTENDED).toMatch(/never inferred from a non-interactive/);
    });

    it("describes itself by this stage and its selecting condition only", () => {
        expect(UNATTENDED).toMatch(/description: .*\/nxs\.distill.*--unattended/);
    });
});

describe("every question point is a blocking condition under --unattended, never answered (D2, G2)", () => {
    it("names all four question points in one table", () => {
        const table: number = UNATTENDED.indexOf("## The blocking-condition table");
        expect(table).toBeGreaterThan(-1);
        const block: string = UNATTENDED.slice(table, table + 2000);
        expect(block).toContain("Not-merged waiver");
        expect(block).toContain("Provenance-repository question");
        expect(block).toContain("Hub provenance question");
        expect(block).toContain("Taxonomy forced-fit gate");
    });

    it("resolves the taxonomy forced-fit gate before Phase 4's first commit, never at Phase 6.1", () => {
        expect(UNATTENDED).toContain("## Phase 3.1 — unattended taxonomy precheck");
        expect(UNATTENDED).toMatch(/never fires under\s+this flag/i);
    });

    it("keeps every unattended exception in this contract, keyed to the base stage's phase numbers", () => {
        for (const rule of ["Phase 0.4", "Phase 0.6", "Phase 3.1", "Phase 5 step 5", "Phase 6", "Phase 7", "Phase 8"]) {
            expect(UNATTENDED).toContain(rule);
        }
    });

    it("states no unattended-only rule anywhere in the base stage's own phases", () => {
        const phases: string = DISTILL.slice(DISTILL.indexOf("# Phase 0 — Preflight"), DISTILL.indexOf("# Usage"));
        expect(phases).not.toMatch(/unattended/i);
    });
});

describe("a blocked unattended run pushes nothing and leaves the branch as it found it (G7)", () => {
    it("records a start reference before the branch is touched", () => {
        expect(UNATTENDED).toContain("START_REF");
        expect(UNATTENDED).toContain("START_HEAD");
    });

    it("unwinds via reset when the branch pre-existed, and branch deletion otherwise", () => {
        expect(UNATTENDED).toContain("git branch -D");
        expect(UNATTENDED).toContain("git reset --hard");
    });

    it("reports the stopped shape naming what blocked it, never opening a PR", () => {
        expect(UNATTENDED).toContain("DISTILLATION STOPPED (unattended)");
        const stop: number = UNATTENDED.indexOf("DISTILLATION STOPPED (unattended)");
        expect(UNATTENDED.slice(stop, stop + 400)).toContain("No pull request was opened");
    });
});

describe("the checkpoint is skipped under --unattended, the flag being advance approval (D1, G1)", () => {
    it("says the AskUserQuestion stop is skipped while the run summary is still written", () => {
        const phase6: number = UNATTENDED.indexOf("## Phase 6 —");
        expect(phase6).toBeGreaterThan(-1);
        expect(UNATTENDED.slice(phase6, phase6 + 400)).toMatch(/checkpoint.*skipped/is);
    });
});

describe("the pull request description carries every field in every mode (D3, G8, G9)", () => {
    it("renders every run-summary field and adds the excluded-entries section", () => {
        const phase7: number = UNATTENDED.indexOf("## Phase 7 —");
        const phase8: number = UNATTENDED.indexOf("## Phase 8 —");
        const block: string = UNATTENDED.slice(phase7, phase8);
        expect(block).toMatch(/every field the Phase 6\.3 run-summary table defines/i);
        expect(block).toContain("## Excluded (`--unattended` only)");
    });

    it("states, only on an unattended run, that it opened without a checkpoint", () => {
        const phase7: number = UNATTENDED.indexOf("## Phase 7 —");
        const phase8: number = UNATTENDED.indexOf("## Phase 8 —");
        const block: string = UNATTENDED.slice(phase7, phase8);
        expect(block).toMatch(/opened without a checkpoint[\s\S]*this\s*\n?review is its only approval/);
    });
});
