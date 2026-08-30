# Epic: Port the epic filer to TypeScript

> ⚠️ **Utilization risk:** assessed L (1–2 weeks). Fills the sprint with no slack for overruns. Watch for scope creep.

## Description

The epic filer is the capability that turns a drafted `epic.md` into the GitHub issue an epic ships and closes under. `/nxs.epic` reaches it twice, on two different paths: once to create a new epic issue, and once to populate a backlog stub in place so the number the scope was deferred under survives promotion. It is the last capability in Nexus still written in Python. While it stays there the release keeps declaring a Python interpreter as a runtime requirement, and a lead can lose a planning session to an interpreter that resolves to the wrong thing at the moment the approval gate is finally cleared.

Everything this port needs already exists in TypeScript. The toolkit shell and the shared delivery-configuration resolver moved in #351; the story filer moved in #353, and building it produced the platform wrapper around `gh`, the project lookups, the retrying runner and the issue-type probe. So this epic is composition rather than construction: the code that is genuinely new is the body pipeline that derives an issue body from a draft, the frontmatter link write-back, the promotion path, and the classification decision that chooses between a GitHub issue type and a label. When it lands, the registry's last delegating row stops delegating.

The bar is behaviour preservation, not improvement. Component bodies invoke this capability by name and read its output; the resolver reads back the hidden meta block it writes; `/nxs.epic` reads the `link` it writes into the draft. Every flag, every line of output and every exit code stays as it is. The existing Python tests are the specification and are carried across rather than reinvented, so a divergence surfaces as a failing test rather than as a mangled issue body on an epic someone has already approved. The one deliberate exception is named in #381 and in the assumptions below.

## Success Metrics

- `nexus-gh create-epic` files an epic to completion with no Python interpreter process spawned.
- The behaviours asserted by the existing Python tests — `test_stub_promotion`, `test_needs_design_label`, and the epic filer half of `test_writeback_integration` — are asserted by TypeScript tests over the same cases.
- For a corpus of epic drafts, the issue body the port derives is byte-identical to the body the Python filer derives from the same draft, including the hidden meta block.
- An epic resolved by `nexus epic-resolve` from an issue filed by the port reconstructs the same field shape it reconstructs from an issue filed by the Python filer.
- Every flag the capability accepts today is accepted with the same meaning, and every exit code is unchanged: 0 for a filed epic and for a declined overwrite, non-zero for a refused promotion, a missing draft, a draft outside the target root, an absent `epic` title, and an empty body.
- A promotion that is refused leaves the target issue byte-identical to how it was found — no title, body, or label change.
- The epic filer source defines no function of its own for reading configuration, resolving classification, project targets or repository targets, upserting labels, probing issue types, or writing the settings file back — each is reached through the shared module from #351 or the platform modules from #353, and a test asserts that.

## Personas

Per `docs/product/context.md`.

## Terminology

Several near-synonyms meet in this capability and are easy to conflate. Throughout this epic:

- **draft** — the `epic.md` file passed on the command line. It lives in session scratch and is not committed; the filer reads it and writes one field back into it. "The epic file" and "the draft" are the same thing.
- **filed body** — the issue body the filer derives from the draft. It is not the draft's body: the frontmatter is stripped, non-durable pointers and the `## User Stories` section are removed, and the hidden meta block is appended.
- **meta block** — the `nexus:epic-meta` HTML comment carrying the draft's raw frontmatter verbatim onto the issue. Invisible when rendered, read back by the resolver. It is what makes an epic re-resolvable from its number alone.
- **classification** — the mechanism by which a filed issue is marked as an epic: either a GitHub issue **type** applied after creation, or an **epic classification label** passed at creation. The mode (`types`, `labels`, `legacy-auto`) decides which. "Epic classification label" is the one spelling this epic uses for that label; "epic label" and "classification label" are not used.
- **unplanned label** — the label marking an issue as scope identified but not yet planned. It is the sole legality test for promotion, and promotion removes it. It is a different label from the epic classification label, which promotion adds.
- **needs-design label** — a third, unrelated label, applied from the epic's declared complexity, declaring that this epic warrants a decision record.
- **declared complexity** — the `complexity` value in the draft's own frontmatter, and the only value the needs-design decision reads. `/nxs.epic` arrives at that value by rolling up its story sizes, but that rollup happens before the filer is invoked; the filer reads a declared field and never aggregates anything.
- **promotion** — populating an existing unplanned epic issue in place. Nothing is created and nothing is closed. Contrast **creation**, which mints a new issue.
- **settings file** — the repository's own delivery-configuration file, and the one spelling this epic uses for it. The publishing decisions it holds are read through the shared resolver and written through the shared writer; "settings block" and "publishing configuration" are not used.
- **write-back** — persisting the publishing decisions the run reached into the settings file, so the fragile probe and discovery run at most once per repository. Distinct from the **link write-back**, which writes the issue number into the draft's frontmatter.

