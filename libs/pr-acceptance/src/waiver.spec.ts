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
    matchStorylessWaiver,
    parseAnswerLines,
    parseStorylessWaiver,
    parseWaiverBlock,
    readPrWaivers,
    readStoryWaivers,
    storylessWaiverComment,
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

    it("still names an untrusted waiver comment when a trusted waiver on the same pull request applies (G32)", () => {
        const m = matchLandedChangeWaiver(
            read([
                { body: landedBody(["src/a.ts"]), login: "mallory", association: "NONE", url: "https://x/6" },
                { body: landedBody(["src/a.ts"]), login: "alice", url: "https://x/7" },
            ]),
            ["src/a.ts"],
        );
        expect(m.applied?.author).toBe("alice");
        expect(m.rejected).toEqual([{ author: "mallory", url: "https://x/6", why: "untrusted" }]);
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

    it("applies nothing to a waiver naming the same issue number in another repository", () => {
        const w = read([{ body: recordBody("other/repo#849", "abc"), url: "https://x/8" }]);
        expect(matchRecordWaiver(w, 849, "abc", "acme/issues").applied).toBeNull();
        expect(matchRecordWaiver(w, 849, "abc", "acme/issues").rejected.map((r) => r.why)).toEqual(["other-revision"]);
        expect(matchRecordWaiver(read([{ body: recordBody("Acme/Issues#849", "abc") }]), 849, "abc", "acme/issues").applied).not.toBeNull();
        expect(matchRecordWaiver(read([{ body: recordBody("#849", "abc") }]), 849, "abc", "acme/issues").applied).not.toBeNull();
    });

    it("applies nothing from an author who cannot speak for the repository", () => {
        const m = matchRecordWaiver(read([{ body: recordBody("#849", "abc"), association: "FIRST_TIME_CONTRIBUTOR" }]), 849, "abc");
        expect(m.applied).toBeNull();
        expect(m.rejected.map((r) => r.why)).toEqual(["untrusted"]);
    });
});

/**
 * The answers on a pull request come through this same reader (epic #829, story #860, decision
 * record #871, D3): one line per answer, the ID, a dash, a verb, a colon and a reason. There is no
 * second comment reader, so the trust rule is the one the waivers above already use.
 */
describe("parseAnswerLines — the fixed answer form", () => {
    it("reads every answer line in a comment, in the order written, with its reason", () => {
        const body = [
            "Thanks for the review.",
            "",
            "DV2 — accepted: the platform has no batch endpoint",
            "F1 – waived: tracked in #901",
            "DS3 - approved",
            "dv4 -- Accepted:   kept on purpose  ",
        ].join("\n");
        expect(parseAnswerLines(body)).toEqual([
            { id: "DV2", verb: "accepted", reason: "the platform has no batch endpoint" },
            { id: "F1", verb: "waived", reason: "tracked in #901" },
            { id: "DS3", verb: "approved", reason: "" },
            { id: "DV4", verb: "accepted", reason: "kept on purpose" },
        ]);
    });

    it("reads an answer with no reason as one with an empty reason, so the verdict can name it", () => {
        expect(parseAnswerLines("DV1 — accepted:")).toEqual([{ id: "DV1", verb: "accepted", reason: "" }]);
    });

    it("reads nothing from a freely worded reply, a quoted answer or an unknown verb", () => {
        const body = ["I accept DV1, it is fine.", "> DV1 — accepted: quoting the lead", "DV1 — rejected: no", "DV1 accepted: no dash", "DV1 — accepted by @lead: the listing form"].join("\n");
        expect(parseAnswerLines(body)).toEqual([]);
    });

    it("never reads a body carrying either verdict marker as an answer (G12)", () => {
        expect(parseAnswerLines(`DV1 — accepted: looks like an answer\n\n<!-- nexus:analyze-receipt -->\n\`\`\`yaml\npr: 1\n\`\`\``)).toEqual([]);
        expect(parseAnswerLines(`DV1 — accepted: looks like an answer\n\n<!-- nexus:analyze-judgments -->\n\`\`\`json\n{}\n\`\`\``)).toEqual([]);
    });
});

describe("readPrWaivers — every answer line on one pull request", () => {
    it("reads each answer with the author, link, time and trust of the comment it came from", () => {
        const w = read([
            { body: "DV1 — accepted: by design\nF2 — waived: flaky upstream", login: "lead", url: "https://x/10", at: "2026-10-02T00:00:00Z" },
            { body: "DV1 — accepted: I think it is fine", login: "drive-by", association: "NONE", url: "https://x/11" },
        ]);
        expect(w.answers).toEqual([
            { id: "DV1", verb: "accepted", reason: "by design", author: "lead", url: "https://x/10", at: "2026-10-02T00:00:00Z", trusted: true },
            { id: "F2", verb: "waived", reason: "flaky upstream", author: "lead", url: "https://x/10", at: "2026-10-02T00:00:00Z", trusted: true },
            { id: "DV1", verb: "accepted", reason: "I think it is fine", author: "drive-by", url: "https://x/11", at: "2026-10-01T00:00:00Z", trusted: false },
        ]);
    });

    it("reads no answer from a verdict published as a comment, even one listing answered items (G12)", () => {
        const verdict = "DV1 (high) accepted by @lead (https://x/10): by design\n\n<!-- nexus:analyze-receipt -->\n```yaml\npr: 10\n```";
        expect(read([{ body: verdict }]).answers).toEqual([]);
    });
});

