#!/usr/bin/env python3
"""Shared delivery-config resolver for the GitHub-publishing skills (epic #121).

Single source of truth (decision-record Invariant 2): both `nxs_gh_create_epic.py` and
`create_gh_issues.py` import `read_delivery_config` from here instead of each carrying a
verbatim copy — the copy-paste drift this epic exists to kill. Kept dependency-free (stdlib
only) so it travels with the vendored `.claude/` component tree and runs on any checkout.

STORY-121.01 is a pure, behavior-preserving extraction: the two functions below are the
former per-script copies, moved unchanged. Later stories layer classification, project-target,
precedence, and write-back onto this same module.
"""

import json
from pathlib import Path


def _parse_simple_yaml(content: str) -> dict[str, dict[str, str]]:
    """Parse the 2-level nested config.yml format without external dependencies."""
    result: dict[str, dict[str, str]] = {}
    current_section: str | None = None
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if not line[0].isspace() and ":" in line:
            key = line.split(":")[0].strip()
            result[key] = {}
            current_section = key
        elif current_section and ":" in line:
            key, _, value = line.partition(":")
            result[current_section][key.strip()] = value.strip()
    return result


def read_delivery_config(project_root: Path) -> dict[str, str]:
    """Read delivery config from settings.yml (canonical), falling back to the legacy
    config.yml / config.json names.

    Returns a normalized dict with keys: docRoot, project, epicType, issuesRepo.
    """
    delivery_dir = project_root / ".nexus" / "config"

    # settings.yml is the committed config file this repo actually writes. config.yml is
    # kept only as a legacy name: prior versions read config.yml (which never existed), so
    # any github: config placed in settings.yml was silently dropped.
    for yml_name in ("settings.yml", "config.yml"):
        yml_path = delivery_dir / yml_name
        if not yml_path.exists():
            continue
        try:
            with open(yml_path, encoding="utf-8") as f:
                raw = _parse_simple_yaml(f.read())
            result: dict[str, str] = {}
            cross_ref = raw.get("cross-ref", {})
            github = raw.get("github", {})
            if cross_ref.get("docs-root"):
                result["docRoot"] = cross_ref["docs-root"]
            if github.get("project"):
                result["project"] = github["project"]
            if github.get("epic-type"):
                result["epicType"] = github["epic-type"]
            if github.get("issues-repo"):
                result["issuesRepo"] = github["issues-repo"]
            # Classification schema (STORY-121.02): mode + per-kind type/label name mappings.
            if github.get("classification"):
                result["classification"] = github["classification"]
            if github.get("epic-label"):
                result["epicLabel"] = github["epic-label"]
            if github.get("story-type"):
                result["storyType"] = github["story-type"]
            if github.get("story-label"):
                result["storyLabel"] = github["story-label"]
            return result
        except OSError:
            pass

    json_path = delivery_dir / "config.json"
    if json_path.exists():
        try:
            with open(json_path, encoding="utf-8") as f:
                data = json.load(f)
            # Support nested github object or flat keys
            if isinstance(data.get("github"), dict):
                if data["github"].get("issues-repo"):
                    data["issuesRepo"] = data["github"]["issues-repo"]
            return data
        except (json.JSONDecodeError, OSError):
            pass

    return {}


# --- Classification mode (STORY-121.02) ----------------------------------------------
#
# The classification decision — types vs. labels vs. today's probe-then-fallback — is declared
# config, resolved here once, so publishing consults intent instead of discovering it through
# GitHub API calls that may fail on a repo with no org issue-types (the epic's trigger).

#: The three modes. `legacy-auto` is the built-in default: it names and preserves today's
#: probe-then-fallback behavior, so a repo with no `github:` block reproduces today's outcome.
CLASSIFICATION_MODES = ("types", "labels", "legacy-auto")
DEFAULT_CLASSIFICATION = "legacy-auto"