## Acceptance Criteria

- [ ] **Given** each flag the capability accepts today — the positional draft path, `--root`, `-y`/`--yes`, `--project`, `--no-project`, and `--promote` — **when** it is passed, **then** it is accepted with the same meaning and the same spelling it has today, and an unrecognised flag is refused with a non-zero exit and nothing written.
- [ ] **Given** a draft path that does not resolve to a file, **when** the filer runs, **then** it reports the missing file and exits non-zero without making any remote call.
- [ ] **Given** no `--root`, **when** the filer runs, **then** the target root is resolved from the current working directory and never from the draft's own location.
- [ ] **Given** a draft that resolves outside the resolved target root, **when** the filer runs, **then** it is refused with a message naming both paths and pointing at `--root`, and nothing is written.
- [ ] **Given** the target root resolves, **when** any command that reaches GitHub or git runs, **then** it runs with that root as its working directory.
- [ ] **Given** `gh` is absent, is not authenticated, or the target root is not a git repository, **when** the filer runs, **then** each case is reported distinctly and the run exits non-zero before reading the draft.

## Notes

The containment rule and the "root is operator-supplied, never derived from the artifact" rule are settled decisions carried from #283; this story ports them, it does not revisit them.

The flag list above is exhaustive and is the capability's whole surface. `--from` is not in it: that is a flag of the `/nxs.epic` command, not of this capability, which is why #382 quotes it inside a message rather than accepting it as input.

### Story #379: The filed body is derived from the epic draft

**As a** delivery lead approving an epic, **I want** the issue to carry the epic's content and nothing that rots, **so that** the issue still reads correctly after the queue entry it was planned in has been drained.

## Acceptance Criteria

- [ ] **Given** a draft with YAML frontmatter, **when** the body is derived, **then** the frontmatter is not part of the filed body, and a draft with no frontmatter yields its whole content as the body.
- [ ] **Given** a draft body containing a line referencing a queue path, **when** the body is derived, **then** that line is absent from the filed body wherever in the body it appeared.
- [ ] **Given** pointer preamble lines before the epic's first level-1 heading, **when** the body is derived, **then** they are absent from the filed body, and a line of the same shape appearing after that heading is kept.
- [ ] **Given** a draft with a `## User Stories` section, **when** the body is derived, **then** that section is absent from the filed body up to the next level-2 heading, the level-3 and level-4 subsections inside it do not terminate the removal, and the section that follows it is kept intact.
- [ ] **Given** a draft with no `## User Stories` section, **when** the body is derived, **then** the body is unchanged by that step.
- [ ] **Given** a draft with frontmatter, **when** the body is derived, **then** the filed body ends with a meta block carrying that frontmatter's raw text verbatim, and a draft with no frontmatter gets no meta block.
- [ ] **Given** an issue filed from a derived body, **when** the resolver reconstructs the epic from the issue number alone, **then** it recovers the same field shape it recovers from an issue filed by the Python filer.
- [ ] **Given** a draft whose derived body is empty or whitespace, **when** the filer runs, **then** it reports that and exits non-zero without creating anything.

## Notes

This is the story where a silent regression is most expensive, because a mangled body reaches an issue a lead has already approved. Assert the derivation as a whole — draft in, filed body out — over a corpus of real drafts, not each transform in isolation.

### Story #380: Classification and target repository resolve before the issue is filed

**As a** delivery lead whose repository classifies issues its own way, **I want** the filer to reach the same classification and the same target repository the Python filer reaches, **so that** epics filed after the port are indistinguishable from the ones filed before it.

## Acceptance Criteria

