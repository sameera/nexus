#!/usr/bin/env tsx
/**
 * Standalone-artifact entry point for `seed-registry` (decision record #277). The only file whose
 * top-level code unconditionally invokes `runCli` — `seed-registry.ts` itself carries no process
 * boundary, so importing it (e.g. from `nexus-cli.ts`'s registry) never triggers a second run.
 * Nothing imports this launcher, so there is no double-dispatch hazard to guard against.
 */
import { runCli } from "./seed-registry.js";

process.exit(runCli(process.argv.slice(2)));
