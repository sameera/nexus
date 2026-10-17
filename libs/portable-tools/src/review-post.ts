/**
 * `nexus review-post` — the posting step of `/nxs.code-review` (epic #918, story #920, decision
 * record #921, D3 and D4). The skill ranks the findings and writes the review; this command runs
 * the checks before posting and posts it, with no model judgment, so the same pull request state
 * and the same comments always give the same result (G22).
 *
 * The checks, all before anything is posted:
 *
 * - **A verdict.** Without request-changes, comment or approve, nothing is posted (G9).
 * - **Every finding is carried.** Each ranked finding is an inline comment or a body-only finding
 *   (G2).
 * - **Every inline comment lands where it says.** Its file is in the pull request, its line is
 *   inside the changed lines, and its expected text is on that line at the head. Every problem is
 *   listed, and any one of them posts nothing (G11). Body-only findings are not checked: they get
 *   no inline comment (D4).
 * - **No silent second review.** A review by the lead on the same head commit posts nothing unless
 *   the lead confirmed a second one (G12).
 *
 * "Changed lines" are the head-side lines of the pull request's diff hunks — added lines and the
 * context lines around them — which is where GitHub accepts an inline comment.
 */

import * as fs from "node:fs";
import { defaultRunner, type Runner } from "@nexus/workspace/run";

interface ReviewPostIo {
    cwd: string;
    stdout: (line: string) => void;
    stderr: (line: string) => void;
}

export const REVIEW_POST_USAGE: string = [
    "  nexus review-post --pr <N> --repo <owner/repo or host/owner/repo> --review <path>",
    "                    --verdict request-changes|comment|approve [--confirm-second]",
    "      Check a ranked review written by /nxs.code-review and post it as one pull request",
    "      review on the head commit. The review file holds { findings, body, comments, bodyOnly }:",
    "      the number of ranked findings, the ranking in markdown, one inline comment per finding",
    "      location inside the changed lines ({ finding, path, line, expectedText, body }), and the",
    "      findings carried only in the body ({ finding, path, line }). Posts nothing without a",
    "      verdict (exit 2). Exits 1, posting nothing, when a ranked finding is in neither list, when",
    "      any inline comment names a file not in the pull request, a line outside the changed lines",
    "      or expected text not on that line (every problem is listed), or when the lead already",
    "      reviewed the head commit and --confirm-second was not given (second-review-unconfirmed).",
    "      Prints { command, posted, pr, repo, url, verdict, inlineComments, bodyOnly }.",
].join("\n");

const VERDICT_EVENTS: Record<string, string> = {
    "request-changes": "REQUEST_CHANGES",
    comment: "COMMENT",
    approve: "APPROVE",
};

interface InlineComment {
    finding: number;
    path: string;
    line: number;
    expectedText: string;
    body: string;
}

interface BodyOnlyFinding {
    finding: number;
    path: string;
    line: number;
}

interface RankedReview {
    findings: number;
    body: string;
    comments: InlineComment[];
    bodyOnly: BodyOnlyFinding[];
}

interface Flags {
    pr?: number;
    repo?: string;
    review?: string;
    verdict?: string;
    confirmSecond: boolean;
}

function parseFlags(argv: string[]): Flags | string {
    const flags: Flags = { confirmSecond: false };
    for (let i = 0; i < argv.length; i++) {
        const arg: string = argv[i];
        if (arg === "--pr") flags.pr = Number(argv[++i]);
        else if (arg === "--repo") flags.repo = argv[++i];
        else if (arg === "--review") flags.review = argv[++i];
        else if (arg === "--verdict") flags.verdict = argv[++i];
        else if (arg === "--confirm-second") flags.confirmSecond = true;
        else return `unknown argument for review-post: ${arg}`;
    }
    return flags;
}

