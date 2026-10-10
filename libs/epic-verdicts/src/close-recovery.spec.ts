/**
 * `nexus close --recover <epic>`: re-stamp a closed epic whose decision record was revised (epic
 * #830, story #867, decision record #872: D13; G30–G33, with G3, G4 and G18 as close keeps them).
 *
 * Each spec starts from what an earlier `nexus close` left: a close record committed in the epic's
 * queue entry on its distill branch, and a trusted close comment on the epic issue, both rendered
 * by close's own renderers against the record body as it was then. The record is then revised.
 * Every platform read is a stand-in, so the specs read what a lead sees — the stop blocks, the
 * report, the entry on disk, the comment posted — and every write the run made, in order.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { type Departure, type Judgments } from "@nexus/pr-acceptance/judgments-block";
import { type PrWaivers } from "@nexus/pr-acceptance/waiver";
import { recordDigest } from "@nexus/record-digest/digest";
import { type CloseVerdictRead, renderCloseOutcome } from "./close-command.js";
import { assembleCloseContent, CLOSE_RECORD_MARKER, renderCloseComment, renderCloseRecord, type CloseVerdict } from "./close-record.js";
import { type CloseRanges } from "./close-ranges.js";
import { type CloseRecoveryDeps, type RecoveryOutcome, closeRecoveryDeps, runCloseRecovery } from "./close-recovery.js";
import { type Runner } from "./run.js";
import { defaultRunner } from "@nexus/workspace/run";

const tmp: string[] = [];
afterEach(() => {
    for (const d of tmp.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function makeDir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-close-recover-"));
    tmp.push(d);
    return d;
}

const ISSUES = "acme/app";
const EPIC = 830;
const RECORD = 872;
const PR_A = 901;
const PR_B = 902;
const BRANCH = "distill/2026-10-01-epic-830";

function recordBody(d1: string): string {
    return [
        "# Decision Record: Close becomes a deterministic subcommand",
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
        `- **Decision:** ${d1}`,
        "- **Why:** The stage is called close everywhere.",
        "- **Refuted viable alternative:** `nexus close-epic`.",
        "",
    ].join("\n");
}

const OLD_BODY = recordBody("The command is `nexus close`.");
const OLD_DIGEST = recordDigest(OLD_BODY);
const NEW_BODY = recordBody("The command is `nexus close`, and recovery is a mode of it.");
const NEW_DIGEST = recordDigest(NEW_BODY);

function departure(id: string, reason: string, over: Partial<Departure> = {}): Departure {
    return {
        id,
        kind: "departure",
        found: true,
        severity: "medium",
        departsFrom: "D1",
        summary: `the code does ${id} differently`,
        files: [],
        stub: null,
        supersedes: null,
        answer: { verb: "accepted", author: "lead", link: `https://example.test/${id}`, reason },
        ...over,
    };
}

function judgments(digest: string, items: Departure[], stubChoice = "Keep the stub"): Judgments {
    return {
        items,
        findings: [],
        deferred: [],
        keyDecisions: { record: { digest, format: "new", decisions: [{ id: "D1" }] }, stubs: [{ path: "dev/decisions-feat.md", choice: stubChoice, reason: "it is simpler", refuted: "none" }] },
    };
}

function present(j: Judgments, recordHash: string, head: string): CloseVerdictRead {
    return { ok: true, found: true, critical: 0, high: 0, judgments: "present", read: j, date: "2026-10-02", head, recordHash };
}

function gate(): Pick<CloseRanges, "range" | "stories" | "landed" | "waivers"> {
    return {
        range: [
            { repo: ISSUES, pr: PR_A, base: "a".repeat(40), head: "1".repeat(40) },
            { repo: ISSUES, pr: PR_B, base: "1".repeat(40), head: "2".repeat(40) },
        ],
        stories: [
            { story: 864, ranges: [{ repo: ISSUES, pr: PR_A, source: "derived", base: "a".repeat(40), head: "1".repeat(40), checkout: "/repo" }] },
            { story: 865, ranges: [{ repo: ISSUES, pr: PR_B, source: "derived", base: "1".repeat(40), head: "2".repeat(40), checkout: "/repo" }] },
        ],
        landed: [{ story: 864, result: "unchanged", prs: [{ repo: ISSUES, pr: PR_A, result: "unchanged", analyzedHead: "1".repeat(40), files: [] }] }],
        waivers: [],
    };
}

/** What the earlier close wrote: the record and the comment, against the old body. */
function closedEarlier(departures = true): { record: string; comment: string } {
    const content = assembleCloseContent({
        epic: EPIC,
        title: "Close becomes a deterministic subcommand",
        feature: "PR-Driven Delivery",
        featurePath: "pr-driven-delivery",
        date: "2026-10-01",
        nexusVersion: "0.92.0",
        issuesRepo: ISSUES,
        codeRepo: ISSUES,
        record: { number: RECORD, body: OLD_BODY, digest: OLD_DIGEST },
        verdicts: [
            { repo: ISSUES, pr: PR_A, date: "2026-09-30", head: "1".repeat(40), recordHash: OLD_DIGEST, judgments: judgments(OLD_DIGEST, departures ? [departure("DV1", "kept reason A")] : []) },
            { repo: ISSUES, pr: PR_B, date: "2026-10-01", head: "2".repeat(40), recordHash: OLD_DIGEST, judgments: judgments(OLD_DIGEST, departures ? [departure("DV1", "kept reason B")] : []) },
        ] satisfies CloseVerdict[],
        ranges: gate(),
        waivedStories: [{ story: 866, date: "2026-09-29" }],
    });
    const stubs = new Map<string, number>();
    content.approved.push({ repo: ISSUES, pr: PR_A, id: "DS1", summary: "Later scope", approver: "lead", link: "https://example.test/ds1" });
    stubs.set(`${ISSUES}#${PR_A} DS1`, 1001);
    return { record: renderCloseRecord(content, stubs), comment: renderCloseComment(content, stubs) };
}

