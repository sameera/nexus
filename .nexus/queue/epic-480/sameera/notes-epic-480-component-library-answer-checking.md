## 2026-09-13 — Manual real-browser restore check (record #616 ADDRESS risk, invariant 8)

Ran against head 4e0d877 in real Chromium (Playwright-driven, headless Chromium 1228, `file://` page
built from the shipped `fill-the-signature` + `parsons-problem` + `trace-stepper` components) rather
than jsdom, which cannot reproduce form restore or the back/forward cache.

Scenarios and results, all pass:

- **Reload.** Typed a wrong signature answer and checked it, moved a Parsons line, then reloaded.
  Signature field, check state and result text all cleared; reveal control disabled again; Parsons
  order back to the written (shuffled) order.
- **Back/forward cache.** Typed an answer and checked it, moved a Parsons line, answered the trace's
  first question and stepped forward, then navigated to `about:blank` and back. Confirmed via
  `performance.getEntriesByType('navigation')[0].type === 'back_forward'` that the return was an
  actual bfcache restore, not a fresh navigation. Signature field, check state, Parsons order and
  trace step all reset to the written state.
- **Autofill/restore opt-out.** Every answer field carries `autocomplete="off"`.

Reopening a closed tab was not separately driven (no automation surface for browser session
restore), but it re-navigates and re-executes `workbook.js` the same way a reload does — covered by
the reload scenario above, which the pageshow/script-reset path already needs regardless of bfcache.

Driver script and generated page: not committed (throwaway, built from the shipped render functions
with no changes to product code).
