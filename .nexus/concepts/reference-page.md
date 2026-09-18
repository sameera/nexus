---
title: "Reference Page"
aliases: ["earned page", "second drill", "compressed page", "owed reference page", "reference prose", "returning learner page"]
touches: ["cold-drill", "teaching-session", "lesson-renderer", "workbook-store", "offline-page"]
last_updated_by: "#481"
status: active
verification: verified
---

# Reference Page

A concept earns a short page of its own when a session drills it a second time. The page restates, in at most five hundred words, what a lesson already taught, so a returning learner can refresh one concept without rereading the lesson that introduced it. Whether a concept has earned a page is counted over the drills the committed lessons record, so nothing about the learner is stored to decide it.

## How It Works

After the session picks the drill, it checks whether an earlier written lesson already drilled that concept. If one did, the brief names the concept and asks for the page's prose. An introduction is not a drill, and neither is a question asked again after a hint. The prose is optional. Without it the lesson is still written, and every later session names the concept as still owed. Returned prose the render would refuse stops the sitting before anything is written, and so does a page that would take the file of another concept's page. The page sits in its own authored folder outside the teaching plan, so the navigation and the home page never list it. The render gives it lesson chrome under a reserved name and links to it from the warm-up of every lesson that drilled its concept. The link is made at render time, so a page written later is reachable from every earlier lesson.

## Key Invariants

1. A concept earns a page exactly when the drill just chosen was already drilled by an earlier written lesson. A concept met only once earns none.
2. Earning is counted from the committed lessons alone, and nothing records which pages a learner has opened.
3. A missing page never blocks a lesson. Prose that would fail the render stops the sitting before anything is written.
4. The render refuses a page that names other than one concept, names a concept no written lesson taught, covers a concept another page covers, or runs past five hundred words.
5. No lesson may render under the reserved name reference pages take.
6. A lesson links to a page only when that page is in the same render, so no link is ever dead.
7. Whether the prose restates only what a lesson taught is an authoring rule, and no code checks it.

## Integration Points

- [cold-drill](cold-drill.md) — the drill history a page is earned from, where a second drill of one concept is the trigger.
- [teaching-session](teaching-session.md) — the chain that names an earned concept, asks for its prose, and checks that prose before writing anything.
- [lesson-renderer](lesson-renderer.md) — builds the page in the same all-or-nothing render and links to it from the drilling lesson's warm-up.
- [workbook-store](workbook-store.md) — holds the page's authored prose in its own folder beside the lessons.
- [offline-page](offline-page.md) — the rules the page is read and printed under, including that nothing on paper is hidden or clipped.

## Decision Log

### 2026-09-18 — #481 — A second drill earns a page, and the page is linked at render time

A concept that matters a second time was introduced several lessons back, and rereading a whole lesson to recover one idea costs more than the idea is worth. Earning is counted over the drill history the committed lessons already carry, so a teammate's checkout sees the same earned set and an empty learner folder changes nothing. Earning a page and writing it are separate events, so a missing page never holds back the lesson the learner came for. The build went one step past the record: prose the render would refuse now stops the sitting, because the render is all-or-nothing and writing that prose would leave the new lesson with no page. The link is resolved at render time because the lesson is always written before the page it points at. Refuted alternative: keep a per-learner tally of drills in the learner folder. It survives a re-plan that rewrites lessons, but the folder is ignored and personal, so no other checkout would see the tally, and it is the personal record this epic rules out.
