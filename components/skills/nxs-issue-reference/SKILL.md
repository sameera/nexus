---
name: nxs-issue-reference
description: The cross-repository issue reference rule shared by /nxs.epic, /nxs.decision-record, /nxs.analyze and /nxs.close. Load it before writing an epic, record, story or stub issue number into any surface — a GitHub comment or review, a local file, or a terminal report — so the same number cannot resolve against the wrong repository once it leaves the checkout that filed it.
---

# nxs-issue-reference

In a multi-repo workspace, issues are filed into a repository the `epic-repo`/`story-repo`
configuration names, which may not be the repository the code and its pull requests live in. A
bare `#141` means one thing inside that issues repository and something else — or nothing —
anywhere else. This skill states the one rule every stage that writes an issue number follows, so
the reference resolves correctly wherever it lands.

Load it before composing any surface that names an epic, a decision record, a story, or a stub
issue: a PR review or comment, a GitHub issue body, a materialized `epic.md`, an
`analyze-receipt.md` or `close-record.md`, or a line printed to the lead's terminal.

## Section A — Resolving the repositories

Two repositories can be in play, and they are resolved independently, through the shared
publishing resolver — never by parsing `settings.yml`:

```bash
ISSUES_REPO="$(nexus config resolve epic-repo --root "<root>")"
STORY_REPO="$(nexus config resolve story-repo --root "<root>")"
```

An empty value means "the current repository", exactly as it does everywhere else in the
toolkit — never pinned, never written as a placeholder. `epic-repo` and `story-repo` resolve
independently: an epic and its stories can be filed into different repositories, and a reference
to a story is qualified against `$STORY_REPO`, not `$ISSUES_REPO`, when the two differ.

A stage that already ran `nexus epic-resolve` has this without a second resolution: its JSON
output carries `issuesRepo`, read the same way `record` already is
(`jq -r .issuesRepo`) — the resolver's own read of the epic's repository, never re-derived.

## Section B — The rule: qualify only across a repository boundary

A reference is written in one of two forms (`.nexus/concepts/provenance-reference.md`):

| Form | Example | Resolves against |
| --- | --- | --- |
| bare | `#141` | the surface's own repository |
| qualified | `geo-nexus/docs#141` | the named repository |

Which form to use depends on where the reference is being written — three contexts, one rule
in each: **qualify a reference only when its repository is known and differs from the
repository the surface is published into.**

| Context | Examples | Published into | Rule |
| --- | --- | --- | --- |
| GitHub surface | a PR review or comment, an issue body | the repository hosting that issue or PR | qualify when it differs from that repository |
| Local file | `epic.md`, `analyze-receipt.md`, `close-record.md` | the repository its own `issues_repo:` frontmatter declares | qualify only a reference naming a *different* repository than that declaration; every reference to the file's own declared repository stays bare |
| Terminal report | a checkpoint, a block report, a completion summary | nothing — there is no ambient repository a reader resolves a bare number against | qualify whenever the reference's repository is known |

Two corollaries follow directly and are easy to get backwards:

- **A close comment posted on the epic issue itself stays bare for the epic, the record, and
  any stub it files** — that comment's surface *is* `$ISSUES_REPO`, so nothing there crosses a
  boundary. Only a number naming a different repository — a pull request in the code repo — is
  qualified there. Do not qualify every number on a surface merely because the checkout is part
  of a workspace; qualify only the ones that actually cross into a different repository than the
  surface itself.
- **A local file's own `link`/`epic`/`record` fields and its story headings all stay bare**, even
  though the file declares `issues_repo:`. The declaration is what gives them a recoverable home;
  restating it on every line inside the file would carry no new information and would break the
  parse contract other stages hold on those exact bare forms (`### Story #<n>:`, the
  `| #<n> | blocked_by |` table, `link: "#<n>"`). Qualification happens once, at the point a
  reference *leaves* the file onto a different surface — never inside the file.

Before writing any reference, name its own repository (`$ISSUES_REPO` or `$STORY_REPO`, per
Section A) and the surface's repository (per the table), then apply the rule. Never guess from
whether the checkout happens to be a workspace.

## Section C — Form

- The qualified form is `owner/repo#N` — GitHub's own cross-repo syntax. Never a full URL: a
  URL is search-hostile noise a plain `owner/repo#N` avoids (concept invariant 4).
- Qualifying a reference never substitutes it. The number named is the number written, whichever
  form it takes; only a repository prefix is added or omitted.
- An issue and a pull request share one number namespace and are never interchanged: a pull
  request is never replaced by the issue it closes, and an issue is never replaced by the pull
  request that closed it.

## Worked example

`/nxs.analyze --pr geo-nexus/giccp#665` runs conformance against a story filed in
`geo-nexus/docs`, and publishes its review as a comment on the pull request in
`geo-nexus/giccp`. The review's surface is `geo-nexus/giccp`; the epic, the record and the
story all live in `geo-nexus/docs`. Every one of those numbers is qualified:

```
Conformance: Table resource management (epic geo-nexus/docs#114)  ·  epic geo-nexus/docs#114
Mode: full (record geo-nexus/docs#141 @ eb2fc23…)
  STORY geo-nexus/docs#117 Create a table with an initial schema: 4/6 met
```

The same run's machine block carries `issues_repo: geo-nexus/docs` beside the existing
`repo: github.com/geo-nexus/giccp`, so a later reader never has to assume which repository
`epic`/`record`/`stories` resolve against.

By contrast, `/nxs.close`'s comment on epic issue `geo-nexus/docs#114` itself writes
`Decision record: #141` and `Deferred scope → #230` bare — that comment's own surface is
`geo-nexus/docs`, so nothing in it crosses a repository boundary.

## Contract

- **Every rule in this file is stated once.** A stage that finds itself restating the three
  contexts, the two corollaries, or the qualification rule instead of loading this skill has
  drifted from the contract this skill exists to hold.
- **This skill is guidance, not a gate.** It shapes a reference as it is composed; it writes
  nothing itself and refuses nothing. The calling stage's own preconditions and refusals are
  unchanged by loading it.
