/**
 * The form a published asset is referenced in, decided by its file type and by nothing else
 * (epic #594, story #597; decision record #600, invariant 14).
 *
 * An image uses the repository's blob address with the raw flag, whether the store is public or
 * private: the blob form is served under the session a member already has, so it renders inline in
 * an issue that lives in another repository, and a store later made private does not break every
 * issue filed while it was public. Every other file — HTML included — is a link to the file at the
 * pinned commit. GitHub never renders HTML inside an issue, and no durable way to render it from a
 * private store was found at planning, so that is deferred to its own epic (#601). No visibility
 * branch exists here, and none may be added.
 */

import * as path from "node:path";
import { type PublishedAsset } from "./asset-publish.js";

export type AssetKind = "image" | "file";

/** The extensions GitHub renders inline from a blob address with the raw flag. */
export const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"]);

/** Whether a file name is an image, by extension, case-folded. */
export function assetKind(filename: string): AssetKind {
    const extension: string = path.extname(filename).slice(1).toLowerCase();
    return IMAGE_EXTENSIONS.has(extension) ? "image" : "file";
}

export interface AssetReference {
    kind: AssetKind;
    /** The address a reader opens: the blob address with the raw flag for an image, the blob address for a file. */
    url: string;
    /** The Markdown a body carries: an inline image, or a link, with the file name as its text. */
    markdown: string;
}

/** The reference for a published asset, with `label` as the image's alt text or the link's text. */
export function assetReference(asset: PublishedAsset, label: string = asset.filename): AssetReference {
    const kind: AssetKind = assetKind(asset.filename);
    if (kind === "image") {
        const url = `${asset.url}?raw=true`;
        return { kind, url, markdown: `![${label}](${url})` };
    }
    return { kind, url: asset.url, markdown: `[${label}](${asset.url})` };
}
