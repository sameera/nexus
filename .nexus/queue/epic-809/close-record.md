---
title: "Close Record: [codex] Decision Records That Are Quick to Review and Hide No Gaps"
epic: "#809"
feature: "Artifact Prose Style"
date: 2026-10-01
nexus_version: 0.79.0
analyze: ran 2026-09-30 @ c6d862f84ffff6249de733ca55abd28d9c78e4f6
record: "#819"
record_hash: e16a4879b75c1cf0b6d9391f8281c17d0129c318e9cdfa88c25ec441043c49ce
range:
  - repo: github.com/sameera/nexus
    base: 664fefd03d3faf192ba89d765e229414af6d7d38
    head: 978715d494bd3043e98ceb66956f2e6a4ab13ce3
---

# Close Record: [codex] Decision Records That Are Quick to Review and Hide No Gaps

## Key Decisions

- **Pin the Codex contract with one spec over the generated skills, not new component text (visible in the diff, not in the record; #819 D1–D3):** the three stories shipped as test commits only. `libs/portable-tools/src/codex-decision-record.spec.ts` renders the generated Codex skills and asserts the draft order, the approval checkpoint steps, and the analyze, close and distill record-reading path for both record formats. The diff changes no component text. Why: the shared record contract from #787 already generates into Codex, so the remaining risk was drift between harnesses, and a spec over the generated output catches that. No refuted alternative is recorded.
- **#819 D1, D2, D3 stood as approved:** no decision was changed during implementation. Their refuted alternatives (Codex-specific layout; summarizing only items judged important; rewriting old approved bodies) were not reopened.

## Deviation Rationale

None. The shipped diff matches #819's How it works, Mechanism and guarantees G1–G11. Analyze reported 0 critical, 0 high, 0 medium and 0 low findings.

## Deferred Scope

none

## Waived Stories

none

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-10-01-codex-record-contract-pinned-by-spec.md`
