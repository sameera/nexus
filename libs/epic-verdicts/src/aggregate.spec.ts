import { describe, expect, it } from "vitest";
import { resolveEpicVerdicts } from "./aggregate.js";
import { type Runner } from "./run.js";

const SLUG = { owner: "acme", repo: "widget" };

function block(story: number, pr: number, head: string): string {
    return [
        "<!-- nexus:analyze-receipt -->",
        "```yaml",
        `epic: "#212"`,
        `pr: ${pr}`,
        `date: 2026-09-01`,
        `head: ${head}`,
        `mode: full`,
        `findings: { critical: 0, high: 0, medium: 0, low: 0 }`,
        `stories: [${story}]`,
        "```",
    ].join("\n");
}

function ghRunner(prVerdicts: Record<number, { state: string; head: string; story: number }>): Runner {
    return (cmd, args) => {
        if (cmd === "gh" && args[0] === "pr" && args[1] === "view") {
            const n = Number(args[2]);
            const pr = prVerdicts[n];
            if (!pr) return { status: 1, stdout: "", stderr: "not found" };
            return {
                status: 0,
                stdout: JSON.stringify({
                    state: pr.state,
                    headRefOid: pr.head,
                    baseRefOid: "b".repeat(40),
                    reviews: [{ body: block(pr.story, n, pr.head), submittedAt: "2026-09-01T00:00:00Z" }],
                    comments: [],
                }),
                stderr: "",
            };
        }
        return { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
    };
}

function candidate(pr: number, repo = SLUG, cwd = "/repo"): { pr: number; repo: typeof SLUG; cwd: string } {
    return { pr, repo, cwd };
}

describe("resolveEpicVerdicts — derive the epic receipt from the story verdicts, or stop and name a gap (decision record #505)", () => {
    it("derives an epic receipt when every story carries a verdict", () => {
        const run = ghRunner({
            501: { state: "OPEN", head: "a".repeat(40), story: 496 },
            502: { state: "OPEN", head: "c".repeat(40), story: 497 },
        });
        const r = resolveEpicVerdicts(run, {
            epic: 212,
            stories: [496, 497],
            candidatesByStory: { 496: [candidate(501)], 497: [candidate(502)] },
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.state).toBe("aggregate");
        if (r.state !== "aggregate") return;
        expect(r.receipt.stories.map((s) => s.story)).toEqual([496, 497]);
    });

    it("qualifies the derived receipt's epic reference when issuesRepo is given and differs from the code repo (concept \"Provenance Reference\")", () => {
        const run = ghRunner({ 501: { state: "OPEN", head: "a".repeat(40), story: 496 } });
        const r = resolveEpicVerdicts(run, {
            epic: 212,
            stories: [496],
            candidatesByStory: { 496: [candidate(501)] },
            issuesRepo: "geo-nexus/docs",
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.state).toBe("aggregate");
        if (r.state !== "aggregate") return;
        expect(r.receipt.epic).toBe("geo-nexus/docs#212");
    });

    it("derives an aggregate when every story's verdict stamps the repository in the host-qualified form (epic #747)", () => {
        // Every verdict a shipped epic carries was stamped `github.com/<owner>/<repo>`. Before
        // this epic the derivation dropped all of them and reported that no story was judged.
        const qualified = (story: number, pr: number, head: string): string =>
            block(story, pr, head).replace("mode: full", "mode: full\nrepo: github.com/acme/widget");
        const run: Runner = (cmd, args) => {
            if (cmd === "gh" && args[0] === "pr" && args[1] === "view") {
                const n = Number(args[2]);
                const story = n === 501 ? 496 : 497;
                const head = n === 501 ? "a".repeat(40) : "c".repeat(40);
                return {
                    status: 0,
                    stdout: JSON.stringify({
                        state: "MERGED",
                        headRefOid: head,
                        baseRefOid: "b".repeat(40),
                        reviews: [{ body: qualified(story, n, head), submittedAt: "2026-09-01T00:00:00Z" }],
                        comments: [],
                    }),
                    stderr: "",
                };
            }
            return { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
        };
        const r = resolveEpicVerdicts(run, {
            epic: 212,
            stories: [496, 497],
            candidatesByStory: { 496: [candidate(501)], 497: [candidate(502)] },
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.state).toBe("aggregate");
        if (r.state !== "aggregate") return;
        expect(r.receipt.stories.map((s) => s.story)).toEqual([496, 497]);
    });

    it("stops as partial and names the story with no verdict, without deriving a receipt, when some stories do carry one", () => {
        const run = ghRunner({ 501: { state: "OPEN", head: "a".repeat(40), story: 496 } });
        const r = resolveEpicVerdicts(run, {
            epic: 212,
            stories: [496, 497],
            candidatesByStory: { 496: [candidate(501)], 497: [] },
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.state).toBe("partial");
        if (r.state !== "partial") return;
        expect(r.missing).toEqual([497]);
        expect(r.present).toEqual([496]);
    });

    it("falls back to 'none' — today's full-epic conformance — when not a single story carries a verdict", () => {
        const run = ghRunner({});
        const r = resolveEpicVerdicts(run, {
            epic: 212,
            stories: [496, 497],
            candidatesByStory: { 496: [], 497: [] },
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.state).toBe("none");
    });

    it("excludes a story marked as shipping without its own pull request from the coverage requirement", () => {
        const run = ghRunner({ 501: { state: "OPEN", head: "a".repeat(40), story: 496 } });
        const r = resolveEpicVerdicts(run, {
            epic: 212,
            stories: [496, 497],
            candidatesByStory: { 496: [candidate(501)], 497: [] },
            excludedStories: [497],
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.state).toBe("aggregate");
        if (r.state !== "aggregate") return;
        expect(r.receipt.excluded).toEqual([497]);
        expect(r.receipt.stories.map((s) => s.story)).toEqual([496]);
    });

    it("falls back to 'none' when every non-excluded story carries no verdict", () => {
        const run = ghRunner({});
        const r = resolveEpicVerdicts(run, {
            epic: 212,
            stories: [496, 497],
            candidatesByStory: { 496: [], 497: [] },
            excludedStories: [497],
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.state).toBe("none");
    });

    it("carries every merged candidate into changeSetVerdicts, not just the story's chosen verdict (invariant 3)", () => {
        const run = ghRunner({
            501: { state: "MERGED", head: "a".repeat(40), story: 496 },
            502: { state: "MERGED", head: "c".repeat(40), story: 496 },
        });
        const r = resolveEpicVerdicts(run, {
            epic: 212,
            stories: [496],
            candidatesByStory: { 496: [candidate(501), candidate(502)] },
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.state).toBe("aggregate");
        if (r.state !== "aggregate") return;
        expect(r.verdicts).toHaveLength(1);
        expect(r.changeSetVerdicts.map((v) => v.pr).sort()).toEqual([501, 502]);
    });

    it("derives a verdict from a story whose only candidate lives in a second declared repository (invariant 11)", () => {
        const MEMBER_SLUG = { owner: "acme", repo: "member-app" };
        const run = ghRunner({ 501: { state: "OPEN", head: "a".repeat(40), story: 496 } });
        const r = resolveEpicVerdicts(run, {
            epic: 212,
            stories: [496],
            candidatesByStory: { 496: [candidate(501, MEMBER_SLUG, "/member")] },
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.state).toBe("aggregate");
        if (r.state !== "aggregate") return;
        expect(r.verdicts[0].repo).toBe("acme/member-app");
    });
});

describe("resolveEpicVerdicts — a candidate rejected for its issues repository is named (epic #751)", () => {
    const head = "a".repeat(40);

    /** A verdict published from the member's own repository, with or without the key. */
    function memberPrView(story: number, pr: number, issuesRepo?: string) {
        const body = [
            "<!-- nexus:analyze-receipt -->",
            "```yaml",
            'epic: "#212"',
            ...(issuesRepo === undefined ? [] : [`issues_repo: ${issuesRepo}`]),
            "repo: acme/widget",
            `pr: ${pr}`,
            "date: 2026-09-01",
            `head: ${head}`,
            "mode: full",
            "findings: { critical: 0, high: 0, medium: 0, low: 0 }",
            `stories: [${story}]`,
            "```",
        ].join("\n");
        return {
            state: "OPEN",
            headRefOid: head,
            baseRefOid: "b".repeat(40),
            reviews: [{ body, submittedAt: "2026-09-01T00:00:00Z" }],
            comments: [],
        };
    }

    const runner = (issuesRepo?: string): Runner => (cmd, args) =>
        cmd === "gh" && args[0] === "pr" && args[1] === "view"
            ? { status: 0, stdout: JSON.stringify(memberPrView(496, 501, issuesRepo)), stderr: "" }
            : { status: 1, stdout: "", stderr: "unexpected" };

    it("reports the story as carrying no verdict and names why, rather than leaving the two the same", () => {
        const r = resolveEpicVerdicts(runner("acme/widget"), {
            epic: 212,
            stories: [496],
            candidatesByStory: { 496: [candidate(501)] },
            issuesRepo: "acme/hub",
        });
        expect(r.ok).toBe(true);
        if (!r.ok || r.state !== "none") throw new Error(`expected state none, got ${r.ok ? r.state : "error"}`);
        expect(r.rejected).toEqual([{ story: 496, pr: 501, repo: "acme/widget", issuesRepo: "acme/widget" }]);
    });

    it("accepts a key-less verdict from the member, whose stories live in the hub", () => {
        const r = resolveEpicVerdicts(runner(), {
            epic: 212,
            stories: [496],
            candidatesByStory: { 496: [candidate(501)] },
            issuesRepo: "acme/hub",
        });
        expect(r.ok).toBe(true);
        if (!r.ok || r.state !== "aggregate") throw new Error(`expected an aggregate receipt, got ${r.ok ? r.state : "error"}`);
        expect(r.rejected).toEqual([]);
    });

    it("rejects nothing once the verdict names the repository the epic's stories live in", () => {
        const r = resolveEpicVerdicts(runner("acme/hub"), {
            epic: 212,
            stories: [496],
            candidatesByStory: { 496: [candidate(501)] },
            issuesRepo: "acme/hub",
        });
        expect(r.ok).toBe(true);
        if (!r.ok || r.state !== "aggregate") throw new Error("expected an aggregate receipt");
        expect(r.rejected).toEqual([]);
    });
});
