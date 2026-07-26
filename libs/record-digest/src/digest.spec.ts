import { describe, expect, it } from "vitest";
import { canonicalizeRecordBody, recordDigest } from "./digest.js";

const BODY = ["# Decision Record: Thing", "", "## Summary", "", "We chose A over B.", ""].join("\n");

describe("recordDigest — AC1: the same body always yields the same value", () => {
    it("is stable across separate computations", () => {
        expect(recordDigest(BODY)).toBe(recordDigest(BODY));
    });

    it("is a full-length hexadecimal digest, never truncated (Invariant 9)", () => {
        expect(recordDigest(BODY)).toMatch(/^[0-9a-f]{64}$/);
    });
});

describe("recordDigest — AC2: the canonicalisation rule is stated, not incidental", () => {
    it("hashes CRLF and LF renderings of one body equally", () => {
        expect(recordDigest(BODY.replace(/\n/g, "\r\n"))).toBe(recordDigest(BODY));
    });

    it("hashes a lone-CR rendering equally", () => {
        expect(recordDigest(BODY.replace(/\n/g, "\r"))).toBe(recordDigest(BODY));
    });

    it("ignores trailing whitespace on any line", () => {
        const padded = BODY.split("\n").map((line) => line + "   ").join("\n");
        expect(recordDigest(padded)).toBe(recordDigest(BODY));
    });

    it("ignores trailing blank lines at the end of the body", () => {
        expect(recordDigest(BODY + "\n\n\n")).toBe(recordDigest(BODY));
        expect(recordDigest(BODY.replace(/\n+$/, ""))).toBe(recordDigest(BODY));
    });
});

describe("recordDigest — AC3: any other character difference is a different value", () => {
    it("differs when a word changes", () => {
        expect(recordDigest(BODY.replace("A over B", "B over A"))).not.toBe(recordDigest(BODY));
    });

    it("differs on leading whitespace, which is markdown-significant", () => {
        expect(recordDigest(BODY.replace("We chose", "  We chose"))).not.toBe(recordDigest(BODY));
    });

    it("differs on an internal blank line, which the rule deliberately does not forgive", () => {
        expect(recordDigest(BODY.replace("## Summary\n", "## Summary\n\n"))).not.toBe(recordDigest(BODY));
    });

    it("differs on a Unicode form the rule deliberately does not normalise", () => {
        expect(recordDigest("café")).not.toBe(recordDigest("café"));
    });

    it("differs on an empty body versus a whitespace-only body's shared canonical form", () => {
        // Both canonicalise to "" — equal by the rule, and distinct from any real body.
        expect(recordDigest("   \n\n")).toBe(recordDigest(""));
        expect(recordDigest("")).not.toBe(recordDigest(BODY));
    });
});

describe("canonicalizeRecordBody — the rule, applied and nothing else", () => {
    it("normalises line endings, strips per-line trailing whitespace and trailing blank lines", () => {
        expect(canonicalizeRecordBody("a  \r\nb\t\r\n\r\n\r\n")).toBe("a\nb");
    });

    it("preserves interior blank lines and leading indentation", () => {
        expect(canonicalizeRecordBody("a\n\n    b\n")).toBe("a\n\n    b");
    });
});
