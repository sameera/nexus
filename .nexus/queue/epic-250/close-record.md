---
title: "Close Record: Rewrite every component invocation to name a toolkit, behind a build-time gate"
epic: "#250"
feature: "Component Distribution"
date: 2026-08-27
nexus_version: 0.1.0
analyze: ran 2026-08-27 @ 4aa418c6dc39163345ace569582fa581480f3e16
record: "#325"
record_hash: b4c02eedcdc8089d7943145214dd9abc80feb6e2ff52a77245b4b4ed1b4fec2a
range:
  - repo: github.com/sameera/nexus
    base: f54518b85be1d7b1fea7c27029bd4fd2c17dcb56
    head: 8ee682107a3097934430d04aa723a71cfbeeac59
---

# Close Record: Rewrite every component invocation to name a toolkit, behind a build-time gate

## Key Decisions

- **The Python toolkit's machine surface is a flag, `nexus-gh --capabilities`, emitting sorted JSON.**
  A flag cannot collide with a capability name, and a JSON object gives the gate a shape with no prose
  in it, so rewording the human diagnostic can never break the gate. *Refuted:* declaring a
  `capabilities` capability in the registry — it would then appear in its own listing and in the human
  usage as though it were a delivery capability.

- **Subverbs are gated by a membership guard at the top of each dispatcher, reading the same declared
  array the registry entry carries.** This makes the record's "the dispatcher and the gate read one
  list" literally true, with no dead unknown-subverb tail and no change to any existing message or exit
  code. *Refuted:* restructuring each dispatcher into a `Record<subverb, handler>` mirroring `REGISTRY`
  — cleaner symmetry, but it rewrites five working branch bodies for a story about the gate.

- **A repository-bound artifact named in a code span with no command around it is itself reportable.**
  The scanner carries an `unrecognised` addressing form: a code span naming a `.claude/**.ts|.py` path,
  a `.mjs` bundle, or a `pnpm nexus:` alias with no recognised leader is reported as unmigrated. Four
  real sites named the artifact with no verb; without this a body could be certified migrated with a
  bundle path still in it. *Refuted:* recognising leaders only — simpler, but it reintroduces exactly
  the blind spot the code-span rule was widened to close.

- **The fence reader tracks the open marker's run length, not merely the presence of a marker.**
  A code span closes only on a marker at least as long as the one that opened it, with nothing trailing
  it. The naive toggle-on-any-fence reader inverted its own state on an unbalanced inner fence and
  silently un-gated every invocation after it — three component bodies already nest 4- and 5-backtick
  fences, so a correct-by-accident balance was the only thing holding the gate up. *Refuted:* ignoring
  any marker longer than three backticks — cheaper, but it makes an outer block's contents scannable
  and would gate the illustrative invocations inside a `markdown` example as if they were real.

- **The pending register is emptied and deleted in story #303, not held open until #304.** #303 rewrote
  the last legacy site, which is the completion condition the register recorded; leaving it until #304
  would keep a live exemption channel open across a story that edits shipped bodies. The `pending`
  parameter was dropped from `checkComponentInvocations` at the same time, so enforcement is
  unconditional. *Refuted:* keeping the parameter defaulting to empty — it reads as an exemption
  mechanism no caller uses, which is the tautology the register was designed to avoid.

- **Specs that drove a deleted script were repointed onto the maintainer's one from-source shape, not
  deleted with it.** `docs-root-readout.spec.ts`, `cross-ref-docs-root.spec.ts` and `pr-acceptance`'s
  range helper now invoke `tsx nexus-cli.ts <verb>`. The behaviour they cover — docs-root strip, URL
  agreement, close-range derivation — is live in the verbs, so deleting the specs would trade a script
  path for a coverage hole. *Refuted:* deleting them as script-specific; they are capability tests that
  happened to enter through a script.

- **Story #302 rewrote both sides of the two-branch invocation prose and left the branch standing.**
  #304 owns the collapse and must preserve the mode-conditional instructions the hub side carries;
  doing both in one pass risks dropping them silently. *Refuted:* collapsing while rewriting — fewer
  passes over the same lines, but it fuses an addressing change with a de-duplication that needs its
  own reading.

