## 2026-08-26 — The subverb gate is a guard at the top of each dispatcher

- **Choice:** Each subverb-dispatching verb declares its subverb names as a `readonly string[]` wired into its registry entry, and its dispatcher opens with a membership check against that same array; the last declared subverb's branch becomes unconditional.
- **Why:** It makes "the dispatcher and the gate read one list" literally true with no dead unknown-subverb tail and no change to any existing message or exit code.
- **Refuted alternative:** Restructure each dispatcher into a `Record<subverb, handler>` mirroring `REGISTRY` — cleaner symmetry, but it rewrites five working branch bodies for a story about the gate.

## 2026-08-26 — The machine capability listing is `nexus-gh --capabilities`, emitting JSON

- **Choice:** A toolkit-level flag that prints `{"capabilities": [...]}` (sorted) and exits 0, handled before the human-usage path.
- **Why:** A flag cannot collide with a capability name, and JSON gives the gate a shape with no prose in it, so a reworded diagnostic can never break the gate.
- **Refuted alternative:** A `capabilities` capability in the registry — it would then appear in its own listing and in the human usage as if it were a delivery capability.

## 2026-08-26 — A repository-bound artifact in a code span is reportable with no command around it

- **Choice:** The scanner adds an `unrecognised` form: a code span naming a `.claude/**.ts|.py` path, a `.mjs` bundle, or a `pnpm nexus:` alias with no recognised leader is reported as unmigrated.
- **Why:** Four real sites (e.g. an inline `` `.nexus/tools/derive-entry-diff.mjs` ``) name the artifact with no verb; without this a body could be certified migrated with a bundle path still in it.
- **Refuted alternative:** Recognise leaders only — simpler, but it reintroduces exactly the blind spot the code-span rule was widened to close.

## 2026-08-26 — The thirteen bundle-path sites are in Story #302's scope

- **Choice:** Treat the surviving `node <tools-dir>/*.mjs` sites as this epic's work rather than waiting on #257.
- **Why:** They are still present in the live bodies, and the pending register cannot reach empty — the epic's completion condition — while any body still carries one.
- **Refuted alternative:** Declare #257 a hard blocker and leave those bodies on the register; it defers this epic on another epic's schedule for strings that are already dead.

## 2026-08-26 — The retired script-vs-verb parity axis is deleted with the scripts

- **Choice:** Deleting the seven legacy skill scripts also deletes the `#272`/`#273` migration-axis describe blocks in `parity.spec.ts` and their path constants.
- **Why:** That axis compares a script against the verb that replaced it; with the scripts gone it has nothing to compare, and its own comment already named #250 as its retirement.
- **Refuted alternative:** Keep the blocks pointed at the git history of the deleted files — there is nothing to run.

## 2026-08-26 — Specs that drove a deleted script are repointed, not deleted

- **Choice:** `docs-root-readout.spec.ts`, `cross-ref-docs-root.spec.ts` and `pr-acceptance`'s range helper now invoke `tsx nexus-cli.ts <verb>` — the maintainer's one from-source command shape.
- **Why:** The behaviour they cover (docs-root strip, URL agreement, close-range derivation) is live in the verbs; deleting the specs would trade a script path for a coverage hole.
- **Refuted alternative:** Delete them as script-specific — they are capability tests that happened to enter through a script.

## 2026-08-26 — The two-branch invocation prose keeps its shape in this story

- **Choice:** Where a body offered a single-repo and a hub invocation of one capability, #302 rewrites both sides to the same named form and leaves the branch standing.
- **Why:** #304 owns the collapse and must preserve the mode-conditional instructions the hub side carries; doing both at once risks dropping those silently.
- **Refuted alternative:** Collapse while rewriting — fewer passes over the same lines, but it fuses an addressing change with a de-duplication that needs its own reading.

## 2026-08-26 — The pending register is removed in this story, not the last one

- **Choice:** #303 empties the register, deletes the file, and drops the `pending` parameter from `checkComponentInvocations`, so enforcement is unconditional from here on.
- **Why:** #303 rewrites the last legacy site, which is the completion condition the register recorded; leaving it until #304 would keep a live exemption channel open across a story that edits shipped bodies.
- **Refuted alternative:** Keep the parameter defaulting to empty — it reads as an exemption mechanism that no caller uses, which is the tautology the register was designed to avoid.

