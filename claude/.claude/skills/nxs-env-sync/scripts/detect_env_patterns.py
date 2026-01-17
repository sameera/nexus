#!/usr/bin/env python3
import os
import json
from pathlib import Path


def detect_tech_stack():
    stack = []
    if os.path.exists("package.json"):
        stack.append("nodejs")
    if os.path.exists("requirements.txt") or os.path.exists("pyproject.toml") or any(Path(".").glob("*.py")):
        stack.append("python")
    if os.path.exists("go.mod"):
        stack.append("go")
    if os.path.exists("pom.xml") or os.path.exists("build.gradle"):
        stack.append("java")
    return stack


def get_suggested_patterns(stack):
    patterns = set([".env", ".env.*", ".env.local"])

    if "nodejs" in stack:
        patterns.add("config/local.json")
        patterns.add(".claude/settings.local.json")
        patterns.add(".gemini/settings.local.json")

    if "python" in stack:
        patterns.add("local_settings.py")
        patterns.add(".python-version")

    # Add patterns for files that exist but are ignored by git
    try:
        import subprocess
        result = subprocess.run(
            ["git", "status", "--ignored", "--porcelain"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            for line in result.stdout.splitlines():
                if line.startswith("!! "):
                    path = line[3:]
                    # Only suggest small config-like files
                    if path.endswith((".json", ".env", ".local", ".yml", ".yaml", ".conf", ".config")):
                        patterns.add(path)
    except Exception:
        pass

    return sorted(list(patterns))


def main():
    stack = detect_tech_stack()
    patterns = get_suggested_patterns(stack)
    print(json.dumps(patterns))


if __name__ == "__main__":
    main()
