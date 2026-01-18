# nxs.update.claude.ps1
# Updates the .claude folder from the nexus repository

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Red { param($Message) Write-Host $Message -ForegroundColor Red }
function Write-Green { param($Message) Write-Host $Message -ForegroundColor Green }
function Write-Yellow { param($Message) Write-Host $Message -ForegroundColor Yellow }

# Get the root of the current git repository
try {
    $REPO_ROOT = git rev-parse --show-toplevel 2>$null
}
catch {
    $REPO_ROOT = $null
}

if (-not $REPO_ROOT) {
    Write-Red "Error: Not inside a git repository"
    exit 1
}

Write-Green "Repository root: $REPO_ROOT"

# Step 1: Check for uncommitted changes in .claude path
Write-Yellow "Checking for uncommitted changes in .claude..."

$claudePath = Join-Path $REPO_ROOT ".claude"

if (Test-Path $claudePath) {
    # Check for uncommitted changes (staged and unstaged) in .claude
    $diffUnstaged = git -C "$REPO_ROOT" diff --quiet -- .claude 2>$null
    $exitCodeUnstaged = $LASTEXITCODE
    
    $diffStaged = git -C "$REPO_ROOT" diff --cached --quiet -- .claude 2>$null
    $exitCodeStaged = $LASTEXITCODE

    if ($exitCodeUnstaged -ne 0 -or $exitCodeStaged -ne 0) {
        Write-Red "Error: There are uncommitted changes in .claude"
        Write-Host "Please commit or stash your changes before running this script."
        git -C "$REPO_ROOT" status -- .claude
        exit 1
    }
    
    # Also check for untracked files in .claude
    $untracked = git -C "$REPO_ROOT" ls-files --others --exclude-standard -- .claude 2>$null
    if (-not [string]::IsNullOrWhiteSpace($untracked)) {
        Write-Red "Error: There are untracked files in .claude"
        Write-Host $untracked
        Write-Host "Please add/commit or remove these files before running this script."
        exit 1
    }
    
    Write-Green "No uncommitted changes in .claude"
} else {
    Write-Yellow ".claude directory does not exist yet, will be created"
}

# Step 2: Clone nexus repository to a temporary location
$TEMP_DIR = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $TEMP_DIR | Out-Null
Write-Yellow "Cloning nexus repository to $TEMP_DIR..."

try {
    git clone https://github.com/sameera/nexus "$TEMP_DIR/nexus"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to clone nexus repository"
    }

    Write-Green "Successfully cloned nexus repository"

    # Step 3: Copy contents from nexus/.claude to current repo's .claude
    $SOURCE_DIR = Join-Path $TEMP_DIR "nexus/claude/.claude"

    if (-not (Test-Path $SOURCE_DIR)) {
        Write-Red "Error: .claude directory not found in nexus repository"
        exit 1
    }

    Write-Yellow "Copying .claude contents to $claudePath..."

    # Create .claude directory if it doesn't exist
    if (-not (Test-Path $claudePath)) {
        New-Item -ItemType Directory -Path $claudePath | Out-Null
    }

    # Copy contents, overwriting existing files
    Copy-Item -Path "$SOURCE_DIR/*" -Destination "$claudePath" -Recurse -Force

    Write-Green "Successfully updated .claude folder"
    Write-Green "Files copied:"
    Get-ChildItem -Path "$claudePath" | Format-Table -AutoSize
    Write-Green "Done!"

}
catch {
    Write-Red "Error: $_"
    exit 1
}
finally {
    Write-Yellow "Cleaning up temporary directory..."
    if (Test-Path $TEMP_DIR) {
        Remove-Item -Path $TEMP_DIR -Recurse -Force -ErrorAction SilentlyContinue
    }
}
