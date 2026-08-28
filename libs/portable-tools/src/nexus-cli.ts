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
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { resolveAbsDocPath } from "@nexus/abs-doc-path/resolve";
import { migrateEntry } from "@nexus/close-migration/migrate";
import { closePreflight } from "@nexus/close-migration/preflight";
import {
    renderMigrateOutcome,
    renderMigrationFailure,
    renderPreflight,
} from "@nexus/close-migration/render";
import { defaultRunner as closeMigrationRunner, git } from "@nexus/close-migration/run";
import { renderDiagnostic as renderEpicResolveDiagnostic } from "@nexus/epic-resolve/render";
import { resolveEpic } from "@nexus/epic-resolve/resolve";
import { writeMaterializedEpic } from "@nexus/epic-resolve/write";
import { resolveRole } from "@nexus/pr-worktree/identity";
import { resolvePr } from "@nexus/pr-worktree/pr";
import { deriveRange } from "@nexus/pr-worktree/range";
import { renderDiagnostic as renderPrWorktreeDiagnostic } from "@nexus/pr-worktree/render";
import { openAnalyzeWorktree, openCloseWorktree, removeWorktree } from "@nexus/pr-worktree/worktree";
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
import { detectEnvironmentDefects, makeEnvironmentGuard, resolveInterpreter } from "./environment-guard.js";
import { runCli as runDeriveEntryDiff } from "./derive-entry-diff.js";
import { runCli as runDriftAdvisory } from "./drift-advisory.js";
import { runCli as runGenerateAtlas } from "./generate-atlas.js";
import { runCli as runSeedRegistry } from "./seed-registry.js";
import { runCli as runValidateConcepts } from "./validate-concepts.js";
import { releaseVersion } from "./release.js";
import { authoredComponentRoot, checkoutComponentRoot, COMPONENT_PAYLOAD_DIRNAME, hashComponentTree } from "./vendor-components.js";
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
const PR_WORKTREE_SUBVERBS: readonly string[] = ["preflight", "open", "remove"];
const CLOSE_MIGRATION_SUBVERBS: readonly string[] = ["preflight", "migrate"];

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
            "      Idempotent. Writes no settings file; it prints the permission entries to add.",
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
        summary: "Report the installed release, its component payload and the resolved interpreter.",
        usage: [
            "  nexus version",
            "      Print { version, componentPayload, python } — the release's one semantic version,",
            "      the component payload's fingerprint, and the resolved python3 and its version.",
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
    "pr-worktree": {
        summary: "Manage the git worktree for the --pr post-merge flow (analyze / close).",
        usage: [
            "  nexus pr-worktree preflight --pr <N> --mode analyze|close [--root <dir>]",
            "  nexus pr-worktree open --pr <N> --mode analyze|close [--branch <distill/...>] [--root <dir>]",
            "  nexus pr-worktree remove <wtPath> [--root <dir>]",
        ].join("\n"),
        subverbs: PR_WORKTREE_SUBVERBS,
        run: runPrWorktree,
    },
    "close-migration": {
        summary: "Migrate a closed queue entry from a member repo into the workspace hub.",
        usage: [
            "  nexus close-migration preflight [dir]",
            "  nexus close-migration migrate <entry-dir>",
        ].join("\n"),
        subverbs: CLOSE_MIGRATION_SUBVERBS,
        run: runCloseMigration,
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
            "  nexus validate-concepts [--concepts-dir <dir>] [--base <sha>] [<page> ...]",
            "      Validate concept pages, exiting non-zero on any blocking finding.",
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

/** Where the vendored payload lives when running as a distributed artifact. */
export function defaultPayloadDir(): string {
    return path.join(import.meta.dirname, COMPONENT_PAYLOAD_DIRNAME);
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
            python: resolveInterpreter(),
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
        io.stderr("usage: pr_worktree.ts <preflight|open --pr <N> --mode analyze|close [--branch <b>] | remove <wtPath>>");
        return 2;
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
        const fetched = closeMigrationRunner("git", ["fetch", "origin", `pull/${flags.pr}/head`], { cwd: repoRoot });
        const prHead: string | undefined =
            fetched.status === 0 ? (git(closeMigrationRunner, repoRoot, "rev-parse", "--verify", "FETCH_HEAD") ?? undefined) : undefined;
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
 * `nexus close-migration` — the in-repo vehicle is `close_migration.ts`, kept byte-identical
 * (including the preflight-failure message going to stdout, matching the script's own choice) so
 * the migration-axis parity gate reports no divergence.
 */
async function runCloseMigration(argv: string[], io: CliIo): Promise<number> {
    const [subcommand, arg] = argv;

    // The subverb gate, read from the registry's own declaration (story #301).
    if (subcommand === undefined || !CLOSE_MIGRATION_SUBVERBS.includes(subcommand)) {
        io.stderr("usage: close_migration.ts <preflight [dir] | migrate <entry-dir>>");
        return 2;
    }

    if (subcommand === "preflight") {
        const result = closePreflight(arg ?? io.cwd);
        if (!result.ok) {
            io.stdout(renderMigrationFailure(result.error));
            return 1;
        }
        io.stdout(renderPreflight(result.preflight));
        return 0;
    }

    // subcommand === "migrate", the last declared subverb.
    if (!arg) {
        io.stderr("usage: close_migration.ts migrate <entry-dir>");
        return 2;
    }
    const result = migrateEntry(arg);
    if (!result.ok) {
        io.stdout(renderMigrationFailure(result.error));
        return 1;
    }
    io.stdout(renderMigrateOutcome(result.outcome));
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
