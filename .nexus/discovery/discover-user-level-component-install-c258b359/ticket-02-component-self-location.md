---
title: "When a Nexus component is installed outside the target repo, how does it address its own scripts and files?"
type: research
status: open
blocked_by: none
claimed_by:
claimed_at:
---

## Question

A command or skill installed outside the target repo needs a reliable way to name a file that
ships beside it. Establish what Claude Code actually provides for this, and which of those
mechanisms Nexus can depend on.

The candidates to check are the user-level component directory at `~/.claude/`, the plugin
mechanism and any root path variable it exposes to a component, and any other way a component can
learn its own installed location at run time.

Report for each candidate: whether the mechanism exists, whether it works from a slash command
body as well as from a skill body, whether it survives the component being installed at a path the
author did not choose, and what happens when the same machine has both a repo-local copy and a
shared copy.

## Why it blocks

This is the question the earlier attempt failed on. Every other decision in this discovery assumes
some answer to it. If no reliable self-location mechanism exists, the shape of the refactor changes
completely, because the components would have to be addressed through something the repo still
supplies.

## Evidence

### From the `claude-code-guide` agent, 2026-08-12

Mechanisms the agent reports as existing and documented:

- `${CLAUDE_SKILL_DIR}` resolves to the directory holding a skill's `SKILL.md`. The agent reports
  it is substituted at run time, works in the skill body and in Bash rules declared in
  `allowed-tools` frontmatter, and works whether the skill sits at `~/.claude/skills/`, at
  `./.claude/skills/`, or inside a plugin.
- `${CLAUDE_PLUGIN_ROOT}` is the absolute path to a plugin's installation directory. It works in
  plugin skill bodies, hooks, and MCP server definitions. A plugin can ship skills, agents,
  commands, hooks, and MCP servers together. The path changes when the plugin updates, and the
  previous version is treated as ephemeral, so no state may be written there.
- `${CLAUDE_PROJECT_DIR}` gives the project root. It addresses the project, not the component.
- `${CLAUDE_PLUGIN_DATA}` is a persistent directory that survives plugin updates. It is available
  only to plugin skills.

Precedence when the same name exists at several scopes: managed enterprise beats personal, and
personal beats project. Plugin skills are namespaced as `plugin-name:skill-name`, so they do not
collide. A skill beats a command of the same name. The agent found no documented mechanism that
surfaces such a collision to the user.

Version declaration: a plugin can declare dependencies on other plugins with semantic-version
constraints in `plugin.json`. The agent found no mechanism by which a repository declares which
version of a user-level or project-level skill it expects, and no proactive mismatch warning. A
component that is missing fails at invocation time.

Two points in this evidence need testing before anything is decided on it.

1. The agent's report contradicts itself. The body states that `${CLAUDE_SKILL_DIR}` is reliable
   for project, user, and plugin skills alike. The summary then states that `${CLAUDE_PLUGIN_ROOT}`
   is the only documented mechanism supporting installation outside the repository. Both claims
   cannot hold. Which one is true decides whether Nexus needs the plugin mechanism at all, or only
   needs to rewrite its script paths.
2. The agent judged the "Base directory for this skill" line to be informal model output rather
   than a harness contract. That line was in fact emitted by the skill loader in the session that
   opened this discovery, when the `nxs-prose-style` skill was invoked, and it carried the correct
   absolute path. The agent's judgement about it being undocumented may still be right. Its
   judgement that it does not happen is wrong.

Neither of the two variables reported here covers a slash command body. Every Nexus slash command
under `.claude/commands/` invokes skill scripts by repo-relative path, so whether a command body
gets any substitution at all is still open.

## Resolution
