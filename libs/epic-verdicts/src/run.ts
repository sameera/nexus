/**
 * The process-execution seam for the epic-verdicts helper.
 *
 * Re-exported from @nexus/close-migration so this helper shares one injectable Runner with every
 * other pipeline helper: specs feed canned `gh` output (a story with no verdict, a stale PR head,
 * a closed-unmerged candidate) without touching the network.
 */

export { type RunResult, type Runner, defaultRunner } from "@nexus/close-migration/run";
