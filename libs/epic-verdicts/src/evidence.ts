/**
 * Close's per-story evidence report (epic #827, decision record #837, D4).
 *
 * Close used to read only the shipped ledger, never the pull requests that claim a story or the
 * receipts those pull requests carry. This is the one program that builds that evidence, so close
 * runs it and repeats what it prints rather than assembling the report from prose steps — the same
 * rule that put the verdict selection behind a command.
 *
 * Two reads stand behind the report: the claiming read of each live story ({@link
 * resolveStoryMergedPrs}), and the selected receipt of each claiming pull request. Either one
 * failing is a failure of the whole report, naming the story, and close stops before it mines
 * anything. Every remaining story is still read first, so one run names every unreadable story.
 *
 * A receipt counts for exactly the stories it names (D5). A receipt whose story list is empty or
 * missing — the shape of a receipt written before story lists existed — counts for none, and the
 * report says so. Reading it as "the whole epic" is the one way an old receipt could vouch for a
 * story added after it was written, which nobody checked.
 *
 * Each receipt that names a story is compared with the story's current fingerprint on its own
 * (D8): a story can ship as a feature and then a fix, each analysed against different text, and
 * collapsing them would hide which pull request's analysis is out of date. A receipt recording no
 * fingerprint for the story is unknown, never changed or unchanged. A fingerprint for a story the
 * receipt does not name is ignored.
 *
 * The report gates nothing else. The shipped-ledger gate keeps deciding whether the epic can close.
 */

import { type RepoSlug } from "@nexus/epic-resolve/gh";
import { type AnalyzeReceipt } from "@nexus/pr-acceptance/verify";
import { storyFingerprint, type StoryFingerprintRead } from "./fingerprint.js";
import { readPrVerdict } from "./pr-verdict.js";
import { type Runner } from "./run.js";
import { resolveStoryMergedPrs, type StoryMergedPr, type StoryMergedPrsRead, type StoryReadFailure } from "./story-prs.js";

/** The selected receipt of one pull request: the receipt, null when it carries none, or why it could not be read. */
export type ReceiptRead = { ok: true; receipt: AnalyzeReceipt | null } | { ok: false; cause: string };

/** The reads the report is built from, injected so a spec can stand in for the platform. */
export interface EvidenceDeps {
    readClaims(story: number): StoryMergedPrsRead;
    readReceipt(pr: StoryMergedPr): ReceiptRead;
    /** The fingerprint of the story's current body. */
    fingerprint(story: number): StoryFingerprintRead;
}

export interface EvidencePr {
    repo: string;
    pr: number;
    /** Whether the pull request carries a selected receipt at all. */
    receipt: boolean;
    /** Whether that receipt names this story — the only way it counts for it. */
    namesStory: boolean;
}

/** `has-receipt`: some claiming pull request's receipt names the story. `no-receipt`: none does. */
export type StoryEvidenceState = "has-receipt" | "no-receipt";

export interface PrRef {
    repo: string;
    pr: number;
}

export interface StoryEvidence {
    story: number;
    state: StoryEvidenceState;
    /** Every merged pull request that claims the story. */
    prs: EvidencePr[];
    /** Pull requests whose receipt names the story with a fingerprint other than its current one. */
    changed: PrRef[];
    /** Pull requests whose receipt names the story but records no fingerprint for it. */
    unknown: PrRef[];
}

export interface EvidenceReport {
    stories: StoryEvidence[];
    /** Selected receipts on claiming pull requests that name no story, and so count for none. */
    coversNone: Array<{ repo: string; pr: number }>;
    /** Stories marked as shipping without a pull request of their own; never read. */
    excluded: number[];
    /** The report as close repeats it, one line per finding. */
    lines: string[];
}

export type EvidenceResult = { ok: true; report: EvidenceReport } | { ok: false; failures: StoryReadFailure[] };

export interface CollectEvidenceInput {
    /** The epic's live story set, re-read on this run. */
    stories: readonly number[];
    excluded?: readonly number[];
    /** The repository story numbers resolve against, used to qualify them in `lines`. */
    issuesRepo?: string;
}

function prKey(pr: { repo: string; pr: number }): string {
    return `${pr.repo.toLowerCase()}#${pr.pr}`;
}

