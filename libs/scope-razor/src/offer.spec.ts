import { describe, expect, it } from "vitest";
import { offerList, storyProvenance, type OfferItem, type StoryProvenance } from "./offer.js";

const DRAFT: string = [
    "# Epic: Something",
    "",
    "## Implementation Order",
    "",
    "- **Core** — blocked by: none",
    "- **Reporting** — blocked by: Core",
    "- **Export** — blocked by: Reporting",
    "- **Telemetry** — blocked by: Core",
    "",
    "## Smallest Usable Version",
    "",
    "Core",
    "",
    "## User Stories",
    "",
    '### Story 1: Core `[asked: "a place to record the run"]`',
    "",
    '### Story 2: Reporting `[asked: "and a report at the end of it"]`',
    "",
    '### Story 3: Export `[asked: "and a report at the end of it"]`',
    "",
    "### Story 4: Telemetry `[inferred]`",
    "",
].join("\n");

describe("a story's own provenance", () => {
    it("reads the label off the story heading, with the fragment that justifies it", () => {
        const found: StoryProvenance[] = storyProvenance(DRAFT);
        expect(found[0]).toEqual({ title: "Core", provenance: "asked", fragment: "a place to record the run" });
        expect(found[3]).toEqual({ title: "Telemetry", provenance: "inferred", fragment: undefined });
    });

    it("reads one entry per story, so a story never loses its claim", () => {
        expect(storyProvenance(DRAFT)).toHaveLength(4);
    });
});

describe("the offer list", () => {
    const offered: OfferItem[] = offerList(DRAFT);

    it("holds every story the smallest usable version excludes, and nothing it includes", () => {
        expect(offered.map((item: OfferItem) => item.title)).not.toContain("Core");
        expect(offered.map((item: OfferItem) => item.title).sort()).toEqual(["Export", "Reporting", "Telemetry"]);
    });

    it("sorts the stories the lead asked for ahead of the ones the drafting model added", () => {
        expect(offered.map((item: OfferItem) => item.provenance)).toEqual(["asked", "asked", "inferred"]);
    });

    it("orders each group by what it unlocks, never by a ranking of value", () => {
        expect(offered.map((item: OfferItem) => item.title)).toEqual(["Reporting", "Export", "Telemetry"]);
    });

    it("numbers the entries stably from one, so a typed selection names the same thing twice running", () => {
        expect(offered.map((item: OfferItem) => item.number)).toEqual([1, 2, 3]);
        expect(offerList(DRAFT).map((item: OfferItem) => item.number)).toEqual([1, 2, 3]);
    });

    it("carries each asked story's fragment verbatim, so the reviewer can reject the claim itself", () => {
        expect(offered[0].fragment).toBe("and a report at the end of it");
        expect(offered[2].fragment).toBeUndefined();
    });

    it("names what each offered story waits on, so taking one shows what comes with it", () => {
        expect(offered.find((item: OfferItem) => item.title === "Export")?.blockedBy).toEqual(["Reporting"]);
    });

    it("offers nothing when the smallest usable version needs every story", () => {
        expect(offerList(DRAFT.replace("\nCore\n", "\nCore; Reporting; Export; Telemetry\n"))).toEqual([]);
    });
});
