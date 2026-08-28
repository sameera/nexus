/**
 * The `version` capability: the release this toolkit is part of, as one JSON object (story #356).
 *
 * The value is read through the shared release-identity reader — the same one the `nexus`
 * executable's own version verb reads through — so the two names cannot report different versions.
 * There is no literal here and no default: an unresolved declaration is reported as null, because
 * a fabricated version in a writer stamp is worse than an absent one, which a reader already
 * treats as "written by an unknown toolkit".
 */

import { releaseVersion } from "@nexus/release-identity/release";
import { type ToolkitIo } from "./io.js";
import { programName } from "./registry.js";

const CAPABILITY = "version";

export function versionUsage(): string {
    return [
        `usage: ${programName(CAPABILITY)}`,
        "",
        "Print the release this toolkit is part of, as one JSON object.",
    ].join("\n");
}

export function runVersion(
    args: string[],
    io: ToolkitIo,
    readVersion: () => string | null = releaseVersion,
): number {
    if (args[0] === "-h" || args[0] === "--help") {
        io.stdout(versionUsage());
        return 0;
    }
    if (args.length > 0) {
        io.stderr(versionUsage());
        io.stderr(`${programName(CAPABILITY)}: unexpected argument '${args[0]}'`);
        return 2;
    }
    io.stdout(JSON.stringify({ version: readVersion() }));
    return 0;
}
