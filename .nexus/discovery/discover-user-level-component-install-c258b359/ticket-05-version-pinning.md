---
title: "Does a repo keep the ability to pin the Nexus component version it runs?"
type: council
status: resolved
blocked_by: [ticket-04-who-installs-nexus.md]
claimed_by: sameera
claimed_at: 2026-08-15T14:31:00Z
---

## Question

Committing the components into the repo gives three properties for free. The repo pins an exact
component version. A component change appears in a diff and can be reviewed. Any checkout of the
repo, including a continuous-integration checkout and a git worktree, carries the components with
it.

A shared install gives one component version per machine and drops all three properties. Decide
whether Nexus keeps any of them, and by what mechanism.

The options to weigh include: drop pinning entirely and accept one version per machine; keep a
declared version in the repo that the shared install checks itself against and refuses or warns on
mismatch; or keep pinning only for repos that ask for it.

## Why it blocks

A pinning mechanism is its own goal with its own stories. A declaration file, a version check, and
a mismatch behaviour are work that only exists if this decision says pinning survives. The
migration question also depends on the answer, because a repo can only stop carrying its components
once it is clear what replaces the guarantee they gave.

## Evidence

### From `nxs-pm`, 2026-08-15

**The question's premise no longer holds after decision 04.** The components and the executable ship
in one artifact. The component payload sits beside `nexus.mjs`, named by
`COMPONENT_PAYLOAD_DIRNAME` at `libs/portable-tools/src/vendor-components.ts:27` and resolved by
`defaultPayloadDir()` at `libs/portable-tools/src/nexus-cli.ts:54-56`, and
`libs/portable-tools/bundle-fingerprint.json` already carries a `claude-components` key beside the
six bundle hashes. A component body and the verb it calls therefore cannot be at different versions.
Ticket 03 handed this ticket "the interface between a pinned repository and an installed toolkit",
and after decision 04 there is no pinned repository side to that interface.

**The surface that can genuinely drift is repo-resident data**, not the component set:
`.nexus/config/settings.yml`, the queue entry shape, the concept and anchor page schema, the
documentation-root layout, and the GitHub issue conventions. That surface moves about five times more
slowly than the components. Ninety-seven of two hundred and eighty-five commits in six months touch
`.claude/`, while twenty touch `.nexus/config/`, and `.nexus/config/settings.yml` has four commits in
its entire life.

**Nexus already absorbs that drift in the opposite direction from pinning.** `/nxs.close` carries
dual-shape handling for old-contract queue entries at nine separate sites in
`.claude/commands/nxs.close.md`. The working mechanism is a newer toolkit reading older repository
data. It is not an older toolkit frozen by a repository.

**A version mismatch has three failure classes, and only one hurts.** A missing verb or flag fails
loudly, because `nexus-cli.ts:84` prints a diagnostic and returns exit code 2, and the command bodies
already stop on a non-zero exit. An unrecognised configuration key fails loudly, because the schema
is closed and `libs/workspace/src/manifest.ts:80` reports any unknown key as an error. A change in
component prose that makes a stage decide differently fails silently, and that is the class that hurt
for five months unnoticed. A version check cannot fix the silent class. It can report that two
numbers differ, but it cannot report that a decision differed, so unless the check refuses outright
the divergent artifact is still produced.

**The harm from dropping the pin is uneven across the personas.** For the solo maintainer the
evidence actually shows, a pin makes things worse rather than better, because it institutionalises
the six divergent component sets already measured. For the team sharing one repository, the harm that
matters is two people running different toolkits and producing differently shaped artifacts into one
pull request. That case is real but hypothetical today. For continuous integration the harm is zero,
because no workflow in any repository invokes the components.

The product perspective recommended recording the running version in `.nexus/config/settings.yml`
under a toolkit-written `nexus.version` key, adding an optional human-authored `min-version` floor
that refuses when the running toolkit is older, one version identity across both toolkits, and
tiering the verbs into a public and an internal set for documentation rather than for compatibility.
It named the loss of component review in the adopter's diff as the largest cost, and it required the
changelog to describe behaviour changes to pipeline stages in adopter language as the only surviving
replacement.

