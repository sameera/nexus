/**
 * Filing approved deferred scope through the existing batch filer (epic #830, story #866, decision
 * record #872, D9; G19, G46). The filer's platform is a stand-in, so these read the issues it was
 * asked to create — their title, labels, body and repository — and the numbers close gets back.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type FilerEnvironment } from "@nexus/delivery-config/story-filer/environment";
import { fileDeferredStubs, type StubToFile } from "./close-stubs.js";

const tmp: string[] = [];
afterEach(() => {
    for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function checkout(settings: string): string {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "nexus-close-stubs-")));
    tmp.push(root);
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), settings);
    return root;
}

interface Created {
    title: string;
    labels: string[];
    body: string;
    repo: string | null;
}

/** A platform that mints issue numbers from 500 up, and always fails to create a title `failing` names. */
function platform(failing: string | null = null): { env: FilerEnvironment; created: Created[]; calls: string[][] } {
    const created: Created[] = [];
    const calls: string[][] = [];
    const ok = (stdout = "") => ({ status: 0, stdout, stderr: "" });
    return {
        created,
        calls,
        env: {
            runnerFor: () => (args: string[]) => {
                calls.push(args);
                if (args[0] === "issue" && args[1] === "create") {
                    if (failing !== null && args[args.indexOf("--title") + 1] === failing) return { status: 1, stdout: "", stderr: "HTTP 502" };
                    const labels: string[] = [];
                    args.forEach((a, i) => a === "--label" && labels.push(args[i + 1]));
                    const r = args.indexOf("-R");
                    created.push({
                        title: args[args.indexOf("--title") + 1],
                        labels,
                        body: fs.readFileSync(args[args.indexOf("--body-file") + 1], "utf8"),
                        repo: r < 0 ? null : args[r + 1],
                    });
                    return ok(`https://github.com/acme/epics/issues/${499 + created.length}\n`);
                }
                if (args[0] === "issue" && args[1] === "view" && args.includes("body")) return ok(created[0]?.body ?? "");
                if (args[0] === "api" && args.includes(".id")) return ok("9001\n");
                if (args[0] === "api" && args[1] === "graphql") return ok(JSON.stringify({ data: { repository: { projectsV2: { nodes: [] } } } }));
                return ok();
            },
            sleep: () => undefined,
            random: () => 0,
        },
    };
}

const stub = (n: number, title = `Deferred goal ${n}`): StubToFile => ({
    ref: `STUB-acme-app-901-DS${n}`,
    key: `acme/app#901 DS${n}`,
    title,
    body: `${title}\n\n## Meta\n\n- **feature:** delivery/close\n\n<!-- nexus:close-stub epic: acme/epics#830 pr: acme/app#901 proposal: DS${n} -->\n`,
});

describe("filing approved deferred scope as unplanned epic stubs (D9, G19)", () => {
    it("files one epic per stub, with the epic classification and the unplanned label, into the issues repository", () => {
        const root = checkout("github:\n  classification: labels\n  project: none\n  story-repo: acme/stories\n");
        const p = platform();
        const r = fileDeferredStubs(root, "acme/epics", "epic-830", [stub(1), stub(2)], p.env);
        expect(r.ok).toBe(true);
        expect(r.ok && [...r.numbers.entries()]).toEqual([
            ["acme/app#901 DS1", 500],
            ["acme/app#901 DS2", 501],
        ]);
        expect(p.created.map((c) => c.title)).toEqual(["Deferred goal 1", "Deferred goal 2"]);
        for (const c of p.created) {
            expect(c.labels.sort()).toEqual(["epic", "needs-refinement"]);
            expect(c.repo).toBe("acme/epics");
            expect(c.body).toContain("<!-- nexus:close-stub ");
            expect(c.body).not.toMatch(/estimate/i);
        }
        // A stub is never a sub-issue, and has no ordering edges.
        expect(p.calls.some((a) => a.join(" ").includes("sub_issues"))).toBe(false);
        expect(p.calls.some((a) => a.join(" ").includes("blocked_by"))).toBe(false);
        expect(fs.existsSync(path.join(root, ".nexus", "tmp", "close-stubs-epic-830"))).toBe(false);
    });

    it("reads the classification and the label a repository declared, never built-in names", () => {
        const root = checkout("github:\n  classification: labels\n  project: none\n  epic-label: initiative\n  unplanned-label: icebox\n");
        const p = platform();
        expect(fileDeferredStubs(root, "acme/epics", "epic-830", [stub(1)], p.env).ok).toBe(true);
        expect(p.created[0].labels.sort()).toEqual(["icebox", "initiative"]);
    });

    it("keeps a goal's text whole in the title, even one holding quotes and a run of hyphens", () => {
        const root = checkout("github:\n  classification: labels\n  project: none\n");
        const p = platform();
        expect(fileDeferredStubs(root, "acme/epics", "epic-830", [stub(1, 'Support "dry" runs --- later')], p.env).ok).toBe(true);
        expect(p.created[0].title.replace(/​/g, "")).toBe('Support "dry" runs --- later');
    });

    it("returns the numbers filed before a failure, names the stubs that were not, and keeps the scratch for the re-run", () => {
        const root = checkout("github:\n  classification: labels\n  project: none\n");
        const p = platform("Deferred goal 2");
        const r = fileDeferredStubs(root, "acme/epics", "epic-830", [stub(1), stub(2)], p.env);
        expect(r.ok).toBe(false);
        expect([...r.numbers.entries()]).toEqual([["acme/app#901 DS1", 500]]);
        expect(r.ok ? "" : r.message).toContain("Deferred goal 2");
    });

    it("never hands one proposal's number to another from a ledger an interrupted run left", () => {
        const root = checkout("github:\n  classification: labels\n  project: none\n");
        const dir = path.join(root, ".nexus", "tmp", "close-stubs-epic-830");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, ".nxs-created.json"), JSON.stringify({ "stub-acme-app-901-ds1": { number: "500" } }));
        fs.writeFileSync(path.join(dir, "STORY-STUB-01.md"), "---\nref: STUB-acme-app-901-DS1\ntitle: stale\n---\nstale\n");
        const p = platform();
        const r = fileDeferredStubs(root, "acme/epics", "epic-830", [stub(2)], p.env);
        expect(r.ok && [...r.numbers.entries()]).toEqual([["acme/app#901 DS2", 500]]);
        expect(p.created.map((c) => c.title)).toEqual(["Deferred goal 2"]);
    });
});