- [ ] **Given** each classification mode — `types`, `labels`, and the built-in `legacy-auto` — **when** an epic is filed, **then** the issue ends up classified the way that mode classifies it today.
- [ ] **Given** mode `types` and a resolved issue type, **when** the epic is filed, **then** the type is applied after creation and no epic classification label is passed at creation.
- [ ] **Given** mode `types` and no resolvable issue type, **when** the epic is filed, **then** the run warns, files the issue untyped, and does not silently substitute a label.
- [ ] **Given** mode `types` and an issue type that the repository does not declare, **when** the type is applied, **then** it warns naming the type and the mode, and applies no label.
- [ ] **Given** mode `legacy-auto` and a resolved issue type the repository does not declare, **when** the type application fails, **then** the run falls back to the epic classification label, upserting it before adding it.
- [ ] **Given** the issue type is resolved from both the draft's own `type` frontmatter and the configured epic type, **when** they differ, **then** the draft's value wins.
- [ ] **Given** an epic classification label is to be passed at creation, **when** the run reaches creation, **then** the label has already been upserted, so a repository that has never seen it files cleanly.
- [ ] **Given** a configured epic repository target, **when** it resolves, **then** it is reported and every issue command targets that repository, and a member with no target of its own inherits the hub's.

## Notes

Classification mode, the epic classification label, the epic repository target and issue-type probing are all resolved through the shared module from #351. This story wires the decision, not the resolution rules.

### Story #381: The epic issue is created and its number recorded on the draft

**As a** delivery lead who has just approved an epic, **I want** the issue number written back into my draft the moment the issue exists, **so that** a failure while decorating the issue can never lose the number and leave me filing a duplicate.

## Acceptance Criteria

- [ ] **Given** an approved draft, **when** the filer runs, **then** one issue is created carrying the title from the draft's `epic` frontmatter field and the derived body.
- [ ] **Given** a draft with no `epic` field, **when** the filer runs, **then** it reports the missing field, shows the expected frontmatter shape, and exits non-zero without creating anything.
- [ ] **Given** the issue is created, **when** the run continues, **then** the draft's frontmatter carries `link` set to the new issue number before any project, type or label step is attempted.
- [ ] **Given** a draft whose frontmatter already has a `link` field, **when** the link is written back, **then** that field is updated in place rather than a second one added; **given** it has none, **then** one is inserted before the closing frontmatter fence.
- [ ] **Given** the link is written back, **when** the draft is compared to its prior content, **then** nothing outside that one field has changed.
- [ ] **Given** a draft that already carries a link, no `--yes`, and an interactive terminal, **when** the filer runs, **then** it warns with the existing link and asks whether to file anyway; declining exits zero having created nothing.
- [ ] **Given** a draft that already carries a link and `--yes`, **when** the filer runs, **then** it files without asking.
- [ ] **Given** a draft that already carries a link, no `--yes`, and no interactive terminal, **when** the filer runs, **then** it refuses with a message naming `--yes` as the way to proceed, exits non-zero, and never blocks waiting for input that cannot arrive.
- [ ] **Given** the issue is created but its number cannot be read back from the result, **when** that happens, **then** the run reports it and exits non-zero rather than proceeding without a number.

## Notes

The confirmation prompt is the one interactive point in this capability, and the non-interactive case is the epic's single deliberate divergence from behaviour preservation. The Python filer calls `input()` unguarded, so with no terminal it raises and exits on a traceback; the port refuses with a message instead. Both exit non-zero, so the exit-code metric holds, but the outcome is stated rather than incidental — a pipeline stage must never hang on a prompt nobody can answer.

### Story #382: A backlog stub is promoted in place, keeping its number

**As a** delivery lead planning a stub filed months ago, **I want** the epic to ship under the number the scope was deferred under, **so that** every dependency edge and body mention written back then still points at the right issue.

## Acceptance Criteria

- [ ] **Given** `--promote` naming an issue that carries the unplanned label, **when** the filer runs, **then** that issue gains the epic title, the derived body and the epic classification, loses the unplanned label, and no second issue is created and nothing is closed.
- [ ] **Given** `--promote` naming an issue that does not carry the unplanned label, **when** the filer runs, **then** it is refused before any write, the message says the issue is not an unplanned epic and names the `/nxs.epic --from` command form as the way to load an already-planned epic, and the target issue is unchanged.
- [ ] **Given** `--promote` naming a number that does not resolve to an issue in the target repository, **when** the filer runs, **then** it is refused with a message distinguishing that from the not-unplanned case, and nothing is written.
- [ ] **Given** a promotion succeeds, **when** the run reports, **then** it states that the number was kept, that no second issue was created and that nothing was closed.
- [ ] **Given** a promotion succeeds, **when** the draft is inspected, **then** its `link` field carries the promoted issue's number.
- [ ] **Given** the promotion edit does not return a usable issue URL, **when** the run reports, **then** it reports a URL constructed from the target repository and the issue number rather than reporting none.

