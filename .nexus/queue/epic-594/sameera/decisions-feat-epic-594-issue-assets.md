## 2026-09-13 — Asset modules live in delivery-config, under one `assets` verb
- **Choice:** The store resolution, the publish step and the reference builder are modules of `@nexus/delivery-config`, exposed as subverbs of one `nexus assets` verb.
- **Why:** The store is a publishing target read through that library's key catalogue and precedence chain, and its filers already own the GitHub runner seam the publish step needs.
- **Refuted alternative:** A new `@nexus/asset-store` library with a bare `nexus asset-publish` verb beside `abs-doc-path`; it would duplicate the runner and io seams for three small modules.

## 2026-09-13 — Rewrite the derived epic body once, before story transcription
- **Choice:** `/nxs.epic` runs `nexus assets rewrite` on `epic.filing.md` right after deriving it; the story work-items are then transcribed from the rewritten body.
- **Why:** One rewrite step keeps the "assets published before the first issue exists" invariant and places each reference in the story or epic body by the section it sits in, with no per-item bookkeeping.
- **Refuted alternative:** Rewriting each `STORY-*.md` work-item and the epic body separately after transcription; it would publish per body, and a story body could publish an asset the epic body also names twice.

## 2026-09-13 — Declared asset paths match as whole tokens
- **Choice:** The rewrite and the clean-body assertion match a declared path only when no path character precedes or follows it.
- **Why:** The published address of `assets/flow.png` under the feature `issue-assets` ends in `issue-assets/flow.png`, so a plain substring match rewrote the address it had just written and then reported it as a survivor.
- **Refuted alternative:** Plain substring matching, which the record's "matching those paths exactly" reads as at first; exactness is kept, boundaries are added.

## 2026-09-13 — Resume recovers asset state from a sidecar file, not the draft frontmatter
- **Choice:** Phase 4 stores the `nexus assets check` output verbatim as `${DRAFT_DIR}/assets.json`; a resumed run re-runs `check` on its declared paths to recover `ASSETS`, `ASSET_STORE` and `ASSET_VISIBILITY`.
- **Why:** The draft frontmatter is embedded onto the epic issue as its meta block and the `--assert-clean --asset-path` scan covers every line of the filing body, so declared local paths in frontmatter would either fail the run or reach an issue body (invariant 4).
- **Refuted alternative:** Persist the declared list in the draft's frontmatter (the receipt's first suggestion) — rejected for the reason above; deriving the list from the draft's prose was rejected because the assertion must fail on exactly the paths the lead declared, not on whatever the draft happens to mention.