const isPositiveInteger = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;
const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** Read the review file, or say what is wrong with it. */
function readReview(file: string): RankedReview | string {
    let raw: unknown;
    try {
        raw = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (e) {
        return `cannot read ${file} as JSON: ${(e as Error).message}`;
    }
    const r = raw as Partial<RankedReview> | null;
    if (r === null || typeof r !== "object") return "the review is not a JSON object";
    if (!isPositiveInteger(r.findings)) return "findings must be the number of ranked findings";
    if (!isText(r.body)) return "body must carry the ranking";
    if (!Array.isArray(r.comments) || !Array.isArray(r.bodyOnly)) return "comments and bodyOnly must both be lists";
    for (const c of r.comments as unknown[]) {
        const x = c as Partial<InlineComment>;
        if (!isPositiveInteger(x.finding) || !isText(x.path) || !isPositiveInteger(x.line) || !isText(x.expectedText) || !isText(x.body)) {
            return "each inline comment needs finding, path, line, expectedText and body";
        }
    }
    for (const b of r.bodyOnly as unknown[]) {
        const x = b as Partial<BodyOnlyFinding>;
        if (!isPositiveInteger(x.finding) || !isText(x.path) || !isPositiveInteger(x.line)) {
            return "each body-only finding needs finding, path and line";
        }
    }
    return r as RankedReview;
}

/** `gh api` arguments aimed at the repository's host. */
function api(host: string | null, ...args: string[]): string[] {
    return host === null ? ["api", ...args] : ["api", "--hostname", host, ...args];
}

/** The head-side line numbers of a unified-diff patch's hunks: added lines and context lines. */
export function changedLines(patch: string | null | undefined): Set<number> {
    const lines = new Set<number>();
    if (patch === null || patch === undefined) return lines;
    let next: number = 0;
    for (const row of patch.split("\n")) {
        const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(row);
        if (hunk !== null) {
            next = Number(hunk[1]);
            continue;
        }
        if (next === 0 || row.startsWith("-") || row.startsWith("\\")) continue;
        lines.add(next);
        next++;
    }
    return lines;
}

/** Each line of `gh api --jq` output parsed as one JSON value. */
function jsonLines<T>(stdout: string): T[] {
    return stdout
        .split("\n")
        .filter((l) => l.trim().length > 0)
        .map((l) => JSON.parse(l) as T);
}

export function runReviewPost(argv: string[], io: ReviewPostIo, run: Runner = defaultRunner): number {
    const flags = parseFlags(argv);
    if (typeof flags === "string") {
        io.stderr(`${flags}\nusage:\n${REVIEW_POST_USAGE}`);
        return 2;
    }
    if (!isPositiveInteger(flags.pr) || !isText(flags.repo) || !isText(flags.review)) {
        io.stderr(`review-post needs --pr, --repo and --review.\nusage:\n${REVIEW_POST_USAGE}`);
        return 2;
    }
    const event: string | undefined = flags.verdict === undefined ? undefined : VERDICT_EVENTS[flags.verdict];
    if (event === undefined) {
        io.stderr(
            `review-post verdict-missing: nothing is posted without the lead's verdict — pass --verdict request-changes, comment or approve.`,
        );
        return 2;
    }

    const review = readReview(flags.review);
    if (typeof review === "string") {
        io.stderr(`review-post review-malformed: ${review}. Nothing was posted.`);
        return 1;
    }

    const carried = new Set<number>([...review.comments.map((c) => c.finding), ...review.bodyOnly.map((b) => b.finding)]);
    const uncarried: number[] = [];
    for (let n = 1; n <= review.findings; n++) {
        if (!carried.has(n)) uncarried.push(n);
    }
    if (uncarried.length > 0) {
        io.stderr(
            `review-post finding-uncarried: ${uncarried.map((n) => `finding ${n}`).join(", ")} is neither an inline comment nor a body-only finding. Nothing was posted.`,
        );
        return 1;
    }

    const parts: string[] = flags.repo.trim().split("/");
    const host: string | null = parts.length === 3 ? parts[0] : null;
    const slug: string = parts.slice(-2).join("/");
    const pull = `repos/${slug}/pulls/${flags.pr}`;
    const gh = (...args: string[]): { ok: true; stdout: string } | { ok: false; message: string } => {
        const r = run("gh", api(host, ...args), { cwd: io.cwd });
        return r.status === 0 ? { ok: true, stdout: r.stdout } : { ok: false, message: (r.stderr || r.stdout).trim() };
    };
    const readFailed = (what: string, message: string): number => {
        io.stderr(`review-post read-failed: could not read ${what}: ${message}. Nothing was posted.`);
        return 1;
    };

    const prRead = gh(pull, "--jq", "{head: .head.sha}");
    if (!prRead.ok) return readFailed(`pull request ${slug}#${flags.pr}`, prRead.message);
    const head: string = (JSON.parse(prRead.stdout) as { head: string }).head;

    const filesRead = gh("--paginate", `${pull}/files`, "--jq", ".[] | {filename, patch}");
    if (!filesRead.ok) return readFailed("the pull request's changed files", filesRead.message);
    const changed = new Map<string, Set<number>>();
    for (const f of jsonLines<{ filename: string; patch?: string | null }>(filesRead.stdout)) {
        changed.set(f.filename, changedLines(f.patch));
    }

    const problems: string[] = [];
    const contents = new Map<string, string[] | null>();
    for (const c of review.comments) {
        const where = `finding ${c.finding} at ${c.path}:${c.line}`;
        const lines: Set<number> | undefined = changed.get(c.path);
        if (lines === undefined) {
            problems.push(`${where}: the file is not in the pull request`);
            continue;
        }
        if (!lines.has(c.line)) {
            problems.push(`${where}: the line is outside the changed lines`);
            continue;
        }
        if (!contents.has(c.path)) {
            const encoded: string = c.path.split("/").map(encodeURIComponent).join("/");
            const file = gh(`repos/${slug}/contents/${encoded}?ref=${head}`, "-H", "Accept: application/vnd.github.raw");
            contents.set(c.path, file.ok ? file.stdout.split("\n") : null);
        }
        const text: string[] | null = contents.get(c.path) ?? null;
        if (text === null) {
            problems.push(`${where}: the file could not be read at the head commit`);
        } else if (!(text[c.line - 1] ?? "").includes(c.expectedText)) {
            problems.push(`${where}: the expected text "${c.expectedText}" is not on that line at the head commit`);
        }
    }

    const login = gh("user", "--jq", ".login");
    if (!login.ok) return readFailed("the signed-in GitHub user", login.message);
    const reviewsRead = gh("--paginate", `${pull}/reviews`, "--jq", ".[] | {login: .user.login, commit: .commit_id}");
    if (!reviewsRead.ok) return readFailed("the pull request's reviews", reviewsRead.message);
    const me: string = login.stdout.trim();
    const second: boolean = jsonLines<{ login: string; commit: string }>(reviewsRead.stdout).some((r) => r.login === me && r.commit === head);

    if (problems.length > 0) {
        io.stderr(`review-post comment-check-failed: ${problems.length} inline comment problem(s). Nothing was posted.`);
        for (const p of problems) io.stderr(`  - ${p}`);
        return 1;
    }
    if (second && !flags.confirmSecond) {
        io.stderr(
            `review-post second-review-unconfirmed: ${me} already reviewed head commit ${head} of ${slug}#${flags.pr}. ` +
                "Nothing was posted. Re-run with --confirm-second to post a second review.",
        );
        return 1;
    }

    const payload = {
        commit_id: head,
        event,
        body: review.body,
        comments: review.comments.map((c) => ({ path: c.path, line: c.line, side: "RIGHT", body: `**#${c.finding}** ${c.body}` })),
    };
    const payloadFile = `${flags.review}.payload.json`;
    fs.writeFileSync(payloadFile, JSON.stringify(payload));
    const posted = gh("-X", "POST", `${pull}/reviews`, "--input", payloadFile);
    fs.rmSync(payloadFile, { force: true });
    if (!posted.ok) {
        io.stderr(`review-post post-failed: GitHub did not accept the review: ${posted.message}`);
        return 1;
    }
    const url: string = (JSON.parse(posted.stdout) as { html_url: string }).html_url;
    io.stdout(
        JSON.stringify({
            command: "review-post",
            posted: true,
            pr: flags.pr,
            repo: flags.repo.trim(),
            url,
            verdict: flags.verdict,
            inlineComments: review.comments.length,
            bodyOnly: review.bodyOnly.length,
        }),
    );
    return 0;
}