## Notes

The legality check reads the target's labels before any write, and the two refusal messages are deliberately different — an unresolvable number is a bad input, a resolvable issue with no unplanned label is an already-planned epic, and the lead needs them told apart. `test_stub_promotion` is the specification.

### Story #383: The needs-design label follows the epic's declared complexity

**As a** delivery lead, **I want** the epic to declare from its own issue whether it warrants a decision record, **so that** the downstream stages decide that from the issue graph alone, with nothing remembered off the issue.

## Acceptance Criteria

- [ ] **Given** a draft whose declared complexity is M or larger, **when** the epic is filed, **then** the issue carries the needs-design label, upserted before it is applied.
- [ ] **Given** a draft whose declared complexity is one the shared rule exempts, **when** the epic is filed, **then** the label is not applied.
- [ ] **Given** a draft with no declared complexity, **when** the epic is filed, **then** the label is applied.
- [ ] **Given** the label cannot be applied, **when** that happens, **then** the run warns telling the lead to apply it by hand before the decision-record stage, and does not fail the run — an issue that exists is never abandoned over a label.
- [ ] **Given** a promotion, **when** it completes, **then** the label decision is made and applied the same way it is on the creation path.

## Notes

The exemption rule and the needs-design label name resolve through the shared module from #351. The threshold in the first two criteria is that rule's stated default, asserted here on purpose so a change to it fails this story's tests rather than silently changing which epics get a decision record. `test_needs_design_label` is the specification. The run's report of this decision belongs to #385, which owns the whole summary.

### Story #384: The issue reaches its project

**As a** delivery lead filing into a repository whose board is set up its own way, **I want** the project target honoured exactly as it is today, **so that** an epic lands on the board I expect and a repository with no board is neither slowed nor nagged.

## Acceptance Criteria

- [ ] **Given** `--project`, **when** the filer runs, **then** that project is used and it outranks any configured target; a target that does not resolve warns without failing the run.
- [ ] **Given** an explicit target written as `owner/<number>`, as a bare `<number>`, or as a project title, **when** it is looked up, **then** each form resolves to the same project it resolves to today, a bare number taking its owner from the current repository.
- [ ] **Given** the configured target resolves to auto-discovery, **when** the filer runs, **then** it probes the repository for a project once and, finding none, warns and continues.
- [ ] **Given** the configured target is `none`, **when** the filer runs, **then** it performs no lookup, no discovery and no project call, and emits no warning about a missing project.
- [ ] **Given** `--no-project`, **when** the filer runs, **then** no project is resolved and the issue is added to none.
- [ ] **Given** adding the issue to its project fails, **when** that failure is handled, **then** it warns and the run is not failed — an issue that exists is never abandoned over its board membership.

## Notes

The project lookups already exist in TypeScript from #353 and are reused rather than re-ported; this story wires them to the single issue this capability files. Which target was used, and whether discovery ran, is handed to #385, which decides what gets persisted.

### Story #385: The run persists what it decided and reports the outcome

**As a** delivery lead, **I want** the fragile probe to run at most once per repository and the run to tell me plainly what it did, **so that** later filings are fast and I can see the outcome without opening GitHub.

## Acceptance Criteria

- [ ] **Given** a repository whose settings file declares no publishing decisions, **when** a run completes, **then** the decisions it reached are persisted into the settings file and the run warns that they should be reviewed and committed.
- [ ] **Given** the run persists its decisions, **when** the settings file is compared, **then** the write is add-only — a key already declared is never overwritten — and no repository target is written, so a hub-inherited value stays inherited.
- [ ] **Given** the project value is persisted, **when** it is written, **then** it is written only on the auto-discovery path, as the discovered reference or as `none`, and an invocation-time project flag is never frozen into configuration.
- [ ] **Given** a run completes, **when** it reports, **then** it names the issue number, the title, the applied type or label, the design decision, the URL, and whether the issue was added to a project.
- [ ] **Given** the epic needs no decision record, **when** the design line is reported, **then** it names the declared complexity that exempted it rather than a hard-coded size.
- [ ] **Given** the run was a promotion, **when** it reports, **then** the summary says an unplanned epic was promoted rather than that an issue was created.

