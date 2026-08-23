/**
 * CLI entry for the nx "bundle" target: builds every entry point into a self-contained ESM
 * bundle under dist/bundle/. Never hand-invoked as part of distillation — only used to produce
 * the artifact that a later story vendors into a hub.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { buildBundle } from "./bundle.js";

// The five standalone artifacts point at their launcher file, not the capability file directly
// (decision record #277): the capability files carry no process boundary of their own (so
// `nexus-cli.ts` can import them without triggering a self-run), and each launcher is the one
// place that still unconditionally invokes `runCli` for that standalone artifact's build.
export const ENTRY_POINTS: Record<string, string> = {
    "generate-atlas": "generate-atlas-launcher.ts",
    "validate-concepts": "validate-concepts-launcher.ts",
    "derive-entry-diff": "derive-entry-diff-launcher.ts",
    "drift-advisory": "drift-advisory-launcher.ts",
    "seed-registry": "seed-registry-launcher.ts",
    "nexus": "nexus-cli.ts",
};

export async function buildAllBundles(srcDir: string, outDir: string): Promise<string[]> {
    fs.mkdirSync(outDir, { recursive: true });
    const written: string[] = [];
    for (const [name, relEntry] of Object.entries(ENTRY_POINTS)) {
        const { code } = await buildBundle(path.join(srcDir, relEntry));
        const outFile: string = path.join(outDir, `${name}.mjs`);
        fs.writeFileSync(outFile, code);
        written.push(outFile);
    }
    return written;
}

async function main(): Promise<void> {
    const srcDir: string = import.meta.dirname;
    const outDir: string = path.join(srcDir, "..", "dist", "bundle");
    for (const file of await buildAllBundles(srcDir, outDir)) {
        console.log(`Bundled: ${file}`);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
