## 2026-10-17 — The renderer lives in epic-verdicts as verdict-render.ts, called from writeJudgments
- **Choice:** `renderVerdict` sits beside the ID step and is called inside `nexus verdict-items` when `--facts` is passed; `--out` then receives the whole body.
- **Why:** D2 puts rendering in the same call that numbers the items and applies the answers.
- **Refuted alternative:** A new `--body-out` flag beside the judgments-only `--out`, which would leave the model two files to stitch together.

## 2026-10-17 — An item's subject is the existing anchor field
- **Choice:** A departure's subject is its `departsFrom`, a finding's its `about`; summary moved from a draft-parse refusal to the post-numbering `item-incomplete` refusal.
- **Why:** D3 counts exactly five new optional fields (fix, location, evidence, scope drift, notes), so subject cannot be a sixth, and the refusal can only name an item by ID after numbering.
- **Refuted alternative:** A new `subject` field, which would grow the judgments block past what D3 approved.

## 2026-10-17 — R1 measured on the largest verdict published here
- **Choice:** `fixtures/pr-874-verdict.md` is the verdict published on PR #874 (epic #829, 81 results, the largest of the last 60 merged PRs). Re-rendered in the new layout it is 26,077 characters, against 46,731 as published; `verdict-render-fixture.spec.ts` pins it under the limit and checks a --resolve carry of it (G8).
- **Why:** R1 asks for the largest existing verdict's size in the new layout before merge.
- **Refuted alternative:** A synthetic large epic only, which measures no verdict anyone published.

## 2026-10-17 — Publish-check refusals correct through the ID step, not the body
- **Choice:** Every `nexus verdict-check` refusal a hand edit could cause now ends with one shared remedy: run `nexus verdict-items` again and check its body unedited; `issues-repo-*` name `facts.json`'s `issuesRepo`, `deferred-scope-sibling` names the draft's `deferred`.
- **Why:** G3 says the model writes no byte of the verdict, so a remedy that edits the body would break it.
- **Refuted alternative:** Have `verdict-items` resolve `issuesRepo` itself, dropping it from `facts.json` — a larger change to the ID step's input than the finding asks for.

## 2026-10-17 — G3 remedy fix extends the 0.116.0 entry rather than bumping
- **Choice:** Added a line to the unreleased 0.116.0 CHANGELOG entry; no new version.
- **Why:** G6 holds the pull request to one bump and one CHANGELOG entry.
- **Refuted alternative:** Bump to 0.117.0 for the follow-up commit.

## 2026-10-17 — §2.6 departure fix rides the unreleased 0.116.0 entry
- **Choice:** reword §2.6 and Phase 3 so the ID step, not the model, writes counts and unapplied answers into the verdict; no new version bump.
- **Why:** 0.116.0 is untagged and its first bullet already states the toolkit writes the whole verdict, so this only aligns the instructions with it.
- **Refuted alternative:** bump to 0.117.0 with its own entry.
