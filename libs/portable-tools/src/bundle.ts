/**
 * Shared esbuild bundling primitive: compiles a single TypeScript entry point into a
 * self-contained ESM bundle targeting the repo's Node floor. Every non-builtin import is
 * inlined; only Node builtins are left external (esbuild's automatic behavior under
 * platform: "node"). Reused by the bundle-producing nx target (build-bundles.ts) and by
 * tests that need a freshly-built bundle to assert against.
 */
import * as esbuild from "esbuild";

export interface BuiltBundle {
    code: string;
    metafile: esbuild.Metafile;
}

export async function buildBundle(entryAbsPath: string): Promise<BuiltBundle> {
    const result = await esbuild.build({
        entryPoints: [entryAbsPath],
        bundle: true,
        platform: "node",
        format: "esm",
        target: "node22",
        write: false,
        metafile: true,
    });
    return { code: result.outputFiles[0].text, metafile: result.metafile };
}
