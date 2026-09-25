# Decision Record: The Record Checkpoint Reads as One Checklist

## Summary

The decision-record stage labels every invariant and every risk it drafts as the lead's own or as its own addition, and it checks each quoted fragment against the run's source text. Its pre-filing checkpoint then renders only the refuted alternatives, so no human ever sees those labels before they are stripped. This epic makes that checkpoint render one numbered, pre-ticked checklist over everything the model added to the record, in the shape the planning gate already uses, and adds one refusal for lines whose content is already approved and frozen.

## Chosen Approach

The checkpoint reads the labelled draft. That draft is the only place the provenance labels exist, it is already written when the checkpoint runs, and the checker has already passed over it. The list groups its lines by kind in the record's own section order. Refuted alternatives come first, under the decision each belongs to. Then come the invariants the model added, then the risks the model added. Every line arrives ticked, because a plain approval files the record as drafted. A number unticks the line it names.

The work of choosing which items qualify, grouping them, ticking them and numbering them moves into the deterministic checker that already builds the planning gate's checklist. The stage transcribes that output verbatim inside a fence and adds only the viability observation and the choice.

The one genuinely new behaviour is the freeze refusal. When the epic's record sub-issue is closed at the moment the checkpoint runs, the checkpoint compares each line's label-stripped text against the approved body. A number naming content that body already carries is refused, and the refusal states the reason and names the route.

## Key Decisions

### The list is a render over the labelled draft, not a new artifact

- **Decision:** The checkpoint sources its lines from the labelled draft the stage has already written and already run the checker over. Nothing new is produced, persisted, or handed between phases. The checkpoint stays a step that writes no file and is spent when it is answered.
- **Why:** The labels exist in exactly one place, and the next phase strips them. The checkpoint is therefore the only moment at which provenance is both present and still actionable. Reading the labels there costs nothing and cannot disagree with what the checker validated.
- **Refuted alternative:** Have the architect return a separate, explicit list of what it inferred, alongside its prose. That decouples the gate from the record template's formatting and reads more directly. It loses on single-source provenance. It creates a second statement of what the model added, that statement can disagree with the labels, and the labels are what the citation check enforces. The gate could then show one set while the checker validated another.

### The mechanical half moves into the deterministic checker, and the stage transcribes it

- **Decision:** Extend the existing checklist builder with a record mode that selects the qualifying items, groups them, ticks them, and assigns the one numbering sequence. The stage pastes that output verbatim.
- **Why:** The epic's own diagnosis is that provenance work no human sees is decoration. A render a drafting model assembles by hand can silently omit one line, and nothing downstream would notice. Putting the selection in the checker turns an omission into a test failure. It is also the move the planning gate already made, for the same reason, and the razor page says what is mechanically decidable in either gate lives in the checker.
- **Refuted alternative:** Change only the stage's prompt, so the stage renders the list by hand as it renders today's alternatives list. The razor page permits a hand-rendered list, this needs no library change and no version coupling between the components and the executable, and it is much the smaller change. It loses on verifiability. A hand render cannot be pinned by a test, so the one failure this epic exists to prevent, an item the model added quietly not reaching the reviewer, stays undetectable. The labelling would stay decoration by a different route.

### An invariant or risk the lead asked for stays off the list, and the residual exposure is accepted

- **Decision:** Only items carrying the model's own label are listed. An item the lead asked for does not appear, ticked or otherwise. The exposure this leaves is accepted deliberately, and is recorded as a risk below.
- **Why:** The epic states this both as an acceptance criterion and as an assumption. It mirrors how the planning gate treats an acceptance criterion the lead asked for: that is the lead's own definition, and striking it is a revise rather than a tick. It also keeps the list short enough to read, which is what makes acting on the list cheaper than waving it through. The exposure is that the citation check proves a quoted fragment exists, never that the fragment licenses the item, so an over-claimed label hides an invariant from this gate. That invariant still lands in a body the approver reads before closing the record sub-issue, and widening the list would contradict the epic's stated scope.
- **Refuted alternative:** List the items the lead asked for as well, ticked, each rendered with its quoted fragment, the way the planning gate renders a story the lead asked for. This is the stronger option on reviewer authority, because an over-claimed label is exactly the claim a reviewer should be able to reject. It loses on signal. At a gate whose whole purpose is showing what the model added, padding the list with items the lead did state makes the model-added lines harder to find.

