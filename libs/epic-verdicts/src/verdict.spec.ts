import { describe, expect, it } from "vitest";
import { resolveStoryVerdict } from "./verdict.js";
import { type Runner } from "./run.js";
import {
    TWO_VERDICT_EPIC,
    TWO_VERDICT_PR,
    TWO_VERDICT_STORY,
    twoVerdictPrPayload,
} from "@nexus/pr-acceptance/verdict-fixtures";

const SLUG = { owner: "acme", repo: "widget" };

function block(opts: { epic?: string; stories?: string; repo?: string; issuesRepo?: string; head?: string; findings?: string }): string {
    return [
        "<!-- nexus:analyze-receipt -->",
        "```yaml",
        `epic: "${opts.epic ?? "#212"}"`,
        `pr: 501`,
        `date: 2026-09-01`,
        `head: ${opts.head ?? "a".repeat(40)}`,
        `mode: full`,
        `record: "#505"`,
        `record_hash: deadbeef`,
        `findings: { critical: 0, high: 0, medium: ${opts.findings ?? "0"}, low: 0 }`,
        ...(opts.repo !== undefined ? [`repo: ${opts.repo}`] : []),
        ...(opts.issuesRepo !== undefined ? [`issues_repo: ${opts.issuesRepo}`] : []),
        `stories: [${opts.stories ?? "496"}]`,
        "```",
    ].join("\n");
}

