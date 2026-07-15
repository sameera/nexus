import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildWorkspaceFixture, commitAll, initRepo, makeParent, sh } from "./git-fixtures";
import { type MigrateResult, migrateEntry } from "./migrate";
import { type Runner, defaultRunner } from "./run";

function asOk(result: MigrateResult) {
    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(`expected ok result, got error: ${result.error.message}`);
    }
    return result.outcome;
}

function asError(result: MigrateResult) {
    expect(result.ok).toBe(false);
    if (result.ok) {
        throw new Error("expected an error result, got ok");
    }
    return result.error;
}

describe("migrateEntry", () => {
    let tmpDirs: string[] = [];

    afterEach(() => {
        for (const dir of tmpDirs) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
        tmpDirs = [];
    });

    function fixture() {
        const parent = makeParent(tmpDirs);
        return buildWorkspaceFixture(parent);
    }

    // --- gating ---------------------------------------------------------

    it("reports entry-not-found when the entry directory has no epic.md", () => {
        const parent = makeParent(tmpDirs);
        const missing = path.join(parent, "nowhere");

        const error = asError(migrateEntry(missing));
        expect(error.problem).toBe("entry-not-found");
    });

    it("reports not-a-git-repo when the entry lives outside any checkout", () => {
        const parent = makeParent(tmpDirs);
        const entryDir = path.join(parent, "stray-queue-entry");
        fs.mkdirSync(entryDir, { recursive: true });
        fs.writeFileSync(path.join(entryDir, "epic.md"), "# epic\n");

        const error = asError(migrateEntry(entryDir));
        expect(error.problem).toBe("not-a-git-repo");
    });

    // --- 12: happy path (hub side) ---------------------------------------

    it("commits the entry into the hub queue on the happy path", () => {
        const { hubRoot, entryDir, entryName } = fixture();

        const outcome = asOk(migrateEntry(entryDir));

        expect(outcome.entryName).toBe(entryName);
        expect(outcome.hubBranch).toBe("main");
        expect(outcome.hubCommit).toMatch(/^[0-9a-f]{40}$/);
        expect(outcome.alreadyMigrated).toBe(false);

        expect(sh(hubRoot, "git", "rev-parse", "--abbrev-ref", "HEAD")).toBe("main");

        const files = sh(hubRoot, "git", "show", "--name-only", "--format=", "HEAD")
            .split("\n")
            .filter(Boolean)
            .sort();
        expect(files).toEqual(
            ["analyze-receipt.md", "close-record.md", "decision-record.md", "epic.md"].map(
                (f) => `.nexus/queue/${entryName}/${f}`,
            ),
        );
    });

    // --- 12b: exactly-one-place end state (Story 3) -----------------------

    it("removes the entry from the member and commits the deletion, leaving it in exactly one place", () => {
        const { memberRoot, entryDir, entryName } = fixture();

        const outcome = asOk(migrateEntry(entryDir));

        expect(fs.existsSync(entryDir)).toBe(false);
        expect(
            sh(memberRoot, "git", "status", "--porcelain", "--", `.nexus/queue/${entryName}`),
        ).toBe("");
        expect(outcome.removalCommit).toMatch(/^[0-9a-f]{40}$/);

        const lastMessage = sh(memberRoot, "git", "log", "-1", "--format=%s");
        expect(lastMessage).toContain(entryName);

        const removedFiles = sh(memberRoot, "git", "show", "--name-only", "--format=", "HEAD")
            .split("\n")
            .filter(Boolean);
        expect(removedFiles.length).toBeGreaterThan(0);
        expect(removedFiles.every((f) => f.startsWith(`.nexus/queue/${entryName}/`))).toBe(true);
    });

    // --- 15: member's unrelated staged work untouched ----------------------

    it("leaves the member's unrelated staged work untouched by the removal commit", () => {
        const { memberRoot, entryDir } = fixture();
        fs.writeFileSync(path.join(memberRoot, "unrelated.txt"), "unrelated\n");
        sh(memberRoot, "git", "add", "unrelated.txt");

        asOk(migrateEntry(entryDir));

        expect(sh(memberRoot, "git", "status", "--porcelain", "--", "unrelated.txt")).toMatch(
            /^A\s+unrelated\.txt$/,
        );
        const removedFiles = sh(memberRoot, "git", "show", "--name-only", "--format=", "HEAD").split(
            "\n",
        );
        expect(removedFiles).not.toContain("unrelated.txt");
    });

    // --- 13: untracked fidelity -------------------------------------------

    it("preserves the exact byte content of untracked files", () => {
        const { hubRoot, entryDir, entryName } = fixture();
        const source = fs
            .readFileSync(path.join(entryDir, "close-record.md"), "utf8")
            .replace(/\n$/, "");

        asOk(migrateEntry(entryDir));

        const blob = sh(hubRoot, "git", "show", `HEAD:.nexus/queue/${entryName}/close-record.md`);
        expect(blob).toBe(source);
    });

    // --- 14: dirty hub untouched --------------------------------------

    it("leaves unrelated dirty hub state untouched", () => {
        const { hubRoot, entryDir } = fixture();
        fs.writeFileSync(path.join(hubRoot, "notes.md"), "original\n");
        commitAll(hubRoot, "seed notes");
        fs.writeFileSync(path.join(hubRoot, "notes.md"), "changed\n");
        fs.writeFileSync(path.join(hubRoot, "new-file.txt"), "new\n");
        sh(hubRoot, "git", "add", "new-file.txt");
        const before = sh(hubRoot, "git", "status", "--porcelain");

        asOk(migrateEntry(entryDir));

        const after = sh(hubRoot, "git", "status", "--porcelain");
        expect(after).toBe(before);

        const files = sh(hubRoot, "git", "show", "--name-only", "--format=", "HEAD")
            .split("\n")
            .filter(Boolean);
        expect(files.every((f) => f.startsWith(".nexus/queue/"))).toBe(true);
    });

    // --- 16: wrong role -----------------------------------------------

    it("refuses to run against a single-repo checkout, touching nothing", () => {
        const parent = makeParent(tmpDirs);
        const repo = path.join(parent, "solo");
        initRepo(repo, "git@github.com:acme/solo.git");
        const entryDir = path.join(repo, ".nexus", "queue", "some-epic-aaaa1111");
        fs.mkdirSync(entryDir, { recursive: true });
        fs.writeFileSync(path.join(entryDir, "epic.md"), "# epic\n");
        commitAll(repo, "plan epic");
        const beforeCount = sh(repo, "git", "rev-list", "--count", "HEAD");

        const error = asError(migrateEntry(entryDir));

        expect(error.problem).toBe("wrong-role");
        expect(sh(repo, "git", "rev-list", "--count", "HEAD")).toBe(beforeCount);
        expect(fs.existsSync(entryDir)).toBe(true);
    });

    it("refuses to run against the hub checkout itself, touching nothing", () => {
        const { hubRoot } = fixture();
        const entryDir = path.join(hubRoot, ".nexus", "queue", "hub-entry-bbbb2222");
        fs.mkdirSync(entryDir, { recursive: true });
        fs.writeFileSync(path.join(entryDir, "epic.md"), "# epic\n");
        commitAll(hubRoot, "plan hub-side epic");
        const beforeCount = sh(hubRoot, "git", "rev-list", "--count", "HEAD");

        const error = asError(migrateEntry(entryDir));

        expect(error.problem).toBe("wrong-role");
        expect(sh(hubRoot, "git", "rev-list", "--count", "HEAD")).toBe(beforeCount);
    });

    // --- 17: hub unresolvable -------------------------------------------

    it("passes through missing-hub-checkout when the hub cannot be located, leaving the member entry intact", () => {
        const { hubRoot, entryDir } = fixture();
        fs.renameSync(hubRoot, `${hubRoot}-away`);

        const error = asError(migrateEntry(entryDir));

        expect(error.problem).toBe("missing-hub-checkout");
        expect(fs.existsSync(entryDir)).toBe(true);
    });

    // --- 18: conflict -----------------------------------------------------

    it("reports entry-conflict when the hub already holds a different entry, touching nothing", () => {
        const { hubRoot, entryDir, entryName } = fixture();
        const conflictDir = path.join(hubRoot, ".nexus", "queue", entryName);
        fs.mkdirSync(conflictDir, { recursive: true });
        fs.writeFileSync(path.join(conflictDir, "epic.md"), "# a DIFFERENT epic\n");
        commitAll(hubRoot, "pre-existing conflicting entry");
        const beforeHead = sh(hubRoot, "git", "rev-parse", "HEAD");
        const beforeStatus = sh(hubRoot, "git", "status", "--porcelain");

        const error = asError(migrateEntry(entryDir));

        expect(error.problem).toBe("entry-conflict");
        expect(sh(hubRoot, "git", "rev-parse", "HEAD")).toBe(beforeHead);
        expect(sh(hubRoot, "git", "status", "--porcelain")).toBe(beforeStatus);
        expect(fs.existsSync(entryDir)).toBe(true);
    });

    // --- 19 / 19b: idempotent re-run, completing the move -----------------

    it("is idempotent across a simulated crash-after-commit, ending with exactly one place holding the entry", () => {
        const { hubRoot, memberRoot, entryDir, entryName } = fixture();

        const first = asOk(migrateEntry(entryDir));
        const countAfterFirst = sh(hubRoot, "git", "rev-list", "--count", "HEAD");
        expect(first.removalCommit).toMatch(/^[0-9a-f]{40}$/);

        // Simulate an operator restoring the entry after the fact (or a crash recovery that
        // re-materializes it): the member entry is repopulated from the hub's committed copy.
        const dest = path.join(hubRoot, ".nexus", "queue", entryName);
        fs.rmSync(entryDir, { recursive: true, force: true });
        fs.cpSync(dest, entryDir, { recursive: true });

        const second = asOk(migrateEntry(entryDir));

        expect(second.alreadyMigrated).toBe(true);
        expect(second.hubCommit).toBe(first.hubCommit);
        expect(sh(hubRoot, "git", "rev-list", "--count", "HEAD")).toBe(countAfterFirst);

        // 19b: end state is exactly-one-place, and the removal is committed in member history.
        expect(fs.existsSync(entryDir)).toBe(false);
        expect(
            sh(memberRoot, "git", "status", "--porcelain", "--", `.nexus/queue/${entryName}`),
        ).toBe("");
        expect(sh(memberRoot, "git", "log", "--format=%s")).toContain(entryName);
    });

    // --- 20: failure injection, hub left clean ----------------------------

    it("cleans up the hub copy when the hub commit fails, leaving the hub clean and the member entry intact", () => {
        const { hubRoot, entryDir, entryName } = fixture();
        const dest = path.join(hubRoot, ".nexus", "queue", entryName);
        const failingRunner: Runner = (cmd, args, opts) => {
            if (cmd === "git" && args[0] === "commit" && opts.cwd === hubRoot) {
                return { status: 1, stdout: "", stderr: "simulated commit failure" };
            }
            return defaultRunner(cmd, args, opts);
        };

        const error = asError(migrateEntry(entryDir, failingRunner));

        expect(error.problem).toBe("hub-commit-failed");
        expect(sh(hubRoot, "git", "status", "--porcelain")).toBe("");
        expect(fs.existsSync(dest)).toBe(false);
        expect(fs.existsSync(entryDir)).toBe(true);
    });

    // --- 21: verify mismatch -----------------------------------------------

    it("reports verify-mismatch without removing the member entry when the post-commit read-back is corrupted", () => {
        const { hubRoot, entryDir } = fixture();
        const corruptingRunner: Runner = (cmd, args, opts) => {
            const result = defaultRunner(cmd, args, opts);
            if (cmd === "git" && args[0] === "ls-tree" && opts.cwd === hubRoot) {
                return { ...result, stdout: "garbage\n" };
            }
            return result;
        };

        const error = asError(migrateEntry(entryDir, corruptingRunner));

        expect(error.problem).toBe("verify-mismatch");
        expect(error.message).toMatch(/[0-9a-f]{40}/);
        expect(fs.existsSync(entryDir)).toBe(true);
    });

    // --- 22: detached hub HEAD ----------------------------------------

    it("refuses when the hub is on a detached HEAD, changing nothing", () => {
        const { hubRoot, entryDir } = fixture();
        sh(hubRoot, "git", "checkout", "--detach", "-q");
        const beforeCount = sh(hubRoot, "git", "rev-list", "--count", "HEAD");

        const error = asError(migrateEntry(entryDir));

        expect(error.problem).toBe("hub-detached-head");
        expect(sh(hubRoot, "git", "rev-list", "--count", "HEAD")).toBe(beforeCount);
        expect(fs.existsSync(entryDir)).toBe(true);
    });

    // --- 23: entry with no tracked files ------------------------------

    it("removes an entry whose files are all untracked, without creating a removal commit", () => {
        const parent = makeParent(tmpDirs);
        const { memberRoot } = buildWorkspaceFixture(parent);
        const entryName = "untracked-only-epic-cccc3333";
        const entryDir = path.join(memberRoot, ".nexus", "queue", entryName);
        fs.mkdirSync(entryDir, { recursive: true });
        fs.writeFileSync(path.join(entryDir, "epic.md"), "# untracked epic\n");
        const beforeCount = sh(memberRoot, "git", "rev-list", "--count", "HEAD");

        const outcome = asOk(migrateEntry(entryDir));

        expect(outcome.removalCommit).toBeNull();
        expect(fs.existsSync(entryDir)).toBe(false);
        expect(sh(memberRoot, "git", "rev-list", "--count", "HEAD")).toBe(beforeCount);
    });

    // --- removal-failed: coverage for the last gated failure mode ---------

    it("reports removal-failed and names the safe hub commit when the member-side removal fails", () => {
        const { hubRoot, entryDir } = fixture();
        const failingRunner: Runner = (cmd, args, opts) => {
            if (cmd === "git" && args[0] === "commit" && opts.cwd !== hubRoot) {
                return { status: 1, stdout: "", stderr: "simulated removal-commit failure" };
            }
            return defaultRunner(cmd, args, opts);
        };

        const error = asError(migrateEntry(entryDir, failingRunner));

        expect(error.problem).toBe("removal-failed");
        expect(error.message).toContain("safe in the hub commit");
    });
});
