/**
 * The one definition of the pipeline stores a Nexus stage never reads back as behaviour
 * (decision record #450, invariants 2–6).
 *
 * Four stores under the hidden Nexus root are the pipeline's own working surface: the close-time
 * queue, the pre-epic discovery store, the workbook a learner reads, and the initiative context
 * store (epic #850, decision record #961, D1). Each is something a stage *writes*, teaches from or
 * plans from, never behaviour a stage reads back, so every diff a stage derives — analyze, close
 * and distill alike — withholds all four.
 *
 * The set is stated here once, in the leaf library every diff-deriving library already depends on.
 * Code consumers import `excludePathspecs()`; a command body asks the
 * executable for the same list (`nexus excluded-stores`) rather than writing the paths out, so the
 * two statements of the set cannot disagree. Before this module the exclusion was written twice —
 * once in the hub diff derivation and once as prose in the distill command — and a disagreement
 * between two copies is silent: a stage quietly reads generated markup as shipped behaviour.
 *
 * Membership is closed and reviewed. There is deliberately no marker file that lets any directory
 * opt itself out of a stage's diff, because a marker anyone can drop can hide real application
 * source from a gate and the failure is invisible — the diff simply gets smaller.
 */

/** The hidden root every Nexus-managed store sits under. */
export const NEXUS_ROOT_DIRNAME: string = ".nexus";

/** The workbook store's directory name beneath the Nexus root. */
export const WORKBOOK_STORE_DIRNAME: string = "workbook";

/** The repo-relative path of the workbook store. */
export const WORKBOOK_STORE_PATH: string = `${NEXUS_ROOT_DIRNAME}/${WORKBOOK_STORE_DIRNAME}`;

/** The initiative context store's directory name beneath the Nexus root. */
export const INITIATIVE_STORE_DIRNAME: string = "initiatives";

/** The repo-relative path of the initiative context store: one folder per initiative beneath it. */
export const INITIATIVE_STORE_PATH: string = `${NEXUS_ROOT_DIRNAME}/${INITIATIVE_STORE_DIRNAME}`;

/** One member of the excluded set: the path, and the reason membership is justified. */
export interface ExcludedStore {
    /** Repo-relative path of the store root, with no trailing slash and no glob. */
    path: string;
    /** Why a stage must not read this store back as behaviour. Reviewable, not decorative. */
    why: string;
}

/**
 * The closed set. Order is stable so every rendering of it is byte-identical run to run.
 */
export const EXCLUDED_STORES: readonly ExcludedStore[] = [
    {
        path: `${NEXUS_ROOT_DIRNAME}/queue`,
        why: "a queue entry's own artifacts are the distiller's input, not the behaviour it reads",
    },
    {
        path: `${NEXUS_ROOT_DIRNAME}/discovery`,
        why: "a discovery folder holds ungated, in-flight reasoning no human gate has passed",
    },
    {
        path: WORKBOOK_STORE_PATH,
        why: "a workbook is a surface the pipeline generates and teaches from, never behaviour it reads back",
    },
    {
        path: INITIATIVE_STORE_PATH,
        why: "an initiative context is planning rationale a later planning run reads, never shipped behaviour",
    },
];

/** The store paths alone, in definition order. */
export const EXCLUDED_STORE_PATHS: readonly string[] = EXCLUDED_STORES.map((s) => s.path);

/**
 * The set rendered as git pathspec exclusions, ready to append to a `git diff -- .` invocation.
 * A store is excluded entire; no consumer may exclude a slice of one (invariant 5).
 */
export function excludePathspecs(): string[] {
    return EXCLUDED_STORE_PATHS.map((p) => `:(exclude)${p}`);
}

/** True when a repo-relative path lies inside one of the excluded stores. */
export function isExcludedStorePath(rel: string): boolean {
    const normalized: string = rel.replace(/^\.\//, "");
    return EXCLUDED_STORE_PATHS.some((p) => normalized === p || normalized.startsWith(`${p}/`));
}
