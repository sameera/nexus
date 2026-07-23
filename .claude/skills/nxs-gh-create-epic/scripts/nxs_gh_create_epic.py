#!/usr/bin/env python3
"""
nxs_gh_create_epic.py

Creates a GitHub issue from an Epic document, adds it to a GitHub project,
and updates its frontmatter with the issue link.

Usage: python nxs_gh_create_epic.py [--project "<project-name>"] <path-to-epic.md>

Prerequisites:
    - GitHub CLI (gh) must be installed and authenticated
    - For project integration: gh auth login --scopes 'project'
    - Must be run from within a git repository connected to GitHub
"""

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# The config resolver and shared gh helpers are defined once, in the shared module beside these
# skills, and imported here — never re-copied (epic #121, decision-record Invariant 2). The path
# is relative to this file so it resolves both in-repo and inside the vendored `.claude/` tree.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "nxs-gh-shared"))
from delivery_config import (  # noqa: E402
    ensure_label,
    lookup_issue_type_id,
    read_delivery_config,
    resolve_classification,
    resolve_epic_label,
    resolve_issues_repo,
    resolve_project_target,
    resolve_setting,
    set_issue_type,
)


class Colors:
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[1;33m"
    NC = "\033[0m"  # No Color


def error(msg: str) -> None:
    print(f"{Colors.RED}❌ {msg}{Colors.NC}", file=sys.stderr)


def success(msg: str) -> None:
    print(f"{Colors.GREEN}✅ {msg}{Colors.NC}")


def warn(msg: str) -> None:
    print(f"{Colors.YELLOW}⚠️  {msg}{Colors.NC}")


def run_command(cmd: list[str], capture_output: bool = True) -> subprocess.CompletedProcess:
    """Run a command and return the result."""
    return subprocess.run(cmd, capture_output=capture_output, text=True)


def check_prerequisites() -> bool:
    """Verify gh CLI is installed, authenticated, and we're in a git repo."""
    # Check for gh CLI
    if not shutil.which("gh"):
        error("GitHub CLI (gh) is not installed")
        print("Install with: brew install gh (macOS) or see https://cli.github.com")
        return False

    # Check gh authentication
    result = run_command(["gh", "auth", "status"])
    if result.returncode != 0:
        error("Not authenticated with GitHub CLI")
        print("Run: gh auth login")
        return False

    # Check if in a git repository
    result = run_command(["git", "rev-parse", "--is-inside-work-tree"])
    if result.returncode != 0:
        error("Not in a git repository")
        return False

    return True


def parse_frontmatter(content: str) -> tuple[dict[str, str], str]:
    """
    Parse YAML frontmatter from markdown content.
    Returns (frontmatter_dict, body_content).
    """
    frontmatter_pattern = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)
    match = frontmatter_pattern.match(content)

    if not match:
        return {}, content

    frontmatter_text = match.group(1)
    body = content[match.end():]

    # Simple YAML parsing for key: value pairs
    frontmatter = {}
    for line in frontmatter_text.split("\n"):
        if ":" in line:
            key, _, value = line.partition(":")
            key = key.strip()
            value = value.strip().strip("\"'")
            if key:
                frontmatter[key] = value

    return frontmatter, body


def strip_non_durable_refs(body: str) -> str:
    """Remove preamble/pointer lines that bake the transient queue location into the issue.

    The queue path (.nexus/queue/<epic-slug>-<local-id>/) is committed-transient — the
    distiller drains it — so any `Queue entry:` / `Full epic:` / `Feature: … · docs/…`
    pointer written into the issue body rots. Drop them; the GitHub issue carries the
    epic content (its `# Epic:` title onward) only.
    """
    queue_ref = re.compile(r"\.nexus/queue/")
    pointer = re.compile(r"^\s*\**\s*(Feature|Queue entry|Full epic)\b", re.IGNORECASE)

    lines = body.split("\n")
    first_h1 = next(
        (i for i, line in enumerate(lines) if line.lstrip().startswith("# ")),
        len(lines),
    )

    kept: list[str] = []
    for i, line in enumerate(lines):
        # Queue-path references are never durable, wherever they appear.
        if queue_ref.search(line):
            continue
        # Pointer preamble only counts before the epic's H1 title.
        if i < first_h1 and pointer.match(line):
            continue
        kept.append(line)

    return "\n".join(kept).lstrip("\n")


