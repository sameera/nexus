/**
 * CLI entry for the nx "bundle" target: builds the release's JavaScript executable into a
 * self-contained ESM bundle.
 *
 * There is one entry point (story #309). The build used to produce six — `nexus` plus five
 * standalone launchers — but every one of those five capabilities has been reachable as a verb
 * on `nexus` since story #247, and the only consumer that ever needed them as separate files was
 * the vendored bundle. One entry point is also what lets the fingerprint pin be two entries: the
 * bundle and the payload.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { buildBundle } from "./bundle.js";

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

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
