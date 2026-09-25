# Decision Record: Query Function

## How it works

Query does its database work before any record is mapped, not while each record is mapped.

A run maps its records in batches of about 100. Before mapping a batch, the platform collects every search value the batch's records will look up; the epic's field-or-literal rule makes them known in advance. It sends the database one query per Query call for exactly those values, filtered to the flow's organization as well as its workspace, so no row can come from another tenant (D5). The same step checks the table and column names, so a wrong name fails before any record is mapped.

The answers are kept for the batch. While each record is mapped, Query only reads them, after checking they came from the flow's own organization and workspace. It never queries the database itself.

So work and memory follow the batch, not the table, which may hold 100,000 rows or more. That holds only while the search column is indexed (the database can find matching rows without reading every row); without an index, each query reads the whole table (R2).

## Approval brief

Approval covers the whole record. This brief lists what needs a decision and every choice that carries a trade-off.

**Resolve before approval**

- R1 BLOCKER: which database holds table rows, and whether the flow engine can read it.
- #222 metric 1 does not hold (D12). "A translation a Value List holds today is expressed as a table plus a Query call, with no other change to the flow." A Value List that uses its no-match fallback needs its mapping expression edited. The record neither amends the metric nor funds a fallback. Checked 2026-09-25: metric unchanged.
- #223 needs a new criterion (D11): a date, timestamp or geometry search column fails the run and names the column. Checked 2026-09-25: not on #223.
- #223's note says an expression is not accepted as the search value "in this phase" (D3). Under this design it is never accepted without a new design. The record does not amend the note. Checked 2026-09-25: note unchanged.
- #222's description says Query "retires a whole resource type" (D13). This epic retires nothing; the record reads that sentence as intent. Not amended. Checked 2026-09-25: description unchanged.
- G16 has no supporting decision. Add one, or drop the guarantee.

**Choices with trade-offs**

- D1. Query is a new function beside the Value List's lookup, which is left unchanged.
  - Trade-off: two lookup functions exist until a later epic retires one.
- D4. Query calls naming the same table and columns share one set of fetched answers.
  - Trade-off: the flow engine's documentation says the settings stored for a call at publish may only control how data is fetched, not what is returned. Sharing answers needs those settings to carry where each call reads its search value, so that rule must change or a new setting be added. This changes the engine's framework, not only Query.
- D6. Table and column names are checked when the flow runs, not when it is published.
  - Trade-off: a typo is found at run time.
- D7. A search value the fetch did not cover fails the run instead of returning empty.
  - Trade-off: a valid way of writing the search value that the fetch cannot trace fails the run (R3).
- D8. A ceiling on the number of distinct search values per Query call in one batch.
  - Trade-off: a batch above the ceiling fails instead of being split.
- D9. A search value matching two or more rows fails the run.
  - Trade-off: it fails even when those rows carry the same result.
- D10. Fetched answers are cached per search value for sixty seconds.
  - Trade-off: one run may mix a value up to sixty seconds old with a fresh one, so a run is not a consistent snapshot of the table.

**Before implementation**

- R2 ADDRESS: confirm case-insensitive text matching can use an index, or accept a full read of the table with a measured cost. Depends on the table resource epic; no issue named.
- R3 ADDRESS: list every way of writing the search value the fetch can trace, and enforce that list at publish.
- R4 ADDRESS: give the flow engine the flow's organization and workspace, and change how it fetches and caches data, as one change, with Value List behaviour pinned by tests first.

## Guarantees

### Tenant boundary

- G1. The database query for a Query call is limited to the flow's organization and workspace, so no row is fetched from outside them. (D5)
- G2. The fetched answers record which organization and workspace they came from. Query checks them against the flow's own before returning any value, and fails the run on a mismatch. The flow's organization and workspace are fixed at publish from the flow itself, never taken from an expression argument or anything the author typed. (D5)
- G3. The table and column names sent to the database are the ones confirmed against the database's own list of tables and columns, never the author's raw text. (D6)

### What publish accepts

- G4. Publish rejects a Query whose table, search column or result column is not written as a literal name, or whose search value is neither a literal nor a field reference it can trace, and names the field. A Query that reaches mapping without its fetched answers fails loudly instead of returning empty. (D3, D4)

### Fetching and cost

