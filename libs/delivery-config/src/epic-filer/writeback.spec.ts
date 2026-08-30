/**
 * Story #385 — the run persists what it decided and reports the outcome.
 *
 * These are the epic filer's half of `test_writeback_integration`: a first run on a repository that
 * declares no publishing configuration writes down what it settled on, and the second run reads
 * that block and re-probes nothing. The saving is the point — the probe and the discovery are the
 * slow, fragile calls.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { checkout, checkoutWith, draft, fakeEnvironment, recordingIo, writeDraft } from "./fixtures";
import { GREEN, RED, YELLOW } from "./output";
import { runCreateEpic } from "./run";

const SETTINGS = path.join(".nexus", "config", "settings.yml");

function repoWithNoGithubBlock(): { root: string; file: string } {
    const root: string = checkout({ [SETTINGS]: "cross-ref:\n  docs-root: https://example/docs\n" });
    return { root, file: writeDraft(root, draft()) };
}

function fileEpic(root: string, file: string, argv: string[] = []) {
    const fake = fakeEnvironment();
    const io = recordingIo(root);
    const code: number = runCreateEpic([file, ...argv], io, fake.env);
    return { code, io, calls: fake.calls.map((call) => call.join(" ")) };
}

const settingsOf = (root: string): string => fs.readFileSync(path.join(root, SETTINGS), "utf8");

describe("the first run persists what it decided", () => {
    it("seeds the block, preserves what was already declared, and still links the draft", () => {
        const { root, file } = repoWithNoGithubBlock();
        const run = fileEpic(root, file);
        expect(run.code).toBe(0);

        const text: string = settingsOf(root);
        expect(text).toContain("cross-ref:\n  docs-root: https://example/docs");
        expect(text).toContain("github:");
        expect(text).toContain("classification: labels");
        expect(text).toContain("project: none");
        expect(text).not.toContain("issues-repo");
        expect(text).not.toContain("epic-repo");
        expect(fs.readFileSync(file, "utf8")).toContain('link: "#7"');
        expect(run.io.all()).toContain("Seeded github config");
    });

    it("leaves a key the repository already declares exactly as it found it", () => {
        const root: string = checkout({ [SETTINGS]: "github:\n  classification: labels\n  project: none\n" });
        const file: string = writeDraft(root, draft());
        fileEpic(root, file);
        expect(settingsOf(root)).toBe("github:\n  classification: labels\n  project: none\n");
    });

    it("never freezes an invocation-time project flag into configuration", () => {
        const { root, file } = repoWithNoGithubBlock();
        fileEpic(root, file, ["--project", "acme/1"]);
        expect(settingsOf(root)).not.toContain("acme/1");
    });
});

describe("the second run reads the block instead of re-probing", () => {
    it("makes no discovery query and no issue-type probe, and rewrites nothing", () => {
        const { root, file } = repoWithNoGithubBlock();
        expect(fileEpic(root, file).code).toBe(0);
        const before: string = settingsOf(root);

        const second = fileEpic(root, file, ["-y"]);
        expect(second.code).toBe(0);
        expect(second.calls.filter((call) => call.startsWith("api graphql"))).toEqual([]);
        expect(second.calls.join("\n")).not.toContain("issueTypes");
        expect(settingsOf(root)).toBe(before);
    });
});

describe("what the run reports", () => {
    it("names the issue, the title, the applied label, the design decision and the address", () => {
        const root: string = checkoutWith({ classification: "labels", project: "none" });
        const file: string = writeDraft(root, draft({ complexity: "L" }));
        const said: string = fileEpic(root, file).io.all();
        expect(said).toContain("Issue:  #7");
        expect(said).toContain("Title:  Demo Epic");
        expect(said).toContain("Label:  epic");
        expect(said).toContain("Design: needs a decision record (needs-design)");
        expect(said).toContain("URL:    https://github.com/acme/repo/issues/7");
    });

    it("names the declared complexity that exempted an epic needing no record", () => {
        const root: string = checkoutWith({ classification: "labels", project: "none" });
        const file: string = writeDraft(root, draft({ complexity: "XS" }));
        expect(fileEpic(root, file).io.all()).toContain("Design: no record needed (XS epic)");
    });

    it("says an unplanned epic was promoted rather than that an issue was created", () => {
        const root: string = checkoutWith({ classification: "labels", project: "none" });
        const file: string = writeDraft(root, draft());
        const fake = fakeEnvironment({
            answer: (args: string[]) =>
                args[0] === "issue" && args[1] === "view" && args.includes("number,title,labels")
                    ? { status: 0, stdout: JSON.stringify({ number: 42, labels: [{ name: "backlog" }] }), stderr: "" }
                    : undefined,
        });
        const io = recordingIo(root);
        expect(runCreateEpic([file, "--promote", "42"], io, fake.env)).toBe(0);
        expect(io.all()).toContain("Unplanned Epic Promoted");
        expect(io.all()).not.toContain("GitHub Issue Created");
    });

    it("emits colour only when a terminal is attached", () => {
        const root: string = checkoutWith({ classification: "labels", project: "none" });
        const file: string = writeDraft(root, draft());
        expect(fileEpic(root, file).io.all()).not.toContain(GREEN);

        const coloured = recordingIo(root);
        runCreateEpic([writeDraft(root, draft(), "other.md")], coloured, fakeEnvironment({ interactive: true }).env);
        expect(coloured.all()).toContain(GREEN);
    });

    it("emits no colour into a redirected stream, whatever is attached to input", () => {
        const root: string = checkoutWith({ classification: "labels", project: "none" });
        const io = recordingIo(root);
        const env = fakeEnvironment({ interactive: true, stdoutIsTerminal: false, stderrIsTerminal: false }).env;
        runCreateEpic([writeDraft(root, draft())], io, env);
        expect(io.all()).not.toContain(GREEN);
    });

    it("keeps colour on the stream that is still a terminal when the other is redirected", () => {
        const root: string = checkoutWith({ classification: "labels", project: "none" });
        const io = recordingIo(root);
        const env = fakeEnvironment({ stdoutIsTerminal: false, stderrIsTerminal: true }).env;
        // No epic title: the run refuses on stderr and reports nothing on stdout.
        runCreateEpic([writeDraft(root, "---\nfeature: \"Demo\"\n---\n\n# Epic\n")], io, env);
        expect(io.err.join("\n")).toContain(RED);
        expect(io.out.join("\n")).not.toContain(YELLOW);
    });
});
