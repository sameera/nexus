---
title: "Close Record: The plan is approved at a decision-grade gate and renders as a home page"
epic: "#458"
feature: "Roadmap-Driven Learning"
date: 2026-09-13
nexus_version: 0.44.0
analyze: "stale — ran 2026-09-13 @ 4c6792d041372ce8784744e18500f6deb60d4ca4, 1 commit(s) unanalyzed; waived 2026-09-13"
record: "#591"
record_hash: 97910b8b5bc705814bbc585fe746afa775cb2755139547774573299833176acc
range:
  - repo: github.com/sameera/nexus
    base: 487ded68423b404d333d65408bf481405547762a
    head: 4e0330a2da84bebd909c77da8e6763e761339368
---

# Close Record: The plan is approved at a decision-grade gate and renders as a home page

## Key Decisions

- **A slice is remembered through its lesson file, not through a story key.** `resolveArrival` matches
  written lessons to slices by lesson file name, and `open` carries the slice rather than a story
  number. The committed plan's uniqueness rule is already keyed on the lesson, and a scaffold has no
  story to key on. *Refuted:* a story-plus-part key on `StagedLesson`, which still needs a second rule
  for scaffolds.

- **Approval refuses a draft by the fingerprint of what the gate printed.** Printing the gate records a
  sha256 of the rendered draft beside it; `--approve` refuses when the current draft's fingerprint
  differs or none was recorded. Invariant 13 needs "exactly the draft the reviewer was shown", and the
  rendered draft text is already deterministic. *Refuted:* re-print the gate inside `--approve` and
  approve whatever it shows, which approves a draft nobody read.

- **Pinning tests arrive through the prose file, filed under the slice identity.** The prose front
  matter carries `pinning_tests: [{slice, file, text}]`; a learner arrival puts `writeTest` on the
  brief, a handoff arrival returns a `tests` outcome naming both slices. `--prose` is already the
  session's one channel for agent-written text, and a slice id keys the handed-off and the next slice's
  tests in one file. *Refuted:* a separate `nexus workbook pin-test` verb, which adds a second
  generative seam outside the fixed session chain.

- **Reviewer commands are declared in a YAML file passed with `--commands`.** `gate --approve
  --commands <file>` reads `suite`, `grading` and optional `probe_control` through the plan reader's own
  validation. Argument vectors and a multi-line control test do not fit a flag, and every other planning
  judgement already arrives as a file. *Refuted:* repeated `--suite`/`--grading` flags, which cannot
  carry the control test's text.

- **A re-approval refuses a second declaration of the commands.** `--approve --commands` over an
  existing plan is refused and the committed plan's suite, grading and control test are reused. Record
  #591 has re-approval reuse them, and silently preferring either source would hide which one won.
  *Refuted:* let a newly declared file replace the committed commands.

- **The taught prefix travels into the draft through the rewrite, not spliced in at approval.**
  `rewritePlan` takes `carried` stubs, sets them aside before merging, strips their concepts from the
  rest, continues a partly taught story's part numbers, and prepends them; approval then checks the
  draft's prefix matches the taught slices. The gate must show, and coverage must check, exactly the
  plan approval writes. *Refuted:* splice the carried slices in at approval time, which approves an
  order and a coverage verdict the reviewer never saw.

- **Every render path takes one options builder over the plan and the lessons.** `planRenderOptions`
  builds lessons, stubs and home entries from a given plan; the session, approval, `render` and `check`
  all call it, and a workbook with no teaching plan keeps the lessons-only render. Check mode compares
  bytes, so any path rendering from different inputs would report the home page as drifted after every
  session — record #591's second ADDRESS risk. *Refuted:* add home-page rendering to each path
  separately, which is how the render verb and check mode diverged from the session before.

- **The home page is `index.html` and its dependency edges are in-page anchors.** Each slice is an
  `<li>` anchored by its identity, dependencies linked by anchor; the plan reader refuses a lesson that
  would render to that name. Derived lesson names start `story-` or `scaffold-`, so the reservation only
  ever refuses a hand-written plan, and anchors keep the graph navigable without layout code.
  *Refuted:* an SVG graph laid out by a script when the page opens, which record #450 refuses because
  the content must exist at render time.

- **Plan and pages are written by staging the plan and holding the previous pages in memory.**
  `writePlanWithPages` stages `plan.yml.partial`, holds the previously rendered files, writes the pages,
  and renames the plan into place only after they land; on failure it removes the staging and restores
  the old pages. Invariant 31 asks for together-or-not-at-all, and the page write clears the folder
  before writing, so only a held copy can put it back. *Refuted:* render pages into a sibling directory
  and swap directories, which would move the authored `lessons/` folder along with them.

