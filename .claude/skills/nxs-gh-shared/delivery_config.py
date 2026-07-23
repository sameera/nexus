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
import shutil
import subprocess
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
            # Repo-targeting keys (STORY-121.05): the specific epic-repo/story-repo win over the
            # general issues-repo, which stays the fallback for whichever is unspecified.
            if github.get("epic-repo"):
                result["epicRepo"] = github["epic-repo"]
            if github.get("story-repo"):
                result["storyRepo"] = github["story-repo"]
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


def resolve_epic_repo(config, *, frontmatter=None, invocation=None, hub=None):
    """Resolve the repository the *epic* issue is filed into (STORY-121.05).

    The specific ``epic-repo`` wins over the general ``issues-repo``, which is the fallback for
    whichever is unspecified (decision-record Invariant 9). Each is resolved through the same
    precedence chain, so a member inherits the hub's epic-repo when it declares none — which is
    how the no-primary-code-repo case files the epic into the hub (AC3). Returns ``""`` when
    neither key is set anywhere: an absent target means "the current repo" and is never pinned.
    """
    specific = resolve_setting(
        "epicRepo", invocation=invocation, frontmatter=frontmatter, repo=config, hub=hub
    )
    if specific:
        return specific
    return resolve_issues_repo(config, frontmatter=frontmatter, invocation=invocation, hub=hub)


def resolve_story_repo(config, *, frontmatter=None, invocation=None, hub=None):
    """Resolve the repository *story* issues are filed into (STORY-121.05).

    Mirrors ``resolve_epic_repo``: the specific ``story-repo`` wins over the general
    ``issues-repo`` fallback, resolved through the shared chain (decision-record Invariant 9).
    """
    specific = resolve_setting(
        "storyRepo", invocation=invocation, frontmatter=frontmatter, repo=config, hub=hub
    )
    if specific:
        return specific
    return resolve_issues_repo(config, frontmatter=frontmatter, invocation=invocation, hub=hub)


# --- Workspace hub defaults (STORY-121.05) -------------------------------------------
#
# The `hub` layer of the precedence chain is workspace-wide github defaults declared in the hub
# manifest (`<hub>/.nexus/config/workspace.yml`). That manifest is owned by the TypeScript
# workspace resolver — the single source of workspace truth — so Python never parses it directly:
# it shells out to the `workspace github-defaults` CLI verb, which resolves the workspace from any
# checkout (a member finds its hub) and prints the hub's github block as JSON. The call is guarded
# so a single-repo checkout (no workspace artifact) never spawns node — today's common case pays
# nothing.


def _read_pointer_hub_name(hub_yml: Path) -> str | None:
    """Read the hub's bare sibling-directory name from a member's `hub.yml` pointer."""
    try:
        parsed = _parse_simple_yaml(hub_yml.read_text(encoding="utf-8"))
    except OSError:
        return None
    return (parsed.get("hub", {}) or {}).get("name") or None


def _workspace_cli_command(project_root: Path) -> list[str] | None:
    """Build the argv that emits `workspace github-defaults`, or None when no CLI is available.

    Uses the portable vendored `nexus.mjs` on a bare `node` — either this checkout's own
    (`.nexus/tools/nexus.mjs`, a hub) or the hub's, located as the sibling named by a member's
    `hub.yml`. Returns None when node or a bundle cannot be found, so the caller degrades to "no
    hub defaults" rather than failing.
    """
    node = shutil.which("node")
    if not node:
        return None
    candidates = [project_root / ".nexus" / "tools" / "nexus.mjs"]
    hub_yml = project_root / ".nexus" / "config" / "hub.yml"
    if hub_yml.exists():
        hub_name = _read_pointer_hub_name(hub_yml)
        if hub_name:
            candidates.append(project_root.parent / hub_name / ".nexus" / "tools" / "nexus.mjs")
    for mjs in candidates:
        if mjs.exists():
            return [node, str(mjs), "workspace", "github-defaults"]
    return None


def _normalize_hub_defaults(raw: str) -> dict[str, str]:
    """Map the CLI's JSON github-block (github-key → value) onto the normalized resolver keys.

    Tolerant by design: non-JSON, a non-object, or unknown keys yield an empty/partial dict — the
    hub layer is best-effort and must never raise into the issue-creation path.
    """
    try:
        data = json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {}
    if not isinstance(data, dict):
        return {}
    result: dict[str, str] = {}
    for github_key, value in data.items():
        normalized = _GITHUB_KEY_TO_NORMALIZED.get(github_key)
        if normalized and isinstance(value, str) and value.strip():
            result[normalized] = value.strip()
    return result