### From `nxs-architect`, 2026-08-15

**There is no version anywhere in the tree today.** The root `package.json:3` reads `1.0.0` on a
private monorepo, `libs/portable-tools/package.json` reads `0.0.1`, and neither has been bumped.
`libs/portable-tools/bundle-fingerprint.json` records content hashes, so it detects a shipped
artifact that lags its source. It never answers which release is installed.

**The verb surface is an internal interface of one release artifact, so its control is a test rather
than a version number.** A component body naming a verb that does not exist is a broken build, not a
version mismatch, because nothing installs the two halves separately. The architecture perspective
recommended a build-time gate asserting that every toolkit invocation string in a shipped component
body resolves to a declared verb, riding the existing parity slot at
`libs/portable-tools/src/parity.spec.ts` and `bundle-fingerprint.json`. It called this the
highest-value item in the ticket, because it converts forty-five hard-coded invocation strings from
prose that rots silently into a checked reference, which is what ticket 03's partial-migration risk
needs.

**The property "any checkout carries the components with it" is already broken.** In the `--pr`
analyze flow the scripts run from the outer checkout with the worktree passed as data
(`.claude/commands/nxs.analyze.md:57`), so the components come from the session repository. In the
close-to-distill handoff the operator changes directory into the worktree
(`.claude/commands/nxs.close.md:913`), so the components come from a distill branch cut from trunk
rather than from the pull request. Two flows resolve two different component sources, and neither is
the version the epic was planned under. A per-machine install makes the answer the same from every
checkout.

**No repo-bound format carries a schema version.** The concept and anchor frontmatter keys are
hard-coded at `libs/portable-tools/src/validate-concepts.ts:404-446`. The `analyze-receipt.md`
frontmatter at `.claude/commands/nxs.analyze.md:283-292` records the epic, date, head, mode, record,
record hash, and findings, and carries no writer identity. The two GitHub machine blocks, on the pull
request review at `.claude/commands/nxs.analyze.md:317-325` and on the close comment at
`.claude/commands/nxs.close.md:802-836`, leave the repository entirely, so no repository-side pin
ever covered them. A queue entry written by one version and drained by another is therefore the real
compatibility risk, and it is live today.

**The sharpest instance is the record digest.** The canonicalisation rule of `nxs-record-digest` is
declared frozen for the lifetime of any stamped receipt, and widening it is stated as a contract
change requiring every receipt stamped under the old rule to be regenerated. No artifact records
which toolkit stamped it, so a rule change would silently invalidate every in-flight receipt on the
machine.

**Nexus already handles format drift by feature detection and gated migration, not by version
compare.** `/nxs.distill` stops and names the remedy when `derive-entry-diff.mjs` is absent
(`.claude/commands/nxs.distill.md:357-361`). `delivery_config.py:45-50` treats `settings.yml` as
canonical with a legacy `config.yml` fallback. The `nxs-close-migration` skill copies, commits,
verifies byte-for-byte, and only then removes behind a gate.

**The existing enforcement ladder has four rungs.** The drain hard-blocks on a record-digest mismatch
with no waiver, because it writes permanently into the knowledge store
(`.claude/commands/nxs.close.md:922`). `/nxs.close` detects a missing or stale receipt and requires
an explicit waiver whose text is stamped into the close record
(`.claude/commands/nxs.close.md:310-326`). `/nxs.distill` refuses and names the remedy for an absent
capability. `read_hub_defaults` degrades silently for an advisory layer
(`delivery_config.py:460-482`).

**On one identity or two,** `delivery_config.py` is the evidence and it argues against negotiation.
The Python half already crosses the runtime boundary by shelling to a Node verb and parsing its
output (`delivery_config.py:417-437`), and it deliberately collapses every failure to an empty
result so the hub layer can never break publishing (`delivery_config.py:460-482`). Two independently
versioned toolkits would force exactly the negotiation that code exists to avoid.

