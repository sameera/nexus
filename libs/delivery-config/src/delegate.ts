/**
 * Delegation to the retained Python entry point (decision record #362, D2/Invariant 3).
 *
 * The two filers keep their Python implementation until epics #352 and #353 port them, and they
 * are reached by running the *entry point* — never a module inside it. Running the entry preserves
 * three things for free: the program name the filers report in their own usage and error text,
 * their two different ways of signalling failure, and that entry's own suppression of byte-code
 * writing, which is what keeps a pipeline stage from dropping `__pycache__` into the repository it
 * ran against.
 *
 * Output is inherited rather than captured, so a filer's progress appears as it happens and its
 * exit code is forwarded unchanged.
 */

import { spawnSync } from "node:child_process";
import { type ToolkitIo } from "./io.js";
import { PYTHON_INTERPRETER, pythonEntryPoint } from "./python-entry.js";

/** The process seam: run a command with its output inherited and return its exit code. */
export type Delegator = (command: string, args: string[]) => number;

export const defaultDelegator: Delegator = (command, args) => {
    const result = spawnSync(command, args, { stdio: "inherit" });
    return result.status ?? 1;
};

/**
 * Run one capability through the retained Python entry point and return its exit code.
 *
 * An absent entry point is reported rather than raised: a release always carries it, so its
 * absence means a broken installation and the message says so instead of surfacing a spawn error.
 */
export function delegateToPython(
    name: string,
    args: string[],
    io: ToolkitIo,
    delegator: Delegator = defaultDelegator,
    entry: string | null = pythonEntryPoint(),
): number {
    if (entry === null) {
        io.stderr(`nexus-gh: cannot reach the '${name}' capability — the Nexus installation is incomplete`);
        return 2;
    }
    return delegator(PYTHON_INTERPRETER, [entry, name, ...args]);
}
