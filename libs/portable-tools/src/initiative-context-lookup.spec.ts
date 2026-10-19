/**
 * The context lookup stub planning and the decision record share (epic #850, story #853, decision
 * record #961, D5). GitHub is a canned `gh` runner; the checkout is a temporary folder, so what the
 * lookup finds there is what a lead's checkout would hold.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type RunResult, type Runner } from "@nexus/epic-resolve/run";
import { initiativeContextDir, renderPointer } from "./initiative-context";
import { lookupInitiativeContext, renderContextSource } from "./initiative-context-lookup";

interface FakeIssue {
    body?: string;
    parent?: number;
    labels?: string[];
}

function fakeGh(issues: Record<number, FakeIssue>): Runner {
    return (cmd: string, args: string[]): RunResult => {
        const ok = (stdout: string): RunResult => ({ status: 0, stdout, stderr: "" });
        if (cmd !== "gh") return { status: 1, stdout: "", stderr: `unexpected ${cmd}` };
        if (args[0] === "repo") return ok("acme/app\n");
        if (args[0] === "issue" && args[1] === "view") {
            const n = Number(args[2]);
            const issue = issues[n];
            if (issue === undefined) return { status: 1, stdout: "", stderr: "not found" };
            return ok(JSON.stringify({ number: n, title: `#${n}`, body: issue.body ?? "", state: "OPEN", stateReason: "", labels: (issue.labels ?? []).map((name) => ({ name })) }));
        }
        if (args[0] === "api" && args[1] === "graphql") {
            const n = Number(args[args.indexOf("-F", args.indexOf("-F", args.indexOf("-F") + 1) + 1) + 1].slice("num=".length));
            const issue = issues[n];
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

function keep(root: string, initiative: number, files: Record<string, string>): void {
    const folder = path.join(root, initiativeContextDir(initiative));
    fs.mkdirSync(folder, { recursive: true });
    for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(folder, name), text);
}

const FILED_BODY = `Ship the context.\n\n## Planning context\n\nOne store per initiative.\n\n${renderPointer(700)}\n`;

describe("the context lookup (story #853, D5)", () => {
    it("reads the initiative body and every context file, in name order (G21)", () => {
        const root = checkout();
        keep(root, 700, { "plan-session.md": "# Plan\nDecided: keep it in the repo.\n", "context.md": "**Why this split:** order.\n" });
        const r = lookupInitiativeContext(fakeGh({ 701: { parent: 700 }, 700: { body: FILED_BODY, labels: ["initiative"] } }), root, 701);

        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.outcome.state).toBe("context");
        if (r.outcome.state !== "context") return;
        expect(r.outcome.initiative).toBe(700);
        expect(r.outcome.files.map((f) => f.name)).toEqual(["context.md", "plan-session.md"]);
        expect(r.outcome.files[1].text).toBe("# Plan\nDecided: keep it in the repo.\n");
    });

    it("reads a folder the lead wrote by hand, with no pointer in the body, the same way (G17)", () => {
        const root = checkout();
        keep(root, 832, { "anything-named.md": "the session's plan\n" });
        const r = lookupInitiativeContext(fakeGh({ 833: { parent: 832 }, 832: { body: "An older initiative.\n", labels: ["initiative"] } }), root, 833);

        expect(r.ok && r.outcome.state).toBe("context");
    });

    it("reads the body alone when the initiative has neither a pointer nor a folder", () => {
        const root = checkout();
        const r = lookupInitiativeContext(fakeGh({ 711: { parent: 710 }, 710: { body: "Objective only.\n", labels: ["initiative"] } }), root, 711);

        expect(r.ok && r.outcome.state).toBe("body-only");
        if (!r.ok) return;
        expect(renderContextSource(r.outcome)).toContain("Objective only.");
    });

    it("stops, naming the expected folder, when the body names a context the checkout lacks (G15)", () => {
        const root = checkout();
        const r = lookupInitiativeContext(fakeGh({ 701: { parent: 700 }, 700: { body: FILED_BODY, labels: ["initiative"] } }), root, 701);

        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.problem).toBe("context-missing");
        expect(r.message).toContain(initiativeContextDir(700));
        expect(r.message).toMatch(/not committed or not pulled/);
    });

    it("changes nothing for an issue with no parent (G14)", () => {
        const r = lookupInitiativeContext(fakeGh({ 5: {} }), checkout(), 5);
        expect(r.ok && r.outcome.state).toBe("no-initiative");
        if (!r.ok) return;
        expect(renderContextSource(r.outcome)).toBe("");
    });

    it("changes nothing for an issue whose parent is not an initiative (G14)", () => {
        const root = checkout();
        keep(root, 40, { "context.md": "not an initiative's\n" });
        const r = lookupInitiativeContext(fakeGh({ 41: { parent: 40 }, 40: { body: FILED_BODY, labels: ["epic"] } }), root, 41);
        expect(r.ok && r.outcome.state).toBe("no-initiative");
    });

    it("renders each part under a heading naming where it came from (D6)", () => {
        const root = checkout();
        keep(root, 700, { "context.md": "Split by goal.\n" });
        const r = lookupInitiativeContext(fakeGh({ 701: { parent: 700 }, 700: { body: FILED_BODY, labels: ["initiative"] } }), root, 701);
        if (!r.ok) throw new Error(r.message);
        const text = renderContextSource(r.outcome);

        expect(text.indexOf("## From initiative #700: its issue body")).toBeLessThan(text.indexOf("## From initiative #700: kept context file context.md"));
        expect(text).toContain("One store per initiative.");
        expect(text).toContain("Split by goal.");
    });

    it("fails on an issue that does not exist, rather than reading it as unparented", () => {
        const r = lookupInitiativeContext(fakeGh({}), checkout(), 9);
        expect(r.ok).toBe(false);
    });
});
