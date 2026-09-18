import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultOutPath } from "./write.js";
import { ensurePlanningDir, listPlanningDirs, planningDirPath, removePlanningDir } from "./planning-dir.js";

let tmpDirs: string[] = [];

afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

/** A committed git repo whose .gitignore excludes `.nexus/tmp/` — the same fixture write.spec.ts uses. */
function scratchRepo(): string {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "planning-dir-"));
    tmpDirs.push(repo);
    fs.writeFileSync(path.join(repo, ".gitignore"), ".nexus/tmp/\n");
    execFileSync("git", ["init", "-q"], { cwd: repo, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "t@example.com"], { cwd: repo, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "T"], { cwd: repo, stdio: "ignore" });
    execFileSync("git", ["add", "-A"], { cwd: repo, stdio: "ignore" });
    execFileSync("git", ["commit", "-q", "-m", "base"], { cwd: repo, stdio: "ignore" });
    return repo;
}

describe("planningDirPath — Story #641 AC1: never drainable", () => {
    it("never sits directly under .nexus/tmp/, the shape nxs.distill's scan looks for", () => {
        const planning = planningDirPath("/repo", "nxs-epic-onboarding");
        const scratchRoot = path.join("/repo", ".nexus", "tmp");
        expect(path.dirname(planning)).not.toBe(scratchRoot);
        expect(path.dirname(path.dirname(planning))).toBe(scratchRoot);
    });
});

describe("planningDirPath", () => {
    it("keys the path on the run name under a planning namespace nested inside .nexus/tmp", () => {
        expect(planningDirPath("/repo", "nxs-epic-onboarding")).toBe(
            path.join("/repo", ".nexus", "tmp", "planning", "nxs-epic-onboarding"),
        );
    });

    it("never collides with the resolver's materialized epic directory for the same number (Story #639 AC2)", () => {
        const planning = planningDirPath("/repo", "epic-115");
        const materialized = defaultOutPath("/repo", 115);
        expect(planning).not.toBe(path.dirname(materialized));
    });

    it("gives two different run names two different, isolated paths (Story #639 AC2)", () => {
        expect(planningDirPath("/repo", "nxs-epic-a")).not.toBe(planningDirPath("/repo", "nxs-epic-b"));
    });
});

describe("ensurePlanningDir", () => {
    it("creates the directory and leaves git status clean (Story #641 AC2 — gitignored)", () => {
        const repo = scratchRepo();
        const out = ensurePlanningDir(repo, "nxs-epic-onboarding");
        expect(out).toBe(planningDirPath(repo, "nxs-epic-onboarding"));
        expect(fs.existsSync(out)).toBe(true);
        fs.writeFileSync(path.join(out, "epic.md"), "draft\n");
        const status = execFileSync("git", ["status", "--porcelain"], { cwd: repo, encoding: "utf8" });
        expect(status.trim()).toBe("");
    });

    it("is idempotent — calling it again on the same name does not fail or move existing content", () => {
        const repo = scratchRepo();
        const out = ensurePlanningDir(repo, "nxs-epic-onboarding");
        fs.writeFileSync(path.join(out, "epic.md"), "draft\n");
        const out2 = ensurePlanningDir(repo, "nxs-epic-onboarding");
        expect(out2).toBe(out);
        expect(fs.readFileSync(path.join(out, "epic.md"), "utf8")).toBe("draft\n");
    });
});

describe("listPlanningDirs", () => {
    it("returns an empty list when no run has ever written under the namespace", () => {
        const repo = scratchRepo();
        expect(listPlanningDirs(repo)).toEqual([]);
    });

    it("finds a draft left behind by an earlier, unfinished run (Story #639 AC3)", () => {
        const repo = scratchRepo();
        ensurePlanningDir(repo, "nxs-epic-onboarding");
        expect(listPlanningDirs(repo)).toEqual(["nxs-epic-onboarding"]);
    });

    it("keeps two concurrent runs' drafts separate (Story #639 AC2)", () => {
        const repo = scratchRepo();
        ensurePlanningDir(repo, "nxs-epic-a");
        ensurePlanningDir(repo, "nxs-epic-b");
        expect(listPlanningDirs(repo).sort()).toEqual(["nxs-epic-a", "nxs-epic-b"]);
    });
});

describe("removePlanningDir", () => {
    it("removes the run's own folder and reports removed: true", () => {
        const repo = scratchRepo();
        ensurePlanningDir(repo, "nxs-epic-onboarding");
        const result = removePlanningDir(repo, "nxs-epic-onboarding");
        expect(result).toEqual({ ok: true, path: planningDirPath(repo, "nxs-epic-onboarding"), removed: true });
        expect(fs.existsSync(planningDirPath(repo, "nxs-epic-onboarding"))).toBe(false);
    });

    it("is a no-op, not a failure, when the named folder does not exist", () => {
        const repo = scratchRepo();
        const result = removePlanningDir(repo, "nxs-epic-never-created");
        expect(result).toEqual({ ok: true, path: planningDirPath(repo, "nxs-epic-never-created"), removed: false });
    });

    it("never touches a sibling run's folder (decision record #646 invariant 6)", () => {
        const repo = scratchRepo();
        ensurePlanningDir(repo, "nxs-epic-a");
        ensurePlanningDir(repo, "nxs-epic-b");
        removePlanningDir(repo, "nxs-epic-a");
        expect(fs.existsSync(planningDirPath(repo, "nxs-epic-b"))).toBe(true);
    });

    it("refuses a name that would escape the planning namespace via a path separator", () => {
        const repo = scratchRepo();
        const result = removePlanningDir(repo, "../escaped");
        expect(result.ok).toBe(false);
    });

    it("refuses a name that would escape the planning namespace via a traversal segment", () => {
        const repo = scratchRepo();
        const result = removePlanningDir(repo, "..");
        expect(result.ok).toBe(false);
    });
});
