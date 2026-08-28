## Story #320 — the authored tree has moved, and the checks that keep it moved

The authored component tree is now `components/` at the repository root — an ordinary tracked
directory the harness does not read. `.claude/` in this repository holds only user-owned and
tool-owned state (`settings.local.json`, `worktrees/`), both already gitignored, so a fresh clone
has no `.claude/` at all.

### AC1 / AC2 — the preconditions

Story #319's evidence is recorded on its own issue: the checkout-pointing install carries the
maintainer's edit-and-rerun loop on this machine. #249's story for the three runtime resolver
lookups is closed, and none of `libs/epic-resolve/src/classify.ts`, `libs/pr-worktree/src/worktree.ts`
or `libs/pr-worktree/src/git-fixtures.ts` reaches `<target-root>/.claude/skills/nxs-gh-shared/…`
any more — so nothing runtime reads the file this move deletes from that path.

### AC3 — nothing Nexus-namespaced is left at a loaded path

`git ls-files -- .claude` is empty. This is now a standing check in the suite
(`libs/portable-tools/src/authored-root.spec.ts`), not a one-time look: it fails if a component
file reappears under `.claude/`, whether from a future harness release, from `nexus deploy` being
run inside this checkout, or from an absent-minded re-add.

### AC4 — a component only at the new location is not offered

A probe command was placed at `components/commands/zz-probe-320.md` and nowhere else, with the
install location not pointed at this checkout. Asked to list every slash command it had whose name
begins with `nxs` or `zz-probe`, a fresh harness session in this working tree answered:

    NONE

Both the moved `nxs.*` commands and the probe were absent. The probe was removed afterwards. The
assumption that a directory outside the loaded set is not loaded therefore holds for `components/`;
if a future harness release changes that, the standing check above reports it and the remedy is a
rename of the directory.

### AC5 — an edit in the new location is what runs

    $ nexus install --from-checkout /home/sameera/projects/nexus
    pointing at checkout: /home/sameera/projects/nexus
    installed 20 component pointer(s) at /tmp/nxs320/config

    $ readlink /tmp/nxs320/config/commands/nxs.epic.md
    /home/sameera/projects/nexus/components/commands/nxs.epic.md

The pointing install derives the checkout's authored tree from the same single definition the move
changed (invariant 5), so it points at `components/` and not at the vacated directory. A line
appended to `components/commands/nxs.epic.md` appeared immediately through the install location,
with no verb run in between.

### AC6 — the repository's own user-owned files are untouched

`.claude/settings.local.json` is byte-identical and still ignored; only the three managed subtrees
moved, as a history-preserving `git mv` (the diff records 20 renames, 0 insertions, 0 deletions).

### AC7 — the duplicate check reports nothing

    $ CLAUDE_CONFIG_DIR=/tmp/nxs320/config nexus version 2>err.txt
    $ wc -c < err.txt
    0

No `2 component sets resolve on one account` defect: there is one set, and the install location's
pointers resolve into it.
