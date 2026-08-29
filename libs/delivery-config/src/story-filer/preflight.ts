/**
 * The preflight: is this batch legal at all (story #367)?
 *
 * Everything decided here is decided before the first `gh` call, because the failure mode this
 * capability exists to avoid is a half-filed batch. A refusal costs the lead a corrected file; a
 * refusal that arrived one issue too late costs them an unpick on GitHub.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type ToolkitIo } from "../io.js";
import { type RootLayers, layersAt, resolveKeyFromLayers } from "../resolve.js";
import { type FilerArgs } from "./args.js";
import { type WorkItem, readWorkItem } from "./frontmatter.js";

/** The `STORY-*.md` work items in `targetFolder`, in sorted filename order. */
export function findWorkItems(targetFolder: string): string[] {
    return fs
        .readdirSync(targetFolder)
        .filter((name) => name.startsWith("STORY-") && name.endsWith(".md"))
        .sort()
        .map((name) => path.join(targetFolder, name));
}

export type PreflightOutcome =
    | { kind: "ready"; targetFolder: string; projectRoot: string; layers: RootLayers; items: WorkItem[] }
    /** Nothing to do, and nothing wrong: an empty folder is a complete run. */
    | { kind: "empty" }
    | { kind: "refused" };

/** Resolve a path to its real location, or leave it as given when it does not exist yet. */
function realPath(value: string): string {
    try {
        return fs.realpathSync(value);
    } catch {
        return value;
    }
}

/** Whether `folder` is `root` or sits beneath it. */
function isInside(root: string, folder: string): boolean {
    if (root === folder) return true;
    return folder.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
}

export function preflight(args: FilerArgs, io: ToolkitIo): PreflightOutcome {
    const targetFolder: string = path.resolve(io.cwd, args.targetFolder);

    if (!fs.existsSync(targetFolder) || !fs.statSync(targetFolder).isDirectory()) {
        io.stderr(`Error: ${targetFolder} is not a directory`);
        return { kind: "refused" };
    }

    const files: string[] = findWorkItems(targetFolder);
    if (files.length === 0) {
        io.stdout(`No STORY-*.md files found in ${targetFolder}`);
        return { kind: "empty" };
    }
    io.stdout(`Found ${files.length} story file(s)`);

    // The target root is operator-supplied and never derived from the target folder's own location:
    // this root selects the publishing configuration that decides which repository receives the
    // issues, so an artifact resolving outside it is refused rather than silently re-rooting the run.
    const rootArg: string = args.root !== null ? realPath(path.resolve(io.cwd, args.root)) : realPath(io.cwd);
    const layers: RootLayers = layersAt(rootArg);
    const projectRoot: string = layers.root;
    const resolvedTarget: string = realPath(targetFolder);
    if (!isInside(projectRoot, resolvedTarget)) {
        io.stderr(
            `Error: ${resolvedTarget} resolves outside the target root ${projectRoot}; ` +
                "pass --root to point at the correct repo.",
        );
        return { kind: "refused" };
    }

    const items: WorkItem[] = files.map((file) =>
        readWorkItem(path.basename(file), fs.readFileSync(file, "utf8"), file),
    );

    // A stub is never a sub-issue of anything: `/nxs.close` hard-blocks until every sub-issue of an
    // epic is closed, so a deferred-scope stub filed beneath the epic being closed would deadlock
    // the stage that filed it. The filer refuses the relationship rather than trusting each writer
    // to omit it — and refuses the whole batch, since a partial one is the thing being avoided.
    const unplannedLabel: string = resolveKeyFromLayers(layers, "unplanned-label") ?? "";
    const parentedStubs: WorkItem[] = items.filter(
        (item) => item.parent.trim() !== "" && item.labels.includes(unplannedLabel),
    );
    if (parentedStubs.length > 0) {
        for (const item of parentedStubs) {
            io.stderr(
                `Error: ${item.fileName} carries the '${unplannedLabel}' label and asks to be a ` +
                    `sub-issue of ${item.parent}. A backlog stub is never a sub-issue — its link to ` +
                    "the epic that spawned it is a body mention. Remove the `parent:` key and re-run.",
            );
        }
        io.stderr("Nothing was created.");
        return { kind: "refused" };
    }

    return { kind: "ready", targetFolder, projectRoot, layers, items };
}
