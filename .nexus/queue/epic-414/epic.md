---
feature: "Artifact Prose Style"
feature_path: docs/features/artifact-prose-style
epic: "Prose translation agent with a resident density convention"
slug: prose-translation-agent
created: 2026-09-01
type: enhancement
complexity: M
complexity_drivers: [six stories of which four are component-body edits and two are substantive, one deterministic verifier that must fail closed and carry the coverage bar, staged wiring so the surfaces no reviewer reads adopt it last]
concepts: [forcing-function-razor, authored-component-root, component-invocation-gate, epic-approval-gate]
link: "#414"
record: "#421"
record_state: closed
---

# Epic: Prose translation agent with a resident density convention

## Description

Every artifact Nexus hands to a human exists to force a decision. A reader who has to reread a sentence, or guess what a pronoun points at, spends judgment on decoding instead of deciding. The `nxs-prose-style` skill enforced eight plain-language rules to prevent that, and it worked. It was retired anyway, because it loaded into the authoring context and stayed there for a whole run: about 1200 tokens of rule body, plus roughly eleven lines of hook prose in each of four commands. The maintainer measured it at roughly 16% of a run's tokens and deleted it. The rules are still wanted; the price is not payable.

This epic restores the rules by splitting them according to who can execute them. Six of the eight are form rules — one idea per sentence, no em-dash parentheticals, no shorthand or idioms, prefer common words, name the noun, say the exact strength you mean. A translator holding only the drafted text can apply all six without loss. The remaining two are content rules — write concrete rather than abstract, and add nothing — and they need the source material the author had. Turning "state duplication risks divergence" into "there are two copies of the record; one can go stale" requires knowing what the two copies are, and that fact is in the analysis, not in the sentence.

So the six form rules move into a Haiku-backed agent that edits a drafted file in place and returns a receipt rather than the rewritten prose. The two content rules stay resident in each command, where they are two sentences instead of a rulebook, and where they prompt the author while it still holds the analysis and the diff. Density the translator cannot resolve is not guessed at: it is reported as a line pointer, and the author fixes those few lines with full context. Detection is cheap; grounding is not. A deterministic check then proves that nothing machine-read changed, because a small model with write access to a file that carries frontmatter, machine blocks and hashes is a real hazard and a polite instruction is not a control.

## Success Metrics

- The prose guidance resident in any one pipeline command is at most 15 lines, including the invocation. The retired arrangement cost about 1200 tokens of skill body plus roughly 11 lines of hook prose per command.
- The translator's return carries section names, counts and findings. The only artifact text it may carry is a bounded quotation inside one finding — the phrase a density finding points at, or the clause a grounding entry substituted. It never carries a rewritten section, paragraph or sentence pair.
- A translated artifact's frontmatter, fenced blocks, HTML comments and Given/When/Then lines are byte-identical to the pre-translation copy, proven by a check that fails closed rather than by inspection.
- Every density case the translator cannot resolve is reported as a line pointer rather than rewritten. The one exception is a distillation run, where it may rewrite a case it can ground in a named source file, and every such rewrite is listed in the receipt.
- A reviewer comparing a translated artifact against the six form rules finds no violation of them.

## Personas

Per `docs/product/context.md`.

## User Stories

### Story #415: Translator rewrites a drafted artifact in place

- **story_type:** user
- **size:** M

**As a** delivery lead running a pipeline command, **I want** a translator that rewrites a drafted artifact file in place and reports back a receipt, **so that** the plain-language form rules are applied to what I file without the rulebook occupying my authoring context.

## Acceptance Criteria

- [ ] **Given** a drafted artifact file whose prose breaks the form rules, **when** the translator is invoked with that file's path, **then** the file on disk is rewritten to satisfy the six form rules and the invoking command receives a receipt.
- [ ] **Given** a completed translator run, **when** the invoking command reads the receipt, **then** the receipt names the sections changed and the findings raised, and carries no rewritten section, paragraph or sentence pair from the artifact.
- [ ] **Given** a receipt entry that must quote the artifact to be actionable, **when** it is written, **then** the quotation is bounded to the phrase or clause the entry is about.
- [ ] **Given** an artifact containing frontmatter, fenced code blocks, HTML comments, digests and Given/When/Then lines, **when** the translator runs, **then** every one of those regions is left byte-identical.
- [ ] **Given** an artifact containing a defined term, a quoted contract phrase or a section name that other text references by exact wording, **when** the translator runs, **then** that wording is left unchanged.
- [ ] **Given** a fact, a number, a named entity, an enumerated item or a modal verb in the pre-translation text, **when** the translator rewrites the sentence carrying it, **then** that element survives into the rewritten sentence at the same strength.

