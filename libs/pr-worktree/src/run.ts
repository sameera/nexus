/**
 * The process-execution seam for the pr-worktree helper.
 *
 * Re-exported from @nexus/close-migration so both close-family helpers share one
 * injectable Runner: specs simulate git and `gh` output (a merged PR, a failing
 * worktree add) without mocking the filesystem. `git()` runs git and returns
 * trimmed stdout; for `gh` and other commands call `run(...)` directly and read
 * the RunResult.
 */

export { type RunResult, type Runner, defaultRunner, git } from "@nexus/close-migration/run";
