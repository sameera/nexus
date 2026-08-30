/**
 * Story #383 — the needs-design label follows the epic's declared complexity.
 *
 * These are `test_needs_design_label`'s cases. The threshold is asserted on purpose rather than
 * left to the shared rule, so a change to which epics warrant a decision record fails here instead
 * of quietly changing the gate.
 */

import { describe, expect, it } from "vitest";
import { FAIL, checkoutWith, draft, fakeEnvironment, recordingIo, writeDraft } from "./fixtures";
import { runCreateEpic } from "./run";

function file(complexity: string, options = {}, argv: string[] = []) {
    const root: string = checkoutWith({ classification: "labels", project: "none" });
    const path: string = writeDraft(root, draft({ complexity }));
    const fake = fakeEnvironment(options);
    const io = recordingIo(root);
    const code: number = runCreateEpic([path, ...argv], io, fake.env);
    return { code, io, calls: fake.calls.map((call) => call.join(" ")) };
}

describe("which epics leave the run labelled", () => {
    for (const rollup of ["M", "L"]) {
        it(`labels an ${rollup} epic`, () => {
            const run = file(rollup);
            expect(run.code).toBe(0);
            expect(run.calls.some((call) => call.includes("issue edit 7 --add-label needs-design"))).toBe(true);
        });
    }

    it("leaves an exempt epic unlabelled", () => {
        expect(file("S").calls.some((call) => call.includes("--add-label needs-design"))).toBe(false);
    });

    it("labels an epic that declares no complexity at all", () => {
        const root: string = checkoutWith({ classification: "labels", project: "none" });
        const path: string = writeDraft(root, draft());
        const fake = fakeEnvironment();
        expect(runCreateEpic([path], recordingIo(root), fake.env)).toBe(0);
        expect(fake.calls.map((c) => c.join(" ")).some((call) => call.includes("--add-label needs-design"))).toBe(true);
    });

    it("names the rollup that exempted it, rather than a hard-coded size", () => {
        for (const rollup of ["S", "XS"]) {
            expect(file(rollup).io.all()).toContain(`no record needed (${rollup} epic)`);
        }
    });

    it("creates the label before applying it", () => {
        const run = file("L");
        const created: number = run.calls.findIndex((call) => call.startsWith("label create needs-design"));
        const applied: number = run.calls.findIndex((call) => call.includes("--add-label needs-design"));
        expect(created).toBeGreaterThanOrEqual(0);
        expect(created).toBeLessThan(applied);
    });

    it("makes and applies the same decision on a promoted epic", () => {
        const root: string = checkoutWith({ classification: "labels", project: "none" });
        const path: string = writeDraft(root, draft({ complexity: "M" }));
        const fake = fakeEnvironment({
            answer: (args: string[]) =>
                args[0] === "issue" && args[1] === "view" && args.includes("number,title,labels")
                    ? { status: 0, stdout: JSON.stringify({ number: 42, labels: [{ name: "backlog" }] }), stderr: "" }
                    : undefined,
        });
        expect(runCreateEpic([path, "--promote", "42"], recordingIo(root), fake.env)).toBe(0);
        expect(
            fake.calls.map((call) => call.join(" ")).some((call) => call.includes("issue edit 42 --add-label needs-design")),
        ).toBe(true);
    });

    it("warns without failing the run when the label cannot be applied", () => {
        const run = file("L", {
            answer: (args: string[]) =>
                args[0] === "issue" && args[1] === "edit" && args.includes("needs-design") ? FAIL("no scope") : undefined,
        });
        expect(run.code).toBe(0);
        expect(run.io.all()).toContain("apply it by hand before /nxs.decision-record");
    });
});