**The architecture perspective refuted the repo-declared version directly.** A stamp is written by
the toolkit and a declaration is authored by a human. A human-authored declaration must be bumped by
someone, nobody will, every repository drifts to a permanent warning within two releases, and the
warning becomes noise. That is staleness re-created in a new file.

**It raised one blocker and one clarification.** The blocker is that ticket 09 can invert the
reasoning: the claim that no mismatch is possible holds only while there is exactly one component set
per machine, and if a Nexus Prime session cannot reach the shared install then a repo-local fallback
returns and a second component set exists. The clarification is whether "one component version per
machine" means per machine or per user, which changes what the duplicate-copy guard compares across
and changes the precedence rule ticket 06 decides.

## Resolution

- **Decided:** A repo keeps no version pin, and no file authored in a target repo names a Nexus
  version. Of the three properties the ticket lists, one survives in a changed form, and two are
  given up and named. What replaces the pin is six things.

  1. **One release identity, installed as one unit.** One semantic version covers the TypeScript
     executable, the Python toolkit, and the component payload together. The Python toolkit carries
     no version of its own. A `version` verb reports that identity, the component payload
     fingerprint, and the `python3` interpreter it resolved together with that interpreter's version.
  2. **A writer stamp replaces the pin.** The toolkit stamps its own version onto the artifacts it
     already stamps: `analyze-receipt.md`, the close record, and both GitHub machine blocks. A stamp
     is written by the toolkit and cannot go stale, and it travels with the artifact rather than with
     the repo, which is what covers the GitHub-side blocks that no repository-side pin ever reached.
  3. **The verb surface is guarded by a build-time gate, not by a version number.** Every toolkit
     invocation string in a shipped component body must resolve to a declared verb, checked in the
     Nexus repository on the existing parity and fingerprint gate. The verbs are not tiered into a
     public and an internal set as a compatibility contract, because the release has no consumer
     outside itself. A documented help surface is worth building for onboarding, and it is a separate
     goal that carries no compatibility promise.
  4. **The repo-bound and GitHub-bound data formats become the versioned contract instead.** They are
     additive only, an unknown key is ignored wherever the reader can safely ignore it, and a
     breaking change requires a gated migration in the shape `nxs-close-migration` already uses.
     Compatibility is established by feature detection, which is the mechanism `/nxs.distill` and
     `delivery_config.py` already use, and not by comparing version numbers.
  5. **Enforcement follows the ladder Nexus already has.** An environment defect refuses and names
     the remedy: two copies of one component on a machine, which ticket 02 already ruled a defect,
     and a missing `python3`, which decision 03 made a hard prerequisite. A difference between the
     version that wrote a repo artifact and the version reading it warns once, names both versions,
     and proceeds. That difference escalates to a recorded waiver at `/nxs.close`, which already owns
     waiver machinery, and to a hard block at the drain, which already has no waiver. A version
     difference alone never causes a blanket refusal.
  6. **The environment guard lives in the executable's argument dispatcher.** It writes to standard
     error only. It never alters an exit code and never writes to standard output, because every verb
     contract is that success prints exactly one JSON object on standard output and forty-five sites
     parse it.

  The review property survives only in a changed form. A component change no longer appears in the
  adopter's diff, so the changelog becomes the only carrier of what changed in how a pipeline stage
  behaves. The changelog must therefore describe behaviour changes to stages in adopter language
  rather than describing code changes. That obligation is load-bearing and is bound work, not release
  hygiene.

