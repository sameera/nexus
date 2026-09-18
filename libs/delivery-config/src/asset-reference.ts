/**
 * The form a published asset is referenced in, decided by its file type and by the renderer template
 * the team configured — and by nothing else (epic #594, story #597; epic #613, story #621).
 *
 * An image uses the repository's blob address with the raw flag: the blob form is served under the
 * session a member already has, so it renders inline in an issue that lives in another repository.
 * An HTML file is referenced through the configured renderer template, with the asset's pinned
 * address substituted verbatim into its one slot, so a reviewer opens the mockup as a page rather
 * than reading its markup. With no template configured — and for every other file — the reference is
 * a link to the file at the pinned commit, exactly as it was before epic #613.
 *
 * The branch on the template is a configuration branch. The store's visibility never reaches this
 * module, and none of it may be added: a test over this file's own source is the guard
 * (decision record #627, invariant 1).
 */

import * as path from "node:path";
import { type PublishedAsset } from "./asset-publish.js";
import { RENDERER_SLOT } from "./asset-store.js";

export type AssetKind = "image" | "file";

/** The extensions GitHub renders inline from a blob address with the raw flag. */
export const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"]);

/** The extensions a configured renderer is handed. Named for HTML pages, so HTML pages alone. */
export const HTML_EXTENSIONS: ReadonlySet<string> = new Set(["html", "htm"]);

/** A file name's extension, case-folded, without its dot. */
function extension(filename: string): string {
    return path.extname(filename).slice(1).toLowerCase();
}

/** Whether a file name is an image, by extension, case-folded. */
export function assetKind(filename: string): AssetKind {
    return IMAGE_EXTENSIONS.has(extension(filename)) ? "image" : "file";
}

/** Whether a file name is an HTML page, by extension, case-folded. */
export function isHtmlAsset(filename: string): boolean {
    return HTML_EXTENSIONS.has(extension(filename));
}

export interface AssetReference {
    kind: AssetKind;
    /** The address a reader opens: the raw-flag blob address, the renderer's address, or the blob address. */
    url: string;
    /** The Markdown a body carries: an inline image, or a link, with the file name as its text. */
    markdown: string;
}

/**
 * The reference for a published asset.
 *
 * `renderer` is the configured HTML renderer template, or null when the team configured none; the
 * caller resolves it and hands it in, because this module reads no setting of its own. `label` is
 * the image's alt text or the link's text.
 */
export function assetReference(asset: PublishedAsset, renderer: string | null, label: string = asset.filename): AssetReference {
    const kind: AssetKind = assetKind(asset.filename);
    if (kind === "image") {
        const url = `${asset.url}?raw=true`;
        return { kind, url, markdown: `![${label}](${url})` };
    }
    if (renderer !== null && isHtmlAsset(asset.filename)) {
        const url: string = renderer.split(RENDERER_SLOT).join(asset.url);
        return { kind, url, markdown: `[${label}](${url})` };
    }
    return { kind, url: asset.url, markdown: `[${label}](${asset.url})` };
}
