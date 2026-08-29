/**
 * The `--dry-run` rehearsal (stories #367, #368).
 *
 * One line per work item, carrying what pass 1 would apply — including the caller's canonical
 * classification, because a rehearsal that renders `story` on a batch of stubs is not the rehearsal
 * an irreversible bulk filing needs. The line's shape is frozen along with the rest of the surface.
 */

import { type FrontmatterValue, type WorkItem, fileStem } from "./frontmatter.js";

/** Render a declared value the way the preview has always rendered it: a list, or bare text. */
function renderValue(value: FrontmatterValue | undefined, fallback: string): string {
    if (value === undefined) return fallback;
    return Array.isArray(value) ? renderList(value) : value;
}

export function renderList(items: string[]): string {
    return `[${items.map((item) => `'${item}'`).join(", ")}]`;
}

/**
 * The preview line for one work item.
 *
 * `classificationLabel` is the canonical label this run would apply, or null in `types` mode, where
 * the issue type classifies the issue instead and no label is forced.
 */
export function previewLine(item: WorkItem, classificationLabel: string | null): string {
    const labels: string[] =
        classificationLabel !== null && !item.labels.includes(classificationLabel)
            ? [classificationLabel, ...item.labels]
            : item.labels;
    const ref: string = renderValue(item.frontmatter["ref"], fileStem(item.fileName));
    const title: string = renderValue(item.frontmatter["title"], "N/A");
    const parent: string = renderValue(item.frontmatter["parent"], "N/A");
    const project: string = renderValue(item.frontmatter["project"], "(auto)");
    const blockedBy: string = renderValue(item.frontmatter["blocked_by"], "none");
    return (
        `  ${item.fileName}: ref='${ref}', title='${title}', labels=${renderList(labels)}, ` +
        `parent='${parent}', project='${project}', blocked_by=${blockedBy}`
    );
}
