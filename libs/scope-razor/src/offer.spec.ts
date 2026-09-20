import { describe, expect, it } from "vitest";
import { checklist, type ChecklistItem } from "./offer.js";

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
    "- **size:** M",
    "",
    "#### Acceptance Criteria",
    "",
    '- [ ] **Given** a run, **when** it ends, **then** it is recorded `[asked: "a place to record the run"]`',
    "- [ ] **Given** a failed write, **when** it retries, **then** it succeeds `[inferred]`",
    "",
    '### Story 2: Reporting `[asked: "and a report at the end of it"]`',
    "",
    "- **size:** S",
    "",
    "#### Acceptance Criteria",
    "",
    "- [ ] **Given** a run, **when** it ends, **then** a report exists `[inferred]`",
    "",
    '### Story 3: Export `[asked: "and a report at the end of it"]`',
    "",
    "- **size:** S",
    "",
    "### Story 4: Telemetry `[inferred]`",
    "",
    "- **size:** M",
    "",
    "## Assumptions",
    "",
    '- The feed stays CSV `[asked: "the vendor sends us CSV"]`',
    "- Runs are single-tenant `[inferred]`",
    "",
    "## Out of Scope",
    "",
    "- Historical backfill `[inferred]`",
    "",
].join("\n");

const items: ChecklistItem[] = checklist(DRAFT);
const story = (title: string): ChecklistItem => {
    const found: ChecklistItem | undefined = items.find((item: ChecklistItem) => item.kind === "story" && item.text === title);
    if (found === undefined) throw new Error(`the checklist lists no story called ${title}`);
    return found;
};
const titles = (kind: ChecklistItem["kind"]): string[] => items.filter((item: ChecklistItem) => item.kind === kind).map((item: ChecklistItem) => item.text);

describe("what the checklist arrives ticked with", () => {
    it("ticks the stories the smallest usable version needs, and no others", () => {
        expect(story("Core").filed).toBe(true);
        expect(story("Reporting").filed).toBe(false);
        expect(story("Export").filed).toBe(false);
        expect(story("Telemetry").filed).toBe(false);
    });

    it("ticks every boundary, whatever its provenance, because neither kind adds scope", () => {
        const boundaries: ChecklistItem[] = items.filter((item: ChecklistItem) => item.kind === "assumption" || item.kind === "out-of-scope");
        expect(boundaries.map((item: ChecklistItem) => item.text)).toEqual(["The feed stays CSV", "Runs are single-tenant", "Historical backfill"]);
        expect(boundaries.every((item: ChecklistItem) => item.filed)).toBe(true);
    });

    it("ticks the model-added criteria on a story the default files", () => {
        const criteria: ChecklistItem[] = items.filter((item: ChecklistItem) => item.kind === "criterion");
        expect(criteria.map((item: ChecklistItem) => item.parent)).toEqual(["Core"]);
        expect(criteria[0].text).toBe("**Given** a failed write, **when** it retries, **then** it succeeds");
        expect(criteria[0].filed).toBe(true);
    });

    it("lists no criterion the lead asked for, because it is the story's own definition", () => {
        expect(titles("criterion")).not.toContain("**Given** a run, **when** it ends, **then** it is recorded");
    });

    it("lists no criterion of a story the default does not file, since it has nothing to be ticked against", () => {
        expect(titles("criterion")).not.toContain("**Given** a run, **when** it ends, **then** a report exists");
    });
});

describe("the order the reviewer reads the default off", () => {
    it("puts the smallest usable version first, then asked-for stories, then model-added ones", () => {
        expect(titles("story")).toEqual(["Core", "Reporting", "Export", "Telemetry"]);
    });

    it("orders each band by what it unlocks, never by a ranking of value", () => {
        const graphFirst: string = DRAFT.replace("### Story 3: Export", "### Story 0: Export").replace("### Story 2: Reporting", "### Story 3: Reporting").replace("### Story 0: Export", "### Story 2: Export");
        const reordered: string[] = checklist(graphFirst)
            .filter((item: ChecklistItem) => item.kind === "story")
            .map((item: ChecklistItem) => item.text);
        expect(reordered).toEqual(["Core", "Reporting", "Export", "Telemetry"]);
    });

    it("numbers every line stably from one, so a typed selection names the same thing twice running", () => {
        expect(items.map((item: ChecklistItem) => item.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
        expect(checklist(DRAFT).map((item: ChecklistItem) => item.number)).toEqual(items.map((item: ChecklistItem) => item.number));
    });
});

describe("what each line claims", () => {
    it("carries each asked item's fragment verbatim, so the reviewer can reject the claim itself", () => {
        expect(story("Reporting").fragment).toBe("and a report at the end of it");
        expect(story("Telemetry").fragment).toBeUndefined();
        expect(items.find((item: ChecklistItem) => item.text === "The feed stays CSV")?.fragment).toBe("the vendor sends us CSV");
    });

    it("names what each story waits on, so taking one shows what comes with it", () => {
        expect(story("Export").blockedBy).toEqual(["Reporting"]);
        expect(story("Core").blockedBy).toEqual([]);
    });

    it("carries each story's declared size", () => {
        expect(story("Core").size).toBe("M");
        expect(story("Export").size).toBe("S");
    });

    it("reads an unlabelled story as model-added, the reading that never files on the lead's authority", () => {
        const unlabelled: ChecklistItem[] = checklist(DRAFT.replace("### Story 4: Telemetry `[inferred]`", "### Story 4: Telemetry"));
        expect(unlabelled.find((item: ChecklistItem) => item.text === "Telemetry")?.provenance).toBe("inferred");
    });
});

describe("a draft whose smallest usable version needs every story", () => {
    const whole: ChecklistItem[] = checklist(DRAFT.replace("\nCore\n", "\nCore; Reporting; Export; Telemetry\n"));

    it("still lists every story, now all ticked, so the reviewer reads the same one list", () => {
        expect(whole.filter((item: ChecklistItem) => item.kind === "story").every((item: ChecklistItem) => item.filed)).toBe(true);
    });
});
