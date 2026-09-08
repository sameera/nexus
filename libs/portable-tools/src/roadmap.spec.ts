import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { serializeEpic } from "@nexus/epic-resolve/serialize";
import { type ResolveEpicResult, type ResolvedEpic } from "@nexus/epic-resolve/resolve";
import {
    ROADMAP_EPIC_CAP,
    readRoadmap,
    resolveRoadmap,
    roadmapPath,
    writeRoadmap,
    type Roadmap,
    type RoadmapResult,
} from "./roadmap.js";

interface StorySeed {
    number: number;
    title: string;
    body: string;
    blockedBy?: number[];
}

/** One epic as the shared resolver reports it: the structured resolution, not the rendered document. */
function resolvedEpic(epic: number, title: string, stories: StorySeed[]): ResolvedEpic {
    return {
        number: epic,
        title,
        stories: stories.map((s) => ({ number: s.number, title: s.title, body: s.body })),
        blockedBy: new Map(stories.map((s) => [s.number, s.blockedBy ?? []])),
    };
}

function resolverOver(epics: Record<number, ResolvedEpic>): (epic: number) => ResolveEpicResult {
    return (epic: number): ResolveEpicResult => {
        const resolved: ResolvedEpic | undefined = epics[epic];
        if (resolved === undefined) {
            return { ok: false, error: { problem: "epic-not-found", message: `#${epic} could not be read` } };
        }
        // The markdown the resolver also returns is rendered here by the real serializer, so a test
        // that reached for it would get the genuine document — and still find no acceptance criteria
        // in it. Nothing in this module may read it.
        return {
            ok: true,
            record: null,
            resolved,
            markdown: serializeEpic({
                epic: { number: epic, title: resolved.title, body: "## Description\n\nAn epic.\n" },
                stories: resolved.stories,
                blockedBy: resolved.blockedBy,
            }),
        };
    };
}

const ALPHA: ResolvedEpic = resolvedEpic(100, "Alpha", [
    { number: 11, title: "First", body: "Do the first thing.", blockedBy: [] },
    { number: 12, title: "Second", body: "Do the second thing.\n\n## Acceptance Criteria\n\n- [ ] It is done.", blockedBy: [11] },
]);
const BETA: ResolvedEpic = resolvedEpic(200, "Beta", [
    { number: 21, title: "Third", body: "Do the third thing.", blockedBy: [12] },
    { number: 22, title: "Fourth", body: "Do the fourth thing.", blockedBy: [] },
]);

function ok(result: RoadmapResult): Roadmap {
    if (!result.ok) throw new Error(`expected a roadmap, got ${result.error.problem}: ${result.error.message}`);
    return result.roadmap;
}

describe("what the roadmap takes from the shared resolver", () => {
    it("takes every story's title, body and dependency edges", () => {
        const roadmap: Roadmap = ok(resolveRoadmap(resolverOver({ 100: ALPHA }), [100]));
        expect(roadmap.stories.map((s) => s.number)).toEqual([11, 12]);
        expect(roadmap.stories[0].title).toBe("First");
        expect(roadmap.stories[1].blockedBy).toEqual([11]);
        expect(roadmap.stories[0].blockedBy).toEqual([]);
    });

    it("keeps a story body whole, including the sub-headings a rendered epic.md cannot give back", () => {
        const roadmap: Roadmap = ok(resolveRoadmap(resolverOver({ 100: ALPHA }), [100]));
        expect(roadmap.stories[1].body).toBe(ALPHA.stories[1].body);
        expect(roadmap.stories[1].body).toContain("## Acceptance Criteria");
    });
});

describe("a roadmap resolved from one epic issue", () => {
    it("holds that epic's stories in an order the dependencies allow", () => {
        const roadmap: Roadmap = ok(resolveRoadmap(resolverOver({ 100: ALPHA }), [100]));
        expect(roadmap.stories.map((s) => s.number)).toEqual([11, 12]);
    });

    it("defaults its name from the epic", () => {
        expect(ok(resolveRoadmap(resolverOver({ 100: ALPHA }), [100])).name).toBe("alpha");
    });

    it("carries each story's body and each dependency edge, so no later phase reads the issue graph", () => {
        const roadmap: Roadmap = ok(resolveRoadmap(resolverOver({ 100: ALPHA }), [100]));
        const second = roadmap.stories.find((s) => s.number === 12);
        expect(second?.body).toContain("Do the second thing.");
        expect(second?.blockedBy).toEqual([11]);
        expect(second?.epic).toBe(100);
    });
});

