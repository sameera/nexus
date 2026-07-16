/**
 * Shared esbuild bundling primitive: compiles a single TypeScript entry point into a
 * self-contained ESM bundle targeting the repo's Node floor. Every non-builtin import is
 * inlined; only Node builtins are left external (esbuild's automatic behavior under
 * platform: "node"). Reused by the bundle-producing nx target (build-bundles.ts), by the
 * vendor helper (vendor-bundle.ts), and by tests that need a freshly-built bundle to assert
 * against.
 *
 * `absWorkingDir` is pinned to the entry's own directory so the output is byte-identical
 * regardless of the caller's cwd. Without it, esbuild's leading `// <entry-path>` banner is
 * computed relative to `process.cwd()`, which would make the fingerprint pin (parity.ts)
 * depend on where the build ran — the nx `test` target (cwd = the project root) and a
 * repo-root vendor step would then hash differently and the committed pin could never match.
 * The banner is inert, so this changes no runtime behavior.
 */
import * as path from "node:path";
import * as esbuild from "esbuild";

export interface BuiltBundle {
    code: string;
    metafile: esbuild.Metafile;
}

export async function buildBundle(entryAbsPath: string): Promise<BuiltBundle> {
    const result = await esbuild.build({
        entryPoints: [entryAbsPath],
        absWorkingDir: path.dirname(entryAbsPath),
        bundle: true,
        platform: "node",
        format: "esm",
        target: "node22",
        write: false,
        metafile: true,
        // Inlined CJS dependencies (e.g. the `yaml` package) require() Node builtins at module
        // scope; esbuild's ESM output has no `require`, so its shim throws "Dynamic require of
        // 'process' is not supported" on a plain-node run. Provide a real require via
        // createRequire — constant bytes, so the fingerprint pin stays deterministic.
        banner: {
            js: 'import { createRequire as __nexusCreateRequire } from "node:module"; const require = __nexusCreateRequire(import.meta.url);',
        },
    });
    return { code: result.outputFiles[0].text, metafile: result.metafile };
}
