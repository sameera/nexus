---
title: "Close Record: Planning Reads Features from a Query, and Filing Writes Nothing to the Tree"
epic: "#1000"
feature: "Issue-Sourced Planning"
date: 2026-11-23
nexus_version: 1.9.0
analyze: ran 2026-11-23 @ 0d351135e15361b0d30adba6b39f46b6fc595933
record: "#1061"
record_hash: 5c726fbffd628ff1635f605c66a97bbf6e11a26733e67dd8ac64c0575cdb98d9
range:
  - repo: sameera/nexus
    pr: 1067
    base: 755726ee39b48602ed22e5672ce4beb50efada83
    head: 9cc6418a3607b20ede949e229d9fef068246074a
story_ranges:
  - story: "#1056"
    ranges:
      - { repo: sameera/nexus, pr: 1067, base: 755726ee39b48602ed22e5672ce4beb50efada83, head: 9cc6418a3607b20ede949e229d9fef068246074a }
  - story: "#1057"
    ranges:
      - { repo: sameera/nexus, pr: 1067, base: 755726ee39b48602ed22e5672ce4beb50efada83, head: 9cc6418a3607b20ede949e229d9fef068246074a }
  - story: "#1058"
    ranges:
      - { repo: sameera/nexus, pr: 1067, base: 755726ee39b48602ed22e5672ce4beb50efada83, head: 9cc6418a3607b20ede949e229d9fef068246074a }
  - story: "#1059"
    ranges:
      - { repo: sameera/nexus, pr: 1067, base: 755726ee39b48602ed22e5672ce4beb50efada83, head: 9cc6418a3607b20ede949e229d9fef068246074a }
  - story: "#1060"
    ranges:
      - { repo: sameera/nexus, pr: 1067, base: 755726ee39b48602ed22e5672ce4beb50efada83, head: 9cc6418a3607b20ede949e229d9fef068246074a }
landed_check:
  - story: "#1056"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1067, result: unchanged }
  - story: "#1057"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1067, result: unchanged }
  - story: "#1058"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1067, result: unchanged }
  - story: "#1059"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1067, result: unchanged }
  - story: "#1060"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1067, result: unchanged }
---

# Close Record: Planning Reads Features from a Query, and Filing Writes Nothing to the Tree

## Key Decisions