describe("a roadmap resolved from several epics", () => {
    it("orders the stories of every epic together rather than epic by epic", () => {
        const roadmap: Roadmap = ok(resolveRoadmap(resolverOver({ 100: ALPHA, 200: BETA }), [100, 200]));
        expect(roadmap.stories.map((s) => s.number)).toEqual([11, 12, 21, 22]);
        expect(roadmap.epics).toEqual([100, 200]);
    });

    it("breaks ties by ascending issue number, so the same graph resolves to the same order", () => {
        const first = ok(resolveRoadmap(resolverOver({ 100: ALPHA, 200: BETA }), [100, 200]));
        const again = ok(resolveRoadmap(resolverOver({ 100: ALPHA, 200: BETA }), [200, 100]));
        expect(again.stories.map((s) => s.number)).toEqual(first.stories.map((s) => s.number));
    });
});

describe("edges onto work that is not on the roadmap", () => {
    const WITH_OUTSIDE: ResolvedEpic = resolvedEpic(300, "Gamma", [
        { number: 31, title: "Needs elsewhere", body: "Depends on work nobody here builds.", blockedBy: [999] },
    ]);

    it("keeps the edge, marks it external, and does not let it constrain the order", () => {
        const roadmap: Roadmap = ok(resolveRoadmap(resolverOver({ 300: WITH_OUTSIDE }), [300]));
        expect(roadmap.stories.map((s) => s.number)).toEqual([31]);
        expect(roadmap.stories[0].external).toEqual([999]);
        expect(roadmap.stories[0].blockedBy).toEqual([]);
    });
});

describe("a resolution that cannot produce a roadmap", () => {
    it("fails by name when an epic cannot be resolved, and produces no roadmap", () => {
        const result: RoadmapResult = resolveRoadmap(resolverOver({ 100: ALPHA }), [100, 404]);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.problem).toBe("epic-not-found");
    });

    it("fails by name on a dependency cycle and names the stories in it", () => {
        const cyclic: ResolvedEpic = resolvedEpic(400, "Delta", [
            { number: 41, title: "One", body: "b", blockedBy: [42] },
            { number: 42, title: "Two", body: "b", blockedBy: [41] },
        ]);
        const result: RoadmapResult = resolveRoadmap(resolverOver({ 400: cyclic }), [400]);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.problem).toBe("roadmap-cycle");
            expect(result.error.message).toContain("#41");
            expect(result.error.message).toContain("#42");
        }
    });

    it("refuses more epics than the cap before it fetches anything", () => {
        let fetched = 0;
        const counting = (epic: number): ResolveEpicResult => {
            fetched++;
            return resolverOver({ 100: ALPHA })(epic);
        };
        const tooMany: number[] = Array.from({ length: ROADMAP_EPIC_CAP + 1 }, (_, i) => 100 + i);
        const result: RoadmapResult = resolveRoadmap(counting, tooMany);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.problem).toBe("roadmap-too-many-epics");
            expect(result.error.message).toContain(String(ROADMAP_EPIC_CAP + 1));
        }
        expect(fetched).toBe(0);
    });

    it("refuses an empty epic set rather than resolving a roadmap that teaches nothing", () => {
        const result: RoadmapResult = resolveRoadmap(resolverOver({}), []);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.problem).toBe("roadmap-empty");
    });
});

describe("the roadmap on disk", () => {
    function tmpRepo(): string {
        return fs.mkdtempSync(path.join(os.tmpdir(), "roadmap-"));
    }

    it("writes under the gitignored derived-artifact location, never into the workbook", () => {
        const root: string = tmpRepo();
        const roadmap: Roadmap = ok(resolveRoadmap(resolverOver({ 100: ALPHA }), [100]));
        const written: string = writeRoadmap(root, roadmap);
        expect(written).toBe(roadmapPath(root, roadmap.name));
        expect(path.relative(root, written).split(path.sep).slice(0, 2)).toEqual([".nexus", "tmp"]);
    });

    it("regenerates byte-identically from an unchanged issue graph", () => {
        const root: string = tmpRepo();
        const first: string = fs.readFileSync(writeRoadmap(root, ok(resolveRoadmap(resolverOver({ 100: ALPHA }), [100]))), "utf8");
        const again: string = fs.readFileSync(writeRoadmap(root, ok(resolveRoadmap(resolverOver({ 100: ALPHA }), [100]))), "utf8");
        expect(again).toBe(first);
    });

    it("reads back what it wrote, so a later phase needs no second fetch", () => {
        const root: string = tmpRepo();
        const roadmap: Roadmap = ok(resolveRoadmap(resolverOver({ 100: ALPHA, 200: BETA }), [100, 200]));
        writeRoadmap(root, roadmap);
        expect(readRoadmap(root, roadmap.name)).toEqual(roadmap);
    });

    it("reads back null when no roadmap of that name has been resolved", () => {
        expect(readRoadmap(tmpRepo(), "nothing-here")).toBeNull();
    });
});