- G6. Query never contacts the database while a record is being mapped. All fetching happens before the batch's records are mapped, under its own time limit. (D2)
- G7. What is held for a Query call is one entry per distinct search value in the batch, never anything that grows with the table. (D2)
- G8. The database compares values using the search column's declared type and its index. No rows are fetched to be compared in memory. (D2, D11)
- G12. The number of distinct search values per Query call in one batch has a configured ceiling. Exceeding it fails the batch with a named error, without splitting or truncating. (D8)
- G13. Cached answers are kept per search value, keyed by organization, workspace, table and both column names. They include known no-matches and known duplicates, are bounded in count and memory, and expire after sixty seconds. The budget is recorded on the concept-store page about how the flow engine fetches data before mapping. (D10)

### Results and failures

- G5. Table and column names are checked once per batch, before any record is mapped. An unknown table or column, or an unsupported search column type, fails the run then, terminally, naming it. (D6, D11)
- G9. A search value matching more than one row fails the run, naming the table, search column and value. A value matching exactly one row is unaffected by duplicates elsewhere in the column. (D9)
- G10. A search value the fetched answers do not cover fails the run, naming the table and value, and never returns empty. (D7)
- G11. No match, a null or missing search value, and an empty result cell all return the same empty value. None stops the run, and they cannot be told apart. (D12)

### Existing behaviour to preserve

- G14. Database and network failures while fetching stay retryable, and are told apart from terminal not-found failures. Every failure Query itself raises is terminal.
- G15. The Value List function, the Value List resource, and the mapper's value-lookup field (where an author picks a Value List without writing an expression) keep working unchanged alongside Query. (D1, D13)

### No supporting decision

- G16. Publish stores each Query's table and columns as data the table-deletion guard (#156, which will refuse to delete a table a published flow uses) can look up without re-reading expressions. See the Approval brief.

## Risks and dependencies

- R1 BLOCKER — Which database holds table rows. Earlier discovery work on how tables are stored left the choice open (any database that handles geographic data). Earlier discovery work on keeping workspaces' data apart puts table rows in the same database as Value List data, which the flow engine already reads. If it is the same database, Query adds one new query on an existing connection. If it is a separate one, the engine gains a second data source, with its own credentials, connections and deployment settings. Decision needed before implementation starts.
- R2 ADDRESS — Case-insensitive text matching must use an index, and the table resource epic decides how. Without one, each Query call's fetch reads the whole table, 100,000 rows or more. Plan: confirm how case-insensitive matching is indexed, or accept the full read with a measured cost and a stated row count beyond which it is unacceptable. Depends on the table resource epic; no issue named.
- R3 ADDRESS — Correctness depends on the fetch finding every search value a batch will use. The epic says only "a field reference or a literal". Nested fields, values inside a repeated record, and values reached through the record-and-response wrapper are not yet listed. A missed value fails loudly (G10), but a valid way of writing the search value then fails the run. Plan: list the traceable forms, enforce them at publish, and confirm the fetch and the lookup read field paths the same way.
- R4 ADDRESS — The flow engine does not know a flow's organization or workspace today: the request to evaluate a record carries neither. Its fetching also ignores the records being mapped, and caches whole results per Query call. Query needs the records to find its values, and a per-value cache keyed by organization and workspace. All three changes land in a part of the engine that Value List flows share, so a regression there affects them too. Plan: agree the request change, the fetching change, the cache change and the ceiling as one change, with Value List behaviour pinned by tests first.

## Concept-store changes

This design departs from two concept-store statements. The epic's criteria govern.

- The store rejected a dedicated lookup function when the Value List was built. That reasoning was about the Value List and does not carry over.
- The store expects a value-first argument order. This epic fixes table-first.

## Design rationale and mechanism

### Mechanism

**Terms**

