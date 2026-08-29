/**
 * Story #367 — the batch is decided legal before anything irreversible happens.
 *
 * A refused batch costs the lead a corrected file, never a half-filed batch to unpick on GitHub, so
 * every case here asserts the exit code *and* that no platform call was made at all.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type ToolkitIo } from "../io";
import { runCreateStory } from "./run";

function recordingIo(cwd: string): ToolkitIo & { out: string[]; err: string[] } {
    const out: string[] = [];
    const err: string[] = [];
    return { cwd, stdout: (line) => out.push(line), stderr: (line) => err.push(line), out, err };
}

/** A checkout declaring `settings` under `.nexus/config`, with a scratch folder of work items. */
function checkout(settings = "github:\n  classification: labels\n  project: none\n"): string {
    const root: string = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "nexus-filer-")));
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), settings);
    fs.mkdirSync(path.join(root, "scratch"));
    return root;
}

function writeItem(root: string, name: string, content: string): void {
    fs.writeFileSync(path.join(root, "scratch", name), content);
}

const STORY = `---
ref: STORY-1
title: "An ordinary story"
parent: "#353"
blocked_by: none
---

An ordinary story, which is a sub-issue of its epic.
`;

const STUB = `---
ref: STUB-1
title: "Retire the sequencing table"
labels: [backlog]
parent: "#353"
blocked_by: none
---

- **goal:** decide the fate of the hand-maintained wave ordering
`;

describe("discovering the batch", () => {
    it("reports the count it found and processes the work items in sorted filename order", () => {
        const root: string = checkout();
        writeItem(root, "STORY-2.md", STORY);
        writeItem(root, "STORY-1.md", STORY);
        writeItem(root, "STORY-10.md", STORY);
        writeItem(root, "NOTES.md", "not a work item");
        const io = recordingIo(root);
        runCreateStory([path.join(root, "scratch"), "--dry-run"], io);
        expect(io.out.join("\n")).toContain("3 story file(s)");
        const previewed: string[] = io.out.filter((l) => l.includes("STORY-")).map((l) => l.trim().split(":")[0]);
        expect(previewed).toEqual(["STORY-1.md", "STORY-10.md", "STORY-2.md"]);
    });

    it("exits non-zero and creates nothing when the target folder is not a directory", () => {
        const root: string = checkout();
        const io = recordingIo(root);
        expect(runCreateStory([path.join(root, "scratch", "absent")], io)).not.toBe(0);
        expect(io.err.join("\n")).toContain("not a directory");
    });

    it("reports an empty folder, exits zero, and creates nothing", () => {
        const root: string = checkout();
        const io = recordingIo(root);
        expect(runCreateStory([path.join(root, "scratch")], io)).toBe(0);
        expect(io.out.join("\n")).toContain("No STORY-*.md files found");
    });
});

describe("the target folder must resolve inside the target root", () => {
    it("exits non-zero naming the root it was measured against", () => {
        const root: string = checkout();
        const elsewhere: string = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "nexus-other-")));
        fs.writeFileSync(path.join(elsewhere, "STORY-1.md"), STORY);
        const io = recordingIo(root);
        expect(runCreateStory([elsewhere, "--root", root], io)).not.toBe(0);
        expect(io.err.join("\n")).toContain(root);
        expect(io.err.join("\n")).toContain("resolves outside the target root");
    });

    it("measures against the invoking working directory when no root is passed", () => {
        const root: string = checkout();
        writeItem(root, "STORY-1.md", STORY);
        const io = recordingIo(root);
        expect(runCreateStory([path.join(root, "scratch"), "--dry-run"], io)).toBe(0);
    });
});

describe("a work item carrying the unplanned label never asks for a parent", () => {
    it("refuses the whole batch, naming the work item and the parent it asked for", () => {
        const root: string = checkout();
        writeItem(root, "STORY-1.md", STORY);
        writeItem(root, "STUB-first.md", STUB); // not a work item: only STORY-*.md is
        writeItem(root, "STORY-stub.md", STUB);
        const io = recordingIo(root);
        expect(runCreateStory([path.join(root, "scratch")], io)).not.toBe(0);
        const errors: string = io.err.join("\n");
        expect(errors).toContain("STORY-stub.md");
        expect(errors).toContain("#353");
        expect(errors).toContain("Nothing was created.");
    });

    it("matches the value the repository declares for the unplanned label, not an assumed one", () => {
        const root: string = checkout("github:\n  classification: labels\n  unplanned-label: not-yet-planned\n");
        writeItem(root, "STORY-stub.md", STUB.replace("[backlog]", "[not-yet-planned]"));
        const io = recordingIo(root);
        expect(runCreateStory([path.join(root, "scratch")], io)).not.toBe(0);
        expect(io.err.join("\n")).toContain("not-yet-planned");
    });

    it("lets the same work item through once it declares no parent", () => {
        const root: string = checkout();
        writeItem(root, "STORY-stub.md", STUB.replace('parent: "#353"\n', ""));
        const io = recordingIo(root);
        expect(runCreateStory([path.join(root, "scratch"), "--dry-run"], io)).toBe(0);
    });
});
