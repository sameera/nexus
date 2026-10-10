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
import { TWO_VERDICT_ANALYZED_HEAD, TWO_VERDICT_PR, TWO_VERDICT_RECORD_HASH, TWO_VERDICT_REPO, twoVerdictPrPayload, verdictBody } from "@nexus/pr-acceptance/verdict-fixtures";
import { renderJudgmentsBlock, type Judgments } from "@nexus/pr-acceptance/judgments-block";
import { recordDigest } from "@nexus/record-digest/digest";
import { type CloseCommandDeps, type CloseInput, type CloseVerdictRead, closeCommandDeps, renderCloseOutcome, runCloseCommand } from "./close-command.js";
import { amendmentKey } from "./close-record.js";
import { type StubToFile } from "./close-stubs.js";
import { type Runner } from "./run.js";
import { defaultRunner } from "@nexus/workspace/run";

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
    const range = over.range ?? [{ repo: ISSUES, pr: PR, base: "b".repeat(40), head: "m".repeat(40) }];
    return {
        stories: [
            { story: 864, ranges: [{ repo: ISSUES, pr: PR, source: "derived", base: "b".repeat(40), head: "m".repeat(40), checkout: "/repo" }] },
            { story: 865, ranges: [{ repo: ISSUES, pr: PR, source: "derived", base: "b".repeat(40), head: "m".repeat(40), checkout: "/repo" }] },
        ],
        range,
        merged: range.map((r) => ({ repo: r.repo, pr: r.pr })),
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

/** An approved new-format record body: two decisions, in record order. */
const RECORD_BODY = [
    "# Decision Record: Close becomes a deterministic subcommand",
    "",
    "## How it works",
    "",
    "Close becomes a plain command.",
    "",
    "## Guarantees",
    "",
    "- G1. Close asks nothing. (D1)",
    "",
    "## Design rationale and mechanism",
    "",
    "### Decisions and reasons",
    "",
    "#### D1 — The subcommand is named nexus close",
    "",
    "- **Decision:** The command is `nexus close`.",
    "- **Why:** The stage is called close everywhere.",
    "- **Refuted viable alternative:** `nexus close-epic`, which the script already uses.",
    "- **Delivered by:** #864",
    "",
    "#### D2 — No model fallback",
    "",
    "- **Decision:** A verdict without judgments stops close.",
    "- **Why:** The initiative requires zero model passes.",
    "- **Refuted viable alternative:** none",
    "",
].join("\n");
const RECORD_DIGEST = recordDigest(RECORD_BODY);

function emptyJudgments(over: Partial<Judgments> = {}): Judgments {
    return { items: [], findings: [], deferred: [], keyDecisions: { record: { digest: RECORD_DIGEST, format: "new", decisions: [{ id: "D1" }, { id: "D2" }] }, stubs: [] }, ...over };
}

function present(judgments: Judgments, over: Partial<{ date: string; head: string; recordHash: string | null }> = {}): CloseVerdictRead {
    return { ok: true, found: true, critical: 0, high: 0, judgments: "present", read: judgments, date: "2026-10-03", head: "a".repeat(40), recordHash: RECORD_DIGEST, ...over };
}

interface Harness {
    deps: CloseCommandDeps;
    worktreeCalls: number;
    wtPath: string;
    repoRoot: string;
    commits: { files: string[]; message: string }[];
    posted: { issue: number; body: string }[];
    /** Every batch of stubs handed to the filer. */
    filed: StubToFile[][];
    /** Every write, in the order close made it (G23). */
    writes: string[];
}

/** The comments posted on the record issue: the amendment, never the close comment. */
function amendments(h: Harness): { issue: number; body: string }[] {
    return h.posted.filter((p) => p.issue === RECORD);
}

/** Every read succeeds and every gate passes, unless a spec overrides one dep. */
function harness(over: Partial<CloseCommandDeps> = {}): Harness {
    const repoRoot = makeDir();
    const wtPath = makeDir();
    const h: Harness = { deps: {} as CloseCommandDeps, worktreeCalls: 0, wtPath, repoRoot, commits: [], posted: [], filed: [], writes: [] };
    let nextStub = 1000;
    h.deps = {
        role: () => ({ ok: true, preflight: { role: "single-repo", repoRoot, repo: { identity: ISSUES, source: "origin" } as never } }),
        checkoutForge: () => "github.com",
        readPr: () => ({ ok: true, pr: prInfo() }),
        issuesRepo: () => ({ ok: true, repos: { issuesRepo: ISSUES, repo: ISSUES } }),
        storiesOfPr: () => ({ ok: true, epic: EPIC, stories: [864] }),
        issueKind: (_root, _repo, issue) => ({ ok: true, exists: true, kind: issue === EPIC ? "epic" : "story", parent: issue === EPIC ? null : EPIC }),
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
        verdict: () => present(emptyJudgments()),
        trunkCheck: () => ({ ok: true }),
        findDistillBranch: () => ({ ok: true, branch: null }),
        openWorktree: (_root, epic, date) => {
            h.worktreeCalls += 1;
            return { ok: true, wtPath, branch: `distill/${date}-epic-${epic}`, source: "new" };
        },
        recordBody: () => ({ ok: true, body: RECORD_BODY, digest: RECORD_DIGEST }),
        commitEntry: (_wt, files, message) => {
            h.commits.push({ files, message });
            h.writes.push("commit");
            return { ok: true, committed: true };
        },
        issueComments: () => ({ ok: true, comments: [] }),
        postComment: (_root, _repo, issue, body) => {
            h.posted.push({ issue, body });
            h.writes.push(issue === RECORD ? "amendment" : `comment #${issue}`);
            return { ok: true };
        },
        storyWaivers: () => ({ ok: true, comments: [] }),
        epicMentions: () => ({ ok: true, issues: [] }),
        fileStubs: (_root, _repo, _epic, stubs) => {
            h.filed.push(stubs);
            h.writes.push("stubs");
            return { ok: true, numbers: new Map(stubs.map((s) => [s.key, nextStub++])), notes: [] };
        },
        writeMarker: (_root, _repo, story) => {
            h.writes.push(`marker #${story}`);
            return { ok: true };
        },
        push: () => {
            h.writes.push("push");
            return { ok: true };
        },
        closeIssue: (_root, _repo, issue) => {
            h.writes.push(`close #${issue}`);
            return { ok: true, already: false };
        },
        ...over,
    };
    return h;
}

/** `nexus close --epic <EPIC>` unless a spec names another target. */
function input(h: Harness, over: Partial<CloseInput> = {}): CloseInput {
    return { cwd: h.repoRoot, target: { epic: EPIC }, entryPath: null, handoff: null, date: "2026-10-04", ...over };
}

/** `nexus close --pr <ref>`: a bare number unless a repository is named. */
function viaPr(number: number = PR, repo: string | null = null): Pick<CloseInput, "target"> {
    return { target: { pr: { repo, number } } };
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

    it("names each shipped record it did not read because its author cannot speak for the repository", () => {
        const h = harness({
            ranges: () => ({ ok: true, ranges: ranges(), untrusted: [{ commentId: "c1", key: null, author: "drive-by", authorAssociation: "NONE" }] }),
        });
        const { stdout } = closed(h);
        expect(stdout).toMatch(/cannot speak for[\s\S]*@drive-by \(NONE\)/);
    });

    it("stops on an issues repository it cannot resolve, naming the repository setup and not a missing analysis", () => {
        const h = harness({ issuesRepo: () => ({ ok: false, error: { problem: "issues-repo-mismatch", message: "the configured epic-repo is not this checkout's issues repository" } }) as never });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain("the configured epic-repo is not this checkout's issues repository");
        expect(err).toMatch(/configured epic-repo/);
        expect(err).not.toContain("/nxs.analyze");
    });

    it("asks for the epic in the issues repository when it differs from the code repository (G46)", () => {
        const h = harness({ issuesRepo: () => ({ ok: true, repos: { issuesRepo: ISSUES, repo: "acme/code" } }) });
        const asked: string[] = [];
        const resolve = h.deps.resolveEpic;
        h.deps.resolveEpic = (root, repo, epic) => {
            asked.push(repo);
            return resolve(root, repo, epic);
        };
        runCloseCommand(h.deps, input(h));
        expect(asked).toEqual([ISSUES]);
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
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h, { ...viaPr(), entryPath: path.join(h.repoRoot, rel) })));
        expect(rendered.exitCode).toBe(0);
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
        const err = expectStop(h, runCloseCommand(h.deps, input(h, viaPr())));
        expect(err).toContain(`#${PR}`);
        expect(err).toMatch(/not merged/);
        expect(err).toMatch(/merge it/i);
    });

    it("stops on an ambiguous epic and names the argument that gives the epic", () => {
        const h = harness({
            storiesOfPr: () => ({ ok: false, error: { problem: "story-candidates-multiple-epics", message: "surviving candidates resolve to more than one epic: #1 → epic #2, #3 → epic #4." } }),
        });
        const err = expectStop(h, runCloseCommand(h.deps, input(h, viaPr())));
        expect(err).toMatch(/more than one epic/);
        expect(err).toContain("nexus close --epic <N>");
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

// Issue #906: close takes the epic. `--pr` stays as a shortcut that resolves the pull request to
// its epic, then runs exactly as `--epic` does.
describe("nexus close — keyed by the epic (#906)", () => {
    it("closes the epic it is given without reading any single pull request", () => {
        const h = harness({
            readPr: () => {
                throw new Error("--epic reads no pull request");
            },
            storiesOfPr: () => {
                throw new Error("--epic resolves no epic from a pull request");
            },
        });
        const { stdout } = closed(h);
        expect(stdout).toContain(`epic ${ISSUES}#${EPIC} passed every gate`);
    });

    it("reports every merged pull request the close covers, not one", () => {
        const PR2 = 902;
        const h = harness({
            ranges: () => ({
                ok: true,
                untrusted: [],
                ranges: ranges({
                    range: [
                        { repo: ISSUES, pr: PR, base: "b".repeat(40), head: "m".repeat(40) },
                        { repo: "acme/member", pr: PR2, base: "c".repeat(40), head: "n".repeat(40) },
                    ],
                }),
            }),
        });
        const { stdout } = closed(h);
        expect(stdout).toMatch(new RegExp(`Pull requests:.*${ISSUES}#${PR}.*acme/member#${PR2}`));
    });

    it("takes the epic as owner/repo#N when it names the issues repository, and stops when it names another", () => {
        const ok = harness();
        expect(renderCloseOutcome(runCloseCommand(ok.deps, input(ok, { target: { epic: EPIC, repo: ISSUES.toUpperCase() } }))).exitCode).toBe(0);
        const other = harness();
        const err = expectStop(other, runCloseCommand(other.deps, input(other, { target: { epic: EPIC, repo: "acme/other" } })));
        expect(err).toMatch(/reason: .*acme\/other#830 is not in the issues repository/);
    });

    it("stops, creating nothing, when the number it is given is a story, and names its parent", () => {
        const h = harness();
        const err = expectStop(h, runCloseCommand(h.deps, input(h, { target: { epic: 864 } })));
        expect(err).toMatch(/reason: .*#864.*story/);
        expect(err).toMatch(new RegExp(`reason: .*parent.*${ISSUES}#${EPIC}`));
        // Re-running the same command can never pass, so the remedy names the form to fix it with.
        expect(err).toMatch(/remedy: .*nexus close --epic <N>/);
        expect(h.writes).toEqual([]);
    });

    it("stops, creating nothing, on a top-level issue not filed as an epic, or one that does not exist", () => {
        for (const kind of [{ ok: true, exists: true, kind: "other", parent: null }, { ok: true, exists: false, kind: "other", parent: null }] as const) {
            const h = harness({ issueKind: () => kind });
            const err = expectStop(h, runCloseCommand(h.deps, input(h, { target: { epic: 50 } })));
            expect(err).toMatch(kind.exists ? /reason: .*#50 .*not filed as an epic/ : /reason: .*#50 does not exist/);
            expect(h.writes).toEqual([]);
        }
    });

    it("suggests --pr when the number it is given names no issue, since it may be a pull request", () => {
        // As on GitHub: a number that names no issue has no comments to read either.
        const h = harness({ issueKind: () => ({ ok: true, exists: false, kind: "other", parent: null }), issueComments: () => ({ ok: false, message: "Could not resolve to an Issue" }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h, { target: { epic: 905 } })));
        expect(err).toMatch(/remedy: .*nexus close --pr 905/);
    });

    it("stops on an unmarked top-level issue, naming how to file it as an epic", () => {
        const h = harness({ issueKind: () => ({ ok: true, exists: true, kind: "other", parent: null }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toMatch(/reason: .*not filed as an epic/);
        expect(err).toMatch(/remedy: .*file it as one/);
    });

    it("stops, creating nothing, on this epic's close comment when its machine block does not read", () => {
        const h = harness({ issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === EPIC ? [{ body: `<!-- nexus:close-record -->\nno block`, authorAssociation: "OWNER" }] : [] }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toMatch(/reason: .*machine block does not read/);
        expect(h.writes).toEqual([]);
    });

    it("never takes a quoted close comment as this epic's close", () => {
        const body = `> <!-- nexus:close-record -->\n> \`\`\`yaml\n> epic: "#${EPIC}"\n> \`\`\``;
        const h = harness({ issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === EPIC ? [{ body, authorAssociation: "OWNER" }] : [] }) });
        const { out } = closed(h);
        expect(out.resumed).toBe(false);
    });

    it("finishes its own close comment when epic-repo is configured as a URL or in SSH form", () => {
        const body = `<!-- nexus:close-record -->\n\`\`\`yaml\nepic: "#${EPIC}"\nissues_repo: ${ISSUES}\n\`\`\``;
        for (const configured of [`https://github.com/${ISSUES}`, `git@github.com:${ISSUES}.git`]) {
            const readIn: string[] = [];
            const h = harness({
                issuesRepo: () => ({ ok: true, repos: { issuesRepo: configured, repo: ISSUES } }),
                issueComments: (_r, repo, issue) => {
                    readIn.push(repo);
                    return { ok: true, comments: issue === EPIC ? [{ body, authorAssociation: "OWNER" }] : [] };
                },
                findDistillBranch: () => ({ ok: true, branch: `distill/2026-10-03-epic-${EPIC}`, source: "local" }),
            });
            const out = runCloseCommand(h.deps, input(h));
            expect(out.ok && out.resumed, configured).toBe(true);
            // Every read names the issues repository in its one canonical form.
            expect(new Set(readIn), configured).toEqual(new Set([ISSUES]));
        }
    });

    it("stops, creating nothing, on a close comment that stamps this epic in another issues repository, naming both", () => {
        const body = `<!-- nexus:close-record -->\n\`\`\`yaml\nepic: "#${EPIC}"\nissues_repo: acme/old\n\`\`\``;
        const h = harness({ issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === EPIC ? [{ body, authorAssociation: "OWNER" }] : [] }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toMatch(/reason: .*acme\/old.*acme\/app/);
        expect(h.writes).toEqual([]);
    });

    it("reads a close comment saved with CRLF line endings", () => {
        const body = `<!-- nexus:close-record -->\r\n\`\`\`yaml\r\nepic: "#${EPIC}"\r\n\`\`\``;
        const h = harness({
            issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === EPIC ? [{ body, authorAssociation: "OWNER" }] : [] }),
            findDistillBranch: () => ({ ok: true, branch: `distill/2026-10-03-epic-${EPIC}`, source: "local" }),
        });
        const out = runCloseCommand(h.deps, input(h));
        expect(out.ok && out.resumed).toBe(true);
    });

    it("stops on a newer close comment that does not read rather than resume from an older one", () => {
        const own = { body: `<!-- nexus:close-record -->\n\`\`\`yaml\nepic: "#${EPIC}"\n\`\`\``, authorAssociation: "OWNER" };
        const broken = { body: `<!-- nexus:close-record -->\nhand-edited`, authorAssociation: "OWNER" };
        const h = harness({ issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === EPIC ? [own, broken] : [] }) });
        expect(expectStop(h, runCloseCommand(h.deps, input(h)))).toMatch(/reason: .*does not read/);
    });

    it("names an unread comment list, not a missing epic marking, when the comments cannot be read", () => {
        const h = harness({
            issueKind: () => ({ ok: true, exists: true, kind: "other", parent: null }),
            issueComments: () => ({ ok: false, message: "HTTP 502" }),
        });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain("HTTP 502");
        expect(err).not.toMatch(/not filed as an epic/);
    });

    it("reads its own machine block when the comment quotes another close comment above it", () => {
        const body = `> <!-- nexus:close-record -->\n> quoted\n\n<!-- nexus:close-record -->\n\`\`\`yaml\nepic: "#${EPIC}"\n\`\`\``;
        const h = harness({
            issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === EPIC ? [{ body, authorAssociation: "OWNER" }] : [] }),
            findDistillBranch: () => ({ ok: true, branch: `distill/2026-10-03-epic-${EPIC}`, source: "local" }),
        });
        const out = runCloseCommand(h.deps, input(h));
        expect(out.ok && out.resumed).toBe(true);
    });

    it("does not let a close comment pasted onto a story close that story", () => {
        const body = `<!-- nexus:close-record -->\n\`\`\`yaml\nepic: "#864"\n\`\`\``;
        const h = harness({
            issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === 864 ? [{ body, authorAssociation: "OWNER" }] : [] }),
            findDistillBranch: () => ({ ok: true, branch: "distill/2026-10-03-epic-864", source: "local" }),
        });
        const err = expectStop(h, runCloseCommand(h.deps, input(h, { target: { epic: 864 } })));
        expect(err).toMatch(/reason: .*#864 .*story/);
        expect(h.writes).toEqual([]);
    });

    it("stops when the entry path links the same number in another repository", () => {
        const h = harness();
        const entry = path.join(h.repoRoot, "epic.md");
        fs.writeFileSync(entry, `---\nlink: "acme/api#${EPIC}"\n---\n`);
        expect(expectStop(h, runCloseCommand(h.deps, input(h, { entryPath: entry })))).toMatch(/reason: .*acme\/api#830/);
    });

    it("answers that a pull request has not merged before it reads the entry path", () => {
        const h = harness({ readPr: () => ({ ok: true, pr: prInfo({ state: "OPEN", merged: false, mergeCommitOid: null }) }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h, { ...viaPr(), entryPath: path.join(h.repoRoot, "missing.md") })));
        expect(err).toMatch(/not merged/);
        expect(err).not.toMatch(/cannot be read/);
    });
    it("finishes from an older close comment of this epic when a newer one quotes another epic's", () => {
        const own = { body: `<!-- nexus:close-record -->\n\`\`\`yaml\nepic: "#${EPIC}"\n\`\`\``, authorAssociation: "OWNER" };
        const quoted = { body: `<!-- nexus:close-record -->\n\`\`\`yaml\nepic: "#99"\n\`\`\``, authorAssociation: "OWNER" };
        const h = harness({
            issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === EPIC ? [own, quoted] : [] }),
            findDistillBranch: () => ({ ok: true, branch: `distill/2026-10-03-epic-${EPIC}`, source: "local" }),
        });
        const out = runCloseCommand(h.deps, input(h));
        expect(out.ok && out.resumed).toBe(true);
        expect(h.writes).toEqual([`close #${EPIC}`]);
    });

    it("does not take a close comment that stamps another epic as this epic's earlier close", () => {
        const quoted = { body: `<!-- nexus:close-record -->\n\`\`\`yaml\nepic: "#99"\n\`\`\``, authorAssociation: "OWNER" };
        const h = harness({ issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === EPIC ? [quoted] : [] }) });
        const { out } = closed(h);
        expect(out.resumed).toBe(false);
    });

    it("takes the story ladder's check of the epic a pull request led to, with no second read", () => {
        let asked = 0;
        const h = harness({
            issueKind: () => {
                asked += 1;
                return { ok: true, exists: true, kind: "epic", parent: null };
            },
        });
        closed(h, viaPr());
        expect(asked).toBe(0);
    });

    it("closes a manually managed epic with no sub-issues, as on main, and says so", () => {
        const h = harness({ subIssues: () => ({ ok: true, facts: new Map() }) });
        const resolve = h.deps.resolveEpic;
        h.deps.resolveEpic = (root, repo, epic) => {
            const r = resolve(root, repo, epic);
            return r.ok ? { ...r, record: null, resolved: { ...r.resolved, stories: [] } } : r;
        };
        h.deps.ranges = () => ({ ok: true, untrusted: [], ranges: ranges({ stories: [], states: [], range: [], merged: [] }) });
        const { stdout } = closed(h);
        expect(stdout).toContain("no sub-issues");
    });

    it("closes an epic whose every story passed on a marker, with no merged pull request", () => {
        const h = harness({ excludedStories: () => [864, 865] });
        h.deps.ranges = () => ({
            ok: true,
            untrusted: [],
            ranges: ranges({ stories: [], range: [], merged: [], excluded: [864, 865], states: [{ story: 864, state: "excluded", findings: [] }, { story: 865, state: "excluded", findings: [] }] }),
        });
        expect(renderCloseOutcome(runCloseCommand(h.deps, input(h))).exitCode).toBe(0);
    });

    it("passes over a close-comment template whose epic is left unfilled", () => {
        const template = { body: `<!-- nexus:close-record -->\n\`\`\`yaml\nepic: "#<epic-issue>"\n\`\`\``, authorAssociation: "OWNER" };
        const h = harness({ issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === EPIC ? [template] : [] }) });
        const { out } = closed(h);
        expect(out.resumed).toBe(false);
    });

    it("checks the number it is given is an epic before it finishes a close comment that stamps another epic", () => {
        // A close comment quoted onto a story: it stamps the epic it was written for, not this issue.
        const earlier = { body: `<!-- nexus:close-record -->\n\`\`\`yaml\nepic: "#${EPIC}"\n\`\`\``, authorAssociation: "OWNER" };
        const h = harness({
            issueComments: () => ({ ok: true, comments: [earlier] }),
            findDistillBranch: () => ({ ok: true, branch: "distill/2026-10-03-epic-864", source: "local" }),
        });
        const err = expectStop(h, runCloseCommand(h.deps, input(h, { target: { epic: 864 } })));
        expect(err).toContain("not an epic");
        expect(h.writes).toEqual([]);
    });

    it("finishes a close comment of an epic filed under an initiative that has since lost its epic marking", () => {
        const earlier = { body: `<!-- nexus:close-record -->\n\`\`\`yaml\nepic: "#${EPIC}"\n\`\`\``, authorAssociation: "OWNER" };
        const h = harness({
            issueKind: () => ({ ok: true, exists: true, kind: "other", parent: 491 }),
            issueComments: () => ({ ok: true, comments: [earlier] }),
            findDistillBranch: () => ({ ok: true, branch: `distill/2026-10-03-epic-${EPIC}`, source: "local" }),
        });
        expect(renderCloseOutcome(runCloseCommand(h.deps, input(h))).exitCode).toBe(0);
    });

    it("names a story as not an epic before it names an unreadable close comment pasted on it", () => {
        const h = harness({ issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === 864 ? [{ body: `<!-- nexus:close-record -->\nbroken`, authorAssociation: "OWNER" }] : [] }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h, { target: { epic: 864 } })));
        expect(err).toMatch(/reason: .*#864 .*story/);
        expect(err).not.toMatch(/does not read/);
    });

    it("finds an amendment an earlier run keyed with the issues repository in another written form", () => {
        const amended = { body: `x\n${amendmentKey(`github.com/${ISSUES}`, EPIC)}`, authorAssociation: "OWNER" };
        const h = harness({
            verdict: () => present(emptyJudgments({ items: [departure("DV1", { supersedes: { decision: "D2", instead: "x" } })] })),
            issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === RECORD ? [amended] : [] }),
        });
        closed(h);
        expect(amendments(h)).toEqual([]);
    });

    it("finishes its own close comment when what the epic is filed as cannot be read", () => {
        const earlier = { body: `<!-- nexus:close-record -->\n\`\`\`yaml\nepic: "#${EPIC}"\n\`\`\``, authorAssociation: "OWNER" };
        const h = harness({
            issueKind: () => ({ ok: false, message: "classification-mode-mismatch" }),
            issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === EPIC ? [earlier] : [] }),
            findDistillBranch: () => ({ ok: true, branch: `distill/2026-10-03-epic-${EPIC}`, source: "local" }),
        });
        const out = runCloseCommand(h.deps, input(h));
        expect(out.ok && out.resumed).toBe(true);
    });

    it("names both causes when the comments and what the epic is filed as both fail to read", () => {
        const h = harness({ issueKind: () => ({ ok: false, message: "classification-mode-mismatch" }), issueComments: () => ({ ok: false, message: "HTTP 502" }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain("HTTP 502");
        expect(err).toContain("classification-mode-mismatch");
    });

    it("finds an amendment and a stub an earlier run keyed with epic-repo as configured", () => {
        const configured = `https://github.com/${ISSUES}`;
        const amended = { body: `x\n${amendmentKey(configured, EPIC)}`, authorAssociation: "OWNER" };
        const h = harness({
            issuesRepo: () => ({ ok: true, repos: { issuesRepo: configured, repo: ISSUES } }),
            verdict: () => present(emptyJudgments({ items: [departure("DV1", { supersedes: { decision: "D2", instead: "x" } })] })),
            issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === RECORD ? [amended] : [] }),
        });
        closed(h);
        expect(amendments(h)).toEqual([]);
    });

    it("names an unreadable close comment before asking how the issue is filed", () => {
        const h = harness({
            issueKind: () => ({ ok: true, exists: true, kind: "other", parent: null }),
            issueComments: () => ({ ok: true, comments: [{ body: `<!-- nexus:close-record -->\nbroken`, authorAssociation: "OWNER" }] }),
        });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toMatch(/reason: .*does not read/);
        expect(err).not.toMatch(/not filed as an epic/);
    });

    it("reads an entry path saved with CRLF line endings", () => {
        const h = harness();
        const entry = path.join(h.repoRoot, "epic.md");
        fs.writeFileSync(entry, `---\r\nlink: "#${EPIC}"\r\n---\r\n`);
        expect(renderCloseOutcome(runCloseCommand(h.deps, input(h, { entryPath: entry }))).exitCode).toBe(0);
    });

    it("finishes a close comment that stamps this epic though the issue has since lost its epic marking", () => {
        const earlier = { body: `<!-- nexus:close-record -->\n\`\`\`yaml\nepic: "#${EPIC}"\n\`\`\``, authorAssociation: "OWNER" };
        const h = harness({
            issueKind: () => ({ ok: true, exists: true, kind: "other", parent: null }),
            issueComments: () => ({ ok: true, comments: [earlier] }),
            findDistillBranch: () => ({ ok: true, branch: `distill/2026-10-03-epic-${EPIC}`, source: "local" }),
        });
        expect(renderCloseOutcome(runCloseCommand(h.deps, input(h))).exitCode).toBe(0);
        expect(h.writes).toEqual([`close #${EPIC}`]);
    });

    it("stops, creating nothing, when what the number is filed as cannot be determined", () => {
        const h = harness({ issueKind: () => ({ ok: false, message: "HTTP 502" }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain("HTTP 502");
        expect(err).toContain(`re-run nexus close --epic ${EPIC}`);
        expect(h.writes).toEqual([]);
    });

    it("with --pr, stops when the entry path links a different epic than the pull request's own", () => {
        const h = harness();
        const entry = path.join(h.repoRoot, "epic.md");
        fs.writeFileSync(entry, `---\nlink: "#${EPIC + 1}"\n---\n`);
        const err = expectStop(h, runCloseCommand(h.deps, input(h, { ...viaPr(), entryPath: entry })));
        expect(err).toMatch(new RegExp(`reason: .*#${EPIC + 1}.*#${EPIC}`));
    });

    it("keeps --handoff in the remedy that asks for the epic by number", () => {
        const h = harness({ storiesOfPr: () => ({ ok: false, error: { problem: "story-candidates-multiple-epics", message: "more than one epic" } }) });
        const note = path.join(h.repoRoot, "handoff.txt");
        expect(expectStop(h, runCloseCommand(h.deps, input(h, { ...viaPr(), handoff: note })))).toContain(`nexus close --epic <N> --handoff ${note}`);
    });

    it("with --pr, names --epic rather than trusting an entry path when the pull request names no single epic", () => {
        const h = harness({ storiesOfPr: () => ({ ok: false, error: { problem: "story-candidates-multiple-epics", message: "more than one epic" } }) });
        const entry = path.join(h.repoRoot, "epic.md");
        fs.writeFileSync(entry, `---\nlink: "#${EPIC}"\n---\n`);
        expect(expectStop(h, runCloseCommand(h.deps, input(h, { ...viaPr(), entryPath: entry })))).toMatch(/remedy: .*nexus close --epic <N>/);
    });

    it("with --pr, stops on a pull request whose stories cannot be read rather than trusting the entry path", () => {
        const h = harness({ storiesOfPr: () => ({ ok: false, error: { problem: "gh-failed", message: "HTTP 502" } }) });
        const entry = path.join(h.repoRoot, "epic.md");
        fs.writeFileSync(entry, `---\nlink: "#${EPIC}"\n---\n`);
        expect(expectStop(h, runCloseCommand(h.deps, input(h, { ...viaPr(), entryPath: entry })))).toContain("HTTP 502");
    });

    it("on a re-run, reports a stamped pull request that names no repository rather than claiming none", () => {
        const mixed = {
            body: `<!-- nexus:close-record -->\n\`\`\`yaml\nepic: "#${EPIC}"\nrange:\n  - { repo: ${ISSUES}, pr: ${PR + 1} }\n  - { pr: ${PR} }\n\`\`\``,
            authorAssociation: "OWNER",
        };
        const h = harness({
            issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === EPIC ? [mixed] : [] }),
            findDistillBranch: () => ({ ok: true, branch: `distill/2026-10-03-epic-${EPIC}`, source: "local" }),
        });
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h)));
        expect(rendered.exitCode).toBe(0);
        expect(text(rendered.stdout)).toMatch(new RegExp(`Pull requests:.*${ISSUES}#${PR + 1}.*1 stamped without its repository`));
    });

    it("on a re-run with --pr, finishes the earlier close", () => {
        const unstamped = { body: `<!-- nexus:close-record -->\n\`\`\`yaml\nepic: "#${EPIC}"\n\`\`\``, authorAssociation: "OWNER" };
        const h = harness({
            issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === EPIC ? [unstamped] : [] }),
            findDistillBranch: () => ({ ok: true, branch: `distill/2026-10-03-epic-${EPIC}`, source: "local" }),
        });
        expect(renderCloseOutcome(runCloseCommand(h.deps, input(h, viaPr()))).exitCode).toBe(0);
        expect(h.writes).toEqual([`close #${EPIC}`]);
    });

    it("keeps --handoff in the re-run hint, so a copied hint still writes the hand-off note", () => {
        const h = harness({ subIssues: () => ({ ok: true, facts: new Map([[864, facts("OPEN")], [865, facts("CLOSED")], [RECORD, facts("CLOSED")]]) }) });
        const note = path.join(h.repoRoot, "handoff.txt");
        const err = expectStop(h, runCloseCommand(h.deps, input(h, { ...viaPr(), handoff: note })));
        expect(err).toContain(`nexus close --epic ${EPIC} --handoff ${note}`);
    });

    it("quotes an entry path in the re-run hint so it stays one argument", () => {
        const h = harness({ subIssues: () => ({ ok: true, facts: new Map([[864, facts("OPEN")], [865, facts("CLOSED")], [RECORD, facts("CLOSED")]]) }) });
        const dir = path.join(h.repoRoot, "My Repo");
        fs.mkdirSync(dir);
        const entry = path.join(dir, "epic.md");
        fs.writeFileSync(entry, `---\nlink: "#${EPIC}"\n---\n`);
        const err = expectStop(h, runCloseCommand(h.deps, input(h, { entryPath: entry })));
        expect(err).toContain(`nexus close --epic ${EPIC} '${entry}'`);
    });

    it("stops when the entry path names a different epic than the one given", () => {
        const h = harness();
        const entry = path.join(h.repoRoot, "epic.md");
        fs.writeFileSync(entry, `---\nlink: "#${EPIC + 1}"\n---\n`);
        const err = expectStop(h, runCloseCommand(h.deps, input(h, { entryPath: entry })));
        expect(err).toContain(`#${EPIC + 1}`);
        expect(err).toContain(`#${EPIC}`);
        expect(err).toContain(entry);
    });

    it("reads a repository-qualified pull request in the repository it names, and resolves its epic there", () => {
        const readFrom: (string | null)[] = [];
        const ladderRepo: string[] = [];
        const h = harness({
            readPr: (_root, ref) => {
                readFrom.push(ref.repo);
                return { ok: true, pr: prInfo({ number: ref.number, url: `https://github.com/${ref.repo}/pull/${ref.number}` }) };
            },
            storiesOfPr: (_root, _issues, _pr, prRepo) => {
                ladderRepo.push(prRepo);
                return { ok: true, epic: EPIC, stories: [864] };
            },
            ranges: () => ({ ok: true, untrusted: [], ranges: ranges({ range: [{ repo: "acme/member", pr: 704, base: "b".repeat(40), head: "m".repeat(40) }] }) }),
        });
        const { stdout } = closed(h, viaPr(704, "acme/member"));
        expect(readFrom).toEqual(["acme/member"]);
        expect(ladderRepo).toEqual(["acme/member"]);
        expect(stdout).toContain(`epic ${ISSUES}#${EPIC} passed every gate`);
    });

    it("takes a bare pull request's repository from the pull request it read, not the checkout's default", () => {
        // A fork checkout: the checkout's default repository is the fork, the pull request was read
        // in the repository the canonical remote names.
        const ladderRepo: string[] = [];
        const h = harness({
            issuesRepo: () => ({ ok: true, repos: { issuesRepo: ISSUES, repo: "dev/fork" } }),
            readPr: () => ({ ok: true, pr: prInfo({ url: `https://github.com/acme/code/pull/${PR}` }) }),
            storiesOfPr: (_root, _issues, _pr, prRepo) => {
                ladderRepo.push(prRepo);
                return { ok: true, epic: EPIC, stories: [864] };
            },
            ranges: () => ({ ok: true, untrusted: [], ranges: ranges({ range: [{ repo: "acme/code", pr: PR, base: "b".repeat(40), head: "m".repeat(40) }] }) }),
        });
        closed(h, viaPr());
        expect(ladderRepo).toEqual(["acme/code"]);
    });

    it("answers that a pull request has not merged before it resolves the issues repository", () => {
        const h = harness({
            readPr: () => ({ ok: true, pr: prInfo({ state: "OPEN", merged: false, mergeCommitOid: null }) }),
            issuesRepo: () => ({ ok: false, error: { problem: "repo-unresolved", message: "no remote" } }) as never,
        });
        expect(expectStop(h, runCloseCommand(h.deps, input(h, viaPr())))).toMatch(/not merged/);
    });

    it("compares a pull-request URL with gh's default forge when the checkout names none", () => {
        const h = harness({ checkoutForge: () => null });
        const err = expectStop(h, runCloseCommand(h.deps, input(h, { target: { pr: { repo: ISSUES, number: PR, host: "ghe.corp" } } })));
        expect(err).toMatch(/reason: .*ghe\.corp.*github\.com/);
    });

    it("reads an entry path whose link is empty as linking nothing, never the next line", () => {
        const h = harness();
        const entry = path.join(h.repoRoot, "epic.md");
        fs.writeFileSync(entry, `---\nlink:\n"#${EPIC}"\n---\n`);
        expect(expectStop(h, runCloseCommand(h.deps, input(h, { entryPath: entry })))).toMatch(/no link naming the epic/);
    });

    it("reads a pull-request URL on an Enterprise checkout whose issues repository names no host", () => {
        const h = harness({ checkoutForge: () => "ghe.corp" });
        const { stdout } = closed(h, { target: { pr: { repo: ISSUES, number: PR, host: "ghe.corp" } } });
        expect(stdout).toContain(`epic ${ISSUES}#${EPIC} passed every gate`);
    });

    it("stops, reading nothing, on a pull request on another forge than the issues repository", () => {
        let read = false;
        const h = harness({
            readPr: () => {
                read = true;
                return { ok: true, pr: prInfo() };
            },
        });
        const err = expectStop(h, runCloseCommand(h.deps, input(h, { target: { pr: { repo: "acme/app", number: 7, host: "ghe.corp" } } })));
        expect(err).toMatch(/reason: .*ghe\.corp.*github\.com/);
        expect(read).toBe(false);
    });

    it("names what the lead ran in a stop before the epic is known, and the epic in every stop after", () => {
        const unreadable = harness({ readPr: () => ({ ok: false, error: { problem: "pr-not-found", message: "no such pull request" } }) });
        expect(expectStop(unreadable, runCloseCommand(unreadable.deps, input(unreadable, viaPr(704, "acme/member"))))).toContain("nexus close --pr 'acme/member#704'");

        const openStory = harness({ subIssues: () => ({ ok: true, facts: new Map([[864, facts("OPEN")], [865, facts("CLOSED")], [RECORD, facts("CLOSED")]]) }) });
        const err = expectStop(openStory, runCloseCommand(openStory.deps, input(openStory, viaPr(704, "acme/member"))));
        expect(err).toContain(`nexus close --epic ${EPIC}`);
        expect(err).not.toContain("--pr");
    });

    it("keeps the entry path in the re-run hint when one was given", () => {
        const h = harness({ subIssues: () => ({ ok: true, facts: new Map([[864, facts("OPEN")], [865, facts("CLOSED")], [RECORD, facts("CLOSED")]]) }) });
        const entry = path.join(h.repoRoot, "epic.md");
        fs.writeFileSync(entry, `---\nlink: "#${EPIC}"\n---\n`);
        const err = expectStop(h, runCloseCommand(h.deps, input(h, { entryPath: entry })));
        expect(err).toContain(`nexus close --epic ${EPIC} ${entry}`);
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
            verdict: () => ({ ...present(emptyJudgments()), critical: 1 }) as CloseVerdictRead,
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

    it("stops on a story no pull request claims and prints the exact storyless waiver to post on its own issue (D10)", () => {
        const states: StoryState[] = [{ story: 865, state: "unshipped", findings: [] }];
        const h = harness({ ranges: () => ({ ok: true, untrusted: [], ranges: ranges({ states: [...currentStates([864]), ...states], closable: false }) }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toMatch(/#865.*no pull request claims it/);
        expect(err).toContain(`comment to post on story ${ISSUES}#865:`);
        expect(err).toContain("<!-- nexus:close-waiver -->");
        expect(err).toContain("waive: storyless");
        expect(err).toContain('story: "#865"');
        expect(err).not.toContain("waive-story");
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
        const h = harness({ verdict: () => ({ ...present(emptyJudgments()), high: 2 }) as CloseVerdictRead });
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
                return present(emptyJudgments());
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

    it("stops before creating anything when the decision record's body cannot be read (G3)", () => {
        const h = harness({ recordBody: () => ({ ok: false, message: "HTTP 502" }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain(`${ISSUES}#${RECORD}`);
        expect(err).toContain("HTTP 502");
    });

    it("writes no hand-off note on a stop (G17)", () => {
        const h = harness({ subIssues: () => ({ ok: true, facts: new Map([[865, facts("OPEN")]]) }) });
        const note = path.join(h.repoRoot, "handoff.txt");
        expectStop(h, runCloseCommand(h.deps, input(h, { handoff: note })));
        expect(fs.existsSync(note)).toBe(false);
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

    it("reads the open counts, the judgments and the analyzed head and date", () => {
        const r = read(twoVerdictPrPayload({ newerBody: verdictBody({ high: 0, judgments }) }));
        expect(r).toMatchObject({ ok: true, found: true, critical: 0, high: 0, judgments: "present", date: "2026-09-15", head: TWO_VERDICT_ANALYZED_HEAD, recordHash: TWO_VERDICT_RECORD_HASH });
        expect(r.ok && r.found && r.judgments === "present" ? r.read.items.map((d) => d.answer?.author) : []).toEqual(["lead"]);
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

// ---------------------------------------------------------------------------------------------
// Story #865 (decision record #872: D2, D4–D8, D12): the close record and the close comment are
// written from the pull requests' verdicts. What a lead and distill see: the file committed in the
// queue entry, the comment body, the amendment posted on the record issue, and the report.
// ---------------------------------------------------------------------------------------------

const PR2 = 902;
const LINK = (n: number): string => `https://github.com/${ISSUES}/pull/${PR}#issuecomment-${n}`;

function departure(id: string, over: Partial<Judgments["items"][number]> = {}): Judgments["items"][number] {
    return {
        id,
        kind: "departure",
        found: true,
        severity: "high",
        departsFrom: "D1",
        summary: `the code does ${id}`,
        files: ["src/a.ts"],
        stub: null,
        supersedes: null,
        answer: { verb: "accepted", author: "lead", link: LINK(Number(id.slice(2))), reason: `reason for ${id}` },
        ...over,
    };
}

function twoPrRanges(): CloseRanges {
    return ranges({
        stories: [
            { story: 864, ranges: [{ repo: ISSUES, pr: PR, source: "derived", base: "b".repeat(40), head: "m".repeat(40), checkout: "/repo" }] },
            { story: 865, ranges: [{ repo: ISSUES, pr: PR2, source: "derived", base: "c".repeat(40), head: "n".repeat(40), checkout: "/repo" }] },
        ],
        range: [
            { repo: ISSUES, pr: PR, base: "b".repeat(40), head: "m".repeat(40) },
            { repo: ISSUES, pr: PR2, base: "c".repeat(40), head: "n".repeat(40) },
        ],
        landed: [
            { story: 864, result: "unchanged", prs: [{ repo: ISSUES, pr: PR, result: "unchanged", analyzedHead: "a".repeat(40), files: [{ path: "src/a.ts", status: "unchanged" }] }] },
            { story: 865, result: "not-checked", prs: [{ repo: ISSUES, pr: PR2, result: "not-checked", reason: "no-range" }] },
        ],
    });
}

/** A two-pull-request epic whose verdicts carry the given judgments, merged in the order PR, PR2. */
function twoPrHarness(first: Judgments, second: Judgments, over: Partial<CloseCommandDeps> = {}): Harness {
    return harness({
        ranges: () => ({ ok: true, untrusted: [], ranges: twoPrRanges() }),
        verdict: (_root, _issues, pr) => (pr.pr === PR ? present(first, { date: "2026-10-01", head: "1".repeat(40) }) : present(second, { date: "2026-10-02", head: "2".repeat(40) })),
        ...over,
    });
}

function closed(h: Harness, over: Partial<CloseInput> = {}): { record: string; comment: string; stdout: string; out: ReturnType<typeof runCloseCommand> } {
    const out = runCloseCommand(h.deps, input(h, { nexusVersion: "0.92.0", ...over }));
    const rendered = renderCloseOutcome(out);
    expect(rendered.stderr).toEqual([]);
    expect(rendered.exitCode).toBe(0);
    if (!out.ok || out.resumed) throw new Error("unreachable");
    return { record: fs.readFileSync(out.recordPath, "utf8"), comment: out.closeComment, stdout: text(rendered.stdout), out };
}

/** A markdown section's lines: from its heading to the next heading of the same or higher level. */
function sectionOf(body: string, heading: string): string {
    const at = body.indexOf(`${heading}\n`);
    expect(at, heading).toBeGreaterThanOrEqual(0);
    const rest = body.slice(at + heading.length + 1);
    const level = heading.split(" ")[0];
    const end = rest.search(new RegExp(`\\n#{1,${level.length}} |\\n<!-- nexus:close-record -->`));
    return (end < 0 ? rest : rest.slice(0, end)).trim();
}

function frontmatterOf(record: string): string {
    const m = /^---\n([\s\S]*?)\n---\n/.exec(record);
    expect(m).not.toBeNull();
    return (m as RegExpExecArray)[1];
}

describe("nexus close writes the close record from the verdicts (story #865, AC1, G9–G12)", () => {
    it("writes the record into the queue entry and commits it with the epic on the distill branch", () => {
        const h = harness();
        const { out } = closed(h);
        const dir = path.join(h.wtPath, ".nexus", "queue", `epic-${EPIC}`);
        expect(out.ok && out.recordPath).toBe(path.join(dir, "close-record.md"));
        expect(h.commits).toHaveLength(1);
        expect(h.commits[0].files.sort()).toEqual([path.join(dir, "close-record.md"), path.join(dir, "epic.md")]);
        expect(h.commits[0].message).toContain(`epic-${EPIC}`);
        expect(h.commits[0].message).not.toMatch(/lesson/);
    });

    it("carries the same Key Decisions and Deviation Rationale on the record and the comment, each departure naming who accepted it", () => {
        const h = twoPrHarness(emptyJudgments({ items: [departure("DV1")] }), emptyJudgments({ items: [departure("DV1", { answer: { verb: "accepted", author: "pm", link: "https://x/pm", reason: "pm said so" } })] }));
        const { record, comment } = closed(h);
        expect(sectionOf(record, "## Key Decisions")).toBe(sectionOf(comment, "### Key Decisions"));
        expect(sectionOf(record, "## Deviation Rationale")).toBe(sectionOf(comment, "### Deviation Rationale"));
        const dr = sectionOf(record, "## Deviation Rationale");
        expect(dr).toContain(`@lead (${LINK(1)})`);
        expect(dr).toContain("@pm (https://x/pm)");
    });

    it("lists every record decision once, in record order, with its ID, decision, reason and refuted alternative, then each confirmed stub once (G10)", () => {
        const stubA = { path: ".nexus/queue/epic-830/dev/decisions-a.md", choice: "Use one query per edge", reason: "pages differ", refuted: "one combined query" };
        const stubB = { path: ".nexus/queue/epic-830/dev/decisions-b.md", choice: "Read gh pages", reason: "gh pages already", refuted: "none" };
        const first = emptyJudgments({ keyDecisions: { record: { digest: RECORD_DIGEST, format: "new", decisions: [{ id: "D2" }, { id: "D1" }] }, stubs: [stubB] } });
        const second = emptyJudgments({ keyDecisions: { record: { digest: RECORD_DIGEST, format: "new", decisions: [{ id: "D1" }] }, stubs: [stubA, { ...stubB }] } });
        const kd = sectionOf(closed(twoPrHarness(first, second)).record, "## Key Decisions").split("\n");
        expect(kd).toHaveLength(4);
        expect(kd[0]).toMatch(/^- \*\*D1 — The subcommand is named nexus close \(#872\)\.\*\*/);
        expect(kd[0]).toContain("The command is `nexus close`.");
        expect(kd[0]).toContain("**Why:** The stage is called close everywhere.");
        expect(kd[0]).toContain("**Refuted alternative:** `nexus close-epic`, which the script already uses.");
        expect(kd[1]).toMatch(/^- \*\*D2 — No model fallback/);
        expect(kd[1]).toContain("**Refuted alternative:** none");
        expect(kd[2]).toContain("Read gh pages");
        expect(kd[2]).toContain(`${ISSUES}#${PR}`);
        expect(kd[3]).toContain("Use one query per edge");
        expect(kd[3]).toContain("one combined query");
    });

    it("takes the record decisions from the body close stamps, and names a verdict decision the body does not carry", () => {
        const verdict = emptyJudgments({ keyDecisions: { record: { digest: "0".repeat(64), format: "new", decisions: [{ id: "D9" }] }, stubs: [] } });
        const { record, stdout } = closed(harness({ verdict: () => present(verdict) }));
        expect(frontmatterOf(record)).toContain(`record_hash: ${RECORD_DIGEST}`);
        expect(sectionOf(record, "## Key Decisions")).not.toContain("D9");
        expect(stdout).toMatch(/names record decision "D9", which the current body of record #872 does not carry/);
    });

    it("lists an old-format record's decisions by title", () => {
        const old = ["# Decision Record: x", "", "## Key Decisions", "", "### Reuse the reader", "", "- **Decision:** Reuse it.", "- **Why:** One reader.", "- **Refuted alternative:** A second reader.", "", "## Constraints & Invariants", "", "1. One reader.", ""].join("\n");
        const { record } = closed(harness({ recordBody: () => ({ ok: true, body: old, digest: recordDigest(old) }) }));
        const kd = sectionOf(record, "## Key Decisions");
        expect(kd).toMatch(/^- \*\*Reuse the reader \(#872\)\.\*\* Reuse it\. \*\*Why:\*\* One reader\. \*\*Refuted alternative:\*\* A second reader\.$/);
    });

    it("gives a record in neither format as the text the verdict carries", () => {
        const neither = "Just prose.\n\nNo known headings.";
        const verdict = emptyJudgments({ keyDecisions: { record: { digest: recordDigest(neither), format: "neither", decisions: [], text: neither }, stubs: [] } });
        const { record } = closed(harness({ verdict: () => present(verdict), recordBody: () => ({ ok: true, body: neither, digest: recordDigest(neither) }) }));
        const kd = sectionOf(record, "## Key Decisions");
        expect(kd).toContain("neither format");
        expect(kd).toContain("  > Just prose.");
        expect(kd).toContain("  > No known headings.");
    });

    it("writes one deviation per accepted departure per pull request, in merge order then ID order, and skips unanswered, no-longer-found and code-fixed ones (G11, G12)", () => {
        const first = emptyJudgments({
            items: [
                departure("DV3", { departsFrom: "G1" }),
                departure("DV1"),
                departure("DV2", { answer: null }),
                departure("DV4", { found: false }),
            ],
        });
        const second = emptyJudgments({ items: [departure("DV1", { departsFrom: "D1" })] });
        const dr = sectionOf(closed(twoPrHarness(first, second)).record, "## Deviation Rationale").split("\n");
        expect(dr).toHaveLength(3);
        expect(dr[0]).toContain(`record #${RECORD} D1 — ${ISSUES}#${PR} DV1`);
        expect(dr[1]).toContain(`record #${RECORD} G1 — ${ISSUES}#${PR} DV3`);
        expect(dr[2]).toContain(`${ISSUES}#${PR2} DV1`);
        expect(dr[0]).toContain("the code does DV1");
        expect(dr[0]).toContain("**Why:** reason for DV1");
        expect(dr.join("\n")).not.toMatch(/DV2|DV4/);
    });

    it("names the record revision when a departure was answered by one", () => {
        const verdict = emptyJudgments({ items: [departure("DV1", { answer: { verb: "accepted", author: "", link: "", reason: "the record now says so" } })] });
        expect(sectionOf(closed(harness({ verdict: () => present(verdict) })).record, "## Deviation Rationale")).toContain("**Accepted by:** the record revision");
    });

    it("states each waived critical or high finding with who waived it, in the waivers stamp and the comment's waivers statement (G12)", () => {
        const verdict = emptyJudgments({
            findings: [
                { id: "F1", kind: "finding", found: true, severity: "high", about: "#864 AC2", summary: "flaky", files: [], answer: { verb: "waived", author: "lead", link: LINK(7), reason: "tracked in #999" } },
                { id: "F2", kind: "finding", found: true, severity: "medium", about: "#864 AC3", summary: "minor", files: [], answer: null },
            ],
        });
        const { record, comment } = closed(harness({ verdict: () => present(verdict) }));
        expect(frontmatterOf(record)).toMatch(/waivers:\n {2}- \{ repo: acme\/app, pr: 901, cause: finding, id: F1, severity: high, author: lead, url: "https:[^"]+issuecomment-7" \}/);
        expect(comment).toMatch(/Waivers applied:[\s\S]*F1 \(high: #864 AC2\) waived by @lead, \S+issuecomment-7: tracked in #999/);
        expect(sectionOf(record, "## Deviation Rationale")).toBe("none");
        expect(record).not.toContain("F2");
    });

    it("writes the same Key Decisions and Deviation Rationale on a second run over the same state (G13)", () => {
        const make = (): Harness => twoPrHarness(emptyJudgments({ items: [departure("DV1")] }), emptyJudgments({ items: [departure("DV2")] }));
        expect(closed(make()).record).toBe(closed(make()).record);
    });
});

describe("the close record keeps today's shape for distill (story #865, AC2, D4, G14, G16, G34)", () => {
    it("writes today's frontmatter keys, in today's order, and today's sections without a process lesson", () => {
        const { record, comment } = closed(harness());
        const keys = frontmatterOf(record)
            .split("\n")
            .filter((l) => /^[a-z_]+:/.test(l))
            .map((l) => l.split(":")[0]);
        expect(keys).toEqual(["title", "epic", "feature", "date", "nexus_version", "analyze", "record", "record_hash", "range", "story_ranges", "landed_check"]);
        const headings = record.split("\n").filter((l) => /^#{1,3} /.test(l));
        expect(headings).toEqual(["# Close Record: Close becomes a deterministic subcommand", "## Key Decisions", "## Deviation Rationale", "## Waived Stories", "## Deferred Scope"]);
        expect(record).not.toMatch(/lesson/i);
        expect(comment).not.toMatch(/lesson/i);
    });

    it("writes no lesson file and names no lesson in anything it commits, posts or prints (story #868, G34)", () => {
        const h = twoPrHarness(emptyJudgments({ items: [departure("DV1")] }), emptyJudgments());
        const { stdout } = closed(h);
        const files = (dir: string): string[] =>
            fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => path.join(e.parentPath, e.name));
        const written = [...files(h.repoRoot), ...files(h.wtPath), ...h.commits.flatMap((c) => c.files)];
        expect(written.length).toBeGreaterThan(0);
        expect(written.filter((f) => /lesson/i.test(f))).toEqual([]);
        expect(h.commits.map((c) => c.message).join("\n")).not.toMatch(/lesson/i);
        expect(h.posted.length).toBeGreaterThan(0);
        expect(h.posted.map((p) => p.body).join("\n")).not.toMatch(/lesson/i);
        expect(stdout).not.toMatch(/lesson/i);
    });

    it("stamps analyze as ran <date> @ <head> from the completing pull request's verdict (G14)", () => {
        const { record } = closed(twoPrHarness(emptyJudgments(), emptyJudgments()));
        expect(frontmatterOf(record)).toContain(`analyze: ran 2026-10-02 @ ${"2".repeat(40)}`);
    });

    it("keeps a pull request with no range in its merge-order place, so it neither lists last nor completes the epic out of turn (D6, D7)", () => {
        // PR merged first with no range of its own; PR2 merged last with one.
        const h = twoPrHarness(emptyJudgments({ items: [departure("DV1")] }), emptyJudgments({ items: [departure("DV1", { departsFrom: "D1" })] }), {
            ranges: () => ({
                ok: true,
                untrusted: [],
                ranges: ranges({
                    stories: [
                        { story: 864, ranges: [{ repo: ISSUES, pr: PR, source: "no-range", checkout: "/repo" }] },
                        { story: 865, ranges: [{ repo: ISSUES, pr: PR2, source: "derived", base: "c".repeat(40), head: "n".repeat(40), checkout: "/repo" }] },
                    ],
                    range: [{ repo: ISSUES, pr: PR2, base: "c".repeat(40), head: "n".repeat(40) }],
                    merged: [
                        { repo: ISSUES, pr: PR },
                        { repo: ISSUES, pr: PR2 },
                    ],
                }),
            }),
        });
        const { record } = closed(h);
        const dr = sectionOf(record, "## Deviation Rationale").split("\n");
        expect(dr[0]).toContain(`${ISSUES}#${PR} DV1`);
        expect(dr[1]).toContain(`${ISSUES}#${PR2} DV1`);
        expect(frontmatterOf(record)).toContain(`analyze: ran 2026-10-02 @ ${"2".repeat(40)}`);
    });

    it("adds today's revised-record clause, with the waiver's author, when a waiver accepted the revision", () => {
        const waiver = { repo: ISSUES, pr: PR, author: "lead", url: "https://x/w", at: "2026-10-03T11:00:00Z", reason: null, stories: [864], cause: "record-revised" as const, record: RECORD, digest: RECORD_DIGEST };
        const h = harness({
            ranges: () => ({ ok: true, untrusted: [], ranges: ranges({ waivers: [waiver] }) }),
            verdict: () => present(emptyJudgments(), { recordHash: "0".repeat(64) }),
        });
        const { record, comment } = closed(h);
        const value = `ran 2026-10-03 @ ${"a".repeat(40)}; stale — record #${RECORD} revised since analysis (${"0".repeat(64)} → ${RECORD_DIGEST}); waived 2026-10-03 by @lead`;
        expect(frontmatterOf(record)).toContain(`analyze: ${JSON.stringify(value)}`);
        expect(comment).toContain(`Conformance: ${value}`);
        expect(frontmatterOf(record)).toMatch(/waivers:\n {2}- \{ repo: acme\/app, pr: 901, cause: record-revised, record: "#872", digest: [0-9a-f]{64}, author: lead, url: "https:\/\/x\/w", stories: \["#864"\] \}/);
    });

    it("stamps the ranges, the story ranges and the landed check entry for entry, on the record and in the comment's machine block", () => {
        const { record, comment } = closed(twoPrHarness(emptyJudgments(), emptyJudgments()));
        const stamps = [
            "range:",
            `  - repo: ${ISSUES}`,
            `    pr: ${PR}`,
            `    base: ${"b".repeat(40)}`,
            `    head: ${"m".repeat(40)}`,
            `  - repo: ${ISSUES}`,
            `    pr: ${PR2}`,
            "story_ranges:",
            '  - story: "#864"',
            "    ranges:",
            `      - { repo: ${ISSUES}, pr: ${PR}, base: ${"b".repeat(40)}, head: ${"m".repeat(40)} }`,
            "landed_check:",
            "    result: unchanged",
            `      - { repo: ${ISSUES}, pr: ${PR}, result: unchanged }`,
            `      - { repo: ${ISSUES}, pr: ${PR2}, result: not-checked, reason: no-range }`,
        ];
        for (const line of stamps) {
            expect(record, line).toContain(line);
            expect(comment, line).toContain(line);
        }
    });

    it("names a pull request with no attributable commits as no range, on the record and in the comment's machine block (story #841)", () => {
        const h = twoPrHarness(emptyJudgments(), emptyJudgments(), {
            ranges: () => ({
                ok: true,
                untrusted: [],
                ranges: ranges({
                    ...twoPrRanges(),
                    stories: [
                        twoPrRanges().stories[0],
                        { story: 865, ranges: [{ repo: ISSUES, pr: PR2, source: "no-range", checkout: "/repo" }] },
                    ],
                    range: [twoPrRanges().range[0]],
                }),
            }),
        });
        const { record, comment } = closed(h);
        const line = `      - { repo: ${ISSUES}, pr: ${PR2}, range: none }`;
        expect(record).toContain(line);
        expect(comment).toContain(line);
    });

    it("writes issues_repo and qualifies the story numbers when the issues live in another repository", () => {
        const h = harness({ issuesRepo: () => ({ ok: true, repos: { issuesRepo: "acme/issues", repo: ISSUES } }) });
        const fm = frontmatterOf(closed(h).record);
        expect(fm).toContain("issues_repo: acme/issues");
        expect(fm).toContain('story: "acme/issues#864"');
    });

    it("stamps issues_repo in the close comment's machine block and keeps the comment's own epic number bare, since it is posted in that repository", () => {
        const h = harness({ issuesRepo: () => ({ ok: true, repos: { issuesRepo: "acme/issues", repo: ISSUES } }) });
        const block = closed(h).comment.split("<!-- nexus:close-record -->")[1];
        expect(block).toContain("issues_repo: acme/issues");
        expect(block).toMatch(/^epic: "#830"$/m);
    });

    it("omits the record keys and lists stubs only when the epic has no record, naming the epic's description on each departure", () => {
        const stub = { path: "p", choice: "Pick A", reason: "A is cheaper", refuted: "B" };
        const verdict = emptyJudgments({ keyDecisions: { record: null, stubs: [stub] }, items: [departure("DV1", { departsFrom: "How it works" })] });
        const h = harness({
            verdict: () => present(verdict, { recordHash: null }),
            subIssues: () => ({ ok: true, facts: new Map([[864, facts("CLOSED")], [865, facts("CLOSED")]]) }),
        });
        const resolveEpic = h.deps.resolveEpic;
        h.deps.resolveEpic = (root, repo, epic) => {
            const r = resolveEpic(root, repo, epic);
            return r.ok ? { ...r, record: null } : r;
        };
        const { record, comment } = closed(h);
        expect(frontmatterOf(record)).not.toMatch(/^record/m);
        expect(sectionOf(record, "## Key Decisions").split("\n")).toHaveLength(1);
        expect(sectionOf(record, "## Key Decisions")).toContain("Pick A");
        expect(sectionOf(record, "## Deviation Rationale")).toContain(`the epic's description (#${EPIC}), How it works`);
        expect(comment).not.toContain("Decision record:");
        expect(amendments(h)).toEqual([]);
    });

    it("lists approved deferred scope, and only approved scope, by the stub number it was filed as", () => {
        const verdict = emptyJudgments({
            findings: [{ id: "F1", kind: "finding", found: true, severity: "high", about: "#864 AC4", summary: "unmet", files: [], answer: null }],
            deferred: [
                { id: "DS1", kind: "deferred-scope", found: true, settles: "F1", summary: "Finish AC4 later", answer: { verb: "approved", author: "pm", link: "https://x/ds", reason: "" } },
                { id: "DS2", kind: "deferred-scope", found: true, settles: "DV1", summary: "Nobody approved this", answer: null },
            ],
            items: [departure("DV1", { answer: null })],
        });
        const { record, stdout } = closed(harness({ verdict: () => present(verdict) }));
        const ds = sectionOf(record, "## Deferred Scope");
        expect(ds).toContain("- #1000 — Finish AC4 later");
        expect(ds).not.toContain("not yet filed");
        expect(ds).not.toContain("Nobody approved this");
        expect(stdout).toMatch(/Deferred scope: +1 approved proposal/);
    });

    it("writes the record into a committed old-contract entry as is", () => {
        const h = harness();
        const entry = path.join(h.wtPath, ".nexus", "queue", "2026-09-01-close-deterministic-subcommand");
        fs.mkdirSync(entry, { recursive: true });
        fs.writeFileSync(path.join(entry, "epic.md"), `---\nlink: "#${EPIC}"\n---\nold contract\n`);
        const { out } = closed(h);
        expect(out.ok && out.recordPath).toBe(path.join(entry, "close-record.md"));
    });

    it("stops, naming the record file, when the commit fails", () => {
        const h = harness({ commitEntry: () => ({ ok: false, message: "index.lock exists" }) });
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h)));
        expect(rendered.exitCode).toBe(1);
        expect(text(rendered.stderr)).toContain("index.lock exists");
        expect(text(rendered.stderr)).toContain("close-record.md");
        expect(h.posted).toEqual([]);
    });
});

describe("the close comment is the durable copy (story #865, G47)", () => {
    it("inlines Key Decisions and Deviation Rationale, carries the marker-anchored machine block with every key, and links nothing under the queue", () => {
        const stub = { path: ".nexus/queue/epic-830/dev/decisions-x.md", choice: "Pick A", reason: "cheaper", refuted: "B" };
        const verdict = emptyJudgments({ items: [departure("DV1")], keyDecisions: { record: { digest: RECORD_DIGEST, format: "new", decisions: [] }, stubs: [stub] } });
        const { comment } = closed(harness({ verdict: () => present(verdict) }));
        expect(comment.startsWith("## Close Record\n")).toBe(true);
        expect(comment).toContain(`Decision record: #${RECORD} @ \`${RECORD_DIGEST}\``);
        expect(comment.split("<!-- nexus:close-record -->")).toHaveLength(2);
        const block = /<!-- nexus:close-record -->\n```yaml\n([\s\S]*?)\n```/.exec(comment);
        expect(block).not.toBeNull();
        const keys = (block as RegExpExecArray)[1]
            .split("\n")
            .filter((l) => /^[a-z_]+:/.test(l))
            .map((l) => l.split(":")[0]);
        expect(keys).toEqual(["epic", "nexus_version", "issues_repo", "date", "record", "record_hash", "analyze", "range", "story_ranges", "landed_check"]);
        expect(comment).not.toContain(".nexus/queue");
        expect(comment).toContain("Pick A");
    });
});

describe("the record amendment (story #865, AC3, D12, G28, G48)", () => {
    const superseding = (): Judgments =>
        emptyJudgments({ items: [departure("DV1", { supersedes: { decision: "D2", instead: "falls back to a model pass" } }), departure("DV2")] });

    it("posts one amendment on the record issue naming each superseded decision, what shipped and why, with a key naming the epic", () => {
        const h = harness({ verdict: () => present(superseding()) });
        const { stdout } = closed(h);
        expect(amendments(h)).toHaveLength(1);
        const { issue, body } = amendments(h)[0];
        expect(issue).toBe(RECORD);
        expect(body).toMatch(/^## Amended at close — 1 decision\(s\) superseded/);
        expect(body).toContain("**D2 — No model fallback: A verdict without judgments stops close.** → **shipped:** falls back to a model pass. reason for DV1");
        expect(body).not.toContain("DV2 ");
        expect(body).toContain(`<!-- nexus:close-amendment epic: ${ISSUES}#${EPIC} -->`);
        expect(stdout).toMatch(/Record amendment: .*1 superseding decision\(s\) posted/);
    });

    it("posts nothing when no departure is marked superseding", () => {
        const h = harness({ verdict: () => present(emptyJudgments({ items: [departure("DV1")] })) });
        const { stdout } = closed(h);
        expect(amendments(h)).toEqual([]);
        expect(stdout).toMatch(/Record amendment: .*none/);
    });

    it("posts nothing when a trusted comment already carries this epic's amendment", () => {
        const h = harness({
            verdict: () => present(superseding()),
            issueComments: () => ({ ok: true, comments: [{ body: `old\n<!-- nexus:close-amendment epic: ${ISSUES}#${EPIC} -->`, authorAssociation: "OWNER" }] }),
        });
        const { stdout } = closed(h);
        expect(amendments(h)).toEqual([]);
        expect(stdout).toMatch(/already posted by an earlier run/);
    });

    it("does not count a copy of the key in an untrusted comment", () => {
        const h = harness({
            verdict: () => present(superseding()),
            issueComments: () => ({ ok: true, comments: [{ body: `<!-- nexus:close-amendment epic: ${ISSUES}#${EPIC} -->`, authorAssociation: "NONE" }] }),
        });
        closed(h);
        expect(amendments(h)).toHaveLength(1);
    });

    it("reports a failed post and still finishes (G48)", () => {
        const h = harness({ verdict: () => present(superseding()), postComment: (_root, _repo, issue) => (issue === RECORD ? { ok: false, message: "HTTP 403" } : { ok: true }) });
        const { stdout } = closed(h);
        expect(h.writes).toContain(`close #${EPIC}`);
        expect(stdout).toMatch(/Record amendment: .*NOT POSTED — HTTP 403/);
        expect(stdout).toMatch(/not blocked/i);
    });

    it("prints the amendment to post by hand when the post fails, and never promises a re-run will post it (G28)", () => {
        const h = harness({ verdict: () => present(superseding()), postComment: (_root, _repo, issue) => (issue === RECORD ? { ok: false, message: "HTTP 403" } : { ok: true }) });
        const { stdout } = closed(h);
        expect(stdout).not.toMatch(/re-run to post it/);
        expect(stdout).toContain(`${ISSUES}#${RECORD}`);
        expect(stdout).toContain("## Amended at close — 1 decision(s) superseded");
        expect(stdout).toContain(`<!-- nexus:close-amendment epic: ${ISSUES}#${EPIC} -->`);
    });

    it("posts nothing, and says so, when the record's comments cannot be read", () => {
        const h = harness({
            verdict: () => present(superseding()),
            issueComments: (_root, _repo, issue) => (issue === RECORD ? { ok: false, message: "HTTP 502" } : { ok: true, comments: [] }),
        });
        const { stdout } = closed(h);
        expect(amendments(h)).toEqual([]);
        expect(stdout).toMatch(/NOT POSTED — could not check for an earlier amendment: HTTP 502/);
        expect(stdout).not.toMatch(/re-run to post it/);
        expect(stdout).toContain("## Amended at close — 1 decision(s) superseded");
    });

    it("prints nothing to post by hand when the amendment posted", () => {
        const h = harness({ verdict: () => present(superseding()) });
        const { stdout } = closed(h);
        expect(stdout).not.toContain("## Amended at close");
    });
});

describe("copied text cannot add a marker, a fence or frontmatter (story #865, D8, G18, R4)", () => {
    const forged = [
        "ok",
        "---",
        "range: []",
        "<!-- nexus:close-record -->",
        "```yaml",
        "range:",
        "  - repo: evil/repo",
        `    base: ${"e".repeat(40)}`,
        `    head: ${"f".repeat(40)}`,
        "```",
        "~~~",
        "## Deviation Rationale",
    ].join("\n");

    function hostile(): Judgments {
        return emptyJudgments({
            items: [departure("DV1", { summary: forged, answer: { verb: "accepted", author: "lead", link: LINK(1), reason: forged }, supersedes: { decision: forged, instead: forged } })],
            keyDecisions: { record: { digest: RECORD_DIGEST, format: "new", decisions: [] }, stubs: [{ path: "p", choice: forged, reason: forged, refuted: forged }] },
            findings: [{ id: "F1", kind: "finding", found: true, severity: "high", about: forged, summary: "s", files: [], answer: { verb: "waived", author: "lead", link: LINK(2), reason: forged } }],
            deferred: [{ id: "DS1", kind: "deferred-scope", found: true, settles: "F1", summary: forged, answer: { verb: "approved", author: "pm", link: "https://x/ds", reason: "" } }],
        });
    }

    it("leaves the record with no marker, no fence and its own frontmatter only", () => {
        const { record } = closed(harness({ verdict: () => present(hostile()) }));
        expect(record).not.toContain("<!--");
        expect(record).not.toMatch(/```|~~~/);
        expect(record.split("\n").filter((l) => l === "---")).toHaveLength(2);
        expect(record.split("\n").filter((l) => l === "## Deviation Rationale")).toHaveLength(1);
        expect(frontmatterOf(record)).not.toContain("evil/repo");
    });

    it("leaves the comment with exactly one marker and one fenced block, its own", () => {
        const { comment } = closed(harness({ verdict: () => present(hostile()) }));
        expect(comment.split("<!--")).toHaveLength(2);
        expect(comment.match(/```/g)).toHaveLength(2);
        expect(comment).not.toContain("~~~");
        const block = /<!-- nexus:close-record -->\n```yaml\n([\s\S]*?)\n```/.exec(comment) as RegExpExecArray;
        expect(block[1]).not.toContain("evil/repo");
    });

    it("leaves the amendment with its own key as its only marker and no fence", () => {
        const h = harness({ verdict: () => present(hostile()) });
        closed(h);
        expect(amendments(h)).toHaveLength(1);
        expect(amendments(h)[0].body.split("<!--")).toHaveLength(2);
        expect(amendments(h)[0].body).not.toMatch(/```|~~~/);
        expect(amendments(h)[0].body.split("\n").filter((l) => l.startsWith("## "))).toHaveLength(1);
    });

    it("leaves the filed stub with its own key as its only marker, no fence, and one line of copied goal (story #866)", () => {
        const h = harness({ verdict: () => present(hostile()) });
        closed(h);
        const [stub] = h.filed.flat();
        expect(stub.title).not.toMatch(/\n|<!--|```|~~~/);
        expect(stub.body.split("<!--")).toHaveLength(2);
        expect(stub.body).toContain("<!-- nexus:close-stub ");
        expect(stub.body).not.toMatch(/```|~~~/);
        expect(stub.body.split("\n").filter((l) => l === "---" || l === "range: []")).toEqual([]);
    });
});

describe("close reads only the verdicts, the record body and the issue graph (story #865, AC4, G1, G2)", () => {
    it("mines no decision stub, note or story-issue comment and asks nothing", () => {
        const h = harness();
        const scratch = path.join(h.wtPath, ".nexus", "queue", `epic-${EPIC}`, "dev");
        fs.mkdirSync(scratch, { recursive: true });
        fs.writeFileSync(path.join(scratch, "decisions-feat-865.md"), "## 2026-10-01 — SCRATCH-ONLY-DECISION\n- **Choice:** x\n");
        fs.writeFileSync(path.join(scratch, "notes-feat-865.md"), "SCRATCH-ONLY-NOTE\n");
        const { record, comment } = closed(h);
        for (const body of [record, comment]) {
            expect(body).not.toContain("SCRATCH-ONLY-DECISION");
            expect(body).not.toContain("SCRATCH-ONLY-NOTE");
        }
    });
});

// The platform-backed writes and reads story #865 adds, over a stand-in gh and a real git checkout.
describe("nexus close — the record fetch, the commit and the record-issue comments (story #865)", () => {
    function recorder(responses: (args: string[]) => { status: number; stdout: string; stderr: string }): { run: Runner; calls: string[][] } {
        const calls: string[][] = [];
        return {
            calls,
            run: (cmd, args) => {
                calls.push([cmd, ...args]);
                return responses(args);
            },
        };
    }

    it("fetches the record body and its digest from the issues repository, and names a failed fetch", () => {
        const ok = recorder(() => ({ status: 0, stdout: JSON.stringify({ body: RECORD_BODY, state: "closed" }), stderr: "" }));
        expect(closeCommandDeps(ok.run, { singleRepo: () => true }).recordBody("/repo", ISSUES, RECORD)).toEqual({ ok: true, body: RECORD_BODY, digest: RECORD_DIGEST });
        expect(ok.calls[0]).toEqual(["gh", "api", `repos/${ISSUES}/issues/${RECORD}`]);
        const failing = recorder(() => ({ status: 1, stdout: "", stderr: "HTTP 404: Not Found" }));
        const r = closeCommandDeps(failing.run, { singleRepo: () => true }).recordBody("/repo", ISSUES, RECORD);
        expect(r.ok).toBe(false);
        expect(r.ok ? "" : r.message).toContain("404");
    });

    it("reads the record issue's comments with each author's association, and names a failed or unreadable read", () => {
        const doc = { comments: [{ body: "a", authorAssociation: "OWNER" }, { body: 3 }, null] };
        const ok = recorder(() => ({ status: 0, stdout: JSON.stringify(doc), stderr: "" }));
        expect(closeCommandDeps(ok.run, { singleRepo: () => true }).issueComments("/repo", ISSUES, RECORD)).toEqual({
            ok: true,
            comments: [{ body: "a", authorAssociation: "OWNER" }, { body: "", authorAssociation: "" }, { body: "", authorAssociation: "" }],
        });
        expect(ok.calls[0]).toEqual(["gh", "issue", "view", String(RECORD), "--repo", ISSUES, "--json", "comments"]);
        const failing = recorder(() => ({ status: 1, stdout: "", stderr: "HTTP 502" }));
        expect(closeCommandDeps(failing.run, { singleRepo: () => true }).issueComments("/repo", ISSUES, RECORD)).toEqual({ ok: false, message: "HTTP 502" });
        const garbled = recorder(() => ({ status: 0, stdout: "not json", stderr: "" }));
        expect(closeCommandDeps(garbled.run, { singleRepo: () => true }).issueComments("/repo", ISSUES, RECORD).ok).toBe(false);
    });

    it("posts one comment on the record issue, and only there, naming a failed post", () => {
        const ok = recorder(() => ({ status: 0, stdout: "{}", stderr: "" }));
        expect(closeCommandDeps(ok.run, { singleRepo: () => true }).postComment("/repo", `github.com/${ISSUES}`, RECORD, "## Amended")).toEqual({ ok: true });
        expect(ok.calls).toEqual([["gh", "api", "--method", "POST", `repos/${ISSUES}/issues/${RECORD}/comments`, "-f", "body=## Amended"]]);
        const failing = recorder(() => ({ status: 1, stdout: "", stderr: "HTTP 403" }));
        expect(closeCommandDeps(failing.run, { singleRepo: () => true }).postComment("/repo", ISSUES, RECORD, "x")).toEqual({ ok: false, message: "HTTP 403" });

    });

    it("commits the entry's files, and reports nothing to commit when an earlier run's commit already holds them", () => {
        const repo = makeDir();
        const g = (...args: string[]): string => {
            const r = defaultRunner("git", args, { cwd: repo });
            if (r.status !== 0) throw new Error(r.stderr);
            return r.stdout.trim();
        };
        g("init", "-q", "-b", "main");
        g("config", "user.email", "t@example.test");
        g("config", "user.name", "t");
        g("commit", "-q", "--allow-empty", "-m", "root");
        const dir = path.join(repo, ".nexus", "queue", `epic-${EPIC}`);
        fs.mkdirSync(dir, { recursive: true });
        const files = [path.join(dir, "epic.md"), path.join(dir, "close-record.md")];
        for (const f of files) fs.writeFileSync(f, `${path.basename(f)}\n`);
        fs.writeFileSync(path.join(repo, "unrelated.txt"), "left alone\n");
        g("add", "unrelated.txt");
        const deps = closeCommandDeps(defaultRunner, { singleRepo: () => true });
        expect(deps.commitEntry(repo, files, "close: epic-830 — close record")).toEqual({ ok: true, committed: true });
        expect(g("log", "-1", "--format=%s")).toBe("close: epic-830 — close record");
        expect(g("show", "--name-only", "--format=", "HEAD").split("\n").sort()).toEqual([".nexus/queue/epic-830/close-record.md", ".nexus/queue/epic-830/epic.md"]);
        expect(deps.commitEntry(repo, files, "again")).toEqual({ ok: true, committed: false });
        const bad = deps.commitEntry(repo, [path.join(repo, "missing.md")], "x");
        expect(bad.ok).toBe(false);
    });
});

// ---------------------------------------------------------------------------------------------
// Story #866 (decision record #872: D9, D10, D11): close files the approved scope, writes the
// storyless markers, pushes, posts the close comment, closes the epic and hands off — in that
// order, each write looking first for what an earlier run already did.
// ---------------------------------------------------------------------------------------------

const DS_LINK = "https://github.com/acme/app/pull/901#issuecomment-77";

function approvedVerdict(...ids: string[]): Judgments {
    return emptyJudgments({
        findings: [{ id: "F1", kind: "finding", found: true, severity: "high", about: "#864 AC4", summary: "unmet", files: [], answer: null }],
        deferred: [
            ...ids.map((id) => ({ id, kind: "deferred-scope" as const, found: true, settles: "F1", summary: `Goal of ${id}`, answer: { verb: "approved" as const, author: "pm", link: DS_LINK, reason: "" } })),
            { id: "DS9", kind: "deferred-scope", found: true, settles: "F1", summary: "Nobody approved this", answer: null },
        ],
    });
}

/** A storyless waiver comment on a story issue, as the waiver reader returns it. */
function storylessComment(story: number, over: Partial<{ author: string; at: string; trusted: boolean; url: string }> = {}) {
    return { author: "lead", url: `https://github.com/${ISSUES}/issues/${story}#issuecomment-5`, at: "2026-10-02T09:30:00Z", trusted: true, waiver: { ok: true as const, story: `#${story}`, reason: null }, ...over };
}

/** An epic whose story 865 no pull request claims; once excluded, the gate reads it as excluded. */
function storylessHarness(over: Partial<CloseCommandDeps> = {}): Harness & { rangeCalls: number[][] } {
    const rangeCalls: number[][] = [];
    const h = harness({
        ranges: (_root, _repo, _epic, inp) => {
            rangeCalls.push(inp.excluded);
            const excluded = inp.excluded.includes(865);
            return {
                ok: true,
                untrusted: [],
                ranges: ranges({
                    stories: [{ story: 864, ranges: [{ repo: ISSUES, pr: PR, source: "derived", base: "b".repeat(40), head: "m".repeat(40), checkout: "/repo" }] }, ...(excluded ? [] : [{ story: 865, ranges: [] }])],
                    excluded: inp.excluded,
                    states: [...currentStates([864]), excluded ? { story: 865, state: "excluded", findings: [] } : { story: 865, state: "unshipped", findings: [] }],
                    closable: excluded,
                }),
            };
        },
        storyWaivers: (_root, _repo, story) => ({ ok: true, comments: story === 865 ? [storylessComment(865)] : [] }),
        ...over,
    });
    return Object.assign(h, { rangeCalls });
}

describe("approved deferred scope is filed as unplanned epic stubs (story #866, AC1, D9, G19, G20)", () => {
    it("files each approved proposal once, and the committed record names its number", () => {
        let committedRecord = "";
        const h = harness({ verdict: () => present(approvedVerdict("DS1", "DS2")) });
        const commit = h.deps.commitEntry;
        h.deps.commitEntry = (wt, files, message) => {
            committedRecord = fs.readFileSync(files.find((f) => f.endsWith("close-record.md")) as string, "utf8");
            return commit(wt, files, message);
        };
        const { record, comment, stdout, out } = closed(h);
        expect(h.filed).toHaveLength(1);
        expect(h.filed[0].map((s) => s.title)).toEqual(["Goal of DS1", "Goal of DS2"]);
        expect(sectionOf(committedRecord, "## Deferred Scope")).toContain("- #1000 — Goal of DS1");
        expect(sectionOf(record, "## Deferred Scope")).toContain("- #1001 — Goal of DS2");
        expect(comment).toContain("Deferred scope → #1000 — Goal of DS1");
        expect(out.stubs.size).toBe(2);
        expect(stdout).toContain(`${ISSUES}#1000, ${ISSUES}#1001`);
    });

    it("never files a proposal nobody approved", () => {
        const h = harness({ verdict: () => present(approvedVerdict("DS1")) });
        const { record } = closed(h);
        expect(h.filed.flat().map((s) => s.title)).toEqual(["Goal of DS1"]);
        expect(record).not.toContain("Nobody approved this");
        const none = harness({ verdict: () => present(approvedVerdict()) });
        closed(none);
        expect(none.filed).toEqual([]);
    });

    it("writes a stub body with the goal, the feature path, its provenance and its key, and no estimate or ordering", () => {
        const h = harness({
            verdict: () => present(approvedVerdict("DS1")),
            resolveEpic: () => ({
                ok: true,
                markdown: `---\nfeature: "Close"\nfeature_path: docs/features/close\nlink: "#${EPIC}"\n---\n`,
                record: { number: RECORD, state: "closed" },
                resolved: { number: EPIC, title: "Close becomes a deterministic subcommand", stories: [{ number: 864, title: "a", body: "" }], blockedBy: new Map(), issuesRepo: ISSUES },
            }),
        });
        closed(h);
        const [stub] = h.filed[0];
        expect(stub.title).toBe("Goal of DS1");
        expect(stub.body.startsWith("Goal of DS1\n")).toBe(true);
        expect(stub.body).toContain("docs/features/close");
        expect(stub.body).toContain(`(#${EPIC})`);
        expect(stub.body).toContain(`${ISSUES}#${PR} DS1`);
        expect(stub.body).toContain("@pm");
        expect(stub.body).toContain(`<!-- nexus:close-stub epic: ${ISSUES}#${EPIC} pr: ${ISSUES}#${PR} proposal: DS1 -->`);
        expect(stub.body).not.toMatch(/estimate|blocked_by|parent/i);
    });

    it("files the approved proposals of every merged pull request, from each one's own verdict", () => {
        const h = twoPrHarness(approvedVerdict("DS1"), approvedVerdict("DS1"));
        closed(h);
        expect(h.filed[0].map((s) => s.key)).toEqual([`${ISSUES}#${PR} DS1`, `${ISSUES}#${PR2} DS1`]);
    });

    it("stops before the record is committed when filing fails, naming what was filed and the re-run", () => {
        const h = harness({
            verdict: () => present(approvedVerdict("DS1", "DS2")),
            fileStubs: (_r, _repo, _e, stubs) => ({ ok: false, message: '1 of 2 stub(s) were not filed ("Goal of DS2"): HTTP 502', numbers: new Map([[stubs[0].key, 1000]]) }),
        });
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h)));
        expect(rendered.exitCode).toBe(1);
        const err = text(rendered.stderr);
        expect(err).toContain("HTTP 502");
        expect(err).toContain(`${ISSUES}#1000`);
        expect(err).toContain(`nexus close --epic ${EPIC}`);
        expect(err).not.toContain("Nothing was created");
        expect(h.commits).toEqual([]);
        expect(h.posted).toEqual([]);
    });
});

describe("a re-run never files a second stub (story #866, D9, G21)", () => {
    const keyOf = (id: string) => `<!-- nexus:close-stub epic: ${ISSUES}#${EPIC} pr: ${ISSUES}#${PR} proposal: ${id} -->`;

    it("reuses a stub an earlier run filed, found through the epic's back-references by its key, even once promoted", () => {
        const h = harness({
            verdict: () => present(approvedVerdict("DS1", "DS2")),
            // Promoted: the unplanned label is gone and the body was rewritten, but the key line remains.
            epicMentions: () => ({ ok: true, issues: [{ number: 700, repo: ISSUES, body: `A planned epic now\n\n${keyOf("DS1")}\n`, pullRequest: false, trusted: true }] }),
        });
        const { record, stdout } = closed(h);
        expect(h.filed.flat().map((s) => s.title)).toEqual(["Goal of DS2"]);
        expect(sectionOf(record, "## Deferred Scope")).toContain("- #700 — Goal of DS1");
        expect(sectionOf(record, "## Deferred Scope")).toContain("- #1000 — Goal of DS2");
        expect(stdout).toMatch(/1 filed now, 1 found from an earlier run/);
    });

    it("files nothing when every approved proposal already has its stub", () => {
        const h = harness({
            verdict: () => present(approvedVerdict("DS1")),
            epicMentions: () => ({ ok: true, issues: [{ number: 700, repo: ISSUES, body: keyOf("DS1"), pullRequest: false, trusted: true }] }),
        });
        closed(h);
        expect(h.filed).toEqual([]);
        expect(h.writes).not.toContain("stubs");
    });

    it("does not take a key copied into a pull request, an untrusted issue or another repository's issue", () => {
        const h = harness({
            verdict: () => present(approvedVerdict("DS1")),
            epicMentions: () => ({
                ok: true,
                issues: [
                    { number: 701, repo: ISSUES, body: keyOf("DS1"), pullRequest: true, trusted: true },
                    { number: 702, repo: ISSUES, body: keyOf("DS1"), pullRequest: false, trusted: false },
                    { number: 703, repo: "evil/fork", body: keyOf("DS1"), pullRequest: false, trusted: true },
                ],
            }),
        });
        const { record } = closed(h);
        expect(h.filed.flat()).toHaveLength(1);
        expect(sectionOf(record, "## Deferred Scope")).toContain("- #1000 — Goal of DS1");
    });

    it("stops before creating anything when the back-references cannot be read", () => {
        const h = harness({ verdict: () => present(approvedVerdict("DS1")), epicMentions: () => ({ ok: false, message: "HTTP 502" }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain("HTTP 502");
        expect(h.writes).toEqual([]);
    });

    it("does not read the back-references when nothing was approved", () => {
        let read = 0;
        closed(harness({ epicMentions: () => ((read += 1), { ok: true, issues: [] }) }));
        expect(read).toBe(0);
    });
});

describe("the storyless waiver on the story's own issue (story #866, AC2, D10, G5, G22)", () => {
    it("lets a story no pull request claims pass on a trusted waiver comment, and writes its marker before the close comment", () => {
        const h = storylessHarness();
        const { record, stdout } = closed(h);
        expect(h.writes.indexOf("marker #865")).toBeGreaterThanOrEqual(0);
        expect(h.writes.indexOf("marker #865")).toBeLessThan(h.writes.indexOf(`comment #${EPIC}`));
        expect(sectionOf(record, "## Waived Stories")).toBe("- #865 — waived 2026-10-02");
        expect(stdout).toMatch(/#865 storyless, waived 2026-10-02 by @lead/);
    });

    it("reads the waived story as excluded, so the stamps are what a re-run with the marker writes", () => {
        const h = storylessHarness();
        const first = closed(h).record;
        expect(h.rangeCalls).toEqual([[], [865]]);
        const rerun = storylessHarness({ excludedStories: () => [865] });
        const second = closed(rerun).record;
        expect(rerun.rangeCalls).toEqual([[865]]);
        expect(rerun.writes).not.toContain("marker #865");
        expect(second).toBe(first);
    });

    it("stops on a waiver from someone who cannot speak for the issues repository, naming it, and writes nothing", () => {
        const h = storylessHarness({ storyWaivers: () => ({ ok: true, comments: [storylessComment(865, { trusted: false, author: "drive-by" })] }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain("@drive-by");
        expect(err).toMatch(/cannot speak for/);
        expect(err).toContain("waive: storyless");
        expect(h.writes).toEqual([]);
    });

    it("stops, never reading a failed read as no waiver, when the story's comments cannot be read", () => {
        const h = storylessHarness({ storyWaivers: () => ({ ok: false, message: "HTTP 502" }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toMatch(/#865.*could not be read/);
        expect(err).toContain("HTTP 502");
    });

    it("stops before the record is committed when the marker cannot be written", () => {
        const h = storylessHarness({ writeMarker: () => ({ ok: false, message: 'could not add the "no-pull-request" label' }) });
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h)));
        expect(rendered.exitCode).toBe(1);
        expect(text(rendered.stderr)).toContain("no-pull-request");
        expect(h.commits).toEqual([]);
        expect(h.posted).toEqual([]);
    });

    it("does not read story comments for a story whose pull request claims it", () => {
        const read: number[] = [];
        closed(harness({ storyWaivers: (_r, _repo, story) => (read.push(story), { ok: true, comments: [] }) }));
        expect(read).toEqual([]);
    });
});

describe("close writes in a fixed order and hands off only on full success (story #866, AC3, D11, G17, G23, G43, G46)", () => {
    it("writes stubs, markers, the commit, the push, the amendment, the close comment and the epic close, in that order", () => {
        const h = storylessHarness({
            verdict: () => present(emptyJudgments({ ...approvedVerdict("DS1"), items: [departure("DV1", { supersedes: { decision: "D2", instead: "x" } })] })),
        });
        closed(h);
        expect(h.writes).toEqual(["stubs", "marker #865", "commit", "push", "amendment", `comment #${EPIC}`, `close #${EPIC}`]);
    });

    it("posts the close comment on the epic in the issues repository, and closes only the epic, never a sub-issue", () => {
        const targets: string[] = [];
        const h = harness({
            postComment: (_root, repo, issue) => (targets.push(`comment ${repo}#${issue}`), { ok: true }),
            closeIssue: (_root, repo, issue) => (targets.push(`close ${repo}#${issue}`), { ok: true, already: false }),
        });
        const { comment } = closed(h);
        expect(targets).toEqual([`comment ${ISSUES}#${EPIC}`, `close ${ISSUES}#${EPIC}`]);
        expect(comment).toContain(`issues_repo: ${ISSUES}`);
    });

    it("writes the hand-off note in today's three-line format and names it", () => {
        const h = harness();
        const note = path.join(h.repoRoot, "run", "handoff.txt");
        const { stdout } = closed(h, { handoff: note });
        expect(fs.readFileSync(note, "utf8")).toBe(`epic: ${EPIC}\nbranch: distill/2026-10-04-epic-${EPIC}\nworktree: ${h.wtPath}\n`);
        expect(stdout).toContain(`Hand-off note written: ${note}`);
    });

    it("hands the next step to the close script, and names no drain to run by hand, when a hand-off was asked for (story #817)", () => {
        const h = harness();
        const { stdout } = closed(h, { handoff: path.join(h.repoRoot, "run", "handoff.txt") });
        expect(stdout).toContain("utils/close-epic.sh continues from here");
        expect(stdout).not.toContain("/nxs.distill");
    });

    it("ends by naming the drain in the worktree when no hand-off was asked for", () => {
        const h = harness();
        const { stdout } = closed(h);
        expect(stdout).toContain(`cd ${h.wtPath} && /nxs.distill`);
        expect(stdout).toMatch(/Epic issue: +acme\/app#830 — closed/);
    });

    it("handles an epic issue that is already closed without error (G49)", () => {
        const h = harness({ closeIssue: () => ({ ok: true, already: true }) });
        const { stdout } = closed(h);
        expect(stdout).toMatch(/already closed/);
    });
});

describe("a failed write stops close where a re-run can finish it (story #866, AC4, D11, G24, G25)", () => {
    it("stops on a failed push before the amendment and the close comment, with the epic open and no hand-off note (G24)", () => {
        const h = harness({ verdict: () => present(emptyJudgments({ items: [departure("DV1", { supersedes: { decision: "D2", instead: "x" } })] })), push: () => ({ ok: false, message: "rejected: permission denied" }) });
        const note = path.join(h.repoRoot, "handoff.txt");
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h, { handoff: note })));
        expect(rendered.exitCode).toBe(1);
        const err = text(rendered.stderr);
        expect(err).toContain("permission denied");
        expect(err).toMatch(/stays open/);
        expect(err).toContain(`nexus close --epic ${EPIC}`);
        expect(h.posted).toEqual([]);
        expect(h.writes).not.toContain(`close #${EPIC}`);
        expect(fs.existsSync(note)).toBe(false);
    });

    it("stops on a failed close comment with the epic open, naming re-running nexus close as what posts it (G25)", () => {
        const h = harness({ postComment: (_r, _repo, issue) => (issue === EPIC ? { ok: false, message: "HTTP 502" } : { ok: true }) });
        const note = path.join(h.repoRoot, "handoff.txt");
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h, { handoff: note })));
        expect(rendered.exitCode).toBe(1);
        const err = text(rendered.stderr);
        expect(err).toMatch(/close comment did not post/);
        expect(err).toMatch(/stays open/);
        expect(err).toMatch(new RegExp(`remedy: re-run nexus close --epic ${EPIC}.*posts it`));
        expect(err).toMatch(/committed and pushed the close record/);
        expect(h.writes).not.toContain(`close #${EPIC}`);
        expect(fs.existsSync(note)).toBe(false);
    });

    it("stops when the hand-off note cannot be written, after closing the epic", () => {
        const h = harness();
        const blocker = path.join(h.repoRoot, "file");
        fs.writeFileSync(blocker, "x");
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h, { handoff: path.join(blocker, "handoff.txt") })));
        expect(rendered.exitCode).toBe(1);
        expect(text(rendered.stderr)).toMatch(/hand-off note could not be written/);
        expect(h.writes).toContain(`close #${EPIC}`);
    });

    it("stops with no hand-off note when the epic issue cannot be closed", () => {
        const h = harness({ closeIssue: () => ({ ok: false, message: "HTTP 403" }) });
        const note = path.join(h.repoRoot, "handoff.txt");
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h, { handoff: note })));
        expect(rendered.exitCode).toBe(1);
        expect(text(rendered.stderr)).toContain("HTTP 403");
        expect(fs.existsSync(note)).toBe(false);
    });

    it("finishes on a re-run after a failed push with no second stub, amendment, close comment or branch (G26)", () => {
        const key = `<!-- nexus:close-stub epic: ${ISSUES}#${EPIC} pr: ${ISSUES}#${PR} proposal: DS1 -->`;
        const verdict = emptyJudgments({ ...approvedVerdict("DS1"), items: [departure("DV1", { supersedes: { decision: "D2", instead: "x" } })] });
        const first = harness({ verdict: () => present(verdict), push: () => ({ ok: false, message: "network down" }) });
        expect(runCloseCommand(first.deps, input(first)).ok).toBe(false);
        expect(first.filed).toHaveLength(1);

        // The re-run: the earlier stub is a back-reference, the branch is the earlier run's.
        const rerun = harness({
            verdict: () => present(verdict),
            epicMentions: () => ({ ok: true, issues: [{ number: 1000, repo: ISSUES, body: key, pullRequest: false, trusted: true }] }),
            openWorktree: () => ({ ok: true, wtPath: first.wtPath, branch: `distill/2026-10-04-epic-${EPIC}`, source: "local" }),
        });
        const { record } = closed(rerun);
        expect(rerun.filed).toEqual([]);
        expect(sectionOf(record, "## Deferred Scope")).toContain("- #1000 — Goal of DS1");
        expect(rerun.writes).toEqual(["commit", "push", "amendment", `comment #${EPIC}`, `close #${EPIC}`]);
    });
});

describe("once the close comment exists, a re-run regenerates nothing (story #866, D11, G27)", () => {
    const closeComment = { body: `## Close Record\n\n<!-- nexus:close-record -->\n\`\`\`yaml\nepic: "#${EPIC}"\n\`\`\``, authorAssociation: "OWNER" };

    it("only closes the issue, writes the hand-off note and reports", () => {
        let resolvedEpic = 0;
        const h = harness({
            issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === EPIC ? [closeComment] : [] }),
            resolveEpic: () => {
                resolvedEpic += 1;
                throw new Error("a resumed close reads no gate");
            },
            findDistillBranch: () => ({ ok: true, branch: `distill/2026-10-03-epic-${EPIC}`, source: "pushed" }),
            openWorktree: () => ({ ok: true, wtPath: h.wtPath, branch: `distill/2026-10-03-epic-${EPIC}`, source: "pushed" }),
        });
        const note = path.join(h.repoRoot, "handoff.txt");
        const out = runCloseCommand(h.deps, input(h, { handoff: note }));
        const rendered = renderCloseOutcome(out);
        expect(rendered.exitCode).toBe(0);
        expect(out.ok && out.resumed).toBe(true);
        expect(resolvedEpic).toBe(0);
        expect(h.writes).toEqual([`close #${EPIC}`]);
        expect(fs.readFileSync(note, "utf8")).toBe(`epic: ${EPIC}\nbranch: distill/2026-10-03-epic-${EPIC}\nworktree: ${h.wtPath}\n`);
        expect(text(rendered.stdout)).toMatch(/nothing was regenerated or reposted/);
    });

    it("reports the merged pull requests the earlier run's close comment stamped (#906)", () => {
        const stamped = {
            body: `## Close Record\n\n<!-- nexus:close-record -->\n\`\`\`yaml\nepic: "#${EPIC}"\nrange:\n  - { repo: ${ISSUES}, pr: ${PR} }\n  - { repo: acme/member, pr: 704 }\n\`\`\``,
            authorAssociation: "OWNER",
        };
        const h = harness({
            issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === EPIC ? [stamped] : [] }),
            findDistillBranch: () => ({ ok: true, branch: `distill/2026-10-03-epic-${EPIC}`, source: "local" }),
            openWorktree: () => ({ ok: true, wtPath: h.wtPath, branch: `distill/2026-10-03-epic-${EPIC}`, source: "local" }),
        });
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h)));
        expect(rendered.exitCode).toBe(0);
        expect(text(rendered.stdout)).toMatch(new RegExp(`Pull requests:.*${ISSUES}#${PR}.*acme/member#704`));
    });

    it("handles the epic issue already being closed (G49)", () => {
        const h = harness({
            issueComments: () => ({ ok: true, comments: [closeComment] }),
            findDistillBranch: () => ({ ok: true, branch: `distill/2026-10-03-epic-${EPIC}`, source: "local" }),
            openWorktree: () => ({ ok: true, wtPath: h.wtPath, branch: `distill/2026-10-03-epic-${EPIC}`, source: "local" }),
            closeIssue: () => ({ ok: true, already: true }),
        });
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h)));
        expect(rendered.exitCode).toBe(0);
        expect(text(rendered.stdout)).toMatch(/already closed/);
    });

    it("does not count a copy of the close comment from someone who cannot speak for the repository", () => {
        const h = harness({ issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === EPIC ? [{ ...closeComment, authorAssociation: "NONE" }] : [] }) });
        const { out } = closed(h);
        expect(out.resumed).toBe(false);
        expect(h.writes).toContain(`comment #${EPIC}`);
    });

    it("stops, naming distill's recovery, with no branch or worktree created, when the earlier run's distill branch is gone (G3)", () => {
        const note = path.join(makeDir(), "handoff.txt");
        const h = harness({ issueComments: () => ({ ok: true, comments: [closeComment] }) });
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h, { handoff: note })));
        expect(rendered.exitCode).toBe(1);
        expect(text(rendered.stderr)).toContain(`/nxs.distill --recover ${EPIC}`);
        expect(h.worktreeCalls).toBe(0);
        expect(h.writes).toEqual([]);
        expect(fs.existsSync(note)).toBe(false);
    });

    it("stops, with nothing created, when the earlier run's distill branch cannot be looked up (G3)", () => {
        const h = harness({
            issueComments: () => ({ ok: true, comments: [closeComment] }),
            findDistillBranch: () => ({ ok: false, error: { problem: "git-failed", message: "the distill branches pushed to origin could not be read" } }),
        });
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h)));
        expect(rendered.exitCode).toBe(1);
        expect(text(rendered.stderr)).toContain("could not be read");
        expect(h.worktreeCalls).toBe(0);
        expect(h.writes).toEqual([]);
    });

    it("stops when the earlier run's distill branch cannot be opened", () => {
        const h = harness({
            issueComments: () => ({ ok: true, comments: [closeComment] }),
            findDistillBranch: () => ({ ok: true, branch: `distill/2026-10-03-epic-${EPIC}`, source: "local" }),
            openWorktree: () => ({ ok: false, error: { problem: "git-failed", message: "origin unreachable" } }),
        });
        const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h)));
        expect(rendered.exitCode).toBe(1);
        expect(text(rendered.stderr)).toContain("origin unreachable");
    });

    describe("a re-run posts an amendment an earlier run did not (G26, G28)", () => {
        const stamped = (hash = RECORD_DIGEST) => ({
            body: [
                "## Close Record",
                "",
                "<!-- nexus:close-record -->",
                "```yaml",
                `epic: "#${EPIC}"`,
                `record: "#${RECORD}"`,
                `record_hash: ${hash}`,
                "range:",
                `  - repo: ${ISSUES}`,
                `    pr: ${PR}`,
                `    base: ${"b".repeat(40)}`,
                `    head: ${"m".repeat(40)}`,
                "```",
            ].join("\n"),
            authorAssociation: "OWNER",
        });
        const superseding = (): Judgments => emptyJudgments({ items: [departure("DV1", { supersedes: { decision: "D2", instead: "falls back to a model pass" } })] });
        const rerun = (over: Partial<CloseCommandDeps> = {}, closeComment = stamped()): Harness => {
            const h = harness({
                issueComments: (_r, _repo, issue) => ({ ok: true, comments: issue === EPIC ? [closeComment] : [] }),
                findDistillBranch: () => ({ ok: true, branch: `distill/2026-10-03-epic-${EPIC}`, source: "local" }),
                openWorktree: () => ({ ok: true, wtPath: h.wtPath, branch: `distill/2026-10-03-epic-${EPIC}`, source: "local" }),
                verdict: () => present(superseding()),
                ...over,
            });
            return h;
        };

        it("posts the missing amendment once, before closing the epic, and still regenerates nothing else", () => {
            const h = rerun();
            const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h)));
            expect(rendered.exitCode).toBe(0);
            expect(h.writes).toEqual(["amendment", `close #${EPIC}`]);
            expect(amendments(h)).toHaveLength(1);
            expect(amendments(h)[0].body).toContain("**D2 — No model fallback: A verdict without judgments stops close.** → **shipped:** falls back to a model pass.");
            expect(amendments(h)[0].body).toContain(`<!-- nexus:close-amendment epic: ${ISSUES}#${EPIC} -->`);
            expect(text(rendered.stdout)).toMatch(/Record amendment: .*1 superseding decision\(s\) posted/);
        });

        it("reads no verdict and posts nothing when the amendment is already on the record", () => {
            let verdictReads = 0;
            const h = rerun({
                issueComments: (_r, _repo, issue) => ({
                    ok: true,
                    comments: issue === EPIC ? [stamped()] : [{ body: `<!-- nexus:close-amendment epic: ${ISSUES}#${EPIC} -->`, authorAssociation: "MEMBER" }],
                }),
                verdict: () => {
                    verdictReads += 1;
                    return present(superseding());
                },
            });
            expect(renderCloseOutcome(runCloseCommand(h.deps, input(h))).exitCode).toBe(0);
            expect(verdictReads).toBe(0);
            expect(h.writes).toEqual([`close #${EPIC}`]);
        });

        it("posts nothing when no departure is marked superseding", () => {
            const h = rerun({ verdict: () => present(emptyJudgments({ items: [departure("DV1")] })) });
            expect(renderCloseOutcome(runCloseCommand(h.deps, input(h))).exitCode).toBe(0);
            expect(h.writes).toEqual([`close #${EPIC}`]);
        });

        it("reports, prints nothing to post by hand it cannot build, and still finishes when a verdict cannot be read (G48)", () => {
            const h = rerun({ verdict: () => ({ ok: false, cause: "HTTP 502" }) });
            const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h)));
            expect(rendered.exitCode).toBe(0);
            expect(h.writes).toEqual([`close #${EPIC}`]);
            expect(text(rendered.stdout)).toMatch(/Record amendment: .*NOT CHECKED[^\n]*HTTP 502/);
        });

        it("posts nothing, and says so, when the record was revised since the close", () => {
            const h = rerun({}, stamped("0".repeat(64)));
            const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h)));
            expect(rendered.exitCode).toBe(0);
            expect(h.writes).toEqual([`close #${EPIC}`]);
            expect(text(rendered.stdout)).toMatch(/Record amendment: .*NOT CHECKED[^\n]*revised since the close[^\n]*nexus close --recover/);
        });

        it("prints the amendment to post by hand when the re-run's post fails", () => {
            const h = rerun({ postComment: (_root, _repo, issue) => (issue === RECORD ? { ok: false, message: "HTTP 403" } : { ok: true }) });
            const rendered = renderCloseOutcome(runCloseCommand(h.deps, input(h)));
            expect(rendered.exitCode).toBe(0);
            expect(text(rendered.stdout)).toMatch(/NOT POSTED — HTTP 403/);
            expect(text(rendered.stdout)).toContain("## Amended at close — 1 decision(s) superseded");
        });
    });

    it("stops when the epic's comments cannot be read, before anything is created", () => {
        const h = harness({ issueComments: () => ({ ok: false, message: "HTTP 502" }) });
        const err = expectStop(h, runCloseCommand(h.deps, input(h)));
        expect(err).toContain("HTTP 502");
    });
});

