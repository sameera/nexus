/**
 * The design plan a lead attaches to an initiative being filed (epic #850, decision record #961,
 * D4). The plan travels in the initiative's planning context, which is kept on the initiative issue
 * (epic #1011, decision record #1016); this module only checks that a named plan can be kept.
 */

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