## Notes

The agent is authored at `components/agents/nxs-prose.md` with `model: haiku`, alongside the existing agents. `nxs-architect` already pins `model: opus`, so a per-agent model is an established affordance. Its body carries form rules 1 to 5 and rule 7 from the retired skill, plus that skill's Scope section verbatim in substance — the list of what is never reworded. The installer manages whole component subtrees, so a new agent file ships with no registration step. The token saving comes from the agent body loading only in the subagent; the commands already draft to session scratch and file with `--body-file`, so a file-in-place edit keeps the prose out of the invoking context on the return leg too.

The bounded-quotation rule is what makes the receipt both small and actionable. A finding a reviewer cannot check is not worth returning, and a receipt carrying whole paragraphs would give back the tokens the split was built to save.

### Story #416: Density the translator cannot resolve is flagged, never guessed

- **story_type:** user
- **size:** S

**As a** delivery lead, **I want** the translator to report the density it cannot fix rather than rewriting it, **so that** content judgments stay with the author that holds the source material.

## Acceptance Criteria

- [ ] **Given** a sentence stating an abstraction the translator cannot ground in the text it was handed, **when** the translator runs, **then** the sentence is left unchanged and reported as a density finding naming its line, the offending phrase and the reason.
- [ ] **Given** an aside whose load-bearingness the translator cannot determine from the text alone, **when** the translator runs, **then** the aside is left intact and reported as a density finding.
- [ ] **Given** a run that raises density findings, **when** the invoking command reads them, **then** each finding is a line pointer and none proposes a rewritten alternative.
- [ ] **Given** a run that raises no density findings, **when** the invoking command reads the receipt, **then** the receipt states that in one line.

## Notes

This is the mitigation for the translator's structural blind spot. It cannot execute the two content rules, but it can detect the places where they apply, and detection needs no source material while grounding needs all of it. The finding format is a line pointer such as `density: L40 "state duplication risks divergence" — abstraction not grounded`. Keeping findings terse is what preserves the token saving on the return leg.

### Story #417: Machine-read regions are proven unchanged

- **story_type:** system
- **size:** M

**As a** delivery lead, **I want** a deterministic check that compares the pre-translation and post-translation copies and fails when a machine-read region differs, **so that** a small model with write access cannot silently break something the pipeline parses.

## Acceptance Criteria

- [ ] **Given** a pre-translation and post-translation pair whose frontmatter, fenced blocks, HTML comments and Given/When/Then lines are byte-identical, **when** the check runs, **then** it exits zero.
- [ ] **Given** a pair differing by a single byte inside frontmatter, a fenced block, an HTML comment or a Given/When/Then line, **when** the check runs, **then** it exits non-zero and names the region and the line that changed.
- [ ] **Given** a pair where the post-translation copy has added or removed a whole machine-read region, **when** the check runs, **then** it exits non-zero and names the added or removed region.
- [ ] **Given** the check is unable to read either copy, **when** it runs, **then** it exits non-zero rather than reporting success.
- [ ] **Given** the check is invoked from a shipped component body, **when** the repository's component invocation gate runs, **then** the invocation names a toolkit dispatch the toolkit declares.
- [ ] **Given** the check's library source, **when** the test suite runs, **then** statement coverage of that source is at least 95%.

## Notes

Implemented as a toolkit verb over a library, in the shape of the existing single-purpose libraries such as `record-digest` and `abs-doc-path`, so it carries the repository's coverage bar and its invocation is reachable from a component body. The check is comparative, not semantic: it proves the regions the pipeline parses are untouched. It makes no claim about whether the prose is faithful.

### Story #418: The gated commands carry the convention and the hook

- **story_type:** user
- **size:** S

**As a** delivery lead, **I want** `/nxs.epic` and `/nxs.decision-record` to carry the two content rules and invoke the translator at a named point, **so that** the artifacts I approve are already in the plain style and I can judge the translator's output behind a human gate.

## Acceptance Criteria

