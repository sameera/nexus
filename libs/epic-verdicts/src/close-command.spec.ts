/**
 * `nexus close`, the gates and the worktree step (epic #830, story #864, decision record #872:
 * D1, D3; G1, G3–G8; preserving G43–G46 and G49).
 *
 * Every platform read is a stand-in, so these specs read what a lead sees — the stop blocks, the
 * report and the exit outcome — and what was created, never how a gate is computed. The worktree
 * stand-in records whether it was called: that is the "nothing written before a stop" check (G3).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type IssueFacts } from "@nexus/epic-resolve/gh";
import { type PrInfo } from "@nexus/pr-worktree/pr";
import { type CloseRanges, type StoryState } from "./close-ranges.js";
import { TWO_VERDICT_PR, TWO_VERDICT_REPO, twoVerdictPrPayload, verdictBody } from "@nexus/pr-acceptance/verdict-fixtures";
import { renderJudgmentsBlock } from "@nexus/pr-acceptance/judgments-block";
import { type CloseCommandDeps, type CloseInput, type CloseVerdictRead, closeCommandDeps, renderCloseOutcome, runCloseCommand } from "./close-command.js";
import { type Runner } from "./run.js";

const tmp: string[] = [];
afterEach(() => {
    for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function makeDir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-close-cmd-"));
    tmp.push(d);
    return d;
}

const ISSUES = "acme/app";
const EPIC = 830;
const PR = 901;
const RECORD = 872;
const EPIC_MD = `---\nepic: "Close becomes a deterministic subcommand"\nslug: close-deterministic-subcommand\nlink: "#${EPIC}"\nrecord: "#${RECORD}"\n---\n\n# Epic\n`;

function prInfo(over: Partial<PrInfo> = {}): PrInfo {
    return {
        number: PR,
        state: "MERGED",
        merged: true,
        mergedAt: "2026-10-03T10:00:00Z",
        base: "b".repeat(40),
        head: "h".repeat(40),
        mergeCommitOid: "m".repeat(40),
        commitCount: 2,
        headRef: "feat/864-close",
        url: `https://github.com/${ISSUES}/pull/${PR}`,
        crossRepo: false,
        authorLogin: "dev",
        body: "Closes #864",
        closingIssues: [864],
        commitMessages: [],
        ...over,
    };
}

function facts(state: "OPEN" | "CLOSED"): IssueFacts {
    return { exists: true, parent: EPIC, issueType: null, labels: [], state, stateReason: state === "CLOSED" ? "COMPLETED" : "" };
}

function currentStates(stories: number[]): StoryState[] {
    return stories.map((story) => ({ story, state: "current", findings: [] }));
}

function ranges(over: Partial<CloseRanges> = {}): CloseRanges {
    const states = over.states ?? currentStates([864, 865]);
    return {
        stories: [
            { story: 864, ranges: [{ repo: ISSUES, pr: PR, source: "derived", base: "b".repeat(40), head: "m".repeat(40), checkout: "/repo" }] },
            { story: 865, ranges: [{ repo: ISSUES, pr: PR, source: "derived", base: "b".repeat(40), head: "m".repeat(40), checkout: "/repo" }] },
        ],
        range: [{ repo: ISSUES, pr: PR, base: "b".repeat(40), head: "m".repeat(40) }],
        landed: [],
        blocking: [],
        excluded: [],
        ok: true,
        states,
        closable: true,
        waivers: [],
        lines: [],
        ...over,
    };
}

interface Harness {
    deps: CloseCommandDeps;
    worktreeCalls: number;
    wtPath: string;
    repoRoot: string;
}

/** Every read succeeds and every gate passes, unless a spec overrides one dep. */
function harness(over: Partial<CloseCommandDeps> = {}): Harness {
    const repoRoot = makeDir();
    const wtPath = makeDir();
    const h: Harness = { deps: {} as CloseCommandDeps, worktreeCalls: 0, wtPath, repoRoot };
    h.deps = {
        role: () => ({ ok: true, preflight: { role: "single-repo", repoRoot, repo: { identity: ISSUES, source: "origin" } as never } }),
        readPr: () => ({ ok: true, pr: prInfo() }),
        issuesRepo: () => ({ ok: true, repos: { issuesRepo: ISSUES, repo: ISSUES } }),
        storiesOfPr: () => ({ ok: true, epic: EPIC, stories: [864] }),
        resolveEpic: () => ({
            ok: true,
            markdown: EPIC_MD,
            record: { number: RECORD, state: "closed" },
            resolved: {
                number: EPIC,
                title: "Close becomes a deterministic subcommand",
                stories: [
                    { number: 864, title: "a", body: "" },
                    { number: 865, title: "b", body: "" },
                ],
                blockedBy: new Map(),
                issuesRepo: ISSUES,
            },
        }),
        subIssues: () => ({ ok: true, facts: new Map([[864, facts("CLOSED")], [865, facts("CLOSED")], [RECORD, facts("CLOSED")]]) }),
        excludedStories: () => [],
        ranges: () => ({ ok: true, ranges: ranges(), untrusted: [] }),
        verdict: () => ({ ok: true, found: true, critical: 0, high: 0, judgments: "present" }),
        trunkCheck: () => ({ ok: true }),
        openWorktree: (_root, epic, date) => {
            h.worktreeCalls += 1;
            return { ok: true, wtPath, branch: `distill/${date}-epic-${epic}`, source: "new" };
        },
        ...over,
    };
    return h;
}

