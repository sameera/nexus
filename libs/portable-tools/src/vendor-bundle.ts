/**
 * Vendor helper (STORY-44.03): the single "build + pin + copy in lockstep" step for the portable
 * tools. It builds each entry point in-process, records the sha256 of every bundle in the committed
 * fingerprint pin (libs/portable-tools/bundle-fingerprint.json), and — when a hub tools directory is
 * given — writes each `<entry>.mjs` there from the *same in-memory bytes it just hashed*, so the
 * vendored artifact is guaranteed to match the pin (decision-record Invariant 12).
 *
 * The hub path is never hard-coded here: the caller passes the full destination via `--tools-dir`,
 * which the placement doc fills from `portableToolsDir` (`.nexus/tools`) — the single producer of
 * that path (Invariant 13). Because `buildBundle` is cwd-independent, the pin this writes matches
 * the fresh build the parity spec computes under the nx `test` target regardless of where it runs.
 *
 * Not a bundle entry point — never vendored into a hub, and needs no non-builtin deps at runtime.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { buildBundle } from "./bundle.js";
import { ENTRY_POINTS } from "./build-bundles.js";
import { hashBundleCode, type Fingerprint } from "./parity.js";
import {
    COMPONENT_PAYLOAD_DIRNAME,
    COMPONENT_PAYLOAD_KEY,
    copyComponentTree,
    hashComponentTree,
    liveClaudeDir,
} from "./vendor-components.js";

export interface VendorOptions {
    /** Directory holding the entry-point sources. Defaults to this file's directory. */
    srcDir?: string;
    /** Absolute path of the committed fingerprint pin to (re)write. */
    pinPath: string;
    /** Full path to a hub's portable-tools directory to copy the matching artifacts into. */
    toolsDir?: string;
    /** The live `.claude/` component source. Defaults to the repo-root tree beside srcDir. */
    claudeDir?: string;
}

export interface VendorResult {
    fingerprint: Fingerprint;
    copiedTo: string[];
    /** Payload-relative component paths vendored into `<toolsDir>/claude-components/`. */
    payloadCopiedTo: string[];
}

/** Builds every entry point, writes the pin, and — if `toolsDir` is set — vendors the artifacts. */
export async function vendorBundles(options: VendorOptions): Promise<VendorResult> {
    const srcDir: string = options.srcDir ?? import.meta.dirname;
    const claudeDir: string = options.claudeDir ?? liveClaudeDir(srcDir);
    const fingerprint: Fingerprint = {};
    const copiedTo: string[] = [];
    let payloadCopiedTo: string[] = [];

    if (options.toolsDir !== undefined) {
        fs.mkdirSync(options.toolsDir, { recursive: true });
    }

    for (const [name, relEntry] of Object.entries(ENTRY_POINTS)) {
        const { code } = await buildBundle(path.join(srcDir, relEntry));
        const artifact = `${name}.mjs`;
        fingerprint[artifact] = hashBundleCode(code);
        if (options.toolsDir !== undefined) {
            const dest: string = path.join(options.toolsDir, artifact);
            fs.writeFileSync(dest, code);
            copiedTo.push(dest);
        }
    }

    // The component payload rides the same pin-and-copy lockstep as the bundles: hash the live
    // tree, and when vendoring, copy from that same tree — so a distributable whose components
    // lag their source fails the fingerprint gate (decision record, epic #60 ADDRESS risk).
    fingerprint[COMPONENT_PAYLOAD_KEY] = hashComponentTree(claudeDir);
    if (options.toolsDir !== undefined) {
        payloadCopiedTo = copyComponentTree(claudeDir, path.join(options.toolsDir, COMPONENT_PAYLOAD_DIRNAME));
    }

    fs.mkdirSync(path.dirname(options.pinPath), { recursive: true });
    fs.writeFileSync(options.pinPath, JSON.stringify(fingerprint, null, 2) + "\n");

    return { fingerprint, copiedTo, payloadCopiedTo };
}

export function parseArgs(argv: string[]): { toolsDir?: string } {
    const result: { toolsDir?: string } = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--tools-dir") {
            result.toolsDir = argv[++i];
        }
    }
    return result;
}

export async function runCli(argv: string[]): Promise<number> {
    const { toolsDir } = parseArgs(argv);
    const srcDir: string = import.meta.dirname;
    const pinPath: string = path.join(srcDir, "..", "bundle-fingerprint.json");

    const { fingerprint, copiedTo, payloadCopiedTo } = await vendorBundles({ srcDir, pinPath, toolsDir });

    console.log(`Fingerprint pin written: ${pinPath}`);
    for (const [name, hash] of Object.entries(fingerprint)) {
        console.log(`  ${name}  ${hash.slice(0, 16)}…`);
    }
    if (copiedTo.length > 0) {
        for (const dest of copiedTo) {
            console.log(`Vendored: ${dest}`);
        }
        console.log(`Vendored component payload: ${payloadCopiedTo.length} file(s) under ${COMPONENT_PAYLOAD_DIRNAME}/`);
    } else {
        console.log("No --tools-dir given: pin updated in place; no artifact copied.");
    }
    return 0;
}

async function main(): Promise<void> {
    process.exit(await runCli(process.argv.slice(2)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
