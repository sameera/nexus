/**
 * Parity primitives (STORY-44.03). The in-repo TypeScript scripts are the single authoritative
 * source; the built `.mjs` is a derived build. This module supplies the check that the two behave
 * the same:
 *
 *   - `diffRunResults` / `diffAtlasBytes` / `formatDivergences` — the executed diff. Runs the
 *     source and a fresh bundle over the committed corpus and reports any mismatch in validator
 *     findings, exit codes, or atlas bytes, NAMING the divergence — entry point, corpus case,
 *     and a diff excerpt (Invariant 10).
 *
 * Node builtins only; this file is not a bundle entry point.
 */

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
        `Parity divergence — the built bundle diverged from the in-repo source (${divergences.length}):`,
        ...divergences.map(
            (d) => `  - [${d.entryPoint}] corpus case "${d.corpusCase}" (${d.kind}):\n    ${d.diffExcerpt.replace(/\n/g, "\n    ")}`,
        ),
    ].join("\n");
}
