/**
 * Story #920, decision record #921 — `nexus review-post` checks a ranked review and posts it as one
 * pull request review, with no model judgment (D3, D4).
 *
 * Nothing is posted without a verdict (G9). A posted review carries the ranking in its body and one
 * inline comment per finding location inside the changed lines, each tagged with its finding
 * number; body-only findings are carried in the body (G10, G2). Any inline comment naming a file
 * not in the pull request, a line outside the changed lines or expected text not on its line stops
 * the post and every problem is listed; body-only findings are not checked (G11). A second review
 * by the lead on the same head needs confirmation (G12). The same pull request state and comments
 * give the same result (G22). The lead sees the link, the inline count and the body-only count
 * (G13, G19).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type RunResult, type Runner } from "@nexus/workspace/run";
import { runReviewPost } from "./review-post.js";

const HEAD = "a".repeat(40);
const REPO = "acme/widgets";

interface FakePr {
    head: string;
    /** filename → unified-diff patch, as GitHub's pull-request files endpoint returns it. */
    files: Record<string, string | null>;
    /** filename → file content at the head commit. */
    contents: Record<string, string>;
    reviews: Array<{ login: string; commit: string }>;
    login: string;
    postFails?: boolean;
}

interface Posted {
    args: string[];
    payload: Record<string, unknown>;
}

const ok = (stdout: string): RunResult => ({ status: 0, stdout, stderr: "" });
const fail = (stderr: string): RunResult => ({ status: 1, stdout: "", stderr });

/** A runner that answers the GitHub reads `nexus review-post` makes, and records each post. */
function fakeGitHub(pr: FakePr, posted: Posted[]): Runner {
    return (cmd: string, args: string[]): RunResult => {
        if (cmd !== "gh" || args[0] !== "api") return fail(`unexpected command ${cmd} ${args.join(" ")}`);
        const target: string | undefined = args.find((a) => a.startsWith("repos/") || a === "user");
        if (target === "user") return ok(`${pr.login}\n`);
        if (args.includes("POST")) {
            const input: string = args[args.indexOf("--input") + 1];
            posted.push({ args, payload: JSON.parse(fs.readFileSync(input, "utf8")) as Record<string, unknown> });
            return pr.postFails === true ? fail("HTTP 422: Unprocessable Entity") : ok(JSON.stringify({ html_url: `https://github.com/${REPO}/pull/7#pullrequestreview-99` }));
        }
        if (target === `repos/${REPO}/pulls/7`) return ok(JSON.stringify({ head: pr.head }));
        if (target === `repos/${REPO}/pulls/7/files`) {
            return ok(Object.entries(pr.files).map(([filename, patch]) => JSON.stringify({ filename, patch })).join("\n"));
        }
        if (target === `repos/${REPO}/pulls/7/reviews`) {
            return ok(pr.reviews.map((r) => JSON.stringify(r)).join("\n"));
        }
        const contents = /^repos\/acme\/widgets\/contents\/(.+)\?ref=(\w+)$/.exec(target ?? "");
        if (contents !== null && contents[2] === pr.head) {
            const file: string = decodeURIComponent(contents[1]);
            return file in pr.contents ? ok(pr.contents[file]) : fail("HTTP 404: Not Found");
        }
        return fail(`unexpected gh api call ${args.join(" ")}`);
    };
}

/** `src/app.ts` changed lines 10–12 at the head: 10 is context, 11–12 are added. */
const APP_PATCH = "@@ -10,2 +10,3 @@ function main() {\n     const a = 1;\n+    const b = load(a);\n+    return save(b);";
const APP_CONTENT: string = [...Array.from({ length: 9 }, (_v, i) => `// line ${i + 1}`), "    const a = 1;", "    const b = load(a);", "    return save(b);", "}"].join("\n");

function basePr(): FakePr {
    return {
        head: HEAD,
        files: { "src/app.ts": APP_PATCH, "docs/readme.md": null },
        contents: { "src/app.ts": APP_CONTENT },
        reviews: [],
        login: "lead",
    };
}

interface Review {
    findings: number;
    body: string;
    comments: Array<{ finding: number; path: string; line: number; expectedText: string; body: string }>;
    bodyOnly: Array<{ finding: number; path: string; line: number }>;
}

