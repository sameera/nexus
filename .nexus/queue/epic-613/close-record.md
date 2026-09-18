---
title: "Close Record: A filed issue's HTML asset links to a configured renderer"
epic: "#613"
feature: "Issue Assets"
date: 2026-09-18
nexus_version: 0.57.0
analyze: ran 2026-09-18 @ e4e95ac019b32fff81bc04192042d4adabf50e36
record: "#627"
record_hash: e90db6271736a55e8465e3671489d6288d5732ba73d932862ce15e560f1a1f89
range:
  - repo: github.com/sameera/nexus
    base: 13dbb434b93e8b0fdc14d85936b0b97e79b63c0b
    head: d107abcb5f424500949c4b279aa49b9aa0d6ada8
---

# Close Record: A filed issue's HTML asset links to a configured renderer

A team can now name the renderer its HTML mockups are read through, by declaring one address template in the publishing block of its settings or on a hub. When a filing stage publishes an HTML asset for a repository that declares a template, the issue body carries that template's address with the asset's commit-pinned address substituted into its one slot, so a reviewer opens the mockup as a page instead of reading its markup. Every other asset kind, and HTML in a repository that declares nothing, keeps exactly the reference it had before. The intake answer reports the resolved renderer, so the approval gate states which of the two forms will be filed before the issue exists, and it warns without refusing when the store is private and a renderer is named. A declared template that is not an absolute address, or that carries no slot, stops the run by name before any draft is written.

## Key Decisions

- **The key is named `asset-renderer` and its slot is the literal `{url}`.** It keeps the naming family the store and the size cap already established, and that slot spelling is the one the preview services this epic targets already use, so a template pasted from a browser address that worked needs no editing. The refuted alternative was a name for the content type with a printf-style slot: more precise about what it renders, but outside the family the resolver's catalogue groups by, and it would force every team to rewrite the slot by hand.

- **The template is the reference builder's second input, not its last.** Every production caller passes a renderer and none passes a label, so the required input sits where a caller cannot forget it. The refuted alternative was to append it after the optional label, leaving existing call sites untouched — smaller, but it makes the new input optional in practice, which is the shape decision record #627 refused.

- **The visibility guard was replaced, not relaxed.** The old test pinned the builder's input count as a proxy for "no visibility reaches this code", and this epic necessarily adds an input, so the proxy had to go. Its replacement reads the builder's own source with comments stripped and asserts that no word describing the store's visibility survives in the code, kept alongside the behavioural test that a public store and a private store yield the identical reference. Stripping comments is load-bearing: the module's doc comment explains why visibility is absent, so a check over the raw text would forbid the very explanation the invariant wants written down. The refuted alternative was matching identifiers through a parser — more precise, but it adds a dependency to a guard whose whole value is being obvious.

- **The intake answer carries the renderer in both of its shapes.** The gate's job is to state the form before approval, and a repository that declares a renderer but no store still tells the lead something true. The refuted alternative was to add the field to the declared answer alone: a smaller change, but then an absent field means both "no renderer" and "no store", and the digest has to branch on which.

- **The post-publish statement names the HTML files it applies to.** One console line naming the form and listing the published HTML file names, fired only when the run published at least one HTML asset. The lead reads that line after the fact to confirm what was filed, and the file names are what they would check on the issue. The refuted alternative was one line per asset, which reads the same for one file and is noise for five.

## Deviation Rationale

- **The malformed-template stop runs in the publish and rewrite subverbs as well as at intake** (deviates from record #627, "a declared template that cannot work stops the run at intake … validated once when the asset list is checked"): both subverbs are reachable directly, without intake having run. Left unguarded they would build an address from a value intake would have rejected, filing exactly the broken reference the stop exists to prevent. The record's intake stop is present and unweakened; this adds the same stop on paths the record left unstated.

- **The renderer field is emitted on the unsupported intake answer, not only the declared one** (deviates from record #627, whose illustrated shape is the declared answer): the record's own stated purpose is that the gate always states the form, and a field that appears only sometimes is one the digest has to branch on. A side effect the record does not address: because the renderer is now resolved before the store, a repository with no store and a malformed template exits non-zero from the check where it previously printed the unsupported answer and exited zero.

- **The one-slot rule is documented but not enforced** (deviates from record #627, "the template has one slot"): the shipped skill documentation tells teams the value must carry exactly one slot, and the resolver only tests that the slot is present while the builder substitutes every occurrence. A two-slot template therefore passes validation and yields the pinned address twice. Nothing the record decided is inverted — the single-slot decision is implemented correctly for every well-formed value — but the shipped prose asserts a check the code does not perform, so a team is told something untrue about their own configuration. Filed as deferred scope rather than fixed here, because the epic's stories were complete and the fix is a guard of its own.

One item the conformance receipt raised was checked and is **not** a deviation: it read a single version bump across the range diff, but each of the two commits carries its own bump and its own changelog entry, which is the repository's stated rule of one bump per substantive change in the same commit.

## Deferred Scope

Deferred items filed as epic stub issues:

- #663 — A renderer template with more than one slot is refused: the resolver tests only that a slot is present and the builder substitutes every occurrence, while the shipped documentation states exactly one is required.

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-18-html-asset-rendered-reference.md`
