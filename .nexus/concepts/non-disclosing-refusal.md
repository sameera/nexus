---
title: "Non-Disclosing Refusal"
aliases: ["refusal discloses nothing", "missing and inaccessible alike", "leaked link probing", "one refusal for both", "store not set up for rendering"]
touches: ["borrowed-reader-access"]
last_updated_by: "#614"
status: active
verification: verified
---

# Non-Disclosing Refusal

A mockup the renderer will not serve gets one answer, whether the file is missing or the reader simply cannot reach it. A mockup address names an owner, a repository, a commit and a path, so an answer that told those two cases apart would turn a leaked link into a way to probe what a private store contains. A store the renderer was never installed on is the one refusal told apart, because that is a fact about the store and not about the reader.

## How It Works

The store's host already conflates "no such file" and "not yours" for a private repository, so the non-disclosure is something to preserve rather than to build. Every turned-away fetch that does not begin a sign-in gets that same answer, including one made without a credential against a public store. Two refusals that differ only in wording are how they drift apart, so there is only one.

A reader with no session is sent to sign in rather than refused, and that is safe for the same reason: the answer is identical whether the file exists or not.

The store nobody finished setting up is the single exception. It concedes that the named store exists, which is a much smaller thing than a file's existence, and it is conceded because the reader has done nothing wrong while the team has. A team whose store never renders would otherwise have nothing at all to show for it.

## Key Invariants

1. A refusal any reader can reach discloses nothing about whether the named file exists.
2. Missing and inaccessible produce the same answer on every path, credentialed or not.
3. A reader with no session is sent to sign in rather than refused, at a private store and a missing file alike.
4. The store the renderer was never installed on is the only refusal told apart, and it says nothing about any reader.
5. Nothing taken from the request is echoed into a refusal page.

## Integration Points

- [borrowed-reader-access](borrowed-reader-access.md) — the fetch whose turning-away this answers, and the reason the answer cannot depend on what the reader was allowed to see.

## Decision Log

### 2026-09-18 — #614 — One refusal covers missing and inaccessible, and it covers the uncredentialed path too

A mockup address names the file it points at, so telling "no such file" apart from "not yours" would make a leaked link a way to probe a private store. The separate "no such file" answer was therefore removed outright rather than only for signed-in readers, which goes further than the approved design said: the requirement has to hold on every path that reaches a refusal, and keeping a second refusal that differs only in wording is how the two drift apart. The misconfigured store is told apart on the opposite reasoning — it is a fact about the store, the reader has done nothing wrong, and folding it in would hide the team's own mistake from them. Refuted alternative: keep the separate "no such file" answer for readers who carry no credential. It loses because that is exactly the reader a leaked link reaches.
