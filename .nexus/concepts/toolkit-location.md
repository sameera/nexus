---
title: "Toolkit Location"
aliases: ["by-name toolkit addressing", "second toolkit", "python toolkit", "self-locating entry point", "no repository-relative toolkit path", "toolkit found on the path"]
touches: ["component-invocation-gate", "verb-reachability", "publishing-config-resolution", "target-root-convention", "release-identity", "release-gate", "delegating-port"]
last_updated_by: "#351"
status: active
verification: verified
---

# Toolkit Location

Nexus ships two toolkits, and every invocation names the one it wants rather than encoding where it lives. Each half locates the other by name too, so a lookup resolves against wherever the toolkit is installed — never against a copy sitting inside the repository being acted on.

## How It Works

Both toolkits are self-contained artifacts built by the same pipeline and published under the binary name each declares, so a caller names a toolkit and a capability and nothing else. Two artifacts rather than one multi-call bundle switching on the invoked name is deliberate: some package managers link a declared binary while others generate a shim that erases that name, so the switch would pick the wrong toolkit on one installer.

Locating a toolkit takes the same two steps in both directions. The installed name on the caller's path is consulted first, the ordinary case. Failing that, a caller may fall back to the entry point shipped beside its own source — which says where the toolkit is, never where the work is. A location inside the repository being acted on is not a candidate, save for a harness driving one named checkout. When neither resolves, the caller reports an absent toolkit and names the remedy, rather than a missing file inside the user's repository.

## Key Invariants

1. Every invocation names a toolkit and a capability, never a path to a toolkit file and never an inherited interpreter, whatever the runtime.
2. A toolkit is found by its installed name first; the only fallback is the entry point beside the caller's own source, never a location inside the repository being acted on — save a harness, which is no shipped body, driving one named checkout. A caller able to import the capability locates nothing, its lookup retired rather than repointed.
3. A toolkit that cannot be found is reported as an absent toolkit with the remedy named, never as a missing file in the user's repository.
4. A best-effort lookup over a located toolkit yields an empty answer on every failure mode, and a non-zero exit is inspected deliberately rather than left to unparseable output.
5. A checkout declaring nothing for such a lookup to read spawns no subprocess at all.
6. A capability finds its sibling files through its own packaging, never through a layout describing where it was once deployed.

## Integration Points

- [component-invocation-gate](component-invocation-gate.md) — enforces this rule in every shipped body at build time, so a migrated body cannot regress to a path.
- [verb-reachability](verb-reachability.md) — that rule decides which capabilities become reachable names; this one decides how a named toolkit is then found at invocation time.
- [publishing-config-resolution](publishing-config-resolution.md) — its callers import it now rather than locating it; this rule still governs how bodies and stages address its toolkit.
- [delegating-port](delegating-port.md) — the name this rule holds fixed is what a port moves its implementation behind without rewriting a body or stage.
- [target-root-convention](target-root-convention.md) — the complement: that convention says where a capability's project lives, this one says where its toolkit lives.
- [release-identity](release-identity.md) — applies this same self-locating rule to the release's version declaration, walking up from the reader's own position rather than assuming a layout.
- [release-gate](release-gate.md) — enforces this rule at release time: no tag or publish while a shipped body still names a path.

## Decision Log

### 2026-08-26 — #249 — Two toolkits, each named, neither reaching into a repository for the other

The second toolkit was given one name and a dispatcher of its own rather than being rewritten into the first: every one of its imports is standard library, so a rewrite would have reduced the toolkit count without enabling anything the installation needed. Its home moved out of the deployed component tree, because that tree is where components are installed, not where toolkit code lives, and the payload ships the two halves separately. No compatibility shim was left behind at the old locations: a shim could only have reached the moved capabilities through a repository-relative hop, which is precisely the addressing this work exists to delete — so the invocation strings inside Nexus's own component bodies were knowingly left naming deleted files, an interval that closes when the name reaches an installed path. In the other direction the candidate-file search — this repository's copy, then a hop into a sibling directory — was replaced by resolution by name, since a hub and a member now reach the same install the same way. Refuted alternatives: keeping shims until the invocation rewrite lands; and a dedicated locator package, which would have bought nothing but build wiring over an export on the package both callers already depend on.

