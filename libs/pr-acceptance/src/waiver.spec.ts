/**
 * The one trusted waiver reader (epic #828, story #856, decision record #849, D11). A lead waives a
 * revised-record or landed-change stop by posting a comment in a fixed form on the pull request;
 * close reads it through this reader and never asks. These cases drive the reader over `gh`
 * payloads and the two matchers over what it read.
 */

import { describe, expect, it } from "vitest";
import { type Route, fakeRunner } from "./harness-fixtures.js";
import {
    WAIVER_MARKER,
    matchLandedChangeWaiver,
    matchRecordWaiver,
    parseWaiverBlock,
    readPrWaivers,
    type PrWaivers,
} from "./waiver.js";

const landedBody = (files: string[], extra = "") =>
    `Waiving the landed change.\n\n${WAIVER_MARKER}\n\`\`\`yaml\nwaive: landed-change\nfiles:\n${files.map((f) => `  - ${f}`).join("\n")}\n${extra}\`\`\``;
const recordBody = (record: string, digest: string) =>
    `${WAIVER_MARKER}\n\`\`\`yaml\nwaive: record-revised\nrecord: "${record}"\ndigest: ${digest}\nreason: wording only\n\`\`\``;

interface Comment {
    body: string;
    login?: string;
    association?: string;
    at?: string;
    url?: string;
}

const comment = (c: Comment) => ({
    body: c.body,
    author: { login: c.login ?? "lead" },
    authorAssociation: c.association ?? "MEMBER",
    createdAt: c.at ?? "2026-10-01T00:00:00Z",
    url: c.url ?? "https://github.com/acme/web/pull/10#issuecomment-1",
});

const view = (comments: Comment[]): Route => ({ match: "gh pr view", result: { stdout: JSON.stringify({ comments: comments.map(comment) }) } });

function read(comments: Comment[]): PrWaivers {
    const r = readPrWaivers(fakeRunner([view(comments)]), "/co", 10);
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
}

describe("parseWaiverBlock — the fixed waiver form", () => {
    it("reads a landed-change waiver and the files it names", () => {
        expect(parseWaiverBlock(landedBody(["src/a.ts", "src/b.ts"], "reason: formatter run on merge\n"))).toEqual({
            ok: true,
            terms: { cause: "landed-change", files: ["src/a.ts", "src/b.ts"] },
            reason: "formatter run on merge",
        });
    });

    it("reads a revised-record waiver and the record revision it accepts", () => {
        expect(parseWaiverBlock(recordBody("#849", "ABC123"))).toEqual({
            ok: true,
            terms: { cause: "record-revised", record: "#849", digest: "abc123" },
            reason: "wording only",
        });
    });

    it("is null for a body with no waiver marker", () => {
        expect(parseWaiverBlock("waive: landed-change")).toBeNull();
    });

    it("refuses a cause that cannot be waived, such as a moved head", () => {
        const r = parseWaiverBlock(`${WAIVER_MARKER}\n\`\`\`yaml\nwaive: head-mismatch\n\`\`\``);
        expect(r?.ok).toBe(false);
    });

    it("refuses a landed-change waiver that names no file, and a record waiver with no digest", () => {
        expect(parseWaiverBlock(landedBody([]))?.ok).toBe(false);
        expect(parseWaiverBlock(`${WAIVER_MARKER}\n\`\`\`yaml\nwaive: record-revised\nrecord: "#849"\n\`\`\``)?.ok).toBe(false);
    });
});

