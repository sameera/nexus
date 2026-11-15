/**
 * Restamping an initiative's kept context: a lead accepts a deliberate edit to the planning context
 * instead of reverting it. GitHub is a canned `gh` runner that keeps each issue's edit history and
 * applies `gh issue edit` to the body it serves next.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type RunResult, type Runner } from "@nexus/epic-resolve/run";
import { renderInitiativeBody } from "./initiative-context-store";
import { lookupInitiativeContext } from "./initiative-context-lookup";
import { restampInitiativeContext } from "./initiative-context-restamp";
import { runInitiativeContext } from "./initiative-context-cli";

interface Version {
    at: string;
    login: string | null;
    body: string;
}

interface FakeComment {
    body: string;
    association?: string;
    login?: string;
    edits?: Version[];
}

interface FakeIssue {
    body?: string;
    parent?: number;
    labels?: string[];
    edits?: Version[] | "fail";
    comments?: FakeComment[];
}

interface Fake {
    run: Runner;
    issues: Record<number, FakeIssue>;
    writes: string[];
}

/** Logins and their permission on acme/app; anyone else is not a collaborator. */
const PERMISSIONS: Record<string, string> = { lead: "admin", teammate: "write", reader: "read" };

function fakeGh(issues: Record<number, FakeIssue>): Fake {
    const writes: string[] = [];
    const run: Runner = (cmd: string, args: string[], opts: { cwd: string; input?: string }): RunResult => {
        const ok = (stdout: string): RunResult => ({ status: 0, stdout, stderr: "" });
        const fail = (stderr: string): RunResult => ({ status: 1, stdout: "", stderr });
        if (cmd !== "gh") return fail(`unexpected ${cmd}`);
        if (args[0] === "repo") return ok("acme/app\n");
        if (args[0] === "issue" && args[1] === "view") {
            const issue = issues[Number(args[2])];
            if (issue === undefined) return fail("not found");
            return ok(JSON.stringify({ number: Number(args[2]), title: "t", body: issue.body ?? "", state: "OPEN", stateReason: "", labels: (issue.labels ?? []).map((name) => ({ name })) }));
        }
        if (args[0] === "issue" && args[1] === "edit") {
            const n = Number(args[2]);
            writes.push(`#${n}`);
            issues[n].body = opts.input ?? "";
            return ok("");
        }
        if (args[0] === "api" && args[1] === "graphql") {
            const field = (key: string): string => args.find((a) => a.startsWith(`${key}=`))?.slice(key.length + 1) ?? "";
            const query = field("query");
            const asNodes = (edits: Version[]): unknown => ({
                nodes: [...edits].reverse().map((v) => ({ editedAt: v.at, editor: v.login === null ? null : { login: v.login }, diff: v.body })),
            });
            if (query.includes("userContentEdits") && query.includes("node(id")) {
                const id = field("id");
                for (const issue of Object.values(issues)) {
                    for (const [i, c] of (issue.comments ?? []).entries()) {
                        if (`C_${i + 1}` === id) return ok(JSON.stringify({ data: { node: { userContentEdits: asNodes(c.edits ?? []) } } }));
                    }
                }
                return fail("Could not resolve to a node");
            }
            const issue = issues[Number(field("num"))];
            if (issue === undefined) return fail("Could not resolve to an issue with the number of " + field("num"));
            if (query.includes("userContentEdits")) {
                if (issue.edits === "fail") return fail("HTTP 502");
                return ok(JSON.stringify({ data: { repository: { issue: { userContentEdits: asNodes(issue.edits ?? []) } } } }));
            }
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
        if (args[0] === "api" && /\/issues\/\d+\/comments$/.test(args[1])) {
            const n = Number(args[1].match(/issues\/(\d+)\/comments/)?.[1]);
            const list = (issues[n]?.comments ?? []).map((c, i) => ({
                id: i + 1,
                node_id: `C_${i + 1}`,
                body: c.body,
                author_association: c.association ?? "OWNER",
                user: { login: c.login ?? "lead" },
            }));
            return ok(JSON.stringify([list]));
        }
        const perm = args[1]?.match(/^repos\/acme\/app\/collaborators\/([^/]+)\/permission$/);
        if (args[0] === "api" && perm !== null && perm !== undefined) {
            const p = PERMISSIONS[perm[1]];
            return p === undefined ? fail("HTTP 404: is not a user") : ok(JSON.stringify({ permission: p }));
        }
        return fail(`unexpected gh ${args.join(" ")}`);
    };
    return { run, issues, writes };
}

let tmpDirs: string[] = [];
function checkout(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "initiative-restamp-"));
    tmpDirs.push(dir);
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

const SUMMARY = "Ship the flows.\n\n## Planning context\n\nTwo ports, one orchestrator.\n";
const FILED = "# Plan\nDecided: expressions resolve eagerly.\nDeferred: retries.\n";
const EDITED = "# Plan\nDecided: expressions resolve lazily, at step start.\nDeferred: retries.\n";
const BIG = Array.from({ length: 4000 }, (_, i) => `line ${i} ${"x".repeat(40)}`).join("\n") + "\n";

