/**
 * The waiver register for the single-remover guard (decision record #514, invariant 6). A file
 * listed here is a known, counted, deliberately-approved remover of a committed `.nexus/queue/`
 * entry. It carries exactly two entries: the drain's own staged deletion, on its own branch, landed
 * only when that branch's pull request merges; and the solo lane's single ship commit, which removes
 * the epic's own decision-stub scratch because no queue entry or drain run exists for a solo epic
 * (decision record #806, D10). Any other entry here is a third remover — adding one is a
 * deliberate, reviewed act, not a quiet workaround.
 */
export const QUEUE_ENTRY_REMOVER_WAIVERS: readonly string[] = ["components/commands/nxs.distill.md", "components/commands/nxs.ship.md"];