function input(h: Harness, over: Partial<CloseInput> = {}): CloseInput {
    return { cwd: h.repoRoot, pr: PR, entryPath: null, handoff: null, date: "2026-10-04", ...over };
}

function text(lines: string[]): string {
    return lines.join("\n");
}

describe("nexus close — a merged pull request whose every story is current (AC1, G1)", () => {
    it("passes every gate, opens the distill worktree and creates the epic's queue entry, asking nothing", () => {
        const h = harness();
        const out = runCloseCommand(h.deps, input(h));
        expect(out.ok).toBe(true);
        const rendered = renderCloseOutcome(out);
        expect(rendered.exitCode).toBe(0);
        expect(text(rendered.stdout)).toContain(`epic ${ISSUES}#${EPIC} passed every gate`);
        expect(text(rendered.stdout)).toContain("distill/2026-10-04-epic-830");
        expect(fs.readFileSync(path.join(h.wtPath, ".nexus", "queue", `epic-${EPIC}`, "epic.md"), "utf8")).toBe(EPIC_MD);
        expect(text(rendered.stdout)).toMatch(/born at close/);
        expect(rendered.stderr).toEqual([]);
    });

    it("names the issues repository it resolved (G46)", () => {
        const h = harness();
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h)));
        expect(text(rendered.stdout)).toContain(ISSUES);
    });

    it("states each waiver it applied, with its author", () => {
        const h = harness({
            ranges: () => ({
                ok: true,
                untrusted: [],
                ranges: ranges({
                    waivers: [
                        {
                            repo: ISSUES,
                            pr: PR,
                            author: "lead",
                            url: "https://example.test/c/1",
                            at: "2026-10-03T11:00:00Z",
                            reason: null,
                            stories: [864],
                            cause: "record-revised",
                            record: RECORD,
                            digest: "d".repeat(64),
                        },
                    ],
                }),
            }),
        });
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h)));
        expect(rendered.exitCode).toBe(0);
        expect(text(rendered.stdout)).toContain("@lead");
        expect(text(rendered.stdout)).toContain("record-revised");
    });
});

