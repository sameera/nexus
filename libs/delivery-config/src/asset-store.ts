/**
 * The one store-resolution step every stage obtains the asset store through (epic #594, story #595;
 * decision record #600, "One resolution step returns one of three answers").
 *
 * The generic resolver prints declared strings and knows no per-key shape. Teaching it the store's
 * shape would turn it into a schema engine, so the shape check lives here, once: a stage receives a
 * usable location, learns that assets are unsupported, or is stopped by a named malformed value.
 * No stage parses the settings value itself.
 */

import { resolvePublishingKey } from "./resolve.js";

/** The github-block key the store is declared under. */
export const ASSET_STORE_KEY = "asset-store";

/** A declared, well-formed asset store. */
export interface AssetStore {
    owner: string;
    name: string;
    /** `owner/name` — the repository the store lives in. */
    repo: string;
    /** The branch files are written to, or null for the store's default branch. */
    branch: string | null;
}

export type AssetStoreResolution =
    | { kind: "declared"; store: AssetStore }
    /** No layer declares a store: assets are unsupported, and there is no default location. */
    | { kind: "unsupported" }
    /** A store is declared but is not `owner/repo` or `owner/repo@branch`. The run stops on it. */
    | { kind: "malformed"; value: string; message: string };

/** One GitHub owner or repository name segment: no slash, no whitespace, no `@`. */
const SEGMENT = "[A-Za-z0-9_.-]+";
const STORE_FORM: RegExp = new RegExp(`^(${SEGMENT})/(${SEGMENT})(?:@(\\S+))?$`);

/** Strip one matched pair of surrounding quotes — the settings reader keeps quotes verbatim. */
function unquote(value: string): string {
    const trimmed: string = value.trim();
    const quoted: RegExpExecArray | null = /^(["'])(.*)\1$/.exec(trimmed);
    return quoted ? quoted[2].trim() : trimmed;
}

/** Parse a declared store value, or null when it is not in the accepted form. */
export function parseAssetStore(value: string): AssetStore | null {
    const match: RegExpExecArray | null = STORE_FORM.exec(unquote(value));
    if (match === null) return null;
    const [, owner, name, branch] = match;
    return { owner, name, repo: `${owner}/${name}`, branch: branch ?? null };
}

/** The message a malformed value is stopped with — it names the value, so the fix is findable. */
export function malformedStoreMessage(value: string): string {
    return `${ASSET_STORE_KEY} '${value}' is not in the form owner/repo or owner/repo@branch`;
}

/**
 * Resolve the asset store declared at (or above) `start`, through the same precedence chain and
 * hub layer every other publishing target uses.
 */
export function resolveAssetStore(start: string): AssetStoreResolution {
    const declared: string = resolvePublishingKey(start, ASSET_STORE_KEY);
    if (declared === "") return { kind: "unsupported" };
    const store: AssetStore | null = parseAssetStore(declared);
    if (store === null) return { kind: "malformed", value: declared, message: malformedStoreMessage(declared) };
    return { kind: "declared", store };
}
