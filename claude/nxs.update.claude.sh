#!/bin/bash

# nxs.udpate.claude.sh
# Updates the .claude folder from the nexus repository

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

# Step 1: Check for uncommitted changes in .claude path
echo -e "${YELLOW}Checking for uncommitted changes in .claude...${NC}"

if [ -d "$REPO_ROOT/.claude" ]; then
    # Check for uncommitted changes (staged and unstaged) in .claude
    if ! git -C "$REPO_ROOT" diff --quiet -- .claude 2>/dev/null || \
       ! git -C "$REPO_ROOT" diff --cached --quiet -- .claude 2>/dev/null; then
        echo -e "${RED}Error: There are uncommitted changes in .claude${NC}"
        echo "Please commit or stash your changes before running this script."
        git -C "$REPO_ROOT" status -- .claude
        exit 1
    fi
    
    # Also check for untracked files in .claude
    UNTRACKED=$(git -C "$REPO_ROOT" ls-files --others --exclude-standard -- .claude 2>/dev/null)
    if [ -n "$UNTRACKED" ]; then
        echo -e "${RED}Error: There are untracked files in .claude${NC}"
        echo "$UNTRACKED"
        echo "Please add/commit or remove these files before running this script."
        exit 1
    fi
    
    echo -e "${GREEN}No uncommitted changes in .claude${NC}"
else
    echo -e "${YELLOW}.claude directory does not exist yet, will be created${NC}"
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

# Step 3: Copy contents from nexus/.claude to current repo's .claude
SOURCE_DIR="$TEMP_DIR/nexus/.claude"

if [ ! -d "$SOURCE_DIR" ]; then
    echo -e "${RED}Error: .claude directory not found in nexus repository${NC}"
    exit 1
fi

echo -e "${YELLOW}Copying .claude contents to ${REPO_ROOT}/.claude...${NC}"

# Create .claude directory if it doesn't exist
mkdir -p "$REPO_ROOT/.claude"

# Copy contents, overwriting existing files
cp -rf "$SOURCE_DIR"/. "$REPO_ROOT/.claude/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Successfully updated .claude folder${NC}"
    echo -e "${GREEN}Files copied:${NC}"
    ls -la "$REPO_ROOT/.claude"
else
    echo -e "${RED}Error: Failed to copy .claude contents${NC}"
    exit 1
fi

echo -e "${GREEN}Done!${NC}"