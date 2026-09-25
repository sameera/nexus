# Decision Record: A Coherent Decomposition Files an Initiative

## How it works

The initiative is offered inside the consent question `/nxs.epic` already asks before filing a split, not as a separate question.

On accept, the run files the initiative first, then the stubs as its sub-issues, then fills the stubs' issue numbers into the initiative's body. If the run is repeated, for example after an interruption, it reuses the initiative instead of filing a second one.

Today a stub may never have a parent. That rule narrows to: a stub's parent must be an initiative. Every other parent is still refused, including an issue with no label saying what kind it is, and nothing is filed.

Closing an epic needs no change, because it reads only the epic's own sub-issues, never its parent. One refusal is added: no stage accepts an initiative where it expects an epic (D11).

## Approval brief

Approval covers the whole record. This brief lists what needs a decision and every choice that carries a trade-off.

**Resolve before approval**

- #708 needs a new criterion (D11): "**Given** an issue declared as an initiative, **when** any stage is run against it as an epic, **then** the stage refuses and names the initiative." Checked 2026-09-25: not on #708.
- #706 criterion 1 needs rewording (D2, D9). It says an objective is shown whenever a run is about to file more than one stub. Under this design, the model may propose none if it states why (D2), and only a split in `/nxs.epic` proposes one; `/nxs.close`'s deferred stubs never do (D9). Checked 2026-09-25: #706 unchanged.
  - Trade-off (D2): whether the initiative option appears at all depends on the model's judgment that the stubs share an objective.
- D10 has no delivering story. When a stub under an initiative proves too big and is split again, its new stubs join the same initiative. No criterion on #706–#708 covers that. Amend a story, or drop D10.
  - Trade-off if kept: after a stub is split again, the initiative's body still names the closed original and not its new stubs.

**Choices with trade-offs**

- D1. The initiative is offered inside the existing consent question, with no option marked as recommended.
  - Trade-off: the lead judges the objective with no recommendation to lean on.
- D4. Before filing, the run reads the proposed parent's label or issue type, and refuses any parent not marked as an initiative.
  - Trade-off: that check, which used only local data until now, makes one read from GitHub.
- D5. The initiative is a new kind of issue, with its own label and issue type.
  - Trade-off: a repository that uses GitHub issue types cannot file an initiative until its organisation defines an initiative type.

**Committed follow-up**

- R1 ADDRESS: if the repository has no initiative issue type, the consent question says so and offers only flat filing. Delivered by #706.
- R2 ADDRESS: the closed original stub's closing comment names its new stubs. Delivered by existing behaviour.

## Guarantees

### Consent

- G1. An objective is proposed only when `/nxs.epic` splits scope into more than one stub. (D9)
- G2. When it does, the consent question shows either a proposed objective or the reason for proposing none, never neither. (D2)
- G3. Nothing is filed until the lead has accepted or declined the initiative. (D1, D3)
- G4. When the lead declines, or no objective is proposed, the run files exactly what it files today: no parent, no initiative issue, no initiative label. Declining needs no reason and is not an error. (D1)
- G12. When the split comes from a finished discovery, the objective is the discovery's accepted destination, not redrafted. (D8)

### The initiative issue

- G5. An accepted split files exactly one initiative, marked as an initiative, whose body states the objective. "Marked" means the initiative label, or the initiative issue type in a repository that classifies issues by GitHub issue type. (D5, D6)
- G6. The body lists every stub in an order that respects every "blocked by" link GitHub records between them. Each entry states how much of the objective it reaches; the last says the objective is reached. The body has no table or other list of children. (D7)
- G13. The initiative's label or issue type is read from the repository's configuration, never guessed. If the repository uses issue types and has none for initiatives, the run says so. (D5)
- G14. Repeating an interrupted run never files a second initiative. (D6)

### Parentage

- G7. Every stub in an accepted split is a sub-issue of that split's initiative, and of nothing else. (D4)
- G8. A filing that gives any stub a parent not marked as an initiative is refused whole, and nothing is filed. So no stub is ever a sub-issue of an epic. (D4)
- G11. When a stub under an initiative is split again, its new stubs become sub-issues of the same initiative, and the initiative's body is not edited. (D10)
- G15. No stage accepts an initiative where it expects an epic. (D11)
- G16. Nothing adds an initiative to stubs filed before this ships. An initiative never sits under another initiative, and never groups stubs from more than one split. (D6)

### Existing behaviour to preserve

- G9. Closing an epic reads only the epic's own sub-issues, never its parent.
- G10. Planning a stub that sits under an initiative takes the same steps as planning any stub, and never detaches or moves the stub or edits the initiative.

## Risks and dependencies

