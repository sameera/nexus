import * as fs from "node:fs";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { SEED_EXCLUDE, linkDependencyClosure, provision, remoteState, seedTree } from "./provision.js";
import { MARKER_PATH, MARKER_SIGNATURE, SCRATCH_REPO_NAME, parseMarker } from "./names.js";
import { callsMatching, fakeRunner, initRepo, makeTempDir, sh, writeCommit } from "./harness-fixtures.js";
import { defaultRunner } from "./run.js";

const tracked: string[] = [];
afterAll(() => {
    for (const d of tracked) fs.rmSync(d, { recursive: true, force: true });
});

/** A miniature Nexus checkout: toolchain paths plus the noise seeding must drop. */
function sourceCheckout(): { root: string; commit: string } {
    const root = path.join(makeTempDir(tracked), "nexus");
    initRepo(root);
    fs.mkdirSync(path.join(root, "libs/pr-worktree/src"), { recursive: true });
    fs.mkdirSync(path.join(root, ".claude/skills"), { recursive: true });
    fs.mkdirSync(path.join(root, ".nexus/config"), { recursive: true });
    fs.mkdirSync(path.join(root, ".nexus/queue/old-entry"), { recursive: true });
    fs.mkdirSync(path.join(root, "docs_old"), { recursive: true });
    fs.writeFileSync(path.join(root, "libs/pr-worktree/src/range.ts"), "export const x = 1;\n");
    fs.writeFileSync(path.join(root, ".claude/skills/keep.md"), "skill\n");
    fs.writeFileSync(path.join(root, ".nexus/config/settings.yml"), "cross-ref:\n  docs-root: https://real\n");
    fs.writeFileSync(path.join(root, ".nexus/queue/old-entry/epic.md"), "---\nlink: '#1'\n---\n");
    fs.writeFileSync(path.join(root, "docs_old/legacy.md"), "old\n");
    fs.writeFileSync(path.join(root, "README.md"), "# Nexus\n");
    fs.writeFileSync(path.join(root, "package.json"), '{"name":"nexus"}\n');
    const commit = writeCommit(root, "pnpm-workspace.yaml", "packages:\n  - 'libs/*'\n", "toolchain");
    return { root, commit };
}

