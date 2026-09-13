/**
 * The two steps a filing stage runs around its approval gate (epic #594, story #598; decision
 * record #600).
 *
 * Before the draft: the asset list is checked — every path exists, no two share a file name — the
 * store is resolved and its visibility read once. After approval, on the derived filing body: every
 * asset a body references is published, in the order the lead declared them, and each local path is
 * replaced with the reference its reader can render. A declared file no body mentions is reported
 * and not written, because the store is never pruned. The publish is the first side effect after the
 * gate, and every asset is published before the first body is rewritten, so a permission failure
 * costs orphan files and no half-rewritten body.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { publishAsset, type PublishedAsset, type PublishResult } from "./asset-publish.js";
import { type AssetKind, type AssetReference, assetKind, assetReference } from "./asset-reference.js";
import { type AssetStore } from "./asset-store.js";
import { type GhRunner } from "./gh.js";

export interface DeclaredAsset {
    /** The path exactly as the lead declared it — the token a body carries and the rewrite matches. */
    declared: string;
    /** The absolute local path. */
    file: string;
    filename: string;
    kind: AssetKind;
}

export type AssetListCheck =
    | { ok: true; assets: DeclaredAsset[] }
    | { ok: false; problem: "missing-asset" | "duplicate-filename"; message: string };

/** Check the declared list: every path exists, and no two assets share a file name (invariant 11). */
export function checkAssetList(declared: string[], cwd: string): AssetListCheck {
    const assets: DeclaredAsset[] = [];
    const missing: string[] = [];
    for (const token of declared) {
        const file: string = path.resolve(cwd, token);
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
            missing.push(token);
            continue;
        }
        const filename: string = path.basename(file);
        assets.push({ declared: token, file, filename, kind: assetKind(filename) });
    }
    if (missing.length > 0) {
        return { ok: false, problem: "missing-asset", message: `asset path not found: ${missing.join(", ")}` };
    }
    const byName: Map<string, string[]> = new Map();
    for (const asset of assets) byName.set(asset.filename, [...(byName.get(asset.filename) ?? []), asset.declared]);
    const clashes: string[] = [...byName.entries()]
        .filter(([, paths]) => paths.length > 1)
        .map(([name, paths]) => `${name} (${paths.join(", ")})`);
    if (clashes.length > 0) {
        return {
            ok: false,
            problem: "duplicate-filename",
            message: `two assets in one run may not share a file name: ${clashes.join("; ")}`,
        };
    }
    return { ok: true, assets };
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The declared path as a whole token: not preceded or followed by another path character, so
 * `assets/flow.png` does not match inside `features/issue-assets/flow.png` — which is exactly what
 * the published address of that very asset looks like. The razor's survivor check keeps the same
 * boundary.
 */
export function declaredPathPattern(declared: string): RegExp {
    return new RegExp(`(?<![A-Za-z0-9_./~-])${escapeRegExp(declared)}(?![A-Za-z0-9_./-])`, "g");
}

/** Whether `body` refers to the asset by its declared path, matched exactly and as a whole token. */
export function bodyReferences(body: string, asset: DeclaredAsset): boolean {
    return declaredPathPattern(asset.declared).test(body);
}

/**
 * Replace every occurrence of the asset's declared path in `body` with its published reference.
 *
 * A path already sitting in a Markdown image or link target keeps its own alt text or link text and
 * gets the type-decided address; a path standing bare in prose becomes the whole reference, so the
 * reader still gets an inline image or a link rather than a dead address.
 */
export function rewriteAssetPath(body: string, asset: DeclaredAsset, reference: AssetReference): string {
    const target: RegExp = new RegExp(`(!?\\[[^\\]\\n]*\\])\\(${escapeRegExp(asset.declared)}\\)`, "g");
    const inTargets: string = body.replace(target, `$1(${reference.url})`);
    return inTargets.replace(declaredPathPattern(asset.declared), reference.markdown);
}

export interface RewriteRequest {
    /** The derived filing bodies to rewrite, as file paths. */
    bodies: string[];
    assets: DeclaredAsset[];
    feature: string;
    store: AssetStore;
    sizeCap: number;
    run: GhRunner;
}

export interface PublishedReference {
    declared: string;
    kind: AssetKind;
    path: string;
    commit: string;
    url: string;
}

export interface RewriteSummary {
    published: PublishedReference[];
    /** Declared assets no body mentions — reported, never written. */
    unreferenced: string[];
    /** The body files whose text changed. */
    rewritten: string[];
}

export type RewriteOutcome =
    | { ok: true; summary: RewriteSummary }
    | { ok: false; problem: "unreadable-body" | "publish"; message: string; summary: RewriteSummary };

/** Publish every referenced asset, then rewrite the bodies. Publishes nothing a body does not mention. */
export function publishAndRewrite(request: RewriteRequest): RewriteOutcome {
    const summary: RewriteSummary = { published: [], unreferenced: [], rewritten: [] };
    const texts: Map<string, string> = new Map();
    for (const body of request.bodies) {
        try {
            texts.set(body, fs.readFileSync(body, "utf8"));
        } catch {
            return { ok: false, problem: "unreadable-body", message: `cannot read body ${body}`, summary };
        }
    }
    const referenced: DeclaredAsset[] = [];
    for (const asset of request.assets) {
        if ([...texts.values()].some((text) => bodyReferences(text, asset))) referenced.push(asset);
        else summary.unreferenced.push(asset.declared);
    }

    const references: Map<string, AssetReference> = new Map();
    for (const asset of referenced) {
        const result: PublishResult = publishAsset({
            file: asset.file,
            feature: request.feature,
            store: request.store,
            sizeCap: request.sizeCap,
            run: request.run,
        });
        if (!result.ok) return { ok: false, problem: "publish", message: result.message, summary };
        const published: PublishedAsset = result.asset;
        const reference: AssetReference = assetReference(published);
        references.set(asset.declared, reference);
        summary.published.push({
            declared: asset.declared,
            kind: reference.kind,
            path: published.path,
            commit: published.commit,
            url: reference.url,
        });
    }

    for (const [body, original] of texts) {
        let next: string = original;
        for (const asset of referenced) next = rewriteAssetPath(next, asset, references.get(asset.declared) as AssetReference);
        if (next === original) continue;
        fs.writeFileSync(body, next);
        summary.rewritten.push(body);
    }
    return { ok: true, summary };
}