- **An empty issue body is pinned as an empty string, and the reader accepts it.** `pinned.body` must be
  a string but may be empty; approval pins it verbatim. An issue with no description is the story's real
  state, and refusing it at approval would block a legitimate roadmap over a field nobody chose.
  *Refuted:* refuse at approval a story whose body is empty, which moves the refusal earlier without
  making the plan any more true.

## Deviation Rationale

- **A carried slice's `dependsOn` is recomputed at re-approval** (deviates from record #591,
  invariant 35 — carried forward unchanged except its pinned state): the committed plan is the only
  source of the home page's dependency edges (invariant 43), so freezing a carried slice's `dependsOn`
  would leave the home page drawing edges to slices the re-plan moved or removed. Nothing a lesson was
  taught from changes — lesson, branch, concepts and pinning test are untouched.

- **A pinning test written for a slice past the carried prefix survives the rebuild** (record #591,
  invariants 29 and 35): invariant 35 freezes only the taught prefix, but a handoff writes the *next*
  story slice's test before its lesson, and the return probe fences with that text. Rebuilding that
  slice would drop the test and make the session ask for a second one, which invariant 29 forbids. The
  rebuilt slice therefore takes the previous plan's `pinningTest` from the slice with the same
  `sliceId`. *Refuted:* extend the carried prefix to every slice holding a test, which would also
  freeze the drifted slice's pin, concepts and order.

- **The plan-wide `epic` field survives as a fallback for older single-epic plans** (record #591 —
  each slice records its own epic and the plan-wide epic is no longer what a prompt names): approval
  writes `epic: null` plan-wide and a per-slice epic on every story slice, so no plan this epic
  approves reads the fallback. The field is kept only so hand-written single-epic plans, which predate
  per-slice epics, keep reading. *Refuted:* refuse any slice without its own epic, which breaks every
  shipped single-epic plan.

- **The repository is read with `gh repo view` at approval** (record #591 — approval fills the
  repository in "from the graph and the workspace"): approval must read every story's live state
  anyway (invariant 23), so it is already a networked step, and `gh` is the one source of the
  owner/name string a handoff prompt must state. Invariant 9's no-network rule binds prompt rendering,
  not approval.

- **`planRenderOptions` throws when `lessons/` holds a file the plan does not name** (record #591 —
  the record states no such refusal): every render path now renders from the plan, so a lesson with no
  slice has no page to render to and no place on the home page. Failing loudly beats rendering a
  workbook that silently omits a file the learner wrote.

- **The gate digest prints the `#<story> — split — <title>` header only before part 1** (deviates from
  record #591, invariant 17 — story titles appear as quoted data): a re-approval that continues a split
  story from part 2 or later prints the continued part with no story line. Unintended; first approvals
  are unaffected because splits are consecutive and handoffs and scaffolds are placed before part 1.
  Filed as deferred scope rather than fixed in this epic.

- **`gate --clear <story>` was added** (record #591 — the record states invariant 40's "until the
  reviewer clears the override" without naming the mechanism): an override that survives a re-plan
  needs a way out, and clearing one is a mark change like any other, so it lives on the same verb.

- **The session rewrites the committed `plan.yml` through a YAML re-serialiser** (record #591 — the
  record is silent on the plan file's formatting): recording a pinning test on arrival must write the
  plan, and `renderWorkbookPlan` is the one writer. A hand-written plan therefore loses its comments and
  formatting on the first write. Sanctioned by the record's field-owner decision — the session owns the
  pinning-test field — and format normalisation is incidental to it.

- **An unchecked fence is reported as intact** (deviates from record #591, invariant 7, and from record
  #469's rule that an unchecked fence is never read as one that held): when the next story slice carries
  no pinning test, `fence` stays `null`, `interpretReturn` treats `null` as a pass, and the session
  resolves the handoff as verified with the note "the fence around … is intact". Unintended. In the
  gated flow a handoff arrival writes both tests before the prompt, and commit `4c6792d` closed the
  re-approval route, so it is now reachable only from a hand-written plan — the reader no longer
  requires `pinning_test` on a slice the session has not reached. Filed as deferred scope.

## Waived Stories

none

## Deferred Scope

Deferred items filed as epic stub issues:

- #604 — A fence the session could not check is never reported as one that held
- #605 — Every part shown at the approval gate names the story it builds

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-09-13-a-gate-that-ships-with-two-unchecked-edges.md`
