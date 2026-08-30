/**
 * CLI entry for the nx "bundle" target: builds the release's JavaScript executables into
 * self-contained ESM bundles.
 *
 * There is one entry point per declared binary name (stories #309, #355, #397). The build once
 * produced six, then two; the manifest now declares one name, so it produces one — a self-contained
 * artifact with no runtime dependencies. The fingerprint pin already covers an arbitrary set of
 * bundles by name, so nothing downstream changes.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { buildBundle } from "./bundle.js";
import { isDirectRun } from "./entry-point.js";

export const ENTRY_POINTS: Record<string, string> = {
    nexus: "nexus-cli.ts",
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

if (isDirectRun(import.meta.url, process.argv[1])) {
    main();
}
