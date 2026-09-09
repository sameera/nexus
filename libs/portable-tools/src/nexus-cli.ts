/**
 * The single portable `nexus` entrypoint (epic #60): the structural half of getting Nexus into
 * a repo or a whole workspace. A thin writer/orchestrator over two capabilities it must not
 * duplicate — the workspace resolver (`@nexus/workspace`, the single authority on workspace
 * shape) and the component-deploy primitive (`deploy-components.ts`, the sole component-root
 * installer). Judgment stays with `/nxs.setup`.
 *
 * Bundled as `nexus.mjs` on the portable distributable (ENTRY_POINTS in build-bundles.ts) with
 * the vendored component payload carried beside it as plain files, so every verb runs to
 * completion on a bare `node` binary with no install step.
 *
 * Verbs:
 *   nexus install                      install the Nexus components at the configuration directory
 *   nexus uninstall                    remove the installed components from that directory
 *   nexus migrate-components           remove a repository's committed component set
 *   nexus deploy                       install the Nexus components into the invoking repo
 *   nexus workspace init               declare a multi-repo workspace (STORY-60.02)
 *   nexus workspace status             read-only workspace status (STORY-60.03)
 *   nexus workspace docs-root          print the resolved repo-relative docs root (STORY-81.01)
 *   nexus workspace add-repo           add one member to an existing workspace (STORY-60.04)
 *   nexus workspace github-defaults    print the hub's github-publishing defaults as JSON (STORY-121.05)
 *   nexus workbook <sub>               make, render, read and teach a learner's workbook (epics #405, #407)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { resolveAbsDocPath } from "@nexus/abs-doc-path/resolve";
import { defaultRunner as closeMigrationRunner } from "@nexus/workspace/run";
import { closePreflight } from "@nexus/workspace/close-role";
import { relocateQueue, renderRelocateFailure, renderRelocateOutcome } from "./queue-relocate.js";
import { renderDiagnostic as renderEpicResolveDiagnostic } from "@nexus/epic-resolve/render";
import { resolveEpic } from "@nexus/epic-resolve/resolve";
import { writeMaterializedEpic } from "@nexus/epic-resolve/write";
import { CONFIG_COMMANDS, runConfig } from "@nexus/delivery-config/config-cli";
import { runCreateEpic } from "@nexus/delivery-config/epic-filer/run";
import { runCreateStory } from "@nexus/delivery-config/story-filer/run";
import { resolveRole } from "@nexus/pr-worktree/identity";
import { resolvePr } from "@nexus/pr-worktree/pr";
import { deriveRange } from "@nexus/pr-worktree/range";
import { fetchPrHead, readRange } from "@nexus/pr-worktree/range-read";
import { renderDiagnostic as renderPrWorktreeDiagnostic } from "@nexus/pr-worktree/render";
import { openAnalyzeWorktree, openCloseWorktree, removeWorktree } from "@nexus/pr-worktree/worktree";
import { renderVerifyResult } from "@nexus/prose-verify/render";
import { survivingTokens, type Finding as RazorFinding } from "@nexus/scope-razor/labels";
import { checkDraft, type RazorFinding as RazorRuleFinding } from "@nexus/scope-razor/check";
import { renderRazorFindings, renderSurvivingTokens } from "@nexus/scope-razor/render";
import { verifyTranslation, type VerifyResult } from "@nexus/prose-verify/verify";
import { fetchRecord } from "@nexus/record-digest/fetch";
import { localDocsRoot, resolveWorkspace, type ResolveResult } from "@nexus/workspace/resolve";
import { renderWorkspaceStatus } from "@nexus/workspace/status";
import { takeTargetRoot } from "@nexus/workspace/target-root";
import { isDirectRun } from "./entry-point.js";
import { allowlistNoticeLines } from "./allowlist.js";
import { deployComponents, EMPTY_PAYLOAD, payloadDirectory, type DeployResult } from "./deploy-components.js";
import {
    DEFAULT_CONFIG_DIRNAME,
    describeInstallLocation,
    describeInstalledContent,
    ensureInstallLocation,
    inspectInstallLocation,
    resolveInstallLocation,
    type InstalledContent,
    type InstallLocationResult,
    type InstallLocationState,
} from "./install-location.js";
import { migrateComponents, REPO_COMPONENT_DIRNAME, type MigrationResult } from "./migrate-components.js";
import { detectEnvironmentDefects, makeEnvironmentGuard } from "./environment-guard.js";
import { runCli as runDeriveEntryDiff } from "./derive-entry-diff.js";
import { runCli as runDriftAdvisory } from "./drift-advisory.js";
import { EXCLUDED_STORES, excludePathspecs } from "./pipeline-stores.js";
import { runCli as runGenerateAtlas } from "./generate-atlas.js";
import { runCli as runSeedRegistry } from "./seed-registry.js";
import {
    projectTemplateDir,
    seedTemplates,
    TEMPLATE_PAYLOAD_DIRNAME,
    type SeedTemplatesResult,
} from "./seed-templates.js";
import { runCli as runValidateConcepts } from "./validate-concepts.js";
import { releaseVersion } from "@nexus/release-identity/release";
import { authoredComponentRoot, checkoutComponentRoot, COMPONENT_PAYLOAD_DIRNAME, hashComponentTree } from "./vendor-components.js";
import { WORKBOOK_SUBVERBS, runWorkbookCli } from "./workbook-cli.js";
import { runWorkspaceAddRepo } from "./workspace-add-repo.js";
import { runWorkspaceInit } from "./workspace-init.js";

export interface CliIo {
    /** The invoking working directory (the repo a verb acts on / resolves from). */
    cwd: string;
    stdout: (line: string) => void;
    stderr: (line: string) => void;
}

/**
 * One entry in the verb registry (decision record #277): a verb cannot exist without appearing in
 * the composed usage text, because the usage text is rendered from this same object. Every
 * capability is imported statically and dispatched eagerly — there is no lazy/deferred variant.
 */
export interface VerbEntry {
    /** One-line summary, shown beside the verb name in the top-level usage listing. */
    summary: string;
    /** The full usage block for this verb (may span multiple lines). */
    usage: string;
    /**
     * The subverb names this verb dispatches, when it dispatches any. Declaring them here is what
     * lets the dispatcher and the build-time invocation gate (story #301) read one list: the
     * dispatcher rejects anything absent from it, and the gate composes the two-token dispatch
     * names a component body is allowed to write from the same array.
     */
    subverbs?: readonly string[];
    run: (argv: string[], io: CliIo) => Promise<number>;
}

const WORKSPACE_SUBVERBS: readonly string[] = ["init", "status", "docs-root", "add-repo", "github-defaults"];
const PR_WORKTREE_SUBVERBS: readonly string[] = ["preflight", "open", "range", "remove"];

/**
 * The configuration resolver's own commands, read from the table that dispatches them (story #396)
 * rather than copied here — the gate composes this verb's two-token dispatch names from it.
 */
const CONFIG_SUBVERBS: readonly string[] = Object.keys(CONFIG_COMMANDS);