function ghRunner(prs: Record<number, { state: string; head: string; base: string; reviews?: Array<{ body: string; submittedAt: string }>; comments?: Array<{ body: string; createdAt: string }> }>): Runner {
    return (cmd, args) => {
        if (cmd === "gh" && args[0] === "pr" && args[1] === "view") {
            const n = Number(args[2]);
            const pr = prs[n];
            if (!pr) return { status: 1, stdout: "", stderr: "not found" };
            return {
                status: 0,
                stdout: JSON.stringify({
                    state: pr.state,
                    headRefOid: pr.head,
                    baseRefOid: pr.base,
                    reviews: pr.reviews ?? [],
                    comments: pr.comments ?? [],
                }),
                stderr: "",
            };
        }
        return { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
    };
}

describe("resolveStoryVerdict — trust and recency across a story's candidate pull requests (decision record #495/#505)", () => {
    it("chooses the sole trusted verdict stamping this epic and story", () => {
        const run = ghRunner({
            501: { state: "OPEN", head: "a".repeat(40), base: "b".repeat(40), reviews: [{ body: block({}), submittedAt: "2026-09-01T00:00:00Z" }] },
        });
        const r = resolveStoryVerdict(run, { epic: 212, story: 496, candidates: [{ pr: 501, repo: SLUG, cwd: "/repo" }] });
        expect(r.ok).toBe(true);
        if (!r.ok || !r.found) return;
        expect(r.verdict.pr).toBe(501);
        expect(r.verdict.head).toBe("a".repeat(40));
    });

    it("does not count a story a receipt only cited, rather than named (story #567)", () => {
        // The receipt names the story list the resolver returned. A pull request whose body
        // merely cited a sibling story therefore leaves that story with no verdict, and the
        // epic's close gate sees the gap instead of passing over code nobody read.
        const run = ghRunner({
            501: {
                state: "OPEN",
                head: "a".repeat(40),
                base: "b".repeat(40),
                reviews: [{ body: block({ stories: "496" }), submittedAt: "2026-09-01T00:00:00Z" }],
            },
        });
        const r = resolveStoryVerdict(run, { epic: 212, story: 497, candidates: [{ pr: 501, repo: SLUG, cwd: "/repo" }] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.found).toBe(false);
    });

    it("reports no verdict when no candidate carries a trusted receipt", () => {
        const run = ghRunner({ 501: { state: "OPEN", head: "a".repeat(40), base: "b".repeat(40) } });
        const r = resolveStoryVerdict(run, { epic: 212, story: 496, candidates: [{ pr: 501, repo: SLUG, cwd: "/repo" }] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.found).toBe(false);
        if (r.found) return;
        expect(r.candidates).toEqual([501]);
    });

    it("accepts a receipt whose epic is written in the qualified cross-repo form (concept \"Provenance Reference\")", () => {
        const run = ghRunner({
            501: { state: "OPEN", head: "a".repeat(40), base: "b".repeat(40), reviews: [{ body: block({ epic: "geo-nexus/docs#212" }), submittedAt: "2026-09-01T00:00:00Z" }] },
        });
        const r = resolveStoryVerdict(run, { epic: 212, story: 496, candidates: [{ pr: 501, repo: SLUG, cwd: "/repo" }] });
        expect(r.ok).toBe(true);
        if (!r.ok || !r.found) return;
        expect(r.verdict.pr).toBe(501);
    });

    it("still rejects a qualified receipt that names a different epic number", () => {
        const run = ghRunner({
            501: { state: "OPEN", head: "a".repeat(40), base: "b".repeat(40), reviews: [{ body: block({ epic: "geo-nexus/docs#999" }), submittedAt: "2026-09-01T00:00:00Z" }] },
        });
        const r = resolveStoryVerdict(run, { epic: 212, story: 496, candidates: [{ pr: 501, repo: SLUG, cwd: "/repo" }] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.found).toBe(false);
    });

    it("rejects a receipt that stamps a different epic", () => {
        const run = ghRunner({
            501: { state: "OPEN", head: "a".repeat(40), base: "b".repeat(40), reviews: [{ body: block({ epic: "#999" }), submittedAt: "2026-09-01T00:00:00Z" }] },
        });
        const r = resolveStoryVerdict(run, { epic: 212, story: 496, candidates: [{ pr: 501, repo: SLUG, cwd: "/repo" }] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.found).toBe(false);
    });

    it("rejects a receipt that does not name this story", () => {
        const run = ghRunner({
            501: { state: "OPEN", head: "a".repeat(40), base: "b".repeat(40), reviews: [{ body: block({ stories: "497" }), submittedAt: "2026-09-01T00:00:00Z" }] },
        });
        const r = resolveStoryVerdict(run, { epic: 212, story: 496, candidates: [{ pr: 501, repo: SLUG, cwd: "/repo" }] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.found).toBe(false);
    });

    it("rejects a candidate pull request that is closed and unmerged", () => {
        const run = ghRunner({
            501: { state: "CLOSED", head: "a".repeat(40), base: "b".repeat(40), reviews: [{ body: block({}), submittedAt: "2026-09-01T00:00:00Z" }] },
        });
        const r = resolveStoryVerdict(run, { epic: 212, story: 496, candidates: [{ pr: 501, repo: SLUG, cwd: "/repo" }] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.found).toBe(false);
    });

    it("accepts a merged candidate pull request", () => {
        const run = ghRunner({
            501: { state: "MERGED", head: "a".repeat(40), base: "b".repeat(40), reviews: [{ body: block({}), submittedAt: "2026-09-01T00:00:00Z" }] },
        });
        const r = resolveStoryVerdict(run, { epic: 212, story: 496, candidates: [{ pr: 501, repo: SLUG, cwd: "/repo" }] });
        expect(r.ok).toBe(true);
        if (!r.ok || !r.found) return;
        expect(r.verdict.state).toBe("MERGED");
    });

    it("picks the newest trusted verdict across more than one candidate pull request", () => {
        const run = ghRunner({
            501: { state: "OPEN", head: "a".repeat(40), base: "b".repeat(40), reviews: [{ body: block({ head: "a".repeat(40) }), submittedAt: "2026-09-01T00:00:00Z" }] },
            502: { state: "OPEN", head: "c".repeat(40), base: "b".repeat(40), reviews: [{ body: block({ head: "c".repeat(40) }), submittedAt: "2026-09-05T00:00:00Z" }] },
        });
        const r = resolveStoryVerdict(run, {
            epic: 212,
            story: 496,
            candidates: [
                { pr: 501, repo: SLUG, cwd: "/repo" },
                { pr: 502, repo: SLUG, cwd: "/repo" },
            ],
        });
        expect(r.ok).toBe(true);
        if (!r.ok || !r.found) return;
        expect(r.verdict.pr).toBe(502);
    });

    it("rejects a verdict stamping a different repository than the one queried", () => {
        const run = ghRunner({
            501: { state: "OPEN", head: "a".repeat(40), base: "b".repeat(40), reviews: [{ body: block({ repo: "other/repo" }), submittedAt: "2026-09-01T00:00:00Z" }] },
        });
        const r = resolveStoryVerdict(run, { epic: 212, story: 496, candidates: [{ pr: 501, repo: SLUG, cwd: "/repo" }] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.found).toBe(false);
    });

    it("accepts a verdict whose repository stamp carries the host the conformance gate writes (epic #747)", () => {
        // The gate stamps `github.com/<owner>/<repo>`; this reader asks about `<owner>/<repo>`.
        // The two forms name one repository, so the published verdict counts as this story's.
        const run = ghRunner({
            501: {
                state: "MERGED",
                head: "a".repeat(40),
                base: "b".repeat(40),
                reviews: [{ body: block({ repo: "github.com/acme/widget" }), submittedAt: "2026-09-01T00:00:00Z" }],
            },
        });
        const r = resolveStoryVerdict(run, { epic: 212, story: 496, candidates: [{ pr: 501, repo: SLUG, cwd: "/repo" }] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.found).toBe(true);
        if (!r.found) return;
        expect(r.verdict.pr).toBe(501);
    });

    it("accepts a verdict whose repository stamp is written bare (epic #747)", () => {
        const run = ghRunner({
            501: {
                state: "MERGED",
                head: "a".repeat(40),
                base: "b".repeat(40),
                reviews: [{ body: block({ repo: "acme/widget" }), submittedAt: "2026-09-01T00:00:00Z" }],
            },
        });
        const r = resolveStoryVerdict(run, { epic: 212, story: 496, candidates: [{ pr: 501, repo: SLUG, cwd: "/repo" }] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.found).toBe(true);
        if (!r.found) return;
        expect(r.verdict.pr).toBe(501);
    });

    it("still rejects another repository stamped in the host-qualified form (epic #747)", () => {
        const run = ghRunner({
            501: {
                state: "MERGED",
                head: "a".repeat(40),
                base: "b".repeat(40),
                reviews: [{ body: block({ repo: "github.com/acme/other" }), submittedAt: "2026-09-01T00:00:00Z" }],
            },
        });
        const r = resolveStoryVerdict(run, { epic: 212, story: 496, candidates: [{ pr: 501, repo: SLUG, cwd: "/repo" }] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.found).toBe(false);
    });

    it("keeps every merged candidate as a survivor even when a newer one is chosen as the story's verdict (invariant 3)", () => {
        const run = ghRunner({
            501: { state: "MERGED", head: "a".repeat(40), base: "b".repeat(40), reviews: [{ body: block({ head: "a".repeat(40) }), submittedAt: "2026-09-01T00:00:00Z" }] },
            502: { state: "MERGED", head: "c".repeat(40), base: "b".repeat(40), reviews: [{ body: block({ head: "c".repeat(40) }), submittedAt: "2026-09-05T00:00:00Z" }] },
        });
        const r = resolveStoryVerdict(run, {
            epic: 212,
            story: 496,
            candidates: [
                { pr: 501, repo: SLUG, cwd: "/repo" },
                { pr: 502, repo: SLUG, cwd: "/repo" },
            ],
        });
        expect(r.ok).toBe(true);
        if (!r.ok || !r.found) return;
        expect(r.verdict.pr).toBe(502);
        expect(r.survivors.map((v) => v.pr).sort()).toEqual([501, 502]);
    });

    it("resolves a story's verdict from a candidate in a second declared repository, queried at its own checkout (invariants 6, 9, 11)", () => {
        const MEMBER_SLUG = { owner: "acme", repo: "member-app" };
        const run: Runner = (cmd, args, opts) => {
            if (cmd === "gh" && args[0] === "pr" && args[1] === "view") {
                const n = Number(args[2]);
                if (n === 501 && opts.cwd === "/hub") {
                    // The hub carries an unrelated PR 501 with no trusted receipt for this story.
                    return { status: 0, stdout: JSON.stringify({ state: "OPEN", headRefOid: "d".repeat(40), baseRefOid: "b".repeat(40), reviews: [], comments: [] }), stderr: "" };
                }
                if (n === 501 && opts.cwd === "/member") {
                    return {
                        status: 0,
                        stdout: JSON.stringify({
                            state: "OPEN",
                            headRefOid: "a".repeat(40),
                            baseRefOid: "b".repeat(40),
                            reviews: [{ body: block({ repo: "acme/member-app" }), submittedAt: "2026-09-01T00:00:00Z" }],
                            comments: [],
                        }),
                        stderr: "",
                    };
                }
                return { status: 1, stdout: "", stderr: "not found" };
            }
            return { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
        };

        const r = resolveStoryVerdict(run, {
            epic: 212,
            story: 496,
            candidates: [
                { pr: 501, repo: SLUG, cwd: "/hub" },
                { pr: 501, repo: MEMBER_SLUG, cwd: "/member" },
            ],
        });
        expect(r.ok).toBe(true);
        if (!r.ok || !r.found) return;
        expect(r.verdict.repo).toBe("acme/member-app");
        expect(r.verdict.head).toBe("a".repeat(40));
    });
});

describe("resolveStoryVerdict on the live two-verdict pull request (epic #747)", () => {
    // The epic-wide reader is one of the readers that could have reported the older verdict's
    // counts, so it is run against the pinned payload before anything about ranking changes.
    it("selects the verdict GitHub timestamped later, not the one returned last", () => {
        const run: Runner = (cmd, args) =>
            cmd === "gh" && args[0] === "pr" && args[1] === "view"
                ? { status: 0, stdout: JSON.stringify(twoVerdictPrPayload()), stderr: "" }
                : { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
        const r = resolveStoryVerdict(run, {
            epic: TWO_VERDICT_EPIC,
            story: TWO_VERDICT_STORY,
            candidates: [{ pr: TWO_VERDICT_PR, repo: { owner: "geo-nexus", repo: "giccp" }, cwd: "/repo" }],
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.found).toBe(true);
        if (!r.found) return;
        expect(r.verdict.receipt.findings["high"]).toBe(0);
        expect(r.verdict.receipt.nexusVersion).toBeNull();
    });
});

describe("resolveStoryVerdict — a verdict's story numbers resolve against the repository it names (epic #751)", () => {
    const head = "a".repeat(40);
    const HUB = { owner: "geo-nexus", repo: "docs" };
    const CODE = { owner: "geo-nexus", repo: "giccp" };

    const pr = (body: string) => ({
        state: "OPEN",
        head,
        base: "b".repeat(40),
        reviews: [{ body, submittedAt: "2026-09-16T02:00:00Z" }],
    });

    it("matches the story of the repository the verdict names, not the one that merely shares the number", () => {
        // #117 exists in both repositories. The verdict says which one it means.
        const run = ghRunner({ 665: pr(block({ epic: "#114", stories: "117", repo: "geo-nexus/giccp", issuesRepo: "geo-nexus/docs" })) });
        const r = resolveStoryVerdict(run, {
            epic: 114,
            story: 117,
            candidates: [{ pr: 665, repo: CODE, cwd: "/code" }],
            issuesRepo: "geo-nexus/docs",
        });
        expect(r.ok).toBe(true);
        if (!r.ok || !r.found) throw new Error("expected the verdict to be found");
        expect(r.verdict.pr).toBe(665);
    });

    it("drops the verdict whose numbers belong to the other repository, rather than cross-matching", () => {
        const run = ghRunner({ 665: pr(block({ epic: "#114", stories: "117", repo: "geo-nexus/giccp" })) });
        const r = resolveStoryVerdict(run, {
            epic: 114,
            story: 117,
            candidates: [{ pr: 665, repo: CODE, cwd: "/code" }],
            issuesRepo: "geo-nexus/docs",
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.found).toBe(false);
    });

    it("names the dropped candidate, so 'no verdict' and 'verdict rejected' are never the same report", () => {
        const run = ghRunner({ 665: pr(block({ epic: "#114", stories: "117", repo: "geo-nexus/giccp" })) });
        const r = resolveStoryVerdict(run, {
            epic: 114,
            story: 117,
            candidates: [{ pr: 665, repo: CODE, cwd: "/code" }],
            issuesRepo: "geo-nexus/docs",
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.rejected).toEqual([{ pr: 665, repo: "geo-nexus/giccp", issuesRepo: "geo-nexus/giccp" }]);
    });

    it("accepts a key-less verdict whose code repository is the repository the reader is asking about", () => {
        // Every verdict published before this change omits the key, legitimately: its issues and
        // its code live in one repository.
        const run = ghRunner({ 665: pr(block({ epic: "#114", stories: "117", repo: "geo-nexus/docs" })) });
        const r = resolveStoryVerdict(run, {
            epic: 114,
            story: 117,
            candidates: [{ pr: 665, repo: HUB, cwd: "/hub" }],
            issuesRepo: "geo-nexus/docs",
        });
        expect(r.ok).toBe(true);
        if (!r.ok || !r.found) throw new Error("expected the verdict to be found");
        expect(r.rejected).toEqual([]);
    });

    it("accepts every verdict when the reader does not know which repository the numbers belong to", () => {
        const run = ghRunner({ 665: pr(block({ epic: "#114", stories: "117", repo: "geo-nexus/giccp" })) });
        const r = resolveStoryVerdict(run, {
            epic: 114,
            story: 117,
            candidates: [{ pr: 665, repo: CODE, cwd: "/code" }],
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.found).toBe(true);
    });

    it("runs the comparison with the other trust checks, before newest-wins", () => {
        const run = ghRunner({
            665: {
                state: "OPEN",
                head,
                base: "b".repeat(40),
                reviews: [
                    { body: block({ epic: "#114", stories: "117", repo: "geo-nexus/giccp", issuesRepo: "geo-nexus/docs", findings: "1" }), submittedAt: "2026-09-16T02:44:11Z" },
                    { body: block({ epic: "#114", stories: "117", repo: "geo-nexus/giccp", issuesRepo: "someone-else/docs", findings: "9" }), submittedAt: "2026-09-16T02:59:56Z" },
                ],
            },
        });
        const r = resolveStoryVerdict(run, {
            epic: 114,
            story: 117,
            candidates: [{ pr: 665, repo: CODE, cwd: "/code" }],
            issuesRepo: "geo-nexus/docs",
        });
        expect(r.ok).toBe(true);
        if (!r.ok || !r.found) throw new Error("expected the older, trusted verdict to be found");
        expect(r.verdict.receipt.findings["medium"]).toBe(1);
    });
});
