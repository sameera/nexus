---
name: nxs-landed-reference
description: The reference, range and refusal rules shared by every lane that records work which has already landed (/nxs.fix, /nxs.intake). Load it before resolving a provenance reference or a commit range in either lane, so a rule fixed in one lane cannot silently differ in the other.
---

# nxs-landed-reference

Two lanes record work that has already landed: `/nxs.fix` and `/nxs.intake`. Both start from one
GitHub reference and both need the same four things from it — a repository identity, a resolved
commit range, a qualified reference, and the same refusals along the way. This skill is the one
place those rules are stated. Neither lane restates them; each lane loads this skill and applies it,
substituting its own command name where a message names one.

Load this skill before Phase 1 of either lane, and apply its sections at the point each lane's own
phase numbering calls for them. Nothing here writes a file or opens an issue — every write stays in
the calling lane.

## Section A — The checkout-role gate

Resolve the checkout's role before anything else is looked up and before anything is written:

```bash
nexus close-migration preflight
```

- **single-repo** or **hub** → keep the reported `repo` identity and repo root, and continue.
- **member** → **stop and write nothing.** Report, substituting the calling lane's own command name
  for `<lane-command>`:

    ```
    <lane-command> does not run inside a member repository. The entry is drained from the hub, and
    a member's entries reach it by a migration whose unit is an epic — this lane has none. Run the
    command from the hub with a qualified reference instead:
        <lane-command> <owner>/<repo>#<n>
    ```

    This is a hard block with no migration path: a qualified reference resolves against the member
    repository, and the drain already resolves each recorded repository to its sibling checkout.
- **exit 1** → report the diagnostic verbatim and stop.

## Section B — Reference resolution

The reference is read in the grammar the concept store already uses for provenance. Three forms are
accepted:

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
taken from that pull request. Only the *qualification* may be added, in Section D.

## Section C — Range resolution

The recorded range is what makes the entry drainable later. The drain's merge precondition tests
that the range head has reached the trunk, so a range recorded against work that has not landed
guarantees the entry fails that gate and trains the operator to waive it. **A range is never
guessed.**

Resolve it in this order — the first that applies wins:

1. **`--range <base>..<head>` was given** → use those two commits **verbatim** and do not prompt.
2. **The reference is a pull request** → it must be **merged**. An open pull request, or one closed
   without merging, is a **hard block**: stop and write nothing, reporting that this lane records a
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
    → stop and write nothing**, reporting that the change has not reached the trunk and that
    recording it now would only fail the drain's merge precondition later.

Keep the resolved `{ repo, base, head }` for the calling lane's own entry-writing phase.

## Section D — Qualification

The reference written to the entry is the one the developer named. Only its **qualification** may
be added, and only in one case:

- **single-repo** → write the reference exactly as given, normalised to `#<n>`.
- **hub, qualified reference given** → write it as given: `<owner>/<repo>#<n>`.
- **hub, bare reference given** → write `<owner>/<repo>#<n>`, where `<owner>/<repo>` is resolved
  from the **recorded range's `repo`**, and `<n>` is the number the developer gave, unchanged.

    A drain running from a hub must write only the qualified form: in a hub the issue never lives in
    the drain's own repository, so a bare reference there resolves to the wrong issue. Qualifying is
    not substituting — the artifact referenced is still the one the developer named — so this does
    not weaken the rule in Section B. Deriving the qualification is preferred to refusing the bare
    form, which would only make the developer supply what you can already resolve.

## Contract

- **Deterministic pieces stay in the tools this skill calls** — `nexus close-migration preflight`,
  `nexus pr-worktree range`, `nexus config resolve` — never restated here as a parallel derivation.
  This skill owns the ordering, the refusal wording and the interactive ask-path around them, which
  is exactly the part no CLI verb can host.
- **Every rule in this file is stated once.** A lane that finds itself restating a checkout-role
  refusal, a reference form, a range-resolution order, or a qualification rule instead of loading
  this skill has drifted from the contract this skill exists to hold.
