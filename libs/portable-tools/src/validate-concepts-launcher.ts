#!/usr/bin/env tsx
/**
 * Standalone-artifact entry point for `validate-concepts` (decision record #277). The only file
 * whose top-level code unconditionally invokes `runCli` — `validate-concepts.ts` itself carries
 * no process boundary, so importing it (e.g. from `nexus-cli.ts`'s registry) never triggers a
 * second run. Nothing imports this launcher, so there is no double-dispatch hazard to guard
 * against.
 */
import { runCli } from "./validate-concepts.js";

process.exit(runCli(process.argv.slice(2)));
