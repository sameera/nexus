/**
 * `nexus implement-epic` (epic #928, story #929, decision record #966): one command implements an
 * approved epic unattended. The platform is injected, so each case states what git, the issue graph,
 * the harness and the published verdicts say, and asserts what the command did about it.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type Departure, type Finding, type Judgments } from "@nexus/pr-acceptance/judgments-block";
import { type PrAnswer } from "@nexus/pr-acceptance/waiver";
import { type SessionEnd, type SessionSpec } from "./distill-command.js";
import { BLOCKED_PREFIX, ESCALATION_PREFIX, STATUS_OPEN, runImplementEpic, type Commit, type EpicFacts, type ImplementDeps, type ImplementInput, type VerdictRead } from "./implement-epic.js";
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

const storyCommit = (n: number, sha: string = `sha${n}`): Commit => ({ sha, message: `story ${n}\n\nCloses #${n}\n` });

interface World {
    facts: Partial<EpicFacts>;
    clean: boolean;
    branchExists: boolean;
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
}

function world(over: Partial<World> = {}): World {
    return {
        facts: {},
        clean: true,
        branchExists: false,
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
        ...over,
    };
}

function harness(w: World) {
    const log: string[] = [];
    const sessions: SessionSpec[] = [];
    const bodies: string[] = [];
    const comments: string[] = [];
    let answers: PrAnswer[] = [];
    let head = 0;
    let analyzeRuns = 0;
    let lastPublished: { head: string; judgments: Judgments } | null = null;
    const deps: ImplementDeps = {
        resolveEpic: () => ({
            ok: true,
            value: { title: "Epic", stories: [1, 2], blockedBy: new Map([[2, [1]]]), record: { number: 9, state: "closed" }, issuesRepo: "o/r", needsDesign: false, root: "/r", ...w.facts },
        }),
        testCommandSetting: () => w.setting,
        defaultBranch: () => "main",
        clean: () => w.clean,
        branchExists: () => w.branchExists,
        createBranch: (_c, branch, base) => {
            log.push(`branch ${branch} ${base}`);
            return { ok: true, value: "base" };
        },
        currentBranch: () => "nxs/epic-7",
        headSha: () => `head${head}`,
        commits: () => w.commits,
        push: (_c, branch) => {
            log.push(`push ${branch}`);
            return { ok: true, value: null };
        },
        prRepo: () => w.prRepo,
        openPr: () => ({ ok: true, value: w.openPr }),
        createPr: (_c, p) => {
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
        fileAt: (_c, _sha, file) => w.files[file] ?? null,
        autoModeAvailable: () => w.auto,
        onPath: () => true,
        session: async (spec): Promise<SessionEnd> => {
            const index = sessions.length;
            sessions.push(spec);
            answers = [...answers, ...(w.answersDuring[index] ?? [])];
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
    return { deps, log, sessions, bodies, comments };
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
        ["a branch that already exists", { branchExists: true }, /nxs\/epic-7 already exists/],
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
        expect(r.log[0]).toBe("branch nxs/epic-7 main");
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
        expect(r.comments[0]).toContain("unattended nexus implement-epic command");
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

describe("distribution (G22)", () => {
    it("lists the command among the shipped nexus commands", () => {
        expect(VERB_NAMES).toContain("implement-epic");
    });

    it("leaves neither implement-epic script in the repository", () => {
        expect(fs.existsSync(path.join(REPO_ROOT, "utils/implement-epic.sh"))).toBe(false);
        expect(fs.existsSync(path.join(REPO_ROOT, "utils/codex/implement-epic.sh"))).toBe(false);
    });
});
