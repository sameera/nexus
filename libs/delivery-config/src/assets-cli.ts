/**
 * The `assets` capability — the asset store as a command line (epic #594).
 *
 * A filing stage obtains the store, publishes a file and rewrites a body by asking here, never by
 * parsing settings or addressing the store itself (decision record #600, invariants 7 and 8).
 */

import * as path from "node:path";
import { publishAsset, type PublishResult } from "./asset-publish.js";
import { type AssetReference, assetReference, isHtmlAsset } from "./asset-reference.js";
import { type AssetListCheck, checkAssetList, publishAndRewrite, type RewriteOutcome } from "./asset-rewrite.js";
import {
    ASSET_RENDERER_KEY,
    type AssetRendererResolution,
    type AssetSizeCapResolution,
    type AssetStore,
    type AssetStoreResolution,
    resolveAssetRenderer,
    resolveAssetSizeCap,
    resolveAssetStore,
} from "./asset-store.js";
import { cliGhRunner } from "./config-cli.js";
import { type GhRunner } from "./gh.js";
import { type ToolkitIo } from "./io.js";

const PROGRAM = "nexus assets";

/** The subverbs this capability dispatches; the executable's registry reads the same list. */
export const ASSETS_SUBVERBS: readonly string[] = ["resolve", "publish", "visibility", "check", "rewrite"];

export function assetsUsage(): string {
    return [
        `usage: ${PROGRAM} <command> [args...]`,
        "",
        "commands:",
        "  resolve [--root <path>]   Print the declared asset store as JSON, or { state: unsupported }.",
        "  publish --file <path> --feature <slug> [--root <path>] [--json]",
        "                            Publish one local file under features/<slug>/ in the store and print",
        "                            the reference pinned to the commit the publish created, in the form",
        "                            its reader renders: an image inline (raw flag), any other file a link.",
        "  visibility [--root <path>] Read the store's visibility from GitHub once: prints public or private.",
        "  check --asset <path>... [--root <path>]",
        "                            The intake step: every path exists, no two share a file name, the store",
        "                            resolves and its visibility is read once. Prints one JSON object.",
        "  rewrite --body <file>... --asset <path>... --feature <slug> [--root <path>]",
        "                            After approval: publish every asset a body references, in declared order,",
        "                            and replace each local path with its rendered reference. Prints a summary.",
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

/**
 * The configured HTML renderer template, or null when the team configured none. A declared template
 * that cannot work stops the run by name — at intake, before any draft exists (epic #613).
 */
function requireRenderer(root: string, io: ToolkitIo): { template: string | null } | null {
    const resolution: AssetRendererResolution = resolveAssetRenderer(root);
    if (resolution.kind === "malformed") {
        io.stderr(`assets malformed-renderer: ${resolution.message}`);
        return null;
    }
    return { template: resolution.kind === "declared" ? resolution.template : null };
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
    const renderer = requireRenderer(resolvedRoot, io);
    if (renderer === null) return 1;

    const result: PublishResult = publishAsset({ file: path.resolve(io.cwd, file), feature, store, sizeCap, run });
    if (!result.ok) {
        io.stderr(`assets ${result.problem}: ${result.message}`);
        return 1;
    }
    const reference: AssetReference = assetReference(result.asset, renderer.template);
    io.stdout(json ? JSON.stringify({ ...result.asset, ...reference }) : reference.url);
    return 0;
}

/** What GitHub says about the store: public, or private (an internal repository counts as private). */
export type StoreVisibility = "public" | "private";

export type VisibilityResult = { ok: true; visibility: StoreVisibility } | { ok: false; message: string };

/**
 * Read the store's visibility from GitHub. Read once per run, at intake; it feeds the approval
 * digest and nothing else — it never selects a reference form (invariant 13). The read doubles as
 * the existence-and-access probe: a store that cannot be read is named and stops the run.
 */
export function readStoreVisibility(store: AssetStore, run: GhRunner): VisibilityResult {
    const result = run(["repo", "view", store.repo, "--json", "isPrivate", "--jq", ".isPrivate"]);
    if (result.status !== 0) {
        return { ok: false, message: `asset store ${store.repo} cannot be read: ${result.stderr.trim()}` };
    }
    const answer: string = result.stdout.trim();
    if (answer !== "true" && answer !== "false") {
        return { ok: false, message: `asset store ${store.repo} cannot be read: unexpected answer '${answer}'` };
    }
    return { ok: true, visibility: answer === "true" ? "private" : "public" };
}

/** `assets visibility [--root <path>]` — prints `public` or `private`; stops when the store cannot be read. */
export function runAssetsVisibility(args: string[], io: ToolkitIo, run: GhRunner = cliGhRunner): number {
    const { value: root, rest } = takeOption(args, "--root");
    if (rest.length > 0) return usageError(io, `visibility: unexpected argument '${rest[0]}'`);
    const store: AssetStore | number = requireStore(path.resolve(io.cwd, root ?? "."), io);
    if (typeof store === "number") return store;
    const result: VisibilityResult = readStoreVisibility(store, run);
    if (!result.ok) {
        io.stderr(`assets store-unreadable: ${result.message}`);
        return 1;
    }
    io.stdout(result.visibility);
    return 0;
}

/** Every value of a repeatable `--flag value` option, with the rest kept in order. */
function takeAll(args: string[], flag: string): { values: string[]; rest: string[] } {
    const values: string[] = [];
    const rest: string[] = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === flag) {
            if (args[i + 1] !== undefined) values.push(args[++i]);
        } else rest.push(args[i]);
    }
    return { values, rest };
}