def extract_raw_frontmatter(content: str) -> str:
    """Return the epic's raw YAML frontmatter text (between the leading `---` fences), or "".

    The resolver (@nexus/epic-resolve) reconstructs the epic from its issue alone, but the issue
    body created below has the frontmatter stripped. So the raw frontmatter is carried onto the
    issue verbatim inside an HTML comment (see append_epic_meta) — invisible in the rendered issue,
    losslessly re-read at resolve time — making the epic fully re-resolvable from its number.
    """
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
    return match.group(1) if match else ""


def append_epic_meta(body: str, raw_frontmatter: str) -> str:
    """Append the `nexus:epic-meta` machine block carrying the raw planning frontmatter.

    The block is an HTML comment, so it never shows in the rendered issue; the resolver lifts the
    frontmatter back out and resets `link` to the issue number. No-op when there is no frontmatter.
    """
    if not raw_frontmatter.strip():
        return body
    block = f"<!-- nexus:epic-meta\n{raw_frontmatter}\n-->"
    return body.rstrip("\n") + "\n\n" + block + "\n"


def strip_story_bodies(body: str) -> str:
    """Remove the `## User Stories` section from the epic issue body.

    Each story is filed as its own GitHub sub-issue of the epic (see /nxs.epic Phase 6),
    which is the durable, editable working surface for the story text and its acceptance
    criteria. Repeating the full story bodies in the epic issue would duplicate that content
    and let it drift. The stories stay in the queue `epic.md` (the digest, /nxs.hld,
    /nxs.analyze and /nxs.distill read them there); GitHub renders the sub-issues under the
    epic. So drop the section here.

    Removes from the `## User Stories` H2 up to (but not including) the next H2 heading, or
    end of body. Only level-2 headings terminate the section; the `###`/`####` story
    subsections do not.
    """
    h2 = re.compile(r"^##\s")  # matches `## `, not `### ` (no space after the 3rd #)
    lines = body.split("\n")

    start = next(
        (i for i, line in enumerate(lines) if re.match(r"^##\s+User Stories\s*$", line)),
        None,
    )
    if start is None:
        return body

    end = next(
        (j for j in range(start + 1, len(lines)) if h2.match(lines[j])),
        len(lines),
    )

    kept = lines[:start] + lines[end:]
    return "\n".join(kept).strip("\n") + "\n"


def update_frontmatter_with_link(content: str, issue_num: str) -> str:
    """Update or add link field in frontmatter."""
    lines = content.split("\n")
    in_frontmatter = False
    frontmatter_end_idx = -1
    link_line_idx = -1

    for i, line in enumerate(lines):
        if line.strip() == "---":
            if not in_frontmatter:
                in_frontmatter = True
            else:
                frontmatter_end_idx = i
                break
        elif in_frontmatter and line.startswith("link:"):
            link_line_idx = i

    if frontmatter_end_idx == -1:
        error("Could not find frontmatter boundaries")
        return content

    link_value = f'link: "#{issue_num}"'

    if link_line_idx != -1:
        # Update existing link
        lines[link_line_idx] = link_value
    else:
        # Insert link before closing ---
        lines.insert(frontmatter_end_idx, link_value)

    return "\n".join(lines)


def find_project_root(start_path: Path) -> Path:
    """Find the project root by looking for CLAUDE.md or .git."""
    current = start_path.resolve()

    while current != current.parent:
        if (current / "CLAUDE.md").exists() or (current / ".git").exists():
            return current
        current = current.parent

    return Path.cwd()