/** Build the evidence report for every live, non-excluded story, or name every story whose evidence could not be read. */
export function collectEvidence(deps: EvidenceDeps, input: CollectEvidenceInput): EvidenceResult {
    const excluded = [...(input.excluded ?? [])].sort((a, b) => a - b);
    const failures: StoryReadFailure[] = [];
    const stories: StoryEvidence[] = [];
    const receipts = new Map<string, ReceiptRead>();
    const coversNone = new Map<string, { repo: string; pr: number }>();

    for (const story of [...input.stories].sort((a, b) => a - b)) {
        if (excluded.includes(story)) continue;
        const claims = deps.readClaims(story);
        if (!claims.ok) {
            failures.push(claims.failure);
            continue;
        }
        const prs: EvidencePr[] = [];
        let failed = false;
        for (const pr of claims.result.prs) {
            const key = prKey(pr);
            let read = receipts.get(key);
            if (read === undefined) {
                read = deps.readReceipt(pr);
                receipts.set(key, read);
            }
            if (!read.ok) {
                failures.push({ story, cause: `the receipt on ${pr.repo}#${pr.pr} could not be read: ${read.cause}` });
                failed = true;
                break;
            }
            const named = read.receipt?.stories ?? [];
            if (read.receipt !== null && named.length === 0) coversNone.set(key, { repo: pr.repo, pr: pr.pr });
            prs.push({ repo: pr.repo, pr: pr.pr, receipt: read.receipt !== null, namesStory: named.includes(story) });
        }
        if (failed) continue;

        const changed: PrRef[] = [];
        const unknown: PrRef[] = [];
        const naming = prs.filter((p) => p.namesStory);
        if (naming.length > 0) {
            const current = deps.fingerprint(story);
            if (!current.ok) {
                failures.push({ story, cause: `its current text could not be fetched: ${current.cause}` });
                continue;
            }
            for (const p of naming) {
                const r = receipts.get(prKey(p));
                const recorded = r !== undefined && r.ok ? r.receipt?.storyFingerprints[story] : undefined;
                if (recorded === undefined) unknown.push({ repo: p.repo, pr: p.pr });
                else if (recorded !== current.digest) changed.push({ repo: p.repo, pr: p.pr });
            }
        }
        stories.push({ story, state: naming.length > 0 ? "has-receipt" : "no-receipt", prs, changed, unknown });
    }

    if (failures.length > 0) return { ok: false, failures };
    const none = [...coversNone.values()];
    return { ok: true, report: { stories, coversNone: none, excluded, lines: renderLines(stories, none, input.issuesRepo) } };
}

function storyRef(story: number, issuesRepo: string | undefined): string {
    return issuesRepo ? `${issuesRepo}#${story}` : `#${story}`;
}

/** The report as close repeats it. A story with nothing to say produces no line. */
function renderLines(stories: readonly StoryEvidence[], coversNone: ReadonlyArray<{ repo: string; pr: number }>, issuesRepo: string | undefined): string[] {
    const lines: string[] = [];
    for (const s of stories) {
        const ref = storyRef(s.story, issuesRepo);
        const prs = (list: readonly PrRef[]) => list.map((p) => `${p.repo}#${p.pr}`).join(", ");
        if (s.state === "no-receipt") {
            lines.push(`${ref} — no receipt: no pull request claiming it carries an analyze receipt that names it`);
        }
        if (s.changed.length > 0) lines.push(`${ref} — changed since analysis: its text differs from the receipt on ${prs(s.changed)}`);
        if (s.unknown.length > 0) lines.push(`${ref} — unknown: the receipt on ${prs(s.unknown)} records no fingerprint of its text`);
    }
    for (const r of coversNone) {
        lines.push(`${r.repo}#${r.pr} — its receipt names no story, so it counts for none`);
    }
    return lines;
}

/**
 * The platform-backed reads: the shared claiming read against the issues repository, and the
 * existing verdict selection on each pull request, read from the repository it merged in. Nothing
 * here restates the selection rule.
 */
export function evidenceDeps(run: Runner, cwd: string, issuesRepo: string): EvidenceDeps {
    const slash = issuesRepo.lastIndexOf("/");
    const owner = issuesRepo.slice(0, slash).split("/").pop() ?? "";
    const slug: RepoSlug = { owner, repo: issuesRepo.slice(slash + 1) };
    return {
        readClaims: (story) => resolveStoryMergedPrs(run, cwd, slug, story),
        readReceipt: (pr) => {
            const v = readPrVerdict(run, cwd, pr.pr, pr.repo, issuesRepo, { ghRepo: pr.repo });
            if (!v.ok) return { ok: false, cause: v.error.message };
            return { ok: true, receipt: v.verdict.found ? v.verdict.receipt : null };
        },
        fingerprint: (story) => storyFingerprint(run, cwd, issuesRepo, story),
    };
}