describe("seedTree", () => {
    it("carries the toolchain tree at the exact commit under test", () => {
        const src = sourceCheckout();
        const dest = path.join(makeTempDir(tracked), "seed");
        const r = seedTree(defaultRunner, {
            sourceRepoRoot: src.root,
            destDir: dest,
            toolchainCommit: src.commit,
            nameWithOwner: `sameera/${SCRATCH_REPO_NAME}`,
            today: "2026-07-25",
        });
        expect(r.ok).toBe(true);
        expect(fs.existsSync(path.join(dest, "libs/pr-worktree/src/range.ts"))).toBe(true);
        expect(fs.existsSync(path.join(dest, ".claude/skills/keep.md"))).toBe(true);
        expect(fs.existsSync(path.join(dest, "pnpm-workspace.yaml"))).toBe(true);
    });

    it("drops the queue, so close's dual-read takes the born-at-close path the flow actually uses", () => {
        const src = sourceCheckout();
        const dest = path.join(makeTempDir(tracked), "seed");
        seedTree(defaultRunner, {
            sourceRepoRoot: src.root,
            destDir: dest,
            toolchainCommit: src.commit,
            nameWithOwner: "o/r",
            today: "2026-07-25",
        });
        expect(fs.existsSync(path.join(dest, ".nexus/queue"))).toBe(false);
        expect(fs.existsSync(path.join(dest, "docs_old"))).toBe(false);
        expect(SEED_EXCLUDE).toContain(".nexus/queue");
    });

    it("writes a marker naming the repo it seeds, which is what licenses the later delete", () => {
        const src = sourceCheckout();
        const dest = path.join(makeTempDir(tracked), "seed");
        seedTree(defaultRunner, {
            sourceRepoRoot: src.root,
            destDir: dest,
            toolchainCommit: src.commit,
            nameWithOwner: `sameera/${SCRATCH_REPO_NAME}`,
            today: "2026-07-25",
        });
        const marker = parseMarker(fs.readFileSync(path.join(dest, MARKER_PATH), "utf8"));
        expect(marker).not.toBeNull();
        expect(marker?.nameWithOwner).toBe(`sameera/${SCRATCH_REPO_NAME}`);
        expect(marker?.toolchainCommit).toBe(src.commit);
        expect(marker?.provisionedAt).toBe("2026-07-25");
    });

    it("gives the flow the Nexus surfaces it reads: a config, a docs root, and one feature folder", () => {
        const src = sourceCheckout();
        const dest = path.join(makeTempDir(tracked), "seed");
        seedTree(defaultRunner, {
            sourceRepoRoot: src.root,
            destDir: dest,
            toolchainCommit: src.commit,
            nameWithOwner: "o/r",
            today: "2026-07-25",
        });
        expect(fs.existsSync(path.join(dest, ".nexus/config/settings.yml"))).toBe(true);
        expect(fs.existsSync(path.join(dest, "docs/features/acceptance-scratch/README.md"))).toBe(true);
    });

    it("seeds no backlog file — a stub is an issue, so the scratch repo has no file to write one to", () => {
        const src = sourceCheckout();
        const dest = path.join(makeTempDir(tracked), "seed");
        seedTree(defaultRunner, {
            sourceRepoRoot: src.root,
            destDir: dest,
            toolchainCommit: src.commit,
            nameWithOwner: "o/r",
            today: "2026-08-01",
        });
        expect(fs.existsSync(path.join(dest, "docs/features/acceptance-scratch/backlog.md"))).toBe(false);
    });

    it("replaces the seeded config so issues target the scratch repo, never the source repo", () => {
        const src = sourceCheckout();
        const dest = path.join(makeTempDir(tracked), "seed");
        seedTree(defaultRunner, {
            sourceRepoRoot: src.root,
            destDir: dest,
            toolchainCommit: src.commit,
            nameWithOwner: "o/r",
            today: "2026-07-25",
        });
        const cfg = fs.readFileSync(path.join(dest, ".nexus/config/settings.yml"), "utf8");
        expect(cfg).not.toContain("https://real");
        expect(cfg).not.toContain("issues-repo");
        expect(cfg).not.toContain("epic-repo");
    });

    it("banners the README, so a human who lands on the repo knows it is disposable", () => {
        const src = sourceCheckout();
        const dest = path.join(makeTempDir(tracked), "seed");
        seedTree(defaultRunner, {
            sourceRepoRoot: src.root,
            destDir: dest,
            toolchainCommit: src.commit,
            nameWithOwner: "o/r",
            today: "2026-07-25",
        });
        const readme = fs.readFileSync(path.join(dest, "README.md"), "utf8");
        expect(readme.toLowerCase()).toContain("throwaway");
        expect(readme).toContain(MARKER_SIGNATURE);
    });

    it("fails when the source commit cannot be archived", () => {
        const src = sourceCheckout();
        const dest = path.join(makeTempDir(tracked), "seed");
        const r = seedTree(defaultRunner, {
            sourceRepoRoot: src.root,
            destDir: dest,
            toolchainCommit: "0".repeat(40),
            nameWithOwner: "o/r",
            today: "2026-07-25",
        });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("git-failed");
    });
});

describe("remoteState", () => {
    const marker = `signature: ${MARKER_SIGNATURE}\nnameWithOwner: o/r\ntoolchainCommit: ${"e".repeat(40)}\nprovisionedAt: 2026-07-25\n`;

    it("reports a repo that does not exist yet", () => {
        const run = fakeRunner([
            { match: "gh repo view", result: { status: 1, stderr: "Could not resolve to a Repository with the name" } },
        ]);
        const r = remoteState(run, "/tmp", "o/r");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.exists).toBe(false);
    });

    it("reads the marker back off an existing repo", () => {
        const run = fakeRunner([
            { match: "gh repo view", result: { stdout: JSON.stringify({ url: "https://github.com/o/r" }) } },
            {
                match: `gh api repos/o/r/contents/${MARKER_PATH}`,
                result: { stdout: Buffer.from(marker).toString("base64") },
            },
        ]);
        const r = remoteState(run, "/tmp", "o/r");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.exists).toBe(true);
        expect(r.value.url).toBe("https://github.com/o/r");
        expect(parseMarker(r.value.markerText ?? "")?.nameWithOwner).toBe("o/r");
    });

    it("reports an existing repo with no marker rather than inventing one", () => {
        const run = fakeRunner([
            { match: "gh repo view", result: { stdout: JSON.stringify({ url: "https://github.com/o/r" }) } },
            { match: "gh api repos/o/r/contents", result: { status: 1, stderr: "Not Found" } },
        ]);
        const r = remoteState(run, "/tmp", "o/r");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.exists).toBe(true);
        expect(r.value.markerText).toBeNull();
    });

    it("surfaces a gh failure that is not a missing repo", () => {
        const run = fakeRunner([{ match: "gh repo view", result: { status: 1, stderr: "HTTP 502 bad gateway" } }]);
        const r = remoteState(run, "/tmp", "o/r");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-failed");
    });
});

