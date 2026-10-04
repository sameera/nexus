/**
 * The landed check against real merge histories (epic #828, story #846, decision record #849, D4).
 *
 * Each case builds a genuine merge, squash or hand-edited merge in a temporary repository and asks
 * whether the pull request landed each file as it was reviewed at its analyzed head. Sibling pull
 * requests edit the same file before and after, so a position shift or a nearby edit is exercised
 * against real diffs, not against canned ones.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { compareLandedChange, landedOnTrunk } from "./landed-change.js";
import { defaultRunner } from "./run.js";
import { initRepo, makeParent, sh, writeCommit } from "./git-fixtures.js";

const tracked: string[] = [];
afterAll(() => {
    for (const d of tracked) fs.rmSync(d, { recursive: true, force: true });
});

const LINES = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`);

function text(lines: readonly string[]): string {
    return `${lines.join("\n")}\n`;
}

/** Replace the 1-based line `n` of `lines`. */
function edit(lines: readonly string[], n: number, value: string): string[] {
    return lines.map((l, i) => (i === n - 1 ? value : l));
}

function repoWithSharedFile(): { repo: string; c0: string } {
    const repo = path.join(makeParent(tracked), "web");
    initRepo(repo);
    writeCommit(repo, "README.md", "readme\n", "C0 readme");
    const c0 = writeCommit(repo, "shared.txt", text(LINES), "C0 shared");
    return { repo, c0 };
}

/** A branch off `from` with one commit writing `files`; returns its head. */
function branch(repo: string, name: string, from: string, files: Record<string, string>): string {
    sh(repo, "git", "checkout", "-q", "-b", name, from);
    for (const [file, content] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
        fs.writeFileSync(path.join(repo, file), content);
    }
    sh(repo, "git", "add", "-A");
    sh(repo, "git", "commit", "-qm", `${name} change`);
    const head = sh(repo, "git", "rev-parse", "HEAD");
    sh(repo, "git", "checkout", "-q", "main");
    return head;
}

/** Merge `name` into main with a merge commit; returns the merge-anchored range. */
function mergeNoFf(repo: string, name: string): { base: string; head: string } {
    const base = sh(repo, "git", "rev-parse", "main");
    sh(repo, "git", "merge", "-q", "--no-ff", "-m", `merge ${name}`, name);
    return { base, head: sh(repo, "git", "rev-parse", "HEAD") };
}

/** Squash `name` onto main; returns the merge-anchored range. */
function squash(repo: string, name: string): { base: string; head: string } {
    const base = sh(repo, "git", "rev-parse", "main");
    sh(repo, "git", "merge", "-q", "--squash", name);
    sh(repo, "git", "commit", "-qm", `squash ${name}`);
    return { base, head: sh(repo, "git", "rev-parse", "HEAD") };
}

/** Merge `name` with a merge commit, letting `alter` change the merged tree before it is committed. */
function mergeAltered(repo: string, name: string, alter: () => void): { base: string; head: string } {
    const base = sh(repo, "git", "rev-parse", "main");
    sh(repo, "git", "merge", "-q", "--no-ff", "--no-commit", name);
    alter();
    sh(repo, "git", "commit", "-qm", `merge ${name} (altered)`);
    return { base, head: sh(repo, "git", "rev-parse", "HEAD") };
}

function statuses(repo: string, analyzedHead: string, range: { base: string; head: string }): Record<string, string> {
    const r = compareLandedChange(defaultRunner, repo, { analyzedHead, ...range });
    if (!r.ok) throw new Error(r.error.message);
    return Object.fromEntries(r.files.map((f) => [f.path, f.status]));
}