- R1 ADDRESS — A repository that uses GitHub issue types may have no initiative type, and a run cannot create one. The run checks for it before asking the lead. If it is missing, the consent question shows the proposal, names the missing type, and offers only flat filing, so no option offered can fail after the lead consents. Delivered by #706.
- R2 ADDRESS — After a stub under an initiative is split again, the initiative's body still names the closed original and not its new stubs. The original's closing comment names the new stubs, which is the way back until initiatives can be edited. Delivered by existing behaviour.

## Concept-store changes

This design changes two concept-store statements. The distiller rewrites them; it does not report them as drift.

- Epic stub page: "no stub is ever a sub-issue" becomes "no stub is ever a sub-issue of an epic".
- Issue kind page: epic, story and record gain a fourth kind, the initiative.

The stage prose in `/nxs.epic` and `/nxs.close` that says a stub is never a sub-issue of anything is reworded to match, or a later reader restores the old guard.

## Design rationale and mechanism

### Mechanism

**Terms**

- **Consent gate:** the question `/nxs.epic` asks the lead before filing a split. Its options are the ways the split can be filed.
- **Filer:** the shared step every stage uses to create GitHub issues in a batch and link each to its parent. Today it refuses to give any stub a parent, because a stub under an epic would block that epic from closing. It checks before creating anything, so a refused batch creates nothing. Also called the batch filer.
- **Single-epic filer:** a separate step that creates or promotes one epic. It writes epic metadata and applies the needs-design label.
- **Run folder:** the local folder a run keeps its working files in.
- **Filed-record:** the filer's list, in the run folder, of the issues it has created. On a rerun the filer reuses an issue on that list instead of creating it again.
- **Rewrite pass:** the filer's step that replaces draft titles in an issue body with the issue numbers of the issues just filed. It already runs when an epic and its stories are filed together.
- **Marker:** what declares an issue's kind: a label, or a GitHub issue type (a GitHub classification separate from labels) in repositories that use types.
- **Declared classification:** the repository's configured set of markers, one per kind.
- **Publishing resolver:** the shared lookup that reads a marker's actual name from that configuration.
- **Kind classifier:** the shared check that reads an issue's markers and says which kind it is. Today it knows epic, story and record; anything else is "other".
- **Resolver:** the lookup every stage uses to turn an epic's issue number into the epic it works on.

**Filing on accept**

1. The filer files the initiative as a one-item batch, with the initiative marker, and adds it to its own filed-record in the run folder as soon as it exists.
2. The filer files the stubs with the initiative as their parent. Before creating anything, it reads the parent's marker. Any parent not marked as an initiative refuses the whole batch.
3. The rewrite pass replaces the stub titles in the initiative's body with the stubs' issue numbers.

**Close and the resolver**

Both read an issue's kind from its marker. Both read only an epic's own sub-issues, never its parent; #211 made that so, and tests cover it. The only new resolver logic is D11's refusal.

### Decisions and reasons

#### D1 — Propose the objective inside the existing consent gate

- **Decision:** Each consent option that files stubs splits into two variants: file under the proposed initiative, or file flat. Neither is marked recommended. A reworded objective counts as acceptance in the lead's wording.
- **Why:** The objective must be settled with the stubs in view, before anything is created, at one interactive point. A recommendation would turn the lead's judgment into approval of the model's reading.
- **Refuted viable alternative:** A second question about the objective in the same prompt. It leaves the consent options unchanged, but asks a question that means nothing if the lead files one full epic, and two independent answers can combine into states the gate must explain.
- **Trade-off:** the lead gets no recommendation and judges the objective unaided.
- **Delivered by:** #706
- **Guarantees:** G2, G3, G4

#### D2 — The model may withhold the proposal, with a stated reason

- **Decision:** When the model judges the stubs share no objective, it says so at the gate with its reason, and offers only flat filing.
- **Why:** Stubs filed to defer work share no objective. Writing one anyway is the invention the epic refuses. Stating the reason keeps the judgment visible.
- **Refuted viable alternative:** Always propose an objective for more than one stub. It keeps the lead as sole judge and the gate predictable, but forces an objective the model does not believe, which a hurried lead may accept.
- **Trade-off:** whether the initiative option appears depends on the model's judgment.
- **Epic commitment affected:** #706 criterion 1. Old: "a proposed objective for the set is shown alongside the stubs". New: "a proposed objective for the set, or the model's stated reason for proposing none, is shown alongside the stubs". Status: pending.
- **Delivered by:** #706
- **Guarantees:** G2

#### D3 — Show everything the initiative states at the gate

- **Decision:** The objective, the order and every reach statement are shown before consent and accepted or declined as one unit.
- **Why:** Editing the initiative after filing is out of scope. Text first seen on the filed issue would be durable and unapproved.
- **Delivered by:** #706
- **Guarantees:** G3

#### D4 — The filer's refusal narrows by reading the parent's declared kind