describe("linkDependencyClosure", () => {
    it("lets the clone borrow the primary checkout's resolved dependencies", () => {
        const parent = makeTempDir(tracked);
        const source = path.join(parent, "src");
        const clone = path.join(parent, "clone");
        fs.mkdirSync(path.join(source, "node_modules"), { recursive: true });
        fs.writeFileSync(path.join(source, "node_modules", "marker"), "x");
        fs.mkdirSync(clone, { recursive: true });

        const r = linkDependencyClosure(clone, source);
        expect(r.ok).toBe(true);
        expect(fs.existsSync(path.join(clone, "node_modules", "marker"))).toBe(true);
    });

    it("is idempotent, so a re-provision does not fail on an existing link", () => {
        const parent = makeTempDir(tracked);
        const source = path.join(parent, "src");
        const clone = path.join(parent, "clone");
        fs.mkdirSync(path.join(source, "node_modules"), { recursive: true });
        fs.mkdirSync(clone, { recursive: true });
        expect(linkDependencyClosure(clone, source).ok).toBe(true);
        expect(linkDependencyClosure(clone, source).ok).toBe(true);
    });

    it("reports the packaging gap when the primary checkout has no resolved closure to lend", () => {
        const parent = makeTempDir(tracked);
        const source = path.join(parent, "src");
        const clone = path.join(parent, "clone");
        fs.mkdirSync(source, { recursive: true });
        fs.mkdirSync(clone, { recursive: true });
        const r = linkDependencyClosure(clone, source);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("clone-failed");
    });
});

