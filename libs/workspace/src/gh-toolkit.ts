/**
 * Locate the Python half of the Nexus toolkit — the `nexus-gh` capabilities (story #300).
 *
 * The toolkit's own TypeScript libraries call the toolkit's own Python half, and that is a fourth
 * class of invocation: not a component body (#250 rewrites those), but the executable's libraries
 * reaching for the shared publishing resolver. They used to reach for it as a file inside the
 * target repository's vendored component tree — `<target-root>/.claude/skills/nxs-gh-shared/…` —
 * which is the arrangement the component-distribution refactor removes. Once no repository carries
 * a committed component set, that file is not there to read.
 *
 * So the toolkit is addressed by name, in the same direction the Python half addresses `nexus`:
 *
 *  1. `nexus-gh` on the caller's path — an installed release, the ordinary case.
 *  2. Otherwise the entry point beside this source, for the maintainer running from a checkout
 *     with nothing installed. That is a path relative to *this file*, never to the repository a
 *     capability happens to be acting on, so it says where the toolkit is, not where the work is.
 *
 * Neither available is reported as an absent toolkit with the remedy named — never as a missing
 * file inside the user's repository.
 */

import * as fs from "node:fs";
import * as path from "node:path";

/** The one literal the Python toolkit answers to, fixed by story #297. */
export const GH_TOOLKIT_NAME = "nexus-gh";

/** What to do about it when the toolkit cannot be found at all. */
export const GH_TOOLKIT_REMEDY = `install Nexus so that \`${GH_TOOLKIT_NAME}\` is on your PATH`;

export type GhToolkitLocation =
    | { ok: true; command: string; prefixArgs: string[] }
    | { ok: false; message: string };

/** Every directory on PATH, in order, with empty entries dropped. */
function pathEntries(env: NodeJS.ProcessEnv): string[] {
    return (env.PATH ?? "").split(path.delimiter).filter((entry) => entry.length > 0);
}

function isExecutableFile(candidate: string): boolean {
    try {
        if (!fs.statSync(candidate).isFile()) return false;
        fs.accessSync(candidate, fs.constants.X_OK);
        return true;
    } catch {
        return false;
    }
}

/** The entry point that ships beside these libraries, for a checkout with nothing installed. */
export function fromSourceEntryPoint(): string {
    return path.resolve(import.meta.dirname, "..", "..", "gh-toolkit", "bin", GH_TOOLKIT_NAME);
}

/**
 * Resolve how to invoke the Python toolkit, or say why it cannot be invoked.
 *
 * `prefixArgs` is what must precede the capability's own arguments — empty for an installed
 * `nexus-gh`, and the entry-point path when the interpreter is being driven directly.
 *
 * `fromSource` says where the toolkit ships inside a checkout; it is a parameter for the same
 * reason `env` is, so the "nothing is installed anywhere" case can be exercised.
 */
export function locateGhToolkit(
    env: NodeJS.ProcessEnv = process.env,
    fromSource: string = fromSourceEntryPoint(),
): GhToolkitLocation {
    for (const dir of pathEntries(env)) {
        const candidate: string = path.join(dir, GH_TOOLKIT_NAME);
        if (isExecutableFile(candidate)) {
            return { ok: true, command: candidate, prefixArgs: [] };
        }
    }
    if (fs.existsSync(fromSource)) {
        // `python3` is a stated prerequisite of Nexus alongside `node`, so it is named rather
        // than probed — and it is never a bare `python`.
        return { ok: true, command: "python3", prefixArgs: [fromSource] };
    }
    return {
        ok: false,
        message: `the Nexus Python toolkit \`${GH_TOOLKIT_NAME}\` is not installed — ${GH_TOOLKIT_REMEDY}`,
    };
}

/** The argv for one capability invocation, or the absent-toolkit message. */
export function ghToolkitCommand(
    capabilityArgs: string[],
    env: NodeJS.ProcessEnv = process.env,
    fromSource: string = fromSourceEntryPoint(),
): { ok: true; command: string; args: string[] } | { ok: false; message: string } {
    const located = locateGhToolkit(env, fromSource);
    if (!located.ok) return located;
    return { ok: true, command: located.command, args: [...located.prefixArgs, ...capabilityArgs] };
}
