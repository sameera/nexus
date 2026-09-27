## 2026-09-27 — Extend the #801 reapply to text added since it landed on the abandoned branch

- **Choice:** Beyond reapplying commit 484c86b's hunks (minus the `/nxs.ship` references, per D11),
  also updated a few passages in `components/commands/nxs.close.md` that were added to the file
  after 484c86b was cut on the abandoned `feat/799-solo-lane` branch and that still described the
  now-impossible local-close path (the Phase 8.2 durability note, the Phase 7 checkpoint list, the
  Phase 9 report, the invariants list, and the Usage examples).
- **Why:** Leaving them would ship a command file that is internally inconsistent — some passages
  saying close never runs without `--pr`, others still branching on a local mode that can no longer
  be reached.
- **Refuted alternative:** Reapply only the exact hunks from 484c86b and leave the newer passages
  alone. Rejected because it would reintroduce the same class of drift record #815 exists to close.
