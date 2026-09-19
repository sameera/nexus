## 2026-09-18 — Ownership is recorded, not derived from the name

- **Choice:** each install writes the paths it placed into a record at the component root, keyed by
  package name, and sweeps only what its own key holds.
- **Why:** the namespace is shared by design — a stage a second package ships is still invoked as
  `/nxs.<name>` — so no rule over the file name can tell two packages apart.
- **Refuted alternative:** give each package its own prefix and scope the sweep to it. It needs no
  record and no new state at the root, and it loses because the prefix is user-facing: renaming it
  renames the command a lead types.

## 2026-09-18 — A root with no record keeps the old sweep

- **Choice:** when the record holds no entry for this package, the sweep stays unscoped and adopts
  what it finds; the record it then writes scopes the next run.
- **Why:** every install location that exists today is in that state, and a scoped sweep would find
  nothing of its own to remove — uninstall would silently clear nothing.
- **Refuted alternative:** treat a missing record as an empty one, which is simpler to reason about
  and turns the first upgrade into a no-op uninstall.

## 2026-09-18 — A collision is reported, not resolved

- **Choice:** a path this payload wrote that another package also claims is named in the result and
  printed by the install verb; the write still happens.
- **Why:** both packages ship the file, so there is no correct winner for the mirror to pick, and
  the mirror's whole job is to make the destination match the payload it was handed.
- **Refuted alternative:** refuse the write and leave the other package's file, which protects the
  incumbent and makes an install partially fail for a reason the installing user cannot fix.