describe("readPrWaivers — every waiver comment on one pull request", () => {
    it("reads each waiver comment with its author, link and trust, and skips other comments", () => {
        const w = read([{ body: "LGTM" }, { body: landedBody(["src/a.ts"]), login: "alice", url: "https://x/1" }]);
        expect(w.pr).toBe(10);
        expect(w.comments).toEqual([
            {
                author: "alice",
                url: "https://x/1",
                at: "2026-10-01T00:00:00Z",
                trusted: true,
                waiver: { ok: true, terms: { cause: "landed-change", files: ["src/a.ts"] }, reason: null },
            },
        ]);
    });

    it("applies the receipt reader's trusted-author rule: a contributor cannot speak for the repository", () => {
        const w = read([{ body: landedBody(["src/a.ts"]), association: "CONTRIBUTOR" }, { body: landedBody(["src/a.ts"]), association: "OWNER" }]);
        expect(w.comments.map((c) => c.trusted)).toEqual([false, true]);
    });

    it("reads the pull request in the repository it merged in", () => {
        const run = fakeRunner([view([])]);
        readPrWaivers(run, "/co", 10, { ghRepo: "acme/api" });
        expect(run.calls[0]).toContain("--repo acme/api");
    });

    it("fails, never reading as no waiver, when the comments cannot be read", () => {
        const r = readPrWaivers(fakeRunner([{ match: "gh pr view", result: { status: 1, stderr: "HTTP 502" } }]), "/co", 10);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.message).toContain("HTTP 502");
        const garbled = readPrWaivers(fakeRunner([{ match: "gh pr view", result: { stdout: "not json" } }]), "/co", 10);
        expect(garbled.ok).toBe(false);
    });
});

describe("matchLandedChangeWaiver — a waiver covers only the files it names (G31, G32)", () => {
    it("applies a trusted waiver that names every changed file", () => {
        const m = matchLandedChangeWaiver(read([{ body: landedBody(["src/b.ts", "src/a.ts", "src/extra.ts"]), login: "alice" }]), ["src/a.ts", "src/b.ts"]);
        expect(m.applied?.author).toBe("alice");
        expect(m.rejected).toEqual([]);
    });

    it("applies nothing, and names the files left uncovered, when a waiver leaves a changed file unnamed", () => {
        const m = matchLandedChangeWaiver(read([{ body: landedBody(["src/a.ts"]), url: "https://x/2" }]), ["src/a.ts", "src/b.ts"]);
        expect(m.applied).toBeNull();
        expect(m.rejected).toEqual([{ author: "lead", url: "https://x/2", why: "incomplete", uncovered: ["src/b.ts"] }]);
    });

    it("applies nothing, and names the comment, when its author cannot speak for the repository", () => {
        const m = matchLandedChangeWaiver(read([{ body: landedBody(["src/a.ts"]), login: "mallory", association: "NONE", url: "https://x/3" }]), ["src/a.ts"]);
        expect(m.applied).toBeNull();
        expect(m.rejected).toEqual([{ author: "mallory", url: "https://x/3", why: "untrusted" }]);
    });

    it("ignores a waiver for the other cause, and names a waiver comment it could not read", () => {
        const m = matchLandedChangeWaiver(
            read([{ body: recordBody("#849", "abc") }, { body: `${WAIVER_MARKER}\n\`\`\`yaml\nwaive: everything\n\`\`\``, url: "https://x/4" }]),
            ["src/a.ts"],
        );
        expect(m.applied).toBeNull();
        expect(m.rejected).toEqual([{ author: "lead", url: "https://x/4", why: "malformed", problem: expect.stringContaining("everything") }]);
    });
});

describe("matchRecordWaiver — a waiver accepts only the record revision it names (G35)", () => {
    it("applies a trusted waiver naming the record and its current digest", () => {
        const m = matchRecordWaiver(read([{ body: recordBody("acme/issues#849", "abc") }]), 849, "abc");
        expect(m.applied?.waiver).toMatchObject({ ok: true, terms: { cause: "record-revised", digest: "abc" } });
    });

    it("applies nothing to a later revision, and names the digest the waiver accepted", () => {
        const m = matchRecordWaiver(read([{ body: recordBody("#849", "abc"), url: "https://x/5" }]), 849, "def");
        expect(m.applied).toBeNull();
        expect(m.rejected).toEqual([{ author: "lead", url: "https://x/5", why: "other-revision", record: "#849", digest: "abc" }]);
    });

    it("applies nothing from an author who cannot speak for the repository", () => {
        const m = matchRecordWaiver(read([{ body: recordBody("#849", "abc"), association: "FIRST_TIME_CONTRIBUTOR" }]), 849, "abc");
        expect(m.applied).toBeNull();
        expect(m.rejected.map((r) => r.why)).toEqual(["untrusted"]);
    });
});
