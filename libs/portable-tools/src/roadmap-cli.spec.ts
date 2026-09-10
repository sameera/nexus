import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type RunResult, type Runner } from "@nexus/close-migration/run";
import { runWorkbookCli, type WorkbookCliIo } from "./workbook-cli.js";
import { ROADMAP_EPIC_CAP, epicsFromQuery, readRoadmap, type Roadmap } from "./roadmap.js";
import { workbookRoot } from "./workbook-store.js";

let tmpDirs: string[] = [];
function initRepo(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "roadmap-cli-"));
    tmpDirs.push(dir);
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    fs.writeFileSync(path.join(dir, ".gitignore"), ".nexus/tmp/\n");
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

interface Captured extends WorkbookCliIo {
    out: string[];
    err: string[];
}
function makeIo(cwd: string): Captured {
    const out: string[] = [];
    const err: string[] = [];
    return { cwd, out, err, stdout: (l) => out.push(l), stderr: (l) => err.push(l) };
}

interface FakeStory {
    number: number;
    title: string;
    body: string;
    blockedBy?: number[];
}

/** Answers the shared resolver's `gh` calls for one epic, and nothing else. */
function ghRunner(epic: { number: number; title: string }, stories: FakeStory[], calls: string[][] = []): Runner {
    const byNumber = new Map(stories.map((s) => [s.number, s]));
    return (cmd: string, args: string[]): RunResult => {
        calls.push([cmd, ...args]);
        const ok = (stdout: string): RunResult => ({ status: 0, stdout, stderr: "" });
        const fail = (stderr: string): RunResult => ({ status: 1, stdout: "", stderr });
        if (cmd === "git") return ok("");
        if (cmd !== "gh") return fail(`unexpected command ${cmd}`);
        if (args[0] === "repo" && args[1] === "view") return ok("acme/app\n");
        if (args[0] === "issue" && args[1] === "view") {
            const n: number = Number(args[2]);
            if (n === epic.number) {
                return ok(JSON.stringify({ number: n, title: epic.title, body: "", state: "OPEN", stateReason: "", labels: [] }));
            }
            const story: FakeStory | undefined = byNumber.get(n);
            if (story === undefined) return fail(`not found: #${n}`);
            return ok(JSON.stringify({ number: n, title: story.title, body: story.body, state: "OPEN", stateReason: "", labels: [] }));
        }
        if (args[0] === "api" && args[1] === "graphql") {
            const query: string = args.find((a) => a.startsWith("query=")) ?? "";
            // The combined facts query — matched before the bare parent query it contains.
            if (query.includes("parent{number} issueType{name}")) {
                const n = Number((args.find((a) => a.startsWith("num=")) ?? "num=0").slice(4));
                const labels: string[] = n === epic.number ? ["epic"] : byNumber.has(n) ? ["story"] : [];
                if (n !== epic.number && !byNumber.has(n)) return ok(JSON.stringify({ data: { repository: { issue: null } } }));
                return ok(
                    JSON.stringify({
                        data: {
                            repository: {
                                issue: {
                                    parent: n === epic.number ? null : { number: epic.number },
                                    issueType: null,
                                    state: "OPEN",
                                    stateReason: null,
                                    labels: { nodes: labels.map((name) => ({ name })) },
                                },
                            },
                        },
                    }),
                );
            }
            if (query.includes("parent{number}")) return ok("");
            if (query.includes("issueType{name}")) return ok("");
            return ok(stories.map((s) => s.number).join("\n") + "\n");
        }
        if (args[0] === "api" && String(args[1]).includes("dependencies/blocked_by")) {
            const match: RegExpExecArray | null = /issues\/(\d+)\/dependencies/.exec(String(args[1]));
            const n: number = match === null ? 0 : Number(match[1]);
            const edges: number[] = byNumber.get(n)?.blockedBy ?? [];
            return ok(edges.length === 0 ? "" : edges.join("\n") + "\n");
        }
        return fail(`unexpected gh call: ${args.join(" ")}`);
    };
}

const STORIES: FakeStory[] = [
    { number: 11, title: "First", body: "Do the first thing." },
    { number: 12, title: "Second", body: "Do the second thing.", blockedBy: [11] },
];