def read_hub_defaults(project_root: Path, run=None) -> dict[str, str]:
    """Resolve workspace-wide github defaults for the `hub` precedence layer (STORY-121.05).

    Guarded and best-effort: returns ``{}`` (spawning nothing) when the checkout declares no
    workspace artifact — the single-repo common case. Otherwise it invokes the `workspace
    github-defaults` CLI verb (cwd = ``project_root``) and normalizes its JSON. Any failure —
    no CLI, a non-zero exit, unparseable output — yields ``{}``, so the hub layer can never break
    publishing. ``run`` is an injectable ``(cmd) -> CompletedProcess`` for tests.
    """
    config_dir = project_root / ".nexus" / "config"
    if not (config_dir / "hub.yml").exists() and not (config_dir / "workspace.yml").exists():
        return {}
    cmd = _workspace_cli_command(project_root)
    if cmd is None:
        return {}
    if run is None:
        def run(command):  # noqa: E731 — default runner binds cwd to the checkout
            return subprocess.run(command, cwd=str(project_root), capture_output=True, text=True)
    try:
        result = run(cmd)
    except OSError:
        return {}
    return _normalize_hub_defaults(getattr(result, "stdout", "") or "")


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


def repo_has_issue_types(run, repo: str | None = None) -> bool | None:
    """Whether `repo` (current repo if None) exposes usable GitHub issue-types (STORY-121.06).

    The setup-time probe that decides the seeded classification mode: `types` when the repo/org
    exposes issue-types, else `labels`. Returns True when the issue-types feature is present AND at
    least one type is defined (there is something to apply), False when the feature is absent
    (`issueTypes: null`) or no types are defined, and None when the probe cannot run (gh
    unavailable, auth, network) — the signal setup uses to fall back to safe defaults (AC3).
    """
    resolved = _resolve_owner_repo(run, repo)
    if resolved is None:
        return None
    owner, name = resolved
    query = """
    query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
            issueTypes(first: 1) { nodes { id } }
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
    repository = (data.get("data") or {}).get("repository") or {}
    issue_types = repository.get("issueTypes")
    if issue_types is None:  # feature not available on this repo/org
        return False
    return len(issue_types.get("nodes") or []) > 0


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


# --- Surgical settings.yml writer (STORY-121.06 / STORY-121.07) ----------------------
#
# The single, add-only merge that persists resolved publishing decisions into the repo's
# settings.yml — shared by /nxs.setup seeding (a human present) and runtime write-back (the
# unattended safety net), so the two producers can never drift. Stdlib-only, matching the
# scripts' "runs on any checkout" posture: it is a bounded line-oriented merge over the shallow
# 2-level format, never a full YAML round-trip. It ONLY adds keys that are absent — a declared
# key (including an explicit `auto`/`none`) is never rewritten (decision-record Invariants 5,
# 10) — and it never writes an empty value, so an absent issues-repo is never pinned (Invariant
# 6). Everything outside the touched keys — the `cross-ref:` block, comments, ordering — is
# preserved byte-for-byte.

#: normalized resolver key → github-block key (as written in settings.yml); the inverse of the
#: map the resolve CLI uses, so callers may pass either spelling to the writer.
_NORMALIZED_TO_GITHUB_KEY = {v: k for k, v in {
    "issues-repo": "issuesRepo",
    "project": "project",
    "epic-type": "epicType",
    "epic-label": "epicLabel",
    "story-type": "storyType",
    "story-label": "storyLabel",
    "classification": "classification",
    "epic-repo": "epicRepo",
    "story-repo": "storyRepo",
}.items()}


def _github_key(key: str) -> str:
    """Accept either a github-block key (`epic-repo`) or a normalized key (`epicRepo`)."""
    return _NORMALIZED_TO_GITHUB_KEY.get(key, key)


def _is_top_level_line(line: str) -> bool:
    """True for a `key:`-style line at column 0 (a top-level YAML key, not an indented child)."""
    return bool(line) and not line[0].isspace() and not line.lstrip().startswith("#") and ":" in line


def write_github_block(project_root, values, *, comment=None):
    """Ensure each github-block key in `values` exists in settings.yml, adding only absent keys.

    `values` is keyed by github-block names (`classification`, `project`, `issues-repo`,
    `epic-repo`, `story-repo`, …) or their normalized equivalents; empty/None values are skipped.
    The merge preserves every other section, comment, and byte, and never overwrites a key already
    present in the `github:` block. `comment`, when a fresh block is created, is written as a
    `# <comment>` line above it (setup uses this to record a gh-unavailable fallback).

    Returns ``{"added": [github-keys…], "path": <settings.yml path>}``; ``added`` is empty (and the
    file is left untouched) when every requested key is already present or every value is empty.
    """
    project_root = Path(project_root)
    path = project_root / ".nexus" / "config" / "settings.yml"

    # Normalize requested keys to github-block spelling, dropping empties (never pin an empty).
    wanted: dict[str, str] = {}
    for raw_key, raw_value in values.items():
        value = (raw_value or "").strip() if isinstance(raw_value, str) else raw_value
        if value:
            wanted[_github_key(raw_key)] = value

    text = path.read_text(encoding="utf-8") if path.exists() else ""
    lines = text.split("\n")

    # Locate the top-level `github:` header, if any.
    github_idx = next(
        (i for i, line in enumerate(lines) if _is_top_level_line(line) and line.split(":", 1)[0].strip() == "github"),
        None,
    )

    added: list[str] = []

    if github_idx is None:
        # No block yet — append a fresh one, preserving everything above byte-for-byte.
        to_add = [(k, v) for k, v in wanted.items()]
        if not to_add:
            return {"added": [], "path": str(path)}
        block: list[str] = []
        if comment:
            block.append(f"# {comment}")
        block.append("github:")
        for k, v in to_add:
            block.append(f"  {k}: {v}")
            added.append(k)
        body = text
        if body and not body.endswith("\n"):
            body += "\n"
        # A blank separator before the new block when the file already had content.
        prefix = "\n" if body.strip() else ""
        new_text = body + prefix + "\n".join(block) + "\n"
    else:
        # Existing block — find its child extent and the keys already present.
        end = next(
            (j for j in range(github_idx + 1, len(lines)) if _is_top_level_line(lines[j])),
            len(lines),
        )
        existing_keys = set()
        last_child = github_idx  # insert after this index (grows to the last child line)
        for j in range(github_idx + 1, end):
            stripped = lines[j].strip()
            if not stripped or stripped.startswith("#"):
                continue
            if ":" in lines[j] and lines[j][0].isspace():
                existing_keys.add(lines[j].split(":", 1)[0].strip())
                last_child = j
        insert_lines = []
        for k, v in wanted.items():
            if k not in existing_keys:
                insert_lines.append(f"  {k}: {v}")
                added.append(k)
        if not added:
            return {"added": [], "path": str(path)}
        lines[last_child + 1 : last_child + 1] = insert_lines
        new_text = "\n".join(lines)

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(new_text, encoding="utf-8")
    return {"added": added, "path": str(path)}


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
    "epic-repo": "epicRepo",
    "story-repo": "storyRepo",
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

    # STORY-121.06: the two commands /nxs.setup uses to seed the github block at bootstrap.
    detect_cmd = sub.add_parser(
        "detect-classification",
        help="Probe whether the repo exposes issue-types; print types | labels | unavailable.",
    )
    detect_cmd.add_argument("--root", default=".", help="Repo root (informational; probe uses gh in cwd).")

    write_cmd = sub.add_parser(
        "write-github",
        help="Surgically seed absent github-block keys into settings.yml (add-only).",
    )
    write_cmd.add_argument("--root", default=".", help="Repo root whose .nexus/config/settings.yml to seed.")
    write_cmd.add_argument("--classification")
    write_cmd.add_argument("--project")
    write_cmd.add_argument("--issues-repo", dest="issues_repo")
    write_cmd.add_argument("--epic-repo", dest="epic_repo")
    write_cmd.add_argument("--story-repo", dest="story_repo")
    write_cmd.add_argument("--comment", help="Comment written above a freshly created block (e.g. a fallback note).")

    args = parser.parse_args(argv)

    if args.command == "resolve":
        root = _find_config_root(Path(args.root))
        config = read_delivery_config(root)
        # The hub layer (workspace-wide defaults) participates for every key, so a non-script
        # consumer like /nxs.close resolves identically to the creation scripts (Invariant 3).
        hub = read_hub_defaults(root)
        if args.key == "epic-repo":
            value = resolve_epic_repo(config, hub=hub)
        elif args.key == "story-repo":
            value = resolve_story_repo(config, hub=hub)
        else:
            normalized = _GITHUB_KEY_TO_NORMALIZED.get(args.key, args.key)
            value = resolve_setting(normalized, repo=config, hub=hub)
        print(value if value else "")
        return 0

    if args.command == "detect-classification":
        import subprocess as _subprocess

        def _run(cmd):
            return _subprocess.run(cmd, capture_output=True, text=True)

        try:
            has_types = repo_has_issue_types(_run)
        except OSError:
            has_types = None  # gh not installed — degrade, never crash (AC3)
        print("unavailable" if has_types is None else ("types" if has_types else "labels"))
        return 0

    if args.command == "write-github":
        # Target the given root directly (do NOT walk up): setup seeds THIS repo's settings.yml,
        # creating .nexus/config if needed. Add-only; a declared key is never overwritten.
        values = {
            "classification": args.classification,
            "project": args.project,
            "issues-repo": args.issues_repo,
            "epic-repo": args.epic_repo,
            "story-repo": args.story_repo,
        }
        report = write_github_block(Path(args.root), values, comment=args.comment)
        if report["added"]:
            print(f"Seeded github block ({', '.join(report['added'])}) into {report['path']}")
        else:
            print(f"No changes — every requested key is already declared in {report['path']}")
        return 0

    return 1


if __name__ == "__main__":
    import sys as _sys

    raise SystemExit(_cli(_sys.argv[1:]))
