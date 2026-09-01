---
title: "Manual Teardown"
aliases: ["manual teardown", "manual cleanup notice", "operator-owned cleanup"]
touches: []
last_updated_by: "#400"
status: active
verification: verified
---

# Manual Teardown

The PR-acceptance harness refuses at preflight to create a scratch repository it cannot later delete: a credential lacking the delete grant stops the run before anything exists, rather than risk an orphaned repo. Manual teardown is an explicit, opt-in escape from that refusal — the maintainer takes the delete on themselves instead of granting the harness an account-wide, irreversible grant for a runbook exercise.

## How It Works

Preflight accepts an explicit manual-cleanup option; when set, a credential without delete capability no longer fails preflight. The reported capability itself never changes — the opt-in changes what the harness *does*, never what it *reports*. Cleanup disposition follows two inputs together: manual whenever the operator opted in, or whenever the credential cannot delete regardless of opt-in. The option is threaded through every stage — preflight, creation, cleanup — and must be repeated at each; never inferred or remembered between them.

Cleanup distinguishes four dispositions rather than collapsing them into "kept": deleted, kept alive by the pre-existing suppression flag, taken over manually, and already gone. The acceptance record states which happened. Creation and cleanup both print an unmissable bordered notice, routed apart from the machine-readable success output the runbook parses, naming the surviving repository, its location, and the exact command that removes it. The notice appears at creation, not only cleanup, so a run abandoned partway still leaves a pointer to what it made. The delete guard's own safety check is untouched; manual mode only suppresses the delete call, never the check that would gate it.

## Key Invariants

1. Manual mode is opt-in only — never inferred from an absent delete grant. A missing grant with no opt-in still refuses before creating anything.
2. The capability report always reflects what the credential actually carries; the opt-in changes behavior, never that report.
3. The opt-in is per-invocation and per-stage — it is not persisted or remembered across a run's stages.
4. The four cleanup dispositions (deleted, kept-alive, manual, already-gone) stay distinct; nothing collapses them.
5. The manual-cleanup notice is a deliberate exception to this harness's one-line diagnostic convention, because a successful run that still leaves a real repository standing is exactly what a scrolling terminal loses.
6. The harness's single deterministic scratch-repo name caps a forgotten manual cleanup at one repository — a later run adopts the same name rather than creating another.

## Integration Points

None yet — no other concept page currently describes the PR-acceptance harness this extends.

## Decision Log

### 2026-09-01 — #400 — Manual teardown as the resolution to a permanently-closed acceptance window

Epic #354's decision record named one live end-to-end exercise of the ported issue filers as the last point at which the superseded implementation still existed to compare against. The exercise never ran: the harness refused at preflight because the credential carried no delete grant, and granting an account-wide, irreversible scope unattended was judged an outward-facing act outside an implementation run's authority. The epic closed with that criterion unmet, and the comparison window closed permanently when the superseded implementation was deleted in the same release. Manual teardown resolves the underlying gap — a maintainer's reasonable refusal to hold a broad delete grant need not block every future live run — without reopening epic #354's closed window. Refuted alternative: delete the harness package entirely, since the one exercise it gated never ran; rejected because it remains the only check on range derivation's merge-strategy guesses against real GitHub, independent of any one epic's cut-over.
