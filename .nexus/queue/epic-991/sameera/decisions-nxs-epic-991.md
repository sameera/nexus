
## 2026-11-22 — Pending pull-request call tracked apart from the push
- **Choice:** A `prPending` flag, set on a successful push (or at start when a resumed run has committed stories and an open PR), cleared only when opening the PR or rewriting its status succeeds.
- **Why:** The watcher returned early once the tip was pushed, so a failed PR call was never retried.
- **Refuted alternative:** Leaving `pushedTip` unset until the PR call succeeds, which would re-push an already pushed tip.
