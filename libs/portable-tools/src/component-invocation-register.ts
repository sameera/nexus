/**
 * The pending register for the component-invocation gate (story #301, decision record #325).
 *
 * A body listed here still addresses a toolkit by a repository-bound form — a transpiler or an
 * interpreter run against a script path, a runtime run against a bundle, or a workspace script
 * alias — and the gate reports those sites rather than failing on them. A body **absent** from
 * this list must be fully migrated: any legacy form found in it fails the build by name, which is
 * what makes the regression guard real during the epic rather than only at its end.
 *
 * The register only ever shrinks. Stories #302 and #303 delete entries as they rewrite; when it is
 * empty the register itself goes and enforcement becomes unconditional (epic #250's completion
 * condition). Re-adding an entry is a deliberate reviewed act, never a way to make the gate pass.
 */
export const COMPONENT_INVOCATION_REGISTER: readonly string[] = [
    "commands/nxs.analyze.md",
    "commands/nxs.close.md",
    "commands/nxs.council.md",
    "commands/nxs.decision-record.md",
    "commands/nxs.discover.md",
    "commands/nxs.distill.md",
    "commands/nxs.epic.md",
    "commands/nxs.setup.md",
    "skills/nxs-abs-doc-path/SKILL.md",
    "skills/nxs-close-migration/SKILL.md",
    "skills/nxs-epic-resolve/SKILL.md",
    "skills/nxs-gh-create-epic/SKILL.md",
    "skills/nxs-gh-create-story/SKILL.md",
    "skills/nxs-pr-worktree/SKILL.md",
    "skills/nxs-record-digest/SKILL.md",
    "skills/nxs-setup/SKILL.md",
    "skills/nxs-workspace-status/SKILL.md",
];