const REGISTRY: Record<string, VerbEntry> = {
    deploy: {
        summary: "Install the Nexus Claude components into the target repo.",
        usage: [
            "  nexus deploy [--payload <dir>] [--target <dir>]",
            `      Install the Nexus Claude components (${REPO_COMPONENT_DIRNAME}/ commands, agents, skills) into the`,
            "      target repo (default: the current directory), mirroring the vendored payload",
            "      (default: the claude-components directory beside this artifact). Idempotent;",
            `      user-owned files such as ${REPO_COMPONENT_DIRNAME}/settings.local.json are never touched.`,
            "      Per-repository deployment is no longer the supported arrangement: components are",
            "      installed once for your account with `nexus install`. This verb is kept for the",
            "      cases that still need a repository-local copy.",
        ].join("\n"),
        run: runDeploy,
    },
    install: {
        summary: "Install the Nexus Claude components at the account's configuration directory.",
        usage: [
            "  nexus install [--payload <dir>] [--from-checkout <dir>]",
            "      Install the Nexus Claude components (commands, agents, skills) at the Claude",
            `      configuration directory — $CLAUDE_CONFIG_DIR, or ${DEFAULT_CONFIG_DIRNAME} in your home directory.`,
            "      Exactly one component set exists per account, so this replaces per-repository",
            "      deployment. With --from-checkout the location is pointed at that checkout's",
            "      authored tree instead of holding a copy (the maintainer's edit-and-rerun mode).",
            "      Idempotent. Writes no settings file; it prints the permission entry to add.",
        ].join("\n"),
        run: runInstall,
    },
    uninstall: {
        summary: "Remove the installed Nexus Claude components from the configuration directory.",
        usage: [
            "  nexus uninstall",
            "      Remove every Nexus-namespaced component file from the Claude configuration",
            "      directory, leaving your own files there untouched. Run it BEFORE removing the",
            "      package: the verb ships inside the package, and the package manager has no record",
            "      of a component set copied into the configuration directory.",
        ].join("\n"),
        run: runUninstall,
    },
    "migrate-components": {
        summary: "Remove a repository's committed Nexus components, once they are installed per account.",
        usage: [
            "  nexus migrate-components [--target <dir>]",
            `      Remove the Nexus-namespaced files a repository still carries under ${REPO_COMPONENT_DIRNAME}/ —`,
            "      including at its root — and add namespaced ignore entries so they do not come",
            "      back. Requires an installed account-level component set; removes only files git",
            "      tracks; stages nothing and commits nothing, so the removals are yours to review.",
        ].join("\n"),
        run: runMigrateComponents,
    },
    version: {
        summary: "Report the installed release, its component payload and its install location.",
        usage: [
            "  nexus version",
            "      Print { version, componentPayload, installLocation } — the release's one semantic",
            "      version, the component payload's fingerprint, and where the components are installed.",
        ].join("\n"),
        run: runVersion,
    },
    workspace: {
        summary: "Declare, inspect, or extend a multi-repo workspace.",
        usage: [
            "  nexus workspace init            Declare a multi-repo workspace (hub + members; deploys nothing).",
            "  nexus workspace status [--root <dir>]      Read-only workspace status from any checkout.",
            "  nexus workspace docs-root [--root <dir>]   Print the resolved repo-relative docs root.",
            "  nexus workspace add-repo        Add the invoking checkout to an existing workspace.",
            "  nexus workspace github-defaults Print the hub's github-publishing defaults as JSON.",
        ].join("\n"),
        subverbs: WORKSPACE_SUBVERBS,
        run: runWorkspaceVerb,
    },
    "abs-doc-path": {
        summary: "Convert a repository-relative path to an absolute GitHub URL.",
        usage: [
            "  nexus abs-doc-path <relative-path> [<relative-path> ...]",
            "      Print the absolute GitHub URL for one or more repo-relative paths, one per line.",
        ].join("\n"),
        run: runAbsDocPath,
    },
    "epic-resolve": {
        summary: "Materialize an epic issue's stories and blocked_by graph as epic.md.",
        usage: [
            "  nexus epic-resolve --epic <N> [--out <path>] [--root <startDir>] [--require-epic]",
            "      Resolve epic issue #N and write the materialized epic.md.",
        ].join("\n"),
        run: runEpicResolve,
    },
    "record-digest": {
        summary: "Print the canonical digest and approval state of a decision-record sub-issue.",
        usage: [
            "  nexus record-digest --issue <N> [--repo <owner/repo>] [--dir <startDir>]",
            "      Print { issue, repo, state, stateReason, approved, digest }.",
        ].join("\n"),
        run: runRecordDigest,
    },
    "prose-verify": {
        summary: "Prove a translated artifact kept its machine-read regions byte-identical and every tracked item intact.",
        usage: [
            "  nexus prose-verify --before <path> --after <path> [--source <path>]...",
            "      Exit 0 when frontmatter, fenced blocks, HTML comments and Given/When/Then lines match,",
            "      and every number, modal, name-shaped token, heading, list item and table row survives.",
            "      --source names a grounding source, which is what permits an introduced item.",
        ].join("\n"),
        run: runProseVerify,
    },
    "razor-check": {
        summary: "Check a drafted artifact against the razor's mechanically decidable rules.",
        usage: [
            "  nexus razor-check --draft <path> --source <path>",
            "  nexus razor-check --draft <path> --assert-clean",
            "      Report every unlabelled item, broken counted limit, unresolved asked-citation and",
            "      personas table, exiting 1 when any finding blocks. With --assert-clean it instead",
            "      asserts that a derived filing body carries no provenance label, template placeholder",
            "      token or observation marker, so a drafting-time body is never filed.",
        ].join("\n"),
        run: runRazorCheck,
    },
    "pr-worktree": {
        summary: "Manage the git worktree for the --pr post-merge flow (analyze / close).",
        usage: [
            "  nexus pr-worktree preflight --pr <N> --mode analyze|close [--root <dir>]",
            "  nexus pr-worktree open --pr <N> --mode analyze|close [--branch <distill/...>] [--root <dir>]",
            "  nexus pr-worktree range --pr <N> [--root <dir>]",
            "      Print { repo, base, head } for a merged PR without creating a worktree.",
            "  nexus pr-worktree remove <wtPath> [--root <dir>]",
        ].join("\n"),
        subverbs: PR_WORKTREE_SUBVERBS,
        run: runPrWorktree,
    },
    "close-migration": {
        summary: "Retired (epic #215) — a member epic now closes from the hub over its merged pull requests.",
        usage: [
            "  nexus close-migration ...   RETIRED — every subcommand refuses and exits 1.",
            "      A member repository no longer closes its own epic and migrates the entry to the",
            "      hub. It closes from the hub, the same way a single repository does, over its",
            "      merged pull requests. This verb name and its former subcommands (preflight,",
            "      migrate) are kept only so a lead who still types them is told what replaced them.",
        ].join("\n"),
        run: runCloseMigration,
    },
    "close-role": {
        summary: "Report the checkout's close role (single-repo, hub, or member) and its repo identity.",
        usage: [
            "  nexus close-role [dir]",
            "      Print the role close would run in from the given checkout (default: the",
            "      current directory) and its normalized repo identity. Read-only.",
        ].join("\n"),
        run: runCloseRole,
    },
    "queue-relocate": {
        summary: "One-shot: relocate every stranded member-queue entry into the hub queue.",
        usage: [
            "  nexus queue-relocate [hub-dir]",
            "      Copy every present member's committed queue entries into the hub queue (default:",
            "      the current directory, which must be the hub), commit each path-scoped, and",
            "      verify byte for byte. Never removes the member-side copy; prints the removal",
            "      command for the lead to run separately. Idempotent.",
        ].join("\n"),
        run: runQueueRelocate,
    },
    "generate-atlas": {
        summary: "Regenerate the concept atlas from the concept store.",
        usage: [
            "  nexus generate-atlas [--concepts-dir <dir>] [--out <path>] [--check]",
            "      Write the concept atlas (or, with --check, verify it is up to date).",
        ].join("\n"),
        run: (argv) => Promise.resolve(runGenerateAtlas(argv)),
    },
    "validate-concepts": {
        summary: "Validate concept pages against the store's structural rules.",
        usage: [
            "  nexus validate-concepts [--concepts-dir <dir>] [--base <sha>] [--append-only-log] [<page> ...]",
            "      Validate concept pages, exiting non-zero on any blocking finding.",
            "      With --append-only-log (which needs --base), additionally enforce the razor: a",
            "      changed page must be byte-identical to its base ahead of the one log entry it gained.",
        ].join("\n"),
        run: (argv) => Promise.resolve(runValidateConcepts(argv)),
    },
    "derive-entry-diff": {
        summary: "Derive the merged diff a closed queue entry's decision record covers.",
        usage: [
            "  nexus derive-entry-diff --entry <queue-entry-dir> [--hub <hub-root>]",
            "      Print the per-repo diff the queue entry's recorded range covers.",
        ].join("\n"),
        run: (argv) => Promise.resolve(runDeriveEntryDiff(argv)),
    },
    "excluded-stores": {
        summary: "Print the pipeline stores every stage withholds from a derived diff.",
        usage: [
            "  nexus excluded-stores [--form pathspec|paths|reasons]",
            "      Print the one definition of the stores analyze, close and distill withhold from",
            "      the behavioural diff. --form pathspec (default) emits the git pathspec exclusions",
            "      to append to a `git diff -- .` invocation; --form paths emits one store path per",
            "      line; --form reasons adds why each store is a member. Ask for the set here rather",
            "      than writing the paths out, so no second statement of it can drift.",
        ].join("\n"),
        run: (argv, io) => Promise.resolve(runExcludedStores(argv, io)),
    },
    workbook: {
        summary: "Make a learner's workbook, render its lessons, and teach one lesson per sitting.",
        usage: [
            "  nexus workbook create <slug> [--root <dir>] [--repo <member>]",
            "  nexus workbook render <slug> [--root <dir>] [--repo <member>]",
            "  nexus workbook check <slug> [--root <dir>] [--repo <member>]",
            "  nexus workbook session <slug> [--root <dir>] [--repo <member>]",
            "  nexus workbook teach <slug> [--prose <file>] [--root <dir>] [--repo <member>]",
            "  nexus workbook handoff <slug> --story <story> [--note <why>] [--root <dir>]",
            "  nexus workbook resolve <slug> <handoff-id> [--root <dir>]",
            "      Create makes the committed workbook folder and ensures the one rule that",
            "      excludes the learner folder. Render turns every authored lesson under",
            "      lessons/ into a page beside it — the whole workbook or none of it. Check",
            "      re-renders and compares, so a committed page that was edited by hand or left",
            "      behind by a changed lesson fails rather than being read as current. Session is",
            "      what opening a workbook means: it lists every outstanding handoff and resumes",
            "      at the story that was handed off. Teach runs the teaching session: it sweeps",
            "      the probe's scratch path, runs the declared suite, verifies the fence on a",
            "      return, checks the next slice against the state it was pinned to, chooses the",
            "      drill, and then hands out a brief — re-run it with --prose <file> and it writes",
            "      that one lesson and opens it. In a workspace a workbook lives in the",
            "      member repository whose roadmap it teaches; --repo names it from the hub.",
        ].join("\n"),
        subverbs: WORKBOOK_SUBVERBS,
        run: (argv, io) => Promise.resolve(runWorkbookCli(argv, io)),
    },
    "drift-advisory": {
        summary: "Report concept pages whose domain filing looks stale.",
        usage: [
            "  nexus drift-advisory [--concepts-dir <dir>] [--registry <path>]",
            "      Print a drift-advisory report against the domain registry.",
        ].join("\n"),
        run: (argv) => Promise.resolve(runDriftAdvisory(argv)),
    },
    "seed-registry": {
        summary: "Draft a starter domain registry from the concept store.",
        usage: [
            "  nexus seed-registry [--concepts-dir <dir>] [--out-dir <dir>]",
            "      Write draft domain-registry files for a maintainer to review.",
        ].join("\n"),
        run: (argv) => Promise.resolve(runSeedRegistry(argv)),
    },
    config: {
        summary: "Resolve delivery configuration (the shared publishing resolver).",
        usage: [
            "  nexus config resolve <key> [--root <path>]      Resolve one github-block key through the precedence chain.",
            "  nexus config backlog-query [--form <form>]      Print the cross-feature backlog query (list | search | exclude).",
            "  nexus config detect-classification             Probe whether the repository exposes issue types.",
            "  nexus config write-github [--root <path>]      Seed absent github-block keys into settings.yml (add-only).",
        ].join("\n"),
        subverbs: CONFIG_SUBVERBS,
        run: (argv, io) => Promise.resolve(runConfig(argv, io)),
    },
    "create-epic": {
        summary: "File a GitHub issue from an epic document.",
        usage: [
            "  nexus create-epic <path-to-epic.md> [--yes] [--dry-run]",
            "      File the epic draft as a GitHub issue and record the number back on the draft.",
        ].join("\n"),
        run: (argv, io) => Promise.resolve(runCreateEpic(argv, io)),
    },
    "create-story": {
        summary: "File one GitHub issue per STORY-*.md work item.",
        usage: [
            "  nexus create-story <target-folder> [--yes] [--dry-run]",
            "      File one GitHub issue per STORY-*.md work item in the folder, resumably.",
        ].join("\n"),
        run: (argv, io) => Promise.resolve(runCreateStory(argv, io)),
    },
    "seed-templates": {
        summary: "Place the tool-agnostic templates the pipeline stages read into a repository.",
        usage: [
            "  nexus seed-templates [--target <dir>] [--masters <dir>]",
            "      Copy the templates the setup, decision-record and close stages read into",
            "      .nexus/config/templates/ in the target repo (default: the current directory).",
            "      Seeds only what is absent — a template your project has tuned is never",
            "      overwritten — so it is safe to re-run. The masters travel inside the release.",
        ].join("\n"),
        run: runSeedTemplates,
    },
};

