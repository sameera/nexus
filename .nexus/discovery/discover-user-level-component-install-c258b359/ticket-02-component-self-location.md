---
title: "When a Nexus component is installed outside the target repo, how does it address its own scripts and files?"
type: research
status: resolved
blocked_by: none
claimed_by: sameera
claimed_at: 2026-08-15T08:05:00Z
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

### From direct inspection of the shipped Claude Code binary, 2026-08-15

The two contradictions above are settled by reading the substitution code in the installed
binary. The version inspected is `@anthropic-ai/claude-code` 2.1.233. Both findings are read from
the loader itself, not from documentation and not from an agent's report.

**`${CLAUDE_SKILL_DIR}` exists, and it is gated on skill mode.** The loader substitutes it with the
directory of the component file it just loaded. The substitution runs only when the loader's
`isSkillMode` flag is true. That flag defaults to false and is set true only on the skill-loading
path. The substitution is applied to the skill body and to the `allowed-tools` frontmatter entries.

Two consequences follow. The variable works for a skill at any scope, because the value is derived
from the path the file was actually loaded from rather than from a plugin root. The variable is
never substituted in a slash command body.

**`${CLAUDE_PLUGIN_ROOT}` is substituted in command bodies as well as skill bodies.** The helper
that replaces it is applied to both kinds of component without a mode gate. The value is non-empty
only when the component was loaded from a plugin. It is therefore the only self-location mechanism
that reaches a slash command body, and reaching it requires shipping Nexus as a plugin.

**There is no `CLAUDE_COMMAND_DIR`.** The name does not appear in the binary at all.

**`${CLAUDE_PROJECT_DIR}` is substituted in both kinds of component.** It addresses the target
repo, not the component, so it does not answer this question.

**The "Base directory for this skill" line is a harness contract.** The template string that emits
it is present in the binary, and the loader prepends it to a skill's prompt. It is prose in the
prompt rather than a shell variable, so a skill can read the path but a shell command cannot expand
it. The earlier agent report was right that the line is undocumented and wrong that it does not
happen.

**Resolving the first contradiction:** the body of the earlier report was correct and its summary
was wrong. `${CLAUDE_PLUGIN_ROOT}` is not the only mechanism that supports installation outside the
repository. It is the only mechanism that supports installation outside the repository *for a slash
command*.

### The shape of Nexus's own invocations, measured 2026-08-15

- 33 invocations written as `tsx ./.claude/skills/<skill>/scripts/<script>.ts` live in 8 slash
  command bodies under `.claude/commands/`.
- 17 such invocations live in skill bodies under `.claude/skills/*/SKILL.md`.
- No Nexus component currently uses any substitution variable.

The majority of the repo-relative invocations therefore sit in exactly the component kind that
`${CLAUDE_SKILL_DIR}` cannot serve.

### On two copies of a component on one machine

The loader reads skill directories in this order: managed, then user, then synced, then project. It
removes duplicates by file identity, using the message "same file already loaded from". The only
rule found that resolves a name collision is one that drops a *synced* skill when a local skill owns
the same name.

A repo-local Nexus component and a shared Nexus component of the same name are two different files.
The file-identity rule does not treat them as duplicates of each other, and no rule found in the
loader resolves that collision between user scope and project scope. No warning string for it exists
either.

This does not confirm the earlier report's claim that personal scope beats project scope. It leaves
the collision outcome undetermined, and it means the harness surfaces nothing to the user when the
collision happens.

### From the `nxs-architect` agent, 2026-08-15

The agent recommends that Nexus adopt no self-location variable for addressing. Its reasoning is
that Nexus has an invocation problem rather than an addressing problem. The two variables exist to
let a component read a file that ships beside it. Every one of Nexus's roughly 50 sites executes a
program that ships beside it instead. A program that is invoked by name locates its own files from
its own runtime, which needs no cooperation from the harness at any scope.

The agent notes that Nexus already ships this mechanism. `libs/portable-tools/src/nexus-cli.ts:54`
resolves the component payload from `import.meta.dirname`, which is the bundle's own location.

On the alternative of shipping as a plugin, the agent's position is that
`${CLAUDE_PLUGIN_ROOT}` genuinely is the only mechanism that reaches a command body, so it is the
only option if paths stay in command bodies. Its cost is that the whole distribution model becomes
conditional on the plugin system. The install path changes on every plugin update, command names
become namespaced, and a marketplace dependency appears. The agent's advice is to keep the plugin
option alive as a distribution question for the tickets that decide distribution, and not to settle
it here.

On the alternative of having commands delegate to skills so that only skill bodies carry script
paths, the agent judges this a behavioural change rather than a mechanical rewrite. Skill invocation
is matched by description rather than executed deterministically, so it would insert a router into
the middle of gated pipeline steps. Values that currently pass from one step to the next through
shell composition would have to pass through prose instead.

On two copies, the agent judges shadowing a real hazard for Nexus rather than a generic one. Every
repo that has run `nexus deploy` carries a committed copy pinned to the version that deployed it.
The dangerous case is not a missing file. It is an old command body succeeding, because its copy is
right there, and running old code against a new store layout.

The agent reports no hard blocker to installing Nexus components outside the target repo.

## Resolution

- **Decided:** A Nexus component never encodes a path to the toolkit it invokes. A component names
  the toolkit, and the toolkit resolves its own files from its own location at run time. Nexus
  depends on no harness self-location variable for addressing. The two variables the harness offers
  are recorded here as verified facts and are available for diagnostics, but neither is load-bearing
  for the refactor.
- **Why:** 33 of Nexus's 50 script invocations sit in slash command bodies, and
  `${CLAUDE_SKILL_DIR}` is not substituted there. The only variable that reaches a command body is
  `${CLAUDE_PLUGIN_ROOT}`, and it is non-empty only inside a plugin, which would make the entire
  distribution model conditional on the plugin system before the tickets that decide distribution
  have run. A named toolkit that locates its own files needs no harness cooperation, works
  identically at every scope and in every install mode, and is a mechanism Nexus already ships and
  already documents.
- **Refuted alternative:** Depend on `${CLAUDE_SKILL_DIR}` and restructure so that only skill bodies
  carry script paths. It lost because the restructure is a behavioural change to eight commands
  rather than a rewrite of strings. Skill invocation is matched by description rather than executed,
  so it would put a router inside gated pipeline steps, and values that now pass through shell
  composition would have to pass through prose. A second alternative, shipping Nexus as a plugin to
  obtain `${CLAUDE_PLUGIN_ROOT}` in command bodies, is not refuted as a *distribution* mechanism and
  stays live for the tickets that decide distribution. It is refuted only as the answer to
  addressing, because it settles distribution as a side effect of settling a path syntax.
- **Resolved by:** sameera on 2026-08-15

### What this narrows, and what it leaves open

This resolution does not decide how many executables the toolkit is. One bundle carrying every
capability as a verb and several separately named bundles both satisfy the by-name rule. That choice
stays open and belongs to the ticket on the script runtime shape.

It does bind one sequencing constraint that the ticket on the repo-bound boundary already recorded.
Six capabilities have no dependency-free form today. They must gain one before any invocation string
changes, because a component that names a toolkit verb that does not exist yet fails at invocation
time rather than at install time.

It also rules that two copies of the same Nexus component on one machine is a defect rather than a
supported configuration. The harness resolves that collision by no rule this session could find, and
it warns nobody. A component cannot fix the collision, so the toolkit must report it. The ticket on
coexistence and migration decides what is done about it.
