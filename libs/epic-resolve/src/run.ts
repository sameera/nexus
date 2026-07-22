/**
 * The process-execution seam for the epic resolver.
 *
 * Re-exported from @nexus/close-migration so every close-family helper shares one injectable
 * Runner: specs feed canned `gh` output (an epic, its sub-issues, a failing fetch) without
 * touching the network or the filesystem. `git()` runs git and returns trimmed stdout; for `gh`
 * calls invoke `run(...)` directly and read the RunResult.
 */

export { type RunResult, type Runner, defaultRunner, git } from "@nexus/close-migration/run";