/** The registered verb names, derived from the registry — never a hand-maintained duplicate. */
export const VERB_NAMES: readonly string[] = Object.keys(REGISTRY);

/**
 * Every complete dispatch name the executable answers to, derived from the same registry: a leaf
 * verb contributes its own name, and a verb that dispatches subverbs contributes one two-token
 * name per declared subverb instead of its bare self. This is the surface the invocation gate
 * checks a component body against (story #301).
 */
export const DISPATCH_NAMES: readonly string[] = Object.entries(REGISTRY).flatMap(([verb, entry]) =>
    entry.subverbs === undefined ? [verb] : entry.subverbs.map((sub) => `${verb} ${sub}`),
);

function composeUsage(): string {
    return ["usage: nexus <verb>", "", ...Object.values(REGISTRY).map((entry) => entry.usage + "\n")].join("\n").trimEnd();
}

const USAGE: string = composeUsage();

/**
 * `nexus excluded-stores` — the readable face of the one excluded-store definition (record #450,
 * invariant 4). Command bodies call this instead of listing store paths, so prose and code cannot
 * state the set differently.
 */
function runExcludedStores(argv: string[], io: CliIo): number {
    let form: string = "pathspec";
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--form") form = argv[++i] ?? "";
        else {
            io.stderr(`unknown argument for excluded-stores: ${argv[i]}\n${USAGE}`);
            return 2;
        }
    }
    if (form === "pathspec") {
        io.stdout(excludePathspecs().join(" "));
        return 0;
    }
    if (form === "paths") {
        for (const store of EXCLUDED_STORES) io.stdout(store.path);
        return 0;
    }
    if (form === "reasons") {
        for (const store of EXCLUDED_STORES) io.stdout(`${store.path} — ${store.why}`);
        return 0;
    }
    io.stderr(`unknown form '${form}' for excluded-stores (expected pathspec, paths or reasons)\n${USAGE}`);
    return 2;
}