def get_project_id_by_name(project_name: str) -> str | None:
    """Get the node ID of a project by its name.
    
    The project_name can be in format:
    - "owner/project-number" (e.g., "my-org/1")
    - "project-number" (uses current repo's owner)
    
    Args:
        project_name: The project identifier
        
    Returns:
        The project node ID (e.g., "PVT_kwHOABC123") or None if not found.
    """
    # Parse project name to extract owner and number
    if "/" in project_name:
        owner, project_num = project_name.rsplit("/", 1)
    else:
        # Get owner from current repo
        result = run_command(["gh", "repo", "view", "--json", "owner", "--jq", ".owner.login"])
        if result.returncode != 0:
            warn(f"Error getting repo owner: {result.stderr}")
            return None
        owner = result.stdout.strip()
        project_num = project_name

    # Try to parse as a number for project lookup
    try:
        project_number = int(project_num)
    except ValueError:
        # Not a number, try to find project by title
        return get_project_id_by_title(owner, project_num)

    # Query for project by number
    query = """
    query($owner: String!, $number: Int!) {
        organization(login: $owner) {
            projectV2(number: $number) {
                id
                title
            }
        }
    }
    """
    
    cmd = [
        "gh", "api", "graphql",
        "-f", f"query={query}",
        "-f", f"owner={owner}",
        "-F", f"number={project_number}"
    ]
    
    result = run_command(cmd)
    
    # If org query fails, try user query
    if result.returncode != 0 or "organization" not in result.stdout:
        query = """
        query($owner: String!, $number: Int!) {
            user(login: $owner) {
                projectV2(number: $number) {
                    id
                    title
                }
            }
        }
        """
        cmd = [
            "gh", "api", "graphql",
            "-f", f"query={query}",
            "-f", f"owner={owner}",
            "-F", f"number={project_number}"
        ]
        result = run_command(cmd)
    
    if result.returncode != 0:
        warn(f"Error fetching project: {result.stderr}")
        return None
    
    try:
        data = json.loads(result.stdout)
        # Check both org and user responses
        project = (
            data.get("data", {}).get("organization", {}).get("projectV2") or
            data.get("data", {}).get("user", {}).get("projectV2")
        )
        if project:
            print(f"📊 Found project: {project.get('title', 'Unknown')}")
            return project.get("id")
        return None
    except json.JSONDecodeError as e:
        warn(f"Error parsing project response: {e}")
        return None


def get_project_id_by_title(owner: str, title: str) -> str | None:
    """Get the node ID of a project by searching for its title.
    
    Args:
        owner: The organization or user login
        title: The project title to search for
        
    Returns:
        The project node ID or None if not found.
    """
    query = """
    query($owner: String!, $title: String!) {
        organization(login: $owner) {
            projectsV2(first: 100, query: $title) {
                nodes {
                    id
                    title
                }
            }
        }
    }
    """
    
    cmd = [
        "gh", "api", "graphql",
        "-f", f"query={query}",
        "-f", f"owner={owner}",
        "-f", f"title={title}"
    ]
    
    result = run_command(cmd)
    
    # If org query fails, try user query
    if result.returncode != 0:
        query = """
        query($owner: String!, $title: String!) {
            user(login: $owner) {
                projectsV2(first: 100, query: $title) {
                    nodes {
                        id
                        title
                    }
                }
            }
        }
        """
        cmd = [
            "gh", "api", "graphql",
            "-f", f"query={query}",
            "-f", f"owner={owner}",
            "-f", f"title={title}"
        ]
        result = run_command(cmd)
    
    if result.returncode != 0:
        warn(f"Error searching for project: {result.stderr}")
        return None
    
    try:
        data = json.loads(result.stdout)
        nodes = (
            data.get("data", {}).get("organization", {}).get("projectsV2", {}).get("nodes", []) or
            data.get("data", {}).get("user", {}).get("projectsV2", {}).get("nodes", [])
        )
        # Find exact match
        for node in nodes:
            if node.get("title", "").lower() == title.lower():
                print(f"📊 Found project: {node.get('title', 'Unknown')}")
                return node.get("id")
        # If no exact match, use first result
        if nodes:
            project = nodes[0]
            print(f"📊 Found project: {project.get('title', 'Unknown')}")
            return project.get("id")
        return None
    except json.JSONDecodeError as e:
        warn(f"Error parsing project response: {e}")
        return None


def get_repo_project_id() -> str | None:
    """Get the node ID of the first project associated with the current repository.
    
    Returns:
        The project node ID (e.g., "PVT_kwHOABC123") or None if no project found.
    """
    result = run_command(["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"])
    if result.returncode != 0:
        warn(f"Could not determine repository name: {result.stderr}")
        return None

    name_with_owner = result.stdout.strip()
    if "/" not in name_with_owner:
        warn(f"Unexpected repository name format: {name_with_owner}")
        return None
    owner, repo = name_with_owner.split("/", 1)

    query = """
    query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
            projectsV2(first: 1) {
                nodes {
                    id
                    title
                }
            }
        }
    }
    """

    cmd = [
        "gh", "api", "graphql",
        "-f", f"query={query}",
        "-f", f"owner={owner}",
        "-f", f"repo={repo}",
    ]

    result = run_command(cmd)
    if result.returncode != 0:
        warn(f"Error fetching repository projects: {result.stderr}")
        return None

    try:
        data = json.loads(result.stdout)
        repository = (data.get("data") or {}).get("repository") or {}
        nodes = (repository.get("projectsV2") or {}).get("nodes") or []
        if nodes:
            project = nodes[0]
            print(f"📊 Found project: {project.get('title', 'Unknown')}")
            return project.get("id")
        return None
    except json.JSONDecodeError as e:
        warn(f"Error parsing project response: {e}")
        return None


