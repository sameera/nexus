/**
 * The process-execution seam for the record-digest helper.
 *
 * Re-exported from @nexus/close-migration so every pipeline helper shares one injectable Runner:
 * specs feed canned `gh` output (a closed record, a not-planned closure, a failing fetch) without
 * touching the network.
 */

export { type RunResult, type Runner, defaultRunner } from "@nexus/close-migration/run";