## Notes

The settings writer already exists from #351; this story's own work is assembling what gets persisted from what #380 and #384 decided, and owning the summary so one output line has one owner. `test_writeback_integration` is the specification for the persistence half.

### Story #386: The toolkit answers create-epic without spawning Python

**As a** Nexus maintainer, **I want** the registry's last delegating row to name an in-process handler, **so that** the toolkit no longer reaches for an interpreter to file an epic.

## Acceptance Criteria

- [ ] **Given** the toolkit is asked for `create-epic`, **when** the capability runs, **then** it runs in process and no Python interpreter is spawned.
- [ ] **Given** the registry after this story, **when** its rows are inspected, **then** none of them delegates to Python.
- [ ] **Given** the capability listing and the usage text, **when** they are rendered, **then** `create-epic` appears exactly as it does today, with the same summary — the dispatcher cannot tell which language a row is implemented in.
- [ ] **Given** each component body and pipeline stage that invokes this capability, **when** it runs, **then** it invokes it by the same name with the same arguments as before, unchanged by this epic.
- [ ] **Given** the ported capability, **when** its exit codes are observed, **then** they are unchanged from the delegating row's for every case: a filed epic, a declined overwrite, a refused promotion, and each refused input.

## Notes

The story filer's cut-over (#374) is the template: the handler is the seam the earlier stories' tests already drive, so this story is the registry row and nothing left to re-assert.

## Assumptions

- The existing Python `create_epic` module is the behavioural specification for this port. Where a Python test asserts a behaviour, the TypeScript port asserts the same behaviour; this is not an occasion to change what the behaviour is.
- The single exception is the confirmation prompt with no terminal attached, where the Python filer has no defined behaviour because it calls `input()` unguarded. #381 pins that case to an explicit refusal rather than preserving a traceback.
- The port reuses the shared helpers ported in #351 — the configuration reader, the precedence resolver, classification, project-target and repository-target resolution, label upsert, the issue-type probe and the settings writer — and re-implements none of them.
- The port also reuses the platform modules built for the story filer in #353 — the wrapper around `gh`, the project lookups, the retrying runner and the issue-type resolution — rather than porting a second copy of them from Python.
- The ported code lands as TypeScript beside the story filer, following the existing per-capability library convention rather than introducing a new packaging shape.
- The handler, not the registry row, is the seam the tests drive, so the cut-over in #386 is a one-line change with nothing left to re-assert. This follows the decision recorded for the story filer port.
- The Python sources stay on disk after this epic; only the registry row stops delegating. Removing the interpreter, the Python modules and their packaging is #354.
- The hidden meta block keeps its current marker and its verbatim-frontmatter shape, so an epic filed before the cut-over resolves identically after it.

## Out of Scope

- Retiring the Python interpreter requirement, the Python sources, and their packaging (#354).
- Any change to what the capability does, what it prints, or what it exits with, beyond the one non-interactive case named in #381. This epic changes the implementation language only.
- Adding, renaming or removing flags, frontmatter keys, configuration keys or output lines.
- Changes to the `nexus` executable's own verbs, or to `create-story`.
- Any change to how the resolver reads the meta block, or to the epic document structure `/nxs.epic` produces.

## Open Questions

## Implementation Sequence

| Issue | blocked_by |
|---|---|
| #378 | none |
| #379 | none |
| #380 | #378 |
| #381 | #378, #379, #380 |
| #382 | #378, #379, #380 |
| #383 | #381 |
| #384 | #381 |
| #385 | #380, #381, #384 |
| #386 | #381, #382, #383, #384, #385 |

<!-- nexus:epic-meta
feature: "Component Distribution"
feature_path: docs/features/component-distribution
epic: "Port the epic filer to TypeScript"
slug: port-epic-filer-to-typescript
created: 2026-08-29
type: enhancement
complexity: L
complexity_drivers: [nine stories with four at M, a 1025-line behaviour-preserving port, two write paths sharing one body pipeline, a three-mode classification table with a post-creation fallback, three Python test modules carried across as the specification, a live registry cut-over]
concepts: []
link: "#352"
record: "#387"
record_state: closed
-->
