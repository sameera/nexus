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
