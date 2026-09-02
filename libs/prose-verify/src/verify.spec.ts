import { describe, expect, it } from "vitest";
import { verifyTranslation, type ReadCopy, type VerifyResult } from "./verify";

const BODY: string = "---\nslug: a\n---\n\nprose\n";

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
    it("passes when every machine-read region is byte-identical", () => {
        const result: VerifyResult = verifyTranslation(reader({ a: BODY, b: BODY.replace("prose", "plain prose") }), "a", "b");
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.regions).toBe(1);
        }
    });

    it("fails and names the region when one changed", () => {
        const result: VerifyResult = verifyTranslation(reader({ a: BODY, b: BODY.replace("slug: a", "slug: b") }), "a", "b");
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.problem).toBe("region-changed");
            expect(result.problems).toHaveLength(1);
        }
    });

    it("fails when the pre-translation copy cannot be read", () => {
        const result: VerifyResult = verifyTranslation(reader({ b: BODY }), "a", "b");
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.problem).toBe("unreadable");
            expect(result.message).toContain("a");
        }
    });

    it("fails when the post-translation copy cannot be read", () => {
        const result: VerifyResult = verifyTranslation(reader({ a: BODY }), "a", "b");
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.problem).toBe("unreadable");
            expect(result.message).toContain("b");
        }
    });

    it("passes on a body carrying no machine-read region at all", () => {
        const result: VerifyResult = verifyTranslation(reader({ a: "prose\n", b: "plain prose\n" }), "a", "b");
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.regions).toBe(0);
        }
    });
});
