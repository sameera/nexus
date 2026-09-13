/**
 * The `assets` capability — the asset store as a command line (epic #594).
 *
 * A filing stage obtains the store, publishes a file and rewrites a body by asking here, never by
 * parsing settings or addressing the store itself (decision record #600, invariants 7 and 8).
 */

import * as path from "node:path";
import { type AssetStoreResolution, resolveAssetStore } from "./asset-store.js";
import { type ToolkitIo } from "./io.js";

const PROGRAM = "nexus assets";

/** The subverbs this capability dispatches; the executable's registry reads the same list. */
export const ASSETS_SUBVERBS: readonly string[] = ["resolve"];

export function assetsUsage(): string {
    return [
        `usage: ${PROGRAM} <command> [args...]`,
        "",
        "commands:",
        "  resolve [--root <path>]   Print the declared asset store as JSON, or { state: unsupported }.",
    ].join("\n");
}

/** One `--flag value` pair pulled off an argument vector, with the rest kept in order. */
function takeOption(args: string[], flag: string): { value: string | null; rest: string[] } {
    const at: number = args.indexOf(flag);
    if (at === -1) return { value: null, rest: args };
    return { value: args[at + 1] ?? "", rest: [...args.slice(0, at), ...args.slice(at + 2)] };
}

function usageError(io: ToolkitIo, message: string): number {
    io.stderr(assetsUsage());
    io.stderr(`${PROGRAM}: ${message}`);
    return 2;
}

/** The JSON a declared or unsupported store prints — one shape every stage reads. */
export function renderResolution(resolution: AssetStoreResolution): string {
    if (resolution.kind === "declared") {
        return JSON.stringify({ state: "declared", repo: resolution.store.repo, branch: resolution.store.branch });
    }
    return JSON.stringify({ state: "unsupported" });
}

/** `assets resolve [--root <path>]` — the one resolution step, as a command. */
export function runAssetsResolve(args: string[], io: ToolkitIo): number {
    const { value: root, rest } = takeOption(args, "--root");
    if (rest.length > 0) return usageError(io, `resolve: unexpected argument '${rest[0]}'`);
    const resolution: AssetStoreResolution = resolveAssetStore(path.resolve(io.cwd, root ?? "."));
    if (resolution.kind === "malformed") {
        io.stderr(`assets malformed-store: ${resolution.message}`);
        return 1;
    }
    io.stdout(renderResolution(resolution));
    return 0;
}

export const ASSETS_COMMANDS: Record<string, (args: string[], io: ToolkitIo) => number> = {
    resolve: runAssetsResolve,
};

export function runAssets(args: string[], io: ToolkitIo): number {
    if (args.length === 0) return usageError(io, "a command is required");
    if (args[0] === "-h" || args[0] === "--help") {
        io.stdout(assetsUsage());
        return 0;
    }
    const command = ASSETS_COMMANDS[args[0]];
    if (command === undefined) return usageError(io, `unknown command '${args[0]}'`);
    return command(args.slice(1), io);
}
