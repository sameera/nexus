/**
 * Every label this run will apply, established before the first issue exists (story #368).
 *
 * A label that is neither creatable nor already present is a permission gap, and it is reported
 * *before* any creation: half a filed batch is far worse than a run that did nothing (Invariant 2).
 * A work item's own `labels:` frontmatter rides alongside the canonical classification — that is the
 * path a stub's unplanned-state marker reaches GitHub by.
 */

import { type GhRunner, ensureLabels } from "../gh.js";
import { type ToolkitIo } from "../io.js";
import { type FilerConfig, STORY_LABEL_STYLE } from "./configure.js";
import { type WorkItem } from "./frontmatter.js";

/** The labels this run would apply, canonical classification first. */
export function wantedLabels(items: WorkItem[], config: FilerConfig): string[] {
    const wanted: string[] = config.classification === "types" ? [] : [config.classificationLabel];
    for (const item of items) wanted.push(...item.labels);
    return wanted;
}

/** Upsert every wanted label. False means the batch is refused, with nothing created. */
export function ensureBatchLabels(items: WorkItem[], config: FilerConfig, run: GhRunner, io: ToolkitIo): boolean {
    // The story label keeps the colour it has always been created with; everything else — a stub's
    // unplanned marker included — takes the default styling.
    const styles: Record<string, [string, string]> = { [config.storyLabel]: STORY_LABEL_STYLE };
    const missing: string[] = ensureLabels(wantedLabels(items, config), run, config.issuesRepo, styles);
    if (missing.length === 0) return true;
    io.stderr(
        `Error: cannot apply label(s) ${missing.map((name) => `'${name}'`).join(", ")} — they do not ` +
            "exist in the target repository and could not be created (the token likely lacks label " +
            "scope). Nothing was created; create the label(s) or grant the scope, then re-run.",
    );
    return false;
}
