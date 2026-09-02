import { describe, expect, it } from "vitest";
import { compareRegions, type RegionProblem } from "./compare";

describe("compareRegions — the machine-read regions must be byte-identical", () => {
    const body: string = "---\nslug: a\n---\n\nprose\n\n```json\n{ \"a\": 1 }\n```\n\n<!-- nexus:meta n: 1 -->\n\n- [ ] **Given** a, **when** b, **then** c\n";

    it("finds nothing when only the prose differs", () => {
        const after: string = body.replace("prose", "plain prose");
        expect(compareRegions(body, after)).toEqual([]);
    });

    it("finds nothing when the two copies are identical", () => {
        expect(compareRegions(body, body)).toEqual([]);
    });

    it("names the region and the line when frontmatter differs by one byte", () => {
        const problems: RegionProblem[] = compareRegions(body, body.replace("slug: a", "slug: b"));
        expect(problems).toHaveLength(1);
        expect(problems[0].kind).toBe("changed");
        expect(problems[0].region).toBe("frontmatter");
        expect(problems[0].line).toBe(2);
    });

    it("names the region and the line when a fenced block differs by one byte", () => {
        const problems: RegionProblem[] = compareRegions(body, body.replace('"a": 1', '"a": 2'));
        expect(problems).toHaveLength(1);
        expect(problems[0].region).toBe("fenced-block");
        expect(problems[0].line).toBe(8);
    });

    it("names the region and the line when an HTML comment differs by one byte", () => {
        const problems: RegionProblem[] = compareRegions(body, body.replace("n: 1", "n: 2"));
        expect(problems).toHaveLength(1);
        expect(problems[0].region).toBe("html-comment");
        expect(problems[0].line).toBe(11);
    });

    it("names the region and the line when a Given/When/Then line differs by one byte", () => {
        const problems: RegionProblem[] = compareRegions(body, body.replace("**when** b", "**when** d"));
        expect(problems).toHaveLength(1);
        expect(problems[0].region).toBe("criteria-line");
        expect(problems[0].line).toBe(13);
    });

    it("reports a whole region the translated copy added", () => {
        const problems: RegionProblem[] = compareRegions(body, body + "\n<!-- added -->\n");
        expect(problems).toHaveLength(1);
        expect(problems[0].kind).toBe("added");
        expect(problems[0].region).toBe("html-comment");
    });

    it("reports a whole region the translated copy removed", () => {
        const problems: RegionProblem[] = compareRegions(body, body.replace("<!-- nexus:meta n: 1 -->\n\n", ""));
        expect(problems).toHaveLength(1);
        expect(problems[0].kind).toBe("removed");
        expect(problems[0].region).toBe("html-comment");
        expect(problems[0].line).toBe(11);
    });

    it("reports a changed region and an added region from the same pair", () => {
        const after: string = body.replace("slug: a", "slug: b") + "\n<!-- added -->\n";
        const problems: RegionProblem[] = compareRegions(body, after);
        expect(problems.map((problem: RegionProblem) => problem.kind).sort()).toEqual(["added", "changed"]);
    });

    it("reports a region whose length changed but whose first lines match", () => {
        const problems: RegionProblem[] = compareRegions(body, body.replace('{ "a": 1 }\n', '{ "a": 1 }\n{ }\n'));
        expect(problems).toHaveLength(1);
        expect(problems[0].kind).toBe("changed");
        expect(problems[0].region).toBe("fenced-block");
    });

    it("reports a region the translated copy truncated", () => {
        const problems: RegionProblem[] = compareRegions(body, body.replace('{ \"a\": 1 }\n', ""));
        expect(problems).toHaveLength(1);
        expect(problems[0].kind).toBe("changed");
        expect(problems[0].region).toBe("fenced-block");
    });

    it("carries the offending line's text in the detail so the failure is actionable", () => {
        const problems: RegionProblem[] = compareRegions(body, body.replace("slug: a", "slug: b"));
        expect(problems[0].detail).toContain("slug: b");
    });
});