/** An initiative #700 filed with `FILED`, whose context the lead then edited to `EDITED`. */
function editedInline(editor: string | null = "lead", extra: Version[] = []): Record<number, FakeIssue> {
    const filed = renderInitiativeBody(SUMMARY, FILED).body;
    const edited = filed.replace(FILED, EDITED);
    return {
        701: { parent: 700 },
        700: {
            body: edited,
            labels: ["initiative"],
            edits: [
                { at: "2026-11-14T16:56:06Z", login: "lead", body: filed },
                ...extra,
                { at: "2026-11-15T04:21:37Z", login: editor, body: edited },
            ],
        },
    };
}

const refusal = (r: ReturnType<typeof restampInitiativeContext>): { problem: string; message: string } => {
    if (r.ok) throw new Error(`expected a refusal, got ${r.state}`);
    return r;
};

describe("restamp previews a changed context before anything is written", () => {
    it("reports an unchanged context and writes nothing", () => {
        const body = renderInitiativeBody(SUMMARY, FILED).body;
        const gh = fakeGh({ 700: { body, labels: ["initiative"] } });
        const r = restampInitiativeContext(gh.run, checkout(), 700);
        expect(r.ok && r.state).toBe("unchanged");
        expect(gh.writes).toEqual([]);
    });

    it("shows what changed since filing and who changed it, and writes nothing", () => {
        const gh = fakeGh(editedInline());
        const r = restampInitiativeContext(gh.run, checkout(), 700);
        if (!r.ok || r.state !== "preview") throw new Error(JSON.stringify(r));
        expect(r.changes).toHaveLength(1);
        const [change] = r.changes;
        expect(change.baseline).toBe("found");
        expect(change.editors.map((e) => e.login)).toEqual(["lead"]);
        const lines = change.diff.split("\n");
        expect(lines.some((l) => l.startsWith("-") && l.includes("resolve eagerly"))).toBe(true);
        expect(lines.some((l) => l.startsWith("+") && l.includes("resolve lazily"))).toBe(true);
        expect(lines.some((l) => /^[-+]/.test(l) && l.includes("Deferred: retries"))).toBe(false);
        expect(lines.findIndex((l) => l.includes("resolve eagerly"))).toBeLessThan(lines.findIndex((l) => l.includes("resolve lazily")));
        expect(gh.writes).toEqual([]);
    });

    it("does not count an edit outside the context, such as the filing run's stub numbers", () => {
        const filed = renderInitiativeBody(SUMMARY, FILED).body;
        const numbered: Version = { at: "2026-11-14T16:57:08Z", login: "some-bot", body: filed.replace("Two ports", "Two ports (#2, #3)") };
        const gh = fakeGh(editedInline("lead", [numbered]));
        gh.issues[700].body = (gh.issues[700].body as string).replace("Two ports", "Two ports (#2, #3)");
        const r = restampInitiativeContext(gh.run, checkout(), 700);
        if (!r.ok || r.state !== "preview") throw new Error(JSON.stringify(r));
        expect(r.changes[0].editors.map((e) => e.login)).toEqual(["lead"]);
    });

    it("still previews when the filed text is not in the edit history, showing the whole context as new", () => {
        const issues = editedInline();
        const history = issues[700].edits as Version[];
        issues[700].edits = history.slice(1);
        const r = restampInitiativeContext(fakeGh(issues).run, checkout(), 700);
        if (!r.ok || r.state !== "preview") throw new Error(JSON.stringify(r));
        expect(r.changes[0].baseline).toBe("not-found");
        expect(r.changes[0].diff.split("\n").filter((l) => l.startsWith("+")).length).toBe(EDITED.trimEnd().split("\n").length);
    });
});

describe("restamp accepts the edit only for the context the lead previewed", () => {
    it("records the edited context, so the lookup reads it and the rest of the body is kept", () => {
        const gh = fakeGh(editedInline());
        const root = checkout();
        const preview = restampInitiativeContext(gh.run, root, 700);
        if (!preview.ok || preview.state !== "preview") throw new Error(JSON.stringify(preview));
        const done = restampInitiativeContext(gh.run, root, 700, preview.token);
        expect(done.ok && done.state).toBe("restamped");
        expect(gh.writes).toEqual(["#700"]);
        expect(gh.issues[700].body).toContain("Two ports, one orchestrator.");
        const looked = lookupInitiativeContext(gh.run, root, 701);
        if (!looked.ok) throw new Error(looked.message);
        expect(looked.outcome.state === "context" && looked.outcome.text).toContain("resolve lazily");
    });

    it("refuses a token from a preview of different text, and writes nothing", () => {
        const gh = fakeGh(editedInline());
        const root = checkout();
        const preview = restampInitiativeContext(gh.run, root, 700);
        if (!preview.ok || preview.state !== "preview") throw new Error(JSON.stringify(preview));
        gh.issues[700].body = (gh.issues[700].body as string).replace("at step start", "at flow start");
        const r = refusal(restampInitiativeContext(gh.run, root, 700, preview.token));
        expect(r.problem).toBe("token-mismatch");
        expect(gh.writes).toEqual([]);
    });

    it("refuses when someone who cannot speak for the repository changed the context", () => {
        for (const editor of ["reader", "stranger", null]) {
            const gh = fakeGh(editedInline(editor));
            const r = refusal(restampInitiativeContext(gh.run, checkout(), 700));
            expect(r.problem).toBe("untrusted-editor");
            if (editor !== null) expect(r.message).toContain(editor);
            expect(gh.writes).toEqual([]);
        }
    });

    it("accepts an edit by a teammate with write access", () => {
        const r = restampInitiativeContext(fakeGh(editedInline("teammate")).run, checkout(), 700);
        expect(r.ok && r.state).toBe("preview");
    });
});

