/**
 * The razor's authoring contract (epic #284).
 *
 * The razor is a rule set with one normative home, loaded by three drafting stages and enforced by
 * one checker. Nothing about that arrangement is visible in a type: the skill is markdown, the
 * stages are markdown, and the tokens they agree on are strings the checker parses. So the parts
 * that must agree are asserted here — the label vocabulary, the name of the materialized source
 * artifact, and which stages load the skill — because a divergence between them is exactly the
 * failure the single normative home exists to prevent.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");
const AUTHORED: string = path.join(REPO_ROOT, "components");

function read(rel: string): string {
    return fs.readFileSync(path.join(AUTHORED, rel), "utf8");
}

const RAZOR = "skills/nxs-razor/SKILL.md";

describe("the razor skill", () => {
    it("is a loadable component with the name the stages address it by", () => {
        const body: string = read(RAZOR);
        expect(body.startsWith("---\n")).toBe(true);
        expect(body).toMatch(/^name: nxs-razor$/m);
    });

    it("states the two-valued label vocabulary and both of its inline tokens", () => {
        const body: string = read(RAZOR);
        expect(body).toContain("[asked:");
        expect(body).toContain("[inferred]");
        expect(body).toMatch(/two-valued/);
    });

    it("names the materialized source artifact and forbids checking against a live source", () => {
        const body: string = read(RAZOR);
        expect(body).toContain("source.md");
        expect(body).toMatch(/that file and nothing else/);
    });

    it("states the citation comparison as normalized containment with a word floor", () => {
        const body: string = read(RAZOR);
        expect(body).toMatch(/normalized substring containment/i);
        expect(body).toMatch(/four words/);
    });

    it("states that no drafting-time token reaches a filed body", () => {
        const body: string = read(RAZOR);
        expect(body).toMatch(/assertion mode/);
    });
});

describe("the epic drafting stage", () => {
    it("loads the razor rather than restating it", () => {
        expect(read("commands/nxs.epic.md")).toContain("nxs-razor");
    });

    it("materializes the run's source text beside the draft", () => {
        expect(read("commands/nxs.epic.md")).toContain("${DRAFT_DIR}/source.md");
    });

    it("files from a derived body whose cleanliness is asserted, not remembered", () => {
        const body: string = read("commands/nxs.epic.md");
        expect(body).toContain("razor-check");
        expect(body).toMatch(/--assert-clean/);
    });
});
