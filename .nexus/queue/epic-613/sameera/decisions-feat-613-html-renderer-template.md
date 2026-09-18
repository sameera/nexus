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

## 2026-09-18 — The intake answer carries `renderer` in both of its shapes

- **Choice:** `check` prints `renderer` on the unsupported answer as well as the declared one.
- **Why:** The gate's job is to state the form before approval; a repository that declares a renderer but no store still tells the lead something true, and a field that appears only sometimes is one the digest has to branch on.
- **Refuted alternative:** Add `renderer` to the declared answer alone — smaller diff, but it makes "no field" mean both "no renderer" and "no store".

## 2026-09-18 — The post-publish statement names the HTML files it applies to

- **Choice:** One console line naming the form and listing the HTML file names published, fired only when the run published at least one HTML asset.
- **Why:** The lead reads the line after the fact to confirm what was filed, and the file names are what they would check on the issue; the record requires silence on a run with no HTML.
- **Refuted alternative:** One line per HTML asset — it reads the same for one file and is noise for five.
