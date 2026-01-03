# Structure

```
docs
|_ product
|   |_ context.md               // High-level product context for the agents.
|_ system
    |_ standards
    |   |_ api_patterns.md
    |   |_ task_labels.md       // Labels for Github Issues (used with nxs.tasks)
    |_ stack.md                 // The technology stack of the product.
```

# CLAUDE.md Setup

Add the following to your CLAUDE.md

```markdown
# Project Structure

This repository root contains:

-   `CLAUDE.md` (this file)
-   `docs/system/standards/` - shared standards and configurations
-   `.claude/commands/` - slash commands

When any command or agent references paths under `system/`, `docs/`, or `scripts/`, treat them as relative to this repository root, not as absolute filesystem paths.
```

# Updating

In order to update the Nexus plugin in your repo, run the `nxs.update.[agent].sh`. You amy need to give the script
execution permissions first. E.g.

```bash
chomod +x nxs.update.claude.sh
```

This update script does the following:

1. Ensures that there are no manual edits to the files in your .claude folder, so that the update does not overwrite any of your custom edits.
2. Checkout the updated content from the Nexus github repo.
3. Copy the updated content to your .cluade, overwriting any matching exising files.

**NOTE**: The script only overwrites files with matching names - typically, with `nxs` prefix. It will not delete any other files in .claude folder.
