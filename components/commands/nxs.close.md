---
name: nxs.close
description: Relay to `nexus close`, the plain command that closes an epic over its merged pull requests. Runs only when its arguments name the epic — `--epic <N>`, a bare `<N>`, or `--pr <ref>`, which close resolves to its epic; otherwise it refuses at once and names `nexus close --epic <N>`. Given one, it runs `nexus close` with the same arguments, shows its output unchanged, and ends by naming `nexus close` as the command to call directly next time. `nexus close` runs no model and asks nothing; it writes the close record and the close comment from the pull requests' verdicts, or stops with a reason and a remedy. This relay never interprets, retries or fixes a stop. Its recovery section names `nexus close --recover <epic>`, which re-stamps a closed epic whose decision record was revised.
category: engineering
tools: Bash
model: inherit
---

# Role

Relay one close to `nexus close`. Close is now a plain command: it runs no model and asks
nothing. Everything it used to ask must already be on the pull requests and recorded by
`/nxs.analyze --pr <N>` before it runs. This document only passes the lead's arguments through
and shows the result.

# User Input

```text
$ARGUMENTS
```

# Step 1 — Refuse without an epic

**Close needs the epic it closes.** `$ARGUMENTS` names it in one of three ways: `--epic <N>`, a
bare issue number `<N>`, or `--pr <ref>` (a number, `owner/repo#N` or a pull-request URL), which
close resolves to its epic. If `$ARGUMENTS` contains none of them, refuse now — before running any
command, reading any file or touching any issue — with exactly this, and stop:

```
/nxs.close needs the epic to close. Close it with
nexus close --epic <N>.
```

Do not check the value or resolve anything yourself. `nexus close` refuses a malformed value
with its own message.

# Step 2 — Run `nexus close` with the same arguments

Run this once, from the current checkout, passing the arguments in `$ARGUMENTS` through as the lead
gave them (`--epic <N>`, a bare `<N>` or `--pr <ref>`, an optional entry path, an optional
`--handoff <path>`). Change nothing but the quoting below:

```bash
nexus close $ARGUMENTS
```

Quote each value that holds `#` or `?`, such as `'#159'`,
`--pr 'owner/repo#704'` or a pull-request URL: unquoted, the shell reads `#159` as a comment and
drops it, and may read the others as a pattern.

Show its complete output to the lead **unchanged**, whatever its exit status.

- Do not interpret a stop. Its reason, the item concerned and its remedy are already in the output.
- Do not retry it, and do not run a remedy it names. The lead decides what to do next.
- Do not fix anything, write any file or touch any issue yourself.

# Step 3 — Name the direct command

End with this one line, after the output, whether close finished or stopped:

    Next time, run `nexus close $ARGUMENTS` directly; /nxs.close only relays to it.

Write `$ARGUMENTS` in that line quoted as Step 2 ran it, so the line can be pasted into a shell.

# Recovery — re-stamp a closed entry whose record was revised after close

This is the section `/nxs.distill` names when a drain is blocked because the decision record was
revised after close, so the stamped `record_hash` no longer matches the record body. The remedy is
the recovery mode of the close command, run by the lead directly:

`nexus close --recover <epic>`

- The record must be approved again first (its sub-issue closed as completed). Recovery stops on an
  open record.
- Each merged pull request of the epic needs either a verdict judged against the new revision (run
  `/nxs.analyze --pr <N>` on it) or a trusted waiver comment on it accepting the revision. Recovery
  stops and names both remedies for each pull request that has neither.
- Recovery re-stamps `record_hash` and `analyze:`, takes the record's decisions from the new body,
  commits the entry and posts a fresh close comment. It files nothing, amends nothing, and does not
  reopen the epic issue. Then follow the `NEXT` line it prints to re-run `/nxs.distill`.

# Usage

```
/nxs.close                          # refused: names nexus close --epic <N>
/nxs.close --epic 159               # runs: nexus close --epic 159
/nxs.close 159                      # runs: nexus close 159
/nxs.close --pr 123                 # runs: nexus close --pr 123
/nxs.close --pr 'owner/repo#704'    # runs: nexus close --pr 'owner/repo#704'
/nxs.close --pr 123 path/to/epic.md # runs: nexus close --pr 123 path/to/epic.md (the path must link that pull request's epic)
```