def get_issue_id(issue_number: str, repo: str | None = None) -> str | None:
    """Get the GitHub GraphQL node ID for an issue.

    Args:
        issue_number: The issue number
        repo: Optional 'owner/repo' to query (passed as -R flag). Uses current repo if omitted.

    Returns:
        The GraphQL node ID (e.g., "I_kwDOABC123") or None if not found.
    """
    cmd = ["gh", "issue", "view", issue_number, "--json", "id", "--jq", ".id"]
    if repo:
        cmd = ["gh", "issue", "view", issue_number, "-R", repo, "--json", "id", "--jq", ".id"]

    result = run_command(cmd)
    if result.returncode != 0:
        warn(f"Error getting issue ID: {result.stderr}")
        return None

    return result.stdout.strip()


def add_issue_to_project(project_id: str, issue_id: str) -> bool:
    """Add an issue to a project using the GraphQL API.
    
    Args:
        project_id: The project's node ID (e.g., "PVT_kwHOABC123")
        issue_id: The issue's node ID (e.g., "I_kwDOABC123")
        
    Returns:
        True if successful, False otherwise.
    """
    mutation = f"""
    mutation {{
        addProjectV2ItemById(input: {{
            projectId: "{project_id}",
            contentId: "{issue_id}"
        }}) {{
            item {{
                id
            }}
        }}
    }}
    """
    
    cmd = ["gh", "api", "graphql", "-f", f"query={mutation}"]
    
    result = run_command(cmd)
    if result.returncode != 0:
        warn(f"Error adding issue to project: {result.stderr}")
        return False
    
    return True


