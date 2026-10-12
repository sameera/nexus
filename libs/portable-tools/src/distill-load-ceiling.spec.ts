/**
 * Epic #714, story #731 — the ordinary drain's loaded size is measured and held under a ceiling,
 * and each exceptional rule is held in the contract that owns it.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components.js";
import {
    CEILING_FILE,
    CONTRACTS,
    checkCeiling,
    checkResidency,
    descriptionLine,
    ordinaryLoadedBytes,
    RESIDENCY,
    SHARED_SKILLS,
    type CeilingRecord,
} from "./distill-load-ceiling";

const COMPONENTS: string = authoredComponentRoot(__dirname);
const CEILING: CeilingRecord = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", CEILING_FILE), "utf8"),
);

describe("the ordinary drain's loaded size is held under a recorded ceiling", () => {
    it("measures the base stage, every shared skill's body, and every contract's preloaded description, and no contract body", () => {
        const base: number = Buffer.byteLength(
            fs.readFileSync(path.join(COMPONENTS, "commands", "nxs.distill.md"), "utf8"),
            "utf8",
        );
        const shared: number = SHARED_SKILLS.reduce(
            (sum, name) =>
                sum + Buffer.byteLength(fs.readFileSync(path.join(COMPONENTS, "skills", name, "SKILL.md"), "utf8"), "utf8"),
            0,
        );
        const descriptions: number = CONTRACTS.reduce(
            (sum, name) =>
                sum +
                Buffer.byteLength(
                    descriptionLine(fs.readFileSync(path.join(COMPONENTS, "skills", name, "SKILL.md"), "utf8")),
                    "utf8",
                ),
            0,
        );
        expect(ordinaryLoadedBytes(COMPONENTS)).toBe(base + shared + descriptions);
    });

    it("stays at or under the ceiling", () => {
        const problem: string | null = checkCeiling(ordinaryLoadedBytes(COMPONENTS), CEILING);
        expect(problem, problem ?? undefined).toBeNull();
    });

    it("records the ceiling with its date and the value it replaces", () => {
        expect(CEILING.recorded).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(CEILING.replaces).not.toBeNull();
        expect(CEILING.replaces).not.toBe(CEILING.bytes);
    });

    it("counts every shared skill the base stage loads on every run (epic #889, story #890)", () => {
        expect(SHARED_SKILLS).toContain("nxs-run-discipline");
        const base: string = fs.readFileSync(path.join(COMPONENTS, "commands", "nxs.distill.md"), "utf8");
        const named: Set<string> = new Set(base.match(/`nxs-[a-z-]+`/g)?.map((n) => n.replaceAll("`", "")) ?? []);
        for (const name of named) {
            if (!fs.existsSync(path.join(COMPONENTS, "skills", name, "SKILL.md"))) continue;
            expect(CONTRACTS.includes(name) || SHARED_SKILLS.includes(name), `${name} is loaded but not counted`).toBe(true);
        }
        for (const name of SHARED_SKILLS) expect(named.has(name), `${name} is counted but not loaded`).toBe(true);
    });

    it("names both the measured value and the ceiling when a change pushes the drain over it", () => {
        const problem: string | null = checkCeiling(CEILING.bytes + 1, CEILING);
        expect(problem).toContain(String(CEILING.bytes + 1));
        expect(problem).toContain(String(CEILING.bytes));
    });
});

describe("each exceptional rule stays in the contract that owns it", () => {
    it("finds every named rule in its contract and in no part of the base stage", () => {
        expect(checkResidency(COMPONENTS)).toEqual([]);
    });

    it("covers every contract", () => {
        expect(new Set(RESIDENCY.map((r) => r.contract))).toEqual(new Set(CONTRACTS));
    });

    it("names the rule that moved back, not merely that something differs", () => {
        const problems: string[] = checkResidency(COMPONENTS, [
            { rule: "the drift advisory", contract: "nxs-distill-taxonomy", probe: "Phase 0 — Preflight" },
        ]);
        expect(problems).toContainEqual(expect.stringContaining("the drift advisory moved back into the base stage"));
    });

    it("names a rule that vanished from its contract", () => {
        const problems: string[] = checkResidency(COMPONENTS, [
            { rule: "the taxonomy gate", contract: "nxs-distill-taxonomy", probe: "a phrase no contract states" },
        ]);
        expect(problems).toEqual(["the taxonomy gate is no longer stated in nxs-distill-taxonomy"]);
    });
});