- **Decision:** An unplanned item may name a parent only if the repository's declared classification marks it as an initiative. Any other parent — epic, story, record, unmarked, unresolvable — refuses the whole batch, and nothing is created.
- **Why:** The guard prevents a stub inside an epic's sub-issues, where it blocks that epic's close. An initiative sits above the epic, and close never reads an epic's parent. Refusing everything else by default keeps the old guarantee.
- **Refuted viable alternative:** The writer declares the parent's kind with a trusted flag. It stays local, but the guard exists because writers are not trusted with parentage.
- **Refuted viable alternative:** Allow only an initiative filed in the same batch. It stays local, but one batch carries one classification and the initiative needs a different one, and the filer would have to order creation by parent.
- **Trade-off:** the filer's guard, local-only until now, gains one remote read.
- **Delivered by:** #708
- **Guarantees:** G7, G8, G9, G10

#### D5 — The initiative is a new declared kind

- **Decision:** The initiative gets a label (built-in value `initiative`, already used by #601) and an issue type with no built-in value. Both come only from the shared publishing resolver. The kind classifier recognises it; today it falls into "other".
- **Why:** D4 needs a positive marker. The classification rules forbid inferring kind from graph position or guessing an issue type's name.
- **Trade-off:** a repository in issue-type mode cannot file an initiative until the organisation defines an initiative type (R1).
- **Delivered by:** #707
- **Guarantees:** G5, G13

#### D6 — File the initiative first, as its own resumable batch

- **Decision:** The initiative is filed through the batch filer with its own filed-record in the run folder, then the stubs. The body names stubs by draft name; the rewrite pass substitutes numbers.
- **Why:** It matches epic-before-stories. The filer reuses a recorded issue on rerun, so an interrupted run cannot create a second initiative. Every parent link stays inside the guarded filer.
- **Refuted viable alternative:** File the stubs flat, then create and attach the initiative. A partial failure leaves no half-attached set, but the attach step runs outside the filer's guard.
- **Refuted viable alternative:** Use the single-epic filer. It writes epic metadata, applies needs-design and handles promotion, none of which an initiative may have.
- **Delivered by:** #707
- **Guarantees:** G5, G14, G16

#### D7 — Derive the body's order from the stubs' blocking edges

- **Decision:** One order that respects every blocking edge, ties broken by decomposition order. Each entry says in plain words how much of the objective is reached once it and those before it are done. No percentages, no table.
- **Why:** The epic requires the body's order and the stubs' own ordering to agree. Deriving one from the other is the only way they agree on the day of filing. A percentage claims precision nobody has.
- **Delivered by:** #707
- **Guarantees:** G6

#### D8 — The objective's source depends on entry mode

- **Decision:** From a finished discovery, the objective is its accepted destination, verbatim. From typed intent, it is drafted from the lead's description as the outcome of completing every stub, claiming nothing beyond it.
- **Why:** A discovery already states one outcome; redrafting it would be invention. In intent mode the lead's description is the only honest source.
- **Delivered by:** #706
- **Guarantees:** G12

#### D9 — Only `/nxs.epic`'s decomposition path proposes an objective

- **Decision:** No objective for the approval gate's deferral stub, `/nxs.close`'s deferred-scope stubs (even several), the intake lane, a one-goal decomposition, or a re-decomposed promoted stub.
- **Why:** Deferred stubs have no shared objective by construction, and one stub has no set to group. Every other stub writer's output stays unchanged.
- **Epic commitment affected:** #706 criterion 1, as in D2. Old: "a run is about to file more than one stub". New: "a decomposition in `/nxs.epic` is about to file more than one stub". Status: pending.
- **Delivered by:** #706
- **Guarantees:** G1

#### D10 — Successors of a re-decomposed stub join the same initiative

- **Decision:** Successors of an oversized promoted stub under an initiative become sub-issues of that initiative. The original closes as not planned. The initiative's body is not edited; the original's closing comment names the successors.
- **Why:** The successors serve the same objective. Editing the body and nesting initiatives are both out of scope.
- **Refuted viable alternative:** File successors flat. The body and the sub-issues keep agreeing, but the successors drop out of the grouping a lead browses.
- **Trade-off:** after a re-decomposition, the initiative's order names a closed stub and omits its successors (R2).
- **Delivered by:** no story (see To approve).
- **Guarantees:** G11

#### D11 — Every stage refuses an initiative as its epic target

- **Decision:** Any stage resolving an epic refuses an issue declared as an initiative and names it.
- **Why:** A parentless initiative resolves as an epic today. Close or analyze would read its stubs as stories, and close could close the initiative, whose closing is out of scope. D5 makes this refusal small.
- **Epic commitment affected:** #708. Old: no criterion. New: "**Given** an issue declared as an initiative, **when** any stage is run against it as an epic, **then** the stage refuses and names the initiative." Status: pending.
- **Delivered by:** #708
- **Guarantees:** G15
