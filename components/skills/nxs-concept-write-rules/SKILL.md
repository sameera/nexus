---
name: nxs-concept-write-rules
description: The rules for writing concept pages into .nexus/concepts/ — applying a create, update or retire delta, the 400-word cap and split rule, the verification flag, and the deterministic steps (touches reciprocity fan-out, code-anchor refresh, atlas regeneration, validator). Loaded by /nxs.ship. A word-for-word copy of the matching /nxs.distill passages until a follow-up epic makes distill load it too; a spec fails when the copies differ.
---

# Concept write rules

Write concept pages with the rules below. They are copied word for word from `/nxs.distill` (Phase 4
steps 3 onward, and Phase 5 up to its commit step); fix a rule in both places until the follow-up epic makes distill load
this skill. The loading stage says which parts of the copied text do not apply to it: in particular,
a stage that writes in the current checkout has no distill branch, no per-entry commit and no queue
entry to remove.

<!-- copied-from: commands/nxs.distill.md -->

3. **Applying a delta** (0003 §2, §8.2 semantics):
    - `create` → write the full page: frontmatter (`title`, `aliases`, `touches`,
      `last_updated_by: <source>`, `status: active`, `verification:` per below), H1 mirroring
      `title`, Summary lead (≤3 sentences,
      written to stand alone as a grep hit), `## How It Works` (≤180 words), `## Key Invariants`
      (≤7, numbered), `## Integration Points` (one bullet per `touches` slug:
      `- [slug](slug.md) — <nature of the interaction>`), and a `## Decision Log` seeded with
      exactly the delta's entry.
    - `update` → patch only the sections the delta carries; update `last_updated_by`; **append
      exactly one** Decision Log entry. Never edit, reorder, or delete prior entries. A retired
      invariant is **struck through in place** (`~~...~~`), never deleted.
    - `retire` → set `status: deprecated`, append the Decision Log entry, `git mv` the page to
      `.nexus/concepts/_archive/`.
    - Decision Log entries are headed `### <YYYY-MM-DD> — <ref> — <short title>`.
    - A page's **own content** stays under the **400-word cap**. Own content is the body excluding
      frontmatter, excluding `## Integration Points`, and excluding the Decision Log; on a
      well-formed page, exactly the Summary, `## How It Works` and `## Key Invariants` (0003 §2.2).
      An `update` may only remove content its own delta supersedes. **Never compress or drop
      still-true content to make room under the cap**. If the patched *own content* would exceed
      the cap, the concept is too broad: run step 4 and split it.
    - **The neighbour list is bounded per entry, not by the cap.** Each `## Integration Points`
      bullet stays **≤40 words** (the validator blocks above it) and reads best under 25 (it
      advises above that). A page that passes 400 total body words because of its Integration
      Points needs **no split and no compression**, because the cap does not measure a page's
      popularity. Never drop an edge, demote it to prose, or compress a neighbour's bullet to fit
      anything.
