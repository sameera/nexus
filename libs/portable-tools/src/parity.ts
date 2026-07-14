/**
 * Parity primitives (STORY-44.03). The in-repo TypeScript scripts are the single authoritative
 * source; the vendored `.mjs` is a derived build that can silently lag. This module supplies the
 * load-bearing check that makes that drift impossible to ship:
 *
 *   - `hashBundleCode` / `checkFingerprint` — the fingerprint pin. A source edit that isn't
 *     rebuilt-and-re-vendored changes the fresh build's hash, so it no longer equals the
 *     committed pin (decision-record Invariant 12). Both sides of a live source-vs-bundle diff
 *     are always current, so only the pin can catch vendored staleness.
 *   - `diffRunResults` / `diffAtlasBytes` / `formatDivergences` — the executed diff. Runs the
 *     source and a fresh bundle over the committed corpus and reports any mismatch in validator
 *     findings, exit codes, or atlas bytes, NAMING the divergence — entry point, corpus case,
 *     and a diff excerpt (Invariant 10).
 *
 * Node builtins only; this file is not a bundle entry point, so it is never itself vendored.
 */

import { createHash } from "node:crypto";

/** Maps each vendored bundle filename (`<entry>.mjs`) to the sha256 hex of its bytes. */
export type Fingerprint = Record<string, string>;

export function hashBundleCode(code: string): string {
    return createHash("sha256").update(code, "utf8").digest("hex");
}

const REVENDOR_HINT: string =
    "Rebuild and re-vendor: `pnpm nexus:vendor-tools --tools-dir <hub>/.nexus/tools` " +
    "(docs/features/multi-repo-workspaces/hub-tooling-install.md) rebuilds the bundle, updates " +
    "libs/portable-tools/bundle-fingerprint.json, and copies the matching artifact into the hub. " +
    "An esbuild version bump also changes the bundle bytes and must be followed by a re-vendor.";

/**
 * Compares a freshly built fingerprint against the committed pin. Returns null when every entry
 * matches; otherwise a message naming each stale / unpinned / orphaned bundle and pointing at the
 * rebuild + re-vendor procedure. The word "stale" appears whenever a pinned hash no longer matches
 * a fresh build — the "edited source but did not re-vendor" case.
 */
export function checkFingerprint(fresh: Fingerprint, pinned: Fingerprint): string | null {
    const problems: string[] = [];
    for (const name of Object.keys(fresh)) {
        if (!(name in pinned)) {
            problems.push(`${name}: no pin entry — the fingerprint pin does not cover this bundle`);
        } else if (pinned[name] !== fresh[name]) {
            problems.push(
                `${name}: STALE — the pin records ${pinned[name].slice(0, 12)}… but a fresh build ` +
                    `hashes ${fresh[name].slice(0, 12)}… (the vendored bundle no longer matches its source)`,
            );
        }
    }
    for (const name of Object.keys(pinned)) {
        if (!(name in fresh)) {
            problems.push(`${name}: pinned but no longer built — drop it from the pin`);
        }
    }
    if (problems.length === 0) {
        return null;
    }
    return [
        "Bundle fingerprint mismatch — the vendored bundle is stale relative to the in-repo source:",
        ...problems.map((p) => `  - ${p}`),
        REVENDOR_HINT,
    ].join("\n");
}

export interface RunResult {
    status: number;
    stdout: string;
    stderr: string;
}

export type DivergenceKind = "exit-code" | "stdout" | "stderr" | "atlas-bytes";

export interface Divergence {
    entryPoint: string;
    corpusCase: string;
    kind: DivergenceKind;
    diffExcerpt: string;
}

/** First line-level difference between two multi-line strings, as a short labelled excerpt. */
function firstLineDiff(source: string, bundle: string): string {
    const s: string[] = source.split("\n");
    const b: string[] = bundle.split("\n");
    const n: number = Math.max(s.length, b.length);
    for (let i = 0; i < n; i++) {
        if (s[i] !== b[i]) {
            return (
                `first difference at line ${i + 1}:\n` +
                `    source: ${JSON.stringify(s[i] ?? "<absent>")}\n` +
                `    bundle: ${JSON.stringify(b[i] ?? "<absent>")}`
            );
        }
    }
    return "(no line-level difference; the strings differ only in trailing content or length)";
}

/**
 * Compares a source run and a bundle run of one validator corpus case. Returns one Divergence per
 * differing facet (exit code, stdout, stderr); an empty array means the two are identical.
 */
export function diffRunResults(
    entryPoint: string,
    corpusCase: string,
    source: RunResult,
    bundle: RunResult,
): Divergence[] {
    const divergences: Divergence[] = [];
    if (source.status !== bundle.status) {
        divergences.push({
            entryPoint,
            corpusCase,
            kind: "exit-code",
            diffExcerpt: `source exited ${source.status}, bundle exited ${bundle.status}`,
        });
    }
    if (source.stdout !== bundle.stdout) {
        divergences.push({ entryPoint, corpusCase, kind: "stdout", diffExcerpt: firstLineDiff(source.stdout, bundle.stdout) });
    }
    if (source.stderr !== bundle.stderr) {
        divergences.push({ entryPoint, corpusCase, kind: "stderr", diffExcerpt: firstLineDiff(source.stderr, bundle.stderr) });
    }
    return divergences;
}

/** Byte-compares source and bundle atlas output. Returns null when identical (Invariant 3). */
export function diffAtlasBytes(
    entryPoint: string,
    corpusCase: string,
    source: string,
    bundle: string,
): Divergence | null {
    if (source === bundle) {
        return null;
    }
    return { entryPoint, corpusCase, kind: "atlas-bytes", diffExcerpt: firstLineDiff(source, bundle) };
}

/** Renders divergences into a failure message that names entry point, corpus case, and excerpt. */
export function formatDivergences(divergences: Divergence[]): string {
    if (divergences.length === 0) {
        return "";
    }
    return [
        `Parity divergence — the vendored bundle diverged from the in-repo source (${divergences.length}):`,
        ...divergences.map(
            (d) => `  - [${d.entryPoint}] corpus case "${d.corpusCase}" (${d.kind}):\n    ${d.diffExcerpt.replace(/\n/g, "\n    ")}`,
        ),
    ].join("\n");
}