describe("a learner resolves a roadmap from an epic issue", () => {
    it("writes a roadmap holding the epic's stories in a dependency-respecting order", () => {
        const repo: string = initRepo();
        const io: Captured = makeIo(repo);
        const code: number = runWorkbookCli(["roadmap", "--epic", "100"], io, ghRunner({ number: 100, title: "Alpha" }, STORIES));
        expect(code).toBe(0);
        const roadmap: Roadmap | null = readRoadmap(repo, "alpha");
        expect(roadmap?.stories.map((s) => s.number)).toEqual([11, 12]);
        expect(roadmap?.stories[1].body).toContain("Do the second thing.");
    });

    it("creates the workbook the interview will be keyed on before anything is asked", () => {
        const repo: string = initRepo();
        const io: Captured = makeIo(repo);
        runWorkbookCli(["roadmap", "--epic", "100"], io, ghRunner({ number: 100, title: "Alpha" }, STORIES));
        expect(fs.existsSync(workbookRoot(repo, "alpha"))).toBe(true);
    });

    it("leaves the roadmap out of the committed tree", () => {
        const repo: string = initRepo();
        const io: Captured = makeIo(repo);
        runWorkbookCli(["roadmap", "--epic", "100"], io, ghRunner({ number: 100, title: "Alpha" }, STORIES));
        const tracked: string = execFileSync("git", ["status", "--porcelain", "--", ".nexus/tmp"], { cwd: repo, encoding: "utf8" });
        expect(tracked.trim()).toBe("");
    });

    it("carries a story's whole body, sub-headings and all, so no later phase re-reads the issue", () => {
        const repo: string = initRepo();
        const io: Captured = makeIo(repo);
        const whole: string = [
            "- **story_type:** system",
            "- **size:** M",
            "",
            "**As a** learner, **I want** the roadmap to hold what the story says.",
            "",
            "## Acceptance Criteria",
            "",
            "- [ ] **Given** a resolved roadmap, **when** a later phase reads it, **then** it finds the criteria there.",
            "",
            "## Notes",
            "",
            "A real story body carries H2 sub-headings under its H3 heading.",
        ].join("\n");
        runWorkbookCli(
            ["roadmap", "--epic", "100"],
            io,
            ghRunner({ number: 100, title: "Alpha" }, [{ number: 11, title: "First", body: whole }]),
        );
        expect(readRoadmap(repo, "alpha")?.stories[0].body).toBe(whole);
    });

    it("takes the name the learner gave it when they gave one", () => {
        const repo: string = initRepo();
        const io: Captured = makeIo(repo);
        runWorkbookCli(["roadmap", "my-roadmap", "--epic", "100"], io, ghRunner({ number: 100, title: "Alpha" }, STORIES));
        expect(readRoadmap(repo, "my-roadmap")).not.toBeNull();
    });
});

describe("a number that names something other than an epic", () => {
    it("stops, says why that number cannot be a roadmap, and makes no workbook", () => {
        const repo: string = initRepo();
        const io: Captured = makeIo(repo);
        const run: Runner = (cmd, args) => {
            if (cmd === "gh" && args[0] === "repo") return { status: 0, stdout: "acme/app\n", stderr: "" };
            if (cmd === "gh" && args[0] === "issue") {
                return { status: 0, stdout: JSON.stringify({ number: 12, title: "A story", body: "", state: "OPEN", stateReason: "", labels: [] }), stderr: "" };
            }
            if (cmd === "gh" && args[0] === "api") {
                // #12 is a story: filed as one, and a sub-issue of epic #100.
                const query: string = args.find((a) => a.startsWith("query=")) ?? "";
                if (query.includes("parent{number} issueType{name}")) {
                    const issue = {
                        parent: { number: 100 },
                        issueType: null,
                        state: "OPEN",
                        stateReason: null,
                        labels: { nodes: [{ name: "story" }] },
                    };
                    return { status: 0, stdout: JSON.stringify({ data: { repository: { issue } } }), stderr: "" };
                }
                return { status: 0, stdout: "100\n", stderr: "" };
            }
            return { status: 0, stdout: "", stderr: "" };
        };
        const code: number = runWorkbookCli(["roadmap", "--epic", "12"], io, run);
        expect(code).toBe(1);
        expect(io.err.join("\n")).toContain("not-an-epic");
        expect(fs.existsSync(path.join(repo, ".nexus", "workbook"))).toBe(false);
    });

    it("needs exactly one of an epic and a query", () => {
        const repo: string = initRepo();
        expect(runWorkbookCli(["roadmap"], makeIo(repo), ghRunner({ number: 100, title: "Alpha" }, STORIES))).toBe(2);
        expect(runWorkbookCli(["roadmap", "--epic", "100", "--query", "label:x"], makeIo(repo), ghRunner({ number: 100, title: "Alpha" }, STORIES))).toBe(2);
    });
});

