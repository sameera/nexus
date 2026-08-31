# Story #394 — live acceptance-harness run

Decision record #400 adds an acceptance criterion to this story: one live
acceptance-harness run against the executable, in a scratch repository, with its
result recorded before the story closes. This is that record.

**Result: not run — blocked at preflight, on credentials.**

    $ tsx libs/pr-acceptance/src/cli.ts preflight
    pr-acceptance missing-delete-scope: the authenticated credential for "sameera"
    does not report the `delete_repo` scope, so teardown could not delete the
    scratch repo this would create.

The harness refuses to provision anything it could not tear down, so the run
cannot start until the credential carries `delete_repo`. Granting that scope and
provisioning a real repository on the account are both outward-facing actions, so
they are the maintainer's to take, not something taken unattended inside this
implementation run.

**What is done here:** the harness itself is cut over. `seedScenario` now drives
`create-epic` and `create-story` through the executable in the documented
source-run shape (`tsx …/nexus-cli.ts <verb>`), the same shape the range helper
already uses, instead of spawning an interpreter against
`libs/gh-toolkit/bin/nexus-gh`. So when the run does happen it exercises the
ported filers rather than the superseded implementation.

**What is still owed, and why it matters:** every green harness result since the
three port epics landed exercised the Python implementation, so the ported filers
have no end-to-end evidence behind them. Story #392 deletes that implementation,
after which there is nothing left to compare against. Run this before cutting the
release:

    gh auth refresh -h github.com -s delete_repo
    HARNESS="tsx $(git rev-parse --show-toplevel)/libs/pr-acceptance/src/cli.ts"
    # then follow docs/features/pr-driven-delivery/live-acceptance-runbook.md
