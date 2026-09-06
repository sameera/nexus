---
name: nxs-prose-style
description: The six plain-language form rules every Nexus artifact is written under. Load it before drafting an epic, a decision record, a discovery ticket, a close record, a distillation-PR body or a concept page, so the prose comes out plain the first time. It shapes the draft as it is written; it is not a pass over a finished one.
---

# nxs-prose-style

Every artifact Nexus hands to a human exists to force a decision. A reader who rereads a sentence,
or guesses what a pronoun points at, spends judgment on decoding instead of deciding. These six
rules remove that cost. Simplify the language. Never simplify the content.

This is a guidance skill, loaded into the context that is writing. It holds the same criterion the
razor states: a rule that could only be applied to a finished draft would belong in an agent
instead. These rules shape a sentence as it is composed, so they belong here. Applying them while
drafting means no second pass has to rewrite prose it did not author.

The scope of this file is **form**. Two content rules stay with the drafting command: write concrete
rather than abstract, and add nothing. That command holds the source material this file does not.

## The six form rules

1. **One idea per sentence.** A clause that carries its own fact becomes its own sentence. When you
   split a sentence, keep the connective explicit in one of the halves. A split that drops
   "because", "so" or "unless" changes the meaning.
2. **No em-dash parentheticals.** An aside worth stating becomes its own sentence. The same applies
   to heavy nested parentheses. Never turn an aside into a list, because list structure belongs to
   the template. If an aside will not become a sentence, leave it as it stands.
3. **No idioms or invented shorthand.** An idiom costs a reader who learned English second more than
   it saves anyone. Write "the requirement changed" rather than "the goalposts moved", and "start
   over" rather than "back to the drawing board". Expand an abbreviation you coined for this
   document on its first use. Standard technical notation is not shorthand and stays as written:
   "≤ M", "95%", "O(n)" and the project's defined terms are precise, and this audience reads them
   faster than the spelled-out form.
4. **Prefer common words** when they mean the same thing. Write "creates" over "mints", and
   "decision" over "call" used as a noun. Keep the technical term when it is the precise one. This
   rule never reaches a modal verb. Never substitute one modal for another, however common the
   replacement. "Shall" does not become "will", and "ought" does not become "should", even though
   neither swap changes the strength of the claim.
5. **Name the noun.** Never write "it", "this" or "that one" when the antecedent is more than a
   sentence away, or when it could bind to two things. Repeat the noun.
6. **Say the exact strength you mean.** "May", "should" and "must" are distinct claims. Hedging is
   information. Do not strengthen or weaken a claim for rhythm.

## What these rules never touch

- **Anything machine-read.** Frontmatter, fenced code blocks, HTML comments, machine blocks, hashes,
  digests, label names, slugs, issue references and shell commands stay byte-identical.
- **The acceptance-criteria keywords.** A **Given** / **When** / **Then** line stays verbatim.
- **Load-bearing wording.** Defined terms, quoted contract phrases, and section names that other
  text references by exact wording.
- **The document's structure.** Headings, section order, list structure and table structure are the
  template's contract. Where a form rule would breach a template section, a required heading, a word
  cap or a content boundary, the template wins, and you make the sentence plain within it.

## The one failure these rules can cause

Rule 1 and rule 5 restructure a sentence, and a restructure is where a fact goes missing. Every
number, named entity, enumerated item and modal verb that belongs in a sentence has to appear in the
sentence you write.

Modal verbs are the common loss, because dropping one reads like an improvement. "A mistaken table
can never be undone" becomes "there is no way to undo a mistaken table". The second sentence is
shorter and it has lost "can", which weakens a claim about impossibility into a claim about a
missing method. Rule 6 governs: keep the modal.

Written this way there is no before-and-after pair, so there is nothing to diff and no preservation
check to run. `nexus prose-verify` stays for the case this skill does not cover, which is translating
text the pipeline did not author.