/** Where the vendored payload lives when running as a distributed artifact. */
export function defaultPayloadDir(): string {
    return path.join(import.meta.dirname, COMPONENT_PAYLOAD_DIRNAME);
}

/** Where the template masters live when running as a distributed artifact (story #323). */
export function defaultTemplateMasterDir(): string {
    return path.join(import.meta.dirname, TEMPLATE_PAYLOAD_DIRNAME);
}

/** Extract `--flag value` pairs; returns null (after reporting) on a flag missing its value. */
function takeOption(argv: string[], flag: string, io: CliIo): { present: boolean; value?: string } | null {
    const index: number = argv.indexOf(flag);
    if (index === -1) {
        return { present: false };
    }
    const value: string | undefined = argv[index + 1];
    if (value === undefined) {
        io.stderr(`${flag} requires a value`);
        return null;
    }
    argv.splice(index, 2);
    return { present: true, value };
}

async function runDeploy(argv: string[], io: CliIo): Promise<number> {
    const rest: string[] = [...argv];
    const payloadOpt = takeOption(rest, "--payload", io);
    if (payloadOpt === null) {
        return 2;
    }
    const targetOpt = takeOption(rest, "--target", io);
    if (targetOpt === null) {
        return 2;
    }
    if (rest.length > 0) {
        io.stderr(`unknown argument for deploy: ${rest[0]}\n${USAGE}`);
        return 2;
    }

    const payloadDir: string = payloadOpt.value ?? defaultPayloadDir();
    const targetRepoRoot: string = targetOpt.value ?? io.cwd;

    let result: DeployResult;
    try {
        result = deployComponents(payloadDirectory(payloadDir), path.join(targetRepoRoot, REPO_COMPONENT_DIRNAME));
    } catch (error) {
        io.stderr(error instanceof Error ? error.message : String(error));
        return 1;
    }
    io.stdout(
        `deployed ${result.written.length} component file(s) into ${path.join(targetRepoRoot, REPO_COMPONENT_DIRNAME)}` +
            (result.removed.length > 0 ? `; removed ${result.removed.length} stale component file(s)` : ""),
    );
    return 0;
}

/**
 * `nexus seed-templates` — the arrival of the three tool-agnostic templates (story #323).
 *
 * Repo-bound on purpose: the templates belong to the project, not to the account, so this is not
 * part of `nexus install`, which writes once per account at a location no repository owns. It is
 * the step `/nxs.setup` runs, and the step its own body now names.
 */
async function runSeedTemplates(argv: string[], io: CliIo): Promise<number> {
    const rest: string[] = [...argv];
    const targetOpt = takeOption(rest, "--target", io);
    if (targetOpt === null) {
        return 2;
    }
    const mastersOpt = takeOption(rest, "--masters", io);
    if (mastersOpt === null) {
        return 2;
    }
    if (rest.length > 0) {
        io.stderr(`unknown argument for seed-templates: ${rest[0]}\n${USAGE}`);
        return 2;
    }

    const targetRepoRoot: string = path.resolve(io.cwd, targetOpt.value ?? io.cwd);
    let result: SeedTemplatesResult;
    try {
        result = seedTemplates(mastersOpt.value ?? defaultTemplateMasterDir(), targetRepoRoot);
    } catch (error) {
        io.stderr(error instanceof Error ? error.message : String(error));
        return 1;
    }
    io.stdout(
        `seeded ${result.seeded.length} template(s) into ${projectTemplateDir(targetRepoRoot)}` +
            (result.kept.length > 0 ? `; kept ${result.kept.length} the project already has (${result.kept.join(", ")})` : ""),
    );
    return 0;
}

/**
 * `nexus install` — the second, explicit step of getting Nexus onto an account (story #313).
 *
 * A package-manager lifecycle script was refuted: such scripts are blocked by default in this
 * project's package manager and commonly disabled in continuous integration, so a share of installs
 * would end silently with no component set and no error — and this step has to print text the user
 * must act on regardless.
 */
async function runInstall(argv: string[], io: CliIo): Promise<number> {
    const rest: string[] = [...argv];
    const payloadOpt = takeOption(rest, "--payload", io);
    if (payloadOpt === null) {
        return 2;
    }
    const checkoutOpt = takeOption(rest, "--from-checkout", io);
    if (checkoutOpt === null) {
        return 2;
    }
    if (rest.length > 0) {
        io.stderr(`unknown argument for install: ${rest[0]}\n${USAGE}`);
        return 2;
    }

    const location: InstallLocationResult = resolveInstallLocation();
    if (!location.ok) {
        io.stderr(location.message);
        return 1;
    }
    // Invariant 7: the location is named before anything changes.
    io.stdout(describeInstallLocation(location));

    const pointing: boolean = checkoutOpt.present;
    let payloadDir: string;
    if (pointing) {
        // Invariant 5: the derivation and the authored tree's location move together, so a
        // pointing install never looks in the directory the tree used to occupy.
        const checkout: string = path.resolve(io.cwd, checkoutOpt.value as string);
        payloadDir = checkoutComponentRoot(checkout);
        io.stdout(`pointing at checkout: ${checkout}`);
    } else {
        payloadDir = payloadOpt.value ?? defaultPayloadDir();
    }

    let result: DeployResult;
    try {
        ensureInstallLocation(location.path);
        result = deployComponents(payloadDirectory(payloadDir), location.path, { mode: pointing ? "pointer" : "copy" });
    } catch (error) {
        io.stderr(error instanceof Error ? error.message : String(error));
        return 1;
    }
    io.stdout(
        `installed ${result.written.length} component ${pointing ? "pointer(s)" : "file(s)"} at ${location.path}` +
            (result.removed.length > 0 ? `; removed ${result.removed.length} stale component file(s)` : ""),
    );
    for (const line of allowlistNoticeLines()) {
        io.stdout(line);
    }
    return 0;
}

