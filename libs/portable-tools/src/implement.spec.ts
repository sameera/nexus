/**
 * `nexus implement` (epic #928, story #929, decision record #966): one command implements an
 * approved epic unattended. The platform is injected, so each case states what git, the issue graph,
 * the harness and the published verdicts say, and asserts what the command did about it.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type Departure, type Finding, type Judgments } from "@nexus/pr-acceptance/judgments-block";
import { type PrAnswer } from "@nexus/pr-acceptance/waiver";
import { type SessionEnd, type SessionSpec } from "./distill-command.js";
import { CLEAN_VERDICT as READER_CLEAN_VERDICT, HLD_MARKER, commentDigest, commentVerdict, isCleanVerdict, isHldComment as isHldCommentLine, newestHldComment, type RecordComment } from "./implement-hld.js";
import { BLOCKED_PREFIX, ESCALATION_PREFIX, STATUS_OPEN, UNATTENDED_CLAUSE, implementationPrompt, runImplementEpic, type Commit, type EpicFacts, type ImplementDeps, type ImplementInput, type VerdictRead } from "./implement.js";
import { VERB_NAMES } from "./nexus-cli.js";

const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");

const finding = (id: string, severity: Finding["severity"], over: Partial<Finding> = {}): Finding => ({
    id,
    kind: "finding",
    found: true,
    severity,
    about: "#1 AC1",
    summary: `${id} is wrong`,
    files: ["src/a.ts"],
    answer: null,
    fix: `fix ${id}`,
    ...over,
});

const departure = (id: string, over: Partial<Departure> = {}): Departure => ({
    id,
    kind: "departure",
    found: true,
    severity: "high",
    departsFrom: "D2",
    summary: `${id} departs`,
    files: ["src/a.ts"],
    stub: null,
    supersedes: null,
    answer: null,
    ...over,
});

const judged = (...items: Array<Departure | Finding>): Judgments => ({
    items: items.filter((i): i is Departure => i.kind === "departure"),
    findings: items.filter((i): i is Finding => i.kind === "finding"),
    deferred: [],
});

const DIGEST = "a".repeat(64);
const STORE_SHA = "c".repeat(40);
const PAGE_URL = `https://github.com/o/store/blob/${STORE_SHA}/features/epic-7/hld.md`;
const PAGE_TEXT = "# HLD: Epic\n\n```mermaid\nflowchart LR\n  a --> b\n```\n";
const CLEAN_VERDICT = "All acceptance criteria achievable, no decision violated";

/** A comment as /nxs.hld posts it on the record, with the parts a case varies. */
function hldBody(over: { digest?: string | null; verdict?: string | null; link?: string } = {}): string {
    const digest = over.digest === undefined ? DIGEST : over.digest;
    const verdict = over.verdict === undefined ? CLEAN_VERDICT : over.verdict;
    return [
        HLD_MARKER,
        "## High-level design",
        "",
        `Rendered 2026-11-04 from this record at ${digest === null ? "an unknown digest" : `digest \`${digest}\``}, against o/r@abc.`,
        "",
        `- Design: [hld.md](${over.link ?? PAGE_URL})`,
        ...(verdict === null ? [] : [`- Verdict: ${verdict}`]),
        "- Choices the record left open: 2, listed in the page's section 13.",
    ].join("\n");
}

const comment = (body: string, createdAt: string, authorAssociation: string | null = "OWNER", url = `https://x/c/${createdAt}`): RecordComment => ({ body, createdAt, authorAssociation, url });

const storyCommit = (n: number, sha: string = `sha${n}`): Commit => ({ sha, message: `story ${n}\n\nCloses #${n}\n` });

interface World {
    facts: Partial<EpicFacts>;
    clean: boolean;
    /** The run branch's local tip, or null when no local branch exists. */
    local: string | null;
    /** The run branch's tip on the remote, or null when the remote has no such branch. */
    remote: string | null;
    /** Ancestry the fake git knows, as `<older><<newer>` pairs. */
    ancestry: string[];
    /** The newest commit the run branch shares with the remote base, or null when none. */
    fork: string | null;
    /** The base branch of the branch's open pull request. */
    prBase: string;
    fetchFails: boolean;
    /** The commits already on the run branch when a re-run starts; `commits` when absent. */
    existing?: Commit[];
    /** The run branch's tips the build stage makes, one per watcher wait, with the commits up to each. */
    buildTips: Array<{ tip: string; commits: Commit[] }>;
    /** How many pushes fail before one succeeds. */
    pushFailures: number;
    /** How many attempts to open the pull request fail before one succeeds. */
    createPrFailures?: number;
    /** Answer lines already on the pull request when the run starts. */
    priorAnswers?: PrAnswer[];
    /** Whether the build stage rewrote a commit that was on the branch when the run started. */
    rewritten: boolean;
    /** The branch the lead's checkout is on when the run starts. */
    checkout: string;
    auto: boolean;
    commits: Commit[];
    openPr: number | null;
    prRepo: string;
    /** The final message of each session, in order; a session past the list ends "done". */
    finals: string[];
    /** The judgments each analyze run publishes, in order; the last repeats. Null publishes nothing. */
    verdicts: Array<Judgments | null>;
    /** Answer lines that appear on the pull request during the session with this index. */
    answersDuring: Record<number, PrAnswer[]>;
    editFails: boolean;
    files: Record<string, string>;
    setting: string;
    /** The comments on the decision record; null when they cannot be read. */
    comments: RecordComment[] | null;
    /** The record's current digest; null when it cannot be read. */
    digest: string | null;
    /** The page text at each `<repo>@<commit>:<path>`; a page absent here cannot be read. */
    pages: Record<string, string>;
    /** Whether git ignores the page copy's folder. */
    ignored: boolean;
    /** Whether writing the page copy fails. */
    writeFails: boolean;
}

function world(over: Partial<World> = {}): World {
    return {
        facts: {},
        clean: true,
        local: null,
        remote: null,
        ancestry: [],
        fork: "fork",
        prBase: "main",
        fetchFails: false,
        rewritten: false,
        buildTips: [],
        pushFailures: 0,
        checkout: "main",
        auto: true,
        commits: [storyCommit(1), storyCommit(2)],
        openPr: null,
        prRepo: "o/r",
        finals: [],
        verdicts: [judged()],
        answersDuring: {},
        editFails: false,
        files: {},
        setting: "",
        comments: [],
        digest: DIGEST,
        pages: { [`o/store@${STORE_SHA}:features/epic-7/hld.md`]: PAGE_TEXT },
        ignored: true,
        writeFails: false,
        ...over,
    };
}

function harness(w: World) {
    const log: string[] = [];
    const sessions: SessionSpec[] = [];
    const bodies: string[] = [];
    const comments: string[] = [];
    const writes: Record<string, string> = {};
    let answers: PrAnswer[] = [...(w.priorAnswers ?? [])];
    let head = 0;
    let analyzeRuns = 0;
    let lastPublished: { head: string; judgments: Judgments } | null = null;
    let checkout = w.checkout;
    let cursor = 0;
    let buildDone: (() => void) | null = null;
    let pushFailures = w.pushFailures;
    let createPrFailures = w.createPrFailures ?? 0;
    const deps: ImplementDeps = {
        resolveEpic: () => ({
            ok: true,
            value: { title: "Epic", stories: [1, 2], blockedBy: new Map([[2, [1]]]), record: { number: 9, state: "closed" }, issuesRepo: "o/r", needsDesign: false, root: "/r", ...w.facts },
        }),
        testCommandSetting: () => w.setting,
        defaultBranch: () => "main",
        clean: () => w.clean,
        fetch: (_c, branch, base) => {
            log.push(`fetch ${branch} ${base}`);
            return w.fetchFails ? { ok: false, message: "could not resolve host" } : { ok: true, value: w.remote };
        },
        localTip: () => (cursor > 0 ? w.buildTips[cursor - 1].tip : w.local),
        isAncestor: (_c, a, b) => a === b || w.ancestry.includes(`${a}<${b}`) || (b.startsWith("head") && !w.rewritten),
        setLocalBranch: (_c, branch, sha) => {
            log.push(`set ${branch} ${sha}`);
            return { ok: true, value: null };
        },
        forkPoint: () => w.fork,
        prBase: () => w.prBase,
        switchBranch: (_c, branch) => {
            log.push(`switch ${branch}`);
            checkout = branch;
            return { ok: true, value: null };
        },
        createBranch: (_c, branch, base) => {
            log.push(`branch ${branch} ${base}`);
            checkout = branch;
            return { ok: true, value: "base" };
        },
        currentBranch: () => checkout,
        headSha: () => `head${head}`,
        commits: (_c, _base, tip) => (tip !== undefined ? (w.buildTips.find((t) => t.tip === tip)?.commits ?? w.existing ?? w.commits) : w.commits),
        push: (_c, branch) => {
            log.push(`push ${branch}`);
            if (pushFailures > 0) {
                pushFailures--;
                return { ok: false, value: undefined, message: "network is unreachable" } as never;
            }
            return { ok: true, value: null };
        },
        prRepo: () => w.prRepo,
        openPr: () => ({ ok: true, value: w.openPr ?? (log.includes("create-pr") ? 5 : null) }),
        createPr: (_c, p) => {
            if (createPrFailures > 0) {
                createPrFailures--;
                log.push("create-pr-failed");
                return { ok: false, message: "HTTP 502" } as never;
            }
            log.push("create-pr");
            bodies.push(p.body);
            return { ok: true, value: 5 };
        },
        prBody: () => bodies[bodies.length - 1] ?? "",
        editPrBody: (_c, _pr, body) => {
            if (w.editFails) return false;
            bodies.push(body);
            return true;
        },
        markReady: () => {
            log.push("ready");
            return true;
        },
        readVerdict: (): VerdictRead => (lastPublished === null ? { ok: true, found: false, prHead: `head${head}` } : { ok: true, found: true, head: lastPublished.head, prHead: `head${head}`, judgments: lastPublished.judgments }),
        answers: () => ({ ok: true, value: answers }),
        postComment: (_c, _pr, body) => {
            comments.push(body);
            return true;
        },
        recordComments: () => {
            log.push("comments");
            return w.comments === null ? { ok: false, message: "HTTP 502" } : { ok: true, value: w.comments };
        },
        recordDigest: () => {
            log.push("digest");
            return w.digest === null ? { ok: false, message: "gh-failed: HTTP 502" } : { ok: true, value: w.digest };
        },
        readPage: (_c, p) => {
            const key = `${p.repo}@${p.commit}:${p.path}`;
            log.push(`page ${key}`);
            const text = w.pages[key];
            return text === undefined ? { ok: false, message: "HTTP 404: Not Found" } : { ok: true, value: text };
        },
        ignored: () => w.ignored,
        writeFile: (_c, file, text) => {
            log.push(`write ${file}`);
            if (w.writeFails) return { ok: false, message: "EACCES: permission denied" };
            writes[file] = text;
            return { ok: true, value: null };
        },
        fileAt: (_c, sha, file) => {
            log.push(`file-at ${sha} ${file}`);
            return w.files[file] ?? null;
        },
        autoModeAvailable: () => w.auto,
        onPath: () => true,
        wait: async () => {
            if (cursor < w.buildTips.length) cursor++;
            else if (buildDone !== null) buildDone();
        },
        session: async (spec, _line, signal): Promise<SessionEnd> => {
            const index = sessions.length;
            sessions.push(spec);
            log.push(`session ${index}`);
            answers = [...answers, ...(w.answersDuring[index] ?? [])];
            if (index === 0 && w.buildTips.length > 0) {
                const end: SessionEnd = { started: true, exitCode: 0, error: null, finalMessage: w.finals[0] ?? "done" };
                return new Promise((resolve) => {
                    buildDone = () => {
                        log.push("build-end");
                        resolve(end);
                    };
                    signal?.addEventListener("abort", () => {
                        log.push("abort");
                        resolve({ ...end, exitCode: null });
                    });
                });
            }
            const prompt = spec.args.find((a) => a.includes("nxs.analyze --pr") || a.includes("$nxs-analyze --pr")) ?? "";
            if (prompt.startsWith("/nxs.analyze --pr") || prompt.startsWith("$nxs-analyze --pr")) {
                const j = w.verdicts[Math.min(analyzeRuns, w.verdicts.length - 1)];
                analyzeRuns++;
                if (j !== null) lastPublished = { head: `head${head}`, judgments: j };
            } else if (index > 0) {
                head++;
            }
            return { started: true, exitCode: 0, error: null, finalMessage: w.finals[index] ?? "done" };
        },
    };
    return { deps, log, sessions, bodies, comments, writes };
}

const input = (over: Partial<ImplementInput> = {}): ImplementInput => ({
    cwd: "/r",
    epic: 7,
    harness: "claude",
    permissionMode: null,
    testCommand: "npm test",
    base: null,
    turns: 40,
    fixTurns: 30,
    rounds: 5,
    harnessArgs: [],
    recordOnly: false,
    ...over,
});

async function run(w: World, over: Partial<ImplementInput> = {}) {
    const h = harness(w);
    const out: string[] = [];
    const err: string[] = [];
    const code = await runImplementEpic(h.deps, input(over), { stdout: (l) => out.push(l), stderr: (l) => err.push(l) });
    return { ...h, code, out: out.join("\n"), err: err.join("\n") };
}

describe("starting a run (G1, G3, G23)", () => {
    it.each<[string, Partial<World>, RegExp]>([
        ["an unapproved record", { facts: { record: { number: 9, state: "open" } } }, /record #9 .* not approved/],
        ["an epic that needs design and has no record", { facts: { record: null, needsDesign: true } }, /needs design and has no decision record/],
        ["a dirty working tree", { clean: false }, /uncommitted changes/],
        ["a fetch that fails, even on a fresh run", { fetchFails: true }, /could not be fetched/],
        ["auto mode unavailable", { auto: false }, /--permission-mode/],
    ])("refuses before any model runs on %s", async (_name, w, reason) => {
        const r = await run(world(w));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/stopped at preflight/);
        expect(r.err).toMatch(reason);
        expect(r.sessions).toHaveLength(0);
        expect(r.log.filter((l) => l.startsWith("push"))).toHaveLength(0);
    });

    it("runs claude stages in auto mode by default and prints the mode", async () => {
        const r = await run(world());
        expect(r.sessions[0].args).toEqual(expect.arrayContaining(["--permission-mode", "auto"]));
        expect(r.err).toMatch(/permission mode auto/);
    });

    it("takes a mode the lead passes even when auto mode is unavailable", async () => {
        const r = await run(world({ auto: false }), { permissionMode: "bypassPermissions" });
        expect(r.code).toBe(0);
        expect(r.sessions[0].args).toEqual(expect.arrayContaining(["--permission-mode", "bypassPermissions"]));
    });

    it("creates the epic's branch itself, off the default branch", async () => {
        const r = await run(world());
        expect(r.log.find((l) => l.startsWith("branch"))).toBe("branch nxs/epic-7 main");
    });
});

describe("implementation stage (G4, G5, G6)", () => {
    it("a blocked stage pushes nothing, opens no pull request and names what blocked it", async () => {
        const r = await run(world({ finals: [`I tried.\n${BLOCKED_PREFIX} R1 needs a staging account; grant one.`] }));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/stopped at implementation: .*R1 needs a staging account/);
        expect(r.sessions).toHaveLength(1);
        expect(r.log).not.toContain("push nxs/epic-7");
        expect(r.log).not.toContain("create-pr");
    });

    it("gives the stage a goal it can meet by the blocked outcome", async () => {
        const r = await run(world());
        expect(r.sessions[0].args[1]).toContain(BLOCKED_PREFIX);
        expect(r.sessions[0].args[1]).toContain("Before implementation");
    });

    it.each<[string, string | null]>([
        ["a declared test command", "npm test"],
        ["no declared test command", null],
    ])("tells the stage to write each story's tests before its code, with %s", async (_name, testCommand) => {
        const prompt = (await run(world({ finals: ["done\nTest command: pnpm vitest"] }), { testCommand })).sessions[0].args[1];
        expect(prompt).toMatch(/test-first/i);
        expect(prompt).toMatch(/write the tests that pin (its|the story's) acceptance criteria before the code that satisfies them/i);
    });

    it("asks for test-first, not a red-green-refactor TDD loop", async () => {
        const prompt = (await run(world())).sessions[0].args[1];
        expect(prompt).toMatch(/not test-driven development/i);
        expect(prompt).toMatch(/red-green-refactor/i);
    });

    it("requires the full suite to pass before each story's commit and forbids weakening a test to get there", async () => {
        const prompt = (await run(world())).sessions[0].args[1];
        expect(prompt).toMatch(/full test suite passes before (each|every) story's commit/i);
        expect(prompt).toMatch(/do not weaken, skip or delete a test/i);
    });

    it.each<[string, Commit[], RegExp]>([
        ["one combined commit", [{ sha: "x", message: "both\n\nCloses #1\nCloses #2" }], /more than one story/],
        ["a missing story", [storyCommit(1)], /no commit claims #2/],
        ["a story claimed twice", [storyCommit(1, "a"), storyCommit(1, "b"), storyCommit(2)], /#1 is claimed by more than one commit/],
        ["the wrong order", [storyCommit(2), storyCommit(1)], /#2 is committed before #1/],
    ])("pushes nothing for %s", async (_name, commits, reason) => {
        const r = await run(world({ commits }));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(reason);
        expect(r.log).not.toContain("push nxs/epic-7");
    });

    it("lets a follow-up commit that claims no story through", async () => {
        const r = await run(world({ commits: [storyCommit(1), { sha: "f", message: "tidy" }, storyCommit(2)] }));
        expect(r.code).toBe(0);
    });
});

describe("pull request (G7, G8)", () => {
    it("claims every live story in the draft's body", async () => {
        const r = await run(world());
        expect(r.bodies[0]).toMatch(/^Closes #1$/m);
        expect(r.bodies[0]).toMatch(/^Closes #2$/m);
    });

    it("names the issues repository when the pull request lives in another one", async () => {
        const r = await run(world({ prRepo: "o/member" }));
        expect(r.bodies[0]).toMatch(/^Closes o\/r#1$/m);
    });

    it("reuses the branch's open pull request", async () => {
        const r = await run(world({ openPr: 3 }));
        expect(r.log).not.toContain("create-pr");
        expect(r.bodies[0]).toMatch(/^Closes #2$/m);
    });
});

describe("fix loop (G9, G13)", () => {
    it("fixes open Critical and High items from the newest verdict, then finishes", async () => {
        const r = await run(world({ verdicts: [judged(finding("F1", "high")), judged()] }));
        expect(r.code).toBe(0);
        const fix = r.sessions[2].args[1];
        expect(fix).toContain("F1 (high");
        expect(fix).toContain("fix F1");
        expect(r.log.filter((l) => l === "push nxs/epic-7")).toHaveLength(2);
    });

    it("stops when analyze publishes no verdict", async () => {
        const r = await run(world({ verdicts: [null] }));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/published no verdict/);
    });

    it("stops at the round cap and lists what is still open", async () => {
        let n = 0;
        const verdicts = Array.from({ length: 4 }, () => judged(finding(`F${++n}`, "critical")));
        const r = await run(world({ verdicts }), { rounds: 2 });
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/round cap of 2/);
        expect(r.err).toContain("F3 (critical)");
    });
});

describe("the work list holds only Critical, High and Medium items (story #930: G10, G11, G12, G13)", () => {
    it("gives a fix round the Critical, High and Medium items and never a Low one", async () => {
        const r = await run(world({ verdicts: [judged(finding("F1", "critical"), finding("F2", "high"), finding("F3", "medium"), finding("F4", "low")), judged(finding("F4", "low"))] }));
        expect(r.code).toBe(0);
        const fix = r.sessions[2].args[1];
        expect(fix).toContain("F1 (critical");
        expect(fix).toContain("F2 (high");
        expect(fix).toContain("F3 (medium");
        expect(fix).not.toContain("F4");
    });

    it("finishes with a Low item still open, and never runs a fix round for Low items alone", async () => {
        const r = await run(world({ verdicts: [judged(finding("F1", "low"))] }));
        expect(r.code).toBe(0);
        expect(r.sessions).toHaveLength(2);
    });

    it("gives a fix round each item's text and tells it not to read the epic or record end to end", async () => {
        const r = await run(world({ verdicts: [judged(finding("F1", "medium", { location: { file: "src/x.ts", line: 4 } })), judged()] }));
        const fix = r.sessions[2].args[1];
        expect(fix).toContain("F1 is wrong");
        expect(fix).toContain("src/x.ts:4");
        expect(fix).toMatch(/Do not read the epic or the decision record end to end/);
    });

    it("stops on a departure the verdict marks as superseding, with no fix round spent", async () => {
        const dv = departure("DV1", { supersedes: { decision: "D3", instead: "merged the commits" } });
        const r = await run(world({ verdicts: [judged(dv, finding("F1", "high"))] }));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/escalation.*DV1 supersedes D3/);
        expect(r.sessions).toHaveLength(2);
    });

    it("stops on an escalation the fix round names, pushing nothing for it", async () => {
        const r = await run(world({ verdicts: [judged(finding("F1", "high"))], finals: ["done", "done", `sorted\n${ESCALATION_PREFIX} F1 needs G6 reworded`] }));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/fix \(round 1\): escalation.*F1 needs G6 reworded/);
        expect(r.log.filter((l) => l === "push nxs/epic-7")).toHaveLength(1);
        expect(r.sessions[2].args[1]).toMatch(/Sort every item before you edit anything/);
    });

    it("stops when a round leaves the same item IDs open, though the head moved", async () => {
        const r = await run(world({ verdicts: [judged(finding("F1", "high"))] }));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/round 1 left the same items open: F1 \(high\)/);
    });

    it("counts a round that fixes one item and creates another as progress", async () => {
        const r = await run(world({ verdicts: [judged(finding("F1", "high")), judged(finding("F2", "high")), judged()] }));
        expect(r.code).toBe(0);
    });
});

describe("answers on the pull request (G14, G15, G16)", () => {
    const posted: PrAnswer = { id: "F1", verb: "waived", reason: "fine", author: "lead", url: "https://x/c/1", at: "", trusted: true };

    it("stops when an answer line appears during an agent stage, naming the comment", async () => {
        const r = await run(world({ verdicts: [judged(finding("F1", "high")), judged()], answersDuring: { 2: [posted] } }));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/fix \(round 1\).*https:\/\/x\/c\/1/);
    });

    it("accepts a departure from a decision stub committed before the run, naming the source", async () => {
        const stub = { path: ".nexus/queue/epic-7/me/decisions-b.md", reason: "kept the old format" };
        const r = await run(world({ verdicts: [judged(departure("DV1", { stub })), judged()], files: { [stub.path]: "- **Why:** kept the old format" } }));
        expect(r.code).toBe(0);
        expect(r.comments[0]).toMatch(/^DV1 — accepted: kept the old format/);
        expect(r.comments[0]).toContain(stub.path);
        expect(r.comments[0]).toContain("unattended nexus implement command");
        expect(r.sessions[2].args[1]).toContain("--resolve");
    });

    it("leaves a departure whose stub the run wrote itself for a person", async () => {
        const stub = { path: "new.md", reason: "mine" };
        const r = await run(world({ verdicts: [judged(departure("DV1", { stub }))] }), { rounds: 1 });
        expect(r.comments).toHaveLength(0);
    });

    it("never waives a finding or approves a deferral", async () => {
        const r = await run(world({ verdicts: [judged(finding("F1", "medium"), finding("F2", "low"))] }), { rounds: 1 });
        expect(r.comments).toHaveLength(0);
    });
});

describe("finish and stop (G17, G18, G19)", () => {
    it("marks the pull request ready only on a clear verdict for its head, and exits zero", async () => {
        const r = await run(world());
        expect(r.code).toBe(0);
        expect(r.log[r.log.length - 1]).toBe("ready");
        expect(r.bodies[r.bodies.length - 1]).toMatch(/finished/);
    });

    it("rewrites the status section of the body when it stops", async () => {
        const r = await run(world({ verdicts: [null] }));
        const body = r.bodies[r.bodies.length - 1];
        expect(body.split(STATUS_OPEN)).toHaveLength(2);
        expect(body).toMatch(/stopped at analyze/);
        expect(r.log).not.toContain("ready");
    });

    it("reports a failed body update and keeps the non-zero exit", async () => {
        const r = await run(world({ verdicts: [null], openPr: 3, editFails: true }));
        expect(r.code).toBe(1);
    });
});

describe("harness and configuration (G20, G21)", () => {
    it("launches codex stages in a workspace-write sandbox with skill names and no /goal", async () => {
        const r = await run(world(), { harness: "codex" });
        expect(r.code).toBe(0);
        expect(r.sessions[0].command).toBe("codex");
        expect(r.sessions[0].args).toEqual(expect.arrayContaining(["--sandbox", "workspace-write"]));
        const prompt = r.sessions[0].args[r.sessions[0].args.length - 1];
        expect(prompt.startsWith("/goal")).toBe(false);
        expect(prompt).toContain("$nxs-epic-resolve 7");
        expect(r.sessions[1].args[r.sessions[1].args.length - 1]).toContain("$nxs-analyze --pr 5");
    });

    it("reads the test command from the setting when the invocation names none", async () => {
        const r = await run(world({ setting: "make check" }), { testCommand: null });
        expect(r.sessions[0].args[1]).toContain("`make check`");
    });

    it("asks the stage to name the suite when nothing is declared, and records it", async () => {
        const r = await run(world({ finals: ["done\nTest command: pnpm vitest"] }), { testCommand: null });
        expect(r.sessions[0].args[1]).toContain("Test command:");
        expect(r.bodies[r.bodies.length - 1]).toContain("pnpm vitest");
    });
});

describe("finding the HLD comment on the record (epic #971, story #982: G1-G5, G15)", () => {
    const older = comment(hldBody({ link: PAGE_URL.replace("hld.md", "old.md") }), "2026-11-01T00:00:00Z");
    const newer = comment(hldBody(), "2026-11-03T00:00:00Z");

    it("takes the HLD comment the platform recorded as created later, whatever order the comments arrive in", () => {
        expect(newestHldComment([newer, older])).toBe(newer);
        expect(newestHldComment([older, newer])).toBe(newer);
    });

    it("counts a comment only when its first line is exactly the marker", () => {
        const quoted = comment(`> ${HLD_MARKER}\n> quoted`, "2026-11-04T00:00:00Z");
        const later = comment(`See this:\n${HLD_MARKER}`, "2026-11-05T00:00:00Z");
        expect(newestHldComment([older, quoted, later])).toBe(older);
    });

    it("never uses an HLD comment from an author who cannot speak for the repository, and never lets one hide a trusted one", () => {
        const stranger = comment(hldBody(), "2026-11-09T00:00:00Z", "NONE");
        expect(newestHldComment([older, stranger])).toBe(older);
        expect(newestHldComment([stranger])).toBeNull();
    });

    it("finds the newest HLD comment however many comments the record carries", () => {
        const chatter = Array.from({ length: 250 }, (_, i) => comment(`note ${i}`, `2026-10-01T00:00:${String(i % 60).padStart(2, "0")}Z`));
        expect(newestHldComment([older, ...chatter, newer])).toBe(newer);
    });

    it("leaves the run exactly as before when the record has no trusted HLD comment", async () => {
        const baseline = await run(world({ comments: [] }));
        const r = await run(world({ comments: [comment("LGTM", "2026-11-02T00:00:00Z"), comment(hldBody(), "2026-11-03T00:00:00Z", "NONE")] }));
        expect(r.code).toBe(0);
        expect(r.sessions[0].args[1]).toBe(implementationPrompt(7, 40, "npm test") + UNATTENDED_CLAUSE);
        expect(r.err).toBe(baseline.err);
        expect(r.err).not.toMatch(/HLD|design page/i);
    });

    it.each<[string, Partial<World>, RegExp]>([
        ["the record's comments cannot be read", { comments: null }, /comments on decision record #9 could not be read/],
        ["the record's current digest cannot be read", { comments: [newer], digest: null }, /digest of decision record #9 could not be read/],
    ])("stops before the branch exists when %s", async (_name, w, reason) => {
        const r = await run(world(w));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(reason);
        expect(r.log.filter((l) => l.startsWith("branch"))).toHaveLength(0);
        expect(r.sessions).toHaveLength(0);
    });

    it("reads no comment when the epic has no decision record", async () => {
        const r = await run(world({ facts: { record: null } }));
        expect(r.code).toBe(0);
        expect(r.log).not.toContain("comments");
    });
});

describe("reading the HLD page, including from a private store (story #983: G10-G14, G17)", () => {
    const current = [comment(hldBody(), "2026-11-03T00:00:00Z")];

    it("reads the page's raw text at the commit the comment pins, and hands the agent a copy", async () => {
        const r = await run(world({ comments: current }));
        expect(r.code).toBe(0);
        expect(r.log).toContain(`page o/store@${STORE_SHA}:features/epic-7/hld.md`);
        expect(r.writes[".nexus/tmp/epic-7/hld-page.md"]).toBe(PAGE_TEXT);
        expect(r.err).toContain(PAGE_URL);
        const branchAt = r.log.findIndex((l) => l.startsWith("branch"));
        expect(r.log.findIndex((l) => l.startsWith("page"))).toBeLessThan(branchAt);
        expect(r.log.findIndex((l) => l.startsWith("write"))).toBeLessThan(branchAt);
    });

    it.each<[string, Partial<World>, RegExp]>([
        ["the page cannot be read", { comments: current, pages: {} }, /HLD page .* could not be read: .*HTTP 404/],
        ["the link names a branch, not a commit", { comments: [comment(hldBody({ link: PAGE_URL.replace(STORE_SHA, "main") }), "2026-11-03T00:00:00Z")] }, /HLD page .* could not be read: .*no pinned page link/],
        ["the comment has no page link", { comments: [comment(hldBody({ link: "see the wiki" }), "2026-11-03T00:00:00Z")] }, /HLD page .* could not be read: .*no pinned page link/],
    ])("stops before the branch exists when %s, and asks whether to build from the record alone", async (_name, w, reason) => {
        const r = await run(world(w));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(reason);
        expect(r.err).toMatch(/Build from the decision record alone instead\? Run again with --record-only/);
        expect(r.log.filter((l) => l.startsWith("branch"))).toHaveLength(0);
        expect(r.sessions).toHaveLength(0);
    });

    it("stops before the branch exists when git would show the page copy as a change", async () => {
        const r = await run(world({ comments: current, ignored: false }));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/does not ignore .nexus\/tmp\/epic-7\/hld-page.md.*Add .nexus\/tmp\/ to .gitignore/);
        expect(r.log.filter((l) => l.startsWith("branch"))).toHaveLength(0);
    });

    it("stops before the branch exists when the page copy cannot be written, so a re-run is not refused", async () => {
        const r = await run(world({ comments: current, writeFails: true }));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/HLD page copy could not be written to .nexus\/tmp\/epic-7\/hld-page.md: EACCES/);
        expect(r.log.filter((l) => l.startsWith("branch"))).toHaveLength(0);
        expect(r.sessions).toHaveLength(0);
    });

    it("with --record-only reads no comment and no page, says so in one line, and gives today's instructions", async () => {
        const r = await run(world({ comments: current, pages: {} }), { recordOnly: true });
        expect(r.code).toBe(0);
        expect(r.log).not.toContain("comments");
        expect(r.log.filter((l) => l.startsWith("page") || l.startsWith("write"))).toHaveLength(0);
        expect(r.err.split("\n").filter((l) => /record-only/.test(l))).toHaveLength(1);
        expect(r.sessions[0].args[1]).toBe(implementationPrompt(7, 40, "npm test") + UNATTENDED_CLAUSE);
    });
});

describe("ignoring a stale page or a page with violations (story #984: G6-G9, G16)", () => {
    const at = "2026-11-03T00:00:00Z";
    const today = implementationPrompt(7, 40, "npm test") + UNATTENDED_CLAUSE;

    it.each<[string, string]>([
        ["a digest that differs from the record's current digest", hldBody({ digest: "b".repeat(64) })],
        ["no digest at all", hldBody({ digest: null })],
    ])("ignores a page whose comment states %s, says it was rendered from an older record, and never fetches it", async (_name, body) => {
        const r = await run(world({ comments: [comment(body, at)], pages: {} }));
        expect(r.code).toBe(0);
        expect(r.err).toMatch(/ignored because it was rendered from an older record/);
        expect(r.log.filter((l) => l.startsWith("page") || l.startsWith("write"))).toHaveLength(0);
        expect(r.sessions[0].args[1]).toBe(today);
    });

    it.each<[string, string | null, string]>([
        ["lists violations", "2 violations: D3 violated, AC2 of #4 not achievable", "2 violations: D3 violated, AC2 of #4 not achievable"],
        ["names a criterion that cannot be read", "All decisions kept; 1 criterion unreadable", "All decisions kept; 1 criterion unreadable"],
        ["has no verdict line", null, "(no verdict line)"],
        ["is empty", "", ""],
    ])("ignores a page whose verdict %s, quoting it, and never fetches it", async (_name, verdict, quoted) => {
        const r = await run(world({ comments: [comment(hldBody({ verdict }), at)], pages: {} }));
        expect(r.code).toBe(0);
        expect(r.err).toContain(`ignored because of its verdict: "${quoted}"`);
        expect(r.log.filter((l) => l.startsWith("page") || l.startsWith("write"))).toHaveLength(0);
        expect(r.sessions[0].args[1]).toBe(today);
    });

    it("uses a page whose verdict is the clean verdict as the preview prints it", async () => {
        const r = await run(world({ comments: [comment(hldBody({ verdict: `*${CLEAN_VERDICT}*` }), at)] }));
        expect(r.log.filter((l) => l.startsWith("page"))).toHaveLength(1);
    });

    it("never falls back to an older HLD comment when the newest is stale", async () => {
        const older = comment(hldBody(), "2026-11-01T00:00:00Z");
        const newer = comment(hldBody({ digest: "b".repeat(64) }), at);
        const r = await run(world({ comments: [older, newer] }));
        expect(r.err).toMatch(/older record/);
        expect(r.log.filter((l) => l.startsWith("page"))).toHaveLength(0);
    });
});

describe("telling the agent to build from a current page (story #985: G18-G22)", () => {
    const current = [comment(hldBody(), "2026-11-03T00:00:00Z")];

    it("tells the agent to read the page copy and follow its architecture, mechanisms, data and delivery plan", async () => {
        const r = await run(world({ comments: current }));
        const prompt = r.sessions[0].args[1];
        expect(prompt).toContain(".nexus/tmp/epic-7/hld-page.md");
        expect(prompt).toContain(PAGE_URL);
        expect(prompt).toMatch(/follow its architecture, mechanisms, data and delivery plan/);
    });

    it("tells the agent the record binds where the two disagree, and that open choices and assumed answers bind nothing", async () => {
        const prompt = (await run(world({ comments: current }))).sessions[0].args[1];
        expect(prompt).toMatch(/decision record is binding: wherever the page and the record disagree, follow the record/);
        expect(prompt).toMatch(/left open by the record, and the answers it assumes for its own open questions, guide the build but bind nothing/);
    });

    it("keeps one commit per story above the page's plan and does not ask the agent to judge the page", async () => {
        const prompt = (await run(world({ comments: current }))).sessions[0].args[1];
        expect(prompt).toMatch(/never overrides one commit per story in blocked_by order/);
        expect(prompt).toMatch(/Do not judge whether the page is correct/);
    });

    it("adds exactly one paragraph to today's instructions", async () => {
        const prompt = (await run(world({ comments: current }))).sessions[0].args[1];
        const today = implementationPrompt(7, 40, "npm test");
        expect(prompt.startsWith(today)).toBe(true);
        expect(prompt.slice(today.length).replace(UNATTENDED_CLAUSE, "").trim().split("\n\n")).toHaveLength(1);
    });

    it("leaves the fix round's instructions unchanged, so a fix that contradicts a record decision is still an escalation", async () => {
        const verdicts = [judged(finding("F1", "high")), judged()];
        const withPage = await run(world({ comments: current, verdicts }));
        const without = await run(world({ verdicts }));
        expect(withPage.sessions[2].args[1]).toBe(without.sessions[2].args[1]);
        expect(withPage.sessions[2].args[1]).not.toMatch(/hld-page|design page/);
        expect(withPage.sessions[2].args[1]).toMatch(/escalation when its fix would contradict a decision or guarantee the record states/);
    });
});

describe("the /nxs.hld comment template this reader depends on (R1)", () => {
    const skill = fs.readFileSync(path.join(REPO_ROOT, "components/skills/nxs.hld/SKILL.md"), "utf8");
    const block = /```markdown\n\s*(<!-- nxs\.hld -->[\s\S]*?)\n\s*```/.exec(skill)?.[1] ?? "";
    const template = block
        .split("\n")
        .map((l) => l.replace(/^ {4}/, ""))
        .join("\n");

    it("still opens the reference comment with the marker this reader matches", () => {
        expect(template.split("\n")[0]).toBe(HLD_MARKER);
        expect(isHldCommentLine(template)).toBe(true);
    });

    it("still states the record digest where this reader looks for it", () => {
        expect(commentDigest(template.replace("<RECORD_DIGEST>", DIGEST))).toBe(DIGEST);
    });

    it("still writes a verdict line, and the clean verdict in the wording this reader accepts", () => {
        expect(commentVerdict(template)).not.toBeNull();
        expect(skill).toContain(`*${READER_CLEAN_VERDICT}*`);
        expect(isCleanVerdict(`*${READER_CLEAN_VERDICT}*`)).toBe(true);
    });
});

describe("distribution (G22)", () => {
    it("lists the command among the shipped nexus commands", () => {
        expect(VERB_NAMES).toContain("implement");
    });

    it("leaves neither implement-epic script in the repository", () => {
        expect(fs.existsSync(path.join(REPO_ROOT, "utils/implement-epic.sh"))).toBe(false);
        expect(fs.existsSync(path.join(REPO_ROOT, "utils/codex/implement-epic.sh"))).toBe(false);
    });
});

describe("a re-run continues on the epic's existing run branch (epic #991, story #992: G1-G6, G23)", () => {
    const resumed = (over: Partial<World> = {}): World => world({ local: "tip", ...over });

    it("continues on a run branch made on top of the base instead of refusing", async () => {
        const r = await run(resumed());
        expect(r.code).toBe(0);
        expect(r.err).not.toMatch(/already exists/);
        expect(r.log).toContain("switch nxs/epic-7");
        expect(r.log.some((l) => l.startsWith("branch "))).toBe(false);
    });

    it("switches the checkout to the run branch before any agent stage, whatever branch it was on", async () => {
        const r = await run(resumed({ checkout: "some/other" }));
        expect(r.log.indexOf("switch nxs/epic-7")).toBeGreaterThan(-1);
        expect(r.log.indexOf("switch nxs/epic-7")).toBeLessThan(r.log.indexOf("session 0"));
    });

    it.each<[string, Partial<World>, RegExp]>([
        ["no commit in common with the base", { fork: null }, /nxs\/epic-7 .*no commit in common/],
        ["a merge commit after it left the base", { commits: [storyCommit(1), { sha: "m", message: "Merge main", merge: true }] }, /nxs\/epic-7 .*merge commit/],
        ["an open pull request on another base", { openPr: 5, prBase: "develop" }, /nxs\/epic-7 .*develop/],
    ])("stops before any agent stage on a run branch with %s, naming the branch and the reason", async (_name, over, reason) => {
        const r = await run(resumed(over));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/stopped at preflight/);
        expect(r.err).toMatch(reason);
        expect(r.sessions).toHaveLength(0);
        expect(r.log.filter((l) => l.startsWith("push"))).toHaveLength(0);
    });

    it("says it is resuming, naming the branch, as its first output line", async () => {
        const r = await run(resumed({ comments: [comment(hldBody(), "2026-11-04T00:00:00Z")] }));
        expect(r.err.split("\n")[0]).toMatch(/resuming.*nxs\/epic-7/);
        expect(r.err.split("\n").filter((l) => /resuming/.test(l))).toHaveLength(1);
    });

    it("prints no resume line on a fresh run", async () => {
        const r = await run(world());
        expect(r.err).not.toMatch(/resuming/);
    });

    it("continues from the remote tip in a clone where the branch exists only on the remote", async () => {
        const r = await run(world({ remote: "rtip" }));
        expect(r.code).toBe(0);
        expect(r.log).toContain("set nxs/epic-7 rtip");
        expect(r.log).toContain("switch nxs/epic-7");
        expect(r.err.split("\n")[0]).toMatch(/resuming.*nxs\/epic-7/);
    });

    it("brings a local copy that is behind the remote up to date", async () => {
        const r = await run(resumed({ remote: "rtip", ancestry: ["tip<rtip"] }));
        expect(r.code).toBe(0);
        expect(r.log).toContain("set nxs/epic-7 rtip");
    });

    it("keeps a local copy that is ahead of the remote", async () => {
        const r = await run(resumed({ remote: "rtip", ancestry: ["rtip<tip"] }));
        expect(r.code).toBe(0);
        expect(r.log.some((l) => l.startsWith("set "))).toBe(false);
    });

    it("stops on diverged local and remote copies, naming both tips and pushing nothing", async () => {
        const r = await run(resumed({ remote: "rtip" }));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/stopped at preflight/);
        expect(r.err).toMatch(/tip/);
        expect(r.err).toMatch(/rtip/);
        expect(r.sessions).toHaveLength(0);
        expect(r.log.filter((l) => l.startsWith("push") || l.startsWith("set "))).toHaveLength(0);
    });

    it("still refuses a dirty working tree on a re-run", async () => {
        const r = await run(resumed({ clean: false }));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/uncommitted changes/);
        expect(r.sessions).toHaveLength(0);
    });
});

describe("a re-run builds only the stories without a commit (epic #991, story #993: G7-G11, G22, G29)", () => {
    const three = { stories: [1, 2, 3], blockedBy: new Map([[2, [1]], [3, [2]]]) };
    const resumed = (over: Partial<World> = {}): World =>
        world({ local: "tip", facts: three, existing: [storyCommit(1), storyCommit(2)], commits: [storyCommit(1), storyCommit(2), storyCommit(3)], ...over });
    const buildPrompt = (r: { sessions: SessionSpec[] }): string => r.sessions[0].args[1];

    it("gives the build stage only the stories with no commit, naming the committed blocker", async () => {
        const r = await run(resumed());
        expect(r.code).toBe(0);
        const prompt = buildPrompt(r);
        expect(prompt).toMatch(/only these stories[^.]*#3/);
        expect(prompt).not.toMatch(/only these stories[^.]*#1\b/);
        expect(prompt).not.toMatch(/only these stories[^.]*#2\b/);
        expect(prompt).toMatch(/already committed[^.]*#2/);
    });

    it("lists the remaining stories in blocked-by order", async () => {
        const r = await run(resumed({ facts: { stories: [1, 2, 3], blockedBy: new Map([[2, [3]]]) }, existing: [storyCommit(1)], commits: [storyCommit(1), storyCommit(3), storyCommit(2)] }));
        expect(r.code).toBe(0);
        expect(buildPrompt(r)).toMatch(/only these stories[^.]*#3, #2/);
    });

    it("tells a resumed build that blocked means it made no commit in this stage, and forbids rewriting commits", async () => {
        const prompt = buildPrompt(await run(resumed()));
        expect(prompt).toMatch(/has made no commit in this stage/);
        expect(prompt).toMatch(/amend/);
        expect(prompt).toMatch(/force/);
    });

    it("runs the story commit check over every live story, from this run and the earlier one", async () => {
        const r = await run(resumed({ commits: [storyCommit(1), storyCommit(2)] }));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/stopped at story-commit-check: no commit claims #3/);
        expect(r.log.filter((l) => l.startsWith("push"))).toHaveLength(0);
    });

    it("stops when a commit that was on the branch at the start was rewritten", async () => {
        const r = await run(resumed({ rewritten: true }));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/tip/);
        expect(r.log.filter((l) => l.startsWith("push"))).toHaveLength(0);
    });

    it.each<[string, Commit[], RegExp]>([
        ["a story committed before its blocker", [storyCommit(2), storyCommit(1)], /#2 is committed before #1/],
        ["a story claimed twice", [storyCommit(1, "a"), storyCommit(1, "b")], /#1 is claimed by more than one commit/],
        ["a commit claiming two stories", [{ sha: "ab", message: "both\n\nCloses #1\nCloses #2\n" }], /claims more than one story/],
    ])("stops before any agent stage when the commits already there show %s", async (_name, existing, reason) => {
        const r = await run(resumed({ existing }));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/stopped at preflight/);
        expect(r.err).toMatch(reason);
        expect(r.sessions).toHaveLength(0);
    });

    it("starts no build stage when every live story is committed, and says the suite was not run", async () => {
        const all = [storyCommit(1), storyCommit(2), storyCommit(3)];
        const r = await run(resumed({ existing: all, commits: all }));
        expect(r.code).toBe(0);
        expect(r.sessions[0].args.join(" ")).toMatch(/nxs\.analyze --pr/);
        expect(r.log).toContain("push nxs/epic-7");
        expect(r.log).toContain("ready");
        expect(r.bodies[0]).toMatch(/did not run the test suite/);
        expect(r.bodies[r.bodies.length - 1]).toMatch(/did not run the test suite/);
    });

    it("never says the suite was skipped when the run built a story", async () => {
        const r = await run(resumed());
        expect(r.bodies.join("\n")).not.toMatch(/did not run the test suite/);
    });
});

describe("a re-run continues the analyze and fix rounds on the existing pull request (epic #991, story #994: G18-G20, G24, G25)", () => {
    const all = [storyCommit(1), storyCommit(2)];
    const stub = { path: ".nexus/queue/epic-7/me/decisions-b.md", reason: "kept the old format" };
    const answer = (id: string, trusted: boolean): PrAnswer => ({ id, verb: "accepted", reason: "fine by me", author: "lead", url: `https://x/a/${id}`, at: "2026-11-20T00:00:00Z", trusted });
    const resumed = (over: Partial<World> = {}): World => world({ local: "tip", existing: all, commits: all, openPr: 5, ...over });

    it("reuses the open pull request and starts with a full analyze on its head", async () => {
        const r = await run(resumed());
        expect(r.code).toBe(0);
        expect(r.log).not.toContain("create-pr");
        expect(r.sessions[0].args[1]).toMatch(/^\/nxs\.analyze --pr 5\n/);
    });

    it("posts no inferred answer for an item an earlier run already answered", async () => {
        const r = await run(
            resumed({ priorAnswers: [answer("DV1", true)], verdicts: [judged(departure("DV1", { stub }))], files: { [stub.path]: "- **Why:** kept the old format" } }),
            { rounds: 1 },
        );
        expect(r.comments.join("\n")).not.toMatch(/DV1 — accepted/);
    });

    it("still answers an item whose only earlier answer came from someone who cannot speak for the repository", async () => {
        const r = await run(resumed({ priorAnswers: [answer("DV1", false)], verdicts: [judged(departure("DV1", { stub })), judged()], files: { [stub.path]: "- **Why:** kept the old format" } }));
        expect(r.comments[0]).toMatch(/^DV1 — accepted/);
    });

    it("cites only decision stubs present where the run branch left the base", async () => {
        const r = await run(resumed({ verdicts: [judged(departure("DV1", { stub })), judged()], files: { [stub.path]: "- **Why:** kept the old format" } }));
        expect(r.log).toContain(`file-at fork ${stub.path}`);
    });

    it("marks the pull request ready on a clean verdict for its head, as an uninterrupted run does", async () => {
        const r = await run(resumed());
        expect(r.log).toContain("ready");
        expect(r.out).toMatch(/PR #5 is ready/);
    });
});

describe("each story commit reaches the remote as it is made (epic #991, story #995: G12-G17, G21, G22)", () => {
    const c1 = storyCommit(1, "head-a");
    const c2 = storyCommit(2, "head-b");
    const building = (over: Partial<World> = {}): World =>
        world({ buildTips: [{ tip: "head-a", commits: [c1] }, { tip: "head-b", commits: [c1, c2] }], commits: [c1, c2], ...over });
    const before = (log: string[], entry: string, marker = "build-end"): boolean => log.indexOf(entry) > -1 && log.indexOf(entry) < log.indexOf(marker);

    it("pushes the first story commit and opens the draft pull request before the build stage ends", async () => {
        const r = await run(building());
        expect(r.code).toBe(0);
        expect(before(r.log, "push nxs/epic-7")).toBe(true);
        expect(before(r.log, "create-pr")).toBe(true);
        expect(r.bodies[0]).toMatch(/Closes #1/);
        expect(r.bodies[0]).toMatch(/Closes #2/);
    });

    it("pushes each later story commit before the build stage ends", async () => {
        const r = await run(building());
        const end = r.log.indexOf("build-end");
        expect(r.log.slice(0, end).filter((l) => l === "push nxs/epic-7")).toHaveLength(2);
    });

    it("never pushes a commit that fails the check, ends the build stage and stops with the reason", async () => {
        const r = await run(building({ buildTips: [{ tip: "head-a", commits: [storyCommit(2, "head-a")] }] }));
        expect(r.code).toBe(1);
        expect(r.log).toContain("abort");
        expect(r.log.filter((l) => l.startsWith("push"))).toHaveLength(0);
        expect(r.err).toMatch(/stopped at story-commit-check: .*#2 is committed before #1/);
    });

    it("names built and pending stories in the status section while stories remain", async () => {
        const r = await run(building());
        expect(r.bodies[0]).toMatch(/built: #1; pending: #2/);
    });

    it("retries a push that failed during the stage at the next commit, and goes on", async () => {
        const r = await run(building({ pushFailures: 1 }));
        expect(r.code).toBe(0);
        expect(r.log.filter((l) => l === "create-pr")).toHaveLength(1);
    });

    it("stops naming the push stage when the push still fails after the stage", async () => {
        const r = await run(building({ pushFailures: 99 }));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/stopped at push: network is unreachable/);
    });

    it("stops when an answer line appears on the open pull request during the build stage", async () => {
        const a: PrAnswer = { id: "F1", verb: "waived", reason: "x", author: "bot", url: "https://x/c/1", at: "t", trusted: true };
        const r = await run(world({ local: "tip", existing: [], openPr: 5, answersDuring: { 0: [a] } }));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/stopped at implementation: an answer line was posted/);
    });

    it("keeps published stories on a blocked stop and names them as built", async () => {
        const r = await run(building({ buildTips: [{ tip: "head-a", commits: [c1] }], commits: [c1], finals: ["Implementation blocked: no access"] }));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/stopped at implementation: the stage ended blocked/);
        expect(r.bodies[r.bodies.length - 1]).toMatch(/built: #1; pending: #2/);
    });

    it("retries opening the pull request after the stage when it failed after a successful push", async () => {
        const r = await run(building({ buildTips: [{ tip: "head-a", commits: [c1] }], commits: [c1, c2], createPrFailures: 1 }));
        expect(r.code).toBe(0);
        expect(r.log).toContain("create-pr");
        expect(r.bodies[0]).toMatch(/built: #1; pending: #2/);
    });

    it("names the stories an earlier run built when a resumed build stage stops blocked", async () => {
        const r = await run(world({ local: "tip", existing: [c1], commits: [c1], openPr: 5, finals: ["Implementation blocked: no access"] }));
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/stopped at implementation: the stage ended blocked/);
        expect(r.bodies[r.bodies.length - 1]).toMatch(/built: #1; pending: #2/);
    });

    it("rewrites the open pull request's status with the earlier run's stories when a resumed build stage ends", async () => {
        const r = await run(world({ local: "tip", existing: [c1], commits: [c1, c2], openPr: 5 }));
        expect(r.code).toBe(0);
        expect(r.bodies.some((b) => /built: #1; pending: #2/.test(b))).toBe(true);
    });

    it("tells the build stage each commit is published as soon as it is made", async () => {
        const r = await run(world());
        expect(r.sessions[0].args[1]).toMatch(/publishes each commit as soon as you make it/);
    });
});
