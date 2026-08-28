/**
 * The `nexus-gh` entry point — the one name the toolkit's capabilities answer to.
 *
 * Bundled as `nexus-gh.mjs` beside the executable's own bundle (ENTRY_POINTS in
 * build-bundles.ts) and published under the binary name the manifest already declares, so
 * nothing downstream changes how the toolkit is reached.
 */

import { runNexusGh } from "./dispatch.js";
import { processIo } from "./io.js";

process.exitCode = runNexusGh(process.argv.slice(2), processIo());
