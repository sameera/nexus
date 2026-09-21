---
title: "Close Record: The Epic Receipt Accepts and Ranks Published Story Verdicts"
epic: "#747"
feature: "Multi-Repo Workspaces"
date: 2026-09-21
nexus_version: 0.68.0
analyze: ran 2026-09-21 @ 05a6c86c346edeecb0031d73268deac1acc5ec4c
record: "#750"
record_hash: b52780c3d14b514ce75a9e99eb4412e99717d5273f02b4e19257c5c144b3affe
range:
  - repo: github.com/sameera/nexus
    base: f9178c69fbb9e3576452c071855435ab34b94a2e
    head: 4586ae1c13dd1c6efee6d2044b59969cf968edbb
---

# Close Record: The Epic Receipt Accepts and Ranks Published Story Verdicts

## Key Decisions

- **The shared repository rule is the comparator the provenance module already exported, widened.** Both verdict readers now call that one comparator instead of comparing a stamped repository by string equality. Record #750's invariant 4 asks for exactly one comparison rule, and a new function sitting beside an existing one named for the same question is how a second rule starts. Refuted alternative: export a new repository comparator alongside the old one and leave the old one for bare-form callers.
- **A stamp that parses as neither written form falls back to case-folded equality.** When either side is not a two- or three-segment repository identity, the two strings are compared case-insensitively rather than rejected. That is exactly today's behaviour for an unparseable stamp, so the widening cannot make a verdict that is accepted now start failing. Refuted alternative: reject any stamp that does not parse, which would newly drop verdicts nobody has complained about.
- **The new command wraps the existing single-pull-request reader rather than reimplementing selection.** It extends that reader with the two filters only the close gate's prose had been applying: maintainer authorship, and the pull request a block names. Record #750's point is that the compiled reader was already right and the gate had no way to reach it, so a fresh implementation would be a third reader to keep in step. Refuted alternative: a standalone reader in the epic-verdicts library, leaving the harness reader untouched.
- **An author association GitHub did not state is unknown, not untrusted.** A block whose payload carries no author association is accepted; one stating an association outside owner, member or collaborator is rejected. This is the same unstated-is-unknown rule the record fixes for the repository stamp, and GitHub always states the field in a real run, so nothing a live gate reads is weakened. Refuted alternative: reject an absent association, which would drop every verdict read from a payload that did not request the field.
- **The repository is a required argument, never resolved from the checkout.** The command refuses with a usage error when the caller does not name the repository it is reading. Invariant 9 asks every caller to state it; resolving it silently would let a caller that never knew leave the trust check inert and look identical to one that did. Refuted alternative: fall back to the checkout's own identity when the argument is omitted.
- **Distill recovery moved its pull-request verdict to the command and kept its own close-comment rule.** Invariant 8 is scoped to which verdict a pull request carries. The epic issue's close comment is a different question on a different surface, and no command answers it yet. Refuted alternative: strip the trust mechanics from the close-comment step too, which removes a rule instead of moving it and leaves recovery with no stated way to ignore an untrusted close comment.

## Deviation Rationale

- **The command this epic shipped could not be invoked at all (deviates from record #750, invariant 8).** The verb handler stripped one argument too many before parsing, so every well-formed invocation exited with its usage line. Invariant 8 had just made this command the only way the close gate reads a pull request's verdict, and deleted the hand-selection path behind it, so what this range shipped could not have closed its own epic. The two tests covering the command asserted only its refusals, and each would have passed had the handler read no arguments at all, so neither could observe a command that rejects its own correct use. The fix is one line plus the test that invokes the verb through the dispatcher with a complete argument list. It landed as #754, immediately after this range merged, which is why it sits outside `range.head`: it was found by running the command once by hand after the merge, and no gate in the pipeline does that.

Three differences the conformance pass reported as scope drift are **not** deviations from the record, and are recorded here only so a later reader does not re-derive them as gaps. The maintainer-authorship and pull-request-match filtering added to the single-pull-request reader is named by decision 4 itself. Distill recovery changing alongside the close gate follows from invariant 8 binding every stage rather than the one decision 4 names. The live-payload fixture being published as a package entry point is how decision 6's requirement — every candidate reader runs against one fixture — is met when the readers live in two packages.

## Deferred Scope

- #751 — a published verdict's story numbers resolve against a repository the reader checks
- #752 — the razor checker reads a decision record's decisions as unlabelled stories
- #755 — a stage that calls the verdict command knows what its failures mean

## Process Lesson

docs/delivery/lessons/2026-09-21-a-guard-that-cannot-pass.md
