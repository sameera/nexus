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

## 2026-10-19 — The lookup is a toolkit verb, and the store resolves from the issues checkout
- **Choice:** `nexus initiative-context lookup --issue <n> [--out]` implements D5's one rule in code for both stages; `path` and `lookup` resolve the store in the checkout the issues are filed from (the hub, in a workspace).
- **Why:** Two command bodies following prose would drift on the parent query, the marker check and the missing-folder stop; and a member checkout must find the folder the hub-side epic run wrote.
- **Refuted alternative:** Spell the gh parent query and folder read out in each command body, relative to the current repository root.

## 2026-10-19 — A pointer with an empty folder counts as no folder
- **Choice:** A context folder with no files is treated as absent, so a pointer over an empty folder stops the run.
- **Why:** An empty folder holds none of the decisions the pointer promises.
- **Refuted alternative:** Read an empty folder as a found context with no files.

## 2026-10-19 — The consent question repeats the split table
- **Choice:** Repeat the split table inside the initiative consent question, so the kept `context.md` holds nothing the question did not show (G5).
- **Why:** The split table carries each goal's estimate and candidate stories, which a later promotion reads as context; dropping it would lose that.
- **Refuted alternative:** Drop the split table from `context.md` and keep only the goal titles carried in the order list.

## 2026-10-31 — The lookup reads the issues repository through close's resolver
- **Choice:** Resolve the issues repository with `resolveVerdictRepos` + `canonicalIssuesRepo`, and run gh through `onIssuesHost`, as close's `issuesSide` does.
- **Why:** One reading of `epic-repo` (fallback, host, written forms) across stages; a configured host on GitHub Enterprise must reach that host, not github.com (G14).
- **Refuted alternative:** Read `epic-repo` with `resolvePublishingKey` and split it into a slug inline, dropping the host.
