import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    FOCUS_SLOT,
    INTERVIEW_SLOT_CAP,
    InterviewAlreadyRecorded,
    UnknownInterviewSlot,
    interviewSlate,
    readInterview,
    recordInterview,
    type InterviewRecord,
    type SlotAnswer,
} from "./interview.js";
import { LEARNER_RECORD_KINDS, LEARNER_IGNORE_RULE } from "./learner-store.js";
import { writeRoadmap, type Roadmap } from "./roadmap.js";
import { runWorkbookCli } from "./workbook-cli.js";

let tmpDirs: string[] = [];
function initRepo(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "interview-"));
    tmpDirs.push(dir);
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    fs.writeFileSync(path.join(dir, ".gitignore"), `${LEARNER_IGNORE_RULE}\n`);
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

const ROADMAP: Roadmap = {
    name: "alpha",
    epics: [100],
    stories: [
        { number: 11, title: "First", body: "Do the first thing.", epic: 100, blockedBy: [], external: [] },
        { number: 12, title: "Second", body: "Do the second thing.", epic: 100, blockedBy: [11], external: [] },
    ],
};

const OTHER: Roadmap = { ...ROADMAP, name: "beta", stories: [{ number: 21, title: "Elsewhere", body: "Different work.", epic: 200, blockedBy: [], external: [] }] };

/** One answer per slot, as an agent would hand them back after asking. */
function everySlot(): { slot: string; question: string; answer: string }[] {
    return interviewSlate().map((slot) => ({ slot: slot.id, question: `How much ${slot.id}?`, answer: "Some." }));
}