function waiverOn(pr: number, digest: string, trusted = true): PrWaivers {
    return {
        pr,
        answers: [],
        comments: [
            {
                author: "lead",
                url: `https://example.test/pull/${pr}#waiver`,
                at: "2026-10-03T09:00:00Z",
                trusted,
                waiver: { ok: true, terms: { cause: "record-revised", record: `#${RECORD}`, digest }, reason: "wording only" },
            },
        ],
    };
}

interface Harness {
    deps: CloseRecoveryDeps;
    repoRoot: string;
    wtPath: string;
    entryDir: string;
    earlier: { record: string; comment: string };
    /** Every write, in the order recovery made it. */
    writes: string[];
    posted: { issue: number; body: string }[];
    worktreeCalls: number;
}

/** A closed epic, its record revised and approved again, and a trusted waiver for the new revision on each pull request. */
function harness(over: Partial<CloseRecoveryDeps> = {}, earlierClose: { record: string; comment: string } = closedEarlier()): Harness {
    const repoRoot = makeDir();
    const wtPath = makeDir();
    const entryDir = path.join(wtPath, ".nexus", "queue", `epic-${EPIC}`);
    const earlier = earlierClose;
    fs.mkdirSync(entryDir, { recursive: true });
    fs.writeFileSync(path.join(entryDir, "epic.md"), `---\nlink: "#${EPIC}"\n---\n`);
    fs.writeFileSync(path.join(entryDir, "close-record.md"), earlier.record);
    const h: Harness = { deps: {} as CloseRecoveryDeps, repoRoot, wtPath, entryDir, earlier, writes: [], posted: [], worktreeCalls: 0 };
    const comments = [
        { body: "Looks good", authorAssociation: "NONE" },
        { body: earlier.comment, authorAssociation: "OWNER" },
    ];
    h.deps = {
        role: () => ({ ok: true, preflight: { role: "single-repo", repoRoot, repo: { identity: ISSUES, source: "origin" } as never } }),
        issuesRepo: () => ({ ok: true, repos: { issuesRepo: ISSUES, repo: ISSUES } }),
        issueComments: () => ({ ok: true, comments: [...comments, ...h.posted.filter((p) => p.issue === EPIC).map((p) => ({ body: p.body, authorAssociation: "OWNER" }))] }),
        record: () => ({ ok: true, body: NEW_BODY, digest: NEW_DIGEST, approved: true, state: "closed", stateReason: "completed" }),
        verdict: (_root, _repo, pr) =>
            present(judgments(OLD_DIGEST, [departure("DV1", pr.pr === PR_A ? "kept reason A" : "kept reason B")]), OLD_DIGEST, pr.pr === PR_A ? "1".repeat(40) : "2".repeat(40)),
        prWaivers: (_root, pr) => ({ ok: true, waivers: waiverOn(pr.pr, NEW_DIGEST) }),
        findEntry: () => ({ ok: true, at: "branch", branch: BRANCH }),
        openWorktree: () => {
            h.worktreeCalls += 1;
            return { ok: true, wtPath, branch: BRANCH, source: "local" };
        },
        commitEntry: (_wt, files, message) => {
            h.writes.push(`commit ${files.map((f) => path.basename(f)).join(",")}: ${message}`);
            return { ok: true, committed: true };
        },
        push: (_wt, branch) => {
            h.writes.push(`push ${branch}`);
            return { ok: true };
        },
        postComment: (_root, _repo, issue, body) => {
            h.writes.push(`comment #${issue}`);
            h.posted.push({ issue, body });
            return { ok: true };
        },
        ...over,
    };
    return h;
}

