## 2026-08-08 — Discovery store filenames and the unique key's shape

- **Choice:** The discovery doc is `discovery.md`; a ticket is `ticket-<nn>-<ticket-slug>.md`; the folder key is 8 lowercase hex characters.
- **Why:** `discovery.md` is a name no stage scans for, the numbered ticket prefix gives a stable listing order without encoding dependency order, and 8 hex matches the key shape the existing queue entries already use.
- **Refuted alternative:** Name the doc after the slug (`<slug>.md`) so the folder reads self-describing — rejected because every session would have to derive the doc's name from the folder's name before it could read it.

## 2026-08-08 — Staleness threshold for a ticket claim is 24 hours

- **Choice:** A claim on an unresolved ticket may be taken over once it is older than 24 hours.
- **Why:** A claim has to outlive one working session so a parallel same-machine session cannot steal an in-flight ticket, and has to expire fast enough that a claim arriving in someone else's pull does not park the ticket for a week.
- **Refuted alternative:** No fixed threshold, deciding staleness by asking the user each time — rejected because the takeover is the one path a session must be able to take unattended.

## 2026-08-08 — The direct-plan path also gets the marked gist comment

- **Choice:** When a discovery right-sizes to M or smaller and is planned as one epic, `/nxs.epic` posts the same marked gist comment on the epic issue that the stub path posts on each stub.
- **Why:** The record's invariant 5 requires anything outliving a discovery to be copied in full into a durable artifact, and on this path there is no stub body to carry it — the folder is removed and the reasoning would be lost outright.
- **Refuted alternative:** Read the acceptance criterion literally and write gists only onto stubs — rejected because it silently drops every decision of a small discovery on the floor.

## 2026-08-09 — The no-build lessons note carries full gists, not the index verbatim

- **Choice:** Phase C1 writes one full gist per index line — Decided, Why, refuted alternative — and drops the index line's `Detail:` clause, instead of copying the resolved-decisions index verbatim.
- **Why:** The index line is a gist that leans on a ticket file to hold the reasoning, and the same commit removes every ticket file, so a verbatim copy would ship the only durable artifact on the no-build path with pointers that are dead on arrival (record invariants 4 and 24).
- **Refuted alternative:** Copy the index verbatim and merely strip the `Detail:` clause — rejected because it satisfies the invariant while still losing the reasoning outright; the graduation path copies full gists onto stubs for this same reason, and the no-build path has less carrying it, not more.

## 2026-08-08 — The component fingerprint pin rides the last commit that touches `.claude/`

- **Choice:** `libs/portable-tools/bundle-fingerprint.json` is re-pinned once, in the final story commit that changes `.claude/commands/`, rather than once per story commit.
- **Why:** The pin is a derived hash of the whole component tree, so a per-commit re-pin would rewrite the same line five times and conflict on every replay, while buying nothing — only the branch tip is ever vendored.
- **Refuted alternative:** Re-pin in each story commit so every commit passes the parity test on its own — rejected as churn on a single derived line that no consumer reads at an intermediate commit.

## 2026-08-09 — `verify.ts`'s GitHub-file-list cross-check keeps excluding only the queue

- **Choice:** `changedFileSet` (the git-diff-based helper) now excludes `.nexus/discovery` alongside
  `.nexus/queue`, matching the distiller's own exclusion (record #235 invariant 2). `prChangedFiles`
  and `verifyRange`'s `ghFileSetsEqual` cross-check — which filter GitHub's own `--json files` list by
  string prefix, not git pathspec — still filter only `.nexus/queue`.
- **Why:** The analyze-pass finding named only the git-diff exclusion list (`range.ts`, `verify.ts`'s
  `changedFileSet`, `range.spec.ts`) as load-bearing; the GitHub-file-list filters are a separate
  mechanism serving a cross-check, not the distiller-facing gate itself, and extending them was outside
  the finding's stated scope.
- **Refuted alternative:** Extend the same `.nexus/discovery` filter to `prChangedFiles` and
  `ghFileSetsEqual` for consistency — a real PR touching `.nexus/discovery` would otherwise fail the
  optional GitHub cross-check even though the range itself is now correctly derived. Left as a follow-up
  rather than folded into this fix, since it widens the diff beyond the named finding.

## 2026-08-09 — Sharpness sub-gate restates MANDATORY-STOP as an inline sub-gate label, not a heading suffix

- **Choice:** Added `**Sharpness gate (MANDATORY STOP).**` as the lead-in to the stop sentence inside
  `### Sharpness precondition`, mirroring Phase 5's `**Open questions gate (MANDATORY STOP).**`
  sub-gate label, rather than appending `(MANDATORY STOP)` to the `###` heading itself.
- **Why:** The heading covers both the sharp-goals (no-stop) and underspecified (stop) branches; only
  the second is a mandatory stop, so marking the heading would misstate the sharp-goals branch. The
  inline sub-gate label is the file's existing convention for a conditional stop nested inside an
  already-marked phase (Phase 5 heading + Open-questions sub-gate label).
- **Refuted alternative:** Append `(MANDATORY STOP)` to the `### Sharpness precondition` heading —
  rejected because it would fire on every intent-mode run, not only the underspecified branch.
