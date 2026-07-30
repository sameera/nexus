## 2026-07-30 — Recovery invocation syntax for /nxs.distill (#174)

- **Choice:** an explicit `--recover <epic-issue>` flag, not a positional issue number.
- **Why:** record #176 requires recovery be "invoked explicitly for a named epic issue, never a
  discovery source"; a bare positional argument already means "drain this entry path" and would
  blur the explicit-recovery boundary the record draws.
- **Refuted alternative:** accept a bare `#<n>` / `<n>` positional argument and infer recovery
  when no local entry exists — viable, but it turns recovery into an implicit fallback, which is
  the shape the record refused.

## 2026-07-30 — Collision precedence in the union migration (#175)

- **Choice:** in `migrateEntry`, when an ephemeral entry file and a committed scratch file share a
  relative path, the ephemeral entry's file wins (manifest and copy both walk scratch first, entry
  last).
- **Why:** the entry artifacts are the close's authoritative output; scratch is pre-checkpoint
  hints. A defined precedence keeps the byte-for-byte verify deterministic.
- **Refuted alternative:** hard-error on any colliding path — safer-looking, but the collision is
  practically impossible (scratch lives under per-user subdirectories) and a hard error would turn
  a cosmetic overlap into a blocked close.

## 2026-07-30 — Consumed tmp entries are cleaned by the next run (#173)

- **Choice:** a run that derives an ephemeral entry consumed (provenance at the trunk) deletes
  that tmp directory itself, without a commit; only *unconsumed* entries are never auto-deleted.
- **Why:** record #176 invariant 12 says "the ephemeral directory is deleted without a commit",
  and consumption is already durable at the trunk, so the local copy is disposable derived state.
- **Refuted alternative:** never delete, only report "safe to delete by hand" — matches one
  sentence of the record's accepted-consequence prose, but that sentence governs the *unconsumed*
  zero-delta case; leaving consumed dirs forever would make every drain report grow monotonically.
