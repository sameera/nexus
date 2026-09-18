## 2026-09-18 — The key is named `asset-renderer` and its slot is `{url}`

- **Choice:** The catalogue row is `asset-renderer`, and the template's one slot is the literal `{url}`.
- **Why:** It keeps the `asset-*` family the store and the size cap already established, and `{url}` is the slot spelling the preview services this epic targets use, so a template pasted from a working browser address needs no editing.
- **Refuted alternative:** `html-renderer` with a `%s`-style slot — it names the content type more precisely but leaves the key outside the family the resolver's catalogue groups by, and the slot would have to be rewritten by hand.

## 2026-09-18 — `renderer` is the second positional argument, not the third

- **Choice:** `assetReference(asset, renderer, label?)` — the template displaces `label` to third.
- **Why:** Every production caller passes a renderer and none passes a label, so the required argument sits where a caller cannot forget it; an options object was refuted by the record.
- **Refuted alternative:** Append `renderer` after `label`, leaving existing call sites untouched — it makes the new input optional in practice, which is the shape the record refused.

## 2026-09-18 — The visibility guard reads the source with comments stripped

- **Choice:** The replacement for the arity assertion reads `asset-reference.ts`, strips block and line comments, and asserts no visibility word survives in the code.
- **Why:** The module's doc comment legitimately explains why visibility is absent, so a check over the raw text would forbid the very explanation the invariant wants written down.
- **Refuted alternative:** Match on identifiers only via a parser — more precise, but it buys nothing here and adds a dependency to a guard whose whole value is being obvious.

## 2026-09-18 — The template is validated in every subverb that resolves it, not only at intake

- **Choice:** `check`, `publish` and `rewrite` each stop on a malformed template.
- **Why:** The record puts the stop at intake, but `publish` and `rewrite` are reachable directly; letting them build an address from a value intake would have rejected would file exactly the broken reference the stop exists to prevent.
- **Refuted alternative:** Validate only in `check` — smaller, but it makes the guarantee depend on the caller running intake first.
