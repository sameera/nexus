/**
 * Story #381 — the issue is created and its number recorded on the draft.
 *
 * The ordering is the point: the number is recoverable from exactly one place, so the draft carries
 * it before anything else is attempted. Everything asserted here is asserted through the handler,
 * over the argument vectors the platform client was handed.
 */

import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { FAIL, OK, checkoutWith, draft, fakeEnvironment, recordingIo, writeDraft } from "./fixtures";
import { withLink } from "./link";
import { runCreateEpic } from "./run";

const REPO = { classification: "labels", project: "none" };

function filed(github: Record<string, string> = REPO, extra: Record<string, string> = {}, options = {}) {
    const root: string = checkoutWith(github);
    const file: string = writeDraft(root, draft(extra));
    const fake = fakeEnvironment(options);
    const io = recordingIo(root);
    const code: number = runCreateEpic([file], io, fake.env);
    return { code, io, calls: fake.calls, asked: fake.asked, file, read: () => fs.readFileSync(file, "utf8") };
}

const vectors = (calls: string[][]): string[] => calls.map((call) => call.join(" "));

describe("the issue the run creates", () => {
    it("creates one issue carrying the draft's epic title and the derived body", () => {
        const run = filed();
        expect(run.code).toBe(0);
        const created: string[] = vectors(run.calls).filter((call) => call.startsWith("issue create"));
        expect(created).toHaveLength(1);
        expect(created[0]).toContain("--title Demo Epic");
        expect(created[0]).toContain("--body-file");
    });

    it("refuses a draft with no epic field, showing the expected shape and creating nothing", () => {
        const root: string = checkoutWith(REPO);
        const file: string = writeDraft(root, "---\nfeature: \"Demo\"\n---\n\n# Epic\n\nBody.\n");
        const fake = fakeEnvironment();
        const io = recordingIo(root);
        expect(runCreateEpic([file], io, fake.env)).toBe(1);
        expect(io.all()).toContain("No 'epic' field found in frontmatter");
        expect(io.all()).toContain('epic: "Your Epic Title"');
        expect(vectors(fake.calls).filter((call) => call.startsWith("issue create"))).toEqual([]);
    });

    it("exits non-zero when the created issue's number cannot be read back", () => {
        const run = filed(REPO, {}, {
            answer: (args: string[]) =>
                args[0] === "issue" && args[1] === "create" ? OK("created, but no address\n") : undefined,
        });
        expect(run.code).toBe(1);
        expect(run.io.all()).toContain("Could not extract issue number");
    });

    it("exits non-zero when the creation itself fails", () => {
        const run = filed(REPO, {}, {
            answer: (args: string[]) => (args[0] === "issue" && args[1] === "create" ? FAIL("no permission") : undefined),
        });
        expect(run.code).toBe(1);
        expect(run.io.err.join("\n")).toContain("Failed to create GitHub issue");
    });
});

describe("the number lands on the draft before anything decorates the issue", () => {
    it("writes the link, and writes it before any label, type or project call", () => {
        const run = filed();
        expect(run.read()).toContain('link: "#7"');
        // The only call before the write-back is the creation itself (and the label upsert it needs).
        const created: number = vectors(run.calls).findIndex((call) => call.startsWith("issue create"));
        const decorations: number[] = vectors(run.calls)
            .map((call, index) => (call.includes("--add-label") || call.startsWith("api graphql") ? index : -1))
            .filter((index) => index > created);
        expect(run.read().indexOf('link: "#7"')).toBeGreaterThan(-1);
        expect(decorations.every((index) => index > created)).toBe(true);
    });

    it("changes nothing in the draft outside that one field", () => {
        const root: string = checkoutWith(REPO);
        const before: string = draft();
        const file: string = writeDraft(root, before);
        runCreateEpic([file], recordingIo(root), fakeEnvironment().env);
        expect(fs.readFileSync(file, "utf8")).toBe(withLink(before, "7").content);
    });

    it("updates an existing link field in place rather than adding a second one", () => {
        const updated: string = withLink(draft({ link: '"#3"' }), "7").content ?? "";
        expect(updated.match(/^link:/gm)).toHaveLength(1);
        expect(updated).toContain('link: "#7"');
    });

    it("inserts the field before the closing fence when the draft carries none", () => {
        const updated: string = withLink(draft(), "7").content ?? "";
        expect(updated.split("\n").indexOf('link: "#7"')).toBeLessThan(updated.split("\n").lastIndexOf("---"));
    });
});

describe("a draft that already carries a link", () => {
    it("warns, asks, and creates nothing when the answer declines", () => {
        const run = filed(REPO, { link: '"#3"' }, { interactive: true, reply: "n" });
        expect(run.code).toBe(0);
        expect(run.asked).toHaveLength(1);
        expect(run.io.all()).toContain("Epic already has a link: #3");
        expect(vectors(run.calls).filter((call) => call.startsWith("issue create"))).toEqual([]);
    });

    it("files without asking when --yes is passed", () => {
        const root: string = checkoutWith(REPO);
        const file: string = writeDraft(root, draft({ link: '"#3"' }));
        const fake = fakeEnvironment({ interactive: true, reply: "n" });
        expect(runCreateEpic([file, "--yes"], recordingIo(root), fake.env)).toBe(0);
        expect(fake.asked).toEqual([]);
        expect(vectors(fake.calls).filter((call) => call.startsWith("issue create"))).toHaveLength(1);
    });

    it("files when the answer accepts", () => {
        const run = filed(REPO, { link: '"#3"' }, { interactive: true, reply: "y" });
        expect(run.code).toBe(0);
        expect(vectors(run.calls).filter((call) => call.startsWith("issue create"))).toHaveLength(1);
    });

    it("refuses with no terminal, names the flag, and never blocks", () => {
        const run = filed(REPO, { link: '"#3"' }, { interactive: false });
        expect(run.code).toBe(1);
        expect(run.asked).toEqual([]);
        expect(run.io.all()).toContain("--yes");
        expect(vectors(run.calls).filter((call) => call.startsWith("issue create"))).toEqual([]);
    });

    it("refuses the same way when a terminal is attached but its answer cannot be read", () => {
        const run = filed(REPO, { link: '"#3"' }, { interactive: true, reply: null });
        expect(run.code).toBe(1);
        expect(run.io.all()).toContain("--yes");
        expect(vectors(run.calls).filter((call) => call.startsWith("issue create"))).toEqual([]);
    });
});

describe("the label a run passes at creation", () => {
    it("upserts it before the create, so a repository that has never seen it files cleanly", () => {
        const run = filed();
        const upsert: number = vectors(run.calls).findIndex((call) => call.startsWith("label create epic"));
        const create: number = vectors(run.calls).findIndex((call) => call.startsWith("issue create"));
        expect(upsert).toBeGreaterThanOrEqual(0);
        expect(upsert).toBeLessThan(create);
        expect(vectors(run.calls)[create]).toContain("--label epic");
    });

    it("passes no label at creation in types mode", () => {
        const run = filed({ classification: "types", "epic-type": "Epic", project: "none" });
        const create: string = vectors(run.calls).find((call) => call.startsWith("issue create")) ?? "";
        expect(create).not.toContain("--label");
    });
});
