# Installation

This guide covers installing Nexus for Claude Code or Gemini.

## Prerequisites

- **Claude Code** (recommended) or **Gemini** AI agent
- **Git** installed and configured
- **GitHub CLI** (`gh`) installed and authenticated (for `/nxs.dev` command)
- **Python 3** (for skill scripts)

## Choose Your Platform

Nexus has full support for Claude Code and experimental support for Gemini. Choose the appropriate installation path.

### For Claude Code (Recommended)

Claude Code is the primary platform with full feature support.

#### 1. Copy the Update Script to the root of your project

```bash
curl -O https://raw.githubusercontent.com/sameera/nexus/refs/heads/main/claude/nxs.update.claude.sh
```

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/sameera/nexus/refs/heads/main/claude/nxs.update.claude.ps1" -OutFile "nxs.update.claude.ps1"
```

#### 2. Run the Update Script

The update script copies Nexus commands, agents, and skills to your Claude Code configuration directory.

**On Linux/macOS:**

```bash
chmod +x nxs.update.claude.sh
./nxs.update.claude.sh
```

**On Windows (PowerShell):**

```powershell
./nxs.update.claude.ps1
```

#### 3. Verify Installation

Check that Nexus commands are available:

```bash
ls ~/.config/claude/code/commands/nxs*.md
```

You should see:

- `nxs.analyze.md`
- `nxs.close.md`
- `nxs.council.md`
- `nxs.dev.md`
- `nxs.epic.md`
- `nxs.hld.md`
- `nxs.init.md`
- `nxs.tasks.md`

#### 4. Restart Claude Code

For commands to be recognized, restart your Claude Code session.

### For Gemini (Experimental)

Gemini support is experimental with limited functionality.

#### 1. Clone Nexus

```bash
git clone https://github.com/yourusername/nexus.git ~/nexus
```

#### 2. Run the Update Script

```bash
cd ~/nexus/gemini
chmod +x nxs.update.gemini.sh
./nxs.update.gemini.sh
```

#### 3. Verify Installation

Check your Gemini configuration directory for installed commands.

**Note**: Some advanced features like worktree automation and GitHub integration may have limited support on Gemini.

## Post-Installation

### Configure GitHub CLI

Several commands require GitHub integration:

```bash
# Authenticate with GitHub
gh auth login

# Verify authentication
gh auth status
```

### Set Up Global Claude Context (Optional)

Create a global `CLAUDE.md` file for personal coding preferences:

```bash
mkdir -p ~/.claude
touch ~/.claude/CLAUDE.md
```

Edit `~/.claude/CLAUDE.md` to include your coding standards, preferred patterns, etc. This file is read by Claude in all projects.

## Updating Nexus

To update to the latest version:

```bash
cd ~/nexus
git pull
cd claude  # or gemini
./nxs.update.claude.sh  # or ./nxs.update.gemini.sh
```

The update script is idempotent - safe to run multiple times.

## Troubleshooting

### Commands Not Recognized

**Problem**: `/nxs.epic` shows "command not found"

**Solutions**:

1. Verify files copied correctly: `ls ~/.config/claude/code/commands/nxs*.md`
2. Restart Claude Code session
3. Check file permissions: `chmod +r ~/.config/claude/code/commands/nxs*.md`

### Python Scripts Fail

**Problem**: Skills fail with "python3: command not found"

**Solutions**:

1. Install Python 3: `apt-get install python3` (Linux) or `brew install python3` (macOS)
2. Verify: `python3 --version`

### GitHub CLI Not Authenticated

**Problem**: `/nxs.dev` fails with authentication error

**Solutions**:

1. Run: `gh auth login`
2. Follow interactive prompts
3. Verify: `gh auth status`

## Next Steps

- [Project Setup](setup.md) - Initialize your first project
- [Your First Epic](first-epic.md) - Create your first feature specification

## Platform Comparison

| Feature             | Claude Code | Gemini     |
| ------------------- | ----------- | ---------- |
| Core Commands       | ✅ Full     | ⚠️ Partial |
| Agent Delegation    | ✅ Full     | ⚠️ Limited |
| GitHub Integration  | ✅ Full     | ⚠️ Limited |
| Worktree Automation | ✅ Full     | ❌ No      |
| Skill Scripts       | ✅ Full     | ⚠️ Limited |

**Recommendation**: Use Claude Code for production workflows. Use Gemini for experimentation only.
