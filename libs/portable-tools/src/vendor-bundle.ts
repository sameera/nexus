/**
 * Pin step (STORY-44.03, narrowed by #293): the "build + hash" step for the portable tools. It
 * builds each entry point in-process and records the sha256 of every bundle in the committed
 * fingerprint pin (libs/portable-tools/bundle-fingerprint.json). The component payload is hashed
 * from the live `.claude/` tree into the same pin, so a distributable whose components lag their
 * source fails the fingerprint gate (decision record, epic #60 ADDRESS risk).
 *
 * It writes exactly one file — that pin — and copies nothing into any repository. The copy half
 * that once placed the artifacts inside a hub checkout was retired with the vendored bundle
 * itself; the toolkit reaches a machine through the shared install instead.
 *
 * Because `buildBundle` is cwd-independent, the pin this writes matches the fresh build the parity
 * spec computes under the nx `test` target regardless of where it runs.
 *
 * Not a bundle entry point — needs no non-builtin deps at runtime.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { buildBundle } from "./bundle.js";
import { ENTRY_POINTS } from "./build-bundles.js";
import { hashBundleCode, type Fingerprint } from "./parity.js";
import { COMPONENT_PAYLOAD_KEY, hashComponentTree, liveClaudeDir } from "./vendor-components.js";

export interface VendorOptions {
    /** Directory holding the entry-point sources. Defaults to this file's directory. */
    srcDir?: string;
    /** Absolute path of the committed fingerprint pin to (re)write. */
    pinPath: string;
    /** The live `.claude/` component source. Defaults to the repo-root tree beside srcDir. */
    claudeDir?: string;
}

export interface VendorResult {
    fingerprint: Fingerprint;
}

/** Builds every entry point and the component payload's hash, and writes the pin. */
export async function vendorBundles(options: VendorOptions): Promise<VendorResult> {
    const srcDir: string = options.srcDir ?? import.meta.dirname;
    const claudeDir: string = options.claudeDir ?? liveClaudeDir(srcDir);
    const fingerprint: Fingerprint = {};

    for (const [name, relEntry] of Object.entries(ENTRY_POINTS)) {
        const { code } = await buildBundle(path.join(srcDir, relEntry));
        fingerprint[`${name}.mjs`] = hashBundleCode(code);
    }

    fingerprint[COMPONENT_PAYLOAD_KEY] = hashComponentTree(claudeDir);

    fs.mkdirSync(path.dirname(options.pinPath), { recursive: true });
    fs.writeFileSync(options.pinPath, JSON.stringify(fingerprint, null, 2) + "\n");

    return { fingerprint };
}

export async function runCli(argv: string[]): Promise<number> {
    // The pin step takes no arguments. Naming the offender keeps a stale `--tools-dir` invocation
    // from looking like a successful re-vendor.
    if (argv.length > 0) {
        console.error(`Unrecognised option: ${argv[0]} — the pin step takes no arguments.`);
        return 1;
    }

    const srcDir: string = import.meta.dirname;
    const pinPath: string = path.join(srcDir, "..", "bundle-fingerprint.json");

    const { fingerprint } = await vendorBundles({ srcDir, pinPath });

    console.log(`Fingerprint pin written: ${pinPath}`);
    for (const [name, hash] of Object.entries(fingerprint)) {
        console.log(`  ${name}  ${hash.slice(0, 16)}…`);
    }
    return 0;
}

async function main(): Promise<void> {
    process.exit(await runCli(process.argv.slice(2)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
