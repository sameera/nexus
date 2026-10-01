/**
 * A story's fingerprint is the record digest over its issue body as fetched from the issues
 * repository (epic #827, decision record #837, D6).
 */

import { describe, expect, it } from "vitest";
import { recordDigest } from "@nexus/record-digest/digest";
import { fingerprintStories, storyFingerprint } from "./fingerprint.js";
import { type Runner } from "./run.js";

function issues(bodies: Record<string, { title?: string; body: string } | "fail">, seen: string[][] = []): Runner {
    return (cmd, args) => {
        seen.push([cmd, ...args]);
        const m = cmd === "gh" && args[0] === "api" ? /^repos\/(.+)\/issues\/(\d+)$/.exec(args[1] ?? "") : null;
        const hit = m === null ? undefined : bodies[`${m[1]}#${m[2]}`];
        if (hit === undefined) return { status: 1, stdout: "", stderr: "gh: Not Found (HTTP 404)" };
        if (hit === "fail") return { status: 1, stdout: "", stderr: "HTTP 502: Bad Gateway" };
        return { status: 0, stdout: JSON.stringify({ title: hit.title ?? "t", body: hit.body, state: "open" }), stderr: "" };
    };
}

describe("storyFingerprint — the record digest over the story's issue body", () => {
    it("is the full record digest of the body, fetched from the issues repository", () => {
        const seen: string[][] = [];
        const r = storyFingerprint(issues({ "acme/hub#834": { body: "AC one\r\n" } }, seen), "/code", "acme/hub", 834);
        expect(r).toEqual({ ok: true, digest: recordDigest("AC one\r\n") });
        expect(r.ok && r.digest).toMatch(/^[0-9a-f]{64}$/);
        expect(seen[0]).toContain("repos/acme/hub/issues/834");
    });

    it("leaves the title out, so a story that is only retitled keeps its fingerprint", () => {
        const a = storyFingerprint(issues({ "acme/hub#834": { title: "Old", body: "AC" } }), "/code", "acme/hub", 834);
        const b = storyFingerprint(issues({ "acme/hub#834": { title: "New", body: "AC" } }), "/code", "acme/hub", 834);
        expect(a).toEqual(b);
    });

    it("changes on any edit other than line endings or trailing spaces, including other whitespace", () => {
        const fp = (body: string) => storyFingerprint(issues({ "acme/hub#1": { body } }), "/code", "acme/hub", 1);
        expect(fp("a\r\nb  \n")).toEqual(fp("a\nb\n"));
        expect(fp("a\n  b")).not.toEqual(fp("a\nb"));
        expect(fp("a\n\nb")).not.toEqual(fp("a\nb"));
    });

    it("fails, naming the cause, when the story cannot be fetched", () => {
        const r = storyFingerprint(issues({ "acme/hub#1": "fail" }), "/code", "acme/hub", 1);
        expect(r.ok).toBe(false);
        expect(r.ok ? "" : r.cause).toContain("502");
    });
});

describe("fingerprintStories — every story the run covers", () => {
    it("returns one fingerprint per story", () => {
        const r = fingerprintStories(issues({ "acme/hub#1": { body: "a" }, "acme/hub#2": { body: "b" } }), "/code", "acme/hub", [2, 1]);
        expect(r).toEqual({ ok: true, fingerprints: { 1: recordDigest("a"), 2: recordDigest("b") } });
    });

    it("names every story whose text could not be fetched", () => {
        const r = fingerprintStories(issues({ "acme/hub#1": "fail", "acme/hub#2": { body: "b" } }), "/code", "acme/hub", [1, 2, 3]);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.failures.map((f) => f.story)).toEqual([1, 3]);
    });
});
