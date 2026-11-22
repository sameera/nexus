
## 2026-11-22 — Pending pull-request call tracked apart from the push
- **Choice:** A `prPending` flag, set on a successful push (or at start when a resumed run has committed stories and an open PR), cleared only when opening the PR or rewriting its status succeeds.
- **Why:** The watcher returned early once the tip was pushed, so a failed PR call was never retried.
- **Refuted alternative:** Leaving `pushedTip` unset until the PR call succeeds, which would re-push an already pushed tip.

## 2026-11-22 — A failed publish call waits for the tip it failed at to move
- **Choice:** Remember the checked tip a push or pull-request call failed at, and skip retries on ticks where that tip is unchanged, except the after-stage tick.
- **Why:** G17 retries at the next commit and once after the stage; retrying every 5 s tick hammered git and gh on a persistent failure.
- **Refuted alternative:** Keep retrying every tick and accept the departure (DV6).

## 2026-11-22 — The watcher pushes the checked sha by explicit refspec
- **Choice:** `push` takes an optional sha and pushes `<sha>:refs/heads/<branch>`; the watcher passes the last checked commit.
- **Why:** Pushing `branch:branch` sent whatever the agent had committed since the check (G14, DV3).
- **Refuted alternative:** Re-read the tip right before pushing, which still leaves a window.
