"""The release identity, as the Python half reads it (story #305).

The declaration is a single `VERSION` file at the release root, shared with the TypeScript
executable — the two halves ship as one artifact and cannot be at different versions, so this
module carries no version literal and reads that one file instead. The lookup walks up from this
module's own position, which finds the repository root in a source checkout and the package root
in a distributable without either layout being written down anywhere.

An unresolved declaration is `None`, never a guessed default: an absent version is something a
reader already treats as "written by an unknown toolkit", while a fabricated one is a lie.
"""

from pathlib import Path

#: The file that carries the one declaration, at the release root.
RELEASE_VERSION_FILE = "VERSION"


def resolve_release_version(start_dir: Path) -> str | None:
    """The nearest declaration at or above `start_dir`, or None when there is none."""
    current = Path(start_dir).resolve()
    for candidate_dir in (current, *current.parents):
        candidate = candidate_dir / RELEASE_VERSION_FILE
        if candidate.is_file():
            declared = candidate.read_text(encoding="utf-8").strip()
            return declared or None
    return None


def release_version() -> str | None:
    """The release this toolkit is part of, resolved from where this module itself sits."""
    return resolve_release_version(Path(__file__).resolve().parent)
