## 2026-08-29 — The version-control client gets its own runner on the environment record

- **Choice:** `EpicEnvironment` carries `gitFor(root)` beside `runnerFor(root)`, the same runner contract bound to `git` instead of `gh`.
- **Why:** Invariant 2 puts every platform *and version-control* command at the resolved root, and the repository check is the only git call — one more seam is cheaper than teaching the gh runner to dispatch on a sentinel argument.
- **Refuted alternative:** Probe for `.git` on the filesystem instead of running git — rejected because it answers a different question than `rev-parse --is-inside-work-tree` (worktrees, submodules, `$GIT_DIR`).

## 2026-08-29 — The golden corpus is four drafts, recorded through the Python transforms directly

- **Choice:** The corpus is one real epic (#352's own materialization, copied into the test tree), one synthetic draft exercising every transform at once, one with no frontmatter and one with no stories; goldens were recorded by importing `create_epic`'s transform functions rather than by driving the whole filer.
- **Why:** The transforms are the whole derivation and are pure, so importing them records the same bytes the filer would file, without a fake `gh` on PATH or an issue being created to read a body back from.
- **Refuted alternative:** Drive the Python entry point against a fake `gh` and capture the `--body-file` it wrote — closer to the real path, but it records the same function's output through three more moving parts.

## 2026-08-29 — The shared call layer returns an `Outcome`, and the epic filer reaches it through a non-retrying throwing runner

- **Choice:** `Platform`, `ProjectLookup` and `writeBackDecisions` now return their outcomes (failure text included) instead of printing; the epic filer wraps its plain runner in a `throwingRunner` so it reuses the shared calls with one attempt each.
- **Why:** Invariant 16 requires the shared layer to print nothing, and the Python epic filer has never retried anything — which calls retry is observable as latency, so reusing the story filer's retrying tier would change behaviour.
- **Refuted alternative:** Keep the printing layer and let the epic filer inherit the story filer's wording on those lines — the ratified fallback in the record, held in reserve; the refactor came in bounded, so the divergence was not needed.

## 2026-08-29 — The source-level conformance check is extended in place rather than duplicated

- **Choice:** `story-filer/shared-module.spec.ts` now scans both filer directories and covers the epic-only capabilities (`ensureLabel`, `epicNeedsDesign`, `resolveSetting`) instead of a second spec beside the epic filer.
- **Why:** One check over both directories cannot drift from itself, and the decision record asks for the existing check to be extended.
- **Refuted alternative:** A parallel `epic-filer/shared-module.spec.ts` — reads more locally, but two copies of a structural rule is exactly the drift the rule exists to prevent.

## 2026-08-29 — Colour is gated per output stream, not on the input terminal

- **Choice:** `EpicEnvironment.isTerminal(stream)` answers the colour gate for stdout and stderr independently; `interactive()` stays the prompt gate and is now only about stdin.
- **Why:** Invariant 19's ratified exception is about *output* going to a terminal, and the two streams are redirected independently — one gate on stdout would strip colour from errors still being read on screen.
- **Refuted alternative:** A single gate on `process.stdout.isTTY` for both streams — simpler, but it silently drops colour from a stderr terminal whenever stdout is piped.

## 2026-08-29 — argparse's `--flag=value` and prefix abbreviations are part of the frozen surface

- **Choice:** The hand-rolled parser accepts a value attached with `=`, expands an unambiguous prefix of a long flag, refuses an ambiguous one naming the candidates, and treats `--` as end-of-options.
- **Why:** Invariant 19 freezes the flags' spellings at what the Python filer accepted, and that parser was argparse with its defaults — a caller may already be passing either form.
- **Refuted alternative:** Freeze only the canonical spellings and let the abbreviations lapse as an undocumented argparse accident — rejected because the invariant is about what a caller can pass, not about what the help text lists.

## 2026-08-29 — A failed project lookup returns a named step, not a finished sentence

- **Choice:** `FoundProject.failure` carries `{ step, detail }`; each filer words the step itself.
- **Why:** Invariant 16 keeps the shared lookups report-free, and the two filers genuinely word the same failure differently — the story filer says "Error fetching repository projects", the epic filer "Could not determine repository name".
- **Refuted alternative:** Carry the finished line as the failure text and have callers print it verbatim — cheaper, but it cannot serve two vocabularies, which is the whole reason the layer stopped printing.

## 2026-08-29 — `assignParent` reports whether it ever reached the platform

- **Choice:** `ParentLink` adds `unresolved`, so the caller renders "Error: Could not resolve issue IDs (…)" separately from "Error creating sub-issue relationship: …".
- **Why:** Making the layer report-free had collapsed two Python diagnostics into one; an operator chasing an unresolved id is looking for a missing issue, not a broken mutation.
- **Refuted alternative:** Resolve the node ids in the caller and pass them in — restores the distinction without a new field, but moves platform mechanics into the create pass.

## 2026-08-29 — Only the last scope a project lookup tried reports its failure

- **Choice:** `byNumber` / `byTitle` try `organization` then `user` and carry forward only the final attempt's failure, so one refused GraphQL call yields at most one warning line.
- **Why:** The Python filer reassigned `result` before its single `warn`, so the org attempt's failure was never printed on its own — a per-scope line would add a diagnostic the frozen surface never had.
- **Refuted alternative:** Report every failed scope — more honest about what was tried, but it doubles a line Invariant 19 freezes at one.
