/**
 * Story #370 — project targeting: explicit, auto-discovered, or none.
 *
 * The `none` case is asserted negatively — no lookup, no probe, no membership call, no warning —
 * because that is the whole value of declaring it.
 */

import { describe, expect, it } from "vitest";
import { type RunResult } from "../gh";
import { OK, FAIL, checkoutWith, fakePlatform, recordingIo, scratch, story, writeItem } from "./fixtures";
import { runCreateStory } from "./run";

const REPO = "acme/tracker";

function projectPayload(scope: string, project: unknown): string {
    return JSON.stringify({ data: { [scope]: { projectV2: project } } });
}

function projectsPayload(scope: string, nodes: unknown[]): string {
    return JSON.stringify({ data: { [scope]: { projectsV2: { nodes } } } });
}

function repositoryPayload(nodes: unknown[]): string {
    return JSON.stringify({ data: { repository: { projectsV2: { nodes } } } });
}

/** A platform minting issue numbers, with `answers` deciding every project query. */
function platform(answers: (args: string[]) => RunResult | undefined = () => undefined) {
    let next = 100;
    return fakePlatform((args: string[]): RunResult | undefined => {
        const answer: RunResult | undefined = answers(args);
        if (answer !== undefined) return answer;
        if (args[0] === "issue" && args[1] === "create") return OK(`https://github.com/${REPO}/issues/${next++}\n`);
        if (args[0] === "issue" && args[1] === "view") return OK("I_node\n");
        if (args[0] === "api" && args[3] === ".id") return OK("9001\n");
        return undefined;
    });
}

function graphqlQueries(calls: string[][]): string[] {
    return calls.filter((args) => args[0] === "api" && args[1] === "graphql").map((args) => args[3]);
}

function repo(github: Record<string, string> = {}): string {
    return checkoutWith({ classification: "labels", "story-repo": REPO, ...github });
}

describe("an explicitly declared project target", () => {
    it("is looked up once for the whole batch", () => {
        const root: string = repo({ project: "acme/4" });
        writeItem(root, "STORY-1.md", story("1"));
        writeItem(root, "STORY-2.md", story("2"));
        const io = recordingIo(root);
        const gh = platform((args) =>
            args[1] === "graphql" && args[3].includes("projectV2(number")
                ? OK(projectPayload("organization", { id: "PVT_1", title: "Delivery Board" }))
                : undefined,
        );
        runCreateStory([scratch(root)], io, gh.env);
        expect(io.out.join("\n")).toContain("Looking up project from config: acme/4");
        expect(graphqlQueries(gh.calls).filter((q) => q.includes("projectV2(number")).length).toBe(1);
    });

    it("warns without failing the run when the declared target does not resolve", () => {
        const root: string = repo({ project: "acme/9" });
        writeItem(root, "STORY-1.md", story("1"));
        const io = recordingIo(root);
        const gh = platform((args) =>
            args[1] === "graphql" && args[3].includes("projectV2(number")
                ? OK(projectPayload("organization", null))
                : undefined,
        );
        expect(runCreateStory([scratch(root)], io, gh.env)).toBe(0);
        expect(io.err.join("\n")).toContain("Project 'acme/9' from config not found");
    });

    it("resolves owner/<number>, a bare <number> taking its owner from the repository, and a title", () => {
        for (const [target, expected] of [
            ["acme/4", { owner: "acme", byNumber: true }],
            ["4", { owner: "acme-from-repo", byNumber: true }],
            ["Delivery Board", { owner: "acme-from-repo", byNumber: false }],
        ] as const) {
            const root: string = repo({ project: target });
            writeItem(root, "STORY-1.md", story("1"));
            const gh = platform((args) => {
                if (args[0] === "repo" && args.includes(".owner.login")) return OK("acme-from-repo\n");
                if (args[1] === "graphql" && args[3].includes("projectV2(number")) {
                    return OK(projectPayload("organization", { id: "PVT_1", title: "Delivery Board" }));
                }
                if (args[1] === "graphql" && args[3].includes("projectsV2(first: 100")) {
                    return OK(projectsPayload("organization", [{ id: "PVT_1", title: "Delivery Board" }]));
                }
                return undefined;
            });
            runCreateStory([scratch(root)], recordingIo(root), gh.env);
            const lookups: string[][] = gh.calls.filter(
                (args) => args[1] === "graphql" && args[3].includes(expected.byNumber ? "projectV2(number" : "projectsV2(first: 100"),
            );
            expect(lookups.length, `target ${target}`).toBeGreaterThan(0);
            expect(lookups[0].join(" ")).toContain(`owner=${expected.owner}`);
        }
    });
});

