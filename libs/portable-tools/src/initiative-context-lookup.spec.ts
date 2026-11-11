/**
 * The context lookup stub planning and the decision record share (epic #850, story #853, decision
 * record #961, D5; reading from the issue: epic #1011, decision record #1016, D5–D7). GitHub is a
 * canned `gh` runner; the checkout is an empty temporary folder, because the lookup never reads it.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type RunResult, type Runner } from "@nexus/epic-resolve/run";
import { renderInitiativeBody } from "./initiative-context-store";
import { lookupInitiativeContext, renderContextSource } from "./initiative-context-lookup";

interface FakeIssue {
    body?: string;
    parent?: number;
    labels?: string[];
    comments?: { body: string; author_association: string; login?: string }[] | "fail";
}

/**
 * A canned `gh` that holds `issues` in the repository `home` only. A read that names another
 * repository finds no issue there, as GitHub would answer it. `calls` records every argument list.
 */
function fakeGh(issues: Record<number, FakeIssue>, home: string = "acme/app", calls: string[][] = []): Runner {
    return (cmd: string, args: string[]): RunResult => {
        const ok = (stdout: string): RunResult => ({ status: 0, stdout, stderr: "" });
        if (cmd !== "gh") return { status: 1, stdout: "", stderr: `unexpected ${cmd}` };
        calls.push(args);
        if (args[0] === "repo") return ok("acme/app\n");
        if (args[0] === "issue" && args[1] === "view") {
            const n = Number(args[2]);
            const repoAt = args.indexOf("--repo");
            const repo = repoAt === -1 ? "acme/app" : args[repoAt + 1].split("/").slice(-2).join("/");
            const issue = repo === home ? issues[n] : undefined;
            if (issue === undefined) return { status: 1, stdout: "", stderr: "not found" };
            return ok(JSON.stringify({ number: n, title: `#${n}`, body: issue.body ?? "", state: "OPEN", stateReason: "", labels: (issue.labels ?? []).map((name) => ({ name })) }));
        }
        if (args[0] === "api" && /\/issues\/\d+\/comments$/.test(args[1])) {
            const n = Number(args[1].match(/issues\/(\d+)\/comments/)?.[1]);
            const list = issues[n]?.comments ?? [];
            if (list === "fail") return { status: 1, stdout: "", stderr: "HTTP 502" };
            return ok(JSON.stringify([list.map((c, i) => ({ id: i + 1, body: c.body, author_association: c.author_association, user: { login: c.login ?? "someone" } }))]));
        }
        if (args[0] === "api" && args.includes("graphql")) {
            const field = (key: string): string => args.find((a) => a.startsWith(`${key}=`))?.slice(key.length + 1) ?? "";
            const n = Number(field("num"));
            const issue = `${field("owner")}/${field("repo")}` === home ? issues[n] : undefined;
            if (issue === undefined) return { status: 1, stdout: "", stderr: "Could not resolve to an issue with the number of " + n };
            return ok(JSON.stringify({
                data: { repository: { issue: {
                    parent: issue.parent === undefined ? null : { number: issue.parent },
                    issueType: null,
                    state: "OPEN",
                    stateReason: "",
                    labels: { nodes: (issue.labels ?? []).map((name) => ({ name })) },
                } } },
            }));
        }
        return { status: 1, stdout: "", stderr: `unexpected gh ${args.join(" ")}` };
    };
}

/** Declare the checkout's issues repository, as `.nexus/config/settings.yml` does. */
function declareEpicRepo(root: string, repo: string): void {
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), `github:\n  epic-repo: ${repo}\n`);
}

let tmpDirs: string[] = [];
function checkout(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "initiative-lookup-"));
    tmpDirs.push(dir);
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

