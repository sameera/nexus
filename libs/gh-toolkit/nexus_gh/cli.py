#!/usr/bin/env python3
"""The capability dispatcher for the named Python toolkit (story #297).

Nexus keeps two toolkits. The TypeScript half answers to `nexus`; this is the other half —
three capabilities that a component body reaches by naming `nexus-gh` and a capability,
never by encoding a path to a script. The dispatcher is the whole of that name: it maps a
capability name onto the module that already implements it and hands the remaining
arguments through untouched, so every capability's flags, output and exit code are the ones
it had when it was invoked as a file.

    nexus-gh version                           the release this toolkit is part of
    nexus-gh config <delivery_config args>     the shared delivery-configuration resolver
    nexus-gh create-epic <epic args>           the epic filer
    nexus-gh create-story <story args>         the story filer

The literal `nexus-gh` is fixed by story #297 and is the same string #250 writes into
component bodies and #252 declares in the package manifest.
"""

import json
import sys
from collections.abc import Callable

TOOLKIT_NAME = "nexus-gh"


def _version(argv: list[str]) -> int:
    """Report the release, as one JSON object on standard output — the verb contract both
    toolkits keep. The version is the release's single declaration, never a literal here."""
    from .release import release_version

    if argv and argv[0] in ("-h", "--help"):
        print(f"usage: {TOOLKIT_NAME} version")
        print()
        print("Print the release this toolkit is part of, as one JSON object.")
        return 0
    if argv:
        print(f"usage: {TOOLKIT_NAME} version", file=sys.stderr)
        print(f"{TOOLKIT_NAME} version: unexpected argument '{argv[0]}'", file=sys.stderr)
        return 2
    print(json.dumps({"version": release_version()}))
    return 0


def _config(argv: list[str]) -> int:
    from .delivery_config import _cli

    return _as_exit_code(lambda: _cli(argv))


def _create_epic(argv: list[str]) -> int:
    from . import create_epic

    return _as_exit_code(lambda: create_epic.main(argv))


def _create_story(argv: list[str]) -> int:
    from . import create_story

    return _as_exit_code(lambda: create_story.main(argv))


# Capability name → the function that runs it. A capability cannot exist without a row here,
# because the usage text listing the available names is rendered from this same mapping.
CAPABILITIES: dict[str, tuple[str, Callable[[list[str]], int]]] = {
    "version": ("Report the release this toolkit is part of.", _version),
    "config": ("Resolve delivery configuration (the shared publishing resolver).", _config),
    "create-epic": ("File a GitHub issue from an epic document.", _create_epic),
    "create-story": ("File one GitHub issue per STORY-*.md work item.", _create_story),
}


def _as_exit_code(entry) -> int:
    """Run a capability's `main` and normalize how it reports its exit status.

    The filers predate the dispatcher and report failure in two different ways — one returns a
    code, the other raises `SystemExit`. Both are honoured here so neither capability's exit
    code changes now that it is reached by name.
    """
    try:
        result = entry()
    except SystemExit as exc:
        code = exc.code
        if code is None:
            return 0
        return code if isinstance(code, int) else 1
    return 0 if result is None else int(result)


def capability_listing() -> str:
    """The declared capability names, shaped for a machine reader.

    The build gate that checks component invocations (story #301) must read this toolkit's
    declared surface from the surface itself. The human diagnostic `usage()` is prose — its
    wording is free to change — so scraping it would make every rewording a gate break. This is
    the second answer beside it: a JSON object carrying names and nothing a reader would reword.
    """
    return json.dumps({"capabilities": sorted(CAPABILITIES)})


def usage() -> str:
    lines = [
        f"usage: {TOOLKIT_NAME} <capability> [args...]",
        "",
        "capabilities:",
    ]
    width = max(len(name) for name in CAPABILITIES)
    for name, (summary, _) in CAPABILITIES.items():
        lines.append(f"  {name.ljust(width)}  {summary}")
    lines.append("")
    lines.append(f"Run `{TOOLKIT_NAME} <capability> --help` for a capability's own arguments.")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    """Dispatch `argv` to a capability. No capability, or an unknown one, is an error."""
    if argv and argv[0] == "--capabilities":
        print(capability_listing())
        return 0
    if not argv or argv[0] in ("-h", "--help"):
        stream = sys.stdout if argv else sys.stderr
        print(usage(), file=stream)
        return 0 if argv else 2
    name = argv[0]
    entry = CAPABILITIES.get(name)
    if entry is None:
        print(f"{TOOLKIT_NAME}: unknown capability '{name}'", file=sys.stderr)
        print(usage(), file=sys.stderr)
        return 2
    rest = argv[1:]
    # The capability's arguments travel as `rest`, handed to its own parser — the one channel.
    # `sys.argv[0]` is still set because argparse derives its `prog` from it: it is what makes a
    # capability's usage and error text read `nexus-gh create-epic`, the name the caller used.
    # It carries the program name only, never the arguments.
    saved = sys.argv
    sys.argv = [f"{TOOLKIT_NAME} {name}", *rest]
    try:
        return entry[1](rest)
    finally:
        sys.argv = saved
