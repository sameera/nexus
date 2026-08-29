/**
 * Everything refusable, refused before the first remote call (story #378).
 *
 * The target root is operator-supplied and never derived from the draft's own location: this root
 * selects the publishing configuration that decides which upstream repository receives the write,
 * so a draft resolving outside it is refused rather than silently re-rooting the run around it
 * (Invariant 1). The prerequisite checks run against that root too, so the authentication and
 * repository answers are the target's, not the invoking directory's (Invariant 2).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { type GhRunner } from "../gh.js";
import { type RootLayers, layersAt } from "../resolve.js";
import { type EpicArgs } from "./args.js";
import { type EpicEnvironment } from "./environment.js";
import { type EpicOutput } from "./output.js";

export type PreflightOutcome =
    | { kind: "ready"; draft: string; projectRoot: string; layers: RootLayers; run: GhRunner }
    | { kind: "refused" };

/** Resolve a path to its real location, or leave it as given when it does not exist yet. */
function realPath(value: string): string {
    try {
        return fs.realpathSync(value);
    } catch {
        return value;
    }
}

/** Whether `target` is `root` or sits beneath it. */
function isInside(root: string, target: string): boolean {
    if (root === target) return true;
    return target.startsWith(root.endsWith(path.sep) ? root : root + path.sep);
}

/**
 * The three prerequisite failures, told apart.
 *
 * An absent client, an unauthenticated one and a directory that is not a repository are three
 * different things to fix, so each is reported distinctly (Invariant 3).
 */
function prerequisitesMet(run: GhRunner, git: GhRunner, env: EpicEnvironment, out: EpicOutput): boolean {
    if (!env.hasGh()) {
        out.error("GitHub CLI (gh) is not installed");
        out.line("Install with: brew install gh (macOS) or see https://cli.github.com");
        return false;
    }
    if (run(["auth", "status"]).status !== 0) {
        out.error("Not authenticated with GitHub CLI");
        out.line("Run: gh auth login");
        return false;
    }
    if (git(["rev-parse", "--is-inside-work-tree"]).status !== 0) {
        out.error("Not in a git repository");
        return false;
    }
    return true;
}

export function preflight(args: EpicArgs, io: { cwd: string }, env: EpicEnvironment, out: EpicOutput): PreflightOutcome {
    const draft: string = path.resolve(io.cwd, args.draft);
    if (!fs.existsSync(draft) || !fs.statSync(draft).isFile()) {
        out.error(`Epic file not found: ${args.draft}`);
        return { kind: "refused" };
    }

    const rootArg: string = args.root !== null ? realPath(path.resolve(io.cwd, args.root)) : realPath(io.cwd);
    const layers: RootLayers = layersAt(rootArg);
    const projectRoot: string = layers.root;
    const resolvedDraft: string = realPath(draft);
    if (!isInside(projectRoot, resolvedDraft)) {
        out.error(
            `Epic file ${resolvedDraft} resolves outside the target root ${projectRoot}; ` +
                "pass --root to point at the correct repo.",
        );
        return { kind: "refused" };
    }

    const run: GhRunner = env.runnerFor(projectRoot);
    if (!prerequisitesMet(run, env.gitFor(projectRoot), env, out)) return { kind: "refused" };

    return { kind: "ready", draft: resolvedDraft, projectRoot, layers, run };
}
