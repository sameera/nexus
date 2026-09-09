/**
 * The waiver register for the single-remover guard (decision record #514, invariant 6). A file
 * listed here is a known, counted, deliberately-approved remover of a committed `.nexus/queue/`
 * entry. It carries exactly one entry: the drain's own staged deletion, on its own branch, landed
 * only when that branch's pull request merges. Any other entry here is a second remover this
 * epic exists to prevent — adding one is a deliberate, reviewed act, not a quiet workaround.
 */
export const QUEUE_ENTRY_REMOVER_WAIVERS: readonly string[] = ["components/commands/nxs.distill.md"];