### One numbering sequence, assigned per render and resolved against that render

- **Decision:** Numbers run from 1 in one sequence across all three kinds, in the record's own section order. Group headings stay for readability, and no group carries a prefix of its own. The numbers are assigned when the list is rendered, and the reviewer's selection is resolved against that same render. A revise that re-drafts the record renders a fresh list, and its numbers are not promised to match the earlier one.
- **Why:** The razor page's shared shape requires one typed selection covering every group the list holds. A number that means a different thing depending on which group it sits in is the second idiom this epic exists to delete. Ordering by the record's own sections keeps the list in the same order as the document it describes. It also avoids ranking, which would have the drafting model order its own additions by how persuasive it finds them.
- **Refuted alternative:** Number within each group, with a prefix naming the kind. This is better on stability and on self-description. A reader can tell an invariant from an alternative by the number alone, and re-rendering one group does not move the numbers in another. It loses on the epic's actual goal. It reintroduces a per-group idiom at a gate that is being aligned to a single one, and it makes the selection a parse of two things instead of a list of numbers.

### The freeze refusal keys on a record that is closed, and compares label-stripped text

- **Decision:** The checkpoint fetches the approved body only when the epic's record sub-issue is closed at the moment the checkpoint runs. It matches each listed line by normalized containment of that line's label-stripped text in that body, using the same normalization the citation check uses, and never a fuzzy or semantic match. A number naming a matched line is refused, the reason is stated, and the route is named. The line is still rendered and still ticked, and it is marked as coming from the approved body. The razor page's shared shape currently says a number is refused against content a prior run already filed. That sentence gains the words "and approved" as part of this epic, so the page and the stage state the same rule.
- **Why:** The labels exist only in the draft, and the approved body has had them stripped, so text after stripping is the one form in which the two are comparable. Keying on a closed record rather than a filed one is what makes the rule worth having. An open record's body is edited in place by design, so refusing there would turn a cut that costs one edit into a re-run.
- **Refuted alternative:** Compare by position, or by a stable identifier carried from the earlier run. This is the more precise option, and it cannot match a short invariant that merely happens to be a substring of the approved body. It loses on cost and on truth. No such identifier exists anywhere today, inventing one means writing bookkeeping into a body the stage deliberately keeps free of machine content, and the epic's own wording is about a line's content rather than its identity.

### On a revision, carried-over content is refused, and the route is the drafted body

- **Decision:** A revision run reaches the checkpoint before the record is reopened, so the invariants and risks it carries over from the approved body are refused at the gate. Approved content changes by the architect not writing it into the new body, under the revision path's supersession trail. It never changes by being unticked at the checkpoint. The refusal message says so.
- **Why:** Every path that touches a closed record already routes through the reopen, comment, update and re-close sequence. The value of that sequence is that each superseded state is reconstructible from the comment trail alone. A cut made at the checkpoint would change approved content outside that trail. What stays flippable on a revision is then exactly the set this gate should police, which is the lines the revision newly added.
- **Refuted alternative:** Let the checkpoint cut carried-over content on the revision path, since that path is authorised to rewrite the body anyway. This is better for the reviewer, who unticks one line instead of returning to the drafting phase. It loses on the supersession guarantee. The reason a line disappeared would live nowhere, while every other change on that path arrives with a stated description of what changed and why.

### The removal convention, the ticks, and the four exits are unchanged

- **Decision:** Every line arrives ticked, a plain approval files the record minus nothing, and the choice keeps its four options. Those are approving as drafted, approving with the flips named, revising, and proceeding with no record at all.
- **Why:** The razor page already settles this. A refuted alternative is not scope, and an invariant describes an epic whose scope the planning gate has already fixed. There is no smaller usable record to default to and no deferred remainder to file, so inverting here would invert nothing. The alignment this epic delivers is in how the reviewer reads and acts, not in which direction the default points. The epic also puts inversion out of scope explicitly.

