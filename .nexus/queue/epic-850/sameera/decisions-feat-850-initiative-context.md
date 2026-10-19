## 2026-10-19 — The excluded-store set moves to the workspace library
- **Choice:** Move the one excluded-store definition from portable-tools into `@nexus/workspace`, and make the pull-request libraries' range and landed-change diffs read it.
- **Why:** Close's range diffs were a second, hard-coded statement of the set, so a store added only to the portable-tools copy would stay in close's diffs (G2).
- **Refuted alternative:** Add the initiative store to each hard-coded copy, keeping two statements of the set.

## 2026-10-19 — The context folder and pointer come from one toolkit verb
- **Choice:** `nexus initiative-context path|pointer` prints the folder `.nexus/initiatives/initiative-<n>` and the pointer sentence; the epic body asks for both.
- **Why:** The readers (#853, #854) must recognise exactly the pointer the epic stage writes, so its shape lives in code once.
- **Refuted alternative:** Write the folder and the sentence out in the command body.

## 2026-10-19 — A kept plan is filed as plan-<its name>
- **Choice:** The context keeps an attached plan as `plan-<file name>`, copied with `cp`.
- **Why:** The context folder also holds the run's own `context.md` and `discovery.md`, and a plan named either would overwrite it.
- **Refuted alternative:** Keep the plan under its own file name, or in a subfolder the readers would have to walk.
