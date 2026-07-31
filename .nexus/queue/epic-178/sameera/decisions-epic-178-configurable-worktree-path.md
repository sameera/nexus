# Decision stubs — epic #178, branch `epic/178-configurable-worktree-path`

## 2026-07-31 — Three new diagnostic problems rather than one reused label

- **Choice:** `worktree-base-unresolved`, `worktree-base-in-repo`, `worktree-base-uncreatable` join
  the existing `PrWorktreeProblem` union.
- **Why:** Each names a distinct operator fix (redeploy components / gitignore-or-move / fix the
  path), and the helper's diagnostic style is one problem label per fix.
- **Refuted alternative:** One `worktree-base-invalid` carrying the detail in the message — cheaper,
  but a caller cannot branch on it and the label stops being the thing an operator greps for.

## 2026-07-31 — `prepareWorktreeDir` funnels both open paths

- **Choice:** A single private helper resolves the base, runs the safety gate, and creates the
  per-checkout directory; `openAnalyzeWorktree` and `openCloseWorktree` call it as their first step.
- **Why:** Invariant 4 (analyze and close resolve identically) and invariant 6 (nothing created
  before the gate) are then structural rather than a rule two call sites must each remember.
- **Refuted alternative:** Export the gate and have each stage script call it before opening — makes
  it bypassable, which is exactly what the record rejects.

## 2026-07-31 — Fixture repos carry a copy of the real resolver

- **Choice:** `initRepo` copies this checkout's `delivery_config.py` into every fixture repo, so the
  specs drive the real process seam with a real settings.yml.
- **Why:** A stub runner would test the library against a fiction of the resolver's contract; the
  empty-output-means-unset convention is the part most worth pinning against the real script.
- **Refuted alternative:** Inject a fake `python3` runner in every spec — less I/O, but the seam's
  contract would then only be asserted against itself.