describe("provision", () => {
    /**
     * Routes cover every `gh` call; unrouted local git and tar run for real, so the
     * assertions are against a genuine repository. An unrouted `gh` call fails by
     * construction — the fake never passes one through to the live API.
     */
    function harness(routes: Parameters<typeof fakeRunner>[0], opts: { withClone?: boolean } = {}) {
        const src = sourceCheckout();
        fs.mkdirSync(path.join(src.root, "node_modules"), { recursive: true });
        const parent = makeTempDir(tracked);
        const clone = path.join(parent, "clone");
        if (opts.withClone) {
            // A prior provision's clone, with a real origin to fetch from.
            const origin = path.join(parent, "origin.git");
            fs.mkdirSync(origin, { recursive: true });
            sh(origin, "git", "init", "-q", "--bare", "-b", "main");
            initRepo(clone, origin);
            writeCommit(clone, "seeded.txt", "seeded\n", "trunk");
            sh(clone, "git", "push", "-q", "-u", "origin", "main");
        }
        return { src, clone, run: fakeRunner(routes, defaultRunner) };
    }

    const LOGIN = { match: "gh api user", result: { stdout: "sameera\n" } };
    const SCOPES = {
        match: "gh auth status",
        result: { stdout: "  - Token scopes: 'repo', 'delete_repo'\n" },
    };
    const MERGE_OK = {
        match: "gh repo view",
        result: {
            stdout: JSON.stringify({
                url: `https://github.com/sameera/${SCRATCH_REPO_NAME}`,
                squashMergeAllowed: true,
                mergeCommitAllowed: true,
                rebaseMergeAllowed: true,
            }),
        },
    };

    it("refuses before creating anything when the credential cannot delete", () => {
        const h = harness([LOGIN, { match: "gh auth status", result: { stdout: "Token scopes: 'repo'\n" } }]);
        const r = provision(h.run, { sourceRepoRoot: h.src.root, cloneDir: h.clone, today: "2026-07-25" });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("missing-delete-scope");
        expect(callsMatching(h.run, "gh repo create")).toEqual([]);
    });

    it("creates the scratch repo, pushes a trunk commit, and enables all three merge methods", () => {
        const h = harness([
            LOGIN,
            SCOPES,
            {
                match: "gh repo view",
                sequence: [
                    { status: 1, stderr: "Could not resolve to a Repository" },
                    MERGE_OK.result,
                ],
            },
            { match: "gh repo create" },
            { match: "gh repo edit" },
            { match: "gh repo set-default" },
            { match: "push -u origin main" },
        ]);
        const r = provision(h.run, { sourceRepoRoot: h.src.root, cloneDir: h.clone, today: "2026-07-25" });
        expect(r.ok ? "ok" : r.error).toBe("ok");
        if (!r.ok) return;
        expect(r.value.reused).toBe(false);
        expect(r.value.nameWithOwner).toBe(`sameera/${SCRATCH_REPO_NAME}`);
        expect(r.value.toolchainCommit).toBe(h.src.commit);

        expect(callsMatching(h.run, "gh repo create").length).toBe(1);
        const edit = callsMatching(h.run, "gh repo edit").join(" ");
        expect(edit).toContain("--enable-squash-merge");
        expect(edit).toContain("--enable-merge-commit");
        expect(edit).toContain("--enable-rebase-merge");
        expect(callsMatching(h.run, "push -u origin main").length).toBe(1);
        // The trunk commit really exists in the clone, with the marker on it.
        expect(sh(h.clone, "git", "rev-parse", "--abbrev-ref", "HEAD")).toBe("main");
        expect(sh(h.clone, "git", "ls-files", MARKER_PATH)).toBe(MARKER_PATH);
    });

    const OWN_MARKER = {
        match: `gh api repos/sameera/${SCRATCH_REPO_NAME}/contents/${MARKER_PATH}`,
        result: {
            stdout: Buffer.from(
                `signature: ${MARKER_SIGNATURE}\nnameWithOwner: sameera/${SCRATCH_REPO_NAME}\ntoolchainCommit: ${"f".repeat(40)}\nprovisionedAt: 2026-07-20\n`,
            ).toString("base64"),
        },
    };

    it("reuses its own scratch repo on a second provision instead of making a look-alike", () => {
        const h = harness([LOGIN, SCOPES, MERGE_OK, OWN_MARKER], { withClone: true });
        const r = provision(h.run, { sourceRepoRoot: h.src.root, cloneDir: h.clone, today: "2026-07-25" });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.reused).toBe(true);
        expect(callsMatching(h.run, "gh repo create")).toEqual([]);
    });

    it("refuses, naming the repo, when something else already holds the scratch name", () => {
        const h = harness([
            LOGIN,
            SCOPES,
            MERGE_OK,
            { match: "gh api repos/", result: { status: 1, stderr: "Not Found" } },
        ]);
        const r = provision(h.run, { sourceRepoRoot: h.src.root, cloneDir: h.clone, today: "2026-07-25" });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("scratch-repo-exists");
        expect(r.error.message).toContain(`sameera/${SCRATCH_REPO_NAME}`);
        expect(callsMatching(h.run, "gh repo create")).toEqual([]);
    });

    it("refuses when a merge method under test is disabled on the reused repo", () => {
        const h = harness([
            LOGIN,
            SCOPES,
            {
                match: "gh repo view",
                result: {
                    stdout: JSON.stringify({
                        url: `https://github.com/sameera/${SCRATCH_REPO_NAME}`,
                        squashMergeAllowed: true,
                        mergeCommitAllowed: true,
                        rebaseMergeAllowed: false,
                    }),
                },
            },
            OWN_MARKER,
        ], { withClone: true });
        const r = provision(h.run, { sourceRepoRoot: h.src.root, cloneDir: h.clone, today: "2026-07-25" });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("merge-methods-disabled");
        expect(r.error.message).toContain("rebase");
    });

    it("makes no commit, branch, or push in the Nexus checkout it seeds from", () => {
        const h = harness([
            LOGIN,
            SCOPES,
            {
                match: "gh repo view",
                sequence: [{ status: 1, stderr: "Could not resolve to a Repository" }, MERGE_OK.result],
            },
            { match: "gh repo create" },
            { match: "gh repo edit" },
            { match: "gh repo set-default" },
            { match: "push -u origin main" },
        ]);
        const before = sh(h.src.root, "git", "rev-parse", "HEAD");
        const r = provision(h.run, { sourceRepoRoot: h.src.root, cloneDir: h.clone, today: "2026-07-25" });
        expect(r.ok).toBe(true);
        expect(sh(h.src.root, "git", "rev-parse", "HEAD")).toBe(before);
        expect(sh(h.src.root, "git", "status", "--porcelain")).toBe("");
        expect(sh(h.src.root, "git", "branch", "--list")).not.toContain("acceptance/");
        // Every mutating command the harness issued ran against the clone, never the source.
        for (const call of h.run.calls) {
            if (/\b(push|commit|worktree add)\b/.test(call)) expect(call).not.toContain(h.src.root);
        }
    });
});

