/**
 * `nexus record-amendments` — the amendment check (epic #787, story #791, D8).
 *
 * A decision that changes what the epic or a story says states the change in its "Epic commitment
 * affected" field, with the exact old and new wording. The trial found two records that promised a
 * story change nobody made, and a link to the epic was taken as proof. So at the record checkpoint,
 * before the cut list, the stage runs this command: for each commitment it reads the live issue and
 * reports whether the exact new wording is there, and what the issue says today.
 *
 * The command writes nothing: no file, and no issue (D10). The stage writes each result into its
 * draft, and never makes the change itself. It exits 0 whether or not a change is pending, because
 * deciding what a pending change blocks is the stage's job. It fails closed on an issue it cannot
 * read, and on a commitment line it cannot parse, because an unchecked commitment must not read as
 * a checked one.
 *
 * Which repository a reference names follows the issue-reference rule: the record is filed as a
 * sub-issue of the epic, so a bare number resolves against the epic's repository (`epic-repo`, or
 * the current repository when that resolves to nothing), and a reference to another repository is
 * written qualified, `owner/repo#N`.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { resolvePublishingKey } from "@nexus/delivery-config/resolve";
import { commitmentsIn, matchCommitment, type Commitment, type UnreadableCommitment } from "@nexus/scope-razor/amendments";
import { defaultRunner, type Runner } from "@nexus/workspace/run";

export interface AmendmentsIo {
    cwd: string;
    stdout: (line: string) => void;
    stderr: (line: string) => void;
}

/** What a run may vary: the process seam and the clock. */
export interface AmendmentsDeps {
    run: Runner;
    today: () => Date;
}

/** One commitment's result, as printed. */
export interface AmendmentResult {
    decision: string;
    line: number;
    ref: string;
    issue: number;
    /** The repository read, or null for the current one. */
    repo: string | null;
    old: string | undefined;
    new: string | undefined;
    /** The status the draft carries now. */
    recorded: string;
    /** `amended` when the new wording is on the issue, `pending` when it is not, `unresolved` when not checked. */
    status: "amended" | "pending" | "unresolved";
    /** Whether the issue was read. An unresolved commitment is left as written. */
    checked: boolean;
    newPresent: boolean;
    oldPresent: boolean;
    /** What the issue says today, in one sentence the stage can quote. */
    saysToday: string;
}

const USAGE = "usage: nexus record-amendments --draft <path> [--root <dir>]";

/** The local calendar date, `YYYY-MM-DD`. */
function isoDate(d: Date): string {
    const pad = (n: number): string => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Fetched = { ok: true; body: string } | { ok: false; problem: "issue-not-found" | "gh-failed" | "malformed-json"; message: string };

/** Read one issue body. `gh api` with no method flag is a GET; nothing here can write. */
function fetchBody(run: Runner, cwd: string, issue: number, repo: string | null): Fetched {
    const label: string = repo === null ? `#${issue}` : `${repo}#${issue}`;
    const r = run("gh", ["api", `repos/${repo ?? "{owner}/{repo}"}/issues/${issue}`], { cwd });
    if (r.status !== 0) {
        const msg: string = r.stderr.trim() || "unknown gh error";
        return { ok: false, problem: /not found|404/i.test(msg) ? "issue-not-found" : "gh-failed", message: `reading issue ${label} failed: ${msg}` };
    }
    try {
        const doc: unknown = JSON.parse(r.stdout);
        if (doc === null || typeof doc !== "object" || Array.isArray(doc)) throw new Error("expected an object");
        const body: unknown = (doc as Record<string, unknown>)["body"];
        return { ok: true, body: typeof body === "string" ? body : "" };
    } catch (e) {
        return { ok: false, problem: "malformed-json", message: `issue ${label} returned unparseable JSON: ${e instanceof Error ? e.message : String(e)}` };
    }
}

function saysToday(label: string, c: Commitment, found: { newPresent: boolean; oldPresent: boolean }): string {
    if (found.newPresent) return `${label} carries the new wording.`;
    if (found.oldPresent) return `${label} still says: "${c.old}"`;
    return `${label} carries neither the old nor the new wording; the record may quote the old wording wrongly.`;
}

export async function runRecordAmendments(argv: string[], io: AmendmentsIo, deps: AmendmentsDeps = { run: defaultRunner, today: () => new Date() }): Promise<number> {
    let draftPath: string | undefined;
    let rootArg: string | undefined;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--draft") draftPath = argv[++i];
        else if (argv[i] === "--root") rootArg = argv[++i];
        else {
            io.stderr(`unknown argument for record-amendments: ${argv[i]}\n${USAGE}`);
            return 2;
        }
    }
    if (draftPath === undefined || draftPath === "" || rootArg === "") {
        io.stderr(USAGE);
        return 2;
    }
    const root: string = path.resolve(io.cwd, rootArg ?? ".");

    let draft: string;
    try {
        draft = fs.readFileSync(path.resolve(io.cwd, draftPath), "utf8");
    } catch {
        io.stderr(`record-amendments: cannot read ${draftPath}`);
        return 1;
    }

    const commitments: Array<Commitment | UnreadableCommitment> = commitmentsIn(draft);
    const unreadable: UnreadableCommitment[] = commitments.filter((c): c is UnreadableCommitment => c.problem !== undefined);
    if (unreadable.length > 0) {
        for (const u of unreadable) io.stderr(`record-amendments commitment-unreadable: ${u.decision} (${draftPath}:${u.line}): ${u.problem}`);
        return 1;
    }

    const epicRepo: string | null = commitments.length === 0 ? null : resolvePublishingKey(root, "epic-repo") || null;
    const bodies = new Map<string, string>();
    const results: AmendmentResult[] = [];
    for (const c of commitments as Commitment[]) {
        const repo: string | null = c.repo ?? epicRepo;
        const label: string = repo === null ? `#${c.issue}` : `${repo}#${c.issue}`;
        const base = { decision: c.decision, line: c.line, ref: c.ref, issue: c.issue, repo, old: c.old, new: c.new, recorded: c.recorded };
        if (/^unresolved\b/i.test(c.recorded) || c.old === undefined || c.new === undefined) {
            results.push({ ...base, status: "unresolved", checked: false, newPresent: false, oldPresent: false, saysToday: `${label} was not read: the record gives this change as unresolved.` });
            continue;
        }
        let body: string | undefined = bodies.get(label);
        if (body === undefined) {
            const fetched: Fetched = fetchBody(deps.run, root, c.issue, repo);
            if (!fetched.ok) {
                io.stderr(`record-amendments ${fetched.problem}: ${fetched.message} (commitment of ${c.decision})`);
                return 1;
            }
            body = fetched.body;
            bodies.set(label, body);
        }
        const found = matchCommitment(body, { old: c.old, new: c.new });
        results.push({ ...base, status: found.newPresent ? "amended" : "pending", checked: true, ...found, saysToday: saysToday(label, c, found) });
    }

    io.stdout(JSON.stringify({ command: "record-amendments", checked: isoDate(deps.today()), amendments: results }, null, 2));
    return 0;
}
