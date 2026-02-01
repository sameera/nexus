#!/bin/bash

# nxs.update.commons.sh
# Updates specific files or folders from nexus/common/docs to local docs/

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check arguments
TARGET_PATH=$1
if [ -z "$TARGET_PATH" ]; then
    echo -e "${RED}Error: Please specify a file or folder path relative to common/docs${NC}"
    echo "Usage: $0 <path>"
    echo "Example: $0 system/delivery/"
    exit 1
fi

# Remove leading slash if present
TARGET_PATH=${TARGET_PATH#/}

# Get the root of the current git repository
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)

if [ -z "$REPO_ROOT" ]; then
    echo -e "${RED}Error: Not inside a git repository${NC}"
    exit 1
fi

echo -e "${GREEN}Repository root: ${REPO_ROOT}${NC}"

# Step 1: Clone nexus repository to a temporary location
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

# Step 2: verify source and prepare destination
SOURCE_PATH="$TEMP_DIR/nexus/common/docs/$TARGET_PATH"
DEST_PATH="$REPO_ROOT/docs/$TARGET_PATH"

if [ ! -e "$SOURCE_PATH" ]; then
    echo -e "${RED}Error: Source path '$TARGET_PATH' not found in nexus/common/docs${NC}"
    exit 1
fi

# Step 3: Copy with confirmation
if [ -d "$SOURCE_PATH" ]; then
    echo -e "${YELLOW}Source is a directory.${NC}"
    echo -e "${YELLOW}Copying contents from:${NC} $SOURCE_PATH"
    echo -e "${YELLOW}To:${NC} $DEST_PATH"
    echo -e "${YELLOW}You will be prompted before overwriting any existing files.${NC}"
    
    # Create destination directory if it doesn't exist
    mkdir -p "$DEST_PATH"
    
    # Copy contents recursively with interactive prompt for overwrites
    cp -ri "$SOURCE_PATH"/. "$DEST_PATH/"
    
    COPY_STATUS=$?
else
    echo -e "${YELLOW}Source is a file.${NC}"
    echo -e "${YELLOW}Copying from:${NC} $SOURCE_PATH"
    echo -e "${YELLOW}To:${NC} $DEST_PATH"
    echo -e "${YELLOW}You will be prompted if the destination file exists.${NC}"
    
    # Create parent directory if it doesn't exist
    mkdir -p "$(dirname "$DEST_PATH")"
    
    # Copy file with interactive prompt
    cp -i "$SOURCE_PATH" "$DEST_PATH"
    
    COPY_STATUS=$?
fi

if [ $COPY_STATUS -eq 0 ]; then
    echo -e "${GREEN}Update complete!${NC}"
else
    echo -e "${RED}Error: Copy operation failed or was cancelled${NC}"
    exit 1
fi
