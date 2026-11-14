---
title: "Release Template Lookup"
aliases: ["template lookup", "release template set", "travelling copy", "templates from the installed release", "no repository template copy", "template request"]
touches: ["nexus-setup-cli", "shipped-payload", "install-location", "pointing-install", "checkout-only-path-gate", "decision-record"]
last_updated_by: "#1028"
status: active
verification: verified
---

# Release Template Lookup

A stage that needs a template asks the installed release for it by name and is told where it lives. The answer comes from the release or from the checkout a maintainer's install points at, and never from the repository the stage runs in. A repository needs no template files of its own, and a template change reaches every repository with the next release.

## How It Works

The release template set is declared once: the decision-record template, its old-format template and the standards template. That one list decides what the release build packs and which names the lookup answers to.

On an ordinary install the answer is the copy that ships beside the running executable. That executable also holds the checks that validate a drafted record, so a template and its validator always come from the same release. When the install location points at a checkout, the answer is that checkout's template, so a maintainer's edit is live on the next request with no rebuild.

The lookup takes only a name and reads nothing from the repository. An unknown name fails and lists every name the release ships. A missing template or an unreadable install location fails and names the cause. Nothing falls back to another source.

The decision-record stage and setup both stop when the lookup fails or prints nothing.

## Key Invariants

1. The lookup never returns a location inside the current repository, even when the repository holds its own template folder.
2. An ordinary install answers from the copy inside the running release; a pointer install answers from the checkout the pointers name.
3. An unknown name exits non-zero and names every template the release ships.
4. A missing template or an unreadable install location exits non-zero naming the cause; nothing falls back to another source.
5. A stage stops, rather than drafting, when the lookup exits non-zero or prints nothing.
6. The release template set is declared once, and the release build fails when a shipped stage asks for a name outside it.
7. A template folder a repository already holds is left in place and is no longer read.

## Integration Points

- [nexus-setup-cli](nexus-setup-cli.md) — hosts the lookup verb, and keeps the old seeding verb only as a refusal that points here.
- [shipped-payload](shipped-payload.md) — carries the release template set beside the executable, which is the copy an ordinary install answers from.
- [install-location](install-location.md) — the lookup reads it to choose its source, and refuses when it cannot be read.
- [pointing-install](pointing-install.md) — when the install location holds pointers, the lookup answers from the checkout they name.
- [checkout-only-path-gate](checkout-only-path-gate.md) — the build-time check that refuses a shipped stage asking for an unshipped name or reading a repository copy.
- [decision-record](decision-record.md) — the stage drafts every record from a template this lookup returns, old-format revisions included.

## Decision Log

### 2026-11-14 — #1028 — Stages read templates from the installed release, never from a repository copy

Every repository held its own copy of the stage templates, and a copy seeded before a template changed kept the old shape, so the decision-record stage had to detect the stale copy and the lead had to reseed. The stages now ask the installed release by name. Outside a maintainer install the answer is the copy that already ships beside the running executable, so each template and the checks that validate a drafted record stay at one version and the release needs no new file. A maintainer's pointer install answers from its checkout, so a template edit is live without a rebuild, the same way components already are. The lookup reads no repository state, so it cannot return a repository copy, and it refuses rather than falls back. Refuted: copying the templates into the account install location beside the components. That adds a second copy which install, removal, migration and the duplicate diagnostic must each manage, and which goes stale whenever install is not re-run, repeating one level up the drift this work removes.
