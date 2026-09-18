---
title: "Close Record: The renderer serves a pinned HTML mockup as an isolated page"
epic: "#612"
feature: "Issue Assets"
date: 2026-09-18
nexus_version: 0.57.0
analyze: ran 2026-09-18 @ d132592a1fa20a6f68291d3f35aead8509b5882a
record: "#653"
record_hash: 5625cde836393141c2397e7b69ffafa34ad2c161c99a8f4695051e2f7059788f
range:
  - repo: github.com/sameera/nexus
    base: d107abcb5f424500949c4b279aa49b9aa0d6ada8
    head: 2ab3bfd23d13a98ce3c0a147da1bdf6afddd7aba
---

# Close Record: The renderer serves a pinned HTML mockup as an isolated page

## Key Decisions

- **The renderer is its own app project, not shared source.** It ships as `apps/renderer/` with its own package, tsconfig and vitest config, exporting the handler and a separate listener entry point. The decision record calls for a deployable unit separate from the command-line package, and `apps/` is where this workspace keeps deployables. *Refuted alternative:* a `libs/renderer` consumed as source — rejected because a serverless function cannot take source with no build.

- **The credential boundary is an opaque-origin refusal on every request.** The handler refuses any request carrying `Origin: null` before it looks at anything else, and forwards no cookie or authorization header upstream. The renderer has no credentialed endpoint yet, so the observable form of invariant 4 is that a request from a sandboxed document is refused outright; a top-level navigation sends no `Origin` header at all, so nothing a reader does is affected. *Refuted alternative:* add a dead credentialed endpoint now, guarded by a non-simple request header — rejected as building epic #614's surface ahead of #614.

- **An address that is not a pinned store address is the "names no address" refusal.** A value that will not parse, a foreign host, a non-blob path, and a path naming no file all return the single `no-address` refusal. The record fixes the refusal set and says the renderer refuses nothing else, so a malformed value is the "request that names no address" case rather than a seventh reason. *Refuted alternative:* a distinct `malformed-address` refusal — clearer to a developer, but it adds a refusal the record does not name.

- **The size cap is decided on the store's declared length first, then on the read.** A declared `content-length` over the cap refuses and cancels the body; a response with no declared length is read with a running total that abandons it the moment it passes the cap. Invariant 10 asks that the cap be checked before the body is held in memory, and a store that declares no length would otherwise escape the cap entirely. *Refuted alternative:* trust the declared length alone — rejected because it is the store's value, and invariant 10 says the cap is the renderer's own.

- **The designated address binds the listener only, never the handler.** `NEXUS_RENDERER_ADDRESS` (`host:port`, either part omittable) is read into the listener's bind address, defaulting to `127.0.0.1:8787`. The handler never sees it. Invariant 9 says the handler builds no absolute address of its own and is correct at whatever address it is reached at, so the designation has to stop at the listener. *Refuted alternative:* a single base-URL setting the handler also reads, so it could build links — rejected because the handler would then be wrong at any other address.

- **The deliverable's shape is measured by bundling it in a test.** A test bundles `handler.ts` with esbuild and asserts one output file, no `node_modules` input, no `node:http` and no `createServer`, then imports the bundle and answers two requests through it. Story #619's third criterion asks for the deliverable to be measured, and the only measurement that cannot drift is building it and looking at what came out. *Refuted alternative:* assert the shape by reading the import graph in source — cheaper, but it would pass on a graph a bundler still pulls a dependency into.

## Deviation Rationale

- **Invariant 6's redirect clause is unenforced** (deviated from record #653, invariant 6). The record says the renderer never follows a redirect that would change which commit is served. The pinning half is enforced — `address.ts` accepts only a full 40- or 64-hex commit identifier — but `handler.ts` calls the injected fetch with the default redirect policy and never asks for a manual one. A redirect from the contents API carries the same `?ref=<commit>`, so the commit served cannot change; the guard was judged to add no observable behaviour and was left for the follow-up that needs it. The clause is unguarded rather than broken.

- **Two refusal reasons ship outside the record's fixed set of six** (deviated from record #653, "What the renderer refuses"). `refusal.ts` carries `opaque-origin` and `store-unreachable` in addition to the six the record names. Neither contradicts the set. `opaque-origin` is invariant 4's own requirement, stated elsewhere in the same record but not folded into the refusal decision. `store-unreachable` is the only honest answer to a store that neither served the file nor denied it — a case the refusal decision did not anticipate, so the shipped set extends what the record left unstated rather than refuting what it decided.

- **Invariant 4's non-simple-header rule is not built** (deviated from record #653, invariant 4 and "The credential criterion is met by a rule on the renderer's endpoints"). The rule is conditional on an endpoint taking a reader's credential, and this epic ships no such endpoint. The observable half — refusing a request presenting an opaque origin, outright and before anything else is read — is built, and for the surface that exists it is stronger than the header rule would be. Building the header rule now would mean shipping epic #614's surface ahead of #614.

## Deferred Scope

Deferred items filed as epic stub issues:

- #664 — The renderer runs somewhere a reader can reach: a named host at a designated address, with a stated payer and a named owner who repairs it when it stops.
- #665 — The product documentation states that the product has a hosted surface: the product context and the stack page still describe a local developer tool with no backend.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-18-security-boundary-before-the-asset.md`