describe("compareLandedChange — a pull request that landed as reviewed", () => {
    it("reports every reviewed file unchanged when nothing else touched them", () => {
        const { repo, c0 } = repoWithSharedFile();
        const head = branch(repo, "a", c0, { "shared.txt": text(edit(LINES, 15, "A15")), "src/a.ts": "a\n" });
        const range = mergeNoFf(repo, "a");
        expect(statuses(repo, head, range)).toEqual({ "shared.txt": "unchanged", "src/a.ts": "unchanged" });
    });

    it("leaves queue and discovery paths out, as range derivation does", () => {
        const { repo, c0 } = repoWithSharedFile();
        const head = branch(repo, "a", c0, { "src/a.ts": "a\n", ".nexus/queue/epic-1/dev/notes-a.md": "n\n", ".nexus/discovery/d/doc.md": "d\n" });
        const range = mergeNoFf(repo, "a");
        expect(statuses(repo, head, range)).toEqual({ "src/a.ts": "unchanged" });
    });
});

describe("compareLandedChange — sibling pull requests editing the same file (G9)", () => {
    it("is unchanged when a sibling merged first moved the lines and edited nearby", () => {
        const { repo, c0 } = repoWithSharedFile();
        const aHead = branch(repo, "a", c0, { "shared.txt": text(edit(LINES, 20, "A20")) });
        // The sibling inserts lines at the top, shifting every position, and edits two lines above A's.
        const sibling = ["inserted 1", "inserted 2", ...edit(LINES, 17, "B17")];
        branch(repo, "b", c0, { "shared.txt": text(sibling) });
        mergeNoFf(repo, "b");
        const range = mergeNoFf(repo, "a");
        expect(statuses(repo, aHead, range)).toEqual({ "shared.txt": "unchanged" });
    });

    it("is unchanged for a squash that took in a sibling's earlier edit to the same file", () => {
        const { repo, c0 } = repoWithSharedFile();
        const aHead = branch(repo, "a", c0, { "shared.txt": text(edit(LINES, 20, "A20")) });
        branch(repo, "b", c0, { "shared.txt": text(edit(LINES, 3, "B3")) });
        squash(repo, "b");
        const range = squash(repo, "a");
        expect(statuses(repo, aHead, range)).toEqual({ "shared.txt": "unchanged" });
    });

    it("is unchanged for both pull requests when the sibling merged after", () => {
        const { repo, c0 } = repoWithSharedFile();
        const aHead = branch(repo, "a", c0, { "shared.txt": text(edit(LINES, 20, "A20")) });
        const bHead = branch(repo, "b", c0, { "shared.txt": text(edit(LINES, 5, "B5")) });
        const aRange = mergeNoFf(repo, "a");
        const bRange = mergeNoFf(repo, "b");
        expect(statuses(repo, aHead, aRange)).toEqual({ "shared.txt": "unchanged" });
        expect(statuses(repo, bHead, bRange)).toEqual({ "shared.txt": "unchanged" });
    });

    it("is unchanged when the pull request deleted a file a sibling had edited first", () => {
        const { repo, c0 } = repoWithSharedFile();
        sh(repo, "git", "checkout", "-q", "-b", "a", c0);
        sh(repo, "git", "rm", "-q", "shared.txt");
        sh(repo, "git", "commit", "-qm", "a deletes shared");
        const aHead = sh(repo, "git", "rev-parse", "HEAD");
        sh(repo, "git", "checkout", "-q", "main");
        branch(repo, "b", c0, { "shared.txt": text(edit(LINES, 3, "B3")) });
        mergeNoFf(repo, "b");
        // The sibling's edit conflicts with the deletion; the merge resolves it as the deletion reviewed.
        const base = sh(repo, "git", "rev-parse", "main");
        defaultRunner("git", ["merge", "-q", "--no-ff", "--no-commit", "a"], { cwd: repo });
        sh(repo, "git", "rm", "-q", "shared.txt");
        sh(repo, "git", "commit", "-qm", "merge a");
        const range = { base, head: sh(repo, "git", "rev-parse", "HEAD") };
        expect(statuses(repo, aHead, range)).toEqual({ "shared.txt": "unchanged" });
    });
});

