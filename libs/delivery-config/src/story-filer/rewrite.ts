/**
 * Pass 3: a story ref left in a filed body becomes the issue number it now resolves to (#372).
 *
 * The ref is an authoring key with the lifetime of the filing batch — it lets a work item name a
 * sibling before `gh issue create` has minted any numbers. Left in a filed body it is a dead string,
 * because nothing downstream re-derives it. Rewritten, it is a permanent clickable autolink, and the
 * issue number stays a story's only name.
 *
 * This has to be its own pass, after pass 1 has minted every number: a story may name a sibling
 * created later in the same batch, so no number exists for it at creation time.
 */

import { type ToolkitIo } from "../io.js";
import { type CreatedRecord } from "./create.js";
import { normalizeRef } from "./frontmatter.js";
import { type Ledger } from "./ledger.js";
import { type Outcome, type Platform } from "./platform.js";

/**
 * A story ref as it appears in issue *prose*, with or without the code-span backticks authors tend
 * to wrap it in.
 *
 * The ref body must start and end alphanumeric, so a sentence-ending period stays outside the match.
 * Only the `STORY-` prefixed form is a ref — a bare `170.02` is indistinguishable from a version
 * number and is deliberately not matched.
 */
const BODY_REF =
    /`STORY-(?<quoted>[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)`|\bSTORY-(?<plain>[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)/gi;

/**
 * Replace every ref in `body` with its issue number.
 *
 * Backticks around a ref are dropped along with it: GitHub does not autolink inside a code span, so
 * a wrapped `#173` would render as literal text rather than a link. An unresolvable ref is left
 * verbatim, so the author fixes it at the source file rather than hunting a mangled body.
 */
export function rewriteStoryRefs(body: string, refToNumber: Map<string, string>): [string, string[]] {
    const unresolved: string[] = [];
    const rewritten: string = body.replace(BODY_REF, (match: string, ...rest: unknown[]): string => {
        const groups = rest[rest.length - 1] as Record<string, string | undefined>;
        const raw: string = groups["quoted"] ?? groups["plain"] ?? "";
        const number: string | undefined = refToNumber.get(normalizeRef(raw));
        if (number === undefined) {
            unresolved.push(`STORY-${raw}`);
            return match;
        }
        return `#${number}`;
    });
    return [rewritten, unresolved];
}

/** Normalized ref → issue number, spanning this run and every prior one. */
export function refToNumber(created: CreatedRecord[], ledger: Ledger): Map<string, string> {
    const map: Map<string, string> = new Map();
    for (const record of created) if (record.number) map.set(record.ref, record.number);
    for (const [ref, entry] of Object.entries(ledger)) {
        if (entry.number && !map.has(ref)) map.set(ref, entry.number);
    }
    return map;
}

/** The issue number a `parent:` names, whether written as `#353` or as a full URL. */
export function parentIssueNumber(parent: string): string | null {
    return /(\d+)\s*$/.exec(parent.trim())?.[1] ?? null;
}

/**
 * The bodies this pass rewrites: every issue the batch touched, plus the parent epic.
 *
 * The epic is filed before any story exists, so its body carries the same exposure. Every story in a
 * batch shares one parent; the first that declares one names it.
 */
export function rewriteTargets(created: CreatedRecord[]): string[] {
    const targets: string[] = created.filter((record) => record.number !== null).map((record) => record.number as string);
    const parent: string = created.find((record) => record.parent !== "")?.parent ?? "";
    const epic: string | null = parent === "" ? null : parentIssueNumber(parent);
    if (epic !== null && !targets.includes(epic)) targets.push(epic);
    return targets;
}

export interface RewriteResult {
    rewritten: number;
    /** `[issue number, the ref that resolved to nothing]`. */
    unresolved: [string, string][];
    failed: string[];
}

export function rewritePass(
    created: CreatedRecord[],
    numbers: Map<string, string>,
    platform: Platform,
    io: ToolkitIo,
): RewriteResult {
    const result: RewriteResult = { rewritten: 0, unresolved: [], failed: [] };

    for (const number of rewriteTargets(created)) {
        const read: Outcome<string> = platform.issueBody(number);
        if (read.error !== null) io.stderr(`Error reading body of #${number}: ${read.error}`);
        const body: string | null = read.value;
        if (body === null) {
            result.failed.push(number);
            continue;
        }
        const [next, unresolved] = rewriteStoryRefs(body, numbers);
        for (const bad of unresolved) {
            io.stderr(`  Unresolved: body ref '${bad}' in #${number} not among created issues`);
            result.unresolved.push([number, bad]);
        }
        // No refs left to resolve means no write — this is what makes a re-run a no-op, since a
        // rewritten body no longer carries the tokens that would trigger another edit.
        if (next === body) continue;
        const written: Outcome<true> = platform.setIssueBody(number, next);
        if (written.value === true) {
            io.stdout(`  #${number} body refs rewritten to issue numbers`);
            result.rewritten++;
        } else {
            io.stderr(`Error rewriting body of #${number}: ${written.error ?? ""}`);
            result.failed.push(number);
        }
    }

    io.stdout("");
    io.stdout(
        `Pass 3: ${result.rewritten} bod(ies) rewritten, ${result.unresolved.length} unresolved ref(s), ` +
            `${result.failed.length} failed`,
    );
    return result;
}