- **Why:** Decision 04 dissolved the boundary the pin was protecting. The components and the verbs
  now ship in one artifact, so a component body and its verb table cannot be at different versions,
  and the interface ticket 03 handed this ticket has no second party. What is left in the repo is
  data, not components, and data drift is a different problem that a component-version pin only ever
  covered by accident. It never covered the two GitHub machine blocks at all, because those are not
  in any repository. The three failure classes settle how much mechanism is warranted: a missing verb
  and an unrecognised configuration key both already fail loudly with a diagnostic, and the one class
  that fails silently is a change in what a stage decides, which no version check can detect. Nexus
  also already has a working answer to format drift, and it runs in the opposite direction from
  pinning: `/nxs.close` reads old-contract entries at nine sites, `/nxs.distill` detects an absent
  capability by looking for it, and `nxs-close-migration` gates a format move. The newest toolkit
  reading older data is the pattern that works, and freezing a repo at an old toolkit is the pattern
  that produced the six divergent component sets this refactor exists to remove. Finally, the
  property "any checkout carries its components" is scored as a loss only if it currently holds, and
  it does not. The `--pr` analyze flow and the close-to-distill handoff already resolve components
  from two different places, neither of which is the version the epic was planned under.

- **Refuted alternative:** Keep a declared version in the repo that the shared install checks itself
  against. It loses on who maintains it. A declaration is authored by a human, it must be bumped by
  someone whenever the toolkit moves, nobody will bump it, and every repository drifts into a
  permanent warning that becomes noise within two releases. That is the same staleness decision 04
  exists to remove, relocated into a new file. Making the toolkit write the declaration instead does
  not save it, and this is the point neither perspective carried to its conclusion: a
  toolkit-written version line inside a committed repository file produces one commit in every
  repository on every release, which is exactly the commit churn decision 04 removes. A stamp on an
  artifact avoids this because the artifact is being written anyway.

  A second refuted alternative is keeping pinning only for repos that ask for it, read as a
  repository causing a particular toolkit version to be present. That is a second component set on
  one machine, and ticket 02 already ruled two copies of one component a defect rather than a
  supported configuration. A configuration key does not convert a defect into a supported
  configuration.

  A third alternative, the optional minimum-version floor that refuses when the running toolkit is
  older, is **deferred rather than refuted**. It is coherent, and it is monotone in the right
  direction, because it only ever rejects a toolkit that is too old and so cannot block an upgrade.
  It is not built now because the harm it addresses is two people running different toolkits against
  one repository, and adoption today is single-maintainer with no continuous-integration workflow
  invoking any stage. Building it now would be mechanism ahead of the decision it serves. The
  revisit trigger is named: a second person working one repository, or a continuous-integration
  workflow invoking a pipeline stage. It is cheap to add later because it is one configuration key
  and one comparison in the guard that decision point 6 already places.

- **Resolved by:** sameera on 2026-08-15

### What this binds, and what it hands to other tickets

**One ordering gate.** The writer stamp must land before the shared install ships. The
`nxs-record-digest` canonicalisation rule is declared frozen for the lifetime of any receipt stamped
under it, and widening it requires regenerating those receipts. No artifact records which toolkit
stamped it today, so without the stamp a rule change silently invalidates every in-flight receipt on
the machine, and nothing can detect which receipts are affected.

**One constraint that binds ticket 09.** The reasoning above holds only while exactly one component
set exists per machine. If ticket 09 finds that a Nexus Prime session cannot reach the shared
install, a repo-local component copy returns and a second component set exists. In that case the
constraint is that the copy is written by the installer and is a cache of the same release. It is
never authored in the repo, and the repo never chooses which version sits there. A cache is not a
pin, and this decision refuses the pin in either outcome.

**Ticket 06 loses an inherited justification.** If a repository never dictates which toolkit runs,
coexistence of the two installation modes needs a fresh reason beyond a one-time migration window.
Ticket 06 must supply that reason rather than assume it.

**Ticket 07 inherits the duplicate-copy rule.** A hub-vendored bundle plus a machine install is two
copies of one component on one machine. Ticket 07 must choose one location, and the guard in
decision point 6 is where the collision is reported. Whatever ticket 07 chooses must not create a
second toolkit copy that is refreshed by hand and can therefore read a format the installed toolkit
no longer writes.

**Ticket 10 inherits two requirements.** The channel must carry one semantic version that names the
whole release, both toolkits and the component payload together. The channel must also support
installing and holding an explicit older version on a machine, because that is the only regression
recourse this decision leaves. Per-repo version staging is gone, so per-machine version selection is
the replacement and it must exist.