function recover(h: Harness): RecoveryOutcome {
    return runCloseRecovery(h.deps, { cwd: h.repoRoot, epic: EPIC, date: "2026-10-04" });
}

function entryText(h: Harness): string {
    return fs.readFileSync(path.join(h.entryDir, "close-record.md"), "utf8");
}

/** The lines of `text` under `heading`, up to the next heading or the machine-block marker. */
function section(text: string, heading: string): string {
    const lines = text.split("\n");
    const start = lines.indexOf(heading);
    if (start < 0) return "";
    const level = /^#+/.exec(heading)?.[0].length ?? 0;
    let end = start + 1;
    while (end < lines.length && !new RegExp(`^#{1,${level}} `).test(lines[end]) && lines[end] !== CLOSE_RECORD_MARKER) end++;
    return lines.slice(start + 1, end).join("\n").trim();
}

/** `text` with the four things recovery may change blanked out: what must stay byte-for-byte (G32). */
function unchangedPart(text: string, sectionLevel: string): string {
    return text
        .split("\n")
        .map((l) => (/^(record_hash|analyze): /.test(l) || /^(Decision record|Conformance): /.test(l) ? "<stamp>" : l))
        .join("\n")
        .replace(new RegExp(`${sectionLevel} Key Decisions\\n[\\s\\S]*?(?=\\n${sectionLevel} |\\n${CLOSE_RECORD_MARKER})`), "<kd>")
        .replace(new RegExp(`${sectionLevel} Deviation Rationale\\n[\\s\\S]*?(?=\\n${sectionLevel} |\\n${CLOSE_RECORD_MARKER})`), "<dr>")
        .replace(/\n<stamp>\n\n<stamp>\n/, "\n<stamp>\n");
}

function text(lines: string[]): string {
    return lines.join("\n");
}