// Epic #830, story #866 (decision record #872, D10): a story with no claiming pull request is
// waived by a trusted comment on its own issue, in the same marker-and-fence form.
describe("the storyless waiver on a story's own issue (D10, G5, G22)", () => {
    const storyless = (story: string, extra = "") => `${WAIVER_MARKER}\n\`\`\`yaml\nwaive: storyless\nstory: "${story}"\n${extra}\`\`\``;
    const issueView = (comments: Comment[]): Route => ({ match: "gh issue view", result: { stdout: JSON.stringify({ comments: comments.map(comment) }) } });

    it("prints the exact form, which its own parser reads back", () => {
        const form = storylessWaiverComment(865);
        expect(form.startsWith(WAIVER_MARKER)).toBe(true);
        expect(parseStorylessWaiver(form)).toEqual({ ok: true, story: "#865", reason: "<optional, one line>" });
    });

    it("reads the story it names and its reason, and ignores a pull-request waiver or a plain comment", () => {
        expect(parseStorylessWaiver(storyless("#865", "reason: shipped in #864's pull request\n"))).toEqual({ ok: true, story: "#865", reason: "shipped in #864's pull request" });
        expect(parseStorylessWaiver(recordBody("#849", "abc"))).toBeNull();
        expect(parseStorylessWaiver("LGTM")).toBeNull();
        expect(parseStorylessWaiver(`${WAIVER_MARKER}\nno fence`)?.ok).toBe(false);
        expect(parseStorylessWaiver(`${WAIVER_MARKER}\n\`\`\`yaml\nwaive: storyless\n\`\`\``)?.ok).toBe(false);
        expect(parseStorylessWaiver(`${WAIVER_MARKER}\n\`\`\`yaml\nwaive: whatever\n\`\`\``)?.ok).toBe(false);
    });

    it("is not a cause a pull-request waiver can clear, and says where it belongs", () => {
        const r = parseWaiverBlock(storyless("#865"));
        expect(r?.ok).toBe(false);
        expect(r !== null && !r.ok ? r.problem : "").toMatch(/story's own issue/);
    });

    it("reads the story issue in the issues repository, with each comment's author, date and trust", () => {
        const run = fakeRunner([issueView([{ body: "thanks" }, { body: storyless("#865"), login: "lead", at: "2026-10-02T09:00:00Z", url: "https://x/c/9" }, { body: storyless("#865"), association: "NONE" }])]);
        const r = readStoryWaivers(run, "/co", "acme/tracker", 865);
        expect(run.calls[0]).toContain("gh issue view 865 --repo acme/tracker --json comments");
        expect(r.ok && r.value.map((c) => [c.author, c.at, c.trusted])).toEqual([
            ["lead", "2026-10-02T09:00:00Z", true],
            ["lead", "2026-10-01T00:00:00Z", false],
        ]);
    });

    it("fails, never reading as no waiver, when the story's comments cannot be read", () => {
        expect(readStoryWaivers(fakeRunner([{ match: "gh issue view", result: { status: 1, stderr: "HTTP 502" } }]), "/co", "acme/tracker", 865).ok).toBe(false);
        expect(readStoryWaivers(fakeRunner([{ match: "gh issue view", result: { stdout: "nope" } }]), "/co", "acme/tracker", 865).ok).toBe(false);
    });

    it("applies the newest trusted waiver naming this story, and names every one that cleared nothing", () => {
        const read = (comments: Comment[]) => {
            const r = readStoryWaivers(fakeRunner([issueView(comments)]), "/co", "acme/tracker", 865);
            if (!r.ok) throw new Error(r.error.message);
            return r.value;
        };
        const m = matchStorylessWaiver(
            read([
                { body: storyless("#865"), at: "2026-10-01T00:00:00Z", url: "https://x/1" },
                { body: storyless("acme/tracker#865"), at: "2026-10-03T00:00:00Z", url: "https://x/2" },
                { body: storyless("#865"), association: "CONTRIBUTOR", url: "https://x/3" },
            ]),
            865,
            "acme/tracker",
        );
        expect(m.applied?.url).toBe("https://x/2");
        expect(m.rejected).toEqual([{ author: "lead", url: "https://x/3", why: "untrusted" }]);

        const none = matchStorylessWaiver(read([{ body: storyless("#864"), url: "https://x/4" }, { body: storyless("other/repo#865"), url: "https://x/5" }]), 865, "acme/tracker");
        expect(none.applied).toBeNull();
        expect(none.rejected.map((r) => r.url)).toEqual(["https://x/4", "https://x/5"]);
        const broken = matchStorylessWaiver(read([{ body: `${WAIVER_MARKER}\n\`\`\`yaml\nwaive: storyless\n\`\`\`` }]), 865, "acme/tracker");
        expect(broken.rejected[0].why).toBe("malformed");
    });
});