describe("compareLandedChange — a file that did not land as reviewed (G8)", () => {
    it("reports a reviewed file the merge landed renamed as changed", () => {
        const { repo, c0 } = repoWithSharedFile();
        const head = branch(repo, "a", c0, { "shared.txt": text(edit(LINES, 15, "A15")) });
        const range = mergeAltered(repo, "a", () => sh(repo, "git", "mv", "shared.txt", "moved.txt"));
        expect(statuses(repo, head, range)).toEqual({ "moved.txt": "changed", "shared.txt": "changed" });
    });

    it("reports a reviewed file the merge landed deleted as changed", () => {
        const { repo, c0 } = repoWithSharedFile();
        const head = branch(repo, "a", c0, { "shared.txt": text(edit(LINES, 15, "A15")), "src/a.ts": "a\n" });
        const range = mergeAltered(repo, "a", () => sh(repo, "git", "rm", "-qf", "shared.txt"));
        expect(statuses(repo, head, range)).toEqual({ "shared.txt": "changed", "src/a.ts": "unchanged" });
    });

    it("reports a reviewed file the merge landed with a different mode as changed", () => {
        const { repo, c0 } = repoWithSharedFile();
        const head = branch(repo, "a", c0, { "shared.txt": text(edit(LINES, 15, "A15")) });
        const range = mergeAltered(repo, "a", () => sh(repo, "git", "update-index", "--chmod=+x", "shared.txt"));
        expect(statuses(repo, head, range)).toEqual({ "shared.txt": "changed" });
    });

    it("reports a reviewed file whose landed content differs as changed", () => {
        const { repo, c0 } = repoWithSharedFile();
        const head = branch(repo, "a", c0, { "shared.txt": text(edit(LINES, 15, "A15")) });
        const range = mergeAltered(repo, "a", () => {
            fs.writeFileSync(path.join(repo, "shared.txt"), text(edit(LINES, 15, "A15 edited in the merge")));
            sh(repo, "git", "add", "shared.txt");
        });
        expect(statuses(repo, head, range)).toEqual({ "shared.txt": "changed" });
    });

    it("reports a file the merge landed that analysis never reviewed as changed", () => {
        const { repo, c0 } = repoWithSharedFile();
        const head = branch(repo, "a", c0, { "src/a.ts": "a\n" });
        const range = mergeAltered(repo, "a", () => {
            fs.writeFileSync(path.join(repo, "src", "extra.ts"), "extra\n");
            sh(repo, "git", "add", "src/extra.ts");
        });
        expect(statuses(repo, head, range)).toEqual({ "src/a.ts": "unchanged", "src/extra.ts": "changed" });
    });

    it("fails, rather than answering, when the analyzed head is not in the checkout", () => {
        const { repo, c0 } = repoWithSharedFile();
        branch(repo, "a", c0, { "src/a.ts": "a\n" });
        const range = mergeNoFf(repo, "a");
        const r = compareLandedChange(defaultRunner, repo, { analyzedHead: "e".repeat(40), ...range });
        expect(r.ok).toBe(false);
    });
});

describe("landedOnTrunk — whether the merge commit reached trunk (G7)", () => {
    it("answers yes for a merge commit on trunk, and no for one merged into another branch", () => {
        const { repo, c0 } = repoWithSharedFile();
        branch(repo, "a", c0, { "src/a.ts": "a\n" });
        const onMain = mergeNoFf(repo, "a").head;
        // A stacked pull request merged into its base branch, which never reached trunk.
        sh(repo, "git", "checkout", "-q", "-b", "stack-base", c0);
        writeCommit(repo, "src/base.ts", "base\n", "stack base");
        sh(repo, "git", "checkout", "-q", "-b", "stacked");
        writeCommit(repo, "src/stacked.ts", "stacked\n", "stacked");
        sh(repo, "git", "checkout", "-q", "stack-base");
        sh(repo, "git", "merge", "-q", "--no-ff", "-m", "merge stacked into stack-base", "stacked");
        const offTrunk = sh(repo, "git", "rev-parse", "HEAD");
        sh(repo, "git", "checkout", "-q", "main");

        const yes = landedOnTrunk(defaultRunner, repo, onMain);
        const no = landedOnTrunk(defaultRunner, repo, offTrunk);
        expect(yes.ok && yes.onTrunk).toBe(true);
        expect(no.ok && no.onTrunk).toBe(false);
        expect(no.ok && no.trunkRef).toBe("main");
    });
});
