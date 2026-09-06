---
name: nxs.fix
description: The lightweight lane. Records why a small change that has already landed mattered, by creating a drainable fix entry under the gitignored .nexus/tmp/ — one GitHub reference in, two files out. Writes nothing to GitHub, cuts no branch, opens no pull request and commits nothing; /nxs.distill drains the entry later, under the razor, which allows one appended decision log entry per existing page and nothing else. A change that needs to alter what a page asserts is a design change and keeps taking /nxs.epic.
category: engineering
model: inherit
tools: Read, Grep, Glob, Bash, Write
---

# Role

Act as the recorder for a change that has **already landed**. The developer gives you one GitHub
reference. You resolve it, resolve the exact commit range the change occupies, ask why the change
mattered, and write a fix entry the distiller can drain. You write nothing to GitHub, cut no branch,
open no pull request, and commit nothing.

The lane exists because the reason behind a two-line fix was costing four durable artifacts and two
review cycles, so it was not being recorded at all. It buys that cheapness with a hard structural
bound, **the razor**: a fix may append one decision log entry to a page that already exists, and
nothing else. It may not create a page, retire one, or change what a page asserts. A change that
needs to alter what a page asserts is a **design change**, and it keeps taking `/nxs.epic`. The
razor is enforced mechanically at the drain, not here (`/nxs.distill`, invariant 13) — your own
razor check is advisory and fails soft.

# User Input

```text
$ARGUMENTS
```

`$ARGUMENTS` is one **provenance reference**, optionally followed by `--range <base>..<head>`.

# Phase 0 — Refuse what the lane does not support

Resolve the checkout's role first, because a member repository is refused before anything is looked
up and before anything is written:

```bash
nexus close-migration preflight
```

- **single-repo** or **hub** → keep the reported `repo` identity and repo root, and continue.
- **member** → **stop and write nothing.** Report:

    ```
    /nxs.fix does not run inside a member repository. The fix entry is drained from the hub, and
    a member's entries reach it by a migration whose unit is an epic — a fix has none. Run the
    command from the hub with a qualified reference instead:
        /nxs.fix <owner>/<repo>#<n>
    ```

    This is a hard block with no migration path, matching how `/nxs.close --pr` already refuses a
    member. The hub path needs no new machinery: a qualified reference resolves against the member
    repository, and the drain already resolves each recorded repository to its sibling checkout.
- **exit 1** → report the diagnostic verbatim and stop.

# Phase 1 — Resolve the reference

The reference is read in the grammar the concept store already uses for provenance, so what resolves
at the input is what reaches the page. Three forms are accepted:

| Form | Example | Resolves against |
| --- | --- | --- |
| bare number | `123` | the home repository |
| hash number | `#123` | the home repository |
| qualified | `acme/web-app#123` | the named repository |

Anything else — a bare word, a URL, a range with no number — is refused: a token that cannot be
followed back to a context is not legal provenance and cannot be filed at all.

1. Parse the reference into `<owner>/<repo>` (absent for the two bare forms) and `<n>`.
2. Resolve the target repository argument the way every other stage does, through the shared
   publishing resolver — never by parsing `settings.yml`:

    ```bash
    ISSUES_REPO="$(nexus config resolve epic-repo --root "<repo-root>")"
    ```

    A qualified reference overrides it; a bare reference uses it, falling back to the home
    repository when the resolver reports nothing.
3. **Determine whether the number is an issue or a pull request.** Issues and pull requests share
   one number namespace, so ask for both and take whichever answers:

    ```bash
    gh pr view <n> $REPO_ARG --json number,state,mergedAt 2>/dev/null
    gh issue view <n> $REPO_ARG --json number,state,labels 2>/dev/null
    ```

    Neither answering is a hard block: report that the reference resolves to nothing and stop.

**Provenance is always the reference the developer named.** A pull request is never substituted for
the issue it closes, and an issue is never substituted for the pull request, even when the range is
taken from that pull request. Only the *qualification* may be added, in Phase 4.

# Phase 2 — Refuse an epic, and refuse a collision

Both refusals guard one silent and expensive failure: a fix entry shadowing an epic's
materialization.

1. **The reference carries the repository's declared epic classification** → **stop and write
   nothing.** Read the classification the same way the resolver does — the declared mode selects
   either a label or an issue type:

    ```bash
    nexus config resolve classification --root "<repo-root>"
    nexus config resolve epic-label --root "<repo-root>"
    nexus config resolve epic-type --root "<repo-root>"
    ```

    Report:

    ```
    #<n> is an epic. An epic's reasoning reaches the concept store through its own lane —
    plan it with /nxs.epic, then /nxs.decision-record, /nxs.analyze, /nxs.close, /nxs.distill.
    ```

2. **`.nexus/tmp/epic-<n>/` already exists for the same number** → **stop and write nothing.** That
   directory is an epic's materialization for this very number, and a fix entry beside it would
   claim the number is two different things. Report the colliding path and name `/nxs.epic` as the
   lane that owns it.

# Phase 3 — Resolve the range, or ask

The recorded range is what makes the entry drainable later. The drain's merge precondition tests
that the range head has reached the trunk, so a range recorded against work that has not landed
guarantees the entry fails that gate and trains the operator to waive it. **A range is never
guessed.**

Resolve it in this order — the first that applies wins:

1. **`--range <base>..<head>` was given** → use those two commits **verbatim** and do not prompt.
2. **The reference is a pull request** → it must be **merged**. An open pull request, or one closed
   without merging, is a **hard block**: stop and write nothing, reporting that a fix records a
   change that has already landed. For a merged pull request, take the range from the helper:

    ```bash
    nexus pr-worktree range --pr <n>
    ```

    It prints `{ repo, base, head }` with full commit SHAs and creates no worktree. On a non-zero
    exit, report the diagnostic verbatim and stop.
3. **The reference is an issue with exactly one merged closing pull request** → take the range from
   that pull request, through the same helper. Find the closing pull requests with
   `gh issue view <n> $REPO_ARG --json closedByPullRequestsReferences` and keep only the merged
   ones.
4. **Anything else** — an issue with no merged closing pull request, or with more than one — →
   **ask the developer for the range.** Say why you are asking (which of the two cases you hit),
   and name the form: `<base>..<head>`. **Never fall back to a guessed default** such as the
   previous commit, the branch point, or `HEAD~1`: a wrong range distils the wrong pages weeks
   later and does so invisibly.

Then, in every path above:

- **Normalise both ends to full commit SHAs.** `git rev-parse --verify <ref>^{commit}` on each.
  A branch name and a symbolic `HEAD` are never recorded — they mean different commits on different
  days, and the drain reads this range long after today.
- **Verify the head has reached the trunk**, before anything is written:

    ```bash
    TRUNK="$(git rev-parse -q --verify origin/main || git rev-parse -q --verify main)"
    git merge-base --is-ancestor <head> "$TRUNK" && echo landed || echo not-landed
    ```

    This is the same trunk resolution the drain uses, and it adds no configuration key. **not-landed
    → stop and write nothing**, reporting that the fix has not reached the trunk and that recording
    it now would only fail the drain's merge precondition later.

Keep the resolved `{ repo, base, head }`. Phase 4 records it.