### Cuts land in the draft before the filing body is derived, and no floor applies

- **Decision:** A flip edits the labelled draft before the filing body is derived from it. A reviewer may untick every line, including every invariant, and the record then files with that section empty or omitted according to its tier.
- **Why:** The stage's existing phase order already guarantees that nothing is removed from a body that has been filed. The absence of a floor follows from the razor's flat ban on minimum-count rules: no rule may require an item to exist in order to satisfy a floor. The conformance stage downstream selects its mode on whether a record exists, not on how many invariants it holds, so an emptied section needs no change there.
- **Refuted alternative:** Require at least one invariant to survive, mirroring the planning gate's rule that at least one story is always filed. This keeps the downstream conformance check meaningful, and the precedent sits in the same section of the razor page. It loses because the planning gate's floor is a floor on filing a unit of scope, whereas an invariant floor is a mandate to generate. It would hold a record open until a constraint nobody asked for was manufactured, which is the padding the razor exists to remove.

## Constraints & Invariants

1. Every invariant and every risk in the draft carrying the model's own label appears on the checkpoint's list as its own numbered line, and none is omitted.
2. No invariant and no risk the lead asked for appears on the list, in any form.
3. Every line arrives ticked, and the numbering runs as one sequence from 1 across every kind the list holds.
4. One typed selection covers every kind on the list, and one number flips exactly one line.
5. A selection naming no numbers is identical to a plain approval. The record files as drafted, with no re-render and no second confirmation.
6. The checkpoint keeps four exits: approving as drafted, approving with the named flips, revising, and proceeding with no record at all.
7. A number naming content the approved body already carries is refused with the reason stated. It is never silently ignored and never silently applied.
8. The freeze comparison runs over the label-stripped text of the line, by the same normalized containment the citation check uses, and never by a fuzzy or semantic match.
9. The approved body is fetched only when the record sub-issue is closed at the moment the checkpoint runs. An absent record and an open record each produce no fetch and no refusal.
10. The razor page's statement of the refusal rule names approved content, so the page and this stage state one rule rather than two.
11. The list reaches the reviewer verbatim inside a fenced block, and it carries no markdown list syntax of its own.
12. The checkpoint renders no second numbered list beside the checklist, so a typed number names exactly one thing.
13. A flip edits the labelled draft before the filing body is derived. Nothing is added to or removed from a body that has already been filed.
14. After a cut, the record's invariant list is renumbered without gaps, and no surviving prose in the record refers to a cut item by its old number.
15. No drafting-time token reaches the filed body. That covers a provenance label, a template placeholder, and an observation marker, and the existing assertion over the derived body still gates filing.
16. The planning gate's render is unchanged by this epic, and neither gate is ported to a second harness.

## Risks (BLOCKER / ADDRESS only)

- **ADDRESS — a label claiming the lead asked for an invariant removes that invariant from the reviewer's view, and this gate offers no way to reject the claim:** The citation check proves the quoted fragment exists in the source text. It never proves the fragment licenses the item. The planning gate handles this by rendering the fragment beside the item so the reviewer can reject a claim made on their own authority. This gate drops such items instead. The exposure is accepted, on the grounds that the invariant still lands in a body the approver reads before closing the record sub-issue, and that listing those items would dilute a list whose purpose is showing what the model added.
- **ADDRESS — on the revision path most of the checklist will be frozen, and a reviewer who does not know why will read the list as broken:** A revision re-derives most of the same invariants, so most lines match the approved body and refuse. Mark a frozen line when the list is rendered rather than only when a number is typed, and have the refusal name the route, which is that the change belongs in the drafted body under the supersession comment.
- **ADDRESS — the stage's instructions will name a checker mode that an older installed executable does not have:** The components and the executable ship in one package and move together for an adopter, but a maintainer's local loop points the install at the checkout while the executable on the path may be older. The run stops with the diagnostic and files nothing, which is what every other non-zero exit in this stage already does. Falling back silently to a hand-rendered list is ruled out, because it reinstates exactly the unverifiable render this epic removes.

