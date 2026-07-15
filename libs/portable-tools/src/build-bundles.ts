/**
 * CLI entry for the nx "bundle" target: builds every entry point into a self-contained ESM
 * bundle under dist/bundle/. Never hand-invoked as part of distillation — only used to produce
 * the artifact that a later story vendors into a hub.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { buildBundle } from "./bundle.js";

export const ENTRY_POINTS: Record<string, string> = {
    "generate-atlas": "generate-atlas.ts",
    "validate-concepts": "validate-concepts.ts",
    "derive-entry-diff": "derive-entry-diff.ts",
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