describe("provision — failure paths that must not leave a half-made repo", () => {
    const LOGIN = { match: "gh api user", result: { stdout: "sameera\n" } };
    const SCOPES = { match: "gh auth status", result: { stdout: "Token scopes: 'repo', 'delete_repo'\n" } };
    const ABSENT = { match: "gh repo view", result: { status: 1, stderr: "Could not resolve to a Repository" } };

    function bare() {
        const src = sourceCheckout();
        fs.mkdirSync(path.join(src.root, "node_modules"), { recursive: true });
        return { src, clone: path.join(makeTempDir(tracked), "clone") };
    }

    it("reports a failing repo create instead of seeding into nothing", () => {
        const b = bare();
        const run = fakeRunner(
            [LOGIN, SCOPES, ABSENT, { match: "gh repo create", result: { status: 1, stderr: "name already exists" } }],
            defaultRunner,
        );
        const r = provision(run, { sourceRepoRoot: b.src.root, cloneDir: b.clone, today: "2026-07-25" });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-failed");
        expect(r.error.message).toContain("name already exists");
    });

    it("reports a failing clone of a reused scratch repo", () => {
        const b = bare();
        const run = fakeRunner(
            [
                LOGIN,
                SCOPES,
                { match: "gh repo view", result: { stdout: JSON.stringify({ url: `https://github.com/sameera/${SCRATCH_REPO_NAME}` }) } },
                {
                    match: "gh api repos/",
                    result: {
                        stdout: Buffer.from(
                            `signature: ${MARKER_SIGNATURE}\nnameWithOwner: sameera/${SCRATCH_REPO_NAME}\ntoolchainCommit: ${"f".repeat(40)}\nprovisionedAt: 2026-07-20\n`,
                        ).toString("base64"),
                    },
                },
                { match: "gh repo clone", result: { status: 1, stderr: "permission denied" } },
            ],
            defaultRunner,
        );
        const r = provision(run, { sourceRepoRoot: b.src.root, cloneDir: b.clone, today: "2026-07-25" });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("clone-failed");
    });

    it("reports the packaging gap rather than failing when there is no closure to borrow", () => {
        const src = sourceCheckout(); // no node_modules
        const clone = path.join(makeTempDir(tracked), "clone");
        const run = fakeRunner(
            [
                LOGIN,
                SCOPES,
                {
                    match: "gh repo view",
                    sequence: [
                        { status: 1, stderr: "Could not resolve to a Repository" },
                        {
                            stdout: JSON.stringify({
                                url: `https://github.com/sameera/${SCRATCH_REPO_NAME}`,
                                squashMergeAllowed: true,
                                mergeCommitAllowed: true,
                                rebaseMergeAllowed: true,
                            }),
                        },
                    ],
                },
                { match: "gh repo create" },
                { match: "push -u origin main" },
            ],
            defaultRunner,
        );
        const r = provision(run, { sourceRepoRoot: src.root, cloneDir: clone, today: "2026-07-25" });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.dependencyClosure).toBe("absent");
    });

    it("fails when the source of the seeded tree is not a git checkout at all", () => {
        const notARepo = makeTempDir(tracked);
        const run = fakeRunner([LOGIN, SCOPES], defaultRunner);
        const r = provision(run, { sourceRepoRoot: notARepo, cloneDir: path.join(notARepo, "clone"), today: "2026-07-25" });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("git-failed");
    });
});