#: Built-in label defaults when a mode falls back to a label. The epic default moves from the
#: former generic `enhancement` to `epic` — the epic's single deliberate outcome change, made
#: safe by the ensure-label upsert (`ensure_label`) applied before the label is used.
DEFAULT_EPIC_LABEL = "epic"
DEFAULT_STORY_LABEL = "story"


def resolve_classification(config: dict[str, str]) -> str:
    """Return the classification mode from resolved config: types | labels | legacy-auto.

    An absent or unrecognized value resolves to `legacy-auto` — the behavior-preserving default
    (decision-record: legacy-auto is mandatory and is the built-in when no block is present).
    """
    mode = (config.get("classification") or "").strip().lower()
    return mode if mode in CLASSIFICATION_MODES else DEFAULT_CLASSIFICATION


def resolve_epic_label(config: dict[str, str]) -> str:
    """The label applied to epics in `labels` mode, and used as the `legacy-auto` fallback."""
    return (config.get("epicLabel") or "").strip() or DEFAULT_EPIC_LABEL


def resolve_story_label(config: dict[str, str]) -> str:
    """The label applied to stories outside `types` mode (default `story`, today's behavior)."""
    return (config.get("storyLabel") or "").strip() or DEFAULT_STORY_LABEL


# --- Project V2 target (STORY-121.03) ------------------------------------------------
#
# The Project V2 target is declared config, resolved here once, so a repo with no project can
# say so a single time (`none`) instead of paying an auto-discovery lookup and a false-alarm
# "no project found" warning on every run — the personal-repo case, the epic's trigger. `auto`
# is the built-in default when no block is present: it names and preserves today's discovery.

#: The two reserved keywords. Any other value is an explicit target (`owner/number` or a title).
PROJECT_NONE = "none"
PROJECT_AUTO = "auto"
DEFAULT_PROJECT = PROJECT_AUTO


def resolve_project_target(config: dict[str, str]) -> tuple[str, str | None]:
    """Resolve the Project V2 target into a `(mode, value)` pair.

    `mode` is one of:
      - ``"none"``:     no project lookup, no add-to-project call, no warning — deliberate
                        absence (the personal-repo case with no project at all). `value` is None.
      - ``"auto"``:     today's repository project auto-discovery. `value` is None. This is the
                        built-in default when the key is absent, so a repo with no `github:`
                        block reproduces today's behavior (decision-record Invariant 1).
      - ``"explicit"``: an operator-declared target; `value` is the `owner/number` or project
                        title to add to *exactly*, with no discovery fallback.

    The two keywords are matched case-insensitively; an explicit target keeps its original case,
    since project titles and owner refs are case-sensitive.
    """
    raw = (config.get("project") or "").strip()
    if not raw:
        return (DEFAULT_PROJECT, None)
    keyword = raw.lower()
    if keyword == PROJECT_NONE:
        return (PROJECT_NONE, None)
    if keyword == PROJECT_AUTO:
        return (PROJECT_AUTO, None)
    return ("explicit", raw)


# --- Precedence chain (STORY-121.04) -------------------------------------------------
#
# Every consumer resolves a key through one precedence chain, so the four resolving consumers
# (both creation scripts, `/nxs.epic` via those scripts, and `/nxs.close`) can never disagree
# (decision-record Invariant 3/4). The chain is resolved most-specific-first: the imperative
# invocation-time argument always wins, then per-item frontmatter, then the repo's declared
# settings, then workspace hub defaults, then the built-in default that guarantees a value exists.

#: The precedence order, most-specific first (decision-record Invariant 4). The `hub` layer is the
#: seam workspace-wide defaults plug into (STORY-121.05); STORY-121.04 only establishes the chain,
#: so callers pass `hub=None` until that story wires the manifest in.
PRECEDENCE = ("invocation", "frontmatter", "repo", "hub", "builtin")