4. **Splitting at the cap (0003 §2.2: split, don't grow).** A page whose patched **own content**
   would exceed the cap is describing two concepts. Split it inside the same entry commit.
   Neighbour-list pressure is **never** a trigger for this step. A page with many Integration
   Points bullets is well-connected, not broad, and splitting it would only increase the store's
   total edge prose:
    - **Choose the seam by retrieval, not by size.** Each half must be loadable on its own, with
      its own decisive Summary, its own invariants, its own touches. If every task that loads one
      half would also load the other, the seam is wrong; find another. If no independent seam
      exists the page is genuinely dense **on its own content**, and eviction becomes the last
      resort. Eviction is allowed only when the appended Decision Log entry states exactly what was
      dropped, and the PR body calls it out for the reviewer. Own-content overflow is its only
      trigger: a long neighbour list never justifies evicting anything.
    - **Synthesize a `create` delta for the new page**, under all Phase 3 rules: slug
      uniqueness and the §8.3 boundary. Seed its Decision Log with a single
      first entry recording the split (`split from <parent-slug>`). **Never copy entries from
      the parent**; the parent's log is immutable and stays whole.
    - **Rewrite the original's `update` delta**: body slimmed to the retained concept; its one
      appended Decision Log entry records what moved where and why. Move the `aliases` that now
      resolve to the new page. The two halves `touches` each other, and any of the original's
      `touches` whose interaction now belongs to the new half re-point to it (Phase 5 C11
      reciprocity fan-out propagates the rest).
    - The seam is a judgment call the distillation-PR review approves; the diff shows the
      slimmed original beside the new page. Mark both in the PR body (Phase 7 `Split:` line).
5. **Verification flag (R6):** every page this run creates or updates gets
   `verification: verified`, because this stage is reviewed (the distillation-PR) and grounded in
   shipped code. This includes flipping a pre-existing `unverified` (bootstrap/manual) page that a
   delta touches: re-check its body against the current code while patching it (C13: bootstrap
   pages are low-trust; the first run that touches them re-validates them).
6. **Draft the pages under the *Prose convention*.** Every page this run creates or updates is
   written plainly the first time, so Phase 5's validator reads the prose that will be filed.
   Ground an abstraction in the entry's `epic.md` and its *why* file (Phase 0.1, on disk); never
   the diff.
<!-- end-copied-from -->

<!-- copied-from: commands/nxs.distill.md -->

# Phase 5 — Deterministic steps (not judgment)

Run these for each entry, in order, before its commit:

1. **C11 `touches:` reciprocity fan-out.** A real interaction is bidirectional. For every delta
   with `touches_added: [X]`: on page X, add the delta's concept slug to `touches:`, add the
   mirrored Integration Points bullet, and append one Decision Log entry
   (`### <date> — <source> — Reciprocal link from <slug>`) recording the fan-out. For
   `touches_removed`, remove symmetrically (the removal is logged the same way). Fan-out edits
   land in the **same PR**, mechanically, with no judgment call.

    - **The fan-out never fails and never drops an edge.** The neighbour list sits outside the
      400-word cap (0003 §2.2), so no page in the store can be too full to accept a reciprocal
      bullet. Never drop the edge, never demote the interaction to prose on one side, and never
      compress the target's existing content to make room. None of those is a legal move here.
    - **A delta that adds and removes no `touches` neighbour leaves nothing to mirror.** Run the
      step anyway and expect no edit, and run the atlas regeneration anyway for the same reason, so
      neither check can drift. Under a bounded delta vocabulary that is every delta in the entry.
    - **Its only bound is the 40-word ceiling on the bullet you are writing**. That bound binds the
      new bullet, never the target's existing prose. If the interaction genuinely cannot be stated
      in 40 words, that is the signal the delta names **two distinct interactions**: declare two
      edges, each with its own bullet. Splitting the interaction is the remedy; dropping it is
      not.

2. **R1 code-anchor refresh.** For **every** concept page this PR touches (including reciprocal
   fan-out targets), regenerate `.nexus/anchors/<slug>.md`. Anchors are **derived state**: the
   ONLY place file paths are allowed (pages still reject them), SHA-stamped, regenerable,
   **never hand-edited**. Derive each concept's anchors from the diff paths attributable to it,
   plus an alias-grep for pre-existing anchors. Grep over the home repo's source tree. **Only
   anchor a path that still
   exists at its repo's newest drained head** (epic #214, story #507). A path a later range entry
   renamed or deleted away is not anchored; existence is a read-only check at that head.

   **Per-path attribution (epic #214, story #507).** When a repo's range names more than one
   entry, append to each path's role text which pull request last changed it, in the
   form `#<pr>`. Example:
   `- \`src/x.ts\` — validates the request shape (#512)`. A path that entered only via
   alias-grep or name matching, never through a processed range entry, carries no attribution.
   That correctly reads as this run not having put it there. Read each entry's pull request from
   the diff tool's header (`nexus derive-entry-diff`'s `pr <n>` suffix, present when the range
   entry stamped one). For an older entry with none, resolve it from its recorded head, with the
   same commit-to-pull-request resolution the Phase 0.4 merge-precondition already performs
   (`gh api "repos/{owner}/{repo}/commits/<head>/pulls"`). When that too fails, degrade to naming
   the repository and the short head instead of a pull request, and say in the completion report
   that this path's attribution degraded. This attribution is **asserted, never validated**. The
   validator's anchor rules are unchanged; this stage's own report of what it attributed and what
   it could not is the check (decision record #513, accepted risk).

   **Single-repo format (unchanged shape):**

    ```markdown
    ---
    concept: <slug>
    source_sha: <newest drained head for this repo>
    generated: <YYYY-MM-DD>
    ---

    <!-- DERIVED — regenerated by /nxs.distill on every drain touching this concept.
         Never hand-edit; stale anchors are rebuilt, not fixed. -->

    # Code Anchors: <Title>

    - `<path>` — <one-line role in the concept>[ (#<pr>)]
    ```

3. **Argument discipline for the deterministic steps.** Steps 4 and 5 run the same commands
   whatever the run's shape. The toolkit is addressed by name, so there is nothing to choose. Pass
   every page path and git ref as its own separate, quoted argument; never build the command by
   interpolating a shell string. The changed pages alone are named; there are no anchor sidecars.

4. **Atlas regeneration.** Rebuild the human orientation page. Name no output path (epic #74;
   never a hardcoded one):

    ```bash
    nexus generate-atlas
    ```

   Its output names where it wrote: `Atlas written: <path> (<N> concepts)`. Record that `<path>`,
   the **resolved atlas path**, for the staged file set (Step 6), the run summary (Phase 6) and
   the PR body (Phase 7). The atlas is derived state, regenerated whole, never hand-edited or
   prose-tweaked in the PR.

5. **Validator.** Run it over every page the entry changed (staged working-tree state vs the
   last commit), naming each path as its own argument:

    ```bash
    nexus validate-concepts --base HEAD "<changed-page-path>" ...
    nexus generate-atlas --check
    ```

    **A non-zero exit from any of these blocks the PR**. Fix the pages (or regenerate the
    atlas) and re-run until both exit 0. Do not weaken, skip, or reinterpret a blocking finding;
    the validator is the contract's mechanical half. **Advisories are the named exception:** a
    finding marked `[ADVISORY]` is not a failure, and a run whose findings are all advisories
    exits 0. Those never block and are never "fixed" to silence them; carry them into the PR body
    for the reviewer and proceed.
<!-- end-copied-from -->
