## 2026-10-16 — Share close's PR-to-epic resolution as one exported function
- **Choice:** Extracted `resolveEpicOfPr` (and its issues-repo helper) out of `runCloseCommand`; close and `nexus distill` both call it.
- **Why:** D2 requires the two commands to resolve a pull request's epic the same way, and a copy would drift.
- **Refuted alternative:** Calling `runCloseCommand` in a read-only mode, which would mix distill's checks into close's gate.

## 2026-10-16 — Run folder named distill-run-pr-<N>
- **Choice:** `.nexus/tmp/distill-run-pr-<N>/` in the main checkout, resolved from git's shared folder.
- **Why:** G18 needs a name that can never read as `epic-<n>`, `fix-<n>` or `intake-<n>`, and the distillation's own run folder lives under `.nexus/tmp/runs/`.
- **Refuted alternative:** Reusing the script's `close-epic-<N>`, which names the script, not the command.

## 2026-10-16 — close-epic.sh exits with nexus distill's status
- **Choice:** The script `exec`s `nexus distill`, so a stopped distillation now exits non-zero; under `--background` it detaches `nexus distill` itself until the command gains `--background`.
- **Why:** The outcome rule belongs to the command (D4, D13), and the exit status is part of it.
- **Refuted alternative:** Keeping the script's exit 0 on a stop, which would report success the command does not.
