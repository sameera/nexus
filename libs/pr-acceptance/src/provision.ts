/**
 * Provision the one scratch repository and the disposable clone the chain runs in.
 *
 * The scratch repo carries the **toolchain tree at an exact commit**, not the
 * consumer-facing vendored shape: the commands invoke their helpers by
 * repo-relative paths and those helpers resolve their libraries through workspace
 * links, so a repo carrying only the vendored tree cannot execute the code being
 * accepted. (That gap is a real finding about packaging — it is recorded as a
 * divergence, not repaired here.) Pinning to an exact commit is something the
 * acceptance record needs regardless: every recorded outcome names the commit it
 * was produced against.
 *
 * Provision is **reuse-or-refuse** against one deterministic name. If a repo of
 * that name exists and carries the harness's own marker, it is reused; if it
 * exists without one, provision refuses and touches nothing. Isolation between
 * runs comes from fresh scenarios inside that single repo, never from fresh repos
 * — a failed teardown must not be able to leave an unbounded set of
 * near-identical repositories behind.
 *
 * Nothing here mutates the Nexus checkout: the tree is read with `git archive`
 * (never a worktree registration), and every commit, branch, and push lands in
 * the clone.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { preflightCapabilities, requireAllMergeMethods, resolveMergeMethods } from "./capability.js";
import { type Result, fail, ok } from "./diagnostic.js";
import { verifyDeleteGuard } from "./guard.js";
import { MARKER_PATH, SCRATCH_REPO_NAME, type ScratchIdentity, cloneDir, renderMarker, scratchIdentity } from "./names.js";
import { type Runner, git } from "./run.js";

/**
 * Paths dropped from the seeded tree. The queue matters most: a committed entry
 * would send close's dual-read down the transitional branch instead of the
 * born-at-close path the flow actually uses now. The rest is product and archive
 * weight that no stage under test reads.
 */
export const SEED_EXCLUDE: readonly string[] = [
    ".nexus/queue",
    ".nexus/tmp",
    ".nexus/plans",
    "docs_old",
    "manual",
    "apps",
];

/** The one feature folder the seeded epics belong to (close appends its backlog here). */
export const SCRATCH_FEATURE = "acceptance-scratch";

export interface SeedTreeOptions {
    sourceRepoRoot: string;
    destDir: string;
    toolchainCommit: string;
    nameWithOwner: string;
    today: string;
}

function scratchSettings(nameWithOwner: string): string {
    return [
        "cross-ref:",
        `  docs-root: https://github.com/${nameWithOwner}/blob/main/docs`,
        "",
        "github:",
        "  classification: labels",
        "  project: none",
        "",
    ].join("\n");
}

function scratchReadme(nameWithOwner: string, toolchainCommit: string, today: string): string {
    return [
        `# ${SCRATCH_REPO_NAME}`,
        "",
        "**THROWAWAY REPOSITORY — DO NOT PUT ANYTHING HERE YOU WANT TO KEEP.**",
        "",
        "Provisioned by the Nexus PR-flow live-acceptance harness to exercise the",
        "`analyze --pr → merge → close --pr → distill` chain against real GitHub. It is",
        "deleted at teardown.",
        "",
        `- marker: \`${MARKER_PATH}\` (\`nexus-pr-acceptance-harness/v1\`)`,
        `- seeded from: ${nameWithOwner}`,
        `- toolchain commit under test: \`${toolchainCommit}\``,
        `- provisioned: ${today}`,
        "",
    ].join("\n");
}

function scratchFeatureDocs(destDir: string): void {
    const dir = path.join(destDir, "docs", "features", SCRATCH_FEATURE);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
        path.join(dir, "README.md"),
        ['---', 'feature: "Acceptance Scratch"', "---", "", "# Acceptance Scratch", "", "The one feature the harness's seeded epics belong to.", "", "## Epics", "", ""].join("\n"),
    );
    fs.writeFileSync(
        path.join(dir, "backlog.md"),
        [
            "# Backlog: Acceptance Scratch",
            "",
            "<!-- Append-only re-triage queue. Writers: /nxs.epic (decomposition stubs),",
            "     /nxs.close (deferred scope). One consumer: the next /nxs.epic. -->",
            "",
            "",
        ].join("\n"),
    );
}