- [ ] **Given** `/nxs.epic` has written its Phase 4 draft, **when** the run continues, **then** the translator is invoked against that draft before the Phase 4b epic gate, so the gate and the Phase 5 digest both read the prose that will be filed.
- [ ] **Given** `/nxs.decision-record` has written its scratch record body, **when** the run continues, **then** the translator is invoked against that body before the record is filed.
- [ ] **Given** either command, **when** its resident prose guidance is counted, **then** it is the two content rules and the invocation only, in at most 15 lines.
- [ ] **Given** a translator run invoked by either command, **when** the invocation is made, **then** no source files are handed to the translator.
- [ ] **Given** a translator run that returns density findings, **when** the command continues, **then** it resolves every finding before the artifact reaches its approval gate. A finding is resolved when the flagged line has been rewritten, or when the command has stated in the run why the flagged wording stands.
- [ ] **Given** a translator run whose verification check fails, **when** the command continues, **then** it stops and files nothing.

## Notes

These two commands go first because a human reads their output at an approval gate before anything durable is written, so a translator defect is caught by a reviewer rather than shipped. The resident convention is the two content rules stated as prose the author acts on, not as a rulebook: write concrete rather than abstract, and let every sentence carry a fact, a decision or a consequence.

Withholding source files here is deliberate and belongs with these two commands, not with the distillation wiring. A human gate already reads this prose, so the grounding capability buys little and costs the risk of a small model importing detail the artifact never claimed.

### Story #419: The remaining commands invoke the translator

- **story_type:** user
- **size:** S

**As a** delivery lead, **I want** `/nxs.discover` and `/nxs.distill` to invoke the translator on the artifacts they write, **so that** every human-facing surface Nexus produces gets the same plain style, not only the two behind approval gates.

## Acceptance Criteria

- [ ] **Given** `/nxs.discover` has drafted the discovery document and its ticket files, **when** the run continues, **then** each is translated and verified before it is written out.
- [ ] **Given** `/nxs.distill` has drafted its concept pages, **when** the run continues, **then** they are translated and verified before the Phase 5 validator runs.
- [ ] **Given** `/nxs.distill` has drafted the distillation pull request body, **when** the run continues, **then** it is translated and verified before Phase 7 opens the pull request.
- [ ] **Given** either command, **when** its resident prose guidance is counted, **then** it is the two content rules and the invocation only, in at most 15 lines.
- [ ] **Given** a translator run that returns density findings, **when** the command continues, **then** it resolves every finding, by the same test #418 sets, before the artifact is written out or the pull request is opened.
- [ ] **Given** a density finding the command has left standing, **when** the run reports completion, **then** the finding and the reason it stands appear in that report.
- [ ] **Given** a translator run whose verification check fails, **when** either command continues, **then** it stops without writing the artifact out or opening the pull request.

## Notes

Wired after #418 so the translator's output has already been judged by a reviewer at an approval gate before it reaches surfaces nobody reads closely before merge. This story wires the translator as #415 defines it, with no new capability. Neither command has an approval gate, so a density finding has no reviewer to fall to. The command resolves it in the run, and anything it leaves standing is named in the completion report rather than dropped silently.

### Story #420: Distillation grounds abstractions from named sources

- **story_type:** user
- **size:** M

**As a** delivery lead, **I want** the translator to ground an abstraction from a named source file when it runs for `/nxs.distill`, **so that** concept pages get the concrete phrasing that no reviewer is going to supply for them, without letting a small model invent content.

## Acceptance Criteria

- [ ] **Given** a `/nxs.distill` translator run, **when** it is invoked, **then** it is handed the epic and the decision record as readable paths.
- [ ] **Given** a drafted concept page stating an abstraction that one of the named source files states concretely, **when** the translator runs, **then** the abstraction is replaced with that file's concrete clause.
- [ ] **Given** a `/nxs.distill` run that replaces an abstraction with a concrete statement, **when** the substituted clause is compared against the named source files, **then** it appears in one of them as a contiguous span of characters.
- [ ] **Given** a `/nxs.distill` run that replaces an abstraction, **when** the receipt is read, **then** the substitution is listed with the line it was made at and the source file the clause came from.
- [ ] **Given** a `/nxs.distill` run that meets an abstraction it cannot match to a contiguous span in a named source file, **when** it processes that line, **then** it leaves the text unchanged and reports a density finding instead of composing a grounding.
- [ ] **Given** a translator run invoked by any command other than `/nxs.distill`, **when** the run completes, **then** it lists no grounding substitutions.

## Notes

