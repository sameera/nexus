/**
 * CLI entry for the nx "bundle" target: builds the release's JavaScript executables into
 * self-contained ESM bundles.
 *
 * There is one entry point per declared binary name (stories #309, #355). The build once produced
 * six — `nexus` plus five standalone launchers — but every one of those five capabilities has been
 * reachable as a verb on `nexus` since story #247. What remains is the two toolkit names the
 * manifest declares, each a self-contained artifact with no runtime dependencies. The fingerprint
 * pin already covers an arbitrary set of bundles by name, so nothing downstream changes.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { buildBundle } from "./bundle.js";
import { isDirectRun } from "./entry-point.js";

export const ENTRY_POINTS: Record<string, string> = {
    nexus: "nexus-cli.ts",
    // The toolkit's own entry (story #355). It is a second self-contained artifact rather than
    // one multi-call bundle switching on the name it was invoked under: some package managers
    // link the binary while others generate a shim that erases the invoked name, so that switch
    // would silently pick the wrong toolkit on one installer and not the other.
    "nexus-gh": "../../delivery-config/src/nexus-gh-cli.ts",
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