def create_github_issue(
    title: str,
    body_file: Path,
    fallback_label: str | None = None,
    repo: str | None = None,
) -> tuple[str, str]:
    """
    Create a GitHub issue and return (issue_url, issue_number).

    When fallback_label is provided it is passed as --label (used when no
    issue type was resolved). When repo is provided it is passed as -R (creates
    the issue in that repository instead of the current one). Raises RuntimeError on failure.
    """
    cmd = [
        "gh", "issue", "create",
        "--title", title,
        "--body-file", str(body_file),
    ]
    if fallback_label:
        cmd.extend(["--label", fallback_label])
    if repo:
        cmd.extend(["-R", repo])

    result = run_command(cmd)

    if result.returncode != 0:
        raise RuntimeError(f"Failed to create GitHub issue: {result.stderr}")

    issue_url = result.stdout.strip()

    # Extract issue number from URL
    match = re.search(r"/issues/(\d+)$", issue_url)
    if not match:
        # Try just finding trailing digits
        match = re.search(r"(\d+)$", issue_url)

    if not match:
        raise RuntimeError(f"Could not extract issue number from: {issue_url}")

    return issue_url, match.group(1)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create a GitHub issue from an Epic document"
    )
    parser.add_argument(
        "epic_file",
        type=Path,
        help="Path to the epic.md file"
    )
    parser.add_argument(
        "-y", "--yes",
        action="store_true",
        help="Skip confirmation if link already exists"
    )
    parser.add_argument(
        "--project",
        type=str,
        default=None,
        help="GitHub project to add the issue to (e.g., 'my-org/1' or 'my-project-title'). If omitted, auto-discovers from repository."
    )
    parser.add_argument(
        "--no-project",
        action="store_true",
        help="Skip adding the issue to any project"
    )

    args = parser.parse_args()
    epic_file: Path = args.epic_file

    # Validate epic file exists
    if not epic_file.is_file():
        error(f"Epic file not found: {epic_file}")
        return 1

    # Check prerequisites
    if not check_prerequisites():
        return 1

    print(f"📄 Processing: {epic_file}")

    # Read and parse the epic file
    content = epic_file.read_text(encoding="utf-8")
    frontmatter, body = parse_frontmatter(content)

    # Strip non-durable queue/feature pointers so they never land in the issue body.
    body = strip_non_durable_refs(body)

    # Drop the `## User Stories` section — each story is filed as its own sub-issue, so
    # keeping the full story bodies here would duplicate them and let the copies drift.
    body = strip_story_bodies(body)

    # Carry the raw planning frontmatter onto the issue (hidden HTML comment) so the resolver can
    # reconstruct the full epic.md field shape from the issue number alone.
    body = append_epic_meta(body, extract_raw_frontmatter(content))

    # Extract epic title (required)
    epic_title = frontmatter.get("epic", "")
    if not epic_title:
        error("No 'epic' field found in frontmatter")
        print("Expected format in frontmatter:")
        print('  epic: "Your Epic Title"')
        return 1

    # Resolve project root once and read config once — every resolution below goes through the
    # one shared resolver, so this script, the story script, /nxs.epic, and /nxs.close cannot
    # disagree on any key (STORY-121.04, decision-record Invariant 3).
    project_root = find_project_root(epic_file)
    config = read_delivery_config(project_root)

    # Issues-repo resolves through the shared precedence chain (repo settings here; hub defaults
    # and frontmatter plug in later). If set, all gh issue commands target that repo.
    issues_repo: str | None = resolve_issues_repo(config) or None
    if issues_repo:
        print(f"📦 Issues repo (from config): {issues_repo}")

    # Resolve the classification mechanism and the concrete names the epic will carry
    # (STORY-121.02). The mode decides types-vs-labels; frontmatter `type` (per-item intent)
    # wins over config `epic-type` for the issue-type NAME — resolved through the shared
    # precedence chain (STORY-121.04) — and `epic-label` (default `epic`) supplies the label.
    # `legacy-auto` (the built-in default) preserves today's outcome.
    classification = resolve_classification(config)
    epic_label = resolve_epic_label(config)
    resolved_type: str | None = resolve_setting(
        "epicType", frontmatter={"epicType": frontmatter.get("type")}, repo=config
    ) or None

    # issue_type = a type to APPLY after creation (types / legacy-auto with a type).
    # create_label = a label passed at creation (labels mode, and the no-type legacy path).
    issue_type: str | None = None
    create_label: str | None = None
    if classification == "types":
        issue_type = resolved_type
        if not issue_type:
            warn("classification: types but no epic issue-type resolved (frontmatter 'type' / github.epic-type) — filing untyped")
    elif classification == "labels":
        create_label = epic_label
    else:  # legacy-auto (or absent) — probe-then-fallback; the fallback label is now `epic`.
        issue_type = resolved_type
        if not issue_type:
            create_label = epic_label

    # Track what actually lands, for the summary. `applied_label` starts as the create-time
    # label; the legacy-auto path may set it when type-setting falls back.
    applied_label: str | None = create_label
    type_applied = False

    # Check if link already exists
    existing_link = frontmatter.get("link", "")
    if existing_link and not args.yes:
        warn(f"Epic already has a link: {existing_link}")
        response = input("Do you want to create a new issue anyway? (y/N) ").strip().lower()
        if response != "y":
            print("Aborted.")
            return 0

    print(f"📋 Epic Title: {epic_title}  (classification: {classification})")
    if issue_type:
        print(f"🏷️  Type: {issue_type}")
    elif create_label:
        print(f"🏷️  Label: {create_label}")

    # Verify we have body content
    if not body.strip():
        error("No content found after frontmatter")
        return 1

    # Resolve the Project V2 target (STORY-121.03). The --project flag is the invocation-time
    # override and always wins; absent it, the declared `github.project` target decides the mode:
    #   none     → no lookup, no add-to-project, no warning (the personal-repo case)
    #   explicit → add to exactly that project; no auto-discovery fallback
    #   auto     → today's repository auto-discovery (the built-in default when the key is absent)
    project_id = None
    if not args.no_project:
        if args.project:
            # Use explicitly provided project (invocation-time override)
            print(f"🔍 Looking up project: {args.project}")
            project_id = get_project_id_by_name(args.project)
            if not project_id:
                warn(f"Project '{args.project}' not found, issue will not be added to a project")
        else:
            project_mode, project_target = resolve_project_target(config)
            if project_mode == "explicit":
                print(f"🔍 Looking up project from config: {project_target}")
                project_id = get_project_id_by_name(project_target)
                if not project_id:
                    warn(f"Project '{project_target}' from config not found, issue will not be added to a project")
            elif project_mode == "auto":
                print("🔍 Looking for repository project...")
                project_id = get_repo_project_id()
                if not project_id:
                    warn("No project found for repository, issue will not be added to a project")
            # project_mode == "none": deliberate absence — no lookup, no add-to-project, no warning.

    # Create temp file with body content
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False, encoding="utf-8") as tmp:
        tmp.write(body)
        temp_file = Path(tmp.name)

    try:
        # Ensure a create-time label exists before it is applied — `gh issue create --label X`
        # fails outright if X is absent, the exact strand this upsert removes (AC4 / Invariant 8).
        if create_label:
            if not ensure_label(
                create_label, run_command, repo=issues_repo,
                color="5319E7", description="Epic (created by nxs-gh-create-epic)",
            ):
                warn(f"Could not ensure '{create_label}' label — continuing (it may already exist)")

        print("🚀 Creating GitHub issue...")

        issue_url, issue_num = create_github_issue(
            epic_title, temp_file, fallback_label=create_label, repo=issues_repo
        )

        # Record the link immediately — the project/type steps below are
        # best-effort decoration and must not be able to lose the issue number.
        print("📝 Updating epic frontmatter with link...")
        updated_content = update_frontmatter_with_link(content, issue_num)
        epic_file.write_text(updated_content, encoding="utf-8")

        # Fetch the issue node ID once — needed for both project and type operations
        issue_id: str | None = None
        if project_id or issue_type:
            issue_id = get_issue_id(issue_num, repo=issues_repo)

        # Add to project if available
        if project_id:
            if issue_id:
                if add_issue_to_project(project_id, issue_id):
                    print("📊 Added to project")
                else:
                    warn("Failed to add issue to project")

        # Set the GitHub issue type when one was resolved (types / legacy-auto with a type).
        if issue_type:
            print(f"🏷️  Setting issue type: {issue_type}...")
            type_id = lookup_issue_type_id(issue_type, run_command, repo=issues_repo)
            type_applied = bool(type_id and issue_id and set_issue_type(issue_id, type_id, run_command))
            if type_applied:
                print(f"🏷️  Issue type set: {issue_type}")
            elif classification == "types":
                # Explicit types mode declared the repo types its issues; a missing/failed type
                # is a config error to surface, not to paper over with a label (AC2). No fallback.
                if type_id:
                    warn(f"Failed to set issue type '{issue_type}' on issue #{issue_num}")
                else:
                    warn(f"Issue type '{issue_type}' not found in repository — type not set (classification: types)")
            else:
                # legacy-auto: the repo has no such issue-type (e.g. a personal repo with none) —
                # fall back to the epic label, upserted first so the add cannot strand.
                if type_id:
                    warn(f"Failed to set issue type '{issue_type}' on issue #{issue_num} — falling back to label")
                else:
                    warn(f"Issue type '{issue_type}' not found in repository — falling back to label '{epic_label}'")
                applied_label = epic_label
                ensure_label(
                    applied_label, run_command, repo=issues_repo,
                    color="5319E7", description="Epic (created by nxs-gh-create-epic)",
                )
                label_cmd = ["gh", "issue", "edit", issue_num, "--add-label", applied_label]
                if issues_repo:
                    label_cmd.extend(["-R", issues_repo])
                if run_command(label_cmd).returncode == 0:
                    print(f"🏷️  Fallback label added: {applied_label}")
                else:
                    warn(f"Could not add fallback label '{applied_label}' to issue #{issue_num}")

        # Success output
        print()
        success("GitHub Issue Created")
        print()
        print(f"   Issue:  #{issue_num}")
        print(f"   Title:  {epic_title}")
        if type_applied:
            print(f"   Type:   {issue_type}")
        elif applied_label:
            print(f"   Label:  {applied_label}")
        print(f"   URL:    {issue_url}")
        if project_id:
            print("   Project: Added ✓")
        print()
        print(f'   Epic frontmatter updated with: link: "#{issue_num}"')

        return 0

    except RuntimeError as e:
        error(str(e))
        return 1

    finally:
        # Cleanup temp file
        temp_file.unlink(missing_ok=True)


if __name__ == "__main__":
    sys.exit(main())