function baseReview(): Review {
    return {
        findings: 3,
        body: "## Ranking\n\n1. load() result unchecked\n2. save() can throw\n3. stale helper in src/old.ts:4 (body-only)",
        comments: [
            { finding: 1, path: "src/app.ts", line: 11, expectedText: "load(a)", body: "The result of load() is used unchecked." },
            { finding: 2, path: "src/app.ts", line: 12, expectedText: "save(b)", body: "save() can throw here." },
        ],
        bodyOnly: [{ finding: 3, path: "src/old.ts", line: 4 }],
    };
}

let scratch: string;
let reviewPath: string;
let out: string[];
let err: string[];

beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), "review-post-"));
    reviewPath = path.join(scratch, "review.json");
    out = [];
    err = [];
});

afterEach(() => {
    fs.rmSync(scratch, { recursive: true, force: true });
});

function post(review: Review | string, pr: FakePr, extra: string[] = ["--verdict", "comment"]): { status: number; posted: Posted[] } {
    fs.writeFileSync(reviewPath, typeof review === "string" ? review : JSON.stringify(review));
    const posted: Posted[] = [];
    const io = { cwd: scratch, stdout: (l: string) => out.push(l), stderr: (l: string) => err.push(l) };
    const status: number = runReviewPost(["--pr", "7", "--repo", REPO, "--review", reviewPath, ...extra], io, fakeGitHub(pr, posted));
    return { status, posted };
}

describe("nexus review-post posts nothing without the lead's verdict (G9)", () => {
    it("refuses with no verdict, naming the three it accepts", () => {
        const run = post(baseReview(), basePr(), []);
        expect(run.status).toBe(2);
        expect(run.posted).toHaveLength(0);
        expect(err.join("\n")).toMatch(/request-changes.*comment.*approve/);
    });

    it("refuses a verdict that is not one of the three", () => {
        const run = post(baseReview(), basePr(), ["--verdict", "merge"]);
        expect(run.status).toBe(2);
        expect(run.posted).toHaveLength(0);
    });
});