describe("nexus close --recover — every merged pull request carries a trusted waiver for the new revision (AC1, G31–G33)", () => {
    it("re-stamps record_hash and analyze in the entry, commits and pushes it, then posts a fresh close comment", () => {
        const h = harness();
        const out = recover(h);
        const rendered = renderCloseOutcome(out);
        expect(rendered.stderr).toEqual([]);
        expect(rendered.exitCode).toBe(0);

        const entry = entryText(h);
        expect(entry).toContain(`record_hash: ${NEW_DIGEST}`);
        expect(entry).not.toContain(OLD_DIGEST.slice(0, 20) + "\n");
        expect(entry).toMatch(new RegExp(`analyze: "ran 2026-10-02 @ ${"2".repeat(40)}; stale — record #${RECORD} revised since analysis \\(${OLD_DIGEST} → ${NEW_DIGEST}\\); waived 2026-10-03 by @lead"`));

        expect(h.writes).toEqual([`commit close-record.md: close: epic-${EPIC} — re-stamp record #${RECORD} at ${NEW_DIGEST.slice(0, 12)}`, `push ${BRANCH}`, `comment #${EPIC}`]);
        const comment = h.posted[0].body;
        expect(comment).toContain(`Decision record: #${RECORD} @ \`${NEW_DIGEST}\``);
        expect(comment).toContain(`record_hash: ${NEW_DIGEST}`);
        expect(comment).toContain(`Conformance: ran 2026-10-02 @ ${"2".repeat(40)}; stale`);
        expect(text(rendered.stdout)).toContain(NEW_DIGEST);
    });

    it("re-stamps a close comment saved with CRLF endings in one kind of line ending", () => {
        const h = harness();
        const crlf = h.earlier.comment.replace(/\n/g, "\r\n");
        h.deps.issueComments = () => ({ ok: true, comments: [{ body: crlf, authorAssociation: "OWNER" }, ...h.posted.filter((p) => p.issue === EPIC).map((p) => ({ body: p.body, authorAssociation: "OWNER" }))] });
        expect(renderCloseOutcome(recover(h)).exitCode).toBe(0);
        expect(h.posted[0].body).toContain(`record_hash: ${NEW_DIGEST}`);
        expect(h.posted[0].body).not.toContain("\r");
    });

    it("takes the record's decisions from the new body and keeps the deviation rationale, on the entry and the comment alike (G9)", () => {
        const h = harness();
        recover(h);
        const entry = entryText(h);
        const comment = h.posted[0].body;
        for (const [doc, level] of [[entry, "##"], [comment, "###"]] as const) {
            const kd = section(doc, `${level} Key Decisions`);
            expect(kd).toContain("recovery is a mode of it");
            expect(kd).toContain("Keep the stub");
            const dr = section(doc, `${level} Deviation Rationale`);
            expect(dr).toBe(section(level === "##" ? h.earlier.record : h.earlier.comment, `${level} Deviation Rationale`));
            expect(dr).toContain("kept reason A");
        }
    });

    it("changes nothing else: range, story ranges, landed checks, deferred scope and waived stories stay as they were (G32)", () => {
        const h = harness();
        recover(h);
        expect(unchangedPart(entryText(h), "##")).toBe(unchangedPart(h.earlier.record, "##"));
        expect(unchangedPart(h.posted[0].body, "###")).toBe(unchangedPart(h.earlier.comment, "###"));
        expect(entryText(h)).toContain("- #1001 — Later scope");
        expect(entryText(h)).toContain("- #866 — waived 2026-09-29");
    });

    it("files nothing and amends nothing: the record issue receives no comment (G32)", () => {
        const h = harness();
        recover(h);
        expect(h.posted.map((p) => p.issue)).toEqual([EPIC]);
    });

    it("finishes a partial run without a second comment, and does nothing once both copies carry the new hash", () => {
        const h = harness();
        const post = h.deps.postComment;
        h.deps.postComment = () => ({ ok: false, message: "HTTP 502" });
        const first = renderCloseOutcome(recover(h));
        expect(first.exitCode).toBe(1);
        expect(text(first.stderr)).toContain("nexus close --recover 830");
        expect(text(first.stderr)).toMatch(/committed and pushed/);
        expect(h.writes).toHaveLength(2);

        h.deps.postComment = post;
        expect(renderCloseOutcome(recover(h)).exitCode).toBe(0);
        expect(h.writes.slice(2)).toEqual([`push ${BRANCH}`, `comment #${EPIC}`]);

        const again = renderCloseOutcome(recover(h));
        expect(again.exitCode).toBe(0);
        expect(h.writes).toHaveLength(4);
        expect(text(again.stdout)).toMatch(/already/);
    });

    it("ignores a waiver from someone who cannot speak for the repository", () => {
        const h = harness({ prWaivers: (_root, pr) => ({ ok: true, waivers: waiverOn(pr.pr, NEW_DIGEST, pr.pr !== PR_B) }) });
        const rendered = renderCloseOutcome(recover(h));
        expect(rendered.exitCode).toBe(1);
        expect(text(rendered.stderr)).toContain(`pull request ${ISSUES}#${PR_B}`);
        expect(text(rendered.stderr)).not.toContain(`pull request ${ISSUES}#${PR_A}`);
    });
});

