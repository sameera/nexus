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
import { defaultRunner as closeMigrationRunner, git } from "@nexus/workspace/run";
import { closePreflight } from "@nexus/workspace/close-role";
import { relocateQueue, renderRelocateFailure, renderRelocateOutcome } from "./queue-relocate.js";
import { resolveKindClassification } from "@nexus/epic-resolve/classify";
import { resolveRepoSlug, type RepoSlug } from "@nexus/epic-resolve/gh";
import { renderDiagnostic as renderEpicResolveDiagnostic } from "@nexus/epic-resolve/render";
import { resolveEpic } from "@nexus/epic-resolve/resolve";
import { defaultOutPath, writeMaterializedEpic } from "@nexus/epic-resolve/write";
import { ensurePlanningDir, listPlanningDirs, removePlanningDir } from "@nexus/epic-resolve/planning-dir";
import { resolveEpicVerdicts, type ResolveEpicVerdictsResult } from "@nexus/epic-verdicts/aggregate";
import { combinedChangeSet } from "@nexus/epic-verdicts/combined";
import { checkEpicCurrency } from "@nexus/epic-verdicts/currency";
import { isExcludedStory, waiveStory } from "@nexus/epic-verdicts/exclusion";
import { discoverCandidatePrs } from "@nexus/epic-verdicts/discover";
import { checkEpicMergeGate } from "@nexus/epic-verdicts/merge-gate";
import { readPrVerdict } from "@nexus/epic-verdicts/pr-verdict";
import { checkVerdictPublish } from "@nexus/epic-verdicts/publish-check";
import { type StoryPrCandidate } from "@nexus/epic-verdicts/verdict";
import { EPIC_RECEIPT_FILENAME, readEpicReceipt, writeEpicReceipt } from "@nexus/epic-verdicts/write";
import { ASSETS_SUBVERBS, runAssets } from "@nexus/delivery-config/assets-cli";
import { CONFIG_COMMANDS, runConfig } from "@nexus/delivery-config/config-cli";
import { resolvePublishingKey } from "@nexus/delivery-config/resolve";
import { runCreateEpic } from "@nexus/delivery-config/epic-filer/run";
import { runCreateStory } from "@nexus/delivery-config/story-filer/run";
import { resolveRole } from "@nexus/pr-worktree/identity";
import { parsePrReference, resolveAnalyzeTarget } from "@nexus/pr-worktree/member-target";
import { resolveStories } from "@nexus/pr-worktree/story-candidates";
import { resolvePr } from "@nexus/pr-worktree/pr";
import { deriveRange } from "@nexus/pr-worktree/range";
import { fetchPrHead, readRange } from "@nexus/pr-worktree/range-read";
import { deriveRangeList, type RangeListItem } from "@nexus/pr-worktree/range-list";
import { verifyTrunkContainsHeads } from "@nexus/pr-worktree/trunk-check";
import { canonicalRemote } from "@nexus/workspace/canonical-remote";
import { renderDiagnostic as renderPrWorktreeDiagnostic } from "@nexus/pr-worktree/render";
import { openAnalyzeWorktree, openCloseWorktree, removeWorktree } from "@nexus/pr-worktree/worktree";
import { renderVerifyResult } from "@nexus/prose-verify/render";
import { deriveFilingBody, survivingTokens, type Finding as RazorFinding } from "@nexus/scope-razor/labels";
import { checkApplied, checkDraft, type RazorFinding as RazorRuleFinding } from "@nexus/scope-razor/check";
import { renderChecklist, renderRazorFindings, renderRecordChecklist, renderSurvivingTokens } from "@nexus/scope-razor/render";
import { checklist, type ChecklistItem } from "@nexus/scope-razor/offer";
import { recordChecklist, type RecordChecklistItem } from "@nexus/scope-razor/record-offer";
import { verifyTranslation, type VerifyResult } from "@nexus/prose-verify/verify";
import { fetchRecord } from "@nexus/record-digest/fetch";
import { localDocsRoot, resolveWorkspace, type ResolveResult } from "@nexus/workspace/resolve";
import { renderWorkspaceStatus } from "@nexus/workspace/status";
import { takeTargetRoot } from "@nexus/workspace/target-root";
import { isDirectRun } from "./entry-point.js";
import { allowlistNoticeLines } from "./allowlist.js";
import { deployComponents, EMPTY_PAYLOAD, payloadDirectory, type DeployResult } from "./deploy-components.js";
import { deployCodexComponents } from "./codex-components.js";
import {
    DEFAULT_CONFIG_DIRNAME,
    describeInstallLocation,
    describeInstalledContent,
    ensureInstallLocation,
    inspectInstallLocation,
    resolveInstallLocation,
    CODEX_COMPONENT_DIRNAME,
    type Harness,
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
import { RELEASE_PACKAGE_NAME, releaseVersion } from "@nexus/release-identity/release";
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
const PR_WORKTREE_SUBVERBS: readonly string[] = ["preflight", "open", "range", "remove", "stories"];

/** The subverbs `nexus planning-dir` dispatches (story #639, decision record #646). */
const PLANNING_DIR_SUBVERBS: readonly string[] = ["ensure", "list", "remove"];

/**
 * The configuration resolver's own commands, read from the table that dispatches them (story #396)
 * rather than copied here — the gate composes this verb's two-token dispatch names from it.
 */
const CONFIG_SUBVERBS: readonly string[] = Object.keys(CONFIG_COMMANDS);

const REGISTRY: Record<string, VerbEntry> = {
    deploy: {
        summary: "Install the Nexus Claude components into the target repo.",
        usage: [
            "  nexus deploy [--harness claude|codex] [--payload <dir>] [--target <dir>]",
            "      Defaults to Claude. Codex installs generated skills under .agents/skills.",
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
        summary: "Install Nexus for Claude (default) or Codex at the account's skill location.",
        usage: [
            "  nexus install [--harness claude|codex] [--payload <dir>] [--from-checkout <dir>]",
            "      Codex: generate skills under ~/.agents/skills; invoke with $nxs-epic, etc.",
            "      Codex --from-checkout generates a snapshot; rerun after source edits.",
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
        summary: "Remove Nexus components for the selected harness (default: claude).",
        usage: [
            "  nexus uninstall [--harness claude|codex]",
            "      Codex removes its generated skills under ~/.agents/skills only.",
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
            "  nexus version [--harness claude|codex]",
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
    assets: {
        summary: "Resolve the durable asset store the filing stages publish issue graphics into.",
        usage: [
            "  nexus assets resolve [--root <dir>]",
            "      Print { state: declared, repo, branch } for the declared store, { state: unsupported }",
            "      when no layer declares one, or stop on a malformed value naming it (exit 1).",
            "  nexus assets publish --file <path> --feature <slug> [--root <dir>] [--json]",
            "      Publish one local file under features/<slug>/ in the store through GitHub's",
            "      file-contents endpoint (no clone) and print the reference pinned to the commit it",
            "      created, in the form its reader renders: an image inline (blob address with the raw",
            "      flag), an HTML page through the configured asset-renderer template, any other file a",
            "      link. Checks the file against asset-size-cap before any request.",
            "  nexus assets visibility [--root <dir>]",
            "      Read the store's visibility from GitHub once for the approval digest: public | private.",
        ].join("\n"),
        subverbs: ASSETS_SUBVERBS,
        run: async (argv: string[], io: CliIo): Promise<number> => runAssets(argv, io),
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
    "planning-dir": {
        summary: "Manage /nxs.epic's per-run planning folder under the gitignored scratch area.",
        usage: [
            "  nexus planning-dir ensure --name <name> [--root <startDir>]",
            "      Create (or reuse) the run's planning folder and print { path }.",
            "  nexus planning-dir list [--root <startDir>]",
            "      Print { dirs } — every run folder currently under the planning namespace.",
            "  nexus planning-dir remove --name <name> [--root <startDir>]",
            "      Remove the named run folder and nothing else. Prints { path, removed }.",
        ].join("\n"),
        subverbs: PLANNING_DIR_SUBVERBS,
        run: runPlanningDir,
    },
    "epic-verdicts": {
        summary: "Derive one epic receipt from the story verdicts already published on their pull requests.",
        usage: [
            "  nexus epic-verdicts derive --epic <N> [--root <startDir>]",
            "      Print { epic, state: aggregate|missing, receipt|missing/present, outPath } and, on",
            "      aggregate, write the per-story analyze-receipt.md beside the resolved epic.md.",
            "  nexus epic-verdicts currency --epic <N> [--record <N>] [--root <startDir>]",
            "      Re-check each story's verdict against its pull request's current head and, when",
            "      --record is given, the record's current digest. Prints { epic, stories, allCurrent }.",
            "  nexus epic-verdicts combined --epic <N> [--root <startDir>]",
            "      Print the union of every story pull request's own changed-file set, for judging",
            "      the epic's success metrics and cross-story invariants against the combined code.",
            "  nexus epic-verdicts merge-gate --epic <N> [--root <startDir>]",
            "      Read the local aggregate analyze-receipt.md and check every story pull request's",
            "      merge state via `gh pr view`. Prints { command: \"merge-gate\", stories, allMerged,",
            "      unmerged }. Exits 1 only when the local receipt itself cannot be found/read.",
            "  nexus epic-verdicts waive-story --story <N> [--root <startDir>]",
            "      Write the resolved no-pull-request marker label onto a story issue via `gh issue",
            "      edit` — the close-time waiver's one effect (story #502). Prints { command:",
            "      \"waive-story\", story, label }. Takes --story, not --epic.",
        ].join("\n"),
        subverbs: ["derive", "currency", "combined", "merge-gate", "waive-story"],
        run: runEpicVerdicts,
    },
    "pr-verdict": {
        summary: "Print the analyze verdict one pull request carries.",
        usage: [
            "  nexus pr-verdict --pr <N> --repo <owner/repo or host/owner/repo> [--dir <startDir>]",
            "      Read the pull request's published analyze blocks and print the one it carries:",
            "      { command, pr, repo, found, source, at, current, staleNote, receipt }. Applies",
            "      maintainer authorship, repository trust, the pull-request match and newest-wins",
            "      by GitHub's own timestamp — never a date, a key count or the prose in a block.",
            "      --repo is required: it is the repository the trust check runs against.",
        ].join("\n"),
        run: (argv, io) => Promise.resolve(runPrVerdict(argv, io)),
    },
    "verdict-check": {
        summary: "Check a drafted analyze verdict names the repository its story numbers resolve against, before it is published.",
        usage: [
            "  nexus verdict-check --body <path> [--dir <startDir>]",
            "      Resolve this checkout's issues repository and the analyzed pull request's code",
            "      repository, parse the drafted body with the same parser readers use, and approve",
            "      it or refuse. Prints { command, issuesRepo, repo } on approval. Exits 1 when the",
            "      body names no issues repository or names the wrong one, naming the value it should",
            "      have carried. Both repositories are resolved here, never taken as arguments.",
        ].join("\n"),
        run: (argv, io) => Promise.resolve(runVerdictCheck(argv, io)),
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
            "  nexus razor-check --draft <path> --filed \"<title>; <title>\"",
            "  nexus razor-check --draft <path> --derive <path>",
            "  nexus razor-check --draft <path> --assert-clean [--asset-path <path>]...",
            "      Report every unlabelled item, broken counted limit, unresolved asked-citation and",
            "      personas table, exiting 1 when any finding blocks. With --filed it instead runs the",
            "      apply-time arm over the set the reviewer approved, before any edge is rewritten: the",
            "      set is closed under its blockers, every name in it is a story, and the complexity",
            "      rollup and the design warrant describe the stories actually filed. With --derive it",
            "      writes the filing body — labels and the ordering block removed — and asserts it, and",
            "      with --assert-clean it asserts a body it is given — no provenance label, template",
            "      placeholder token, observation marker, ordering row or declared local asset path",
            "      (--asset-path, repeatable, matched exactly) — so a drafting-time body is never filed.",
        ].join("\n"),
        run: runRazorCheck,
    },
    "razor-offer": {
        summary: "Print a razor gate's numbered checklist: the planning gate's filed set, or a record's model-added items.",
        usage: [
            "  nexus razor-offer --draft <path>",
            "  nexus razor-offer --draft <path> --record [--approved-body <path>]",
            "      Print one numbered checklist: every story, every model-added acceptance criterion on",
            "      a story the default files, and every boundary. A ticked line is what a plain approval",
            "      files; the smallest usable version comes first, then the stories it excludes,",
            "      asked-for before model-added, each in the order the ordering block unlocks it.",
            "      With --record the draft is a decision record: the list holds every refuted",
            "      alternative under the decision it belongs to, then every invariant and every risk",
            "      the model added, numbered as one sequence in the record's own section order and",
            "      every line ticked, because a plain approval files the record minus nothing. Pass",
            "      --approved-body only when the record sub-issue is closed: a line whose text that",
            "      body already carries is marked frozen, since approved content changes only through",
            "      the revision path.",
        ].join("\n"),
        run: runRazorOffer,
    },
    "pr-worktree": {
        summary: "Manage the git worktree for the --pr post-merge flow (analyze / close).",
        usage: [
            "  nexus pr-worktree preflight --pr <N|owner/repo#N|url> --mode analyze|close [--root <dir>]",
            "  nexus pr-worktree open --pr <N|owner/repo#N|url> --mode analyze|close [--branch <distill/...>] [--root <dir>]",
            "      In analyze mode, a bare N targets this checkout's own repository; 'owner/repo#N' or a",
            "      pull-request URL may target any member the hub's workspace manifest declares. Close",
            "      keeps refusing a member outright.",
            "  nexus pr-worktree open --pr <N1,N2,...> --mode close --branch <distill/...> [--root <dir>]",
            "      A comma-separated list of two or more PR numbers opens ONE worktree/branch for the",
            "      whole epic (never one per PR) and prints { wtPath, ranges: [{ repo, base, head, pr },",
            "      ...] } instead of a singular range. Every range is derived and every stamped head is",
            "      verified as an ancestor of the trunk BEFORE the worktree is created — a failure of",
            "      either check exits 1 with no worktree ever opened; a single --pr <N> keeps today's",
            "      singular output shape unchanged.",
            "  nexus pr-worktree range --pr <N> [--root <dir>]",
            "      Print { repo, base, head } for a merged PR without creating a worktree.",
            "  nexus pr-worktree range --pr <N1,N2,...> [--root <dir>]",
            "      A comma-separated list of two or more PR numbers prints { ranges: [{ repo, base,",
            "      head, pr }, ...] } instead — one entry per PR, in the given order, never merged or",
            "      deduplicated per repository. The first PR whose range cannot be verified stops the",
            "      whole call before any output is printed; a single --pr <N> keeps today's output shape.",
            "  nexus pr-worktree stories --pr <ref> --issues-repo <owner/repo> [--story <n>] [--root <dir>]",
            "      Print { epic, stories } — the validated candidate ladder that resolves a PR to the",
            "      story issue(s) it implements, without depending on same-repository closing-issue links.",
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
            "      Print the diff for every range entry the queue entry's recorded range covers.",
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
    trunk: {
        summary: "Print the trunk every stage reads — its remote-tracking ref, or just the remote.",
        usage: [
            "  nexus trunk [--form ref|remote]",
            "      Print the trunk the pipeline reads. --form ref (default) prints the",
            "      remote-tracking ref — upstream/main when the checkout declares an `upstream`",
            "      remote, else origin/main; --form remote prints the remote name alone, for a",
            "      `git fetch <remote> main`. A lead usually works from a fork, where `origin` is",
            "      their own copy and the merges land in the repository `upstream` names, so ask",
            "      here rather than writing a remote out.",
        ].join("\n"),
        run: (argv, io) => Promise.resolve(runTrunk(argv, io)),
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

/**
 * `nexus trunk` — the readable face of the one canonical-remote rule, for component bodies.
 *
 * The stages resolve the trunk in shell (`git rev-parse --verify "$(nexus trunk)"`), and the
 * `--pr` libraries resolve it in TypeScript through the same `canonicalRemote`. Asking the
 * toolkit keeps those two from drifting into different answers in a fork checkout, where the
 * difference is a whole repository.
 */
function runTrunk(argv: string[], io: CliIo): number {
    let form = "ref";
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--form") form = argv[++i] ?? "";
        else {
            io.stderr(`unknown argument for trunk: ${argv[i]}\n${USAGE}`);
            return 2;
        }
    }
    if (form !== "ref" && form !== "remote") {
        io.stderr(`unknown form '${form}' for trunk (expected ref or remote)\n${USAGE}`);
        return 2;
    }
    const repoRoot: string = git(closeMigrationRunner, io.cwd, "rev-parse", "--show-toplevel") ?? io.cwd;
    const remote: string = canonicalRemote(closeMigrationRunner, repoRoot);
    io.stdout(form === "remote" ? remote : `${remote}/main`);
    return 0;
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

/** Select a harness explicitly; existing invocations retain their Claude behavior. */
function takeHarness(argv: string[], io: CliIo): Harness | null {
    const option = takeOption(argv, "--harness", io);
    if (option === null) return null;
    const value = option.value ?? "claude";
    if (value !== "claude" && value !== "codex") {
        io.stderr(`--harness must be claude or codex, got: ${value}`);
        return null;
    }
    return value;
}

async function runDeploy(argv: string[], io: CliIo): Promise<number> {
    const rest: string[] = [...argv];
    const harness = takeHarness(rest, io);
    if (harness === null) return 2;
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
    const componentRoot = path.join(targetRepoRoot, harness === "codex" ? CODEX_COMPONENT_DIRNAME : REPO_COMPONENT_DIRNAME);

    let result: DeployResult;
    try {
        result =
            harness === "codex"
                ? deployCodexComponents(payloadDir, componentRoot, {
                      owner: RELEASE_PACKAGE_NAME,
                  })
                : deployComponents(payloadDirectory(payloadDir), componentRoot);
    } catch (error) {
        io.stderr(error instanceof Error ? error.message : String(error));
        return 1;
    }
    io.stdout(
        `deployed ${result.written.length} component file(s) into ${componentRoot}` +
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
    const harness = takeHarness(rest, io);
    if (harness === null) return 2;
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

    const location: InstallLocationResult = resolveInstallLocation({ harness });
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
        io.stdout(
            harness === "codex"
                ? `generating Codex snapshot from checkout: ${checkout}; rerun install after edits`
                : `pointing at checkout: ${checkout}`,
        );
    } else {
        payloadDir = payloadOpt.value ?? defaultPayloadDir();
    }

    let result: DeployResult;
    try {
        if (harness === "codex") {
            result = deployCodexComponents(payloadDir, location.path, {
                owner: RELEASE_PACKAGE_NAME,
            });
        } else {
            ensureInstallLocation(location.path);
            result = deployComponents(payloadDirectory(payloadDir), location.path, {
                mode: pointing ? "pointer" : "copy",
                owner: RELEASE_PACKAGE_NAME,
            });
        }
    } catch (error) {
        io.stderr(error instanceof Error ? error.message : String(error));
        return 1;
    }
    io.stdout(
        `installed ${result.written.length} component ${pointing && harness === "claude" ? "pointer(s)" : "file(s)"} at ${location.path}` +
            (result.removed.length > 0 ? `; removed ${result.removed.length} stale component file(s)` : ""),
    );
    for (const line of collisionNoticeLines(result.claimedByOthers)) {
        io.stdout(line);
    }
    if (harness === "codex") {
        io.stdout("In Codex, invoke $nxs-setup to bootstrap a repository, or $nxs-epic to plan work.");
        io.stdout("Restart Codex if the skills do not appear. Nexus writes no Codex configuration or permission settings.");
    } else {
        for (const line of allowlistNoticeLines()) io.stdout(line);
    }
    return 0;
}

/**
 * A path this package just wrote that another installed package also claims. The mirror cannot
 * resolve it — both packages ship the file, and whichever installs last is what runs — so the
 * install says which paths are in that state rather than leaving the winner to be discovered.
 */
function collisionNoticeLines(claimed: string[]): string[] {
    if (claimed.length === 0) {
        return [];
    }
    return [
        `${claimed.length} of these file(s) are also shipped by another installed package, and this install overwrote them:`,
        ...claimed.map((rel) => `  ${rel}`),
        "Whichever package installs last is the body that runs. Reinstall the other package to put its own back.",
    ];
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
    const rest = [...argv];
    const harness = takeHarness(rest, io);
    if (harness === null) return 2;
    if (rest.length > 0) {
        io.stderr(`unknown argument for uninstall: ${rest[0]}\n${USAGE}`);
        return 2;
    }

    const location: InstallLocationResult = resolveInstallLocation({ harness });
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
        result = deployComponents(EMPTY_PAYLOAD, location.path, {
            owner: RELEASE_PACKAGE_NAME,
        });
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
function reportedInstallLocation(harness: Harness): {
    path: string | null;
    source: string | null;
    content: InstalledContent | null;
    checkout: string | null;
} {
    const location: InstallLocationResult = resolveInstallLocation({ harness });
    if (!location.ok) {
        return { path: null, source: null, content: null, checkout: null };
    }
    const state: InstallLocationState = inspectInstallLocation(location.path);
    return {
        path: location.path,
        source: location.source,
        content: state.content,
        checkout: state.checkout,
    };
}

/**
 * `nexus version` — the release identity as one JSON object on standard output, the existing
 * verb contract. Never non-zero for an environment defect (AC3); only a usage error.
 */
async function runVersion(argv: string[], io: CliIo): Promise<number> {
    const rest = [...argv];
    const harness = takeHarness(rest, io);
    if (harness === null) return 2;
    if (rest.length > 0) {
        io.stderr(`unknown argument for version: ${rest[0]}\n${USAGE}`);
        return 2;
    }
    const payloadDir: string | null = resolvedPayloadDir();
    io.stdout(
        JSON.stringify({
            version: releaseVersion(),
            componentPayload: payloadDir === null ? null : hashComponentTree(payloadDir),
            installLocation: reportedInstallLocation(harness),
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

    // Whether this checkout declares a workspace at all, so a single-repo project's epic.md
    // never carries an `issues_repo:` line naming a repository that was never ambiguous.
    const workspaceCheck: ResolveResult = resolveWorkspace(flags.root);
    const singleRepo = workspaceCheck.ok && workspaceCheck.workspace.mode === "single-repo";

    const resolved = resolveEpic(closeMigrationRunner, root, flags.epic, { requireEpic: flags.requireEpic, singleRepo });
    if (!resolved.ok) {
        io.stderr(renderEpicResolveDiagnostic(resolved.error));
        return 1;
    }

    const outPath: string = writeMaterializedEpic(root, flags.epic, resolved.markdown, flags.out);
    io.stdout(
        JSON.stringify({
            epic: flags.epic,
            targetRoot: root,
            outPath,
            issuesRepo: resolved.resolved.issuesRepo,
            record: resolved.record,
        }),
    );
    return 0;
}

interface PlanningDirFlags {
    name?: string;
    root: string;
}

function parsePlanningDirFlags(argv: string[], cwd: string): PlanningDirFlags {
    const flags: PlanningDirFlags = { root: cwd };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--name") flags.name = argv[++i];
        else if (a === "--root") flags.root = argv[++i];
    }
    return flags;
}

/**
 * `nexus planning-dir` — the deterministic tool layer decision record #646 requires around the
 * planning run folder's path and its removal, so several phases of `/nxs.epic` agree on the same
 * path and a recursive delete inside the lead's checkout runs behind a guard written in code.
 */
async function runPlanningDir(argv: string[], io: CliIo): Promise<number> {
    const sub = argv[0];
    if (!PLANNING_DIR_SUBVERBS.includes(sub)) {
        io.stderr("usage: nexus planning-dir <ensure|list|remove> --name <name> [--root <startDir>]");
        return 2;
    }
    const flags: PlanningDirFlags = parsePlanningDirFlags(argv.slice(1), io.cwd);

    if (sub === "list") {
        io.stdout(JSON.stringify({ dirs: listPlanningDirs(flags.root) }));
        return 0;
    }

    if (flags.name === undefined) {
        io.stderr(`usage: nexus planning-dir ${sub} --name <name> [--root <startDir>]`);
        return 2;
    }

    if (sub === "ensure") {
        io.stdout(JSON.stringify({ path: ensurePlanningDir(flags.root, flags.name) }));
        return 0;
    }

    // sub === "remove"
    const result = removePlanningDir(flags.root, flags.name);
    if (!result.ok) {
        io.stderr(`planning-dir ${result.error}`);
        return 1;
    }
    io.stdout(JSON.stringify({ path: result.path, removed: result.removed }));
    return 0;
}

interface EpicVerdictsFlags {
    epic?: number;
    root: string;
    record?: number;
    story?: number;
}

const EPIC_VERDICTS_SUBVERBS = ["derive", "currency", "combined", "merge-gate", "waive-story"];

function parseEpicVerdictsFlags(argv: string[], cwd: string): EpicVerdictsFlags {
    const args = EPIC_VERDICTS_SUBVERBS.includes(argv[0]) ? argv.slice(1) : argv;
    const flags: EpicVerdictsFlags = { root: cwd };
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === "--epic") flags.epic = Number(args[++i]);
        else if (a === "--root") flags.root = args[++i];
        else if (a === "--record") flags.record = Number(args[++i]);
        else if (a === "--story") flags.story = Number(args[++i]);
    }
    return flags;
}

/** One declared repository to search for a story's pull request: its slug and its own checkout. */
interface EpicVerdictsRepoTarget {
    slug: RepoSlug;
    cwd: string;
}

/**
 * Every repository the collection must search: the single-repo root, or (in workspace mode) the
 * hub plus every declared member that is actually checked out — an epic's story pull requests may
 * live in any of them, and the collection must span them all (decision record #505, invariants 6,
 * 9, 11). A member with no local checkout is silently skipped, the same as a candidate no rung of
 * the discovery ladder turns up: its story simply has one fewer place searched.
 */
function epicVerdictsRepoTargets(root: string): { ok: true; targets: EpicVerdictsRepoTarget[] } | { ok: false; message: string } {
    const workspaceResult = resolveWorkspace(root);
    if (!workspaceResult.ok) return { ok: false, message: renderWorkspaceStatus(workspaceResult) };

    const roots: string[] =
        workspaceResult.workspace.mode === "workspace"
            ? [workspaceResult.workspace.hubRoot, ...workspaceResult.workspace.members.filter((m) => m.checkout === "present").map((m) => m.expectedPath)]
            : [workspaceResult.workspace.root];

    const targets: EpicVerdictsRepoTarget[] = [];
    for (const cwd of roots) {
        const slugResult = resolveRepoSlug(closeMigrationRunner, cwd);
        if (!slugResult.ok) return { ok: false, message: `epic-verdicts ${slugResult.error.problem}: ${slugResult.error.message}` };
        targets.push({ slug: slugResult.slug, cwd });
    }
    return { ok: true, targets };
}

/**
 * Resolve the epic's story verdicts — the collection/trust/recency step shared by both
 * `epic-verdicts derive` and `epic-verdicts currency` (decision record #505, key decision
 * "Collection, trust, recency and currency are one program").
 */
function resolveEpicVerdictsForCli(
    root: string,
    epic: number,
): { ok: true; result: ResolveEpicVerdictsResult } | { ok: false; message: string } {
    // Internal stage (derive/currency/combined already know `epic` is an epic): this repo's own
    // epics are promoted children of a tracking issue, so requireEpic's parent-issue check would
    // wrongly reject them (resolveEpic's own doc comment on ResolveEpicOptions.requireEpic).
    const resolved = resolveEpic(closeMigrationRunner, root, epic, { requireEpic: false });
    if (!resolved.ok) return { ok: false, message: renderEpicResolveDiagnostic(resolved.error) };

    const targetsResult = epicVerdictsRepoTargets(root);
    if (!targetsResult.ok) return targetsResult;
    const targets = targetsResult.targets;

    const stories = resolved.resolved.stories.map((s) => s.number);
    const noPrLabel = resolvePublishingKey(root, "no-pr-label");
    const excludedStories: number[] = [];
    const candidatesByStory: Record<number, StoryPrCandidate[]> = {};
    for (const story of stories) {
        if (noPrLabel.length > 0) {
            const labelsResult = closeMigrationRunner("gh", ["issue", "view", String(story), "--json", "labels", "--jq", ".labels[].name"], {
                cwd: root,
            });
            const labels = labelsResult.status === 0 ? labelsResult.stdout.split("\n").map((l) => l.trim()).filter(Boolean) : [];
            if (isExcludedStory(labels, noPrLabel)) {
                excludedStories.push(story);
                continue;
            }
        }
        const candidates: StoryPrCandidate[] = [];
        for (const target of targets) {
            for (const found of discoverCandidatePrs(closeMigrationRunner, target.cwd, target.slug, story)) {
                candidates.push({ pr: found.pr, repo: target.slug, cwd: target.cwd });
            }
        }
        candidatesByStory[story] = candidates;
    }

    const result = resolveEpicVerdicts(closeMigrationRunner, {
        epic,
        stories,
        candidatesByStory,
        excludedStories,
        issuesRepo: resolved.resolved.issuesRepo,
    });
    return { ok: true, result };
}

/**
 * `nexus epic-verdicts derive` — the shared helper decision record #505 calls for: collection,
 * trust, recency and coverage as one program, called by both `/nxs.analyze` (which writes the
 * receipt this prints) and `/nxs.close` (which re-checks currency against the same story set).
 */
async function runEpicVerdicts(argv: string[], io: CliIo): Promise<number> {
    const flags = parseEpicVerdictsFlags(argv, io.cwd);

    // waive-story takes --story, not --epic (it names one story issue directly, never an epic) —
    // dispatched before the --epic check every other subverb below still enforces unconditionally.
    if (argv[0] === "waive-story") {
        if (flags.story === undefined || Number.isNaN(flags.story) || flags.story <= 0) {
            io.stderr("usage: nexus epic-verdicts waive-story --story <N> [--root <startDir>]");
            return 2;
        }
        const root = epicResolveTargetRoot(flags.root, io);
        if (root === null) return 1;

        const noPrLabel = resolvePublishingKey(root, "no-pr-label");
        const result = waiveStory(closeMigrationRunner, root, flags.story, noPrLabel);
        if (!result.ok) {
            io.stderr(`epic-verdicts ${result.error.problem}: ${result.error.message}`);
            return 1;
        }
        io.stdout(JSON.stringify({ command: "waive-story", story: flags.story, label: noPrLabel }));
        return 0;
    }

    if (flags.epic === undefined || Number.isNaN(flags.epic) || flags.epic <= 0) {
        io.stderr("usage: nexus epic-verdicts derive|currency|combined|merge-gate --epic <N> [--record <N>] [--root <startDir>]");
        return 2;
    }

    const root = epicResolveTargetRoot(flags.root, io);
    if (root === null) return 1;

    if (argv[0] === "merge-gate") {
        // Merge state is a narrower, local-file read — the already-written aggregate receipt names
        // every story's repo+pr, so this never re-runs collection/discovery the way derive/currency do.
        const receiptPath = path.join(path.dirname(defaultOutPath(root, flags.epic)), EPIC_RECEIPT_FILENAME);
        const receipt = readEpicReceipt(receiptPath);
        if (receipt === null) {
            io.stderr(`epic-verdicts receipt-missing: no aggregate epic receipt found at ${receiptPath}`);
            return 1;
        }
        const gate = checkEpicMergeGate(closeMigrationRunner, root, receipt);
        io.stdout(JSON.stringify({ command: "merge-gate", ...gate }));
        return 0;
    }

    const resolved = resolveEpicVerdictsForCli(root, flags.epic);
    if (!resolved.ok) {
        io.stderr(resolved.message);
        return 1;
    }
    const result = resolved.result;
    if (!result.ok) {
        io.stderr(`epic-verdicts ${result.error.problem}: ${result.error.message}`);
        return 1;
    }

    if (result.state === "none") {
        io.stdout(JSON.stringify({ epic: flags.epic, state: "none" }));
        return 0;
    }

    if (result.state === "partial") {
        io.stdout(JSON.stringify({ epic: flags.epic, state: "partial", missing: result.missing, present: result.present }));
        return 0;
    }

    if (argv[0] === "currency") {
        let currentRecordDigest: string | null = null;
        if (flags.record !== undefined && !Number.isNaN(flags.record)) {
            const record = fetchRecord(closeMigrationRunner, root, flags.record);
            if (!record.ok) {
                io.stderr(`epic-verdicts ${record.error.problem}: ${record.error.message}`);
                return 1;
            }
            currentRecordDigest = record.record.digest;
        }
        const currency = checkEpicCurrency(closeMigrationRunner, root, result.verdicts, { currentRecordDigest });
        io.stdout(JSON.stringify({ epic: flags.epic, state: "aggregate", ...currency }));
        return 0;
    }

    if (argv[0] === "combined") {
        const combined = combinedChangeSet(closeMigrationRunner, root, result.changeSetVerdicts, excludePathspecs());
        if (!combined.ok) {
            io.stderr(`epic-verdicts ${combined.error.problem}: ${combined.error.message}`);
            return 1;
        }
        io.stdout(JSON.stringify({ epic: flags.epic, state: "aggregate", ...combined.combined }));
        return 0;
    }

    const dir = path.dirname(defaultOutPath(root, flags.epic));
    const outPath = writeEpicReceipt(dir, result.receipt, { date: new Date().toISOString().slice(0, 10) });
    io.stdout(JSON.stringify({ epic: flags.epic, state: "aggregate", outPath, receipt: result.receipt }));
    return 0;
}

interface PrVerdictFlags {
    pr?: number;
    repo?: string;
    dir?: string;
}

function parsePrVerdictFlags(argv: string[]): PrVerdictFlags {
    const flags: PrVerdictFlags = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--pr") flags.pr = Number(argv[++i]);
        else if (argv[i] === "--repo") flags.repo = argv[++i];
        else if (argv[i] === "--dir" || argv[i] === "--root") flags.dir = argv[++i];
    }
    return flags;
}

/**
 * `nexus pr-verdict` — which verdict a pull request carries, executed rather than described
 * (decision record #750, invariant 8). The close gate invokes this and reports what it returns;
 * it does not restate the selection rule, and there is no hand-selection path behind it.
 */
function runPrVerdict(argv: string[], io: CliIo): number {
    const flags = parsePrVerdictFlags(argv);
    if (flags.pr === undefined || Number.isNaN(flags.pr) || flags.pr <= 0) {
        io.stderr("usage: nexus pr-verdict --pr <N> --repo <owner/repo or host/owner/repo> [--dir <startDir>]");
        return 2;
    }
    if (flags.repo === undefined || flags.repo.trim().length === 0) {
        io.stderr(
            "usage: nexus pr-verdict --pr <N> --repo <owner/repo or host/owner/repo> [--dir <startDir>]\n" +
                "--repo names the repository the pull request lives in; without it the trust check would be inert.",
        );
        return 2;
    }

    const result = readPrVerdict(closeMigrationRunner, flags.dir ?? io.cwd, flags.pr, flags.repo.trim());
    if (!result.ok) {
        io.stderr(`pr-verdict ${result.error.problem}: ${result.error.message}`);
        return 1;
    }
    io.stdout(JSON.stringify({ command: "pr-verdict", ...result.verdict }));
    return 0;
}

interface VerdictCheckFlags {
    body?: string;
    dir?: string;
}

function parseVerdictCheckFlags(argv: string[]): VerdictCheckFlags {
    const flags: VerdictCheckFlags = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--body") flags.body = argv[++i];
        else if (argv[i] === "--dir" || argv[i] === "--root") flags.dir = argv[++i];
    }
    return flags;
}

/**
 * `nexus verdict-check` — the publish boundary of the conformance gate (epic #751, decision
 * record #764). The gate drafts the verdict, hands the exact bytes here, and publishes only what
 * this approves; a refusal is a failure of the publish step, not a warning to write around.
 */
function runVerdictCheck(argv: string[], io: CliIo): number {
    const flags = parseVerdictCheckFlags(argv);
    if (flags.body === undefined || flags.body.trim().length === 0) {
        io.stderr("usage: nexus verdict-check --body <path> [--dir <startDir>]");
        return 2;
    }
    let body: string;
    try {
        body = fs.readFileSync(flags.body, "utf8");
    } catch (e) {
        io.stderr(`verdict-check body-unreadable: ${flags.body} could not be read (${e instanceof Error ? e.message : String(e)}).`);
        return 1;
    }

    const result = checkVerdictPublish(closeMigrationRunner, flags.dir ?? io.cwd, body);
    if (!result.ok) {
        io.stderr(`verdict-check ${result.error.problem}: ${result.error.message}`);
        return 1;
    }
    io.stdout(JSON.stringify({ command: "verdict-check", ...result.repos }));
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
    /** `--filed`: the story titles the reviewer approved, semicolon-separated — the apply-time arm. */
    filed?: string[];
    /** `--derive`: where to write the filing body derived from the draft. */
    derive?: string;
    /** This run's declared local asset paths (epic #594): a survivor fails `--assert-clean`. */
    assetPaths: string[];
    /** `--record`: offer over a decision-record draft rather than an epic draft (epic #722). */
    record: boolean;
    /** `--approved-body`: the approved record body, passed only when the record sub-issue is closed. */
    approvedBody?: string;
}

function parseRazorCheckFlags(argv: string[]): RazorCheckFlags {
    const flags: RazorCheckFlags = { assertClean: false, assetPaths: [], record: false };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--draft") flags.draft = argv[++i];
        else if (argv[i] === "--source") flags.source = argv[++i];
        else if (argv[i] === "--assert-clean") flags.assertClean = true;
        else if (argv[i] === "--asset-path") flags.assetPaths.push(argv[++i] ?? "");
        else if (argv[i] === "--derive") flags.derive = argv[++i];
        else if (argv[i] === "--record") flags.record = true;
        else if (argv[i] === "--approved-body") flags.approvedBody = argv[++i];
        else if (argv[i] === "--filed")
            flags.filed = (argv[++i] ?? "")
                .split(";")
                .map((title: string) => title.trim())
                .filter((title: string) => title !== "");
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
    const mode: boolean = flags.assertClean || flags.filed !== undefined || flags.derive !== undefined;
    if (flags.draft === undefined || (!mode && flags.source === undefined)) {
        io.stderr("usage: nexus razor-check --draft <path> (--source <path> | --filed \"<title>; <title>\" | --derive <path> | --assert-clean)");
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

    if (flags.filed !== undefined) {
        const findings: RazorRuleFinding[] = checkApplied(body, flags.filed);
        const report: string = renderRazorFindings(flags.draft, findings);
        if (findings.some((f: RazorRuleFinding) => f.severity === "blocking")) {
            io.stderr(report);
            return 1;
        }
        io.stdout(report);
        return 0;
    }

    if (flags.derive !== undefined) {
        const filing: string = deriveFilingBody(body);
        try {
            fs.writeFileSync(path.resolve(io.cwd, flags.derive), filing, "utf8");
        } catch {
            io.stderr(`razor-check: cannot write ${flags.derive}`);
            return 1;
        }
        const survived: RazorFinding[] = survivingTokens(filing);
        if (survived.length > 0) {
            io.stderr(renderSurvivingTokens(flags.derive, survived));
            return 1;
        }
        io.stdout(`razor-check: derived ${flags.derive}; it carries no drafting-time token`);
        return 0;
    }

    if (flags.assertClean) {
        const findings: RazorFinding[] = survivingTokens(body, flags.assetPaths);
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

/**
 * `nexus razor-offer` — the planning gate's checklist, pre-ticked with the set a plain approval
 * files and ordered by the draft's own dependency graph (epic #576, story #579). The gate renders
 * from this rather than deriving the sequence itself: both the tick state and the order are
 * mechanical, and the alternative — the drafting model numbering its own additions and ranking them
 * by predicted value — is the self-assessment the razor forbids elsewhere.
 */
async function runRazorOffer(argv: string[], io: CliIo): Promise<number> {
    const flags: RazorCheckFlags = parseRazorCheckFlags(argv);
    if (flags.draft === undefined) {
        io.stderr("usage: nexus razor-offer --draft <path>");
        return 2;
    }
    let body: string;
    try {
        body = fs.readFileSync(path.resolve(io.cwd, flags.draft), "utf8");
    } catch {
        io.stderr(`razor-offer: cannot read ${flags.draft}`);
        return 1;
    }
    if (flags.record) {
        let approved: string | undefined;
        if (flags.approvedBody !== undefined) {
            try {
                approved = fs.readFileSync(path.resolve(io.cwd, flags.approvedBody), "utf8");
            } catch {
                io.stderr(`razor-offer: cannot read ${flags.approvedBody}`);
                return 1;
            }
        }
        const record: RecordChecklistItem[] = recordChecklist(body, approved);
        io.stdout(renderRecordChecklist(flags.draft, record));
        return 0;
    }
    const items: ChecklistItem[] = checklist(body);
    io.stdout(renderChecklist(flags.draft, items));
    return 0;
}

interface PrWorktreeFlags {
    /** The raw `--pr` argument: a bare number, an 'owner/repo#N' reference, or a PR URL. */
    prRef?: string;
    mode?: string;
    branch?: string;
    /** `stories`: an explicit story issue number, the top of the candidate ladder. */
    story?: number;
    /** `stories`: the issues repo ("owner/repo") to validate candidates against. */
    issuesRepo?: string;
    root: string;
    positional: string[];
}

function parsePrWorktreeFlags(argv: string[], cwd: string): PrWorktreeFlags {
    const { root, rest } = takeTargetRoot(argv, cwd);
    const flags: PrWorktreeFlags = { root, positional: [] };
    for (let i = 0; i < rest.length; i++) {
        const a = rest[i];
        if (a === "--pr") flags.prRef = rest[++i];
        else if (a === "--mode") flags.mode = rest[++i];
        else if (a === "--branch") flags.branch = rest[++i];
        else if (a === "--story") flags.story = Number(rest[++i]);
        else if (a === "--issues-repo") flags.issuesRepo = rest[++i];
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
    // checkout would be built and torn down for one JSON object. Close's post-merge range is
    // never cross-repo (epic #211 opens analyze only), so `--pr` here is a bare number, or (story
    // #501) a comma-separated list of them — never an owner/repo#N or URL reference.
    if (subcommand === "range") {
        // A comma-separated `--pr` list (story #501) requests one range entry per PR, never a
        // repository collapse; a single bare number keeps the existing singular shape byte-identical.
        const prRefParts = flags.prRef !== undefined ? flags.prRef.split(",").map((s) => s.trim()) : [];
        if (prRefParts.length === 0 || prRefParts.some((p) => p.length === 0)) {
            io.stderr("usage: pr_worktree.ts range --pr <N>|<N1,N2,...>");
            return 2;
        }
        const prNumbers = prRefParts.map(Number);
        if (prNumbers.some((n) => Number.isNaN(n))) {
            io.stderr("usage: pr_worktree.ts range --pr <N>|<N1,N2,...>");
            return 2;
        }

        if (prNumbers.length > 1) {
            const list = deriveRangeList(closeMigrationRunner, flags.root, prNumbers);
            if (!list.ok) {
                io.stderr(renderPrWorktreeDiagnostic(list.error));
                return 1;
            }
            io.stdout(JSON.stringify({ command: "range", ranges: list.ranges }));
            return 0;
        }

        const read = readRange(closeMigrationRunner, flags.root, prNumbers[0]);
        if (!read.ok) {
            io.stderr(renderPrWorktreeDiagnostic(read.error));
            return 1;
        }
        io.stdout(JSON.stringify({ command: "range", range: read.range }));
        return 0;
    }

    if (subcommand === "preflight" || subcommand === "open") {
        if (flags.prRef === undefined) {
            io.stderr(`usage: pr_worktree.ts ${subcommand} --pr <N> --mode analyze|close`);
            return 2;
        }
        if (flags.mode !== "analyze" && flags.mode !== "close") {
            io.stderr(`usage: pr_worktree.ts ${subcommand} --pr <N> --mode analyze|close`);
            return 2;
        }

        // A comma-separated `--pr` list (story #503, decision record #509) opens ONE worktree/branch
        // for the whole epic, never one per PR. Order-inversion is the whole point: every range is
        // derived and every stamped head is verified as an ancestor of the trunk BEFORE any worktree
        // exists — never cut a branch, then discover a later PR's range or trunk membership fails.
        // Only `open --mode close` grows this path; preflight and a member analyze target stay
        // single-PR (a member PR isn't part of this epic-wide close flow at all).
        if (subcommand === "open" && flags.mode === "close" && flags.prRef.includes(",")) {
            const prRefParts = flags.prRef.split(",").map((s) => s.trim());
            if (prRefParts.some((p) => p.length === 0)) {
                io.stderr("usage: pr_worktree.ts open --pr <N1,N2,...> --mode close --branch <b>");
                return 2;
            }
            const prNumbers = prRefParts.map(Number);
            if (prNumbers.some((n) => Number.isNaN(n))) {
                io.stderr("usage: pr_worktree.ts open --pr <N1,N2,...> --mode close --branch <b>");
                return 2;
            }
            if (!flags.branch) {
                io.stderr("usage: pr_worktree.ts open --pr <N1,N2,...> --mode close --branch <distill/...>");
                return 2;
            }

            const role = resolveRole(flags.root, closeMigrationRunner);
            if (!role.ok) {
                io.stderr(renderPrWorktreeDiagnostic(role.error));
                return 1;
            }
            const { repoRoot } = role.resolved;

            const list = deriveRangeList(closeMigrationRunner, repoRoot, prNumbers);
            if (!list.ok) {
                io.stderr(renderPrWorktreeDiagnostic(list.error));
                return 1;
            }

            // Resolve the trunk exactly the way `openCloseWorktree` is about to (canonical remote,
            // best-effort refresh, falling back to the local ref offline) — duplicated rather than
            // exported from worktree.ts, because this resolution must happen and be verified BEFORE
            // the worktree is opened, while `openCloseWorktree` only ever resolves it internally,
            // after it has already decided to create or reuse one.
            const trunkRemote: string = canonicalRemote(closeMigrationRunner, repoRoot);
            const trunkRef = `${trunkRemote}/main`;
            closeMigrationRunner("git", ["fetch", trunkRemote, "main"], { cwd: repoRoot });
            const trunk =
                git(closeMigrationRunner, repoRoot, "rev-parse", "--verify", trunkRef) ??
                git(closeMigrationRunner, repoRoot, "rev-parse", "--verify", "main");
            if (trunk === null) {
                io.stderr(renderPrWorktreeDiagnostic({ problem: "git-failed", message: `neither ${trunkRef} nor main resolves in ${repoRoot}.` }));
                return 1;
            }

            const verified = verifyTrunkContainsHeads(
                closeMigrationRunner,
                repoRoot,
                trunk,
                list.ranges.map((r: RangeListItem) => ({ pr: r.pr, head: r.head })),
                { remote: trunkRemote },
            );
            if (!verified.ok) {
                io.stderr(renderPrWorktreeDiagnostic(verified.error));
                return 1;
            }

            const wt = openCloseWorktree(closeMigrationRunner, repoRoot, flags.branch);
            if (!wt.ok) {
                io.stderr(renderPrWorktreeDiagnostic(wt.error));
                return 1;
            }
            io.stdout(
                JSON.stringify({
                    command: "open",
                    mode: "close",
                    wtPath: wt.wtPath,
                    ranges: list.ranges.map((r: RangeListItem) => ({ repo: r.repo, base: r.base, head: r.head, pr: r.pr })),
                }),
            );
            return 0;
        }

        // Analyze accepts a member (a bare number self-selects this checkout; a repo-qualified
        // reference or a PR URL may name any declared member) — the role-per-mode split decision
        // record #495 calls for. Close keeps refusing a member outright until #215.
        let repoRoot: string;
        let repoIdentity: string;
        let roleName: string;
        let prNumber: number;
        if (flags.mode === "analyze") {
            const target = resolveAnalyzeTarget(flags.root, closeMigrationRunner, flags.prRef);
            if (!target.ok) {
                io.stderr(renderPrWorktreeDiagnostic(target.error));
                return 1;
            }
            const parsedRef = parsePrReference(flags.prRef);
            ({ repoRoot, repoIdentity, role: roleName } = target.target);
            prNumber = (parsedRef as { number: number }).number;
        } else {
            const role = resolveRole(flags.root, closeMigrationRunner, "close");
            if (!role.ok) {
                io.stderr(renderPrWorktreeDiagnostic(role.error));
                return 1;
            }
            ({ repoRoot, repoIdentity, role: roleName } = role.resolved);
            prNumber = Number(flags.prRef);
            if (Number.isNaN(prNumber)) {
                io.stderr(`usage: pr_worktree.ts ${subcommand} --pr <N> --mode close`);
                return 2;
            }
        }
        const requireMerged: boolean = flags.mode === "close";
        const pr = resolvePr(closeMigrationRunner, repoRoot, prNumber, { requireMerged });
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
            const wt = openAnalyzeWorktree(closeMigrationRunner, repoRoot, prNumber);
            if (!wt.ok) {
                io.stderr(renderPrWorktreeDiagnostic(wt.error));
                return 1;
            }
            io.stdout(
                JSON.stringify({
                    command: "open",
                    mode: "analyze",
                    wtPath: wt.wtPath,
                    analyzedHead: wt.head,
                    base: pr.pr.base,
                    repoIdentity,
                }),
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
        const prHead: string | undefined = fetchPrHead(closeMigrationRunner, repoRoot, prNumber);
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

    // `stories`: the validated candidate ladder (decision record #495) that resolves a PR to the
    // story issue(s) it implements, without depending on GitHub's same-repository closing-issue
    // linkage. Analyze-only — close does not yet run against a member PR.
    if (subcommand === "stories") {
        if (flags.prRef === undefined || !flags.issuesRepo) {
            io.stderr("usage: pr_worktree.ts stories --pr <N|owner/repo#N|url> --issues-repo <owner/repo> [--story <n>]");
            return 2;
        }
        const slash = flags.issuesRepo.indexOf("/");
        if (slash <= 0) {
            io.stderr(`usage: pr_worktree.ts stories: --issues-repo must be 'owner/repo', got '${flags.issuesRepo}'`);
            return 2;
        }
        const slug = { owner: flags.issuesRepo.slice(0, slash), repo: flags.issuesRepo.slice(slash + 1) };

        const target = resolveAnalyzeTarget(flags.root, closeMigrationRunner, flags.prRef);
        if (!target.ok) {
            io.stderr(renderPrWorktreeDiagnostic(target.error));
            return 1;
        }
        const parsedRef = parsePrReference(flags.prRef) as { number: number };
        const pr = resolvePr(closeMigrationRunner, target.target.repoRoot, parsedRef.number, { requireMerged: false });
        if (!pr.ok) {
            io.stderr(renderPrWorktreeDiagnostic(pr.error));
            return 1;
        }
        // How this repository files an epic, a story and a record — read once, from the same
        // shared publishing resolver every other stage reads, so the ladder cannot disagree with
        // `settings.yml` about what an epic is.
        const kinds = resolveKindClassification(flags.root);
        if (!kinds.ok) {
            io.stderr(renderEpicResolveDiagnostic(kinds.error));
            return 1;
        }
        // Which repository the pull request itself lives in — read from the target checkout, so
        // the platform's same-repository closing links are believed only when that repository is
        // the issues repository.
        const prSlug = resolveRepoSlug(closeMigrationRunner, target.target.repoRoot);
        if (!prSlug.ok) {
            io.stderr(renderEpicResolveDiagnostic(prSlug.error));
            return 1;
        }
        const resolved = resolveStories(closeMigrationRunner, target.target.repoRoot, slug, kinds.classification, {
            explicitStory: flags.story,
            prRepo: `${prSlug.slug.owner}/${prSlug.slug.repo}`,
            closingIssues: pr.pr.closingIssues,
            commitMessages: pr.pr.commitMessages,
            branchName: pr.pr.headRef,
            prBody: pr.pr.body,
        });
        if (!resolved.ok) {
            io.stderr(renderPrWorktreeDiagnostic(resolved.error));
            return 1;
        }
        io.stdout(JSON.stringify({ command: "stories", epic: resolved.epic, stories: resolved.stories }));
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
