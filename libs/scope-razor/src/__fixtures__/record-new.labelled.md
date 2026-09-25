# Decision Record: Query Function

## How it works

A Query call looks up one value in a table. Every lookup a batch needs is fetched before the batch's records are mapped (D2).

## Approval brief

Approval covers the whole record. This brief lists what needs a decision and every choice that carries a trade-off.

**Resolve before approval**

- R1 BLOCKER: which database holds table rows.

**Choices with trade-offs**

- D1. A new function and a new provider.
  - Trade-off: two lookup functions exist until the old one retires.
- D2. Match in the store, keyed by the batch's own values.
  - Trade-off: every search value must be traceable at publish.

## Guarantees

### Tenant boundary

- G1. The database query for a Query call is limited to the flow's organization and workspace. (D2) `[inferred]`
- G2. The table and column names sent to the database are the confirmed ones, never the author's raw text. (D1) `[asked: "never the author's raw text"]`

### Fetching and cost

- G3. Query never contacts the database while a record is being mapped. (D2) `[inferred]`

### Existing behaviour to preserve

- G4. Database and network failures while fetching stay retryable. `[inferred]`
- G5. The Value List function keeps working unchanged alongside Query. `[asked: "keeps working unchanged alongside Query"]`

## Risks and dependencies

- R1 BLOCKER — Which database holds table rows. Decision needed before implementation starts. `[inferred]`
- R2 ADDRESS — Case-insensitive matching must use an index. Plan: confirm how it is indexed. `[asked: "case-insensitive matching must use an index"]`
- R3 ADDRESS — The flow engine does not know a flow's workspace today. Plan: agree the request change. `[inferred]`

## Concept-store changes

- Lookup page: "a dedicated lookup function was rejected" becomes "a dedicated lookup function exists".

## Design rationale and mechanism

### Mechanism

**Terms**

- **Provider:** the part of the engine that fetches rows.
- **Prefetch:** the fetch that runs before mapping.

The prefetch reads every search value the batch's records carry.

### Decisions and reasons

#### D1 — A new function and a new provider

- **Decision:** Add a Query function backed by its own provider.
- **Why:** The two calls disagree on argument order.
- **Refuted viable alternative:** Overload the existing lookup function by argument count. It reuses the mapper's lookup affordances, but the two calls disagree on argument order.
- **Trade-off:** two lookup functions exist until the old one retires.
- **Epic commitment affected:** none
- **Delivered by:** #223
- **Guarantees:** G2

#### D2 — Match in the store, keyed by the batch's own values

- **Decision:** The store matches the batch's distinct search values.
- **Why:** What is held must not grow with the table.
- **Refuted viable alternative:** Materialise the two-column projection for the whole table. It was the original design, but it scales with the table.
- **Refuted viable alternative:** Query per value from inside the function. It holds nothing, but costs one round trip per record.
- **Trade-off:** every search value must be traceable at publish.
- **Epic commitment affected:** #223. Old: "a field reference or a literal". New: "a literal, or a field reference publish can trace". Status: pending.
- **Delivered by:** #224
- **Guarantees:** G1, G3

#### D3 — No match yields the empty value

- **Decision:** A value with no match returns the empty value.
- **Why:** The epic asks for no fallback.
- **Refuted viable alternative:** none
- **Trade-off:** None.
- **Epic commitment affected:** none
- **Delivered by:** #224
- **Guarantees:** none
