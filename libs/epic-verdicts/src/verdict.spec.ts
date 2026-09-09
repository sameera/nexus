import { describe, expect, it } from "vitest";
import { resolveStoryVerdict } from "./verdict.js";
import { type Runner } from "./run.js";

const SLUG = { owner: "acme", repo: "widget" };

function block(opts: { epic?: string; stories?: string; repo?: string; head?: string; findings?: string }): string {
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

    it("reports no verdict when no candidate carries a trusted receipt", () => {
        const run = ghRunner({ 501: { state: "OPEN", head: "a".repeat(40), base: "b".repeat(40) } });
        const r = resolveStoryVerdict(run, { epic: 212, story: 496, candidates: [{ pr: 501, repo: SLUG, cwd: "/repo" }] });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.found).toBe(false);
        if (r.found) return;
        expect(r.candidates).toEqual([501]);
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
