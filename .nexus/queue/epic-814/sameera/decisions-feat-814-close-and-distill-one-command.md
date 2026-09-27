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

## 2026-09-27 — Unattended contract lives in its own skill file, not inline in nxs.distill.md

- **Choice:** Built story #816's whole `--unattended` behavior (the blocking-condition table, the
  Phase 3.1 taxonomy precheck, the branch-unwind mechanics, the checkpoint skip, the PR-body
  superset, the stop report) as a new sixth exceptional-path contract,
  `components/skills/nxs-distill-unattended/SKILL.md`, following the existing
  recovery/continuation/hub/taxonomy pattern (epic #714). The base `nxs.distill.md` gained only a
  one-line flag resolution and one selection-table row.
- **Why:** `libs/portable-tools/distill-load-ceiling.json` pins the *ordinary* run's loaded bytes
  (base stage + every contract's description line) under a ceiling that a committed test
  (`distill-load-ceiling.spec.ts`) only ever lets move down (`replaces > bytes`). The base file had
  13 bytes of headroom before this story. Inlining the full unattended contract in the base
  document (my first pass) blew the ceiling by several kilobytes with no way to raise it.
- **Refuted alternative:** Keep the contract inline in `nxs.distill.md` and re-record the ceiling
  higher. Rejected: the committed test asserts the new ceiling must be *smaller* than the one it
  replaces, so this is mechanically not an option, and raising it by editing the test's own
  assertion would be gaming the guardrail epic #714 built for exactly this failure mode.

## 2026-09-27 — Outcome record quotes distill's final message from the stream formatter

- **Choice:** The stream formatter writes the stage's final message (claude `result`, codex last
  `agent_message`) to a file named by `FINAL_OUT`, and the outcome record quotes that file when no
  distillation pull request opened. Success itself is still read from GitHub (D9).
- **Why:** D9 asks for distill's final message word for word; the formatter already sees it as one
  structured field, so no log parsing is needed and it works the same on both harnesses.
- **Refuted alternative:** Extract the last block of the rendered log. Rejected: the rendered log
  differs by harness and a heuristic cut can clip or pad the message.

## 2026-09-27 — PR body renders the checkpoint layout by reference
- **Choice:** Base Phase 7 gets one `## Run summary` section that renders the Phase 6.3 checkpoint layout (minus its first and last lines), replacing the separate anchors/atlas sections.
- **Why:** One layout for both modes (D3, G9) while the base stage stays under the distill load ceiling, which had 74 bytes of headroom.
- **Refuted alternative:** Spell each run-summary field out in the PR body template — duplicates the checkpoint and exceeds the ceiling.
