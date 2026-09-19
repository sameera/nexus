## 2026-09-19 — The shared libraries are published, not vendored

- **Choice:** the Nexus package publishes the sources of `workspace`, `delivery-config`,
  `epic-resolve`, `record-digest` and `release-identity` under `@sameeraperera/nexus/lib/<lib>/<mod>`,
  and the teaching repository builds against them.
- **Why:** the teaching stage reads roadmaps out of Nexus epic issues, resolves the delivery config
  and verifies record digests — 2,860 lines of Nexus capability across 23 files. A copy in the new
  repository would drift, and nothing across two repositories could notice when it had.
- **Refuted alternative:** vendoring those 23 files with a recorded upstream commit and a sync
  procedure. It is the option that needs no change to the Nexus package, and it is the option whose
  failure is silent: workspace resolution and epic resolution are exactly what this repository keeps
  changing.
- **Refuted alternative:** publishing the four libraries as npm packages of their own. Four more
  release ladders to answer one consumer's build-time need.

## 2026-09-19 — Source, not a compiled artifact

- **Choice:** the published surface is the `.ts` source, staged flat under `dist/lib/<lib>/`.
- **Why:** that is already how these libraries are consumed — their own `exports` point at `src/`,
  there is no per-library build step, and the consumer's bundler compiles them. A build output here
  would invent a second shape for one library and leave the checkout's shape untested.
- **Refuted alternative:** emitting declarations plus JavaScript. It doubles the published bytes and
  makes the release depend on a per-library build that nothing else in this repository has.

## 2026-09-19 — The staged layout drops `src/`, so a subpath maps by name alone

- **Choice:** `@nexus/<lib>/<sub>` resolves to `lib/<lib>/<sub>.ts`, and a spec pins that every
  declared subpath of every published library already maps that way.
- **Why:** it lets the consumer resolve with one rule instead of a table of subpaths that would need
  an edit every time a library gains a module.
- **Refuted alternative:** preserving `src/` in the staged path. It costs nothing and buys nothing;
  the flattening is what makes the rule a rule.

## 2026-09-19 — The new repository gets its own mirror, not a shared one

- **Choice:** `nxsx` carries its own copy of the component mirror, install location and namespace
  predicate, against the same `.nexus-install.json` record format.
- **Why:** the record format is the contract between the two packages; the code that honours it is
  each package's own. Sharing the implementation would mean the teaching package could not install
  without the Nexus package present at a compatible version, which is the opposite of what shipping
  separately is for.
- **Refuted alternative:** reaching the mirror through the published `lib/` surface. It would put
  Nexus's release cadence in the path of the teaching package's ability to uninstall itself.
