## 2026-09-07 — Which "backlog" literals count as the unplanned marker

- **Choice:** Renamed only the literals that stand for the unplanned-epic marker; left `gh.spec.ts`'s `"backlog"` (an arbitrary label name in generic `ensureLabel`/`labelExists` tests) and the `epic-352` corpus fixtures untouched.
- **Why:** The AC forbids anything that *resolves the marker* to `backlog`; those two are a throwaway label string and a frozen historical corpus, and editing the corpus would move a golden fixture for no behavioural reason.
- **Refuted alternative:** A blanket repo-wide `backlog` → `needs-refinement` substitution.

## 2026-09-07 — Version bump lands with Story 1, not Story 2

- **Choice:** Bumped `package.json` to 0.6.0 with the CHANGELOG entry in Story 1's commit.
- **Why:** Story 1 is the only story that changes adopter-visible stage behaviour (the label a stub is filed under); Story 2 is doc and comment wording, which the contributing rule calls non-substantive.
- **Refuted alternative:** Bumping in Story 2 so the release entry could also describe the reworded docs.

## 2026-09-07 — Reword beyond the six files the AC names

- **Choice:** Reworded "backlog stub" → "epic stub" everywhere the phrase names this object — the three docs and three code files the AC names, plus `nxs.discover.md`, both close-record templates, `README.md`, `CLAUDE.md`, `how-to-nexus.md`, the feature READMEs and the remaining source comments — while leaving `.nexus/concepts/`, the archived `libs/origin/` tree, past CHANGELOG entries, delivery lessons and the epic-352 corpus alone.
- **Why:** The AC names the files it can enumerate, but a vocabulary rename that stops halfway leaves the shipped components saying "epic stub" and the README they point at saying "backlog stub". The excluded trees are either distiller-owned, frozen fixtures, or a historical record that must keep saying what it said.
- **Refuted alternative:** Touching only the six enumerated files.
