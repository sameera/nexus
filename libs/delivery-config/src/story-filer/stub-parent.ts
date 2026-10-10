/**
 * The parent check: an epic stub may sit under an initiative, and under nothing else (decision
 * record #786, D8).
 *
 * The rule this narrows was "a stub is never a sub-issue of anything", and it exists to prevent one
 * deadlock: `nexus close` hard-blocks until every sub-issue of an epic is closed, so a stub filed
 * beneath an epic blocks that epic's close. An initiative sits above the epic and close never reads
 * an epic's parent, so a stub under one cannot cause it. Everything else is still refused, and
 * refused by default: an epic, a story, a record, an unmarked issue, a number that does not resolve.
 *
 * The filer makes the check itself rather than trusting each writer to get parentage right, and it
 * refuses the whole batch before anything is created, since a partial one is the thing being
 * avoided. What a parent is filed as comes from the shared kind rule, the same one the epic resolver
 * calls, so filing and reading cannot disagree about the same issue.
 *
 * Only an unplanned item that names a parent costs a read, one per distinct parent. A batch with no
 * such item never contacts GitHub here.
 */

import { type GhRunner, type RunResult, resolveOwnerRepo } from "../gh.js";
import { type ToolkitIo } from "../io.js";
import {
    type KindClassification,
    type SubIssueMarkers,
    initiativeNeedsIssueType,
    isDeclaredInitiative,
    readKindMarkers,
} from "../issue-kind.js";
import { type WorkItem } from "./frontmatter.js";
import { issueNumberOf } from "./platform.js";

const markersQuery = (withType: boolean): string =>
    "query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){" +
    `issue(number:$num){${withType ? "issueType{name} " : ""}labels(first:100){nodes{name}}}}}`;

/** The markers `number` carries in the issues repository, or null when it cannot be read or is absent. */
function readMarkers(
    run: GhRunner,
    at: { owner: string; name: string },
    number: string,
    withType: boolean,
): SubIssueMarkers | null {
    const result: RunResult = run([
        "api",
        "graphql",
        "-f",
        `query=${markersQuery(withType)}`,
        "-f",
        `owner=${at.owner}`,
        "-f",
        `repo=${at.name}`,
        "-F",
        `num=${number}`,
    ]);
    if (result.status !== 0) return null;
    try {
        const issue = (JSON.parse(result.stdout) as { data?: { repository?: { issue?: unknown } } }).data?.repository?.issue as
            | { issueType?: { name?: string } | null; labels?: { nodes?: { name?: string }[] } }
            | null
            | undefined;
        if (issue === null || issue === undefined) return null;
        return {
            labels: (issue.labels?.nodes ?? []).map((node) => node.name ?? "").filter((name) => name !== ""),
            issueType: issue.issueType?.name ?? null,
        };
    } catch {
        return null;
    }
}

export interface StubParentCheck {
    items: WorkItem[];
    /** The resolved unplanned label — what makes a work item a stub. */
    unplannedLabel: string;
    /** The checkout root the publishing settings resolve from. */
    projectRoot: string;
    /** `owner/repo` the batch is filed into, or null for the current repository. */
    issuesRepo: string | null;
    /** Called only when a stub names a parent, so a batch with none binds no runner and reads nothing. */
    runner: () => GhRunner;
}

/** True when the batch is legal. False means it is refused, with nothing created. */
export function stubParentsAreInitiatives(check: StubParentCheck, io: ToolkitIo): boolean {
    const parented: WorkItem[] = check.items.filter(
        (item) => item.parent.trim() !== "" && item.labels.includes(check.unplannedLabel),
    );
    if (parented.length === 0) return true;

    const run: GhRunner = check.runner();
    const kinds: KindClassification = readKindMarkers(check.projectRoot);
    const withType: boolean = initiativeNeedsIssueType(kinds);
    const at = resolveOwnerRepo(run, check.issuesRepo);

    // One read per distinct parent, however many stubs of the set name it.
    const verdicts: Map<string, boolean> = new Map();
    const isInitiative = (parent: string): boolean => {
        const number: string = issueNumberOf(parent);
        if (!/^\d+$/.test(number) || at === null) return false;
        let verdict: boolean | undefined = verdicts.get(number);
        if (verdict === undefined) {
            const markers: SubIssueMarkers | null = readMarkers(run, at, number, withType);
            verdict = markers !== null && isDeclaredInitiative(kinds, markers);
            verdicts.set(number, verdict);
        }
        return verdict;
    };

    const refused: WorkItem[] = parented.filter((item) => !isInitiative(item.parent));
    if (refused.length === 0) return true;

    for (const item of refused) {
        io.stderr(
            `Error: ${item.fileName} carries the '${check.unplannedLabel}' label and asks to be a ` +
                `sub-issue of ${item.parent}, which is not declared an initiative. An epic stub is a ` +
                "sub-issue only of an initiative — its link to the epic that spawned it is a body " +
                "mention. Remove the `parent:` key, or name an initiative, and re-run.",
        );
    }
    io.stderr("Nothing was created.");
    return false;
}