def resolve_setting(key, *, invocation=None, frontmatter=None, repo=None, hub=None, builtin=None):
    """Resolve one config key most-specific-first across the precedence chain.

    Layers, highest precedence first (decision-record Invariant 4):
      - ``invocation``  an imperative invocation-time argument (e.g. the ``--project`` flag) — the
                        top override; it is an explicit operator command for this run and must win.
      - ``frontmatter`` per-item intent (the epic/story frontmatter) — overrides a repo default for
                        a one-off.
      - ``repo``        the repo's declared ``.nexus/config/settings.yml`` github block.
      - ``hub``         workspace hub defaults (STORY-121.05 fills this; ``None`` until then).
      - ``builtin``     the built-in default — the last resort that guarantees a value exists.

    Each of ``invocation``/``frontmatter``/``repo``/``hub`` is a mapping (or ``None``/absent). The
    first layer carrying ``key`` with a non-empty value wins; an empty string or a missing key is
    treated as "unset" and falls through. ``builtin`` may be a mapping keyed the same way or a bare
    default value. Returns ``None`` when no layer sets the key and there is no built-in.
    """
    for layer in (invocation, frontmatter, repo, hub):
        if not layer:
            continue
        value = layer.get(key)
        if value not in (None, ""):
            return value
    if isinstance(builtin, dict):
        return builtin.get(key)
    return builtin


def resolve_issues_repo(config, *, frontmatter=None, invocation=None, hub=None):
    """Resolve the target issues repository (an ``owner/repo``) through the shared chain.

    This is the one entry all four consumers use for issues-repo, so ``/nxs.close`` targets the
    same repository the creation scripts filed into (STORY-121.04 AC2/AC3 — the concrete bug this
    precedence work fixes). Returns ``""`` when no layer sets it: an absent issues-repo means "the
    current repo" and, per decision-record Invariant 6, is never pinned to a concrete value.
    """
    return resolve_setting(
        "issuesRepo",
        invocation=invocation,
        frontmatter=frontmatter,
        repo=config,
        hub=hub,
        builtin="",
    )


# --- Shared gh helpers (STORY-121.02) ------------------------------------------------
#
# Issue-type lookup/set and the label upsert are defined once and imported by both creation
# scripts (the epic's own anti-copy-paste thesis, extended past the resolver). Each helper takes
# a `run(cmd) -> CompletedProcess` callable — never raising for a failed command — so a caller
# supplies its own subprocess runner and the helper stays decoupled from each script's error
# model. `repo` (an `owner/repo`) targets a non-current repository via `-R`.


def _resolve_owner_repo(run, repo: str | None) -> tuple[str, str] | None:
    """Split `repo` into (owner, name), or ask gh for the current repo's nameWithOwner."""
    if repo and "/" in repo:
        owner, name = repo.split("/", 1)
        return owner, name
    result = run(["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"])
    if result.returncode != 0:
        return None
    name_with_owner = result.stdout.strip()
    if "/" not in name_with_owner:
        return None
    owner, name = name_with_owner.split("/", 1)
    return owner, name


def lookup_issue_type_id(type_name: str, run, repo: str | None = None) -> str | None:
    """Return the GraphQL node id for a named issue type in `repo` (current repo if None).

    Returns None if the type is not found, the repo has no issue-types feature, or the query
    fails. `repo` targets the repository the issue is (or will be) filed in — so type lookup
    hits the same repo as creation, not whatever the current directory happens to be.
    """
    resolved = _resolve_owner_repo(run, repo)
    if resolved is None:
        return None
    owner, name = resolved
    query = """
    query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
            issueTypes(first: 50) {
                nodes { id name }
            }
        }
    }
    """
    result = run([
        "gh", "api", "graphql",
        "-f", f"query={query}",
        "-f", f"owner={owner}",
        "-f", f"repo={name}",
    ])
    if result.returncode != 0:
        return None
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None
    # Repos without the issue-types feature return "issueTypes": null — .get(default) does not
    # apply the default to an explicit null, so coalesce with `or`.
    repository = (data.get("data") or {}).get("repository") or {}
    nodes = (repository.get("issueTypes") or {}).get("nodes") or []
    for node in nodes:
        if node.get("name", "").lower() == type_name.lower():
            return node.get("id")
    return None


