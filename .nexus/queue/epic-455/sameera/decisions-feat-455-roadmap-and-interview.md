## 2026-09-07 — The roadmap is read back out of the shared resolver's own markdown

- **Choice:** `resolveRoadmap` takes an injected epic resolver, and parses the `epic.md` the shared resolver returns rather than calling the resolver's read layer piecewise.
- **Why:** It keeps the five classification rules in one place — the record's first key decision — while still giving the roadmap every story body and edge.
- **Refuted alternative:** Calling `fetchIssue`/`fetchSubIssueNumbers`/`fetchBlockedBy` directly from here, which would be fewer parses but a second reader of the rules.

## 2026-09-07 — The roadmap materializes as JSON beside the materialized epic

- **Choice:** `.nexus/tmp/roadmap-<name>/roadmap.json`, written with a stable key order and four-space indent.
- **Why:** It is a derived artifact a later phase reads back whole, not something a human reviews, so a parse-exact format beats a prose one; `.nexus/tmp/` is where the resolver's other derived output already lives.
- **Refuted alternative:** A markdown roadmap.md mirroring epic.md — readable, but every later phase would need a parser for a document nobody reviews.

## 2026-09-07 — Resolution is a subverb of `nexus workbook`, not a verb of its own

- **Choice:** `nexus workbook roadmap [<name>] --epic <n> | --query <expr>`.
- **Why:** The record has resolution create the workbook before anything is asked, so resolution and the workbook share one surface and one placement rule.
- **Refuted alternative:** A top-level `nexus roadmap` verb, which would have to re-resolve the workbook home itself.

## 2026-09-07 — The interview slate is a module constant, not a slate derived per roadmap

- **Choice:** `interviewSlate()` takes no argument and returns the same four slots for every roadmap.
- **Why:** It makes "no question asks for anything the roadmap already holds" a property of what the stage is able to ask, which a test can assert, rather than a hope about generated wording.
- **Refuted alternative:** A slate selected from the roadmap's material (skip the testing slot when no slice is test-first), which fits better but reintroduces the untestable generation the record refused.

## 2026-09-07 — The agent's contribution arrives as an answers file, not as CLI arguments

- **Choice:** `nexus workbook interview <name>` prints the slate; `--answers <file>` records what came back, mirroring `teach --prose <file>`.
- **Why:** Free-text answers are multi-line and the surface already has this shape for the one other place an agent contributes prose.
- **Refuted alternative:** Repeated `--answer slot=text` flags, which cannot carry a paragraph and would put a learner's words in a shell history.

## 2026-09-07 — A named focus records `stories: null`, not an empty list

- **Choice:** `focus.stories` holds every story number when the whole roadmap is in focus and `null` when the learner named one.
- **Why:** Which slices fall inside a named focus is #457's judgement; an empty list here would read as "nothing is in focus", which is the exact misreading invariant 19 exists to prevent.
- **Refuted alternative:** Omitting the field when a focus is named — smaller record, but it makes absence mean two different things.

## 2026-09-07 — The shared reference set is declared, not inferred from the overlap

- **Choice:** `SHARED_REFERENCES` names what both phases load; the check compares each body against that constant.
- **Why:** Inferring "shared" from the two sets overlapping makes a planning body that wrongly declares a lesson-writing reference look like a body sharing one — the exact failure the check exists to catch.
- **Refuted alternative:** Treating any reference in both sets as shared, which needs no constant but is silently self-defeating.

## 2026-09-07 — The reference set is frontmatter, not prose the check greps for

- **Choice:** Each command declares `phase:` and a `references:` list in its YAML frontmatter.
- **Why:** The record asks that the phase boundary be verified by inspecting each entry point's declared set; a declared list is readable without guessing at prose.
- **Refuted alternative:** Deriving the set from the skills each body mentions, which needs no new field but cannot tell a reference the body loads from one it merely names in passing.

## 2026-09-08 — The roadmap takes the resolver's structured result, not its rendered markdown

- **Choice:** `resolveEpic` now returns the epic it read — number, title, stories, edges — beside the `epic.md` markdown, and the roadmap builds from that; the markdown parser it used to carry is gone.
- **Why:** A story body is a whole issue body and a real one carries its own `## Acceptance Criteria` heading, which in the rendered document is indistinguishable from the epic's next H2 section, so every real story body was silently truncated at its first sub-heading and invariant 5 held in name only.
- **Refuted alternative:** Teaching the parser where the stories region ends — track the `## User Stories` block and treat every H2 inside it as story content. It keeps the resolver's return type untouched, but it is a second reader of the serializer's layout that drifts the moment the layout moves, which is the drift invariant 4 exists to prevent.

## 2026-09-08 — A too-wide query is refused by bound, not by count

- **Choice:** The refusal says the query returned "more than ten" epics instead of naming a number.
- **Why:** The search is asked for one row past the cap, so the row count is a floor: fifty matches and eleven matches come back the same length, and naming a count reports the fetch limit back to the learner as their result.
- **Refuted alternative:** Fetching without a limit so the count is true, which costs a full result set on exactly the query already known to be too wide.
