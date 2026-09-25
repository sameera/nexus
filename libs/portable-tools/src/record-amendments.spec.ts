/**
 * `nexus record-amendments` — the amendment check (epic #787, story #791, D8).
 *
 * For each promised epic or story change in a draft, the check reads the live issue and reports
 * whether the exact new wording is there, and what the issue says today. A fake `gh` runner stands
 * in for GitHub, so every case here also proves the check only ever reads.
 *
 * The commitment lines are record #794's D10 and D11, copied here as realistic fixtures.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type RunResult, type Runner } from "@nexus/workspace/run";
import { runRecordAmendments } from "./record-amendments";

const D10_OLD = "**Given** any record run, **when** the stage drafts, checks or files the record, **then** it never edits the epic issue or a story issue.";
const D10_NEW =
    "**Given** any record run, **when** the stage drafts, checks or files the record, **then** it never edits the text of the epic issue or of a story issue; moving the epic's labels is unchanged.";
const D11_OLD = "Records already filed in the old format are not rewritten; the new format applies to records drafted after the release.";
const D11_NEW =
    "Records already filed in the old format are not rewritten; the new format applies to records first filed after the release, and a revision keeps the format its record was approved in.";

const D10_LINE = `- **Epic commitment affected:** #791 criterion 4. Old: "${D10_OLD}". New: "${D10_NEW}". Status: pending.`;
const D11_LINE = `- **Epic commitment affected:** #787, second assumption. Old: "${D11_OLD}". New: "${D11_NEW}". Status: pending.`;

const TODAY: Date = new Date(2026, 8, 25, 10, 30);

let dirs: string[] = [];
afterEach(() => {
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
    dirs = [];
});

function entry(id: string, commitment: string): string {
    return [`#### ${id} — A decision`, "", "- **Decision:** a thing.", "- **Why:** a reason.", commitment, "- **Delivered by:** #791", ""].join("\n");
}

function draftDir(...entries: string[]): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "record-amendments-"));
    dirs.push(dir);
    const body: string = [
        "# Decision Record: X",
        "",
        "## Guarantees",
        "",
        "- G1. A thing holds. (D1) [inferred]",
        "",
        "## Design rationale and mechanism",
        "",
        "### Decisions and reasons",
        "",
        ...entries,
    ].join("\n");
    fs.writeFileSync(path.join(dir, "record-body.labelled.md"), body);
    return dir;
}

/** A fake gh: answers `gh api repos/<repo>/issues/<n>` from the given bodies, and records every call. */
function fakeGh(bodies: Record<string, string>, failures: Record<string, string> = {}): { run: Runner; calls: string[][] } {
    const calls: string[][] = [];
    const run: Runner = (cmd: string, args: string[]): RunResult => {
        calls.push([cmd, ...args]);
        const target: string = args[1] ?? "";
        const key: string = target.replace(/^repos\//, "").replace(/\/issues\//, "#");
        if (failures[key] !== undefined) return { status: 1, stdout: "", stderr: failures[key] };
        if (bodies[key] === undefined) return { status: 1, stdout: "", stderr: "gh: Not Found (HTTP 404)" };
        return { status: 0, stdout: JSON.stringify({ number: 1, body: bodies[key] }), stderr: "" };
    };
    return { run, calls };
}

interface Captured {
    code: number;
    out: string;
    err: string;
}

async function check(argv: string[], dir: string, run: Runner): Promise<Captured> {
    const out: string[] = [];
    const err: string[] = [];
    const code: number = await runRecordAmendments(argv, { cwd: dir, stdout: (s) => out.push(s), stderr: (s) => err.push(s) }, { run, today: () => TODAY });
    return { code, out: out.join("\n"), err: err.join("\n") };
}

interface Amendment {
    decision: string;
    issue: number;
    repo: string | null;
    status: string;
    newPresent: boolean;
    oldPresent: boolean;
    saysToday: string;
}

function amendments(r: Captured): { checked: string; amendments: Amendment[] } {
    return JSON.parse(r.out) as { checked: string; amendments: Amendment[] };
}

const HERE = "{owner}/{repo}";

describe("nexus record-amendments reads each promised change against the live issue", () => {
    it("reports a change as amended, with the date checked, when the new wording is on the issue", async () => {
        const dir: string = draftDir(entry("D10", D10_LINE));
        const { run } = fakeGh({ [`${HERE}#791`]: `## Acceptance Criteria\n\n- [ ] ${D10_NEW}\n` });
        const r: Captured = await check(["--draft", "record-body.labelled.md"], dir, run);
        expect(r.code).toBe(0);
        const read = amendments(r);
        expect(read.checked).toBe("2026-09-25");
        expect(read.amendments).toEqual([expect.objectContaining({ decision: "D10", issue: 791, status: "amended", newPresent: true, oldPresent: false })]);
    });

    it("reports a change as pending, quoting the old wording the issue still carries", async () => {
        const dir: string = draftDir(entry("D10", D10_LINE));
        const { run } = fakeGh({ [`${HERE}#791`]: `- [ ] ${D10_OLD}\n` });
        const r: Captured = await check(["--draft", "record-body.labelled.md"], dir, run);
        expect(r.code).toBe(0);
        const [a] = amendments(r).amendments;
        expect(a).toMatchObject({ status: "pending", newPresent: false, oldPresent: true });
        expect(a.saysToday).toContain(D10_OLD);
    });

    it("says when neither wording is on the issue, which usually means the record misquotes it", async () => {
        const dir: string = draftDir(entry("D11", D11_LINE));
        const { run } = fakeGh({ [`${HERE}#787`]: "## Assumptions\n\n- Records are never rewritten.\n" });
        const r: Captured = await check(["--draft", "record-body.labelled.md"], dir, run);
        expect(r.code).toBe(0);
        const [a] = amendments(r).amendments;
        expect(a).toMatchObject({ status: "pending", newPresent: false, oldPresent: false });
        expect(a.saysToday).toMatch(/neither the old nor the new wording/i);
    });

    it("matches after normalising whitespace and case only", async () => {
        const dir: string = draftDir(entry("D10", D10_LINE));
        const wrapped: string = D10_NEW.toUpperCase().replace(/ /g, "\n   ");
        const { run } = fakeGh({ [`${HERE}#791`]: wrapped });
        const r: Captured = await check(["--draft", "record-body.labelled.md"], dir, run);
        expect(amendments(r).amendments[0].status).toBe("amended");
    });

    it("skips a decision whose commitment is none, and checks every other one", async () => {
        const dir: string = draftDir(entry("D1", "- **Epic commitment affected:** none"), entry("D10", D10_LINE), entry("D11", D11_LINE));
        const { run } = fakeGh({ [`${HERE}#791`]: D10_NEW, [`${HERE}#787`]: D11_OLD });
        const r: Captured = await check(["--draft", "record-body.labelled.md"], dir, run);
        expect(r.code).toBe(0);
        expect(amendments(r).amendments.map((a) => [a.decision, a.status])).toEqual([
            ["D10", "amended"],
            ["D11", "pending"],
        ]);
    });

    it("prints an empty list for a draft that promises no change", async () => {
        const dir: string = draftDir(entry("D1", "- **Epic commitment affected:** none"));
        const { run, calls } = fakeGh({});
        const r: Captured = await check(["--draft", "record-body.labelled.md"], dir, run);
        expect(r.code).toBe(0);
        expect(amendments(r).amendments).toEqual([]);
        expect(calls).toEqual([]);
    });

    it("leaves an unresolved change as it is and does not fetch it", async () => {
        const unresolved = "- **Epic commitment affected:** #787, second assumption. Status: unresolved (the wording is not agreed).";
        const dir: string = draftDir(entry("D11", unresolved));
        const { run, calls } = fakeGh({});
        const r: Captured = await check(["--draft", "record-body.labelled.md"], dir, run);
        expect(r.code).toBe(0);
        expect(amendments(r).amendments[0]).toMatchObject({ decision: "D11", status: "unresolved" });
        expect(calls).toEqual([]);
    });

    it("reads a bare reference against the configured epic repository, and a qualified one against the repository it names", async () => {
        const dir: string = draftDir(entry("D10", D10_LINE), entry("D11", D11_LINE.replace("#787,", "acme/other#787,")));
        fs.mkdirSync(path.join(dir, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".nexus", "config", "settings.yml"), "github:\n  epic-repo: acme/docs\n");
        const { run, calls } = fakeGh({ "acme/docs#791": D10_NEW, "acme/other#787": D11_NEW });
        const r: Captured = await check(["--draft", "record-body.labelled.md", "--root", dir], dir, run);
        expect(r.code).toBe(0);
        expect(amendments(r).amendments.map((a) => [a.issue, a.repo, a.status])).toEqual([
            [791, "acme/docs", "amended"],
            [787, "acme/other", "amended"],
        ]);
        expect(calls.map((c) => c[2])).toEqual(["repos/acme/docs/issues/791", "repos/acme/other/issues/787"]);
    });

    it("only ever reads: every gh call is a GET of an issue, and no file is written", async () => {
        const dir: string = draftDir(entry("D10", D10_LINE), entry("D11", D11_LINE));
        const before: string = fs.readFileSync(path.join(dir, "record-body.labelled.md"), "utf8");
        const { run, calls } = fakeGh({ [`${HERE}#791`]: D10_OLD, [`${HERE}#787`]: D11_OLD });
        await check(["--draft", "record-body.labelled.md"], dir, run);
        expect(calls.length).toBe(2);
        for (const call of calls) {
            expect(call.slice(0, 2)).toEqual(["gh", "api"]);
            expect(call).toHaveLength(3);
            expect(call[2]).toMatch(/^repos\/.+\/issues\/\d+$/);
        }
        expect(fs.readdirSync(dir)).toEqual(["record-body.labelled.md"]);
        expect(fs.readFileSync(path.join(dir, "record-body.labelled.md"), "utf8")).toBe(before);
    });
});

describe("nexus record-amendments fails closed", () => {
    it("names an issue it cannot fetch and exits non-zero, printing no result", async () => {
        const dir: string = draftDir(entry("D10", D10_LINE));
        const { run } = fakeGh({}, { [`${HERE}#791`]: "gh: Not Found (HTTP 404)" });
        const r: Captured = await check(["--draft", "record-body.labelled.md"], dir, run);
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/record-amendments issue-not-found: .*#791/);
        expect(r.out).toBe("");
    });

    it("names any other gh failure", async () => {
        const dir: string = draftDir(entry("D10", D10_LINE));
        const { run } = fakeGh({}, { [`${HERE}#791`]: "API rate limit exceeded" });
        const r: Captured = await check(["--draft", "record-body.labelled.md"], dir, run);
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/record-amendments gh-failed: .*rate limit/);
    });

    it("names an issue whose reply is not JSON", async () => {
        const dir: string = draftDir(entry("D10", D10_LINE));
        const run: Runner = () => ({ status: 0, stdout: "<html>", stderr: "" });
        const r: Captured = await check(["--draft", "record-body.labelled.md"], dir, run);
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/record-amendments malformed-json: issue #791/);
    });

    it("reads each issue once, however many commitments name it", async () => {
        const second: string = D10_LINE.replace("criterion 4", "criterion 2");
        const dir: string = draftDir(entry("D10", D10_LINE), entry("D12", second));
        const { run, calls } = fakeGh({ [`${HERE}#791`]: D10_NEW });
        const r: Captured = await check(["--draft", "record-body.labelled.md"], dir, run);
        expect(amendments(r).amendments).toHaveLength(2);
        expect(calls).toHaveLength(1);
    });

    it("names a commitment line it cannot read", async () => {
        const dir: string = draftDir(entry("D3", "- **Epic commitment affected:** the epic changes a bit."));
        const { run, calls } = fakeGh({});
        const r: Captured = await check(["--draft", "record-body.labelled.md"], dir, run);
        expect(r.code).toBe(1);
        expect(r.err).toMatch(/record-amendments commitment-unreadable: D3/);
        expect(calls).toEqual([]);
    });

    it("exits 1 on a draft it cannot read, naming the path", async () => {
        const dir: string = draftDir();
        const r: Captured = await check(["--draft", "missing.md"], dir, fakeGh({}).run);
        expect(r.code).toBe(1);
        expect(r.err).toContain("missing.md");
    });

    it("exits 2 with usage when no draft is named, or on an unknown argument", async () => {
        const dir: string = draftDir();
        expect((await check([], dir, fakeGh({}).run)).code).toBe(2);
        const r: Captured = await check(["--draft", "record-body.labelled.md", "--frob"], dir, fakeGh({}).run);
        expect(r.code).toBe(2);
        expect(r.err).toMatch(/usage: nexus record-amendments --draft <path>/);
    });
});