/**
 * `nexus uninstall` — the removal half of the account's one component set (story #314).
 *
 * Removal is the same mirror as install, with emptiness DECLARED rather than expressed as a
 * directory that happens to be empty. That distinction is the safety hinge of the epic: the mirror
 * throws when a payload directory cannot be found, and that throw is the only thing separating "the
 * install could not find what it ships" from "delete every component this account has". The
 * primitive's throw-on-missing-directory behaviour is therefore satisfied here, not changed.
 */
async function runUninstall(argv: string[], io: CliIo): Promise<number> {
    if (argv.length > 0) {
        io.stderr(`unknown argument for uninstall: ${argv[0]}\n${USAGE}`);
        return 2;
    }

    const location: InstallLocationResult = resolveInstallLocation();
    if (!location.ok) {
        io.stderr(location.message);
        return 1;
    }
    // Invariant 7: the location AND what it holds are named before anything is removed — in the
    // pointing mode that means naming the checkout, since this verb removes every pointer at it.
    io.stdout(describeInstallLocation(location));
    io.stdout(describeInstalledContent(inspectInstallLocation(location.path)));

    let result: DeployResult;
    try {
        result = deployComponents(EMPTY_PAYLOAD, location.path);
    } catch (error) {
        io.stderr(error instanceof Error ? error.message : String(error));
        return 1;
    }
    io.stdout(`removed ${result.removed.length} component file(s) from ${location.path}`);
    io.stdout(
        "Run this before removing the package itself: this verb ships inside the package, and the " +
            "package manager has no record of a component set copied into the configuration directory, " +
            "so removing the package first leaves the components behind with nothing left to clear them.",
    );
    return 0;
}

/**
 * `nexus migrate-components` — the gated repository migration (story #315).
 *
 * The gate is the point: an owner whose repository loses forty tracked files must have somewhere
 * for the components to come from, so nothing is removed until an install location resolves and is
 * populated, and the verb says what that location holds before it touches anything.
 */
async function runMigrateComponents(argv: string[], io: CliIo): Promise<number> {
    const rest: string[] = [...argv];
    const targetOpt = takeOption(rest, "--target", io);
    if (targetOpt === null) {
        return 2;
    }
    if (rest.length > 0) {
        io.stderr(`unknown argument for migrate-components: ${rest[0]}\n${USAGE}`);
        return 2;
    }
    const repoRoot: string = path.resolve(io.cwd, targetOpt.value ?? ".");

    const location: InstallLocationResult = resolveInstallLocation();
    if (!location.ok) {
        io.stderr(`${location.message} Nothing was removed; install the components first with \`nexus install\`.`);
        return 1;
    }
    // Invariant 7 and 9: the location and its content are reported before anything changes.
    io.stdout(describeInstallLocation(location));

    const state: InstallLocationState = inspectInstallLocation(location.path);
    if (!state.populated) {
        io.stderr(
            `the install location holds no Nexus component set, so nothing was removed. ` +
                `Install the components first with \`nexus install\`.`,
        );
        return 1;
    }
    io.stdout(describeInstalledContent(state));

    const result: MigrationResult = migrateComponents({ repoRoot });
    if (!result.ok) {
        io.stderr(result.message);
        return 1;
    }

    io.stdout(`removed ${result.removed.length} tracked component file(s) from ${path.join(repoRoot, REPO_COMPONENT_DIRNAME)}`);
    if (result.untracked.length > 0) {
        io.stdout(
            `left in place ${result.untracked.length} Nexus-namespaced file(s) git does not track — ` +
                `git cannot undo their removal, so remove them yourself if you want them gone:`,
        );
        for (const rel of result.untracked) {
            io.stdout(`    rm ${path.join(REPO_COMPONENT_DIRNAME, rel)}`);
        }
    }
    io.stdout(
        result.ignoreAdded.length > 0
            ? `added ${result.ignoreAdded.length} namespaced ignore entr(ies) to .gitignore`
            : "the namespaced ignore entries were already present in .gitignore",
    );
    io.stdout("Nothing was staged and no commit was made. To accept these changes:");
    for (const command of result.gitCommands) {
        io.stdout(`    ${command}`);
    }
    return 0;
}

/**
 * The component payload this artifact would deploy. A distributable carries it vendored beside
 * the bundle; a source checkout has no vendored copy, and there the authored component tree is
 * the payload — it is the same tree the vendor step hashes into the fingerprint pin, so both
 * postures report the fingerprint of the components that would actually be installed.
 */
function resolvedPayloadDir(): string | null {
    const vendored: string = defaultPayloadDir();
    if (fs.existsSync(vendored)) {
        return vendored;
    }
    const live: string = authoredComponentRoot(import.meta.dirname);
    return fs.existsSync(live) ? live : null;
}

/**
 * What the account's install location currently holds, for the version read-out (story #319 AC3).
 *
 * The maintainer's loop runs through a pointing install, and the only thing that distinguishes a
 * working loop from a stale copy is which checkout the pointers name — so the read-out reports the
 * content and names the checkout rather than leaving the maintainer to inspect the links by hand.
 * A location that cannot be resolved is reported as unresolved, not raised: `version` is what a
 * user runs when the environment is already broken.
 */
function reportedInstallLocation(): {
    path: string | null;
    source: string | null;
    content: InstalledContent | null;
    checkout: string | null;
} {
    const location: InstallLocationResult = resolveInstallLocation();
    if (!location.ok) {
        return { path: null, source: null, content: null, checkout: null };
    }
    const state: InstallLocationState = inspectInstallLocation(location.path);
    return { path: location.path, source: location.source, content: state.content, checkout: state.checkout };
}

/**
 * `nexus version` — the release identity as one JSON object on standard output, the existing
 * verb contract. Never non-zero for an environment defect (AC3); only a usage error.
 */
async function runVersion(argv: string[], io: CliIo): Promise<number> {
    if (argv.length > 0) {
        io.stderr(`unknown argument for version: ${argv[0]}\n${USAGE}`);
        return 2;
    }
    const payloadDir: string | null = resolvedPayloadDir();
    io.stdout(
        JSON.stringify({
            version: releaseVersion(),
            componentPayload: payloadDir === null ? null : hashComponentTree(payloadDir),
            installLocation: reportedInstallLocation(),
        }),
    );
    return 0;
}

interface Prompter {
    ask: (question: string) => Promise<string>;
    close: () => void;
}

/**
 * Interactive prompt over stdin that also works when answers arrive piped in one chunk:
 * every line is buffered as it arrives, so a line emitted between two questions is consumed
 * by the next question instead of being dropped (readline/promises.question loses it).
 * A closed stdin resolves pending and future questions with "" — every prompt treats an
 * empty answer as "abort/decline", so an exhausted pipe can never confirm anything.
 */
function makeStdinPrompter(): Prompter {
    const rl = readline.createInterface({ input: process.stdin });
    const buffered: string[] = [];
    const waiters: Array<(answer: string) => void> = [];
    let closed = false;
    rl.on("line", (line: string): void => {
        const waiter = waiters.shift();
        if (waiter !== undefined) {
            waiter(line);
        } else {
            buffered.push(line);
        }
    });
    rl.on("close", (): void => {
        closed = true;
        while (waiters.length > 0) {
            waiters.shift()?.("");
        }
    });
    return {
        ask: (question: string): Promise<string> => {
            process.stdout.write(question);
            const ready: string | undefined = buffered.shift();
            if (ready !== undefined) {
                return Promise.resolve(ready);
            }
            if (closed) {
                return Promise.resolve("");
            }
            return new Promise<string>((resolve) => {
                waiters.push(resolve);
            });
        },
        close: (): void => {
            rl.close();
        },
    };
}

