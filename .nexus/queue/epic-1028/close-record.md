---
title: "Close Record: Read stage templates from the installed release instead of per-repository copies"
epic: "#1028"
feature: "Component Distribution"
date: 2026-11-14
nexus_version: 0.137.0
analyze: ran 2026-11-14 @ e2adc42781cf07083fd71d97f90da2c929b217f2
record: "#1033"
record_hash: 387902314651f964a54da153476af518cb1b57d93f88282592b8f1126b6f4941
range:
  - repo: sameera/nexus
    pr: 1034
    base: 7cda2028908ca6c19ac37921090fcc00318e3e12
    head: dc88440f1fdd84726b9652d9a16aeda3fa7341b6
story_ranges:
  - story: "#1029"
    ranges:
      - { repo: sameera/nexus, pr: 1034, base: 7cda2028908ca6c19ac37921090fcc00318e3e12, head: dc88440f1fdd84726b9652d9a16aeda3fa7341b6 }
  - story: "#1030"
    ranges:
      - { repo: sameera/nexus, pr: 1034, base: 7cda2028908ca6c19ac37921090fcc00318e3e12, head: dc88440f1fdd84726b9652d9a16aeda3fa7341b6 }
  - story: "#1031"
    ranges:
      - { repo: sameera/nexus, pr: 1034, base: 7cda2028908ca6c19ac37921090fcc00318e3e12, head: dc88440f1fdd84726b9652d9a16aeda3fa7341b6 }
  - story: "#1032"
    ranges:
      - { repo: sameera/nexus, pr: 1034, base: 7cda2028908ca6c19ac37921090fcc00318e3e12, head: dc88440f1fdd84726b9652d9a16aeda3fa7341b6 }
landed_check:
  - story: "#1029"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1034, result: unchanged }
  - story: "#1030"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1034, result: unchanged }
  - story: "#1031"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1034, result: unchanged }
  - story: "#1032"
    result: unchanged
    prs:
      - { repo: sameera/nexus, pr: 1034, result: unchanged }
---

# Close Record: Read stage templates from the installed release instead of per-repository copies

## Key Decisions

