/**
 * Standalone-artifact entry point for `drift-advisory` (decision record #277). The only file
 * whose top-level code unconditionally invokes `runCli` — `drift-advisory.ts` itself carries no
 * process boundary, so importing it (e.g. from `nexus-cli.ts`'s registry, or from
 * `seed-registry.ts`) never triggers a second run. Nothing imports this launcher, so there is no
 * double-dispatch hazard to guard against.
 */
import { runCli } from "./drift-advisory.js";

process.exit(runCli(process.argv.slice(2)));
