import { describe, expect, it } from "vitest";
import { verifyTranslation, type ReadCopy, type VerifyResult } from "./verify";

const BODY = "---\nslug: a\n---\n\nthe gate holds\n";

function reader(copies: Record<string, string>): ReadCopy {
    return (path: string): string => {
        const content: string | undefined = copies[path];
        if (content === undefined) {
            throw new Error(`ENOENT: no such file or directory, open '${path}'`);
        }
        return content;
    };
}

describe("verifyTranslation — fails closed", () => {
    it("passes when every machine-read region is byte-identical and every tracked item survives", () => {
        const result: VerifyResult = verifyTranslation(
            reader({ a: BODY, b: BODY.replace("the gate holds", "the gate holds firm") }),
            "a",
            "b",
        );
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.regions).toBe(1);
            expect(result.tracked).toBe(0);
        }
    });

    it("counts the tracked items it proved preserved", () => {
        const body = "---\nslug: a\n---\n\nthe gate must hold at 95%\n";
        const result: VerifyResult = verifyTranslation(reader({ a: body, b: body }), "a", "b");
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.tracked).toBe(2);
        }
    });

    it("fails and names the region when one changed", () => {
        const result: VerifyResult = verifyTranslation(reader({ a: BODY, b: BODY.replace("slug: a", "slug: b") }), "a", "b");
        expect(result.ok).toBe(false);
        if (!result.ok && result.problem === "changed") {
            expect(result.problems).toHaveLength(1);
            expect(result.findings).toHaveLength(0);
        }
    });

    it("returns one verdict carrying both comparisons when a run fails both", () => {
        const before = "---\nslug: a\n---\n\nthe gate must hold\n";
        const after = "---\nslug: b\n---\n\nthe gate should hold\n";
        const result: VerifyResult = verifyTranslation(reader({ a: before, b: after }), "a", "b");
        expect(result.ok).toBe(false);
        if (!result.ok && result.problem === "changed") {
            expect(result.problems).toHaveLength(1);
            expect(result.findings.length).toBeGreaterThan(0);
        }
    });

    it("fails on a lost tracked item even when every machine-read region is identical", () => {
        const result: VerifyResult = verifyTranslation(
            reader({ a: "the gate must hold\n", b: "the gate holds\n" }),
            "a",
            "b",
        );
        expect(result.ok).toBe(false);
        if (!result.ok && result.problem === "changed") {
            expect(result.problems).toHaveLength(0);
            expect(result.findings.map((finding) => finding.label)).toEqual(["must"]);
        }
    });

    it("permits an introduced item a named grounding source carries", () => {
        const result: VerifyResult = verifyTranslation(
            reader({ a: "the gate holds\n", b: "the gate holds at 95%\n", s: "coverage is 95%\n" }),
            "a",
            "b",
            ["s"],
        );
        expect(result.ok).toBe(true);
    });

    it("fails on an introduced item no named source carries", () => {
        const result: VerifyResult = verifyTranslation(
            reader({ a: "the gate holds\n", b: "the gate holds at 95%\n", s: "coverage is 90%\n" }),
            "a",
            "b",
            ["s"],
        );
        expect(result.ok).toBe(false);
    });

    it("fails when the pre-translation copy cannot be read", () => {
        const result: VerifyResult = verifyTranslation(reader({ b: BODY }), "a", "b");
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.problem).toBe("unreadable");
            expect(result.problem === "unreadable" && result.message).toContain("a");
        }
    });

    it("fails when the post-translation copy cannot be read", () => {
        const result: VerifyResult = verifyTranslation(reader({ a: BODY }), "a", "b");
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.problem).toBe("unreadable");
            expect(result.problem === "unreadable" && result.message).toContain("b");
        }
    });

    it("fails rather than skipping the source when a named grounding source cannot be read", () => {
        const result: VerifyResult = verifyTranslation(reader({ a: BODY, b: BODY }), "a", "b", ["gone.md"]);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.problem).toBe("unreadable");
            expect(result.problem === "unreadable" && result.message).toContain("gone.md");
        }
    });

    it("passes on a body carrying no machine-read region at all", () => {
        const result: VerifyResult = verifyTranslation(reader({ a: "the gate holds\n", b: "the gate holds\n" }), "a", "b");
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.regions).toBe(0);
        }
    });
});