### 2026-08-26 — #251 — Reciprocal link from release-identity

The release's one version declaration is reached the same way a named toolkit is: by walking up from the reader's own file position, so no layout is written down. Recorded here as the reciprocal edge.

### 2026-08-27 — #257 — The last in-repository toolkit copy is deleted, closing the rule's exception

The addressing rule was stated before the thing it forbids had been removed: a repository could still hold its own copy of the toolkit, and component bodies still carried a second invocation naming that copy beside the one that actually runs. Both are now gone — no build step writes a toolkit into a target checkout, nothing exports such a location, and the parenthetical telling a reader where the in-repository copy sits was struck from every component body that carried it. The rule therefore stops being aspirational: a location inside the repository being acted on is not merely disfavoured, it no longer exists to fall back to. The placeholder standing for a toolkit's location was deliberately left undefined rather than given a value, because defining it means naming the install this work does not build, and a definition invented here would be wrong the moment the real one lands. Refuted alternative: define the placeholder now against the expected install path, which reads as finishing the job but writes down a layout nothing yet produces.

### 2026-08-27 — #252 — By-name addressing becomes a release precondition

Addressing a capability by name was a convention every new body had to follow and nothing checked, which was tolerable while every body ran from a checkout. Publishing removes that tolerance: a path reference that resolves in a source tree resolves nowhere in an installed package, so the convention became the one thing standing between a release and bodies that cannot run for the adopter who installed them. Holding the tag and the publish until every shipped body addresses its capability by the toolkit's declared name is what converts the convention into a guarantee at exactly the moment it starts to matter. Refuted: leaving it a convention and catching violations in review, which costs nothing to set up but puts the whole weight of an adopter-visible failure on a reviewer noticing one line.

### 2026-08-27 — #250 — The rule reaches every shipped body, and one addressing form leaves one instruction

Seventy-nine invocations across twenty-three bodies were rewritten to name a toolkit, which is what turns this page's first invariant from a rule the code obeys into a rule the bodies obey; the interpreter is now named rather than inherited, because a body naming an inherited interpreter resolved to whatever the operator's machine meant by it, and a third of the sites also wrote a path that only resolved from inside one directory. The maintainer's from-source route was kept but pushed out of the shipped bodies into the repository's own documentation, so a body carries one form and a reader has no variant to choose between. The acceptance harness is the deliberate exception: it resolves everything from a checkout it is handed so it can drive a repository other than the one it runs in, and requiring the installed name would make it depend on an install step it does not perform — an exception that holds because the rule governs shipped bodies and installed callers, and a harness is neither. With one addressing form left, the two-branch prose that told a reader to pick an invocation by the shape of their repository collapsed to one instruction, its mode-conditional content restated as conditions on arguments rather than on the toolkit's name. Refuted: collapsing that prose in the same pass as the rewrite — fewer passes over the same lines, but it fuses an addressing change with a de-duplication that needs its own reading, and the mode-conditional instructions were the thing most likely to be dropped silently.

### 2026-08-28 — #351 — Both toolkits are bundled artifacts under their declared names, and an imported capability locates nothing

The second toolkit stopped being a set of plain files held out of the collapse because they needed nothing installed: it is now built by the same pipeline into a self-contained artifact under the binary name it already declared, so only the file the name points at moved and nothing downstream changed. Two artifacts were chosen over one multi-call bundle keyed on the invoked name because that name is not reliably observable — some package managers link the binary, others generate a shim that erases it — and a dispatch that silently picks the wrong toolkit on one installer is not worth a saved file. Separately, where a capability became a library its caller already depends on, the source-side lookup was retired rather than repointed: there is no longer any question of how a checkout with nothing installed runs an entry point, because nothing needs to. **Refuted alternative:** repoint the source-side fallback at the new entry, holding the blast radius to zero — refused because it then requires choosing how a checkout with no build output runs source, which is machinery in service of a path this decision deletes.