/**
 * `assets check --asset <path>... [--root <path>]` — the intake step, before the draft is written.
 *
 * Stops (exit 1) on a missing path, two assets sharing a file name, a malformed store, or a store
 * GitHub cannot read. Prints `{ state: "unsupported", assets }` when no store is declared — the
 * stage then drafts without asset references — or `{ state: "declared", repo, branch, visibility,
 * assets }`. Publishes nothing.
 */
export function runAssetsCheck(args: string[], io: ToolkitIo, run: GhRunner = cliGhRunner): number {
    const { value: root, rest: afterRoot } = takeOption(args, "--root");
    const { values: declared, rest } = takeAll(afterRoot, "--asset");
    if (rest.length > 0) return usageError(io, `check: unexpected argument '${rest[0]}'`);
    if (declared.length === 0) return usageError(io, "check requires at least one --asset <path>");
    const list: AssetListCheck = checkAssetList(declared, io.cwd);
    if (!list.ok) {
        io.stderr(`assets ${list.problem}: ${list.message}`);
        return 1;
    }
    const assets = list.assets.map((asset) => ({ path: asset.declared, filename: asset.filename, kind: asset.kind }));
    const resolvedRoot: string = path.resolve(io.cwd, root ?? ".");
    const renderer = requireRenderer(resolvedRoot, io);
    if (renderer === null) return 1;
    const resolution: AssetStoreResolution = resolveAssetStore(resolvedRoot);
    if (resolution.kind === "malformed") {
        io.stderr(`assets malformed-store: ${resolution.message}`);
        return 1;
    }
    if (resolution.kind === "unsupported") {
        io.stderr(`assets unsupported: ${UNSUPPORTED_MESSAGE}`);
        io.stdout(JSON.stringify({ state: "unsupported", renderer: renderer.template, assets }));
        return 0;
    }
    const visibility: VisibilityResult = readStoreVisibility(resolution.store, run);
    if (!visibility.ok) {
        io.stderr(`assets store-unreadable: ${visibility.message}`);
        return 1;
    }
    if (visibility.visibility === "private" && renderer.template !== null) {
        io.stderr(
            `assets renderer-private-store: the store ${resolution.store.repo} is private, so a renderer cannot read it ` +
                "until epic #614 lands — filing continues, and an HTML reference filed now may not resolve for a reviewer",
        );
    }
    io.stdout(
        JSON.stringify({
            state: "declared",
            repo: resolution.store.repo,
            branch: resolution.store.branch,
            visibility: visibility.visibility,
            renderer: renderer.template,
            assets,
        }),
    );
    return 0;
}

/**
 * `assets rewrite --body <file>... --asset <path>... --feature <slug> [--root <path>]` — the
 * post-approval step, on the derived filing body and before the clean-body assertion.
 */
export function runAssetsRewrite(args: string[], io: ToolkitIo, run: GhRunner = cliGhRunner): number {
    const { value: root, rest: afterRoot } = takeOption(args, "--root");
    const { value: feature, rest: afterFeature } = takeOption(afterRoot, "--feature");
    const { values: bodies, rest: afterBodies } = takeAll(afterFeature, "--body");
    const { values: declared, rest } = takeAll(afterBodies, "--asset");
    if (rest.length > 0) return usageError(io, `rewrite: unexpected argument '${rest[0]}'`);
    if (bodies.length === 0) return usageError(io, "rewrite requires at least one --body <file>");
    if (declared.length === 0) return usageError(io, "rewrite requires at least one --asset <path>");
    if (!feature || !/^[a-z0-9][a-z0-9-]*$/.test(feature)) {
        return usageError(io, "rewrite requires --feature <slug> (lower-case letters, digits and hyphens)");
    }
    const list: AssetListCheck = checkAssetList(declared, io.cwd);
    if (!list.ok) {
        io.stderr(`assets ${list.problem}: ${list.message}`);
        return 1;
    }
    const resolvedRoot: string = path.resolve(io.cwd, root ?? ".");
    const store: AssetStore | number = requireStore(resolvedRoot, io);
    if (typeof store === "number") return store;
    const sizeCap: number | null = requireSizeCap(resolvedRoot, io);
    if (sizeCap === null) return 1;
    const renderer = requireRenderer(resolvedRoot, io);
    if (renderer === null) return 1;
    const outcome: RewriteOutcome = publishAndRewrite({
        bodies: bodies.map((body) => path.resolve(io.cwd, body)),
        assets: list.assets,
        feature,
        store,
        sizeCap,
        renderer: renderer.template,
        run,
    });
    if (!outcome.ok) {
        io.stderr(`assets ${outcome.problem}: ${outcome.message}`);
        if (outcome.summary.published.length > 0) {
            io.stderr(`  already published, harmless and unreferenced: ${outcome.summary.published.map((p) => p.path).join(", ")}`);
        }
        return 1;
    }
    const html: string[] = outcome.summary.published.filter((entry) => isHtmlAsset(entry.path)).map((entry) => path.basename(entry.path));
    if (html.length > 0) {
        io.stderr(
            renderer.template === null
                ? `assets renderer-absent: no ${ASSET_RENDERER_KEY} is configured — the plain link was filed for: ${html.join(", ")}`
                : `assets renderer: HTML references were built from ${ASSET_RENDERER_KEY} '${renderer.template}' for: ${html.join(", ")}`,
        );
    }
    for (const unreferenced of outcome.summary.unreferenced) {
        io.stderr(`assets unreferenced: ${unreferenced} is declared but no body mentions it — not published`);
    }
    io.stdout(JSON.stringify(outcome.summary));
    return 0;
}

export const ASSETS_COMMANDS: Record<string, (args: string[], io: ToolkitIo, run: GhRunner) => number> = {
    resolve: runAssetsResolve,
    publish: runAssetsPublish,
    visibility: runAssetsVisibility,
    check: runAssetsCheck,
    rewrite: runAssetsRewrite,
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