describe("auto-discovery", () => {
    it("probes the repository once and reports when it finds none", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        writeItem(root, "STORY-2.md", story("2"));
        const io = recordingIo(root);
        const gh = platform((args) => {
            if (args[0] === "repo" && args.includes(".nameWithOwner")) return OK(`${REPO}\n`);
            if (args[1] === "graphql" && args[3].includes("projectsV2(first: 1)")) return OK(repositoryPayload([]));
            return undefined;
        });
        expect(runCreateStory([scratch(root)], io, gh.env)).toBe(0);
        expect(io.out.join("\n")).toContain("Looking for repository project (fallback)...");
        expect(io.out.join("\n")).toContain("No repository project found");
        expect(graphqlQueries(gh.calls).filter((q) => q.includes("projectsV2(first: 1)")).length).toBe(1);
    });

    it("writes the project it discovered back into the settings block", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        const io = recordingIo(root);
        const gh = platform((args) => {
            if (args[0] === "repo" && args.includes(".nameWithOwner")) return OK(`${REPO}\n`);
            if (args[1] === "graphql" && args[3].includes("projectsV2(first: 1)")) {
                return OK(repositoryPayload([{ id: "PVT_1", number: 7, title: "Delivery Board" }]));
            }
            return undefined;
        });
        runCreateStory([scratch(root)], io, gh.env);
        expect(io.out.join("\n")).toContain("Seeded github config");
        expect(io.out.join("\n")).toContain("project");
    });
});

/** Every project query refused, and every other call left to the fake platform's defaults. */
const refusedGraphql = (args: string[]): RunResult | undefined =>
    args[0] === "api" && args[1] === "graphql" ? FAIL("gh: 502") : undefined;

describe("a lookup that failed rather than found nothing", () => {
    it("reports why the owner could not be read for a bare project reference", () => {
        const root: string = repo({ project: "4" });
        writeItem(root, "STORY-1.md", story("1"));
        const io = recordingIo(root);
        const gh = platform((args) =>
            args[0] === "repo" && args.includes(".owner.login") ? FAIL("gh: not authenticated") : undefined,
        );
        expect(runCreateStory([scratch(root)], io, gh.env)).toBe(0);
        expect(io.err.join("\n")).toContain("Error getting repo owner: gh: not authenticated");
    });

    it("reports why the repository could not be named during auto-discovery", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        const io = recordingIo(root);
        const gh = platform((args) =>
            args[0] === "repo" && args.includes(".nameWithOwner") ? FAIL("gh: no such repository") : undefined,
        );
        expect(runCreateStory([scratch(root)], io, gh.env)).toBe(0);
        expect(io.err.join("\n")).toContain("Error fetching repository projects: gh: no such repository");
    });

    it("reports a numbered lookup and a title search the platform refused", () => {
        const byNumber: string = repo({ project: "acme/4" });
        writeItem(byNumber, "STORY-1.md", story("1"));
        const numbered = recordingIo(byNumber);
        expect(runCreateStory([scratch(byNumber)], numbered, platform(refusedGraphql).env)).toBe(0);
        expect(numbered.err.join("\n")).toContain("Error fetching project by number: gh: 502");

        const byTitle: string = repo({ project: "acme/Roadmap" });
        writeItem(byTitle, "STORY-1.md", story("1"));
        const titled = recordingIo(byTitle);
        expect(runCreateStory([scratch(byTitle)], titled, platform(refusedGraphql).env)).toBe(0);
        expect(titled.err.join("\n")).toContain("Error searching for project by title: gh: 502");
    });

    it("reports an answer it could not read", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        const io = recordingIo(root);
        const gh = platform((args) => {
            if (args[0] === "repo" && args.includes(".nameWithOwner")) return OK(`${REPO}\n`);
            return args[0] === "api" && args[1] === "graphql" ? OK("<html>not json</html>") : undefined;
        });
        expect(runCreateStory([scratch(root)], io, gh.env)).toBe(0);
        expect(io.err.join("\n")).toContain("Error parsing project response:");
    });

    it("reports a repository name it cannot split into owner and repo", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        const io = recordingIo(root);
        const gh = platform((args) =>
            args[0] === "repo" && args.includes(".nameWithOwner") ? OK("tracker\n") : undefined,
        );
        expect(runCreateStory([scratch(root)], io, gh.env)).toBe(0);
        expect(io.err.join("\n")).toContain("Unexpected repository name format: tracker");
    });
});