describe("the slate the stage is able to ask from", () => {
    it("stops at the ceiling this epic sets", () => {
        expect(interviewSlate().length).toBeGreaterThan(0);
        expect(interviewSlate().length).toBeLessThanOrEqual(INTERVIEW_SLOT_CAP);
        expect(INTERVIEW_SLOT_CAP).toBe(5);
    });

    it("is the same slate whatever the roadmap holds, so no question asks for roadmap material", () => {
        expect(interviewSlate().map((s) => s.id)).toEqual(interviewSlate().map((s) => s.id));
        expect(interviewSlate()).toEqual(interviewSlate());
    });

    it("declares each slot once, so the stage cannot repeat one", () => {
        const ids: string[] = interviewSlate().map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe("recording what the learner already knows", () => {
    it("keeps the learner's own words and resolves nothing to a concept identifier", () => {
        const repo: string = initRepo();
        const record: InterviewRecord = recordInterview(repo, ROADMAP, [
            { slot: interviewSlate()[0].id, question: "What have you built with it?", answer: "I have written a few React components." },
        ]);
        const answered: SlotAnswer = record.slots.find((s) => s.slot === interviewSlate()[0].id) as SlotAnswer;
        expect(answered.answer).toBe("I have written a few React components.");
        expect(answered.question).toBe("What have you built with it?");
    });

    it("marks a slot the learner left alone as unanswered rather than as knowing nothing", () => {
        const repo: string = initRepo();
        const record: InterviewRecord = recordInterview(repo, ROADMAP, [
            { slot: interviewSlate()[0].id, question: "q", answer: "a" },
        ]);
        const skipped: SlotAnswer[] = record.slots.filter((s) => s.slot !== interviewSlate()[0].id);
        expect(skipped.length).toBe(interviewSlate().length - 1);
        for (const slot of skipped) {
            expect(slot.answered).toBe(false);
            expect(slot.answer).toBe("");
        }
    });

    it("records an answer the learner gave as answered", () => {
        const repo: string = initRepo();
        const record: InterviewRecord = recordInterview(repo, ROADMAP, everySlot());
        expect(record.slots.every((s) => s.answered)).toBe(true);
    });

    it("refuses an answer for a slot the slate does not declare", () => {
        const repo: string = initRepo();
        expect(() => recordInterview(repo, ROADMAP, [{ slot: "invented-slot", question: "q", answer: "a" }])).toThrow(UnknownInterviewSlot);
    });

    it("writes it where every personal record goes, which git ignores", () => {
        const repo: string = initRepo();
        recordInterview(repo, ROADMAP, everySlot());
        expect(LEARNER_RECORD_KINDS).toContain("interview");
        expect(execFileSync("git", ["status", "--porcelain"], { cwd: repo, encoding: "utf8" })).not.toContain(".nexus");
    });
});

describe("one interview per roadmap", () => {
    it("reads the recorded starting point back rather than asking again", () => {
        const repo: string = initRepo();
        const first: InterviewRecord = recordInterview(repo, ROADMAP, everySlot());
        expect(readInterview(repo, ROADMAP.name)).toEqual(first);
    });

    it("refuses to record a second interview for the same roadmap", () => {
        const repo: string = initRepo();
        recordInterview(repo, ROADMAP, everySlot());
        expect(() => recordInterview(repo, ROADMAP, everySlot())).toThrow(InterviewAlreadyRecorded);
    });

    it("keys the record on the roadmap, so a second roadmap gets its own interview", () => {
        const repo: string = initRepo();
        recordInterview(repo, ROADMAP, everySlot());
        expect(readInterview(repo, OTHER.name)).toBeNull();
        expect(recordInterview(repo, OTHER, everySlot()).roadmap).toBe("beta");
    });

    it("has nothing to read before the interview has run", () => {
        expect(readInterview(initRepo(), "alpha")).toBeNull();
    });
});

describe("the interview at the command line", () => {
    function io(cwd: string): { cwd: string; out: string[]; err: string[]; stdout: (l: string) => void; stderr: (l: string) => void } {
        const out: string[] = [];
        const err: string[] = [];
        return { cwd, out, err, stdout: (l) => out.push(l), stderr: (l) => err.push(l) };
    }

    function repoWithRoadmap(): string {
        const repo: string = initRepo();
        fs.appendFileSync(path.join(repo, ".gitignore"), ".nexus/tmp/\n");
        writeRoadmap(repo, ROADMAP);
        return repo;
    }

    it("hands the agent the slate to phrase, and records nothing yet", () => {
        const repo: string = repoWithRoadmap();
        const captured = io(repo);
        expect(runWorkbookCli(["interview", "alpha"], captured)).toBe(0);
        const slate = JSON.parse(captured.out.join("\n")) as { slots: { id: string; asks: string }[] };
        expect(slate.slots.map((s) => s.id)).toEqual(interviewSlate().map((s) => s.id));
        expect(readInterview(repo, "alpha")).toBeNull();
    });

    it("records the answers the agent brought back", () => {
        const repo: string = repoWithRoadmap();
        const answers: string = path.join(repo, "answers.yml");
        fs.writeFileSync(answers, `answers:\n  - slot: ${interviewSlate()[0].id}\n    question: What have you built?\n    answer: A few React components.\n`);
        expect(runWorkbookCli(["interview", "alpha", "--answers", answers], io(repo))).toBe(0);
        expect(readInterview(repo, "alpha")?.slots[0].answer).toBe("A few React components.");
    });

    it("asks nothing a second time, and reads the recorded answers back instead", () => {
        const repo: string = repoWithRoadmap();
        recordInterview(repo, ROADMAP, everySlot());
        const captured = io(repo);
        expect(runWorkbookCli(["interview", "alpha"], captured)).toBe(0);
        expect(captured.out.join("\n")).not.toContain('"asks"');
        expect(captured.out.join("\n")).toContain(interviewSlate()[0].id);
    });

    it("has nothing to interview about until the roadmap is resolved", () => {
        const repo: string = initRepo();
        const captured = io(repo);
        expect(runWorkbookCli(["interview", "nothing-here"], captured)).toBe(1);
        expect(captured.err.join("\n")).toContain("roadmap");
    });
});

describe("the same interview establishes what the learner came to learn", () => {
    it("puts focus in the same slate, so the learner answers one interview rather than two", () => {
        expect(interviewSlate().map((s) => s.id)).toContain(FOCUS_SLOT);
        expect(interviewSlate().length).toBeLessThanOrEqual(INTERVIEW_SLOT_CAP);
    });

    it("records what the learner came to learn, and leaves the rest of the roadmap outside it", () => {
        const repo: string = initRepo();
        const record: InterviewRecord = recordInterview(repo, ROADMAP, [
            { slot: FOCUS_SLOT, question: "What did you come here to learn?", answer: "The resolver, not the renderer." },
        ]);
        expect(record.focus.stated).toBe("The resolver, not the renderer.");
        expect(record.focus.whole).toBe(false);
        expect(record.focus.stories).toBeNull();
    });

    it("records the whole roadmap as in focus when the learner names none, explicitly", () => {
        const repo: string = initRepo();
        const record: InterviewRecord = recordInterview(repo, ROADMAP, [
            { slot: interviewSlate()[0].id, question: "q", answer: "a" },
        ]);
        expect(record.focus.whole).toBe(true);
        expect(record.focus.stated).toBe("");
        expect(record.focus.stories).toEqual([11, 12]);
    });

    it("treats a focus slot the learner skipped as naming no focus", () => {
        const repo: string = initRepo();
        const record: InterviewRecord = recordInterview(repo, ROADMAP, [{ slot: FOCUS_SLOT, question: "q", answer: "   " }]);
        expect(record.focus.whole).toBe(true);
        expect(record.slots.find((s) => s.slot === FOCUS_SLOT)?.answered).toBe(false);
    });

    it("reads the recorded focus back with the rest of the interview, so nobody asks again", () => {
        const repo: string = initRepo();
        recordInterview(repo, ROADMAP, [{ slot: FOCUS_SLOT, question: "q", answer: "The resolver." }]);
        expect(readInterview(repo, "alpha")?.focus.stated).toBe("The resolver.");
    });
});
