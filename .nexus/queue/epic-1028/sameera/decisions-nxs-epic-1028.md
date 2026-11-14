## 2026-11-14 — Template lookup verb is `nexus template-path <name>`
- **Choice:** A new leaf verb `template-path` prints the absolute location; the release template set moves into `template-lookup.ts` as `RELEASE_TEMPLATES`.
- **Why:** The verb's output is a path a stage reads from, and a leaf verb keeps the invocation gate's dispatch name simple.
- **Refuted alternative:** A `nexus template <name>` verb that prints the template's content, which would hide where the template came from.

## 2026-11-14 — Release template checks run inside the release build
- **Choice:** `buildReleaseTree` calls `assertReleaseTemplates` before it clears `dist/`, and the same checks run as specs.
- **Why:** G17 says the build fails, and the spec-only gate would let `pnpm nexus:build-release` ship a stage asking for an unshipped template.
- **Refuted alternative:** Keep the checks as spec tests only, like the existing template-master gate.
