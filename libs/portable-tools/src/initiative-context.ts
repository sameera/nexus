/**
 * The initiative context: the planning context kept for one initiative (epic #850, decision record
 * #961).
 *
 * A decomposition that files an initiative keeps the context the run saw — what the consent gate
 * showed, every resolved discovery decision, an attached design plan — in one committed folder per
 * initiative, named for the initiative's issue number, under the initiative context store. The
 * initiative's body carries a short summary and one pointer sentence naming that folder.
 *
 * The folder name and the pointer's shape are stated here once. The epic stage writes them through
 * `nexus initiative-context`, and the readers find the folder by the same rule, so a pointer written
 * by one stage is always one the others recognise. A lead who writes a context by hand for an older
 * initiative puts it in the same place.
 */

import { INITIATIVE_STORE_PATH } from "@nexus/workspace/pipeline-stores";

/** What the pointer carries until the initiative has an issue number (record #961, D3). */
export const POINTER_PLACEHOLDER: string = "<INITIATIVE>";

/** The repo-relative folder holding initiative `n`'s context, with no trailing slash. */
export function initiativeContextDir(n: number): string {
    return `${INITIATIVE_STORE_PATH}/initiative-${n}`;
}

/**
 * The one pointer sentence the initiative body carries. With no number it carries the placeholder,
 * which the epic stage replaces in the same single edit that writes the stub numbers in.
 */
export function renderPointer(n?: number): string {
    const folder: string = `${INITIATIVE_STORE_PATH}/initiative-${n === undefined ? POINTER_PLACEHOLDER : n}/`;
    return `The full planning context of this initiative is kept in the repository, in \`${folder}\`.`;
}

const POINTER_PATTERN: RegExp = new RegExp(
    `The full planning context of this initiative is kept in the repository, in \`${INITIATIVE_STORE_PATH.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/initiative-(\\d+)/\``,
);

/** The initiative number a body's pointer names; null when the body carries no filled pointer. */
export function parsePointer(body: string): number | null {
    const match: RegExpExecArray | null = POINTER_PATTERN.exec(body);
    return match === null ? null : Number(match[1]);
}

/** What `checkPlan` reads; the node `fs` module satisfies it. */
export interface PlanFs {
    statSync: (p: string, opts: { throwIfNoEntry: false }) => { isFile: () => boolean } | undefined;
    readFileSync: (p: string, encoding: "utf8") => string;
}

export type CheckPlanResult =
    | { ok: true; path: string; name: string; keptAs: string }
    | { ok: false; problem: "missing-plan" | "empty-plan"; message: string };

/**
 * Whether a design plan named to the epic stage can be kept (record #961, D4, G11). A missing or
 * empty plan is refused before anything is drafted, naming the file as the lead wrote it. A kept
 * plan is filed in the context as `plan-<its file name>`, so it never collides with the files the
 * run writes itself.
 */
export function checkPlan(absolute: string, asWritten: string, files: PlanFs): CheckPlanResult {
    const stat = files.statSync(absolute, { throwIfNoEntry: false });
    if (stat === undefined || !stat.isFile()) {
        return { ok: false, problem: "missing-plan", message: `the design plan ${asWritten} does not exist as a file; nothing was drafted.` };
    }
    if (files.readFileSync(absolute, "utf8").trim() === "") {
        return { ok: false, problem: "empty-plan", message: `the design plan ${asWritten} is empty; nothing was drafted.` };
    }
    const name: string = absolute.split(/[\\/]/).pop() as string;
    return { ok: true, path: asWritten, name, keptAs: `plan-${name}` };
}
