/**
 * The process-execution seam for the live-acceptance harness.
 *
 * Re-exported from @nexus/close-migration so the harness shares one injectable
 * Runner with the close-family helpers it drives. Every `git` and `gh` call the
 * harness makes goes through it, so specs can simulate a hosted repo — an
 * existing scratch repo, a token without delete scope, a merged PR — with no
 * network and no GitHub side effects.
 */

export { type RunResult, type Runner, defaultRunner, git } from "@nexus/close-migration/run";