describe("nexus close --recover — a merged pull request with neither a fresh verdict nor a waiver (AC2, G31, G3, G4)", () => {
    it("stops before any write and names both remedies for that pull request, with the exact waiver to post", () => {
        const h = harness({ prWaivers: (_root, pr) => ({ ok: true, waivers: pr.pr === PR_A ? waiverOn(PR_A, NEW_DIGEST) : { pr, comments: [], answers: [] } }) });
        const out = recover(h);
        const rendered = renderCloseOutcome(out);
        expect(rendered.exitCode).toBe(1);
        const err = text(rendered.stderr);
        expect(err).toContain(`/nxs.analyze --pr ${PR_B}`);
        expect(err).toContain("<!-- nexus:close-waiver -->");
        expect(err).toContain("waive: record-revised");
        expect(err).toContain(`digest: ${NEW_DIGEST}`);
        expect(err).toContain(`pull request ${ISSUES}#${PR_B}`);
        expect(err).not.toContain(`pull request ${ISSUES}#${PR_A}`);
        expect(err).toContain("Nothing was created or written");
        expect(h.writes).toEqual([]);
        expect(h.worktreeCalls).toBe(0);
        expect(entryText(h)).toBe(h.earlier.record);
    });

    it("names a waiver for an older revision as clearing nothing", () => {
        const h = harness({ prWaivers: (_root, pr) => ({ ok: true, waivers: waiverOn(pr.pr, pr.pr === PR_B ? OLD_DIGEST : NEW_DIGEST) }) });
        const err = text(renderCloseOutcome(recover(h)).stderr);
        expect(err).toMatch(/cleared nothing.*not the current revision/);
    });

    it("once every pull request has a verdict judged against the new revision, rebuilds Key Decisions and Deviation Rationale from those verdicts", () => {
        const h = harness({
            verdict: (_root, _repo, pr) =>
                present(
                    judgments(NEW_DIGEST, [departure("DV2", pr.pr === PR_A ? "fresh reason A" : "fresh reason B")], "A fresh stub"),
                    NEW_DIGEST,
                    pr.pr === PR_A ? "3".repeat(40) : "4".repeat(40),
                ),
            prWaivers: (_root, pr) => ({ ok: true, waivers: { pr: pr.pr, comments: [], answers: [] } }),
        });
        const rendered = renderCloseOutcome(recover(h));
        expect(rendered.stderr).toEqual([]);
        const entry = entryText(h);
        const dr = section(entry, "## Deviation Rationale");
        expect(dr).toContain("fresh reason A");
        expect(dr).toContain("fresh reason B");
        expect(dr).not.toContain("kept reason");
        expect(section(entry, "## Key Decisions")).toContain("A fresh stub");
        expect(section(entry, "## Key Decisions")).not.toContain("Keep the stub");
        expect(entry).toContain(`analyze: ran 2026-10-02 @ ${"4".repeat(40)}`);
        const comment = h.posted[0].body;
        expect(section(comment, "### Deviation Rationale")).toBe(dr);
        expect(comment).not.toContain("Conformance:");
    });

    it("rebuilds the re-judged pull request's departures and keeps the waived one's", () => {
        const h = harness({
            verdict: (_root, _repo, pr) =>
                pr.pr === PR_B
                    ? present(judgments(NEW_DIGEST, [departure("DV2", "fresh reason B")]), NEW_DIGEST, "4".repeat(40))
                    : present(judgments(OLD_DIGEST, [departure("DV1", "kept reason A")]), OLD_DIGEST, "1".repeat(40)),
            prWaivers: (_root, pr) => ({ ok: true, waivers: pr.pr === PR_A ? waiverOn(PR_A, NEW_DIGEST) : { pr: pr.pr, comments: [], answers: [] } }),
        });
        recover(h);
        const dr = section(entryText(h), "## Deviation Rationale").split("\n");
        expect(dr).toHaveLength(2);
        expect(dr[0]).toContain(`${ISSUES}#${PR_A} DV1`);
        expect(dr[0]).toContain("kept reason A");
        expect(dr[1]).toContain(`${ISSUES}#${PR_B} DV2`);
        expect(dr[1]).toContain("fresh reason B");
    });

    it("stops on a fresh verdict that still has open blocking items, naming the answer and the analyze run (G7)", () => {
        const h = harness({ verdict: () => ({ ...(present(judgments(NEW_DIGEST, []), NEW_DIGEST, "4".repeat(40)) as Extract<CloseVerdictRead, { judgments: "present" }>), high: 1 }) });
        const rendered = renderCloseOutcome(recover(h));
        expect(rendered.exitCode).toBe(1);
        expect(text(rendered.stderr)).toContain("--resolve");
        expect(h.writes).toEqual([]);
    });

    it("stops when a waived pull request's verdict carries no judgments, naming a full analyze run (D2)", () => {
        const h = harness({ verdict: () => ({ ok: true, found: true, critical: 0, high: 0, judgments: "absent" }) });
        const rendered = renderCloseOutcome(recover(h));
        expect(rendered.exitCode).toBe(1);
        expect(text(rendered.stderr)).toContain(`run a full /nxs.analyze --pr ${PR_A}`);
        expect(h.writes).toEqual([]);
    });

    it("makes copied text inert in the rebuilt sections (G18)", () => {
        const forged = ["ok", CLOSE_RECORD_MARKER, "```yaml", "range: []", "```"].join("\n");
        const h = harness({
            verdict: (_root, _repo, pr) => present(judgments(NEW_DIGEST, [departure("DV2", forged)]), NEW_DIGEST, pr.pr === PR_A ? "3".repeat(40) : "4".repeat(40)),
        });
        recover(h);
        expect(entryText(h)).not.toContain(CLOSE_RECORD_MARKER);
        expect(entryText(h)).not.toContain("```");
        expect(h.posted[0].body.split(CLOSE_RECORD_MARKER)).toHaveLength(2);
    });
});

