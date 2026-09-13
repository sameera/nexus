import { describe, expect, it } from "vitest";
import { orderedByUnlock, parseOrdering, storyTitles, unmetBlockers, type OrderingEntry } from "./ordering.js";

const DRAFT: string = [
    "# Epic: Something",
    "",
    "## Implementation Order",
    "",
    "- **Sequence the stories** — blocked by: none",
    "- **Check the smallest usable version** — blocked by: Sequence the stories",
    "- **Offer additions** — blocked by: Check the smallest usable version; Sequence the stories",
    "",
    "## User Stories",
    "",
    "### Story 1: Sequence the stories",
    "",
    "### Story 2: Check the smallest usable version",
    "",
    "### Story 3: Offer additions",
    "",
].join("\n");

describe("the story titles a draft names", () => {
    it("reads one title per story heading", () => {
        expect(storyTitles(DRAFT)).toEqual(["Sequence the stories", "Check the smallest usable version", "Offer additions"]);
    });

    it("reads a heading that names the story by issue number, as a materialized epic does", () => {
        expect(storyTitles("### Story #577: Sequence the stories")).toEqual(["Sequence the stories"]);
    });

    it("drops a provenance label from the title, so the label never becomes part of the name", () => {
        expect(storyTitles('### Story 1: Sequence the stories `[asked: "sequence the stories first"]`')).toEqual(["Sequence the stories"]);
    });

    it("finds no story in a draft that has none", () => {
        expect(storyTitles("# Decision Record\n\n## Key Decisions\n")).toEqual([]);
    });
});

describe("the draft-level ordering block", () => {
    it("reads each story's blockers by title", () => {
        expect(parseOrdering(DRAFT)).toEqual([
            { title: "Sequence the stories", blockedBy: [] },
            { title: "Check the smallest usable version", blockedBy: ["Sequence the stories"] },
            { title: "Offer additions", blockedBy: ["Check the smallest usable version", "Sequence the stories"] },
        ]);
    });

    it("reads nothing from a draft that carries no block", () => {
        expect(parseOrdering("# Epic: Something\n\n### Story 1: Alone\n")).toEqual([]);
    });

    it("stops at the next section, so a later list is not read as ordering", () => {
        const draft: string = ["## Implementation Order", "- **One** — blocked by: none", "", "## Assumptions", "- **Two** — blocked by: none", ""].join("\n");
        expect(parseOrdering(draft).map((e: OrderingEntry) => e.title)).toEqual(["One"]);
    });
});

describe("the order a set of stories unlocks in", () => {
    it("puts a story after everything it waits on", () => {
        expect(orderedByUnlock(parseOrdering(DRAFT))).toEqual(["Sequence the stories", "Check the smallest usable version", "Offer additions"]);
    });

    it("keeps the written order between two stories neither of which waits on the other", () => {
        const entries: OrderingEntry[] = [
            { title: "Late", blockedBy: ["Early"] },
            { title: "Early", blockedBy: [] },
            { title: "Also early", blockedBy: [] },
        ];
        expect(orderedByUnlock(entries)).toEqual(["Early", "Also early", "Late"]);
    });

    it("still names every story when the blockers form a cycle, rather than dropping one", () => {
        const entries: OrderingEntry[] = [
            { title: "A", blockedBy: ["B"] },
            { title: "B", blockedBy: ["A"] },
        ];
        expect(orderedByUnlock(entries).sort()).toEqual(["A", "B"]);
    });
});

describe("what a chosen set of stories still waits on", () => {
    const entries: OrderingEntry[] = parseOrdering(DRAFT);

    it("names both stories when a chosen one waits on an excluded one", () => {
        expect(unmetBlockers(entries, ["Offer additions"])).toEqual([
            { story: "Offer additions", blocker: "Check the smallest usable version" },
            { story: "Offer additions", blocker: "Sequence the stories" },
        ]);
    });

    it("finds nothing when the chosen set needs nothing outside itself", () => {
        expect(unmetBlockers(entries, ["Sequence the stories", "Check the smallest usable version"])).toEqual([]);
    });

    it("matches titles the way a citation is matched, so case and spacing do not break closure", () => {
        expect(unmetBlockers(entries, ["sequence  the STORIES", "Check the smallest usable version"])).toEqual([]);
    });
});
