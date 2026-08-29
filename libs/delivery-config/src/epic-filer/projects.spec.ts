/**
 * Story #384 — the issue reaches its project, and a repository with no board is not nagged.
 *
 * The lookups are the story filer's, reused; what is asserted here is the wiring: which target
 * wins, which calls each mode makes, and that no project failure ever fails the run.
 */

import { describe, expect, it } from "vitest";
import { FAIL, OK, checkoutWith, draft, fakeEnvironment, recordingIo, writeDraft } from "./fixtures";
import { runCreateEpic } from "./run";

const PROJECT = JSON.stringify({ data: { organization: { projectV2: { id: "PVT_1", title: "Delivery" } } } });
const BY_TITLE = JSON.stringify({ data: { organization: { projectsV2: { nodes: [{ id: "PVT_2", title: "Roadmap" }] } } } });
const DISCOVERED = JSON.stringify({
    data: { repository: { projectsV2: { nodes: [{ id: "PVT_3", number: 9, title: "Repo Board" }] } } },
});

function file(github: Record<string, string>, argv: string[] = [], graphql: (args: string[]) => string | undefined = () => undefined) {
    const root: string = checkoutWith(github);
    const path: string = writeDraft(root, draft());
    const fake = fakeEnvironment({
        answer: (args: string[]) => {
            if (args[0] !== "api" || args[1] !== "graphql") return undefined;
            const answer: string | undefined = graphql(args);
            return answer === undefined ? undefined : OK(answer);
        },
    });
    const io = recordingIo(root);
    const code: number = runCreateEpic([path, ...argv], io, fake.env);
    return { code, io, calls: fake.calls.map((call) => call.join(" ")) };
}

const graphqlCalls = (calls: string[]): string[] => calls.filter((call) => call.startsWith("api graphql"));

describe("which project target wins", () => {
    it("uses the flag, and it outranks the configured target", () => {
        const run = file({ classification: "labels", project: "acme/2" }, ["--project", "acme/1"], (args) =>
            args.join(" ").includes("number=1") ? PROJECT : undefined,
        );
        expect(run.io.all()).toContain("Looking up project: acme/1");
        expect(run.io.all()).toContain("Found project: Delivery");
        expect(run.io.all()).toContain("Added to project");
    });

    it("warns without failing the run when the flag's target does not resolve", () => {
        const run = file({ classification: "labels", project: "none" }, ["--project", "acme/404"]);
        expect(run.code).toBe(0);
        expect(run.io.all()).toContain("not found, issue will not be added to a project");
    });

    it("resolves a title, a bare number and an owner-qualified number alike", () => {
        expect(file({ classification: "labels", project: "Roadmap" }, [], () => BY_TITLE).io.all()).toContain(
            "Found project: Roadmap",
        );
        const bare = file({ classification: "labels", project: "1" }, [], (args) =>
            args.join(" ").includes("number=1") ? PROJECT : undefined,
        );
        expect(bare.io.all()).toContain("Found project: Delivery");
        // A bare number takes its owner from the current repository.
        expect(bare.calls.some((call) => call.startsWith("repo view"))).toBe(true);
    });

    it("probes the repository once on the auto path and warns when it finds nothing", () => {
        const run = file({ classification: "labels" });
        expect(run.code).toBe(0);
        expect(run.io.all()).toContain("Looking for repository project...");
        expect(run.io.all()).toContain("No project found for repository");
    });

    it("adds the issue to the project auto-discovery found", () => {
        const run = file({ classification: "labels" }, [], (args) =>
            args.join(" ").includes("repository(") ? DISCOVERED : undefined,
        );
        expect(run.io.all()).toContain("Found project: Repo Board");
        expect(run.io.all()).toContain("Added to project");
    });
});

describe("a deliberate absence stays silent", () => {
    it("makes no lookup, no discovery and no project call for a declared none", () => {
        const run = file({ classification: "labels", project: "none" });
        expect(graphqlCalls(run.calls)).toEqual([]);
        expect(run.io.all()).not.toContain("project");
    });

    it("resolves no project at all under --no-project", () => {
        const run = file({ classification: "labels", project: "acme/1" }, ["--no-project"]);
        expect(graphqlCalls(run.calls)).toEqual([]);
        expect(run.io.all()).not.toContain("Looking up project");
    });
});

describe("board membership is decoration", () => {
    it("warns and does not fail the run when adding the issue to its project fails", () => {
        const root: string = checkoutWith({ classification: "labels", project: "acme/1" });
        const path: string = writeDraft(root, draft());
        const fake = fakeEnvironment({
            answer: (args: string[]) => {
                if (args[0] !== "api" || args[1] !== "graphql") return undefined;
                if (args.join(" ").includes("addProjectV2ItemById")) return FAIL("nope");
                return OK(PROJECT);
            },
        });
        const io = recordingIo(root);
        expect(runCreateEpic([path], io, fake.env)).toBe(0);
        expect(io.all()).toContain("Failed to add issue to project");
    });
});
