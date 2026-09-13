## 2026-09-13 — Asset modules live in delivery-config, under one `assets` verb
- **Choice:** The store resolution, the publish step and the reference builder are modules of `@nexus/delivery-config`, exposed as subverbs of one `nexus assets` verb.
- **Why:** The store is a publishing target read through that library's key catalogue and precedence chain, and its filers already own the GitHub runner seam the publish step needs.
- **Refuted alternative:** A new `@nexus/asset-store` library with a bare `nexus asset-publish` verb beside `abs-doc-path`; it would duplicate the runner and io seams for three small modules.