- **D1 — One `github.features` setting, with `features-as-issues` kept as a legacy spelling (#1061).** The setting is `github.features`, with the values `docs`, `types` and `labels`, and `docs` is the default. When `features` resolves at any level, it decides. When it is absent, `features-as-issues: true` still means issues marked the way `classification` says. The setting is read only through the shared settings resolution, and a workspace can set it once for every member, as it can `features-as-issues`. **Why:** One setting states all three choices and reuses the words `classification` uses. Letting `features` win whenever it is set keeps the precedence rule to one sentence. Keeping the old setting accepted is what lets #1060's last criterion hold for repositories that opted in under #998. **Refuted alternative:** Keep the `features-as-issues` switch and add a separate `feature-classification: types | labels` setting. It changes no existing setting. It lost because the two settings can contradict each other, for example `features-as-issues: false` with `feature-classification: types`, and every reader would need a rule to settle the conflict.
- **D2 — The feature marker follows the feature setting, not `classification` (#1061).** The shared kind rule reads the feature marker in the feature mode: `types` reads the type only, `labels` reads the label only, and the legacy mode reads the label first, as today. Feature is still tested last, so an issue with an epic, story, record or initiative marker never reads as a feature. A feature marker never raises a classification mismatch. New feature issues are filed with the feature mode's marker alone. **Why:** #1060 asks that a repository that labels its epics can give its features the Feature type. Leaving the test order alone keeps #998 D3's protection: a feature marker that matches another kind's marker takes nothing from that kind. **Refuted alternative:** none
- **D3 — `types` never falls back to a label and is checked before approval (#1061).** Under `features: types`, the feature type comes only from `feature-type`, which has no built-in value. When the run would file a new feature issue, the lookup checks before the digest that the type is named and that the epic repository has it. If either fails, the run stops, names the missing setting or type, and files nothing, the epic included. A feature issue is never filed untyped; for feature issues only, this replaces the filer's usual warn-and-file-untyped rule. The legacy case keeps #998's behaviour. **Why:** A label-marked or untyped feature issue is missing from a listing by type. The next run would file a duplicate, and the epic would be lost once the tree is no longer read. Stopping before approval is cheaper than recovering afterwards. Having no built-in type name keeps the issue-kind-classification page's invariant 6 and #998's record D2 intact. **Refuted alternative:** Fall back to the feature label when the type is missing. The run never stops. It lost because features would carry two marker shapes, and a listing by type would miss the fallback issues.
- **D4 — The listing is part of `nexus feature-issue`, checks the opt-in first, and lists only issues that record their feature (#1061).** `nexus feature-issue` gains three listings: features, a feature's epics, and a feature's open stubs. Each resolves the feature mode first. On docs or the legacy case with no marker, it says so and makes no GitHub call. Under `types` with no named type, it refuses and names the setting. No reader checks the opt-in itself. Features are listed through GitHub's issue listing, open and closed, keeping only issues that carry the feature marker and a feature record. A listing GitHub does not fully answer fails and prints nothing partial. **Why:** `nexus feature-issue` already holds the opt-in reading, the marker and the issue reader, so a separate home for feature rules would drift from it. The feature-record check matters because the `feature` label and GitHub's standard Feature type are widely used for feature requests, which would otherwise flood the list. Every feature issue Nexus files or migrates carries a record, so no real feature is lost. The issue listing avoids the search index's delay, which #998 D5 gave as its reason. **Refuted alternative:** Use GitHub search for the feature list. It is one call with no paging. It lost because the search index lags behind an issue filed moments earlier, which matters on a repeat run, and search caps its results.
- **D5 — A feature's epics and stubs come from the feature reference in each body (#1061).** The command reads every epic-marked issue in both states and keeps those whose body names the feature issue number. An issue with the unplanned label is a stub; one without it is a planned epic. The epic list holds planned epics in both states, each with its state. The stub list holds only open stubs. Initiatives and feature issues are left out by kind. Related links are never the source of membership. **Why:** #998 D7 and #999 D5 made the body reference the record of a feature's membership, and the migration wrote it onto every placed epic. A related link can fail with only a warning, so it is not authoritative. The initiative rules out sub-issues. The unplanned label is already the one way a stub is identified. **Refuted alternative:** Read the feature issue's related links. It is one call per feature instead of a full read. It lost because a link that failed, or was removed later, drops an epic from the list with nothing to show the gap.
- **D6 — The three readers use the listing, and its "off" answer selects the tree (#1061).** `/nxs.epic`, `nxs-pm` and `nxs-architect` call the listing command and branch only on its answer. "Off" selects the tree fallback. Any other answer means they read no feature README and no features index. `/nxs.epic` intent mode offers the listed features, open or closed, as matches, and names a retired one as retired without putting it forward as the default. The agents list the features, then the epics of the features they judge similar. **Why:** One reader of the opt-in keeps the publishing-config-resolution page's invariant 1 intact. Stage text never decides the mode, as #998 already established for lookup. **Refuted alternative:** Read both the listing and the tree and merge them, as a safety net while migrations finish. It would keep unmigrated features visible. It lost because once #1058 stops writing READMEs the two sources disagree, and it would fail #1057's criteria.
- **D7 — An existing feature is identified by its issue number, and lookup no longer checks for a README (#1061).** When the lead confirms an existing listed feature, the run uses that issue's number directly, as a promoted stub's named issue is used today. The feature path stays as a recorded name that points to no folder. Lookup by path stays for repeat runs and for a newly named feature. A path with no matching feature issue means a new feature issue is filed, whether or not a README exists at that path. This retires #998 D5's "unmigrated" branch and #998 G12. **Why:** The number is already the reference every epic and stub carries. Checking whether a README exists is a tree read, which #1057 rules out. Dropping the check is safe, because the migration finds feature issues by the same path and reuses the new issue. **Refuted alternative:** Keep the README check and stop the run on an unmigrated feature, naming the migration command. It would force a clean migration before planning. It lost because it keeps a tree read in an opted-in run and blocks planning on a state the migration already reconciles.
- **D8 — Opted-in filing writes nothing to the tree, and the folders are kept (#1061).** In an opted-in repository, `/nxs.epic` creates no feature folder, writes no README and adds no index row, in intent, promotion, discovery and stub runs. Existing folders, READMEs and the index are never moved or deleted, and only the migration's pointer line (D11) edits them. A repository that has not opted in, and the legacy case with no marker, write the tree as today. **Why:** This is #1058's scope and the initiative's objective. Keeping the folders keeps the links into them working, as #999 D6 argued. **Refuted alternative:** none
- **D9 — New feature issues are filed and then closed, replacing #998 D10 and #999 D7 (#1061).** A new feature issue is created, recorded in the ledger, and closed by the close step before the epic is filed. The close step closes only the feature issue the run's own ledger records. An existing open feature issue that is reused is left as it is, and the lead closes those by hand. No stage reopens a feature issue. The migration closes the feature issues it files through the same step. A failed close does not stop the epic or stubs from being filed; the run reports incomplete, and a repeat closes the issue without filing another. The close reason means nothing. This replaces #998 D10, under which feature issues stay open, and #999 D7, under which the migration files them open. #998 D10's other points, that folders stay and close is unchanged, still hold. **Why:** Open feature issues raise the open-issue count with no end and crowd triage. #999 D7's two objections no longer hold: features now have their own listing, so they do not vanish, and the listing reads both states anyway. A feature has no done state, so closed is simply the state that keeps features out of the way. **Refuted alternative:** Let the shared filer close the issue itself, through a per-item "close after create" option. That keeps a single write path. It lost because it changes the filer every kind shares for the sake of one kind, and the filer's summary output is fixed by #998 D9.
- **D10 — The retired-feature label keeps its meaning and is the only retired signal (#1061).** The label still marks a feature no longer in use, and a lead applies it by hand. Because state now means nothing, the label is the only retired signal. The feature listing reports it, and `/nxs.epic`'s feature confirmation names a retired feature as retired. No stage adds or removes the label. **Why:** #999 D10 created the label because closing could not mean retired, and with every feature issue closed that is even more true. The label and the migration's handling of it already exist. **Refuted alternative:** Mark a retired feature with GitHub's "not planned" close reason and drop the label. No label would be needed. It lost because the close reason cannot be filtered in the issue listing, is barely visible in GitHub's views, and would leave #999's setting with nothing to mean.
- **D11 — The migration adds one pointer line to each README (#1061).** The migration's apply run adds one line to each feature README whose feature has a feature issue, naming that issue. It adds the line only when it is not already there, so a repeat run adds nothing. The plan run writes nothing. This honours #999 D6's promise that #1000 adds the pointer line, and amends #999 G16, under which the migration writes nothing to the tree. **Why:** A reader who opens a README from an old link would otherwise see an epic list that stopped updating, with no sign of where to look. The lead chose to have the migration write the line during this record's clarification, because the migration already pairs each folder with its feature issue and runs once per repository. **Refuted alternative:** Drop the promise and have the lead add one sentence by hand to the features index of each opted-in repository. It keeps the migration read-only on the tree. It lost because a reader who lands on a single README from an old link never sees the index.
- **check-related gains --filed, which reads the feature issue's state and exits 1 while it is open; /nxs.epic passes it only when the run filed the issue.** (a decision stub the verdict on sameera/nexus#1067 confirmed). **Why:** Mechanism step 8 of record #1061 (D9) names the final read-back as what confirms the close. **Refuted alternative:** Revise D9 to name the close step's exit as the confirmation.
- **A github.features value other than docs, types or labels makes lookup, listings and migration exit 1 as unknown-mode, naming the value; resolveFeatureMode itself is unchanged.** (a decision stub the verdict on sameera/nexus#1067 confirmed). **Why:** A typo silently fell back to the docs tree, so a repository meaning types or labels planned from the tree with no sign. **Refuted alternative:** Warn and continue on the docs tree.

## Deviation Rationale

- **Departs from record #1061 D3 — sameera/nexus#1067 DV10.** With features: types and no feature-type, the lookup refuses as no-type on every run, including one that reuses an existing feature issue. D3 and Mechanism step 7 stop only a run that would file a new feature issue. **Why:** Considered a misconfiguration by the user and is expected to be corrected by the user. **Accepted by:** @sameera (https://github.com/sameera/nexus/pull/1067#issuecomment-7090511456)

## Waived Stories

none

## Deferred Scope

none