describe("nexus close — an epic with no committed queue entry (AC4, G45)", () => {
    it("leaves committed scratch where it is and adds the materialized epic beside it", () => {
        const h = harness();
        const scratch = path.join(h.wtPath, ".nexus", "queue", `epic-${EPIC}`, "dev");
        fs.mkdirSync(scratch, { recursive: true });
        fs.writeFileSync(path.join(scratch, "notes-feat.md"), "notes\n");
        const out = runCloseCommand(h.deps, input(h));
        expect(out.ok).toBe(true);
        expect(fs.readFileSync(path.join(scratch, "notes-feat.md"), "utf8")).toBe("notes\n");
        expect(fs.existsSync(path.join(h.wtPath, ".nexus", "queue", `epic-${EPIC}`, "epic.md"))).toBe(true);
    });

    it("uses a committed old-contract entry as is and creates nothing", () => {
        const h = harness();
        const entry = path.join(h.wtPath, ".nexus", "queue", "2026-09-01-close-deterministic-subcommand");
        fs.mkdirSync(entry, { recursive: true });
        fs.writeFileSync(path.join(entry, "epic.md"), `---\nlink: "#${EPIC}"\n---\nold contract\n`);
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h)));
        expect(rendered.exitCode).toBe(0);
        expect(fs.readFileSync(path.join(entry, "epic.md"), "utf8")).toContain("old contract");
        expect(fs.existsSync(path.join(h.wtPath, ".nexus", "queue", `epic-${EPIC}`))).toBe(false);
        expect(text(rendered.stdout)).toContain("2026-09-01-close-deterministic-subcommand");
        expect(text(rendered.stdout)).toMatch(/committed/);
    });

    it("re-roots an entry path given on the command line into the worktree", () => {
        const h = harness();
        const rel = path.join(".nexus", "queue", "old-entry", "epic.md");
        for (const root of [h.repoRoot, h.wtPath]) {
            fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
            fs.writeFileSync(path.join(root, rel), `---\nlink: "#${EPIC}"\n---\n`);
        }
        let asked = false;
        h.deps.storiesOfPr = () => {
            asked = true;
            return { ok: true, epic: 1, stories: [] };
        };
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h, { entryPath: path.join(h.repoRoot, rel) })));
        expect(rendered.exitCode).toBe(0);
        expect(asked).toBe(false);
        expect(text(rendered.stdout)).toContain(path.join(h.wtPath, ".nexus", "queue", "old-entry"));
    });

    it("reuses the entry an earlier run created on the reused branch", () => {
        const h = harness({
            openWorktree: () => ({ ok: true, wtPath: h.wtPath, branch: "distill/2026-10-03-epic-830", source: "local" }),
        });
        const dir = path.join(h.wtPath, ".nexus", "queue", `epic-${EPIC}`);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "epic.md"), "earlier run\n");
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h)));
        expect(rendered.exitCode).toBe(0);
        expect(fs.readFileSync(path.join(dir, "epic.md"), "utf8")).toBe("earlier run\n");
        expect(text(rendered.stdout)).toContain("distill/2026-10-03-epic-830");
        expect(text(rendered.stdout)).toMatch(/reused/);
    });
});

/** A stop: exit 1, one block per stop naming reason, item and remedy, and nothing created (G3, G4). */
function expectStop(h: Harness, out: ReturnType<typeof runCloseCommand>): string {
    expect(out.ok).toBe(false);
    const rendered = renderCloseOutcome(out);
    expect(rendered.exitCode).toBe(1);
    expect(rendered.stdout).toEqual([]);
    const err = text(rendered.stderr);
    expect(err).toMatch(/reason:/);
    expect(err).toMatch(/item:/);
    expect(err).toMatch(/remedy:/);
    expect(h.worktreeCalls).toBe(0);
    expect(fs.readdirSync(h.wtPath)).toEqual([]);
    return err;
}

