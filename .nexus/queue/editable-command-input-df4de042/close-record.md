---
title: "Close Record: Editable Command Input"
epic: #25
feature: "Command Input"
date: 2026-07-05
---

# Close Record: Editable Command Input

## Key Decisions

- **Named the plain-text mode `raw-edit`** (on `MarkdownEditor`, alongside `edit`/`view`).
  Why: user directive at plan approval. Refuted viable alternative: `"command"` / `"plain"`.
- **Tested raw-edit behavior in the `@nexus/editor` lib, not in Prime.** The lib drives
  Lexical through its own model API (reading the editor off the root element) with a jsdom
  layout shim; Prime specs stay Lexical-free and cover structure + the overlay hand-off only.
  Why: invariants 1–5 are editor-lib constraints and exercising them needs Lexical's `$` node
  APIs, which are a dependency of the lib — keeping the tests there honors the decision
  record's "no second Lexical in Prime" boundary. Refuted viable alternative: add `lexical`
  as a Prime devDependency and drive the field in Prime tests.
- **jsdom text-entry goes through Lexical's model API, not synthetic keyboard events.** Tests
  set content via the editor Lexical exposes on the root element, then assert user-visible
  outcomes; a `test-setup.ts` shims `Range.getBoundingClientRect`/`getClientRects`. Why: jsdom
  has no layout engine, so synthesized `beforeinput`/paste/composition events do not reliably
  mutate Lexical's model and selection-scroll calls throw; real keystroke/submit is verified
  end-to-end via `/run`. Refuted viable alternative: browser-mode vitest / Playwright infra
  (heavy, out of scope).
- **Diagnosed the reported "Enter just inserts a newline" bug as a Vite cold-start
  dep-optimization artifact, not a `CommandSubmitPlugin` defect** — fixed by pre-declaring the
  ~20 `@lexical/*` entry points in `apps/prime/vite.config.ts`'s `optimizeDeps.include`, not by
  touching the plugin. Why: on a cold dev server Vite discovers the deep transitive Lexical
  imports one request at a time, triggering repeated full-page "Outdated Optimize Dep" reloads;
  a keystroke landing mid-reload drops the just-mounted command handler. Verified via a headless
  Playwright run that identical code fails only during the reload storm and is correct once
  settled. Refuted viable alternative: change the plugin's priority/registration logic — would
  have fixed nothing, since the plugin was already correct.

## Deviation Rationale

- **raw-edit with no `onSubmit` inserts a newline instead of submitting — relaxes invariant 3
  for the no-handler case:** invariant 3 ("Enter without Shift MUST submit") assumes a submit
  target; with none there is nothing to submit, so Enter falls back to a plain newline. This
  let Story 1 land the editable multi-line field before Story 3 wired the hand-off. In the
  shipped terminal region `onSubmit` (`submitCommand`) is always provided, so the delivered
  input always submits — the fallback is latent, not user-reachable.

## Deferred Scope

Deferred items appended to: `docs/features/command-input/backlog.md`

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-05-suspect-dep-optimization-before-plugin-logic.md`
