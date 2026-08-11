---
title: "Discovery Graduation"
aliases: ["discovery graduation", "discovery entry mode", "decision gist", "marked gist comment", "consumed discovery"]
touches: ["pre-epic-discovery", "backlog-stub", "epic-approval-gate", "decision-record"]
last_updated_by: "#228"
status: active
verification: verified
---

# Discovery Graduation

A finished discovery becomes issues only through the epic stage, which reads the discovery document as its intent and files through the emission path it already owns. The decisions the discovery resolved are copied onto what is filed, in full, twice from the same text: once into the body and once into a comment carrying a hidden marker. The comment is the copy that survives promotion rewriting the body, and it is what the design stage later reads.

## How It Works

The epic stage gains an entry mode that takes a finished discovery folder. It skips the sharpness test, because discovery is the thing that test refers people to, and then runs the existing right-size gate unchanged. A result larger than one epic files one backlog stub per functional goal, through the same batch path and under the same contract every other stub uses. A result of size M or smaller is planned directly as one epic, and no stub is filed. Each filed issue carries the decisions its goal hangs on in full gist form: the decision, its reasoning, and the refuted alternative. The same text is written twice in one act, into the body and into the marked comment. Neither copy is ever edited again, so the two cannot drift. Each gist names its originating ticket by title, never by a link into the folder, because the folder is removed once the discovery ends. The stage reports the folder as consumed and removes nothing; removal is a plain commit a human makes.

## Key Invariants

1. Every issue, comment, and label a discovery produces is written by the epic stage; discovery writes none itself.
2. A stub filed from a discovery matches the decomposition-stub contract exactly, because the same emission path files both.
3. The marked comment is the only addition this entry mode makes to that emission path.
4. Both gist copies come from the same text in the same act, and neither is edited afterwards.
5. Anything that must outlive a discovery is copied in full; a reference into the folder is never sufficient.
6. Promotion is unchanged: it rewrites the stub's body, and it neither reads nor moves the marked comment.
7. The design stage reads only marked comments, treats them as an input rather than a substitute for its own analysis, and never edits or removes them.

## Integration Points

- [pre-epic-discovery](pre-epic-discovery.md) — the stage whose finished folder this consumes, and which files nothing itself.
- [backlog-stub](backlog-stub.md) — what a discovery larger than one epic becomes, through the existing contract and the existing filing path.
- [epic-approval-gate](epic-approval-gate.md) — the stage this entry mode lives in, and whose right-size gate it reuses unchanged.
- [decision-record](decision-record.md) — the stage that reads the surviving marked comment as an authoritative input.

## Decision Log

### 2026-08-11 — #228 — Graduation runs through the epic stage, and the gist is written twice

Discovery's output is a decomposition of an initiative into functional goals, which is exactly what the epic stage's decomposition phase already emits and files. Letting discovery file its own stubs would be a third copy of a contract already written in two places, and a third copy is the most likely place to lose the requirement that a discovery-produced stub is promoted with no manual edit. Routing graduation through the epic stage makes that requirement true by construction, because one path files every stub in the system, and it removes discovery's need to resolve labels, classifications, or a project target at all. The gist is written twice because the two copies do different jobs. The body copy is what promotion consumes when it seeds its draft. The comment copy is what survives, because promotion rewrites that body wholesale, so anything left only in the body is destroyed at exactly the moment the reasoning matters most. The marker is what turns the surviving copy into an input rather than an archive, since promotion keeps the issue it was given. Refuted alternative: discovery files its own stubs at an exit step, keeping the whole loop inside one command — rejected for the duplication above, and because it forced several rules that exist only to protect a permanent write from a losable branch. Refuted alternative: write the gist only in the body, which is the literal reading of the story and needs no extension to the existing path — rejected because promotion replaces the body silently. Refuted alternative: write the gist only as a comment, which is durable and avoids the duplication — rejected because promotion reads the body, and a lead scanning the backlog would see a bare goal line with the reasoning one click away.
