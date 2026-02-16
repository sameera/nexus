#!/usr/bin/env python3
import os
import shutil
import re
from pathlib import Path

import argparse

# Paths
REPO_ROOT = Path(os.getcwd())
DEFAULT_SOURCE_DIR = REPO_ROOT / "claude/.claude"
DEFAULT_DEST_DIR = REPO_ROOT / "gemini/.gemini"

# Tool Mappings
TOOL_MAPPING = {
    "Read": "read_file",
    "Write": "write_file",
    "Edit": "replace",
    "Bash": "run_shell_command",
    "Grep": "search_file_content",
    "Glob": "glob",
    "Task": "delegate_to_agent",
    "Skill": "activate_skill",
    "WebSearch": "google_web_search",
}

def clean_destination(dest_dir):
    if dest_dir.exists():
        print(f"Cleaning {dest_dir}...")
        shutil.rmtree(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)

def copy_files(source_dir, dest_dir):
    print(f"Copying from {source_dir} to {dest_dir}...")
    # Copy directory tree
    for item in source_dir.iterdir():
        if item.is_dir():
            shutil.copytree(item, dest_dir / item.name)
        else:
            shutil.copy2(item, dest_dir / item.name)

def transform_frontmatter_tools(content):
    # regex to find tools: ...
    # It handles "tools: Tool1, Tool2"
    def replace_tools(match):
        tools_str = match.group(1)
        current_tools = [t.strip() for t in tools_str.split(',')]
        new_tools = []
        for tool in current_tools:
            if tool in TOOL_MAPPING:
                new_tools.append(TOOL_MAPPING[tool])
            else:
                new_tools.append(tool) # Keep unknown tools? or warn?
        return f"tools: {', '.join(new_tools)}"

    return re.sub(r"^tools:\s*(.+)$", replace_tools, content, flags=re.MULTILINE)

def transform_paths(content):
    # Order matters here to avoid double replacement issues
    content = content.replace("claude/.claude", "gemini/.gemini")
    content = content.replace(".claude", ".gemini")
    content = content.replace("claude -p", "gemini -p")
    return content

def process_file(file_path):
    print(f"Processing {file_path}...")
    try:
        content = file_path.read_text(encoding="utf-8")
        
        # Transform content
        new_content = transform_paths(content)
        
        if file_path.suffix == '.md':
            new_content = transform_frontmatter_tools(new_content)
            
            # Additional Markdown specific replacements if needed
            # e.g. "Invoke: nxs-analyzer" might stay as is for now as it's a prompt instruction
        
        if content != new_content:
            file_path.write_text(new_content, encoding="utf-8")
            print(f"  Updated {file_path.name}")
            
    except UnicodeDecodeError:
        print(f"  Skipping binary file {file_path.name}")
    except Exception as e:
        print(f"  Error processing {file_path.name}: {e}")

def main():
    parser = argparse.ArgumentParser(description="Migrate Claude Code assets to Gemini CLI.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE_DIR, help="Source directory (.claude folder)")
    parser.add_argument("--dest", type=Path, default=DEFAULT_DEST_DIR, help="Destination directory (.gemini folder)")
    args = parser.parse_args()

    source_dir = args.source
    dest_dir = args.dest

    if not source_dir.exists():
        print(f"Source directory {source_dir} does not exist!")
        return

    clean_destination(dest_dir)
    copy_files(source_dir, dest_dir)

    for file_path in dest_dir.rglob("*"):
        if file_path.is_file():
            process_file(file_path)

    print("Migration complete.")

if __name__ == "__main__":
    main()
