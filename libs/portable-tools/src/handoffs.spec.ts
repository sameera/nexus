import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultRunner } from "@nexus/close-migration/run";
import { allHandoffs, outstandingHandoffs, recordHandoff, resolveHandoff, startWorkbookSession } from "./handoffs";
import { LEARNER_PATH, UnignoredLearnerPathError, learnerRecordDir } from "./learner-store";
import { createWorkbook } from "./workbook-store";

let tmpDirs: string[] = [];
function makeDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "handoffs-"));
    tmpDirs.push(dir);
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

function sh(cwd: string, cmd: string, ...args: string[]): string {
    return execFileSync(cmd, args, { cwd, encoding: "utf8" }).replace(/\n$/, "");
}
function repoWithWorkbook(slug = "rdl"): string {
    const dir = makeDir();
    sh(dir, "git", "init", "-q", "-b", "main");
    sh(dir, "git", "config", "user.email", "spec@example.com");
    sh(dir, "git", "config", "user.name", "spec");
    fs.writeFileSync(path.join(dir, ".gitignore"), ".nexus/tmp/\n");
    const workbook = createWorkbook(dir, slug);
    fs.writeFileSync(path.join(workbook.root, "lesson-one.html"), "<p>one</p>\n");
    return dir;
}

describe("a paused session records the handoff it is waiting on", () => {
    it("names the story that was handed off", () => {
        const repo = repoWithWorkbook();

        const handoff = recordHandoff(repo, {
            story: "story-3-the-widget-seam",
            workbook: "rdl",
            recordedAt: "2026-09-06T10:00:00Z",
            note: "waiting on the reviewer",
        });

        expect(handoff.story).toBe("story-3-the-widget-seam");
        expect(handoff.note).toBe("waiting on the reviewer");
        expect(handoff.resolvedAt).toBeNull();
    });

    it("keeps the record in the learner's folder with everything else", () => {
        const repo = repoWithWorkbook();
        recordHandoff(repo, { story: "story-3", workbook: "rdl", recordedAt: "2026-09-06T10:00:00Z" });

        const dir = learnerRecordDir(repo, "handoffs");
        expect(fs.readdirSync(dir)).toHaveLength(1);
        expect(path.relative(repo, dir).split(path.sep).join("/")).toBe(`${LEARNER_PATH}/handoffs`);
        expect(sh(repo, "git", "status", "--porcelain")).not.toContain(".learner");
    });

    it("refuses a handoff that names no story", () => {
        const repo = repoWithWorkbook();

        expect(() => recordHandoff(repo, { story: "  ", workbook: "rdl", recordedAt: "now" })).toThrow(
            /must name the story/,
        );
    });
});

describe("a session that ended leaves the workbook resuming at the handed-off story", () => {
    it("resumes at the handed-off story rather than at the start", () => {
        const repo = repoWithWorkbook();
        recordHandoff(repo, { story: "story-3", workbook: "rdl", recordedAt: "2026-09-06T10:00:00Z" });

        // A new session: nothing carried over in memory, only what is on disk.
        const session = startWorkbookSession(repo, "rdl");

        expect(session.resumeAt?.story).toBe("story-3");
        expect(session.pages).toEqual(["lesson-one.html"]);
    });

    it("resumes at the start when nothing is outstanding", () => {
        const repo = repoWithWorkbook();
        const handoff = recordHandoff(repo, { story: "story-3", workbook: "rdl", recordedAt: "t1" });
        resolveHandoff(repo, handoff.id, "t2");

        expect(startWorkbookSession(repo, "rdl").resumeAt).toBeNull();
    });
});

describe("every outstanding handoff is listed, in a deterministic order", () => {
    it("lists them all, most recent last, and offers the most recent one", () => {
        const repo = repoWithWorkbook();
        recordHandoff(repo, { story: "story-1", workbook: "rdl", recordedAt: "t1" });
        recordHandoff(repo, { story: "story-2", workbook: "rdl", recordedAt: "t2" });
        recordHandoff(repo, { story: "story-3", workbook: "rdl", recordedAt: "t3" });

        const first = startWorkbookSession(repo, "rdl");
        const again = startWorkbookSession(repo, "rdl");

        expect(first.outstanding.map((h) => h.story)).toEqual(["story-1", "story-2", "story-3"]);
        expect(first.resumeAt?.story).toBe("story-3");
        expect(again.outstanding).toEqual(first.outstanding);
    });

    it("drops a resolved handoff from the list but keeps its record", () => {
        const repo = repoWithWorkbook();
        const one = recordHandoff(repo, { story: "story-1", workbook: "rdl", recordedAt: "t1" });
        recordHandoff(repo, { story: "story-2", workbook: "rdl", recordedAt: "t2" });

        resolveHandoff(repo, one.id, "t3");

        expect(outstandingHandoffs(repo).map((h) => h.story)).toEqual(["story-2"]);
        expect(allHandoffs(repo).map((h) => h.story)).toEqual(["story-1", "story-2"]);
        expect(allHandoffs(repo)[0].resolvedAt).toBe("t3");
    });

    it("lists only the handoffs of the workbook the session opened", () => {
        const repo = repoWithWorkbook("rdl");
        createWorkbook(repo, "other");
        recordHandoff(repo, { story: "story-1", workbook: "rdl", recordedAt: "t1" });
        recordHandoff(repo, { story: "story-9", workbook: "other", recordedAt: "t2" });

        expect(startWorkbookSession(repo, "rdl").outstanding.map((h) => h.story)).toEqual(["story-1"]);
        expect(startWorkbookSession(repo, "other").outstanding.map((h) => h.story)).toEqual(["story-9"]);
    });
});