describe("nexus review-post posts one review carrying the ranking (G10, G13, G19)", () => {
    it.each([
        ["request-changes", "REQUEST_CHANGES"],
        ["comment", "COMMENT"],
        ["approve", "APPROVE"],
    ])("posts verdict %s as one review on the head commit", (verdict, event) => {
        const run = post(baseReview(), basePr(), ["--verdict", verdict]);
        expect(run.status, err.join("\n")).toBe(0);
        expect(run.posted).toHaveLength(1);
        expect(run.posted[0].payload).toMatchObject({ commit_id: HEAD, event, body: baseReview().body });
    });

    it("gives each inline comment its location and its finding number", () => {
        const run = post(baseReview(), basePr());
        const comments = run.posted[0].payload.comments as Array<{ path: string; line: number; side: string; body: string }>;
        expect(comments).toHaveLength(2);
        expect(comments.map((c) => [c.path, c.line, c.side])).toEqual([
            ["src/app.ts", 11, "RIGHT"],
            ["src/app.ts", 12, "RIGHT"],
        ]);
        expect(comments[0].body).toMatch(/#1\b/);
        expect(comments[0].body).toContain("The result of load() is used unchecked.");
        expect(comments[1].body).toMatch(/#2\b/);
    });

    it("reports the review link, the inline comments and the body-only findings", () => {
        post(baseReview(), basePr());
        const report = JSON.parse(out[0]) as Record<string, unknown>;
        expect(report).toMatchObject({
            command: "review-post",
            posted: true,
            url: `https://github.com/${REPO}/pull/7#pullrequestreview-99`,
            inlineComments: 2,
            bodyOnly: 1,
        });
    });

    it("posts a review whose every finding is body-only, with no inline comment", () => {
        const review: Review = { ...baseReview(), comments: [], bodyOnly: [1, 2, 3].map((finding) => ({ finding, path: "src/old.ts", line: finding })) };
        const run = post(review, basePr());
        expect(run.status, err.join("\n")).toBe(0);
        expect(run.posted[0].payload.comments).toEqual([]);
        expect(JSON.parse(out[0])).toMatchObject({ inlineComments: 0, bodyOnly: 3 });
    });

    it("stops, posting nothing, when GitHub rejects the review", () => {
        const pr: FakePr = { ...basePr(), postFails: true };
        const run = post(baseReview(), pr);
        expect(run.status).toBe(1);
        expect(err.join("\n")).toMatch(/post-failed/);
        expect(out).toHaveLength(0);
    });
});

describe("nexus review-post carries every finding (G2)", () => {
    it("refuses a review that leaves a ranked finding out of both the inline comments and the body-only list", () => {
        const review: Review = { ...baseReview(), bodyOnly: [] };
        const run = post(review, basePr());
        expect(run.status).toBe(1);
        expect(run.posted).toHaveLength(0);
        expect(err.join("\n")).toMatch(/finding 3/);
    });
});

describe("nexus review-post checks every inline comment before posting (G11)", () => {
    it("lists every problem and posts nothing: a file not in the pull request, a line outside the changed lines, expected text not on its line", () => {
        const review: Review = {
            ...baseReview(),
            findings: 4,
            comments: [
                { finding: 1, path: "src/missing.ts", line: 3, expectedText: "x", body: "a" },
                { finding: 2, path: "src/app.ts", line: 4, expectedText: "line 4", body: "b" },
                { finding: 3, path: "src/app.ts", line: 11, expectedText: "save(b)", body: "c" },
            ],
            bodyOnly: [{ finding: 4, path: "src/old.ts", line: 4 }],
        };
        const run = post(review, basePr());
        expect(run.status).toBe(1);
        expect(run.posted).toHaveLength(0);
        const listed: string = err.join("\n");
        expect(listed).toMatch(/src\/missing\.ts:3.*not in the pull request/);
        expect(listed).toMatch(/src\/app\.ts:4.*outside the changed lines/);
        expect(listed).toMatch(/src\/app\.ts:11.*expected text "save\(b\)" is not on that line/);
        expect(out).toHaveLength(0);
    });

    it("accepts a context line inside a hunk, where GitHub takes an inline comment", () => {
        const review: Review = { ...baseReview(), comments: [{ ...baseReview().comments[0], line: 10, expectedText: "const a = 1" }] };
        review.bodyOnly = [...review.bodyOnly, { finding: 2, path: "src/app.ts", line: 30 }];
        const run = post(review, basePr());
        expect(run.status, err.join("\n")).toBe(0);
    });

    it("treats a file whose diff GitHub does not show as having no changed lines", () => {
        const review: Review = { ...baseReview(), comments: [{ finding: 1, path: "docs/readme.md", line: 1, expectedText: "x", body: "a" }] };
        review.bodyOnly = [...review.bodyOnly, { finding: 2, path: "src/app.ts", line: 30 }];
        const run = post(review, basePr());
        expect(run.status).toBe(1);
        expect(err.join("\n")).toMatch(/docs\/readme\.md:1.*outside the changed lines/);
    });

    it("does not check a body-only finding's location", () => {
        const review: Review = { ...baseReview(), bodyOnly: [{ finding: 3, path: "not/in/the/pr.ts", line: 999 }] };
        const run = post(review, basePr());
        expect(run.status, err.join("\n")).toBe(0);
    });
});

describe("nexus review-post asks before a second review by the lead on the same head (G12)", () => {
    it("posts nothing when the lead already reviewed the head commit, and names the confirmation", () => {
        const pr: FakePr = { ...basePr(), reviews: [{ login: "lead", commit: HEAD }] };
        const run = post(baseReview(), pr);
        expect(run.status).toBe(1);
        expect(run.posted).toHaveLength(0);
        expect(err.join("\n")).toMatch(/second-review-unconfirmed/);
        expect(err.join("\n")).toMatch(/--confirm-second/);
    });

    it("posts the second review once the lead confirms it", () => {
        const pr: FakePr = { ...basePr(), reviews: [{ login: "lead", commit: HEAD }] };
        const run = post(baseReview(), pr, ["--verdict", "comment", "--confirm-second"]);
        expect(run.status, err.join("\n")).toBe(0);
        expect(run.posted).toHaveLength(1);
    });

    it("does not count another person's review, or the lead's review of an earlier commit", () => {
        const pr: FakePr = { ...basePr(), reviews: [{ login: "someone", commit: HEAD }, { login: "lead", commit: "b".repeat(40) }] };
        const run = post(baseReview(), pr);
        expect(run.status, err.join("\n")).toBe(0);
    });
});

describe("nexus review-post is deterministic (G22)", () => {
    it("gives the same result and posts the same review for the same pull request state and comments", () => {
        const first = post(baseReview(), basePr());
        const firstOut: string[] = [...out];
        out = [];
        const second = post(baseReview(), basePr());
        expect(second.status).toBe(first.status);
        expect(out).toEqual(firstOut);
        expect(second.posted[0].payload).toEqual(first.posted[0].payload);
    });
});

describe("nexus review-post refuses a review it cannot read", () => {
    it("refuses a review file that is not the expected JSON", () => {
        const run = post("not json", basePr());
        expect(run.status).toBe(1);
        expect(run.posted).toHaveLength(0);
        expect(err.join("\n")).toMatch(/review-malformed/);
    });

    it("refuses a review with no ranking in its body", () => {
        const run = post({ ...baseReview(), body: "  " }, basePr());
        expect(run.status).toBe(1);
        expect(err.join("\n")).toMatch(/review-malformed/);
    });

    it.each([
        ["an inline comment with no expected text", { comments: [{ finding: 1, path: "src/app.ts", line: 11, body: "a" }] }],
        ["a body-only finding with no line", { bodyOnly: [{ finding: 3, path: "src/old.ts" }] }],
        ["no finding count", { findings: 0 }],
        ["no comment list", { comments: null }],
    ])("refuses a review with %s", (_name, change) => {
        const run = post(JSON.stringify({ ...baseReview(), ...change }), basePr());
        expect(run.status).toBe(1);
        expect(run.posted).toHaveLength(0);
        expect(err.join("\n")).toMatch(/review-malformed/);
    });

    it("refuses an argument it does not know", () => {
        const run = post(baseReview(), basePr(), ["--verdict", "comment", "--force"]);
        expect(run.status).toBe(2);
        expect(run.posted).toHaveLength(0);
    });

    it("refuses a missing pull request, repository or review path", () => {
        const io = { cwd: scratch, stdout: (l: string) => out.push(l), stderr: (l: string) => err.push(l) };
        expect(runReviewPost(["--verdict", "comment"], io, fakeGitHub(basePr(), []))).toBe(2);
    });
});

describe("nexus review-post stops, posting nothing, when GitHub cannot be read", () => {
    it("names the pull request it could not read", () => {
        fs.writeFileSync(reviewPath, JSON.stringify(baseReview()));
        const io = { cwd: scratch, stdout: (l: string) => out.push(l), stderr: (l: string) => err.push(l) };
        const status: number = runReviewPost(["--pr", "8", "--repo", REPO, "--review", reviewPath, "--verdict", "comment"], io, fakeGitHub(basePr(), []));
        expect(status).toBe(1);
        expect(err.join("\n")).toMatch(/read-failed: could not read pull request acme\/widgets#8/);
    });

    it("lists an inline comment whose file cannot be read at the head commit", () => {
        const pr: FakePr = { ...basePr(), contents: {} };
        const run = post(baseReview(), pr);
        expect(run.status).toBe(1);
        expect(run.posted).toHaveLength(0);
        expect(err.join("\n")).toMatch(/src\/app\.ts:11.*could not be read at the head commit/);
    });
});

describe("nexus review-post on a host other than github.com", () => {
    it("aims every GitHub call at the repository's host", () => {
        const calls: string[][] = [];
        const github: Runner = fakeGitHub(basePr(), []);
        const onHost: Runner = (cmd, args, opts) => {
            calls.push(args);
            const at: number = args.indexOf("--hostname");
            return at === 1 && args[2] === "git.example.com" ? github(cmd, ["api", ...args.slice(3)], opts) : fail("wrong host");
        };
        fs.writeFileSync(reviewPath, JSON.stringify(baseReview()));
        const io = { cwd: scratch, stdout: (l: string) => out.push(l), stderr: (l: string) => err.push(l) };
        const status: number = runReviewPost(["--pr", "7", "--repo", `git.example.com/${REPO}`, "--review", reviewPath, "--verdict", "comment"], io, onHost);
        expect(status, err.join("\n")).toBe(0);
        expect(calls.every((a) => a[1] === "--hostname")).toBe(true);
    });
});
