---
name: nxs-prose-style
description: Plain-language authoring rules for every human-facing Nexus artifact — epic and story issue bodies, approval digests, decision-record bodies and revision comments, concept pages, and distillation-PR bodies. Applies the clarify skill's lossless plain-English techniques (one idea per sentence, no em-dash parentheticals, expanded shorthand, common words, resolved references, preserved hedging) at authoring time, plus a mandatory self-review before anything is filed. Invoked by /nxs.epic, /nxs.decision-record, and /nxs.distill before they draft a human-facing artifact; usable standalone before writing any prose a human must read and approve.
---

# Nexus prose style — write it plain the first time

Every artifact Nexus hands to a human exists to force a decision. A reader who has to reread
a sentence, or guess what a pronoun points at, is spending judgment on decoding instead of
deciding. These rules apply the `clarify` skill's lossless plain-English techniques at
authoring time: instead of rewriting dense prose after the fact, never write it dense.
Simplify the language, never the content.

Invoke this skill once at the start of any phase that drafts a human-facing artifact. Its
rules stay in force for the rest of the run.

## Audience contract

Write for a senior technical reader who is not necessarily a native English speaker:

- Full technical competence. Do not dumb down concepts, remove precision, or add
  hand-holding explanations the artifact does not need.
- No reliance on idioms, dense multi-clause syntax, cultural references, or compressed
  shorthand. These are what this skill exists to keep out.

## Scope — what this skill governs

This skill governs **sentence-level language in human-facing prose only**. It never changes:

- **The invoking command's structure and content rules.** Template sections, required
  headings, word caps (the concept-page 400-word cap), content boundaries (no code, file
  paths, or type names in a decision record or concept page), and tiering whitelists all
  take precedence. Where a rule here appears to conflict — for example "expand shorthand"
  against a word cap — the command's constraint wins, and the sentence is made plain within
  it.
- **Anything machine-read.** Frontmatter, hidden machine blocks and comments, hashes, label
  names, slugs, issue references, shell commands, code fences. Never reworded.
- **Load-bearing wording.** Defined terms, quoted contract phrases, section names that other
  text references by exact wording, and the **Given/When/Then** keywords in acceptance
  criteria stay verbatim.

The artifacts it does govern, per command:

- `/nxs.epic` — the epic document body (Description, Success Metrics, story narratives,
  acceptance-criteria prose, Assumptions, Out of Scope), stub issue bodies, the approval
  digest, the feature README capability statement, and the completion report.
- `/nxs.decision-record` — the record body (summary, chosen approach, key decisions and
  refuted alternatives, invariants, risks) and a revision's supersession comment (the *what
  changed* and *why* prose).
- `/nxs.distill` — concept-page prose (Summary, How It Works, invariants, the interaction
  line on each Integration Points bullet, Decision Log entries) and the distillation-PR
  body's per-concept *What changed* and *Why* lines.

## Authoring rules

1. **One idea per sentence.** A clause that carries its own fact becomes its own sentence.
   When splitting, keep the connective ("because", "so", "unless") explicit in one of the
   halves — a split that drops the logical link changes the meaning.
2. **No em-dash parentheticals.** An aside worth stating is its own sentence or a
   colon-introduced list. An aside not worth its own sentence is cut. The same applies to
   heavy nested parentheses.
3. **No shorthand or idioms.** Write the explicit form the first time: "size M or smaller",
   not "≤ M" in running prose; the actual choice, not a coined compound that stands for it.
   Symbols and abbreviations stay in tables, frontmatter, and code, where they are the
   format.
4. **Prefer common words** when they mean the same thing ("creates" over "mints",
   "decision" over "call" the noun). Keep the technical term when it is the precise one.
5. **Name the noun.** Never write "it", "this", or "that one" when the antecedent is more
   than a sentence away or could bind to two things — repeat the noun.
6. **Concrete over abstract.** Describe the situation ("there are two copies of the record;
   one can go stale") instead of the abstraction ("state duplication risks divergence").
7. **Say the exact strength you mean.** "May", "should", and "must" are distinct claims;
   choose deliberately and review them as facts. Hedging is information — do not strengthen
   or weaken a claim for rhythm.
8. **Add nothing.** No filler adjectives, no editorializing, no restating what the reader
   just read. Every sentence carries a fact, a decision, or a consequence — or it goes.

## Self-review pass (mandatory before filing)

Before the artifact is filed, posted, or shown at an approval gate, compare it against its
source material — the analysis, the architect output, the diff, the records it was derived
from — section by section:

- **Fact inventory:** every number, condition, exception, named entity, causal claim, and
  enumerated item in the source survives into the artifact. Plain language is lossless;
  a fact dropped to make a sentence shorter is a defect, not a simplification.
- **Ambiguity check:** for each sentence, ask whether a reader could take a meaning the
  source excludes. Sentence splits are the usual culprit — verify the connectives survived.
- **Verbatim check:** the load-bearing wording from the Scope section is untouched.
- **Strength check:** no "may" became "must" and no "must" became "should".

Fix every finding before filing. Do not skip this pass for short artifacts — a one-paragraph
digest gates the same decisions a long one does.
