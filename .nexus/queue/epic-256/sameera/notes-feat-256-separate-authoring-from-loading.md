# Story #319 — checkout-pointing install proven on the development machine

Run on 2026-08-27, from this checkout at `/home/sameera/projects/nexus`, with the install
location named by `$CLAUDE_CONFIG_DIR=/tmp/nxs319/config` so the demonstration could not
overwrite the maintainer's real account set while it was still the only working one.

## AC1 — the body that runs is the one in the checkout

    $ nexus install --from-checkout /home/sameera/projects/nexus
    install location: /tmp/nxs319/config ($CLAUDE_CONFIG_DIR)
    pointing at checkout: /home/sameera/projects/nexus
    installed 20 component pointer(s) at /tmp/nxs319/config

    $ readlink /tmp/nxs319/config/commands/nxs.epic.md
    /home/sameera/projects/nexus/.claude/commands/nxs.epic.md

Every one of the 20 entries at the install location is a pointer, and each resolves into the
checkout — so the body offered at the loaded location is, by construction, the checkout's file.

## AC2 — an edit is in effect with no install step in between

A probe line appended to `.claude/commands/nxs.epic.md` in the checkout appeared immediately at
`/tmp/nxs319/config/commands/nxs.epic.md`, with no verb run in between; reverting the checkout
file reverted what the install location offers.

## AC3 — the version verb reports the content and names the checkout

The verb did not report the install location before this story. It does now:

    $ nexus version
    {"version":"0.1.0",
     "componentPayload":"c084d05446…",
     "installLocation":{"path":"/tmp/nxs319/config","source":"environment",
                        "content":"checkout-pointer","checkout":"/home/sameera/projects/nexus/.claude"},
     "python":{"path":"/usr/bin/python3","version":"3.12.3"}}

## AC4 — the duplicate check does not fire

The checkout still carries its own components at `.claude/` while the install location points at
it. `nexus version` ran with both populated and printed nothing on standard error — no
`2 component sets resolve on one account` defect — because the guard compares resolved real paths
and the pointers resolve to the very files the checkout holds.

## AC5

The same read-out is recorded on issue #319 itself, which is what Story #320 AC1 reads.