## 2026-08-26 — The acceptance harness reaches the Python toolkit by its entry-point file

- **Choice:** `libs/pr-acceptance` invokes `python3 <toolRoot>/libs/gh-toolkit/bin/nexus-gh <capability>` rather than the name on the path.
- **Why:** The harness already resolves everything from an explicit `toolRoot` so it can drive a checkout that is not the one it runs in; requiring the name on PATH would make it depend on an install step the harness does not perform.
- **Refuted alternative:** Invoke the bare name — correct for a shipped body, wrong for a harness whose whole job is to exercise a specific checkout.

## 2026-08-26 — Phase 5.3 is repurposed, not renumbered away

- **Choice:** The distill step that selected an invocation becomes the step that states the mode-conditional argument rules, keeping its number.
- **Why:** Eight passages elsewhere in the body cite "Phase 5.3–5.5" by number; deleting the item would renumber every later step and silently invalidate those references.
- **Refuted alternative:** Delete the step and renumber — tidier list, but it rewrites cross-references that have nothing to do with this change.

## 2026-08-26 — #304 adds no new automated check

- **Choice:** The de-duplication ships with no gate of its own.
- **Why:** What made the duplication possible was two addressing forms, and the #301 gate now rejects the legacy one unconditionally, so the branch cannot be reconstructed. The residue — one capability described once — is a prose property no honest mechanical rule captures.
- **Refuted alternative:** A heuristic "no two invocations of one capability near each other" check — it would fire on the legitimate repeats (three distinct `record-digest` acts in one stage) and be silenced with exclusions.

## 2026-08-26 — The gate's fence reader tracks marker length, not marker presence

- **Choice:** `codeSpans` records the run length of the open fence and closes only on a marker at least that long with nothing trailing it; a shorter or trailed marker is fence content.
- **Why:** The toggle-on-any-``` reader inverted its own state on an unbalanced inner fence and silently un-gated every invocation after it — three component bodies already nest 4- and 5-backtick fences, so the correct-by-accident balance was the only thing holding the gate up.
- **Refuted alternative:** Ignore any fence marker longer than three backticks — cheaper, but it makes the outer block's contents scannable and would gate the illustrative invocations inside a `markdown` example as if they were real ones.

## 2026-08-27 — The three migration axes retire together at the merge with #257

- **Choice:** Merging `main` (which landed #257 and #252) drops the `#274` verb-vs-standalone axis along with the `#272`/`#273` script-vs-verb axes this branch had already deleted, so `parity.spec.ts` keeps only the durable source-vs-bundle axis plus the real-workspace `derive-entry-diff` case.
- **Why:** #252 built one executable and deleted every standalone launcher, so the `#274` axis has no second artifact to compare against — the same reason this branch's script deletions emptied `#272`/`#273`.
- **Refuted alternative:** Keep `#274` by comparing the executable against itself — a tautology the decision record already rejected for the other axes.

## 2026-08-27 — The distill stage keeps the mode-conditional step, with the quoting rule lifted out of it

- **Choice:** Phase 5.3 keeps this branch's mode-conditional heading and its hub/single-repo/member bullets, but the "each argument its own quoted token" rule moves above them, unconditional, as #257 made it on `main`.
- **Choice detail:** the single-repo bullet now states what it lacks (no anchor sidecars) instead of "no extra argument discipline applies".
- **Why:** Both sides collapsed the same duplication for different reasons; taking this branch's structure and `main`'s unconditional quoting keeps the eight "Phase 5.3–5.5" cross-references valid without narrowing the quoting rule back to hub mode.
- **Refuted alternative:** Take `main`'s single collapsed paragraph — it loses the hub-only anchor-sidecar contract this branch's bullets carry.

## 2026-08-27 — The stale-toolkit remediation names an action, not the retired install document

- **Choice:** The distill stage's `derive-entry-diff` fallback tells the operator to update their Nexus install; the pointer to `docs/features/multi-repo-workspaces/hub-tooling-install.md` goes with the document #257 retired.
- **Why:** A remediation that cites a deleted path is worse than one that cites none.
- **Refuted alternative:** Repoint it at `docs/delivery/release-procedure.md` — that is the maintainer's release runbook, not an operator's install instruction.
