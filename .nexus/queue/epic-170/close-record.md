---
title: "Close Record: Tmp-First Analyze & Close Artifacts, with GitHub Fallback for Distill"
epic: #170
feature: "PR-Driven Delivery"
date: 2026-07-30
analyze: ran 2026-07-30 @ 6efb1e7
record: #176
record_hash: c291c8c2bcc5c1f65ce074c27729db5e514bfd3c3f7522f57991ee811d18cfef
range:
  - repo: github.com/sameera/nexus
    base: d0a16825afb836d6ec1d006a218c70f5acce5467
    head: b8d5deba61114fe14e2cbaab98a4df798e612f48
---

# Close Record: Tmp-First Analyze & Close Artifacts, with GitHub Fallback for Distill

## Key Decisions

- **Recovery is invoked as an explicit `--recover <epic-issue>` flag, not a positional issue
  number.** Record #176 requires recovery be invoked explicitly for a named epic issue and never
  act as a discovery source; a bare positional argument already means "drain this entry path" in
  `/nxs.distill`, so overloading it would blur the exact boundary the record drew. *Refuted
  alternative:* accept a bare `#<n>` / `<n>` positional and infer recovery when no local entry
  exists — viable and less syntax to learn, but it turns recovery into an implicit fallback, which
  is the shape the record refused.

- **In the member-mode union migration, the ephemeral entry's file wins a colliding relative
  path.** `migrateEntry` walks scratch first and the entry last, for both the manifest and the
  copy, so precedence is defined rather than incidental. The entry artifacts are the close's
  authoritative output; per-user scratch is pre-checkpoint hints. A defined order is what keeps the
  byte-for-byte hub verify deterministic. *Refuted alternative:* hard-error on any colliding path —
  safer-looking, but scratch lives under per-user subdirectories so a collision is practically
  impossible, and the error would turn a cosmetic overlap into a blocked close.

- **A run that derives an ephemeral entry as consumed deletes that tmp directory itself, without a
  commit.** This resolves an apparent tension inside record #176: invariant 12 says the ephemeral
  directory is deleted without a commit, while the accepted-consequence prose says it is named as
  safe to delete by hand and never auto-deleted. The two are reconciled by scope — the
  never-auto-delete rule governs *unconsumed* entries (invariant 9, the zero-delta case), and a
  consumed entry's durability already lives at the trunk, so the local copy is disposable derived
  state. *Refuted alternative:* never delete, only report "safe to delete by hand" — it matches one
  sentence of the record literally, but applying it to consumed entries too would make every drain
  report grow monotonically with directories nothing ever cleans.

## Deviation Rationale

- **`utils/implement-epic.sh` (+169, new) — unplanned scope, deviating from record #176's approach,
  which is confined to the three command contracts and the migration helper.** The script is
  general-purpose delivery tooling — a headless implementation loop that is not specific to this
  epic — and it landed on this branch as a hygiene lapse rather than as scoped work. It is retained
  deliberately: its `/goal` stage is a Claude Code harness command, so the script is functional as
  written. (The analyze receipt's LOW finding that `/goal` exists in no command directory is
  incorrect; it is harness-provided, not repo-provided.)

- **`/nxs.close` gained a new invocation form beyond story #172's acceptance criteria and unnamed by
  record #176** — Input Resolution option 4 resolves a bare epic issue number, or the current
  branch's linked issue via its parent epic, into `.nexus/tmp/`, and Usage documents
  `/nxs.close <n>`. Story #172's ACs govern only *where* artifacts are written. The form was
  required to make that behaviour reachable at all: under issue-sourced planning (#114) nothing is
  committed at planning, so there is no `epic.md` path to pass and no editor file to open — without
  a way to name the epic by issue number, a tmp-first local close has no usable invocation.

- **`libs/portable-tools/bundle-fingerprint.json` was re-pinned inside the range (`480ca1f`),
  unrelated to anything record #176 decided, and the re-pin did not hold.** The `claude-components`
  bundle embeds the `.claude/` command files this epic rewrote, so commits landing after the re-pin
  re-staled it: the trunk pins `13dec1e4…` while a fresh build at `b8d5deb` hashes `73669cba…`,
  leaving `libs/portable-tools/src/parity.spec.ts` failing on main. The condition is pre-existing —
  the same test also fails at the base commit `d0a1682` — so this epic did not introduce it, but it
  did carry a commit that attempted and failed to clear it. The re-vendor is deferred to the feature
  backlog rather than folded into this close.

## Deferred Scope

Deferred items appended to: `docs/features/pr-driven-delivery/backlog.md`

## Process Lesson

Recorded in: `docs/delivery/lessons/2026-07-30-tmp-first-analyze-close-artifacts.md`
