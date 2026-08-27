/**
 * The environment guard (story #307): a defect in the environment is named where a human will see
 * it, without any verb's output contract being disturbed.
 *
 * A guard fires on a **defect** — an interpreter the release needs and cannot find, two component
 * sets resolving on one account — never on a version difference. The version-difference ladder is
 * deferred; this is not a rung of it.
 *
 * Three placements make it safe rather than intrusive, and each is an acceptance criterion:
 *
 * - **Standard error, always.** Every verb's contract is that success prints exactly one JSON
 *   object on standard output. A guard that printed there would break every consumer.
 * - **The exit code is the verb's.** A diagnostic reports; it does not decide the run's outcome.
 * - **The dispatcher runs it, not the verbs.** A verb added later carries no guard code of its
 *   own and is still covered, because coverage is a property of where dispatch happens.
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { listComponentFiles } from "./vendor-components.js";

export interface EnvironmentDefect {
    /** What is wrong, in the words a user would search for. */
    defect: string;
    /** Where it is — the concrete paths or values that make the defect checkable. */
    detail: string;
    /** What to do about it. */
    remedy: string;
}

export interface InterpreterReport {
    path: string | null;
    version: string | null;
}

/**
 * The `python3` the Python half of the release runs on. An interpreter that cannot be resolved is
 * reported as unresolved rather than raised: the verbs that report on the environment are exactly
 * the ones a user runs when the environment is already broken.
 */
export function resolveInterpreter(): InterpreterReport {
    const unresolved: InterpreterReport = { path: null, version: null };
    let resolvedPath: string;
    try {
        resolvedPath = execFileSync("command", ["-v", "python3"], { encoding: "utf8", shell: true, stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
        return unresolved;
    }
    if (resolvedPath === "") {
        return unresolved;
    }
    try {
        const reported: string = execFileSync(resolvedPath, ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
        return { path: resolvedPath, version: reported.replace(/^Python\s+/, "") };
    } catch {
        return unresolved;
    }
}

/** True when `root` holds an installed Nexus component set (a `.claude/` tree Nexus owns files in). */
function holdsComponentSet(root: string): boolean {
    const claudeDir: string = path.join(root, ".claude");
    if (!fs.existsSync(claudeDir)) {
        return false;
    }
    return listComponentFiles(claudeDir).some((rel) => path.basename(rel).startsWith("nxs."));
}

export interface EnvironmentScope {
    /** The repo the verb was invoked from. */
    cwd: string;
    /** The account's home directory — where an account-level component set is installed. */
    home?: string;
}

/**
 * Every defect the environment currently has. Ordered so the interpreter — the one that stops the
 * other half of the release from running at all — is named first.
 */
export function detectEnvironmentDefects(scope: EnvironmentScope): EnvironmentDefect[] {
    const defects: EnvironmentDefect[] = [];

    if (resolveInterpreter().path === null) {
        defects.push({
            defect: "required interpreter 'python3' could not be resolved",
            detail: "searched PATH",
            remedy: "install python3, or put the interpreter already installed on PATH",
        });
    }

    const home: string = scope.home ?? os.homedir();
    const roots: string[] = [...new Set([path.resolve(home), path.resolve(scope.cwd)])];
    const installed: string[] = roots.filter(holdsComponentSet).map((root) => path.join(root, ".claude"));
    if (installed.length > 1) {
        defects.push({
            defect: `${installed.length} component sets resolve on one account`,
            detail: installed.join(", "),
            remedy: "keep one component set; remove the others so a component body cannot resolve to two different versions",
        });
    }

    return defects;
}

export interface EnvironmentGuard {
    /** Name every detected defect on standard error. Repeat calls within one run report nothing further. */
    report: () => void;
}

/**
 * A guard bound to one invocation. Reporting is idempotent for the life of that invocation, so the
 * guard can be consulted wherever it is convenient without a user seeing the same defect twice.
 */
export function makeEnvironmentGuard(io: { stderr: (line: string) => void }, defects: readonly EnvironmentDefect[]): EnvironmentGuard {
    let reported = false;
    return {
        report: (): void => {
            if (reported) {
                return;
            }
            reported = true;
            for (const { defect, detail, remedy } of defects) {
                io.stderr(`nexus: environment defect — ${defect} (${detail}); ${remedy}`);
            }
        },
    };
}
