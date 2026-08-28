/**
 * The cross-feature backlog, asked for rather than spelled out (story #359).
 *
 * With one unplanned label and no per-feature family, the whole backlog across every feature is the
 * open issues carrying that label — no file glob, no sequencing table. The label is resolved here so
 * that a repository which renames it renames the query too, and so no call site spells it out: a
 * stage's report and a documentation link name the same query and both track the rename.
 */

import { type RootLayers, resolveKeyFromLayers } from "./resolve.js";

/** The three shapes the one query is asked for. */
export const BACKLOG_QUERY_FORMS: readonly string[] = ["list", "search", "exclude"];

/**
 * Quote a label only when it would otherwise split into two filters.
 *
 * A declared value arrives however it was written, because the settings reader keeps surrounding
 * quotes verbatim — so one pair is peeled off before deciding, and a multi-word label is never
 * double-quoted into a filter GitHub cannot match.
 */
export function queryToken(label: string): string {
    let value: string = label;
    for (const quote of ['"', "'"]) {
        if (value.length >= 2 && value.startsWith(quote) && value.endsWith(quote)) {
            value = value.slice(1, -1);
            break;
        }
    }
    return /\s/.test(value) ? `"${value}"` : value;
}

/**
 * The backlog query in the requested form.
 *
 * `list` is the command-line listing, targeted at wherever epics are filed, because a stub is an
 * epic. `search` is the fragment an issue-search link carries. `exclude` is the single negated
 * filter that keeps unplanned work out of every query enumerating epics for planned work.
 */
export function backlogQuery(layers: RootLayers, form: string): string {
    const label: string = queryToken(resolveKeyFromLayers(layers, "unplanned-label") ?? "");
    if (form === "exclude") return `-label:${label}`;
    if (form === "search") return `is:issue is:open label:${label}`;
    const repo: string = resolveKeyFromLayers(layers, "epic-repo") ?? "";
    return `gh issue list${repo ? ` --repo ${repo}` : ""} --state open --label ${label}`;
}
