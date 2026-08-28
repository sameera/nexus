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
import * as path from "node:path";
import { resolveInstallLocation, type InstallLocationResult } from "./install-location.js";
import { isNexusNamespacedPath } from "./nexus-namespace.js";
import { COMPONENT_SUBTREES } from "./vendor-components.js";

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

/**
 * The fully resolved real paths of the component files Nexus owns under `componentRoot`.
 *
 * Real paths, not the paths as written, are what make the maintainer's pointing install a
 * non-duplicate: each pointer resolves to the very file the checkout holds, so the two locations
 * describe one set of files rather than two. Ownership is the shared namespace predicate — the
 * first segment beneath a managed subtree — so the guard cannot disagree with the installer about
 * which files Nexus owns.
 */
function componentRealPaths(componentRoot: string): Set<string> {
    const resolved = new Set<string>();
    for (const subtree of COMPONENT_SUBTREES) {
        const subtreeRoot: string = path.join(componentRoot, subtree);
        if (!fs.existsSync(subtreeRoot)) {
            continue;
        }
        const walk = (dir: string): void => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const abs: string = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(abs);
                    continue;
                }
                const rel: string = path.relative(componentRoot, abs).split(path.sep).join("/");
                if (!isNexusNamespacedPath(rel)) {
                    continue;
                }
                try {
                    resolved.add(fs.realpathSync(abs));
                } catch {
                    resolved.add(path.resolve(abs));
                }
            }
        };
        walk(subtreeRoot);
    }
    return resolved;
}

export interface EnvironmentScope {
    /** The repo the verb was invoked from. */
    cwd: string;
    /**
     * The account's home directory, when the caller wants the install location resolved against
     * something other than the operating system's answer. The configuration-directory variable
     * still wins over it — the account-side location the guard looks at is the location a verb
     * would install to, never a hard-coded home-directory default.
     */
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

    // The scope is the user account, never the machine: exactly two places are examined — the
    // location a verb would install to, and the repository the verb was invoked from.
    const location: InstallLocationResult = resolveInstallLocation(
        scope.home === undefined ? {} : { homedir: (): string => scope.home as string },
    );
    if (location.ok) {
        const repoComponentRoot: string = path.join(path.resolve(scope.cwd), ".claude");
        const installed: Set<string> = componentRealPaths(location.path);
        const local: Set<string> = componentRealPaths(repoComponentRoot);
        const distinct: boolean = [...installed].some((real) => !local.has(real));
        if (installed.size > 0 && local.size > 0 && distinct) {
            defects.push({
                defect: "2 component sets resolve on one account",
                detail: [location.path, repoComponentRoot].join(", "),
                remedy:
                    "keep one component set; the account-level one is the supported arrangement, so run " +
                    "`nexus migrate-components` in the repository to remove its committed copy",
            });
        }
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
