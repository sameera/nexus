/**
 * The `config` capability — the shared delivery-configuration resolver, as a command line.
 *
 * The non-library consumers (a pipeline stage, a person at a shell) obtain a resolved value by
 * asking for it here, never by parsing settings themselves, so four consumers cannot disagree
 * about what a repository declared.
 *
 * Argument parsing is hand-rolled in the shape the executable already uses (D9): the contract to
 * preserve is the flags, the exit codes and the message content the acceptance criteria state — not
 * the incidental wording a parsing framework happens to generate.
 */

import * as path from "node:path";
import { delegateToPython } from "./delegate.js";
import { type ToolkitIo } from "./io.js";
import { resolvePublishingKey } from "./resolve.js";
import { programName } from "./registry.js";

const CAPABILITY = "config";

/** One `--flag value` pair pulled off an argument vector, with the rest kept in order. */
export function takeOption(args: string[], flag: string): { value: string | null; rest: string[] } {
    const at: number = args.indexOf(flag);
    if (at === -1) return { value: null, rest: args };
    return { value: args[at + 1] ?? "", rest: [...args.slice(0, at), ...args.slice(at + 2)] };
}

export function configUsage(): string {
    return [
        `usage: ${programName(CAPABILITY)} <command> [args...]`,
        "",
        "commands:",
        "  resolve <key> [--root <path>]   Resolve one github-block key through the precedence chain.",
        "",
        `Run \`${programName(CAPABILITY)} <command> --help\` for a command's own arguments.`,
    ].join("\n");
}

function usageError(io: ToolkitIo, message: string): number {
    io.stderr(configUsage());
    io.stderr(`${programName(CAPABILITY)}: ${message}`);
    return 2;
}

/** `config resolve <key> [--root <path>]` — print the resolved value, or an empty line. */
export function runConfigResolve(args: string[], io: ToolkitIo): number {
    const { value: root, rest } = takeOption(args, "--root");
    if (rest.length === 0) return usageError(io, "resolve requires a github-block key");
    if (rest.length > 1) return usageError(io, `resolve: unexpected argument '${rest[1]}'`);
    io.stdout(resolvePublishingKey(path.resolve(io.cwd, root ?? "."), rest[0]));
    return 0;
}

/** The commands this toolkit answers in process. Anything else is still the interpreter's. */
export const CONFIG_COMMANDS: Record<string, (args: string[], io: ToolkitIo) => number> = {
    resolve: runConfigResolve,
};

export function runConfig(args: string[], io: ToolkitIo): number {
    if (args.length === 0) return usageError(io, "a command is required");
    if (args[0] === "-h" || args[0] === "--help") {
        io.stdout(configUsage());
        return 0;
    }
    const command = CONFIG_COMMANDS[args[0]];
    if (command === undefined) {
        // Not ported yet: the remaining commands land in stories #359, #360 and #361, and until
        // they do they are still answered by the retained Python entry point.
        return delegateToPython(CAPABILITY, args, io);
    }
    return command(args.slice(1), io);
}
