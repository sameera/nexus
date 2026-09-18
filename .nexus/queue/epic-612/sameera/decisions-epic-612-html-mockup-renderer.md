## 2026-09-18 — The renderer is its own app project, not a lib

- **Choice:** `apps/renderer/`, with its own package, tsconfig and vitest config, exporting the handler and a separate listener entry point.
- **Why:** The decision record calls for a deployable unit separate from the command-line package, and `apps/` is where this workspace keeps deployables.
- **Refuted alternative:** A `libs/renderer` consumed as source — rejected because a serverless function cannot take source with no build.

## 2026-09-18 — The credential boundary is an opaque-origin refusal on every request

- **Choice:** The handler refuses any request carrying `Origin: null` before it looks at anything else, and forwards no `Cookie` or `Authorization` upstream.
- **Why:** Invariant 4 asks that no endpoint treat an attached cookie as authorization. The renderer has no credentialed endpoint yet, so the observable form of the rule is that a request from a sandboxed document is refused outright — a top-level navigation sends no `Origin` header at all, so nothing a reader does is affected.
- **Refuted alternative:** Add a dead credentialed endpoint now, guarded by a non-simple request header — rejected as building epic #614's surface ahead of #614.

## 2026-09-18 — An address that is not a pinned store address is the "names no address" refusal

- **Choice:** A value that will not parse, a foreign host, a non-blob path, and a path naming no file all return the single `no-address` refusal.
- **Why:** The decision record fixes the refusal set at six reasons and says the renderer refuses nothing else; a malformed value is the "request that names no address" case rather than a seventh reason.
- **Refuted alternative:** A distinct `malformed-address` refusal — clearer to a developer, but it adds a refusal the record does not name.

## 2026-09-18 — The size cap is decided on the store's declared length first, then on the read

- **Choice:** A declared `content-length` over the cap refuses and cancels the body; a response with no declared length is read with a running total that abandons it the moment it passes the cap.
- **Why:** Invariant 10 asks that the cap be checked before the body is held in memory, and a store that declares no length would otherwise escape the cap entirely.
- **Refuted alternative:** Trust the declared length alone — rejected because it is the store's value, and invariant 10 says the cap is the renderer's own.