- **Story #304 ships with no automated check of its own.** What made the duplication possible was two
  addressing forms, and the #301 gate now rejects the legacy one unconditionally, so the branch cannot
  be reconstructed. The residue — one capability described once — is a prose property no honest
  mechanical rule captures. *Refuted:* a heuristic "no two invocations of one capability near each
  other" check; it fires on legitimate repeats (three distinct `record-digest` acts in one stage) and
  would be silenced with exclusions.

- **The distill stage's Phase 5.3 was repurposed rather than renumbered away.** The step that selected
  an invocation became the step that states the mode-conditional argument rules, keeping its number,
  because eight passages elsewhere in the body cite "Phase 5.3–5.5" by number. *Refuted:* deleting the
  step and renumbering — a tidier list that rewrites cross-references having nothing to do with this
  change.

- **At the merge with `main`, the distill stage kept this branch's mode-conditional bullets and took
  `main`'s unconditional quoting rule.** Both sides collapsed the same duplication for different
  reasons; this combination keeps the eight "Phase 5.3–5.5" cross-references valid without narrowing
  the quoted-token rule back to hub mode. *Refuted:* taking `main`'s single collapsed paragraph — it
  loses the hub-only anchor-sidecar contract this branch's bullets carry.

- **The stale-toolkit remediation names an action, not the retired install document.** The
  `derive-entry-diff` fallback now tells the operator to update their Nexus install; the pointer to
  `hub-tooling-install.md` went with the document #257 retired, because a remediation citing a deleted
  path is worse than one citing none. *Refuted:* repointing it at `docs/delivery/release-procedure.md`
  — that is the maintainer's release runbook, not an operator's install instruction.

## Deviation Rationale

- **The gate never prints its inventory** (deviates from #325, "The inventory is the gate's output, not
  a committed artifact"). The record decided the gate prints every code-span invocation classified as
  resolving, undeclared, or not yet migrated. The shipped gate builds that classified inventory and the
  spec asserts over it, but nothing emits it. The assertion subsumed the print: the inventory's purpose
  was to make every site visible and classified, and the assertions cover every site and fail by name,
  so a separate print would have added an output surface with no reader. This supersedes the record's
  decision — the classified inventory is not surfaced to a maintainer who is not reading a failure.

- **The thirteen vendored-bundle sites were taken into story #302's scope** rather than making the
  retire-the-vendored-tools epic a hard blocker (deviates from #250's stated assumption that those
  strings were already gone; #325 left this as an explicit two-way "decision needed"). They were still
  present in the live bodies, and the pending register cannot reach empty — this epic's completion
  condition — while any body still carries one. *Refuted:* declaring #257 a hard blocker and leaving
  those bodies on the register, which defers this epic on another epic's schedule for strings that are
  already dead.

- **`parity.spec.ts` lost roughly 340 lines when three migration axes retired together** (a consequence
  #325 did not contemplate when it decided the legacy skill scripts are deleted in #302). The
  `#272`/`#273` script-vs-verb axes compare a script against the verb that replaced it and had nothing
  left to compare once the scripts were deleted; merging `main` removed the `#274` verb-vs-standalone
  axis for the same reason, since #252 built one executable and deleted every standalone launcher. Each
  axis's own comment already named this epic as its retirement. The durable source-vs-bundle axis and
  the real-workspace `derive-entry-diff` case survive. *Refuted:* keeping the axes pointed at the git
  history of the deleted files, or comparing the executable against itself — a tautology #325 already
  rejected.

- **`libs/pr-acceptance` reaches the Python toolkit by its entry-point file path**, `python3
  <toolRoot>/libs/gh-toolkit/bin/nexus-gh <capability>` (a second from-source shape, which #325's
  invariant 8 — "the maintainer's from-source path exists in exactly one command shape" — did not
  contemplate; the invariant governs shipped bodies, and the harness is not one). The harness resolves
  everything from an explicit `toolRoot` so it can drive a checkout that is not the one it runs in;
  requiring the name on `PATH` would make it depend on an install step the harness does not perform.
  *Refuted:* invoking the bare name — correct for a shipped body, wrong for a harness whose whole job
  is to exercise a specific checkout.

## Deferred Scope

Deferred items filed as backlog stub issues:

- #340 — the repository's own documentation names the toolkit, like the components already do

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-08-27-invocations-name-a-toolkit.md`
