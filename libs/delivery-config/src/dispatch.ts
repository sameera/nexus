/**
 * Dispatch `argv` to a capability (story #355).
 *
 * The contract is frozen by the decision record's first invariant and is the one the Python
 * dispatcher kept: no arguments writes the usage text to stderr and exits 2, the help flag writes
 * it to stdout and exits 0, an unrecognised name emits its own message followed by the usage text
 * on stderr and exits 2, and a capability's own arguments reach it unmodified with its exit code
 * returned unchanged.
 */

import { type ToolkitIo } from "./io.js";
import { PROGRAM_NAME, capabilityListing, findCapability, usage } from "./registry.js";

export function runNexusGh(argv: string[], io: ToolkitIo): number {
    if (argv[0] === "--capabilities") {
        io.stdout(capabilityListing());
        return 0;
    }
    if (argv.length === 0) {
        io.stderr(usage());
        return 2;
    }
    if (argv[0] === "-h" || argv[0] === "--help") {
        io.stdout(usage());
        return 0;
    }
    const name: string = argv[0];
    const capability = findCapability(name);
    if (capability === undefined) {
        io.stderr(`${PROGRAM_NAME}: unknown capability '${name}'`);
        io.stderr(usage());
        return 2;
    }
    return capability.run(argv.slice(1), io);
}
