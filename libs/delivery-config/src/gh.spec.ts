/**
 * The probes and label helpers (story #360). Every case is exercised with canned client results:
 * nothing here contacts GitHub and nothing spawns a process.
 */

import { describe, expect, it } from "vitest";
import { runConfigDetectClassification } from "./config-cli";
import {
    type GhRunner,
    type RunResult,
    defaultGhRunner,
    ensureLabel,
    ensureLabels,
    labelExists,
    lookupIssueTypeId,
    repoHasIssueTypes,
    resolveOwnerRepo,
    setIssueType,
} from "./gh";
import { type ToolkitIo } from "./io";

const OK = (stdout: string): RunResult => ({ status: 0, stdout, stderr: "" });
const FAIL: RunResult = { status: 1, stdout: "", stderr: "boom" };

/** A runner answering by call shape, recording every argument vector it was handed. */
function runnerFor(answer: (args: string[]) => RunResult): { run: GhRunner; calls: string[][] } {
    const calls: string[][] = [];
    return {
        run: (args) => {
            calls.push(args);
            return answer(args);
        },
        calls,
    };
}

function typesPayload(nodes: unknown): string {
    return JSON.stringify({ data: { repository: { issueTypes: nodes } } });
}

function detect(run: GhRunner): { code: number; out: string } {
    const out: string[] = [];
    const io: ToolkitIo = { cwd: "/tmp", stdout: (l) => out.push(l), stderr: () => undefined };
    return { code: runConfigDetectClassification([], io, run), out: out.join("\n") };
}

describe("detect-classification", () => {
    it("prints types and exits 0 for a repository exposing issue types", () => {
        const { run } = runnerFor((args) =>
            args[0] === "repo" ? OK("acme/tracker\n") : OK(typesPayload({ nodes: [{ id: "T_1", name: "Epic" }] })),
        );
        expect(detect(run)).toEqual({ code: 0, out: "types" });
    });

    it("prints labels and exits 0 when the issue-types feature is unavailable", () => {
        const { run } = runnerFor((args) => (args[0] === "repo" ? OK("acme/tracker\n") : OK(typesPayload(null))));
        expect(detect(run)).toEqual({ code: 0, out: "labels" });
    });

    it("prints unavailable and exits 0, rather than raising, when the client is absent", () => {
        const absent: GhRunner = defaultGhRunner(() => {
            throw new Error("spawn gh ENOENT");
        });
        expect(detect(absent)).toEqual({ code: 0, out: "unavailable" });
    });

    it("prints unavailable when the client is present but fails", () => {
        expect(detect(() => FAIL)).toEqual({ code: 0, out: "unavailable" });
    });
});

describe("the issue-type probe", () => {
    it("returns the node id of a named type that exists", () => {
        const { run } = runnerFor((args) =>
            args[0] === "repo" ? OK("acme/tracker\n") : OK(typesPayload({ nodes: [{ id: "T_9", name: "Epic" }] })),
        );
        expect(lookupIssueTypeId("epic", run)).toBe("T_9");
    });

    it("returns no id, and raises nothing, when the type is absent or the query fails", () => {
        const { run } = runnerFor((args) =>
            args[0] === "repo" ? OK("acme/tracker\n") : OK(typesPayload({ nodes: [{ id: "T_9", name: "Bug" }] })),
        );
        expect(lookupIssueTypeId("Epic", run)).toBeNull();
        expect(lookupIssueTypeId("Epic", () => FAIL)).toBeNull();
        const { run: garbled } = runnerFor((args) => (args[0] === "repo" ? OK("acme/tracker\n") : OK("not json")));
        expect(lookupIssueTypeId("Epic", garbled)).toBeNull();
    });

    it("reports the feature as present but empty distinctly from absent", () => {
        const { run: empty } = runnerFor((args) =>
            args[0] === "repo" ? OK("acme/tracker\n") : OK(typesPayload({ nodes: [] })),
        );
        expect(repoHasIssueTypes(empty)).toBe(false);
        expect(repoHasIssueTypes(() => FAIL)).toBeNull();
    });

    it("targets a given owner/repo instead of the current directory's repository", () => {
        const { run, calls } = runnerFor(() => OK(typesPayload({ nodes: [] })));
        repoHasIssueTypes(run, "other/repo");
        expect(calls.some((c) => c[0] === "repo")).toBe(false);
        expect(calls[0].join(" ")).toContain("owner=other");
        expect(calls[0].join(" ")).toContain("repo=repo");
    });

    it("resolves the current repository when no repository argument is given", () => {
        const { run, calls } = runnerFor((args) =>
            args[0] === "repo" ? OK("acme/tracker\n") : OK(typesPayload({ nodes: [] })),
        );
        expect(resolveOwnerRepo(run, null)).toEqual({ owner: "acme", name: "tracker" });
        repoHasIssueTypes(run);
        expect(calls[calls.length - 1].join(" ")).toContain("owner=acme");
    });

    it("reports a failed repository lookup as no answer", () => {
        expect(resolveOwnerRepo(() => FAIL, null)).toBeNull();
        expect(resolveOwnerRepo(() => OK("not-a-slug\n"), null)).toBeNull();
    });
});

describe("setting an issue's type", () => {
    it("reports success or failure as a returned value", () => {
        expect(setIssueType("I_1", "T_1", () => OK("{}"))).toBe(true);
        expect(setIssueType("I_1", "T_1", () => FAIL)).toBe(false);
    });
});

describe("ensuring labels exist", () => {
    it("creates a label that does not exist", () => {
        const { run, calls } = runnerFor(() => OK(""));
        expect(ensureLabel("backlog", run)).toBe(true);
        expect(calls[0]).toContain("--force");
        expect(calls[0]).toContain("backlog");
    });

    it("leaves an existing label unchanged and reports it as present", () => {
        const { run } = runnerFor((args) => (args[0] === "label" && args[1] === "create" ? FAIL : OK("Backlog\nbug\n")));
        expect(labelExists("backlog", run)).toBe(true);
        expect(ensureLabels(["backlog"], run)).toEqual([]);
    });

    it("reports the gap when a label can be neither created nor found", () => {
        expect(ensureLabels(["backlog", "story", "backlog"], () => FAIL)).toEqual(["backlog", "story"]);
        expect(labelExists("backlog", () => FAIL)).toBeNull();
    });
});