async function runWorkspaceVerb(argv: string[], io: CliIo): Promise<number> {
    const [sub, ...rest] = argv;

    // The one gate on the subverb name, read from the registry's own declaration. Everything
    // below it is a declared subverb, so the last branch needs no condition.
    if (sub === undefined || !WORKSPACE_SUBVERBS.includes(sub)) {
        io.stderr(sub === undefined ? USAGE : `unknown workspace verb '${sub}'\n${USAGE}`);
        return 2;
    }

    if (sub === "init") {
        if (rest.length > 0) {
            io.stderr(`unknown argument for workspace init: ${rest[0]}\n${USAGE}`);
            return 2;
        }
        const prompter: Prompter = makeStdinPrompter();
        try {
            return await runWorkspaceInit({
                cwd: io.cwd,
                stdout: io.stdout,
                stderr: io.stderr,
                ask: prompter.ask,
            });
        } finally {
            prompter.close();
        }
    }
    if (sub === "add-repo") {
        if (rest.length > 0) {
            io.stderr(`unknown argument for workspace add-repo: ${rest[0]}\n${USAGE}`);
            return 2;
        }
        return runWorkspaceAddRepo(io);
    }
    if (sub === "status") {
        const { root, rest: extra } = takeTargetRoot(rest, io.cwd);
        if (extra.length > 0) {
            io.stderr(`unknown argument for workspace status: ${extra[0]}\n${USAGE}`);
            return 2;
        }
        // The identical code path the in-repo status skill runs: resolve, render, exit by
        // result. Read-only by construction — the resolver never clones, fetches, or writes.
        const result: ResolveResult = resolveWorkspace(root);
        (result.ok ? io.stdout : io.stderr)(renderWorkspaceStatus(result));
        return result.ok ? 0 : 1;
    }
    if (sub === "github-defaults") {
        if (rest.length > 0) {
            io.stderr(`unknown argument for workspace github-defaults: ${rest[0]}\n${USAGE}`);
            return 2;
        }
        // The seam the Python publishing resolver reads for the `hub` layer of its precedence chain
        // (epic #121, STORY-121.05). Resolve the workspace from the invoking checkout — from a
        // member this finds the hub and reads its manifest — and print the hub's github defaults as
        // a JSON object. Single-repo (no workspace artifact) prints `{}`; a resolver diagnostic
        // prints `{}` on stdout AND the diagnostic on stderr with exit 1, so a caller that only
        // reads stdout treats an unresolved workspace as "no defaults" rather than crashing.
        const result: ResolveResult = resolveWorkspace(io.cwd);
        if (!result.ok) {
            io.stdout("{}");
            io.stderr(renderWorkspaceStatus(result));
            return 1;
        }
        const github = result.workspace.mode === "workspace" ? (result.workspace.github ?? {}) : {};
        io.stdout(JSON.stringify(github));
        return 0;
    }
    // sub === "docs-root", the last declared subverb.
    {
        const { root, rest: extra } = takeTargetRoot(rest, io.cwd);
        if (extra.length > 0) {
            io.stderr(`unknown argument for workspace docs-root: ${extra[0]}\n${USAGE}`);
            return 2;
        }
        // The single-value view over the resolver: print only the resolved repo-relative docs
        // root, or the resolver's named diagnostic on failure (never a silent "docs"). The
        // in-repo docs_root.ts script runs this identical selector. Read-only by construction.
        const result = localDocsRoot(root);
        if (!result.ok) {
            io.stderr(renderWorkspaceStatus(result));
            return 1;
        }
        io.stdout(result.docsRoot);
        return 0;
    }
}

/**
 * `nexus abs-doc-path` — the in-repo vehicle is `get_abs_doc_path.ts`, kept byte-identical
 * (same messages, same exit codes 0/1/3) so the migration-axis parity gate reports no divergence.
 */
async function runAbsDocPath(argv: string[], io: CliIo): Promise<number> {
    if (argv.length < 1) {
        io.stderr("Usage: tsx get_abs_doc_path.ts <relative-path>");
        io.stderr("       tsx get_abs_doc_path.ts <path1> <path2> ...");
        return 3;
    }

    const result = resolveAbsDocPath(io.cwd, argv);
    if (!result.ok) {
        io.stderr(result.message);
        return 1;
    }

    for (const url of result.urls) {
        io.stdout(url);
    }
    return 0;
}

interface EpicResolveFlags {
    epic?: number;
    out?: string;
    root: string;
    requireEpic: boolean;
}

function parseEpicResolveFlags(argv: string[], cwd: string): EpicResolveFlags {
    const { root, rest } = takeTargetRoot(argv, cwd);
    const flags: EpicResolveFlags = { requireEpic: false, root };
    for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === "--epic") flags.epic = Number(rest[++i]);
        else if (a === "--out") flags.out = rest[++i];
        else if (a === "--require-epic") flags.requireEpic = true;
    }
    return flags;
}

/** The repo whose issues to query: the workspace hub, or the single-repo checkout. */
function epicResolveTargetRoot(startDir: string, io: CliIo): string | null {
    const resolved = resolveWorkspace(startDir);
    if (!resolved.ok) {
        io.stderr(renderWorkspaceStatus(resolved));
        return null;
    }
    return resolved.workspace.mode === "workspace" ? resolved.workspace.hubRoot : resolved.workspace.root;
}

/**
 * `nexus epic-resolve` — the in-repo vehicle is `epic_resolve.ts`, kept byte-identical (including
 * its usage/diagnostic text) so the migration-axis parity gate reports no divergence.
 */
async function runEpicResolve(argv: string[], io: CliIo): Promise<number> {
    const flags: EpicResolveFlags = parseEpicResolveFlags(argv, io.cwd);
    if (flags.epic === undefined || Number.isNaN(flags.epic) || flags.epic <= 0) {
        io.stderr("usage: epic_resolve.ts --epic <N> [--out <path>] [--root <startDir>] [--require-epic]");
        return 2;
    }

    const root: string | null = epicResolveTargetRoot(flags.root, io);
    if (root === null) {
        return 1;
    }

    const resolved = resolveEpic(closeMigrationRunner, root, flags.epic, { requireEpic: flags.requireEpic });
    if (!resolved.ok) {
        io.stderr(renderEpicResolveDiagnostic(resolved.error));
        return 1;
    }

    const outPath: string = writeMaterializedEpic(root, flags.epic, resolved.markdown, flags.out);
    io.stdout(JSON.stringify({ epic: flags.epic, targetRoot: root, outPath, record: resolved.record }));
    return 0;
}

interface RecordDigestFlags {
    issue?: number;
    repo?: string;
    dir?: string;
}

function parseRecordDigestFlags(argv: string[]): RecordDigestFlags {
    const flags: RecordDigestFlags = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--issue") flags.issue = Number(argv[++i]);
        else if (a === "--repo") flags.repo = argv[++i];
        else if (a === "--dir") flags.dir = argv[++i];
    }
    return flags;
}