function ensureGitignores(destDir: string, entries: string[]): void {
    const file = path.join(destDir, ".gitignore");
    const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    const lines = new Set(existing.split("\n").map((l) => l.trim()));
    const missing = entries.filter((e) => !lines.has(e));
    if (missing.length === 0) return;
    fs.writeFileSync(file, `${existing}${existing.endsWith("\n") || existing === "" ? "" : "\n"}${missing.join("\n")}\n`);
}

/** Materialize the toolchain tree at `toolchainCommit` into `destDir`, plus the scratch surfaces. */
export function seedTree(run: Runner, o: SeedTreeOptions): Result<void> {
    const tarPath = path.join(os.tmpdir(), `nexus-acceptance-seed-${process.pid}-${Date.now()}.tar`);
    const archived = run(
        "git",
        ["-C", o.sourceRepoRoot, "archive", "--format=tar", "-o", tarPath, o.toolchainCommit],
        { cwd: o.sourceRepoRoot },
    );
    if (archived.status !== 0) {
        fs.rmSync(tarPath, { force: true });
        return fail(
            "git-failed",
            `could not archive ${o.toolchainCommit} from ${o.sourceRepoRoot}: ${archived.stderr.trim() || "git archive failed"}`,
        );
    }
    fs.mkdirSync(o.destDir, { recursive: true });
    const extracted = run("tar", ["-x", "-f", tarPath, "-C", o.destDir], { cwd: o.destDir });
    fs.rmSync(tarPath, { force: true });
    if (extracted.status !== 0) {
        return fail("git-failed", `could not extract the seeded tree into ${o.destDir}: ${extracted.stderr.trim()}`);
    }

    for (const rel of SEED_EXCLUDE) fs.rmSync(path.join(o.destDir, rel), { recursive: true, force: true });

    fs.mkdirSync(path.join(o.destDir, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(o.destDir, ".nexus", "config", "settings.yml"), scratchSettings(o.nameWithOwner));
    fs.writeFileSync(path.join(o.destDir, "README.md"), scratchReadme(o.nameWithOwner, o.toolchainCommit, o.today));
    fs.writeFileSync(
        path.join(o.destDir, MARKER_PATH),
        renderMarker({ nameWithOwner: o.nameWithOwner, toolchainCommit: o.toolchainCommit, provisionedAt: o.today }),
    );
    scratchFeatureDocs(o.destDir);
    ensureGitignores(o.destDir, ["node_modules", ".nexus/tmp/"]);
    return ok(undefined);
}

export interface RemoteState {
    exists: boolean;
    url: string;
    /** The provisioning marker read back off the remote; null when absent or unreadable. */
    markerText: string | null;
}

function looksLikeMissingRepo(stderr: string): boolean {
    return /could not resolve|not found|no such|does not exist/i.test(stderr);
}

export function remoteState(run: Runner, cwd: string, nameWithOwner: string): Result<RemoteState> {
    const view = run("gh", ["repo", "view", nameWithOwner, "--json", "url"], { cwd });
    if (view.status !== 0) {
        if (looksLikeMissingRepo(view.stderr)) return ok({ exists: false, url: "", markerText: null });
        return fail("gh-failed", `gh repo view ${nameWithOwner} failed: ${view.stderr.trim() || "unknown gh error"}`);
    }
    let url = "";
    try {
        const doc: unknown = JSON.parse(view.stdout);
        if (doc !== null && typeof doc === "object" && typeof (doc as Record<string, unknown>)["url"] === "string") {
            url = (doc as Record<string, string>)["url"];
        }
    } catch {
        // A repo that exists but reports unparseable JSON is still an existing repo; the
        // marker check below is what decides whether it is ours.
    }
    const marker = run("gh", ["api", `repos/${nameWithOwner}/contents/${MARKER_PATH}`, "--jq", ".content"], { cwd });
    const markerText =
        marker.status === 0 && marker.stdout.trim() !== ""
            ? Buffer.from(marker.stdout.replace(/\s+/g, ""), "base64").toString("utf8")
            : null;
    return ok({ exists: true, url, markerText });
}

/**
 * Let the clone borrow the primary checkout's already-resolved dependency closure.
 *
 * The helpers resolve their libraries through workspace links, so a plain clone of
 * the seeded tree cannot execute them until dependencies are present, and running
 * an install inside the runbook's time budget is not free. Borrowing is the cheap
 * path; that it is needed at all is the packaging divergence the run records.
 */
export function linkDependencyClosure(clonePath: string, sourceRepoRoot: string): Result<void> {
    const source = path.join(sourceRepoRoot, "node_modules");
    if (!fs.existsSync(source)) {
        return fail(
            "clone-failed",
            `${source} does not exist, so the clone has no resolved dependency closure to borrow; ` +
                `run the package install in ${sourceRepoRoot}, or invoke the helpers from it by absolute path.`,
        );
    }
    const target = path.join(clonePath, "node_modules");
    const existing = fs.lstatSync(target, { throwIfNoEntry: false });
    if (existing) {
        if (existing.isSymbolicLink() && fs.readlinkSync(target) === source) return ok(undefined);
        fs.rmSync(target, { recursive: true, force: true });
    }
    fs.symlinkSync(source, target, "dir");
    return ok(undefined);
}

export interface ProvisionOptions {
    /** The Nexus checkout whose toolchain tree is seeded. Never mutated. */
    sourceRepoRoot: string;
    /** Override the disposable clone's location (defaults to the deterministic path). */
    cloneDir?: string;
    today?: string;
}

export interface Provisioned {
    nameWithOwner: string;
    url: string;
    clonePath: string;
    toolchainCommit: string;
    /** True when an existing, marker-verified scratch repo was reused rather than created. */
    reused: boolean;
    /** Whether the clone could borrow the primary checkout's dependency closure. */
    dependencyClosure: "linked" | "absent";
}

function configureCommitIdentity(run: Runner, dir: string): void {
    run("git", ["-C", dir, "config", "user.name", "Nexus Acceptance Harness"], { cwd: dir });
    run("git", ["-C", dir, "config", "user.email", "nexus-acceptance-harness@users.noreply.github.com"], { cwd: dir });
}

function createScratchRepo(
    run: Runner,
    id: ScratchIdentity,
    clonePath: string,
    sourceRepoRoot: string,
    toolchainCommit: string,
    today: string,
): Result<void> {
    const created = run(
        "gh",
        [
            "repo",
            "create",
            id.nameWithOwner,
            "--private",
            "--description",
            "Throwaway scratch repo for the Nexus PR-flow live acceptance dry-run. Deleted at teardown.",
        ],
        { cwd: sourceRepoRoot },
    );
    if (created.status !== 0) {
        return fail("gh-failed", `gh repo create ${id.nameWithOwner} failed: ${created.stderr.trim()}`);
    }

    fs.rmSync(clonePath, { recursive: true, force: true });
    const seeded = seedTree(run, {
        sourceRepoRoot,
        destDir: clonePath,
        toolchainCommit,
        nameWithOwner: id.nameWithOwner,
        today,
    });
    if (!seeded.ok) return seeded;

    const steps: string[][] = [
        ["-C", clonePath, "init", "-q", "-b", "main"],
        ["-C", clonePath, "add", "-A"],
    ];
    for (const args of steps) {
        const r = run("git", args, { cwd: clonePath });
        if (r.status !== 0) return fail("git-failed", `git ${args.join(" ")} failed: ${r.stderr.trim()}`);
    }
    configureCommitIdentity(run, clonePath);
    const commit = run("git", ["-C", clonePath, "commit", "-qm", "chore: seed the acceptance scratch repo"], {
        cwd: clonePath,
    });
    if (commit.status !== 0) return fail("git-failed", `the trunk commit failed: ${commit.stderr.trim()}`);
    run("git", ["-C", clonePath, "remote", "add", "origin", `https://github.com/${id.nameWithOwner}.git`], {
        cwd: clonePath,
    });
    const push = run("git", ["-C", clonePath, "push", "-u", "origin", "main"], { cwd: clonePath });
    if (push.status !== 0) return fail("git-failed", `pushing the trunk commit failed: ${push.stderr.trim()}`);
    return ok(undefined);
}

function ensureClone(run: Runner, id: ScratchIdentity, clonePath: string, cwd: string): Result<void> {
    if (fs.existsSync(path.join(clonePath, ".git"))) {
        run("git", ["-C", clonePath, "fetch", "origin", "main"], { cwd: clonePath });
        const co = run("git", ["-C", clonePath, "checkout", "-B", "main", "origin/main"], { cwd: clonePath });
        if (co.status !== 0) {
            return fail(
                "clone-failed",
                `the existing clone at ${clonePath} could not be reset to origin/main: ${co.stderr.trim()}. Remove it and re-provision.`,
            );
        }
        configureCommitIdentity(run, clonePath);
        return ok(undefined);
    }
    fs.mkdirSync(path.dirname(clonePath), { recursive: true });
    const cloned = run("gh", ["repo", "clone", id.nameWithOwner, clonePath], { cwd });
    if (cloned.status !== 0) {
        return fail("clone-failed", `gh repo clone ${id.nameWithOwner} ${clonePath} failed: ${cloned.stderr.trim()}`);
    }
    configureCommitIdentity(run, clonePath);
    return ok(undefined);
}

export function provision(run: Runner, o: ProvisionOptions): Result<Provisioned> {
    const caps = preflightCapabilities(run, o.sourceRepoRoot);
    if (!caps.ok) return caps;

    const id = scratchIdentity(caps.value.login);
    const clonePath = o.cloneDir ?? cloneDir(caps.value.login);
    const today = o.today ?? new Date().toISOString().slice(0, 10);

    const toolchainCommit = git(run, o.sourceRepoRoot, "rev-parse", "HEAD");
    if (toolchainCommit === null) {
        return fail("git-failed", `${o.sourceRepoRoot} is not a git checkout; the seeded tree must be pinned to a commit.`);
    }

    const state = remoteState(run, o.sourceRepoRoot, id.nameWithOwner);
    if (!state.ok) return state;

    let reused: boolean;
    if (state.value.exists) {
        const owned = verifyDeleteGuard({
            owner: id.owner,
            name: id.name,
            expectedOwner: caps.value.login,
            markerText: state.value.markerText,
        });
        if (!owned.ok) {
            return fail(
                "scratch-repo-exists",
                `${id.nameWithOwner} already exists but is not this harness's scratch repo (${owned.error.message}); ` +
                    `refusing to reuse or replace it. Rename or remove it, then re-provision.`,
            );
        }
        const ensured = ensureClone(run, id, clonePath, o.sourceRepoRoot);
        if (!ensured.ok) return ensured;
        reused = true;
    } else {
        const created = createScratchRepo(run, id, clonePath, o.sourceRepoRoot, toolchainCommit, today);
        if (!created.ok) return created;
        reused = false;
    }

    // Converge the merge settings, then verify — the edit is best-effort, the check is the gate.
    run(
        "gh",
        ["repo", "edit", id.nameWithOwner, "--enable-squash-merge", "--enable-merge-commit", "--enable-rebase-merge"],
        { cwd: clonePath },
    );
    const methods = resolveMergeMethods(run, clonePath, id.nameWithOwner);
    if (!methods.ok) return methods;
    const allowed = requireAllMergeMethods(methods.value, id.nameWithOwner);
    if (!allowed.ok) return { ok: false, error: allowed.error };

    // Every later gh call resolves its target from this checkout, so pin it explicitly.
    run("gh", ["repo", "set-default", id.nameWithOwner], { cwd: clonePath });

    const linked = linkDependencyClosure(clonePath, o.sourceRepoRoot);

    return ok({
        nameWithOwner: id.nameWithOwner,
        url: state.value.url || `https://github.com/${id.nameWithOwner}`,
        clonePath,
        toolchainCommit,
        reused,
        dependencyClosure: linked.ok ? "linked" : "absent",
    });
}
