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
