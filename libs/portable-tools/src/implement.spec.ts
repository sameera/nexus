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
import { HLD_MARKER, isHldComment as isHldCommentLine, newestHldComment, type RecordComment } from "./implement-hld.js";
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
    /** The comments on the decision record; null when they cannot be read. */
    comments: RecordComment[] | null;
    /** The record's current digest; null when it cannot be read. */
    digest: string | null;
    /** The page text at each `<repo>@<commit>:<path>`; a page absent here cannot be read. */
    pages: Record<string, string>;
    /** Whether git ignores the page copy's folder. */
    ignored: boolean;
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
        comments: [],
        digest: DIGEST,
        pages: { [`o/store@${STORE_SHA}:features/epic-7/hld.md`]: PAGE_TEXT },
        ignored: true,
        ...over,
    };
}

function harness(w: World) {
    const log: string[] = [];
    const sessions: SessionSpec[] = [];
    const bodies: string[] = [];
    const comments: string[] = [];
    const writes: Record<string, string> = {};
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
            writes[file] = text;
            return { ok: true, value: null };
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
        expect(r.log.findIndex((l) => l.startsWith("write"))).toBeGreaterThan(branchAt);
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

    it("with --record-only reads no comment and no page, says so in one line, and gives today's instructions", async () => {
        const r = await run(world({ comments: current, pages: {} }), { recordOnly: true });
        expect(r.code).toBe(0);
        expect(r.log).not.toContain("comments");
        expect(r.log.filter((l) => l.startsWith("page") || l.startsWith("write"))).toHaveLength(0);
        expect(r.err.split("\n").filter((l) => /record-only/.test(l))).toHaveLength(1);
        expect(r.sessions[0].args[1]).toBe(implementationPrompt(7, 40, "npm test") + UNATTENDED_CLAUSE);
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