describe("a backlog query naming several epics", () => {
    function searchRunner(rows: { number: number; repo: string }[], calls: string[][]): Runner {
        return (cmd: string, args: string[]): RunResult => {
            calls.push([cmd, ...args]);
            const payload = rows.map((r) => ({ number: r.number, repository: { nameWithOwner: r.repo } }));
            return { status: 0, stdout: JSON.stringify(payload), stderr: "" };
        };
    }

    it("composes the learner's expression with the configured exclusion, as an argument vector", () => {
        const repo: string = initRepo();
        const calls: string[][] = [];
        const result = epicsFromQuery(searchRunner([{ number: 100, repo: "acme/app" }], calls), repo, "label:teaching");
        expect(result.ok).toBe(true);
        const vector: string[] = calls[0];
        expect(vector).toContain("label:teaching");
        expect(vector.some((token) => token.startsWith("-label:"))).toBe(true);
        expect(vector.every((token) => !token.includes(" -label:"))).toBe(true);
    });

    it("returns every epic the query found", () => {
        const repo: string = initRepo();
        const result = epicsFromQuery(searchRunner([{ number: 200, repo: "acme/app" }, { number: 100, repo: "acme/app" }], []), repo, "label:teaching");
        expect(result.ok && result.epics).toEqual([100, 200]);
    });

    it("refuses a query returning more epics than the cap, by name", () => {
        const repo: string = initRepo();
        const rows = Array.from({ length: 11 }, (_, i) => ({ number: 100 + i, repo: "acme/app" }));
        const result = epicsFromQuery(searchRunner(rows, []), repo, "label:teaching");
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.problem).toBe("roadmap-too-many-epics");
    });

    it("says the query returned more than the cap, never a count the fetch limit invented", () => {
        const repo: string = initRepo();
        const calls: string[][] = [];
        const rows = Array.from({ length: ROADMAP_EPIC_CAP + 1 }, (_, i) => ({ number: 100 + i, repo: "acme/app" }));
        const result = epicsFromQuery(searchRunner(rows, calls), repo, "label:teaching");
        // The search is asked for one row past the cap, so the row count is a floor, not a total —
        // a query matching fifty epics comes back the same length as one matching eleven.
        const limit: string = calls[0][calls[0].indexOf("--limit") + 1];
        expect(Number(limit)).toBe(ROADMAP_EPIC_CAP + 1);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toContain(`more than ${ROADMAP_EPIC_CAP}`);
            expect(result.error.message).not.toContain(String(ROADMAP_EPIC_CAP + 1));
        }
    });

    it("refuses a query whose epics span more than one repository, by name", () => {
        const repo: string = initRepo();
        const result = epicsFromQuery(searchRunner([{ number: 100, repo: "acme/app" }, { number: 200, repo: "acme/other" }], []), repo, "label:teaching");
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.problem).toBe("roadmap-multi-repo");
            expect(result.error.message).toContain("acme/other");
        }
    });

    it("makes the learner name a query-resolved roadmap", () => {
        const repo: string = initRepo();
        const io: Captured = makeIo(repo);
        const code: number = runWorkbookCli(["roadmap", "--query", "label:teaching"], io, ghRunner({ number: 100, title: "Alpha" }, STORIES));
        expect(code).toBe(2);
        expect(io.err.join("\n")).toContain("name");
    });
});