describe("restamp refuses what it cannot vouch for", () => {
    it("refuses an issue that is not an initiative", () => {
        const body = renderInitiativeBody(SUMMARY, FILED).body;
        const r = refusal(restampInitiativeContext(fakeGh({ 700: { body, labels: ["epic"] } }).run, checkout(), 700));
        expect(r.problem).toBe("not-initiative");
    });

    it("refuses an initiative with no kept context", () => {
        const r = refusal(restampInitiativeContext(fakeGh({ 700: { body: SUMMARY, labels: ["initiative"] } }).run, checkout(), 700));
        expect(r.problem).toBe("no-context");
    });

    it("refuses when the edit history cannot be read", () => {
        const issues = editedInline();
        issues[700].edits = "fail";
        const r = refusal(restampInitiativeContext(fakeGh(issues).run, checkout(), 700));
        expect(r.problem).toBe("history-unreadable");
    });

    it("refuses when the history names no edit that changed the context", () => {
        const issues = editedInline();
        issues[700].edits = [];
        const r = refusal(restampInitiativeContext(fakeGh(issues).run, checkout(), 700));
        expect(r.problem).toBe("history-incomplete");
    });
});

describe("restamp handles a context kept in numbered comments", () => {
    function editedParts(editor: string = "lead"): { issues: Record<number, FakeIssue>; parts: string[] } {
        const { body, parts } = renderInitiativeBody(SUMMARY, BIG);
        const changed = parts[1].replace(/line (\d+) x/, "line $1 CHANGED x");
        return {
            parts,
            issues: {
                701: { parent: 700 },
                700: {
                    body,
                    labels: ["initiative"],
                    comments: parts.map((p, i) =>
                        i === 1
                            ? { body: changed, edits: [{ at: "2026-11-14T17:00:00Z", login: "lead", body: p }, { at: "2026-11-15T04:00:00Z", login: editor, body: changed }] }
                            : { body: p },
                    ),
                },
            },
        };
    }

    it("names the changed part, and after acceptance the lookup reads it", () => {
        const { issues } = editedParts();
        const gh = fakeGh(issues);
        const root = checkout();
        const preview = restampInitiativeContext(gh.run, root, 700);
        if (!preview.ok || preview.state !== "preview") throw new Error(JSON.stringify(preview));
        expect(preview.changes.map((c) => c.part)).toEqual([2]);
        expect(preview.changes[0].diff).toContain("CHANGED");
        expect(lookupInitiativeContext(gh.run, root, 701).ok).toBe(false);
        restampInitiativeContext(gh.run, root, 700, preview.token);
        const looked = lookupInitiativeContext(gh.run, root, 701);
        if (!looked.ok) throw new Error(looked.message);
        expect(looked.outcome.state === "context" && looked.outcome.text).toContain("CHANGED");
    });

    it("refuses a missing part, which restamping cannot replace", () => {
        const { issues } = editedParts();
        (issues[700].comments as FakeComment[]).splice(2, 1);
        const r = refusal(restampInitiativeContext(fakeGh(issues).run, checkout(), 700));
        expect(r.problem).toBe("context-missing");
    });

    it("refuses a changed part edited by someone who cannot speak for the repository", () => {
        const r = refusal(restampInitiativeContext(fakeGh(editedParts("reader").issues).run, checkout(), 700));
        expect(r.problem).toBe("untrusted-editor");
    });
});

describe("the changed-context stop names restamp as the way forward", () => {
    it("names the restamp command for the initiative", () => {
        const r = lookupInitiativeContext(fakeGh(editedInline()).run, checkout(), 701);
        if (r.ok) throw new Error("expected a stop");
        expect(r.problem).toBe("context-changed");
        expect(r.message).toContain("nexus initiative-context restamp --issue 700");
    });
});

describe("nexus initiative-context restamp", () => {
    it("rejects a call with no issue", async () => {
        const err: string[] = [];
        const code = await runInitiativeContext(["restamp"], { cwd: checkout(), stdout: () => {}, stderr: (l) => err.push(l) });
        expect(code).toBe(2);
        expect(err.join("\n")).toContain("restamp --issue");
    });
});
