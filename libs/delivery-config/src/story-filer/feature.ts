/**
 * The feature link for a batch (epic #998, decision record #1010, D8).
 *
 * Before anything is created, every distinct feature issue the batch names must read as a feature,
 * or the whole batch is refused. After the create pass has recorded each issue in the ledger, each
 * item that names a feature issue is linked to it by relates-to. A failed link only warns, and the
 * reused records of a repeated run are linked again, which is how a repeat adds a missing link.
 */

import { type GhRunner, resolveOwnerRepo } from "../gh.js";
import { type ToolkitIo } from "../io.js";
import { type FeatureCheck, type IssueAt, type LinkResult, checkFeatureIssue, linkToFeature, parseIssueAt } from "../feature-link.js";
import { type CreatedRecord } from "./create.js";
import { type WorkItem } from "./frontmatter.js";

export interface FeatureBatchCheck {
    items: WorkItem[];
    projectRoot: string;
    issuesRepo: string | null;
    /** Called only when an item names a feature issue, so a batch with none reads nothing. */
    runner: () => GhRunner;
}

/** True when every named feature issue reads as a feature. False refuses the batch, nothing created. */
export function featureIssuesAreFeatures(check: FeatureBatchCheck, io: ToolkitIo): boolean {
    const named: string[] = [...new Set(check.items.map((item) => item.featureIssue.trim()).filter((ref) => ref !== ""))];
    if (named.length === 0) return true;
    const run: GhRunner = check.runner();
    const home = resolveOwnerRepo(run, check.issuesRepo);
    if (home === null) {
        io.stderr("Error: the issues repository could not be resolved, so the named feature issue could not be checked. Nothing was created.");
        return false;
    }
    const refused: string[] = [];
    for (const ref of named) {
        const verdict: FeatureCheck = checkFeatureIssue(run, check.projectRoot, ref, home);
        if (!verdict.ok) refused.push(verdict.message);
    }
    if (refused.length === 0) return true;
    for (const message of refused) {
        io.stderr(`Error: a work item names ${message}. An epic or a stub names only a feature issue as its feature. Fix \`feature_issue:\` and re-run.`);
    }
    io.stderr("Nothing was created.");
    return false;
}

export interface FeatureLinkResult {
    linked: number;
    present: number;
    failed: number;
}

/** Link each recorded issue to the feature issue its item names. Never fails the run (G17). */
export function featureLinkPass(
    items: WorkItem[],
    created: CreatedRecord[],
    run: GhRunner,
    issuesRepo: string | null,
    io: ToolkitIo,
): FeatureLinkResult {
    const result: FeatureLinkResult = { linked: 0, present: 0, failed: 0 };
    const featureOf: Map<string, string> = new Map(items.filter((i) => i.featureIssue.trim() !== "").map((i) => [i.ref, i.featureIssue.trim()]));
    if (featureOf.size === 0) return result;
    const home = resolveOwnerRepo(run, issuesRepo);
    if (home === null) return result;
    for (const record of created) {
        const ref: string | undefined = featureOf.get(record.ref);
        if (ref === undefined || record.number === null) continue;
        const target: IssueAt | null = parseIssueAt(ref, home);
        if (target === null) continue;
        const linked: LinkResult = linkToFeature(run, { ...home, number: record.number }, target);
        if (linked.outcome === "linked") {
            io.stdout(`  #${record.number} relates to feature ${ref}`);
            result.linked++;
        } else if (linked.outcome === "present") {
            result.present++;
        } else {
            io.stderr(`  Warning: could not link #${record.number} to feature ${ref}: ${linked.reason}. Re-run to retry.`);
            result.failed++;
        }
    }
    return result;
}