Concept pages are the surface with no close human read before merge, which is why they get the grounding capability and why they get it last. The contiguous-span test is what separates grounding from inventing, and it is deliberately mechanical: a reviewer can check it with a search, and a paraphrase — however reasonable — fails it. The receipt entry naming the source file is what makes that check a matter of seconds rather than a re-read of the whole page.

### Story #423: Faithfulness is proven by a token-preservation check

- **story_type:** system
- **size:** M

**As a** delivery lead, **I want** a deterministic check that proves the facts survived translation, **so that** no human has to read the translated artifact to confirm it is faithful.

## Acceptance Criteria

- [ ] **Given** a pre-translation and post-translation pair in which every numeric value, modal verb, name-shaped token, heading, list item and table row survives at no lower count, **when** the check runs, **then** it exits zero.
- [ ] **Given** a pair in which any one of those tracked items is absent after translation, or survives at a lower count, **when** the check runs, **then** it exits non-zero and names the missing item and the line it stood on.
- [ ] **Given** a pair in which a tracked item appears after translation that was absent before, and the run names no grounding source, **when** the check runs, **then** it exits non-zero and names the introduced item.
- [ ] **Given** a run handed named grounding sources, **when** an introduced tracked item appears in one of those sources, **then** the check permits it; **and when** it appears in none of them, **then** the check exits non-zero and names the item.
- [ ] **Given** a numeric value written as a numeral before translation and as a word after, or the reverse, carrying the same denotation and the same unit or percentage suffix, **when** the check runs, **then** it reports no change for that value.
- [ ] **Given** a name that moves to the start of a sentence, or a noun repeated to replace a pronoun, **when** the check runs, **then** it reports no change.
- [ ] **Given** a command invoking the verifier, **when** the invocation returns, **then** one invocation has returned one verdict covering both the machine-read region comparison and this preservation comparison, so no run can satisfy one property and skip the other.
- [ ] **Given** the check's library source, **when** the test suite runs, **then** statement coverage of that source is at least 95%.

## Notes

This joins the existing region comparison inside the same toolkit verb, over the same pair of copies, returning one exit code. The verb is already wired into every translation point in all four commands, so the guarantee reaches every surface without reopening a resident convention block.

The tracked name-shaped class is defined by form, never by meaning, and it ships in two tiers. The first tier is every token an ordinary rewrite could not have produced: inline-code spans, quoted contract phrases, issue and pull-request references, command names, flag tokens, path-shaped and extension-bearing tokens, and tokens carrying internal capitalisation, underscores or digits. The second tier is a conservative proper-noun set, taken from the pre-translation copy as capitalised words that are not sentence-initial and are not on a closed list of English function words, then counted at every position in both copies. Counting position-blind is what keeps sentence splitting and noun repetition invisible to the check. If the proper-noun tier proves noisy in practice, the fallback is to narrow the class to its first tier, never to exempt the class from the gate.

A form-based definition never touches an ordinary lower-case word, so the translator's preference for common words is free by construction.

The restore-and-retranslate behaviour on a failed check belongs to the resident convention in the commands, not to this check. It is a scope edit on the wiring stories.

## Assumptions

- A per-agent model is selectable in the agent definition's frontmatter. The existing `nxs-architect` pins `model: opus`, so `model: haiku` needs no new mechanism.
- The installer manages the `commands`, `agents` and `skills` subtrees as wholes, so a new agent file requires no manifest entry.
- The four commands already draft their human-facing artifacts to session scratch and file them with `--body-file`, so a translator that edits a file in place keeps the prose out of the invoking context in both directions.
- The retired skill's rule set is the intended style. This epic re-homes those rules and does not revise them.

## Out of Scope

- Restoring `nxs-prose-style` as a skill, in whole or in part.
- Rewriting artifacts already filed. Issues, records and concept pages written before this ships are left as they are.
- Translating anything machine-read: receipts, machine blocks, ledgers, digests and configuration.
- A gate that blocks on flat but rule-clean abstract prose. The resident convention is a prompt to the author, not a check, and prose that breaks no form rule reads as clean to the translator. This limit is accepted, not deferred.
- Measuring the realised token saving as a tracked metric. The resident line count stands in for it.

## Open Questions

None.

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #415 | none |
| #416 | #415 |
| #417 | none |
| #418 | #415, #416, #417 |
| #419 | #418 |
| #420 | #419 |
| #423 | #417 |