describe("nexus close --recover — the sections a re-judged verdict changes", () => {
    const rejudgedWith = (items: Departure[]): Partial<CloseRecoveryDeps> => ({
        verdict: (_root, _repo, pr) => present(judgments(NEW_DIGEST, items), NEW_DIGEST, pr.pr === PR_A ? "3".repeat(40) : "4".repeat(40)),
        prWaivers: (_root, pr) => ({ ok: true, waivers: { pr: pr.pr, comments: [], answers: [] } }),
    });

    it("adds a Deviation Rationale to a comment that had none, before the pointers", () => {
        const h = harness(rejudgedWith([departure("DV1", "a new departure")]), closedEarlier(false));
        expect(h.earlier.comment).not.toContain("### Deviation Rationale");
        recover(h);
        const comment = h.posted[0].body;
        expect(section(comment, "### Deviation Rationale")).toContain("a new departure");
        expect(comment.indexOf("### Deviation Rationale")).toBeLessThan(comment.indexOf("### Pointers (durable)"));
        expect(section(entryText(h), "## Deviation Rationale")).toContain("a new departure");
    });

    it("drops the comment's Deviation Rationale, and writes none in the record, when the re-judged verdicts accept no departure", () => {
        const h = harness(rejudgedWith([]));
        recover(h);
        expect(h.posted[0].body).not.toContain("### Deviation Rationale");
        expect(section(entryText(h), "## Deviation Rationale")).toBe("none");
    });

    it("removes the waiver clause from analyze and the comment when a second revision is re-judged", () => {
        const first = harness();
        recover(first);
        const THIRD = recordBody("The command is `nexus close`; recovery is its mode.");
        const third = recordDigest(THIRD);
        const h = harness(
            {
                record: () => ({ ok: true, body: THIRD, digest: third, approved: true, state: "closed", stateReason: "completed" }),
                verdict: (_root, _repo, pr) => present(judgments(third, []), third, pr.pr === PR_A ? "3".repeat(40) : "4".repeat(40)),
            },
            { record: entryText(first), comment: first.posted[0].body },
        );
        expect(h.earlier.comment).toContain("Conformance:");
        recover(h);
        expect(h.posted[0].body).not.toContain("Conformance:");
        expect(h.posted[0].body).toContain(`analyze: ran 2026-10-02 @ ${"4".repeat(40)}`);
        expect(entryText(h)).toContain(`record_hash: ${third}`);
    });
});

describe("nexus close --recover — stops on what it cannot read or write (G3, G4)", () => {
    it("stops before any write when a pull request's waivers cannot be read", () => {
        const h = harness({ prWaivers: () => ({ ok: false, message: "HTTP 502" }) });
        const err = text(renderCloseOutcome(recover(h)).stderr);
        expect(err).toContain("HTTP 502");
        expect(err).toContain("is not the same as no waiver");
        expect(h.writes).toEqual([]);
    });

    it("stops on a waived pull request that carries no verdict at all, naming a full analyze run", () => {
        const h = harness({ verdict: () => ({ ok: true, found: false }) });
        const err = text(renderCloseOutcome(recover(h)).stderr);
        expect(err).toContain(`run a full /nxs.analyze --pr ${PR_A}`);
        expect(h.writes).toEqual([]);
    });

    it("stops on a close comment that names no decision record: there is no hash to re-stamp", () => {
        const comment = closedEarlier().comment.replace(/^record: .*\n/m, "");
        const h = harness({ issueComments: () => ({ ok: true, comments: [{ body: comment, authorAssociation: "MEMBER" }] }) });
        expect(text(renderCloseOutcome(recover(h)).stderr)).toMatch(/names no decision record/);
        expect(h.writes).toEqual([]);
    });

    it("stops when the close comment's range does not name its pull requests", () => {
        const comment = closedEarlier().comment.replace(/^ {4}pr: 902\n/m, "");
        const h = harness({ issueComments: () => ({ ok: true, comments: [{ body: comment, authorAssociation: "OWNER" }] }) });
        expect(text(renderCloseOutcome(recover(h)).stderr)).toMatch(/1 entry with no pull request/);
        expect(h.writes).toEqual([]);
    });

    it("stops after the commit when the push fails, posting no comment, and a re-run pushes and posts", () => {
        const h = harness({ push: () => ({ ok: false, message: "rejected" }) });
        const err = text(renderCloseOutcome(recover(h)).stderr);
        expect(err).toContain("rejected");
        expect(err).toContain("No fresh close comment was posted");
        expect(h.posted).toEqual([]);
        h.deps.push = () => ({ ok: true });
        expect(renderCloseOutcome(recover(h)).exitCode).toBe(0);
        expect(h.posted).toHaveLength(1);
    });
});