/**
 * `nexus record-digest` — the in-repo vehicle is `record_digest.ts`, kept byte-identical so the
 * migration-axis parity gate reports no divergence.
 */
async function runRecordDigest(argv: string[], io: CliIo): Promise<number> {
    const flags: RecordDigestFlags = parseRecordDigestFlags(argv);
    if (flags.issue === undefined || Number.isNaN(flags.issue) || flags.issue <= 0) {
        io.stderr("usage: record_digest.ts --issue <N> [--repo <owner/repo>] [--dir <startDir>]");
        return 2;
    }

    const result = fetchRecord(closeMigrationRunner, flags.dir ?? io.cwd, flags.issue, flags.repo ?? null);
    if (!result.ok) {
        io.stderr(`record-digest ${result.error.problem}: ${result.error.message}`);
        return 1;
    }

    const { issue, repo, state, stateReason, approved, digest } = result.record;
    io.stdout(JSON.stringify({ issue, repo, state, stateReason, approved, digest }));
    return 0;
}

interface ProseVerifyFlags {
    before?: string;
    after?: string;
    /** The grounding sources the run named, in the order they were given. Repeatable. */
    sources: string[];
}

function parseProseVerifyFlags(argv: string[]): ProseVerifyFlags {
    const flags: ProseVerifyFlags = { sources: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--before") flags.before = argv[++i];
        else if (a === "--after") flags.after = argv[++i];
        else if (a === "--source") flags.sources.push(argv[++i]);
    }
    return flags;
}

/**
 * `nexus prose-verify` — the deterministic half of the prose-translation contract (stories #417 and
 * #423). A shipped component body invokes it by this name, so the component-invocation gate
 * resolves it against the declared surface rather than against a repository-relative script.
 *
 * One invocation returns one verdict covering both properties the contract claims: the machine-read
 * regions are byte-identical, and every tracked item survived. `--source` is repeatable and names
 * the grounding sources the translator was handed, which is what makes an introduced item
 * permissible; a run that names none permits no introduction at all.
 */
async function runProseVerify(argv: string[], io: CliIo): Promise<number> {
    const flags: ProseVerifyFlags = parseProseVerifyFlags(argv);
    if (flags.before === undefined || flags.after === undefined) {
        io.stderr("usage: nexus prose-verify --before <path> --after <path> [--source <path>]...");
        return 2;
    }

    const result: VerifyResult = verifyTranslation(
        (target: string) => fs.readFileSync(path.resolve(io.cwd, target), "utf8"),
        flags.before,
        flags.after,
        flags.sources,
    );
    if (!result.ok) {
        io.stderr(renderVerifyResult(result));
        return 1;
    }
    io.stdout(renderVerifyResult(result));
    return 0;
}

interface RazorCheckFlags {
    draft?: string;
    source?: string;
    assertClean: boolean;
}

function parseRazorCheckFlags(argv: string[]): RazorCheckFlags {
    const flags: RazorCheckFlags = { assertClean: false };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--draft") flags.draft = argv[++i];
        else if (argv[i] === "--source") flags.source = argv[++i];
        else if (argv[i] === "--assert-clean") flags.assertClean = true;
    }
    return flags;
}

/**
 * `nexus razor-check` — the razor's one mechanical enforcer (epic #284). Every consumer of a
 * counted limit, a citation comparison or a token-survival assertion invokes this verb rather than
 * restating the rule, which is what makes "the same rules in four places" true instead of asserted.
 *
 * `--assert-clean` is the gate between a labelled draft and a filed issue body: it fails on any
 * surviving drafting-time token — a provenance label, a template placeholder, or a gate's
 * observation marker — so leakage is a checked condition and not something a drafting model has to
 * remember.
 */
async function runRazorCheck(argv: string[], io: CliIo): Promise<number> {
    const flags: RazorCheckFlags = parseRazorCheckFlags(argv);
    if (flags.draft === undefined || (!flags.assertClean && flags.source === undefined)) {
        io.stderr("usage: nexus razor-check --draft <path> (--source <path> | --assert-clean)");
        return 2;
    }

    const readOr = (target: string): string | undefined => {
        try {
            return fs.readFileSync(path.resolve(io.cwd, target), "utf8");
        } catch {
            io.stderr(`razor-check: cannot read ${target}`);
            return undefined;
        }
    };

    const body: string | undefined = readOr(flags.draft);
    if (body === undefined) return 1;

    if (flags.assertClean) {
        const findings: RazorFinding[] = survivingTokens(body);
        if (findings.length > 0) {
            io.stderr(renderSurvivingTokens(flags.draft, findings));
            return 1;
        }
        io.stdout(`razor-check: ${flags.draft} carries no drafting-time token`);
        return 0;
    }

    const sourceText: string | undefined = readOr(flags.source as string);
    if (sourceText === undefined) return 1;

    const findings: RazorRuleFinding[] = checkDraft(body, sourceText);
    const report: string = renderRazorFindings(flags.draft, findings);
    if (findings.some((f: RazorRuleFinding) => f.severity === "blocking")) {
        io.stderr(report);
        return 1;
    }
    io.stdout(report);
    return 0;
}

interface PrWorktreeFlags {
    pr?: number;
    mode?: string;
    branch?: string;
    root: string;
    positional: string[];
}

function parsePrWorktreeFlags(argv: string[], cwd: string): PrWorktreeFlags {
    const { root, rest } = takeTargetRoot(argv, cwd);
    const flags: PrWorktreeFlags = { root, positional: [] };
    for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === "--pr") flags.pr = Number(rest[++i]);
        else if (a === "--mode") flags.mode = rest[++i];
        else if (a === "--branch") flags.branch = rest[++i];
        else flags.positional.push(a);
    }
    return flags;
}

/**
 * `nexus pr-worktree` — the in-repo vehicle is `pr_worktree.ts`, kept byte-identical (same
 * subcommands, same JSON shapes, same exit codes) so the migration-axis parity gate reports no
 * divergence.
 */