describe("nexus close — resolve stops (AC2, G5, G44)", () => {
    it("refuses a member checkout and names the hub", () => {
        const h = harness({
            role: () => ({ ok: true, preflight: { role: "member", repoRoot: "/member", repo: { identity: "acme/member", source: "origin" } as never } }),
        });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain("member");
        expect(err).toContain("/member");
        expect(err).toContain("hub");
    });

    it("refuses a pull request that has not merged", () => {
        const h = harness({ readPr: () => ({ ok: true, pr: prInfo({ state: "OPEN", merged: false, mergeCommitOid: null }) }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain(`#${PR}`);
        expect(err).toMatch(/not merged/);
        expect(err).toMatch(/merge it/i);
    });

    it("stops on an ambiguous epic and names the argument that gives the epic", () => {
        const h = harness({
            storiesOfPr: () => ({ ok: false, error: { problem: "story-candidates-multiple-epics", message: "surviving candidates resolve to more than one epic: #1 → epic #2, #3 → epic #4." } }),
        });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toMatch(/more than one epic/);
        expect(err).toContain(`nexus close --pr ${PR} <path`);
    });

    it("stops when the entry path names no epic issue", () => {
        const h = harness();
        const bad = path.join(h.repoRoot, "epic.md");
        fs.writeFileSync(bad, "---\nepic: x\n---\n");
        const err = expectStop(h, runCloseCommand(h.deps, input(h, { entryPath: bad })));
        expect(err).toContain(bad);
        expect(err).toMatch(/link/);
    });
});

describe("nexus close — gate stops (AC2, AC3, G5–G8, G43)", () => {
    it("stops on every open sub-issue with its kind, and never closes one", () => {
        const h = harness({
            subIssues: () => ({ ok: true, facts: new Map([[864, facts("CLOSED")], [865, facts("OPEN")], [RECORD, facts("OPEN")], [999, facts("OPEN")]]) }),
        });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toMatch(/#865.*story/);
        expect(err).toMatch(/#872.*decision record/);
        expect(err).toMatch(/approv/);
        expect(err).toMatch(/#999/);
        expect(err).toMatch(/detach/);
    });

    it("reports every failing gate in one pass", () => {
        const h = harness({
            subIssues: () => ({ ok: true, facts: new Map([[865, facts("OPEN")]]) }),
            verdict: () => ({ ok: true, found: true, critical: 1, high: 0, judgments: "present" }),
        });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain("#865");
        expect(err).toMatch(/critical 1/);
    });

    it("stops on a story that is not current: unshipped, never reviewed, unknown, a moved head", () => {
        const states: StoryState[] = [
            { story: 864, state: "unshipped", findings: [{ repo: ISSUES, pr: 905, finding: "open" }] },
            { story: 865, state: "never-reviewed", findings: [{ repo: ISSUES, pr: PR, finding: "no-receipt", remedy: `/nxs.analyze --pr ${PR}` }] },
            { story: 866, state: "unknown", findings: [{ repo: ISSUES, pr: PR, finding: "unreadable", evidence: "receipt", cause: "gh timed out" }] },
            {
                story: 867,
                state: "stale",
                findings: [{ repo: ISSUES, pr: PR, finding: "head-mismatch", analyzedHead: "a".repeat(40), mergedHead: "h".repeat(40), remedies: [`/nxs.analyze --pr ${PR}`] }],
            },
        ];
        const h = harness({ ranges: () => ({ ok: true, untrusted: [], ranges: ranges({ states, closable: false }) }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toMatch(/#864.*unshipped/);
        expect(err).toContain(`${ISSUES}#905`);
        expect(err).toMatch(/#865.*never reviewed/);
        expect(err).toContain(`/nxs.analyze --pr ${PR}`);
        expect(err).toMatch(/#866.*could not be read/);
        expect(err).toMatch(/gh timed out/);
        expect(err).toMatch(/#867.*analyzed head/);
    });

    it("stops on a story no pull request claims and names writing its marker, the only way it passes for now", () => {
        const states: StoryState[] = [{ story: 865, state: "unshipped", findings: [] }];
        const h = harness({ ranges: () => ({ ok: true, untrusted: [], ranges: ranges({ states: [...currentStates([864]), ...states], closable: false }) }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toMatch(/#865.*no pull request claims it/);
        expect(err).toContain("nexus epic-verdicts waive-story --story 865");
    });

    it("lets a story carrying the marker pass", () => {
        const h = harness({
            excludedStories: () => [865],
            ranges: () => ({
                ok: true,
                untrusted: [],
                ranges: ranges({ excluded: [865], states: [...currentStates([864]), { story: 865, state: "excluded", findings: [] }] }),
            }),
        });
        expect(renderCloseOutcome(runCloseCommand(h.deps, input(h))).exitCode).toBe(0);
    });

    it("stops on a revised record with no waiver and prints the exact comment to post (D3)", () => {
        const digest = "e".repeat(64);
        const states: StoryState[] = [
            {
                story: 864,
                state: "stale",
                findings: [{ repo: ISSUES, pr: PR, finding: "record-revised", record: RECORD, stampedDigest: "d".repeat(64), currentDigest: digest, remedies: [] }],
            },
            { story: 865, state: "current", findings: [] },
        ];
        const h = harness({ ranges: () => ({ ok: true, untrusted: [], ranges: ranges({ states, closable: false }) }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toMatch(/revised/);
        expect(err).toContain(`/nxs.analyze --pr ${PR}`);
        expect(err).toContain("<!-- nexus:close-waiver -->");
        expect(err).toContain("waive: record-revised");
        expect(err).toContain(`record: "${ISSUES}#${RECORD}"`);
        expect(err).toContain(`digest: ${digest}`);
    });

    it("stops on a landed-file mismatch with no waiver and prints the comment naming every changed file", () => {
        const states: StoryState[] = [
            { story: 864, state: "stale", findings: [{ repo: ISSUES, pr: PR, finding: "landed-change", files: ["src/a.ts", "src/b.ts"], remedies: [] }] },
            { story: 865, state: "current", findings: [] },
        ];
        const h = harness({ ranges: () => ({ ok: true, untrusted: [], ranges: ranges({ states, closable: false }) }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain("waive: landed-change");
        expect(err).toMatch(/files:\n\s+- src\/a\.ts\n\s+- src\/b\.ts/);
        expect(err).not.toMatch(/landed-change[\s\S]*\/nxs\.analyze/);
    });

    it("names a waiver comment on the pull request that cleared nothing", () => {
        const states: StoryState[] = [
            {
                story: 864,
                state: "stale",
                findings: [
                    {
                        repo: ISSUES,
                        pr: PR,
                        finding: "landed-change",
                        files: ["src/a.ts"],
                        remedies: [],
                        waivers: [{ author: "drive-by", url: "https://example.test/c/9", why: "untrusted" } as never],
                    },
                ],
            },
        ];
        const h = harness({ ranges: () => ({ ok: true, untrusted: [], ranges: ranges({ states, closable: false }) }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain("https://example.test/c/9");
        expect(err).toContain("@drive-by");
    });

    it("stops on a range block, naming the pull request and the fetch", () => {
        const h = harness({
            ranges: () => ({
                ok: true,
                untrusted: [],
                ranges: ranges({
                    ok: false,
                    closable: false,
                    blocking: [{ kind: "checkout-behind", repo: ISSUES, pr: PR, mergeCommit: "m".repeat(40), checkout: "/repo", fetch: "git -C /repo fetch origin" }],
                }),
            }),
        });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain(`${ISSUES}#${PR}`);
        expect(err).toContain("git -C /repo fetch origin");
    });

    it("stops when a story's pull requests cannot be read, never reading it as no pull request", () => {
        const h = harness({ ranges: () => ({ ok: false, problem: "story-read-failed", failures: [{ story: 865, cause: "HTTP 502" }] }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain(`${ISSUES}#865`);
        expect(err).toContain("HTTP 502");
        expect(err).toMatch(/re-run/);
    });

    it("stops when a repository a story merged in has no checkout, naming the expected path", () => {
        const h = harness({
            ranges: () => ({ ok: false, problem: "checkout-missing", missing: [{ repo: "acme/member", expectedPath: "/work/member", problem: "member-checkout-missing", message: "no checkout at /work/member" }] }),
        });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain("acme/member");
        expect(err).toContain("/work/member");
    });

    it("stops on open critical or high items and names answering on the pull request, then the analyze run that records answers (G7)", () => {
        const h = harness({ verdict: () => ({ ok: true, found: true, critical: 0, high: 2, judgments: "present" }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain(`${ISSUES}#${PR}`);
        expect(err).toMatch(/high 2/);
        expect(err).toMatch(/accepted: <reason>/);
        expect(err).toMatch(/waived: <reason>/);
        expect(err).toContain(`/nxs.analyze --pr ${PR} --resolve`);
    });

    it("stops on a verdict with no judgments block and names a full analyze run (G8)", () => {
        const h = harness({ verdict: () => ({ ok: true, found: true, critical: 0, high: 0, judgments: "absent" }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toMatch(/no judgments/);
        expect(err).toContain(`/nxs.analyze --pr ${PR}`);
        expect(err).not.toContain("--resolve");
    });

    it("stops on a verdict whose judgments cannot be read", () => {
        const read: CloseVerdictRead = { ok: true, found: true, critical: 0, high: 0, judgments: "malformed", malformed: "bad base64" };
        const h = harness({ verdict: () => read });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain("bad base64");
    });

    it("stops when a verdict cannot be read", () => {
        const h = harness({ verdict: () => ({ ok: false, cause: "gh pr view failed" }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain("gh pr view failed");
    });

    it("reads each merged pull request's verdict once, however many stories it implements", () => {
        const asked: string[] = [];
        const h = harness({
            verdict: (_root, _issues, pr) => {
                asked.push(`${pr.repo}#${pr.pr}`);
                return { ok: true, found: true, critical: 0, high: 0, judgments: "present" };
            },
        });
        runCloseCommand(h.deps, input(h));
        expect(asked).toEqual([`${ISSUES}#${PR}`]);
    });

    it("stops when the trunk the branch is cut from lacks a merged head", () => {
        const h = harness({ trunkCheck: () => ({ ok: false, error: { problem: "trunk-missing-head", message: "the local trunk is stale. Run 'git fetch origin main' and retry." } }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain("git fetch origin main");
    });
});

describe("nexus close — the worktree step", () => {
    it("stops, with nothing created, when the push remote cannot be read", () => {
        const h = harness({ openWorktree: () => ({ ok: false, error: { problem: "git-failed", message: "the distill branches pushed to origin could not be read" } }) });
        const out = runCloseCommand(h.deps, input(h));
        const rendered = renderCloseOutcome(out);
        expect(rendered.exitCode).toBe(1);
        expect(text(rendered.stderr)).toContain("origin");
        expect(fs.readdirSync(h.wtPath)).toEqual([]);
    });

    it("writes no hand-off note, because this close does not finish its writes yet (G17)", () => {
        const h = harness();
        const note = path.join(h.repoRoot, "handoff.txt");
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h, { handoff: note })));
        expect(rendered.exitCode).toBe(0);
        expect(fs.existsSync(note)).toBe(false);
        expect(text(rendered.stdout)).toMatch(/hand-off note/i);
    });
});

// The verdict read itself, over real verdict bodies through the one trusted reader (G7, G8).
describe("nexus close — reading a merged pull request's verdict", () => {
    function ghRunner(doc: unknown): Runner {
        return (cmd, args) =>
            cmd === "gh" && args[0] === "pr" && args[1] === "view"
                ? { status: 0, stdout: JSON.stringify(doc), stderr: "" }
                : { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
    }
    const read = (doc: unknown): CloseVerdictRead =>
        closeCommandDeps(ghRunner(doc), { singleRepo: () => true }).verdict("/repo", TWO_VERDICT_REPO, { repo: TWO_VERDICT_REPO, pr: TWO_VERDICT_PR });
    const judgments = renderJudgmentsBlock({
        items: [
            {
                id: "DV1",
                kind: "departure",
                found: true,
                severity: "high",
                departsFrom: "G3",
                summary: "x",
                files: [],
                stub: null,
                supersedes: null,
                answer: { verb: "accepted", author: "lead", link: "https://x/1", reason: "by design" },
            },
        ],
        findings: [],
    });

    it("reads the open counts and finds the judgments block", () => {
        expect(read(twoVerdictPrPayload({ newerBody: verdictBody({ high: 0, judgments }) }))).toEqual({ ok: true, found: true, critical: 0, high: 0, judgments: "present" });
    });

    it("reads a verdict published before the judgments block as having none", () => {
        expect(read(twoVerdictPrPayload({ newerBody: verdictBody({ high: 2 }) }))).toEqual({ ok: true, found: true, critical: 0, high: 2, judgments: "absent" });
    });

    it("reads a pull request with no verdict as found: false", () => {
        expect(read({ state: "MERGED", headRefOid: "a".repeat(40), reviews: [], comments: [] })).toEqual({ ok: true, found: false });
    });

    it("reads a failed platform read as a failure, never as no verdict", () => {
        const failing: Runner = () => ({ status: 1, stdout: "", stderr: "HTTP 502" });
        const r = closeCommandDeps(failing, { singleRepo: () => true }).verdict("/repo", TWO_VERDICT_REPO, { repo: TWO_VERDICT_REPO, pr: TWO_VERDICT_PR });
        expect(r.ok).toBe(false);
    });
});
