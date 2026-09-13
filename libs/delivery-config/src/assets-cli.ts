/**
 * The `assets` capability — the asset store as a command line (epic #594).
 *
 * A filing stage obtains the store, publishes a file and rewrites a body by asking here, never by
 * parsing settings or addressing the store itself (decision record #600, invariants 7 and 8).
 */

import * as path from "node:path";
import { publishAsset, type PublishResult } from "./asset-publish.js";
import {
    type AssetSizeCapResolution,
    type AssetStore,
    type AssetStoreResolution,
    resolveAssetSizeCap,
    resolveAssetStore,
} from "./asset-store.js";
import { cliGhRunner } from "./config-cli.js";
import { type GhRunner } from "./gh.js";
import { type ToolkitIo } from "./io.js";

const PROGRAM = "nexus assets";

/** The subverbs this capability dispatches; the executable's registry reads the same list. */
export const ASSETS_SUBVERBS: readonly string[] = ["resolve", "publish"];

export function assetsUsage(): string {
    return [
        `usage: ${PROGRAM} <command> [args...]`,
        "",
        "commands:",
        "  resolve [--root <path>]   Print the declared asset store as JSON, or { state: unsupported }.",
        "  publish --file <path> --feature <slug> [--root <path>] [--json]",
        "                            Publish one local file under features/<slug>/ in the store and print",
        "                            the reference pinned to the commit the publish created.",
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

/** The message every path that finds no store reports; nothing is written when it is printed. */
export const UNSUPPORTED_MESSAGE = "assets are unsupported for this repository: no asset-store is declared";

/**
 * The declared store, or the exit code after reporting why there is none. Shared by every subverb
 * that needs a location, so "no store" and "malformed store" read the same everywhere.
 */
function requireStore(root: string, io: ToolkitIo): AssetStore | number {
    const resolution: AssetStoreResolution = resolveAssetStore(root);
    if (resolution.kind === "malformed") {
        io.stderr(`assets malformed-store: ${resolution.message}`);
        return 1;
    }
    if (resolution.kind === "unsupported") {
        io.stderr(`assets unsupported: ${UNSUPPORTED_MESSAGE}`);
        return 1;
    }
    return resolution.store;
}

function requireSizeCap(root: string, io: ToolkitIo): number | null {
    const cap: AssetSizeCapResolution = resolveAssetSizeCap(root);
    if (cap.kind === "malformed") {
        io.stderr(`assets malformed-size-cap: ${cap.message}`);
        return null;
    }
    return cap.bytes;
}

/** `assets publish --file <path> --feature <slug> [--root <path>] [--json]` — one file in, one reference out. */
export function runAssetsPublish(args: string[], io: ToolkitIo, run: GhRunner = cliGhRunner): number {
    const { value: root, rest: afterRoot } = takeOption(args, "--root");
    const { value: file, rest: afterFile } = takeOption(afterRoot, "--file");
    const { value: feature, rest: afterFeature } = takeOption(afterFile, "--feature");
    const json: boolean = afterFeature.includes("--json");
    const rest: string[] = afterFeature.filter((arg) => arg !== "--json");
    if (rest.length > 0) return usageError(io, `publish: unexpected argument '${rest[0]}'`);
    if (!file) return usageError(io, "publish requires --file <path>");
    if (!feature || !/^[a-z0-9][a-z0-9-]*$/.test(feature)) {
        return usageError(io, "publish requires --feature <slug> (lower-case letters, digits and hyphens)");
    }
    const resolvedRoot: string = path.resolve(io.cwd, root ?? ".");
    const store: AssetStore | number = requireStore(resolvedRoot, io);
    if (typeof store === "number") return store;
    const sizeCap: number | null = requireSizeCap(resolvedRoot, io);
    if (sizeCap === null) return 1;

    const result: PublishResult = publishAsset({ file: path.resolve(io.cwd, file), feature, store, sizeCap, run });
    if (!result.ok) {
        io.stderr(`assets ${result.problem}: ${result.message}`);
        return 1;
    }
    io.stdout(json ? JSON.stringify(result.asset) : result.asset.url);
    return 0;
}

export const ASSETS_COMMANDS: Record<string, (args: string[], io: ToolkitIo, run: GhRunner) => number> = {
    resolve: runAssetsResolve,
    publish: runAssetsPublish,
};

export function runAssets(args: string[], io: ToolkitIo, run: GhRunner = cliGhRunner): number {
    if (args.length === 0) return usageError(io, "a command is required");
    if (args[0] === "-h" || args[0] === "--help") {
        io.stdout(assetsUsage());
        return 0;
    }
    const command = ASSETS_COMMANDS[args[0]];
    if (command === undefined) return usageError(io, `unknown command '${args[0]}'`);
    return command(args.slice(1), io, run);
}