describe("a scope that answered is not asked again", () => {
    /**
     * Asking the user scope about an organization login is a bad question, and the platform refuses
     * it. That refusal is only ever seen when the first scope did not answer — so a lookup that ends
     * "no such project" must not manufacture one on its way there.
     */
    const userScopeRefused =
        (answered: string) =>
        (args: string[]): RunResult | undefined => {
            if (args[0] !== "api" || args[1] !== "graphql") return undefined;
            return args[3].includes("user(login") ? FAIL("gh: Could not resolve to a User") : OK(answered);
        };

    const userScopeQueries = (calls: string[][]): string[] =>
        graphqlQueries(calls).filter((query) => query.includes("user(login"));

    it("leaves the user scope unasked once the organization scope has answered a numbered lookup", () => {
        const root: string = repo({ project: "acme/404" });
        writeItem(root, "STORY-1.md", story("1"));
        const io = recordingIo(root);
        const gh = platform(userScopeRefused(projectPayload("organization", null)));
        expect(runCreateStory([scratch(root)], io, gh.env)).toBe(0);
        expect(userScopeQueries(gh.calls)).toEqual([]);
        expect(io.err.join("\n")).toContain("Warning: Project 'acme/404' from config not found");
        expect(io.err.join("\n")).not.toContain("Error fetching project by number");
    });

    it("leaves the user scope unasked once the organization scope has answered a title search", () => {
        const root: string = repo({ project: "acme/Roadmap" });
        writeItem(root, "STORY-1.md", story("1"));
        const io = recordingIo(root);
        const gh = platform(userScopeRefused(projectsPayload("organization", [])));
        expect(runCreateStory([scratch(root)], io, gh.env)).toBe(0);
        expect(userScopeQueries(gh.calls)).toEqual([]);
        expect(io.err.join("\n")).toContain("Warning: Project 'acme/Roadmap' from config not found");
        expect(io.err.join("\n")).not.toContain("Error searching for project by title");
    });

    it("still asks the user scope when the organization scope could not answer", () => {
        const root: string = repo({ project: "acme/4" });
        writeItem(root, "STORY-1.md", story("1"));
        const io = recordingIo(root);
        const gh = platform((args) => {
            if (args[0] !== "api" || args[1] !== "graphql") return undefined;
            if (args[3].includes("organization(login")) return FAIL("gh: Could not resolve to an Organization");
            return OK(projectPayload("user", { id: "PVT_9", title: "Personal" }));
        });
        expect(runCreateStory([scratch(root)], io, gh.env)).toBe(0);
        expect(userScopeQueries(gh.calls).length).toBeGreaterThan(0);
        expect(io.out.join("\n")).toContain("Found project: Personal");
    });
});

describe("a target declared none", () => {
    it("performs no lookup, no discovery and no project call, and warns about nothing", () => {
        const root: string = repo({ project: "none" });
        writeItem(root, "STORY-1.md", story("1"));
        const io = recordingIo(root);
        const gh = platform();
        expect(runCreateStory([scratch(root)], io, gh.env)).toBe(0);
        expect(graphqlQueries(gh.calls).filter((q) => q.includes("projectV2") || q.includes("projectsV2"))).toEqual([]);
        expect(io.all()).not.toContain("project");
        expect(io.all()).not.toContain("Project");
    });
});

describe("per-issue and per-run overrides", () => {
    it("lets a work item's own project outrank the batch target, for that issue alone", () => {
        const root: string = repo({ project: "acme/4" });
        writeItem(root, "STORY-1.md", story("1", { project: '"acme/9"' }));
        writeItem(root, "STORY-2.md", story("2"));
        const gh = platform((args) => {
            if (args[1] === "graphql" && args[3].includes("projectV2(number")) {
                const number: string = args[args.indexOf("-F") + 1];
                return OK(projectPayload("organization", { id: `PVT_${number.split("=")[1]}`, title: "Board" }));
            }
            return undefined;
        });
        runCreateStory([scratch(root)], recordingIo(root), gh.env);
        const added: string[] = graphqlQueries(gh.calls).filter((q) => q.includes("addProjectV2ItemById"));
        expect(added.length).toBe(2);
        expect(added[0]).toContain("PVT_9");
        expect(added[1]).toContain("PVT_4");
    });

    it("resolves no project and adds no issue to one when --no-project is passed", () => {
        const root: string = repo({ project: "acme/4" });
        writeItem(root, "STORY-1.md", story("1", { project: '"acme/9"' }));
        const gh = platform();
        expect(runCreateStory([scratch(root), "--no-project"], recordingIo(root), gh.env)).toBe(0);
        expect(graphqlQueries(gh.calls).filter((q) => q.includes("ProjectV2"))).toEqual([]);
    });

    it("warns and carries on when an issue that already exists cannot be added to its board", () => {
        const root: string = repo({ project: "acme/4" });
        writeItem(root, "STORY-1.md", story("1"));
        const io = recordingIo(root);
        const gh = platform((args) => {
            if (args[1] === "graphql" && args[3].includes("projectV2(number")) {
                return OK(projectPayload("organization", { id: "PVT_1", title: "Board" }));
            }
            if (args[1] === "graphql" && args[3].includes("addProjectV2ItemById")) return FAIL("no write access");
            return undefined;
        });
        expect(runCreateStory([scratch(root)], io, gh.env)).toBe(0);
        expect(io.err.join("\n")).toContain("Failed to add issue to project");
        expect(io.out.join("\n")).toContain("Created issue");
    });
});
