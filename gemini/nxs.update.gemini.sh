#!/bin/bash

# nxs.update.gemini.sh
# Updates the .gemini folder from the nexus repository

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the root of the current git repository
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)

if [ -z "$REPO_ROOT" ]; then
    echo -e "${RED}Error: Not inside a git repository${NC}"
    exit 1
fi

echo -e "${GREEN}Repository root: ${REPO_ROOT}${NC}"

# Step 1: Check for uncommitted changes in .gemini path
echo -e "${YELLOW}Checking for uncommitted changes in .gemini...${NC}"

if [ -d "$REPO_ROOT/.gemini" ]; then
    # Check for uncommitted changes (staged and unstaged) in .gemini
    if ! git -C "$REPO_ROOT" diff --quiet -- .gemini 2>/dev/null || \
       ! git -C "$REPO_ROOT" diff --cached --quiet -- .gemini 2>/dev/null; then
        echo -e "${RED}Error: There are uncommitted changes in .gemini${NC}"
        echo "Please commit or stash your changes before running this script."
        git -C "$REPO_ROOT" status -- .gemini
        exit 1
    fi
    
    # Also check for untracked files in .gemini
    UNTRACKED=$(git -C "$REPO_ROOT" ls-files --others --exclude-standard -- .gemini 2>/dev/null)
    if [ -n "$UNTRACKED" ]; then
        echo -e "${RED}Error: There are untracked files in .gemini${NC}"
        echo "$UNTRACKED"
        echo "Please add/commit or remove these files before running this script."
        exit 1
    fi
    
    echo -e "${GREEN}No uncommitted changes in .gemini${NC}"
else
    echo -e "${YELLOW}.gemini directory does not exist yet, will be created${NC}"
fi

# Step 2: Clone nexus repository to a temporary location
TEMP_DIR=$(mktemp -d)
echo -e "${YELLOW}Cloning nexus repository to ${TEMP_DIR}...${NC}"

cleanup() {
    echo -e "${YELLOW}Cleaning up temporary directory...${NC}"
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

git clone https://github.com/sameera/nexus "$TEMP_DIR/nexus"

if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to clone nexus repository${NC}"
    exit 1
fi

echo -e "${GREEN}Successfully cloned nexus repository${NC}"

# Step 3: Check for updates and migrate if necessary
CLAUDE_DIR="$TEMP_DIR/nexus/claude/.claude"
GEMINI_DIR="$TEMP_DIR/nexus/gemini/.gemini"
MIGRATION_SCRIPT="$GEMINI_DIR/migrate_claude_to_gemini.py"

# Ensure migration script is available locally if missing
if [ ! -f "$REPO_ROOT/.gemini/migrate_claude_to_gemini.py" ] && [ -f "$MIGRATION_SCRIPT" ]; then
    echo -e "${YELLOW}Migration script not found in .gemini. Bootstrapping...${NC}"
    mkdir -p "$REPO_ROOT/.gemini"
    cp "$MIGRATION_SCRIPT" "$REPO_ROOT/.gemini/"
    echo -e "${GREEN}Migration script bootstrapped.${NC}"
fi

if [ -d "$CLAUDE_DIR" ] && [ -d "$GEMINI_DIR" ]; then
    echo -e "${YELLOW}Checking for updates in .claude vs .gemini...${NC}"
    
    # Get last commit times
    LAST_CLAUDE_COMMIT=$(git -C "$TEMP_DIR/nexus" log -1 --format=%ct -- "claude/.claude")
    LAST_GEMINI_COMMIT=$(git -C "$TEMP_DIR/nexus" log -1 --format=%ct -- "gemini/.gemini")
    
    # Default to 0 if empty (shouldn't happen in valid repo)
    LAST_CLAUDE_COMMIT=${LAST_CLAUDE_COMMIT:-0}
    LAST_GEMINI_COMMIT=${LAST_GEMINI_COMMIT:-0}

    if [ "$LAST_CLAUDE_COMMIT" -gt "$LAST_GEMINI_COMMIT" ]; then
        echo -e "${YELLOW}Claude changes detected (newer than Gemini). Running migration...${NC}"
        
        if [ -f "$MIGRATION_SCRIPT" ]; then
            # Run migration in the temp directory
            # We use the python from the environment
            python3 "$MIGRATION_SCRIPT" --source "$CLAUDE_DIR" --dest "$GEMINI_DIR"
            
            if [ $? -ne 0 ]; then
                echo -e "${RED}Error: Migration failed${NC}"
                exit 1
            fi
            echo -e "${GREEN}Migration successful${NC}"
        else
            echo -e "${RED}Warning: Migration script not found in repo at $MIGRATION_SCRIPT. Skipping migration.${NC}"
        fi
    else
        echo -e "${GREEN}Gemini is up to date with Claude (or newer). No migration needed.${NC}"
    fi
fi

# Step 4: Copy contents from nexus/gemini/.gemini to current repo's .gemini
SOURCE_DIR="$GEMINI_DIR"

if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "${RED}Error: .gemini directory not found in nexus repository${NC}"
    exit 1
fi

echo -e "${YELLOW}Copying .gemini contents to ${REPO_ROOT}/.gemini...${NC}"

# Create .gemini directory if it doesn't exist
mkdir -p "$REPO_ROOT/.gemini"

# Copy contents, overwriting existing files
cp -rf "$SOURCE_DIR"/. "$REPO_ROOT/.gemini/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Successfully updated .gemini folder${NC}"
    echo -e "${GREEN}Files copied:${NC}"
    ls -la "$REPO_ROOT/.gemini"
else
    echo -e "${RED}Error: Failed to copy .gemini contents${NC}"
    exit 1
fi

echo -e "${GREEN}Done!${NC}"