// The platform-backed reads and writes story #866 adds, over a stand-in gh.
describe("nexus close — the back-references, the epic close, the marker and the story comments (story #866)", () => {
    function recorder(responses: (args: string[]) => { status: number; stdout: string; stderr: string }): { run: Runner; calls: string[][] } {
        const calls: string[][] = [];
        return {
            calls,
            run: (cmd, args) => {
                calls.push([cmd, ...args]);
                return responses(args);
            },
        };
    }
    const deps = (run: Runner) => closeCommandDeps(run, { singleRepo: () => true });

    it("reads a repository-qualified pull request on the checkout's own forge (#906)", () => {
        const viaGh = (remote: string, host?: string) => {
            const rec = recorder((args) =>
                args.includes("get-url") ? { status: 0, stdout: `${remote}\n`, stderr: "" } : args.includes("remote") ? { status: 0, stdout: "origin\n", stderr: "" } : { status: 1, stdout: "", stderr: "stop" },
            );
            deps(rec.run).readPr("/repo", { repo: "acme/member", number: 7, ...(host === undefined ? {} : { host }) });
            const gh = rec.calls.find((c) => c[0] === "gh" && c[1] === "pr") ?? [];
            return gh[gh.indexOf("--repo") + 1];
        };
        expect(viaGh("git@github.com:acme/hub.git")).toBe("github.com/acme/member");
        expect(viaGh("https://ghe.corp/acme/hub.git")).toBe("ghe.corp/acme/member");
        // A URL on another forge already carries its host.
        expect(viaGh("git@github.com:acme/hub.git", "ghe.other")).toBe("ghe.other/acme/member");
        // A github.com URL read from a checkout on another forge is still read on github.com.
        expect(viaGh("https://ghe.corp/acme/hub.git", "github.com")).toBe("github.com/acme/member");
    });

    it("reads the epic in an issues repository configured as a URL", () => {
        const rec = recorder(() => ({ status: 0, stdout: JSON.stringify({ data: { repository: { issue: null } } }), stderr: "" }));
        for (const configured of ["https://github.com/acme/issues", "https://github.com/acme/issues/", "https://github.com/acme/issues.git"]) {
            deps(rec.run).issueKind(makeDir(), configured, 50);
            expect(rec.calls.at(-1), configured).toEqual(expect.arrayContaining(["owner=acme", "repo=issues"]));
        }
    });

    it("reads what an issue is filed as, and its parent, in the issues repository (#906)", () => {
        const root = makeDir();
        fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), "github:\n  classification: labels\n  project: none\n");
        const issue = (doc: unknown) => recorder(() => ({ status: 0, stdout: JSON.stringify({ data: { repository: { issue: doc } } }), stderr: "" }));

        const story = issue({ parent: { number: EPIC }, labels: { nodes: [{ name: "story" }] }, state: "OPEN" });
        expect(deps(story.run).issueKind(root, "acme/issues", 864)).toEqual({ ok: true, exists: true, kind: "story", parent: EPIC });
        expect(story.calls[0]).toEqual(expect.arrayContaining(["owner=acme", "repo=issues", "num=864"]));
        expect(deps(issue({ labels: { nodes: [{ name: "epic" }] }, state: "OPEN" }).run).issueKind(root, "acme/issues", EPIC)).toEqual({ ok: true, exists: true, kind: "epic", parent: null });
        expect(deps(issue(null).run).issueKind(root, "acme/issues", 50)).toEqual({ ok: true, exists: false, kind: "other", parent: null });
        expect(deps(recorder(() => ({ status: 1, stdout: "", stderr: "HTTP 502" })).run).issueKind(root, "acme/issues", 50).ok).toBe(false);
    });

    it("lists the issues that mention the epic from its timeline's cross-references, never search, with each one's trust", () => {
        const lines = [
            JSON.stringify({ number: 700, body: "stub", repo: ISSUES, pullRequest: false, association: "MEMBER" }),
            JSON.stringify({ number: 701, body: "pr", repo: ISSUES, pullRequest: true, association: "NONE" }),
        ].join("\n");
        const ok = recorder(() => ({ status: 0, stdout: `${lines}\n`, stderr: "" }));
        expect(deps(ok.run).epicMentions("/repo", ISSUES, EPIC)).toEqual({
            ok: true,
            issues: [
                { number: 700, repo: ISSUES, body: "stub", pullRequest: false, trusted: true },
                { number: 701, repo: ISSUES, body: "pr", pullRequest: true, trusted: false },
            ],
        });
        const call = ok.calls[0].join(" ");
        expect(call).toContain(`api --paginate repos/${ISSUES}/issues/${EPIC}/timeline`);
        expect(call).toContain("cross-referenced");
        expect(call).not.toMatch(/search/);
        expect(deps(recorder(() => ({ status: 1, stdout: "", stderr: "HTTP 502" })).run).epicMentions("/repo", ISSUES, EPIC)).toEqual({ ok: false, message: "HTTP 502" });
        expect(deps(recorder(() => ({ status: 0, stdout: "{not json\n", stderr: "" })).run).epicMentions("/repo", ISSUES, EPIC).ok).toBe(false);
    });

    it("resolves the epic from the issues repository, not the checkout's own (G46)", () => {
        const rec = recorder((args) => {
            if (args[0] === "issue" && args[1] === "view") {
                return { status: 0, stdout: JSON.stringify({ number: EPIC, title: "t", body: "b", state: "OPEN", stateReason: "", labels: [] }), stderr: "" };
            }
            return { status: 0, stdout: "", stderr: "" };
        });
        deps(rec.run).resolveEpic("/repo", "acme/issues", EPIC);
        const gh = rec.calls.filter((c) => c[0] === "gh").map((c) => c.slice(1).join(" "));
        expect(gh.length).toBeGreaterThan(0);
        expect(gh.filter((c) => c.startsWith("repo view"))).toEqual([]);
        expect(gh.find((c) => c.startsWith(`issue view ${EPIC}`))).toContain("--repo acme/issues");
    });

    it("closes an open epic issue as completed in the issues repository, and leaves a closed one alone", () => {
        const open = recorder((args) => ({ status: 0, stdout: args[1] === "view" ? "OPEN\n" : "", stderr: "" }));
        expect(deps(open.run).closeIssue("/repo", ISSUES, EPIC)).toEqual({ ok: true, already: false });
        expect(open.calls[1]).toEqual(["gh", "issue", "close", String(EPIC), "--repo", ISSUES, "--reason", "completed"]);
        const closedOne = recorder(() => ({ status: 0, stdout: "CLOSED\n", stderr: "" }));
        expect(deps(closedOne.run).closeIssue("/repo", ISSUES, EPIC)).toEqual({ ok: true, already: true });
        expect(closedOne.calls).toHaveLength(1);
        expect(deps(recorder(() => ({ status: 1, stdout: "", stderr: "HTTP 404" })).run).closeIssue("/repo", ISSUES, EPIC)).toEqual({ ok: false, message: "HTTP 404" });
        const refused = recorder((args) => (args[1] === "view" ? { status: 0, stdout: "OPEN", stderr: "" } : { status: 1, stdout: "", stderr: "HTTP 403" }));
        expect(deps(refused.run).closeIssue("/repo", ISSUES, EPIC)).toEqual({ ok: false, message: "HTTP 403" });
    });

    it("writes the marker on the story in the issues repository, through the existing marker writer", () => {
        const ok = recorder(() => ({ status: 0, stdout: "", stderr: "" }));
        expect(deps(ok.run).writeMarker("/repo", ISSUES, 865)).toEqual({ ok: true });
        expect(ok.calls[0]).toEqual(["gh", "issue", "edit", "865", "--repo", ISSUES, "--add-label", "no-pull-request"]);
        expect(deps(recorder(() => ({ status: 1, stdout: "", stderr: "HTTP 403" })).run).writeMarker("/repo", ISSUES, 865).ok).toBe(false);
    });

    it("files stubs through the batch filer into the issues repository, and pushes the distill branch", () => {
        const root = makeDir();
        fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), "github:\n  classification: labels\n  project: none\n");
        const created: string[] = [];
        const filerEnv = {
            runnerFor: () => (args: string[]) => {
                if (args[0] === "issue" && args[1] === "create") {
                    created.push(args.join(" "));
                    return { status: 0, stdout: "https://github.com/acme/app/issues/1200\n", stderr: "" };
                }
                return { status: 0, stdout: "", stderr: "" };
            },
            sleep: () => undefined,
            random: () => 0,
        };
        const d = closeCommandDeps(() => ({ status: 1, stdout: "", stderr: "no remote" }), { singleRepo: () => true, filerEnv });
        const r = d.fileStubs(fs.realpathSync(root), ISSUES, EPIC, [{ ref: "STUB-acme-app-901-DS1", key: "k", title: "Goal", body: "Goal\n" }]);
        expect(r.ok && [...r.numbers.entries()]).toEqual([["k", 1200]]);
        expect(created[0]).toContain(`-R ${ISSUES}`);
        expect(d.push(root, "distill/2026-10-04-epic-830")).toEqual({ ok: false, message: "no remote" });
    });

    it("reads the storyless waivers from the story's own issue in the issues repository", () => {
        const body = `<!-- nexus:close-waiver -->\n\`\`\`yaml\nwaive: storyless\nstory: "#865"\n\`\`\``;
        const ok = recorder(() => ({ status: 0, stdout: JSON.stringify({ comments: [{ body, author: { login: "lead" }, authorAssociation: "OWNER", createdAt: "2026-10-02T00:00:00Z", url: "u" }] }), stderr: "" }));
        const r = deps(ok.run).storyWaivers("/repo", ISSUES, 865);
        expect(r.ok && r.comments.map((c) => [c.author, c.trusted])).toEqual([["lead", true]]);
        expect(ok.calls[0]).toEqual(["gh", "issue", "view", "865", "--repo", ISSUES, "--json", "comments"]);
        expect(deps(recorder(() => ({ status: 1, stdout: "", stderr: "HTTP 502" })).run).storyWaivers("/repo", ISSUES, 865).ok).toBe(false);
    });
});