const SUMMARY = "Ship the context.\n\n## Planning context\n\nOne store per initiative.\n";
const BIG = Array.from({ length: 4000 }, (_, i) => `line ${i} ${"x".repeat(40)}`).join("\n") + "\n";
const asComments = (parts: string[], association = "OWNER") => parts.map((body) => ({ body, author_association: association }));
const initiative = (body: string, comments?: FakeIssue["comments"]): Record<number, FakeIssue> => ({
    701: { parent: 700 },
    700: { body, labels: ["initiative"], comments },
});
const stopOf = (r: ReturnType<typeof lookupInitiativeContext>): { problem: string; message: string } => {
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected a stop");
    return r;
};

describe("the context lookup reads only the initiative issue (epic #1011, story #1013)", () => {
    it("reads a context kept in the body, whatever the checkout holds", () => {
        const { body } = renderInitiativeBody(SUMMARY, "# Plan\nDecided: keep it on the issue.\n");
        const r = lookupInitiativeContext(fakeGh(initiative(body)), checkout(), 701);
        if (!r.ok) throw new Error(r.message);
        expect(r.outcome.state).toBe("context");
        const text = renderContextSource(r.outcome);
        expect(text).toContain("Decided: keep it on the issue.");
        expect(text).toContain("One store per initiative.");
        expect(text.indexOf("its issue body")).toBeLessThan(text.indexOf("Decided"));
    });

    it("reads a context kept in numbered comments, in order, even when they were posted out of order", () => {
        const { body, parts } = renderInitiativeBody(SUMMARY, BIG);
        expect(parts.length).toBeGreaterThan(1);
        const r = lookupInitiativeContext(fakeGh(initiative(body, asComments([...parts].reverse()))), checkout(), 701);
        if (!r.ok) throw new Error(r.message);
        const text = renderContextSource(r.outcome);
        expect(text).toContain(BIG.trimEnd());
        expect(r.outcome.state === "context" && r.outcome.ignored).toEqual([]);
    });

    it("ignores a part from someone who cannot speak for the repository, and names who", () => {
        const { body, parts } = renderInitiativeBody(SUMMARY, BIG);
        const forged = parts[0].replace("line 0 ", "line 0 FORGED ");
        const comments = [{ body: forged, author_association: "NONE", login: "mallory" }, ...asComments(parts)];
        const r = lookupInitiativeContext(fakeGh(initiative(body, comments)), checkout(), 701);
        if (!r.ok) throw new Error(r.message);
        const text = renderContextSource(r.outcome);
        expect(text).not.toContain("FORGED");
        expect(r.outcome.state === "context" && r.outcome.ignored.map((i) => i.author)).toEqual(["mallory"]);
    });

    it("never lets an untrusted comment hide the trusted part with the same number", () => {
        const { body, parts } = renderInitiativeBody(SUMMARY, BIG);
        const comments = [...asComments(parts), { body: parts[0], author_association: "CONTRIBUTOR" }];
        const r = lookupInitiativeContext(fakeGh(initiative(body, comments)), checkout(), 701);
        expect(r.ok).toBe(true);
    });

    it("ignores a trusted comment that carries a part marker the body does not list", () => {
        const { body, parts } = renderInitiativeBody(SUMMARY, BIG);
        const extra = { body: `<!-- nexus:context-part ${parts.length + 1}/${parts.length + 1} -->\nsmuggled\n`, author_association: "OWNER", login: "lead" };
        const r = lookupInitiativeContext(fakeGh(initiative(body, [...asComments(parts), extra])), checkout(), 701);
        if (!r.ok) throw new Error(r.message);
        expect(renderContextSource(r.outcome)).not.toContain("smuggled");
        expect(r.outcome.state === "context" && r.outcome.ignored).toHaveLength(1);
    });

    it("stops before drafting, naming the initiative and the part, when a part is missing", () => {
        const { body, parts } = renderInitiativeBody(SUMMARY, BIG);
        const stop = stopOf(lookupInitiativeContext(fakeGh(initiative(body, asComments(parts.slice(1)))), checkout(), 701));
        expect(stop.message).toContain("#700");
        expect(stop.message).toMatch(/part 1\b/);
    });

    it("stops when a part changed after filing, and says it is restored by editing it back", () => {
        const { body, parts } = renderInitiativeBody(SUMMARY, BIG);
        const edited = [parts[0] + "an afterthought\n", ...parts.slice(1)];
        const stop = stopOf(lookupInitiativeContext(fakeGh(initiative(body, asComments(edited))), checkout(), 701));
        expect(stop.message).toContain("#700");
        expect(stop.message).toMatch(/part 1\b/);
        expect(stop.message).toMatch(/editing it back to its filed text/);
    });

    it("stops when the collapsed context in the body changed after filing", () => {
        const { body } = renderInitiativeBody(SUMMARY, "original decision\n");
        const stop = stopOf(lookupInitiativeContext(fakeGh(initiative(body.replace("original", "edited"))), checkout(), 701));
        expect(stop.message).toContain("#700");
    });

    it("stops when the comments cannot be read, rather than reading no parts", () => {
        const { body } = renderInitiativeBody(SUMMARY, BIG);
        const stop = stopOf(lookupInitiativeContext(fakeGh(initiative(body, "fail")), checkout(), 701));
        expect(stop.problem).toBe("comments-unreadable");
    });

    it("stops on a body that still names a context folder, naming the folder and never reading the checkout", () => {
        const root = checkout();
        fs.mkdirSync(path.join(root, ".nexus", "initiatives", "initiative-700"), { recursive: true });
        fs.writeFileSync(path.join(root, ".nexus", "initiatives", "initiative-700", "context.md"), "folder text\n");
        const legacy = `Ship it.\n\nThe full planning context of this initiative is kept in the repository, in \`.nexus/initiatives/initiative-700/\`.\n`;
        const stop = stopOf(lookupInitiativeContext(fakeGh(initiative(legacy)), root, 701));
        expect(stop.problem).toBe("legacy-folder");
        expect(stop.message).toContain("#700");
        expect(stop.message).toContain(".nexus/initiatives/initiative-700/");
    });

    it("reads the body alone when the initiative carries no context beyond its summary", () => {
        const r = lookupInitiativeContext(fakeGh(initiative("Objective only.\n")), checkout(), 701);
        expect(r.ok && r.outcome.state).toBe("body-only");
        if (!r.ok) return;
        expect(renderContextSource(r.outcome)).toContain("Objective only.");
    });

    it("changes nothing for an issue with no parent", () => {
        const r = lookupInitiativeContext(fakeGh({ 5: {} }), checkout(), 5);
        expect(r.ok && r.outcome.state).toBe("no-initiative");
        if (!r.ok) return;
        expect(renderContextSource(r.outcome)).toBe("");
    });

    it("changes nothing for an issue whose parent is not an initiative", () => {
        const { body } = renderInitiativeBody(SUMMARY, "x\n");
        const r = lookupInitiativeContext(fakeGh({ 41: { parent: 40 }, 40: { body, labels: ["epic"] } }), checkout(), 41);
        expect(r.ok && r.outcome.state).toBe("no-initiative");
    });

    it("reads the issues from the configured epic-repo, not the checkout's own repository", () => {
        const root = checkout();
        declareEpicRepo(root, "acme/issues");
        const { body } = renderInitiativeBody(SUMMARY, "x\n");
        const r = lookupInitiativeContext(fakeGh(initiative(body), "acme/issues"), root, 701);
        expect(r.ok && r.outcome.state).toBe("context");
    });

    it("reaches the host a configured epic-repo names", () => {
        const root = checkout();
        declareEpicRepo(root, "ghe.example.com/acme/issues");
        const calls: string[][] = [];
        const r = lookupInitiativeContext(fakeGh(initiative("Objective only.\n"), "acme/issues", calls), root, 701);
        expect(r.ok && r.outcome.state).toBe("body-only");
        const reads = calls.filter((args) => args[0] !== "repo");
        expect(reads.length).toBeGreaterThan(0);
        for (const args of reads) expect(args.join(" ")).toContain("ghe.example.com");
    });

    it("fails on an issue that does not exist, rather than reading it as unparented", () => {
        expect(lookupInitiativeContext(fakeGh({}), checkout(), 9).ok).toBe(false);
    });
});