describe("nexus close --recover — an old-contract entry", () => {
    it("re-stamps the committed entry whose epic.md links the epic, under its own directory name", () => {
        const h = harness();
        const old = path.join(h.wtPath, ".nexus", "queue", "2026-09-01-close-deterministic-subcommand");
        fs.renameSync(h.entryDir, old);
        recover(h);
        expect(fs.readFileSync(path.join(old, "close-record.md"), "utf8")).toContain(`record_hash: ${NEW_DIGEST}`);
    });
});

describe("nexus close --recover — a revised record that is still open (AC3, G30)", () => {
    it("stops before any write and names approving the record", () => {
        const h = harness({ record: () => ({ ok: true, body: NEW_BODY, digest: NEW_DIGEST, approved: false, state: "open", stateReason: null }) });
        const rendered = renderCloseOutcome(recover(h));
        expect(rendered.exitCode).toBe(1);
        const err = text(rendered.stderr);
        expect(err).toMatch(/reason: .*not approved/);
        expect(err).toContain(`${ISSUES}#${RECORD}`);
        expect(err).toMatch(/remedy: approve/);
        expect(h.writes).toEqual([]);
        expect(h.worktreeCalls).toBe(0);
    });

    it("treats a record closed as not planned as unapproved too", () => {
        const h = harness({ record: () => ({ ok: true, body: NEW_BODY, digest: NEW_DIGEST, approved: false, state: "closed", stateReason: "not_planned" }) });
        expect(renderCloseOutcome(recover(h)).exitCode).toBe(1);
        expect(h.writes).toEqual([]);
    });
});

describe("nexus close --recover — where the entry is", () => {
    it("passes over another epic's close comment, as close does", () => {
        const other = { body: `${CLOSE_RECORD_MARKER}\n\`\`\`yaml\nepic: "#99"\n\`\`\``, authorAssociation: "OWNER" };
        const h = harness({ issueComments: () => ({ ok: true, comments: [other] }) });
        const rendered = renderCloseOutcome(recover(h));
        expect(rendered.exitCode).toBe(1);
        expect(text(rendered.stderr)).toContain(`nexus close --epic ${EPIC}`);
        expect(h.writes).toEqual([]);
    });

    it("stops on an epic no close comment closed, naming nexus close --epic", () => {
        const h = harness({ issueComments: () => ({ ok: true, comments: [{ body: `quoting ${CLOSE_RECORD_MARKER}`, authorAssociation: "NONE" }] }) });
        const rendered = renderCloseOutcome(recover(h));
        expect(rendered.exitCode).toBe(1);
        expect(text(rendered.stderr)).toContain(`nexus close --epic ${EPIC}`);
        expect(h.writes).toEqual([]);
    });

    it("re-stamps a committed entry found on the trunk on a fresh distill branch", () => {
        const h = harness({
            findEntry: () => ({ ok: true, at: "trunk" }),
            openWorktree: (_root, epic, date) => ({ ok: true, wtPath: h.wtPath, branch: `distill/${date}-epic-${epic}`, source: "new" }),
        });
        const rendered = renderCloseOutcome(recover(h));
        expect(rendered.exitCode).toBe(0);
        expect(h.writes[1]).toBe("push distill/2026-10-04-epic-830");
        expect(entryText(h)).toContain(`record_hash: ${NEW_DIGEST}`);
    });

    it("posts only the fresh close comment when no entry is left, and names distill's recovery from the epic issue (G33)", () => {
        const h = harness({ findEntry: () => ({ ok: true, at: "none" }) });
        const rendered = renderCloseOutcome(recover(h));
        expect(rendered.exitCode).toBe(0);
        expect(h.worktreeCalls).toBe(0);
        expect(h.writes).toEqual([`comment #${EPIC}`]);
        expect(text(rendered.stdout)).toContain(`/nxs.distill --recover ${EPIC}`);
    });

    it("stops when the earlier branch holds no close record for the epic, after naming the worktree it opened", () => {
        const h = harness();
        fs.rmSync(h.entryDir, { recursive: true });
        const rendered = renderCloseOutcome(recover(h));
        expect(rendered.exitCode).toBe(1);
        expect(text(rendered.stderr)).toContain(BRANCH);
        expect(h.writes).toEqual([]);
    });

    it("stops a member checkout before reading anything (G44)", () => {
        const h = harness({ role: () => ({ ok: true, preflight: { role: "member", repoRoot: "/m", repo: { identity: ISSUES, source: "origin" } as never } }) });
        const rendered = renderCloseOutcome(recover(h));
        expect(rendered.exitCode).toBe(1);
        expect(text(rendered.stderr)).toMatch(/remedy: .*hub/);
    });
});

