---
title: "The Fix Razor"
aliases: ["fix razor", "append-only page rule", "append-only-log check", "fix entry bound", "one log entry per page"]
touches: ["fix-lane", "append-only-decision-log", "distiller", "grep-native-retrieval", "intake-lane"]
last_updated_by: "#483"
status: active
verification: verified
---

# The Fix Razor

The fix razor is the bound that lets the fix lane be cheap without letting the store lie: a fix may append one decision log entry to a page that already exists, and nothing else. It may not create a page, retire a page, or change what a page asserts. A change that needs to alter what a page asserts is design work: the epic path if unbuilt, the intake lane if it already shipped.

## How It Works

A page states intent, not implementation, so a fix that restores intended behaviour leaves nothing in the body false and one appended entry is the whole correct outcome. A fix that changes intended behaviour is different: appending to a page whose body still asserts the superseded behaviour produces a page that contradicts itself. Retrieval from the store is grep-native, so a reader loads the summary and the key invariants and may never reach the log; the cheap path would therefore leave a confidently false invariant standing on a page marked verified. A store with gaps is more useful than a store that lies. The check truncates the changed page at its one gained log heading, drops the attribution line, normalises trailing whitespace, and compares the remainder against the base. The razor is enforced where the page writes are visible: at the drain, before the reviewed write opens. The authoring command's own warning is advisory.

## Key Invariants

1. A fix may only append; it may never create a page, retire a page, or change what a page asserts.
2. The bound is byte identity outside the gained entry, exempting only the attribution line and trailing whitespace; no field is enumerated, so none can be forgotten when the page schema grows.
3. A changed page must resolve at the base and its status must be a modification, so creation, deletion and rename all fail one test.
4. Exactly one log entry may be gained per changed page; both zero and more than one fail.
5. The bound covers pages only; derived sidecars a drain regenerates are never passed to it.
6. The bound is load-bearing at the drain, which can see the page writes it constrains, and advisory in the authoring lane, which writes no pages.
7. A rationale mapping to no existing page is a named hard block, never a licence to create one.

## Integration Points

- [fix-lane](fix-lane.md) — the lane this bound makes safe to keep cheap.
- [append-only-decision-log](append-only-decision-log.md) — the log property this turns into a mechanical check on a page's own diff.
- [distiller](distiller.md) — enforces the bound before opening its reviewed write, and refuses a fix it cannot enforce it for.
- [grep-native-retrieval](grep-native-retrieval.md) — the reading model that makes a false invariant worse than a missing one.
- [intake-lane](intake-lane.md) — where a landed change that would alter what a page asserts goes instead, since this razor only ever routes such a change to epic work or to that lane.

## Decision Log

### 2026-09-05 — #263 — Byte identity, not a list of forbidden fields

Stated the bound as byte identity outside the appended entry rather than as an enumeration of what a fix may not touch. The comparison is then total: every forbidden edit lands inside the compared region and fails the same test, whether it touches an invariant, a summary sentence, a neighbour, an alias, a status or an earlier log entry. The considered alternative — enumerate the forbidden fields and check each — gives better diagnostics and is easier to read, but it must be maintained in step with the page schema, and its failure mode when it falls behind is a silent pass on exactly the edit the bound exists to catch. Because the check is a mode on an existing capability rather than a capability of its own, it has no declared surface an older installed toolkit would reject: such a toolkit accepts the invocation, reads the unrecognised mode as one more page to check, and refuses while naming a missing file. The bound still fails closed, but the diagnostic misnames its cause, and the obvious repair — dropping the offending argument — turns a safe refusal into the silent pass the bound exists to prevent. So the drain establishes from the toolkit's own declared help that the mode is enforced before it relies on it, and attributes a miss to an install that needs updating. The accepted cost is stated plainly: a one-line change that invalidates one invariant line pays the full epic price. A loosening that would let a fix strike through a false invariant in place is deliberately not built, because loosening a bound before there is evidence it binds too tightly is how such bounds die; the option stays available and stays checkable if that evidence arrives.

### 2026-09-08 — #483 — The routed remedy splits by whether the change already shipped

A rationale that maps to no existing page, or that would change what one asserts, used to name the epic path as the only remedy. That was only ever true for unbuilt work: a change already shipped has no acceptance criteria left to manufacture, and epic planning for it would still just re-derive the diff nobody is choosing anymore. The intake lane takes that path now, reading the pull request's own account instead of asking the lead to reconstruct it. This razor itself is unchanged — it still forbids exactly the same edits, still refuses a rationale with no page — only the name of where a refused change belongs now depends on whether the code exists yet.