def set_issue_type(issue_id: str, type_id: str, run) -> bool:
    """Set the issue type on an issue via the updateIssue GraphQL mutation. Returns success."""
    mutation = """
    mutation($issueId: ID!, $typeId: ID!) {
        updateIssue(input: {id: $issueId, issueTypeId: $typeId}) {
            issue { number issueType { name } }
        }
    }
    """
    result = run([
        "gh", "api", "graphql",
        "-f", f"query={mutation}",
        "-f", f"issueId={issue_id}",
        "-f", f"typeId={type_id}",
    ])
    return result.returncode == 0


def ensure_label(
    name: str,
    run,
    repo: str | None = None,
    color: str = "EDEDED",
    description: str = "",
) -> bool:
    """Idempotently upsert a label via `gh label create --force` before it is applied.

    Mirrors the story-label step (`create_gh_issues.py`): `--force` makes re-runs harmless, so
    filing never fails on a missing label (decision-record Invariant 8). Returns True on success;
    a failure is non-fatal (the label may already exist, or the token may lack label scope) and
    the caller decides whether to warn.
    """
    cmd = ["gh", "label", "create", name, "--color", color, "--description", description, "--force"]
    if repo:
        cmd.extend(["-R", repo])
    return run(cmd).returncode == 0


# --- Read-only resolve CLI (STORY-121.04) --------------------------------------------
#
# The non-script consumers — `/nxs.close`, and any future markdown command — obtain a resolved
# value by invoking this CLI, never by parsing settings.yml themselves (decision-record Invariant
# 2). `/nxs.close` calls `resolve issues-repo` to target the configured issues-repo when it
# comments on and closes the epic issue (AC2). The keys are the github-block names as written in
# settings.yml (e.g. `issues-repo`), mapped to the normalized keys `read_delivery_config` returns.

#: github-block key (as written in settings.yml) → the normalized key `read_delivery_config` emits.
_GITHUB_KEY_TO_NORMALIZED = {
    "issues-repo": "issuesRepo",
    "project": "project",
    "epic-type": "epicType",
    "epic-label": "epicLabel",
    "story-type": "storyType",
    "story-label": "storyLabel",
    "classification": "classification",
}


def _find_config_root(start: Path) -> Path:
    """Walk up from `start` to the nearest ancestor holding a `.nexus/config` dir.

    Keyed to the config dir (not `.git`/`CLAUDE.md`) so a checkout with no config resolves to
    `start` and reads as empty, rather than climbing into an unrelated repo above a temp dir.
    """
    current = start.resolve()
    while current != current.parent:
        if (current / ".nexus" / "config").is_dir():
            return current
        current = current.parent
    return start.resolve()


def _cli(argv):
    import argparse

    parser = argparse.ArgumentParser(prog="delivery_config", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    resolve_cmd = sub.add_parser(
        "resolve", help="Resolve one github-block key through the shared precedence chain."
    )
    resolve_cmd.add_argument("key", help="github-block key as written in settings.yml, e.g. issues-repo")
    resolve_cmd.add_argument(
        "--root", default=".", help="Repo/worktree root to resolve config from (default: cwd)."
    )
    args = parser.parse_args(argv)

    if args.command == "resolve":
        root = _find_config_root(Path(args.root))
        config = read_delivery_config(root)
        normalized = _GITHUB_KEY_TO_NORMALIZED.get(args.key, args.key)
        value = resolve_setting(normalized, repo=config)
        print(value if value else "")
        return 0
    return 1


if __name__ == "__main__":
    import sys as _sys

    raise SystemExit(_cli(_sys.argv[1:]))