- **Store:** the database that holds table rows. Which database that is remains open (R1).
- **Catalogue:** the store's own list of tables and columns, with each column's declared type.
- **Task:** the flow engine's name for one batch of about 100 records within a run.
- **Call site:** one Query call written in a flow's mapping expressions.
- **Alias:** a call site's table, search column and result column, exactly as the author wrote them. Also called the triple.
- **Transpiler:** the publish step that turns a flow's mapping expressions into what the engine runs.
- **Reference:** a small record the transpiler creates at publish, one per distinct alias, which the engine reads at run time. It holds the flow's organization and workspace, the table, the two column names, and which field of each record carries the search value. A reference already has a metadata field, documented as controlling only how content is fetched, never what content is returned. The search-value source changes what is returned, so D4 must restate that rule or add a field.
- **Provider:** a flow-engine component that fetches the data a function needs before a task's records are evaluated. The Value List function has one. Query gets its own; the Value List's is unchanged.
- **Resolve phase:** the step in which providers fetch data, before any record in a task is evaluated. It runs outside the expression compute timeout (the time limit on evaluating one record's expressions), and it already sorts failures into retryable and terminal.
- **Key set:** the distinct search values one call site needs for one task.
- **Answer set:** what the provider keeps for one alias in one task: which values it covers, what each matched, which matched more than once, and which organization and workspace it was fetched for.

**Resolve phase, per alias**

1. Check the table and both columns against the catalogue, and read the column types.
2. Collect the key set from the fields the reference names.
3. Send the store one query for the key set, with organization, workspace and search-column predicates. Ask for up to two rows per value, so a duplicate shows up.
4. Build the answer set.

**Evaluation, per record**

The function works out its alias from its three literal arguments. It checks the answer set's organization and workspace against the flow's. It looks up the record's search value, and returns the matched value, returns empty, or fails with an error naming what went wrong.

An earlier version of this design loaded the whole table into memory (D2). Of the constraints that version carried, indexing (R2) is the only one that still applies.

### Decisions and reasons

#### D1 — A new function and a new provider

- **Decision:** Query gets its own four-argument shape and reference type. The value-list function and provider are left untouched.
- **Why:** The framework was built for this pairing. Keeping them separate lets a later epic remove one function cleanly.
- **Refuted viable alternative:** Overload the existing lookup function by argument count. It reuses the mapper's lookup affordances, but the two calls disagree on argument order and on the first argument's meaning, and it makes the retiring resource's function the vehicle for its replacement.
- **Trade-off:** two lookup functions coexist.
- **Guarantees:** G15

#### D2 — Match in the store, keyed by the task's own values

- **Decision:** One query per call site per task, keyed by the task's distinct search values, issued in the resolve phase.
- **Why:** Only the task's size should govern cost. It gives one indexed query, no per-record round trips, and nothing held that scales with the table. Store calls stay outside the expression compute timeout, in the phase that already classifies failures.
- **Refuted viable alternative:** Materialise the call site's two-column projection for the whole table. It was the original design, but what it holds scales with the table once tables reach 100,000+ rows.
- **Refuted viable alternative:** Query per value from inside the function. It holds nothing, but runs inside the compute timeout, loses the terminal-versus-retryable distinction, and costs one sequential round trip per record.
- **Guarantees:** G6, G7, G8

#### D3 — The reference carries the search value's source

- **Decision:** The transpiler records where each call site reads its search value. Publish rejects a Query whose identifying arguments are not literals, or whose search value is neither a literal nor an extractable field reference, naming the field.
- **Why:** The epic already restricts the search value to a field reference or a literal, so its source is known ahead of time. A call that cannot be resolved ahead of time cannot be served by this design.
- **Trade-off:** the restriction is now architectural, not a phase-one simplification.
- **Epic commitment affected:** #223 notes. Old: "An expression in that position is not accepted in this phase." New: "An expression in that position is not accepted; accepting one needs a different design." Status: unresolved (the record states the consequence but does not amend the note; new wording drafted for this trial).
- **Guarantees:** G4

#### D4 — The alias is the author's literal triple

- **Decision:** The answer set is named by the table, search column and result column as written. One reference per distinct triple. Call sites sharing a triple but reading the value from different places share one reference carrying both sources.
- **Why:** The function must name its answer set from its own three literals. The alias is the binding key, so two references under one alias would collide.
- **Trade-off:** the reference's metadata field is documented as controlling fetching only, never content shaping. A search-value source shapes content, so the contract is restated or the reference gets its own field.
- **Guarantees:** G4

#### D5 — The provider enforces the boundary; the function verifies it

- **Decision:** The query carries organization and workspace predicates. The answer set records both, and the function compares them against the flow's before returning any value, failing the run on a mismatch. Both are minted at publish from the flow's identity, never from an expression argument.
- **Why:** No row is fetched outside the flow's boundary. The re-check catches a provider defect, a mis-keyed cache entry or a mis-bound context that would otherwise return another tenant's value silently.
- **Guarantees:** G1, G2

#### D6 — Validate names once per task, at run time

- **Decision:** A catalogue read validates the table, both columns and the search column's type before any record is evaluated. An unknown name or unsupported type fails the run then, terminally, naming it.
- **Why:** It meets #223's "when the mapping runs" wording and fails before record work. It is also the security control: table and column names cannot be bound as parameters, so the provider emits catalogue-verified identifiers, not author strings. The same read supplies column types.
- **Refuted viable alternative:** Resolve names at publish so a typo fails the publish. Better feedback, but publish conversion is contractually a pure function of the draft, and column names are already immutable.
- **Trade-off:** typos surface at run time.
- **Guarantees:** G3, G5

#### D7 — An uncovered search value fails the run

- **Decision:** An absent or null search value is a legitimate no-match. Any other value the answer set does not cover fails the run, naming the table and value.
- **Why:** Correctness rests on the resolve phase seeing every value that reaches a Query. If extraction and evaluation disagree, empty would be a silent wrong answer.
- **Trade-off:** an authoring shape the extractor misses fails the run (R3).
- **Guarantees:** G10

#### D8 — A ceiling on distinct search values, as a guard

- **Decision:** A configured ceiling well above the operating point. Exceeding it fails the task with a named error; no chunking, no truncation.
- **Why:** About 100 records is today's operating point, not an enforced limit. A store also caps bound values per statement. Neither should be discovered silently.
- **Trade-off:** a large task fails.
- **Guarantees:** G12

#### D9 — The store reports multi-match, per value

- **Decision:** Ask for up to two rows per value. Two rows mark it ambiguous, and the function fails the run naming the table, search column and value.
- **Why:** #223's criterion is per searched value, and only the task's values are read, so duplicates elsewhere cannot affect a unique value. A duplicate key is the author's data error even when the rows agree.
- **Refuted viable alternative:** Aggregate the whole search column once per task. It reads the table, not the key set, and fails Queries whose own value is unique, which the criterion forbids.
- **Trade-off:** agreeing duplicates still fail.
- **Guarantees:** G9

#### D10 — Cache per value, as an optimisation only

- **Decision:** Entries per search value, keyed by organization, workspace and triple, holding matches, known absences and known ambiguities, bounded in count and weight, expiring after sixty seconds. The cache shrinks each task's key set to its misses.
- **Why:** Whole answer sets cannot be cached: key sets differ per task. One indexed query for 100 keys is already cheap, so the cache saves little and could be dropped without changing the design.
- **Trade-off:** sixty seconds of staleness, mixed within one task.
- **Guarantees:** G13

#### D11 — The store evaluates equality; search column types are narrowed

- **Decision:** Equality is evaluated by the store against the search column's declared type. Case-insensitive text equality belongs in the store and should be index-backed. Date, timestamp and geometry search columns fail validation with a named failure. Result columns accept any type except geometry.
- **Why:** Typed comparison removes textual-coercion traps. Temporal matching needs a rule this epic has no basis to invent, and geometry is #175.
- **Trade-off:** three search column types unsupported.
- **Epic commitment affected:** #223. Old: no criterion. New: "**Given** a Query whose search column is a date, timestamp or geometry column, **when** the mapping runs, **then** the run fails and names the column." Status: pending. (Wording drafted for this trial; the original record gave none.)
- **Guarantees:** G5, G8

#### D12 — No match yields the empty value; no fallback

- **Decision:** No fallback argument. A missing row, a null or absent search value, and an empty result cell all yield the same empty value, and the run continues.
- **Why:** #223 fixes this and keeps the call at four arguments. A table-owned fallback, as the concept store records, would change the table resource and its editor.
- **Refuted viable alternative:** Carry the Value List's no-match expression across, as a table property or a fifth argument. It is the only way metric 1 holds for every list, but it reopens the table model or breaks the four-argument criterion.
- **Trade-off:** metric 1 fails for a Value List using its fallback; re-expressing one means editing the mapping expression.
- **Epic commitment affected:** #222 metric 1. Old: "A translation a Value List holds today is expressed as a table plus a Query call, with no other change to the flow." New: none offered. Status: unresolved (the record states the metric does not hold and declines to amend it).
- **Guarantees:** G11

#### D13 — Deliver the hand-typed call only

- **Decision:** The Value List resource, editor, lookup function and the mapper's structured value-lookup field kind all remain. Retirement is a later epic.
- **Why:** Nothing here removes them, and migrating content is already out of scope.
- **Epic commitment affected:** #222 description. Old: "This retires a whole resource type rather than adding one beside it." New: none offered. Status: unresolved (the record reads it as intent, not this epic's scope).
- **Guarantees:** G15