describe("a handoff record is appended to and marked, never rewritten", () => {
    it("keeps everything it said when it is resolved", () => {
        const repo = repoWithWorkbook();
        const handoff = recordHandoff(repo, {
            story: "story-3",
            workbook: "rdl",
            recordedAt: "t1",
            note: "waiting on the reviewer",
        });
        const file = path.join(learnerRecordDir(repo, "handoffs"), handoff.id);
        const before = fs.readFileSync(file, "utf8");

        resolveHandoff(repo, handoff.id, "t2");
        const after = fs.readFileSync(file, "utf8");

        expect(after.startsWith(before)).toBe(true);
        expect(after).toContain("waiting on the reviewer");
        expect(after).toContain("- resolved: t2");
    });

    it("leaves an already-resolved record alone rather than marking it twice", () => {
        const repo = repoWithWorkbook();
        const handoff = recordHandoff(repo, { story: "story-3", workbook: "rdl", recordedAt: "t1" });
        resolveHandoff(repo, handoff.id, "t2");
        const file = path.join(learnerRecordDir(repo, "handoffs"), handoff.id);
        const once = fs.readFileSync(file, "utf8");

        expect(resolveHandoff(repo, handoff.id, "t3").resolvedAt).toBe("t2");
        expect(fs.readFileSync(file, "utf8")).toBe(once);
    });

    it("asks git before appending, so a rule removed after the pause stops the resolution", () => {
        const repo = repoWithWorkbook();
        const handoff = recordHandoff(repo, { story: "story-3", workbook: "rdl", recordedAt: "t1" });
        const file = path.join(learnerRecordDir(repo, "handoffs"), handoff.id);
        const before = fs.readFileSync(file, "utf8");

        fs.writeFileSync(path.join(repo, ".gitignore"), ".nexus/tmp/\n");

        expect(() => resolveHandoff(repo, handoff.id, "t2")).toThrow(UnignoredLearnerPathError);
        expect(fs.readFileSync(file, "utf8")).toBe(before);
    });

    it("records that a resolution was a manual override, so the two are not the same line", () => {
        const repo = repoWithWorkbook();
        const handoff = recordHandoff(repo, { story: "story-3", workbook: "rdl", recordedAt: "t1" });

        const resolved = resolveHandoff(repo, handoff.id, "t2");

        expect(resolved.resolution).toBe("override");
        expect(fs.readFileSync(path.join(learnerRecordDir(repo, "handoffs"), handoff.id), "utf8")).toContain("override");
    });

    it("records a resolution the session verified as verified, distinguishably from an override", () => {
        const repo = repoWithWorkbook();
        const one = recordHandoff(repo, { story: "story-1", workbook: "rdl", recordedAt: "t1" });
        const two = recordHandoff(repo, { story: "story-2", workbook: "rdl", recordedAt: "t2" });

        const verified = resolveHandoff(repo, one.id, "t3", defaultRunner, "verified");
        const overridden = resolveHandoff(repo, two.id, "t4", defaultRunner, "override");

        expect(verified.resolution).toBe("verified");
        expect(overridden.resolution).toBe("override");
        expect(verified.resolution).not.toBe(overridden.resolution);
    });

    it("says nothing about how a handoff still outstanding was resolved", () => {
        const repo = repoWithWorkbook();
        const handoff = recordHandoff(repo, { story: "story-3", workbook: "rdl", recordedAt: "t1" });

        expect(allHandoffs(repo).find((h) => h.id === handoff.id)?.resolution).toBeNull();
    });

    it("reports a handoff that was never recorded", () => {
        const repo = repoWithWorkbook();

        expect(() => resolveHandoff(repo, "handoff-9999.md", "t1")).toThrow(/no handoff record/);
    });
});