async function runPrWorktree(argv: string[], io: CliIo): Promise<number> {
    const [subcommand, ...rest] = argv;
    const flags: PrWorktreeFlags = parsePrWorktreeFlags(rest, io.cwd);

    // The subverb gate, read from the registry's own declaration (story #301).
    if (subcommand === undefined || !PR_WORKTREE_SUBVERBS.includes(subcommand)) {
        io.stderr("usage: pr_worktree.ts <preflight|open --pr <N> --mode analyze|close [--branch <b>] | range --pr <N> | remove <wtPath>>");
        return 2;
    }

    // `range` needs no mode and creates no worktree: it is the read the fix lane wants, where a
    // checkout would be built and torn down for one JSON object.
    if (subcommand === "range") {
        if (flags.pr === undefined || Number.isNaN(flags.pr)) {
            io.stderr("usage: pr_worktree.ts range --pr <N>");
            return 2;
        }
        const read = readRange(closeMigrationRunner, flags.root, flags.pr);
        if (!read.ok) {
            io.stderr(renderPrWorktreeDiagnostic(read.error));
            return 1;
        }
        io.stdout(JSON.stringify({ command: "range", range: read.range }));
        return 0;
    }

    if (subcommand === "preflight" || subcommand === "open") {
        if (flags.pr === undefined || Number.isNaN(flags.pr)) {
            io.stderr(`usage: pr_worktree.ts ${subcommand} --pr <N> --mode analyze|close`);
            return 2;
        }
        if (flags.mode !== "analyze" && flags.mode !== "close") {
            io.stderr(`usage: pr_worktree.ts ${subcommand} --pr <N> --mode analyze|close`);
            return 2;
        }

        const role = resolveRole(flags.root);
        if (!role.ok) {
            io.stderr(renderPrWorktreeDiagnostic(role.error));
            return 1;
        }
        const { repoRoot, repoIdentity, role: roleName } = role.resolved;
        const requireMerged: boolean = flags.mode === "close";
        const pr = resolvePr(closeMigrationRunner, repoRoot, flags.pr, { requireMerged });
        if (!pr.ok) {
            io.stderr(renderPrWorktreeDiagnostic(pr.error));
            return 1;
        }

        if (subcommand === "preflight") {
            io.stdout(
                JSON.stringify({
                    command: "preflight",
                    role: roleName,
                    repoRoot,
                    repoIdentity,
                    pr: {
                        number: pr.pr.number,
                        state: pr.pr.state,
                        merged: pr.pr.merged,
                        base: pr.pr.base,
                        head: pr.pr.head,
                        mergeCommitOid: pr.pr.mergeCommitOid,
                        commitCount: pr.pr.commitCount,
                        url: pr.pr.url,
                        crossRepo: pr.pr.crossRepo,
                        authorLogin: pr.pr.authorLogin,
                    },
                }),
            );
            return 0;
        }

        // subcommand === "open"
        if (flags.mode === "analyze") {
            const wt = openAnalyzeWorktree(closeMigrationRunner, repoRoot, flags.pr);
            if (!wt.ok) {
                io.stderr(renderPrWorktreeDiagnostic(wt.error));
                return 1;
            }
            io.stdout(
                JSON.stringify({ command: "open", mode: "analyze", wtPath: wt.wtPath, analyzedHead: wt.head, base: pr.pr.base, repoIdentity }),
            );
            return 0;
        }

        // open close
        if (!flags.branch) {
            io.stderr("usage: pr_worktree.ts open --pr <N> --mode close --branch <distill/...>");
            return 2;
        }
        const wt = openCloseWorktree(closeMigrationRunner, repoRoot, flags.branch);
        if (!wt.ok) {
            io.stderr(renderPrWorktreeDiagnostic(wt.error));
            return 1;
        }
        // Fetch the PR head into the shared object store so the range can be verified
        // (disambiguates squash vs rebase). Best-effort — a deleted branch leaves it undefined.
        const prHead: string | undefined = fetchPrHead(closeMigrationRunner, repoRoot, flags.pr);
        const range = deriveRange(closeMigrationRunner, wt.wtPath, pr.pr, { verifyAgainstPrHead: prHead });
        if (!range.ok) {
            io.stderr(renderPrWorktreeDiagnostic(range.error));
            return 1;
        }
        io.stdout(
            JSON.stringify({
                command: "open",
                mode: "close",
                wtPath: wt.wtPath,
                range: { repo: repoIdentity, base: range.range.base, head: range.range.head },
            }),
        );
        return 0;
    }

    // subcommand === "remove", the last declared subverb.
    const wtPath: string | undefined = flags.positional[0];
    if (!wtPath) {
        io.stderr("usage: pr_worktree.ts remove <wtPath>");
        return 2;
    }
    const r = removeWorktree(closeMigrationRunner, flags.root, wtPath);
    if (!r.ok) {
        io.stderr(renderPrWorktreeDiagnostic(r.error));
        return 1;
    }
    io.stdout(JSON.stringify({ command: "remove", wtPath, removed: true }));
    return 0;
}

/**
 * `nexus close-migration` — retired (epic #215). The close-and-migrate path it fronted is gone:
 * a member repository closes from the hub over its merged pull requests, the same way a single
 * repository closes, with no member-specific step. Every subcommand — and no subcommand at all —
 * hits this same refusal; nothing here dispatches any more.
 */
async function runCloseMigration(_argv: string[], io: CliIo): Promise<number> {
    io.stderr(
        "close-migration is retired: a member epic no longer closes on its feature branch and " +
            "migrates the entry to the hub. It closes from the hub, over its merged pull requests, " +
            "the same way a single repository closes. Run /nxs.close from the hub instead.",
    );
    return 1;
}

/**
 * `nexus close-role` — the role-gate half of the retired `close-migration preflight` (epic #215):
 * every caller that only ever wanted the role and repo identity (never the migration arming)
 * keeps a CLI seam to it.
 */
async function runCloseRole(argv: string[], io: CliIo): Promise<number> {
    const result = closePreflight(argv[0] ?? io.cwd);
    if (!result.ok) {
        io.stderr(`close-role ${result.error.problem}: ${result.error.message}`);
        return 1;
    }
    const { role, repo } = result.preflight;
    io.stdout(`role: ${role}\nrepo: ${repo.identity} (from ${repo.source})`);
    return 0;
}

/** `nexus queue-relocate` — the one-shot relocation of stranded member-queue entries (story #510). */
async function runQueueRelocate(argv: string[], io: CliIo): Promise<number> {
    const root = argv[0] ? path.resolve(io.cwd, argv[0]) : io.cwd;
    const result = relocateQueue(root);
    if (!result.ok) {
        io.stderr(renderRelocateFailure(result.errors));
        return 1;
    }
    io.stdout(renderRelocateOutcome(result.outcome));
    return 0;
}

/**
 * What a run may vary. The registry is a parameter because the environment guard's coverage is a
 * property of *this* function rather than of any verb — a verb the guard has never heard of is
 * covered by being dispatched here, and that is only demonstrable if a verb can be dispatched that
 * the registry above does not contain.
 */
export interface CliOverrides {
    registry?: Record<string, VerbEntry>;
    /** The account home the environment guard resolves component sets against. */
    home?: string;
}

/** Run the CLI against explicit argv (no leading node/script segments) and IO. */
export async function runNexusCli(argv: string[], io: CliIo, overrides: CliOverrides = {}): Promise<number> {
    const registry: Record<string, VerbEntry> = overrides.registry ?? REGISTRY;
    const [verb, ...rest] = argv;

    if (verb === "--help" || verb === "help") {
        io.stdout(USAGE);
        return 0;
    }
    if (verb === undefined) {
        io.stderr(USAGE);
        return 2;
    }
    const entry: VerbEntry | undefined = registry[verb];
    if (entry === undefined) {
        io.stderr(`unknown verb '${verb}'\n${USAGE}`);
        return 2;
    }

    // The guard reports before the verb runs, on standard error only, and its findings never reach
    // the return value: the code below is the verb's own, whatever the environment looks like.
    makeEnvironmentGuard(io, detectEnvironmentDefects({ cwd: io.cwd, home: overrides.home })).report();
    return entry.run(rest, io);
}

async function main(): Promise<void> {
    const io: CliIo = {
        cwd: process.cwd(),
        stdout: (line: string): void => {
            process.stdout.write(line + "\n");
        },
        stderr: (line: string): void => {
            process.stderr.write(line + "\n");
        },
    };
    process.exit(await runNexusCli(process.argv.slice(2), io));
}

if (isDirectRun(import.meta.url, process.argv[1])) {
    main();
}