describe("nexus close --recover — the platform-backed reads", () => {
    function git(cwd: string, ...args: string[]): string {
        return execFileSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } }).trim();
    }

    function repoWithOrigin(): string {
        const origin = makeDir();
        const repo = makeDir();
        git(origin, "init", "-q", "--bare", "-b", "main");
        git(repo, "init", "-q", "-b", "main");
        git(repo, "remote", "add", "origin", origin);
        fs.writeFileSync(path.join(repo, "README.md"), "x\n");
        git(repo, "add", "-A");
        git(repo, "commit", "-qm", "init");
        git(repo, "push", "-q", "origin", "main");
        git(repo, "fetch", "-q", "origin");
        return repo;
    }

    it("finds the earlier distill branch, else a committed entry on the trunk, else none, creating nothing", () => {
        const repo = repoWithOrigin();
        const deps = closeRecoveryDeps(defaultRunner);
        expect(deps.findEntry(repo, EPIC)).toEqual({ ok: true, at: "none" });

        const dir = path.join(repo, ".nexus", "queue", "2026-09-01-old-entry");
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "epic.md"), `---\nlink: "#${EPIC}"\n---\n`);
        fs.writeFileSync(path.join(dir, "close-record.md"), "---\nrecord_hash: x\n---\n");
        git(repo, "add", "-A");
        git(repo, "commit", "-qm", "entry");
        git(repo, "push", "-q", "origin", "main");
        git(repo, "fetch", "-q", "origin");
        expect(deps.findEntry(repo, EPIC)).toEqual({ ok: true, at: "trunk" });
        expect(deps.findEntry(repo, 831)).toEqual({ ok: true, at: "none" });

        git(repo, "branch", BRANCH);
        expect(deps.findEntry(repo, EPIC)).toEqual({ ok: true, at: "branch", branch: BRANCH });
        expect(git(repo, "worktree", "list").split("\n")).toHaveLength(1);
    });

    it("reads an open record as unapproved, through the one digest implementation", () => {
        const run: Runner = (cmd, args) =>
            cmd === "gh" && args[1] === `repos/${ISSUES}/issues/${RECORD}`
                ? { status: 0, stdout: JSON.stringify({ body: NEW_BODY, state: "open", state_reason: null }), stderr: "" }
                : { status: 1, stdout: "", stderr: "unexpected" };
        expect(closeRecoveryDeps(run).record("/repo", ISSUES, RECORD)).toEqual({ ok: true, body: NEW_BODY, digest: NEW_DIGEST, approved: false, state: "open", stateReason: null });
        const failing: Runner = () => ({ status: 1, stdout: "", stderr: "HTTP 502" });
        expect(closeRecoveryDeps(failing).record("/repo", ISSUES, RECORD).ok).toBe(false);
    });

    it("reads a pull request's waivers through #849's reader, a failed read failing", () => {
        const body = ["<!-- nexus:close-waiver -->", "```yaml", "waive: record-revised", `record: "#${RECORD}"`, `digest: ${NEW_DIGEST}`, "```"].join("\n");
        const run: Runner = (cmd, args) =>
            cmd === "gh" && args[0] === "pr"
                ? { status: 0, stdout: JSON.stringify({ comments: [{ body, author: { login: "lead" }, authorAssociation: "OWNER", url: "u", createdAt: "2026-10-03T00:00:00Z" }] }), stderr: "" }
                : { status: 1, stdout: "", stderr: "unexpected" };
        const read = closeRecoveryDeps(run).prWaivers("/repo", { repo: ISSUES, pr: PR_A });
        expect(read.ok && read.waivers.comments[0]).toMatchObject({ author: "lead", trusted: true, waiver: { ok: true, terms: { cause: "record-revised", digest: NEW_DIGEST } } });
        expect(closeRecoveryDeps(() => ({ status: 1, stdout: "", stderr: "x" })).prWaivers("/repo", { repo: ISSUES, pr: PR_A }).ok).toBe(false);
    });
});