- **D1 — Templates come from the running release, not from a copy in the install location (#1033).** Outside a pointer install, the template lookup returns the travelling copy that ships beside the running executable. **Why:** The travelling copy already ships in every release, so the release needs no new file. The executable also holds the checks that validate a drafted record's sections, so reading templates from the same release keeps each template and its validator at one version. A repository then needs no copy, and a template change reaches every repository with the next upgrade. **Refuted alternative:** Copy the templates into the account install location during install, beside the components. That would keep templates and stage instructions at one version even when a lead upgrades and forgets to re-run install. It lost because it adds a second copy that install, uninstall, migration and the duplicate-install diagnostic must each manage, and that copy goes stale when install is not re-run, which repeats one level up the drift this epic removes.
- **D2 — A pointer install answers from its checkout (#1033).** When the install location is a pointer install, the template lookup returns the checkout set of the checkout the pointers name, whichever executable is running. **Why:** The maintainer's components are already live from the checkout. Templates that follow the same rule are live in the same way, with no rebuild. This meets #1029's third acceptance criterion even when the `nexus` on the maintainer's path is a published release rather than the linked build. **Refuted alternative:** Resolve only relative to the running executable, preferring a checkout set found next to it. That is simpler, because it never reads the install location. It lost because a maintainer would have to rebuild after every template edit, since the linked build holds a copy taken at build time, and because it fails #1029's third acceptance criterion when the maintainer's `nexus` is a published release.
- **D3 — The lookup ignores the repository and refuses instead of falling back (#1033).** The lookup takes only a template name and reads no repository state. An unknown name exits non-zero and lists the whole release template set. A known name missing from the chosen source exits non-zero and names that source. An install location that cannot be read exits non-zero with the install location's own diagnostic. Nothing falls back. **Why:** A lookup that cannot see the repository cannot return a repository copy, so #1029's fourth acceptance criterion holds by construction rather than by a check. It also follows the existing rule that reading the install location fails loudly and never falls back. **Refuted alternative:** none
- **D4 — The decision-record stage drafts through the lookup and drops its stale-copy checks (#1033).** The stage asks the lookup for the approval-first template by default, and for the old-format template on a revision of an old-format record. It removes the check that the template has a Guarantees section, the check of the section order, the stop for a missing old-format template, and every remedy that names the seeding command. When the lookup exits non-zero or prints nothing, the stage stops and reports the lookup's message. **Why:** The stale-copy checks only guarded a repository copy that could fall behind. The release template's headings are already pinned by the build-time tests of the shipped template, so checking them again at run time only guards against a broken release. The stop on empty output matters because stage instructions read the executable's output into a variable, so a missing command produces empty output, not an error. **Refuted alternative:** Keep the section-order check, aimed at the release template. It would catch a hand-edited installed release. It lost because it repeats a check the build already enforces and leaves instruction text that almost never runs.
- **D5 — Setup asks for the standards template once, where seeding used to run (#1033).** Setup removes its seeding step and its later note that templates are already in place. In their place it asks the lookup for the standards template in its prerequisites step, before it writes anything, and stops and reports if the lookup fails. The standards step then reads that location. The completion report lists no template seeding and no template folder. **Why:** Asking where seeding used to run keeps setup's existing order, in which anything that would fail does so before setup writes anything. Setup never touches the repository template folder, so a folder already there stays as it is. **Refuted alternative:** Ask for the template only in the standards step, and continue without it if the lookup fails. That would make setup more tolerant. It lost because a failed lookup means the executable or the install location is broken, and the later steps call the same executable, so continuing would quietly lower the quality of the standards instead of stating the refusal.
- **D6 — The seeding command becomes a named refusal that exits non-zero (#1033).** The seeding command keeps its name. With any arguments, it writes nothing, prints that templates are read from the installed release, names the template lookup, and exits non-zero. The seeding logic is deleted, and the README section on per-repository templates is rewritten to match. **Why:** This follows the existing precedent for retired commands: the retired close migration command, and the retired verdict checks under decision record #777. An unknown command reads as a broken install. A command that does nothing and exits zero reads, to a person or a script, as a step that is still required. **Refuted alternative:** A command that prints the notice and exits zero. It would keep any existing script that calls it working. It lost because it hides from scripts that the step no longer does anything, which the precedent rejects.
- **D7 — One declared template list, checked at build time (#1033).** The release template set is declared once. It drives what the release build packs and what the lookup answers to and lists. Two build-time checks use it: every template name a shipped stage asks the lookup for is in the set, and no shipped component reads a release template from the repository template folder. The second check widens the existing check on reads of the checkout set and keeps its exemption for wording that only contrasts the two. **Why:** These checks make #1032's second and third acceptance criteria true on every build instead of by a one-off search. They also stop a later edit from bringing a repository-copy read back. **Refuted alternative:** Rely on the existing fingerprint pin of the release payload alone. The pin proves the payload did not change unnoticed. It lost because it cannot show that every name a stage asks for actually ships.
- **D8 — Each story that changes adopter-visible behaviour raises the version (#1033).** #1030, #1031 and #1032 each raise the minor version and add a release-note entry in the same commit as the change. #1030's entry says that the repository's own template copies are no longer read, so local edits in them stop applying. #1032's entry says that the seeding command is retired, and that existing template folders are left in place, no longer read, and may be deleted. **Why:** The project's rules make the version and the release notes an adopter's only signal, because component changes do not appear in the adopter's own diff. The loss of local edits is the change most likely to surprise an adopter, and it happens with #1030, not #1032. The lead chose not to add a run-time notice for a repository copy, so the release note carries that message alone. **Refuted alternative:** One version increase for the whole epic, made in #1032. It would give one release note. It lost because it breaks the rule to raise the version in the same commit as the change, and it would ship #1030's change in a release whose notes do not mention it.
- **D9 — The Nexus repository deletes its own copies of the three stage templates (#1033).** #1032 deletes the decision-record template, the old-format template and the standards template from the Nexus repository's own template folder. The folder's other files, including the workspace and hub templates, stay. **Why:** The lead chose this at the clarification gate. These copies already differ from the release templates, and after #1030 nothing reads them. In the repository whose maintainers most need to know which copy is used, a stale copy that looks live misleads. Adopting repositories keep their folders, as the epic's Out of Scope says. **Refuted alternative:** Leave the copies in place, as the epic's Out of Scope says for every repository. That keeps this repository like an adopter's and changes nothing outside the stories. It lost because the copies are already stale and would stay in the one repository where a maintainer edits templates.
- **A leaf verb `nexus template-path <name>` prints the absolute location; the release template set lives in template-lookup.ts as RELEASE_TEMPLATES.** (a decision stub the verdict on sameera/nexus#1034 confirmed). **Why:** The verb's output is a path a stage reads from, and a leaf verb keeps the dispatch name simple. **Refuted alternative:** A `nexus template <name>` verb that prints the template content, which would hide where the template came from.
- **buildReleaseTree calls assertReleaseTemplates before it clears dist/, so the release build fails on a stage asking for an unshipped template.** (a decision stub the verdict on sameera/nexus#1034 confirmed). **Why:** G17 says the build fails; a spec-only gate would let the release build ship such a stage. **Refuted alternative:** Keep the checks as spec tests only.

## Deviation Rationale

none

## Waived Stories

none

## Deferred Scope

none
