---
title: "HLD Page as Build Input"
aliases: ["build from the HLD page", "HLD comment", "HLD page input", "stale HLD page", "record-only option", "high-level design page"]
touches: ["unattended-epic-implementation", "decision-record", "record-digest", "issue-asset-store"]
last_updated_by: "#971"
status: active
verification: verified
---

# HLD Page as Build Input

When an approved epic's decision record carries a current high-level design page, the unattended implement command tells its implementation agent to build from that page. The decision record stays binding wherever the two disagree. With no page, a stale page or a page whose verdict is not clean, the agent gets the same instructions it got before this behaviour existed.

## How It Works

Before the run's branch exists, the command reads every comment on the decision record. It keeps the comments whose first line is the HLD marker and whose author can speak for the issues repository. It then takes the newest one by the platform's creation time. The command judges that comment alone before it fetches anything. The page is ignored when the comment's record digest differs from the record's current digest, or when its verdict is not the clean verdict. The run then prints one line with the reason and builds from the record. A page that passes is read once, as raw text at the commit its link pins, under the lead's own GitHub login. That works for a private store. The command saves the text in the epic's gitignored scratch folder and adds one paragraph to the agent's instructions. The paragraph says to follow the page, that the record binds where they disagree, that the page's open choices bind nothing, and that one commit per story still holds. A record-only option skips the lookup and prints one line saying so.

## Key Invariants

1. Only the newest HLD comment from an author who can speak for the issues repository counts. An untrusted comment never hides an older trusted one.
2. A failure to read the record's comments or its current digest stops the run. It is never treated as no HLD comment.
3. A stale or flagged page is never fetched, so an unreachable store never stops such a run.
4. Any verdict other than the clean verdict ignores the page. Only wrapping emphasis and one trailing full stop are forgiven.
5. A current page that cannot be read stops the run and names the record-only option as the way to build without it.
6. Every stop this behaviour adds comes before the run's branch exists, so a re-run is never refused for an existing branch.

## Integration Points

- [unattended-epic-implementation](unattended-epic-implementation.md) — the command whose preflight runs this lookup and whose implementation agent receives the page.
- [decision-record](decision-record.md) — carries the HLD comment, and stays binding wherever the page disagrees with it.
- [record-digest](record-digest.md) — supplies the current digest the comment's stamped digest must match.
- [issue-asset-store](issue-asset-store.md) — the store the page is read from, at the commit its pinned link names.

## Decision Log

### 2026-11-05 — #971 — The implement command builds from a current HLD page

Before this epic the command read only the epic and the record, so an unattended run built without the design detail the lead had reviewed on the high-level design page. The page now feeds an agent that runs with broad permissions, so only a comment from someone who can speak for the repository counts, and untrusted comments are removed before the newest is picked. Refuted alternative: trust any comment and require its link to point at the team's configured store. It lost because a team may move its store, and a stranger could still link a real but superseded page. The stale and verdict checks read the comment alone and run before any fetch, so an unreachable store never stops a run that would ignore the page anyway. The command reads the page once and hands the agent a local copy, so the agent cannot read it differently or fail after the branch exists. The clean-verdict match forgives wrapping emphasis and one trailing full stop, because the design page's preview prints the verdict in italics.
