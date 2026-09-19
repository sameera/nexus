// @vitest-environment jsdom
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { approve, io, planned, teach, type Planned } from "./plan-commit-fixtures.js";
import { type SessionResult } from "./teaching-session.js";
import { runWorkbookCli } from "./workbook-cli.js";
import { readPage, type ReadPage } from "./workbook-page-fixtures.js";
import { PlanError, parsePlan } from "./workbook-plan.js";
import { HOME_PAGE_NAME } from "./workbook-render.js";
import { workbookRoot } from "./workbook-store.js";

function home(p: Planned): ReadPage {
    return readPage(fs.readFileSync(path.join(workbookRoot(p.repo, "alpha"), HOME_PAGE_NAME), "utf8"));
}

/** The home page's line for one slice, found by the words that name it. */
function entry(page: ReadPage, naming: string): string {
    const found: string | undefined = page.listItems.find((item) => item.includes(naming));
    if (found === undefined) throw new Error(`no entry names ${naming}: ${page.listItems.join(" | ")}`);
    return found;
}

function approved(): Planned {
    const p: Planned = planned();
    expect(approve(p).code).toBe(0);
    return p;
}

/** Teach the first slice through to its written lesson. */
function teachFirst(p: Planned): void {
    const briefed: SessionResult = teach(p);
    const slice: string = briefed.outcome.kind === "brief" ? (briefed.outcome.brief.writeTest?.slice as string) : "";
    expect(teach(p, { theory: "Pins.", pinningTests: [{ slice, file: "tests/pin.spec.ts", text: "it('pins', () => {});\n" }] }).outcome.kind).toBe("written");
}

describe("the approved plan renders as a home page showing the dependency graph (story #589)", () => {
    it("shows every slice, in plan order, with the edges between them", () => {
        const p: Planned = approved();

        const page: ReadPage = home(p);

        expect(page.listItems).toHaveLength(5);
        expect(entry(page, "Pin the plan")).not.toMatch(/depends on/i);
        expect(entry(page, "part 1")).toMatch(/depends on.*#11.*issue-graph/i);
        expect(entry(page, "part 2")).toMatch(/depends on.*#12 part 1/i);
        expect(entry(page, "Hand a story off")).toMatch(/depends on.*#12 part 2/i);
        expect(page.links.filter((link) => link.href.startsWith("#")).map((link) => link.label)).toContain("#11");
    });

    it("links a slice with a written lesson to its page, and shows a slice with none as not yet written, with no link", () => {
        const p: Planned = approved();
        expect(entry(home(p), "Pin the plan")).toMatch(/not yet written/);

        teachFirst(p);

        const page: ReadPage = home(p);
        expect(page.links.find((link) => link.label.includes("Pin the plan"))?.href).toBe("./story-11.html");
        expect(entry(page, "Pin the plan")).not.toMatch(/not yet written/);
        expect(entry(page, "part 1")).toMatch(/not yet written/);
        expect(page.links.some((link) => link.label.includes("part 1") && !link.href.startsWith("#"))).toBe(false);
    });

    it("marks a handed-off slice as handed off, and a scaffold as a teaching step rather than a roadmap story", () => {
        const page: ReadPage = home(approved());

        expect(entry(page, "Hand a story off")).toMatch(/handed off/);
        expect(entry(page, "Hand a story off")).not.toMatch(/not yet written/);
        expect(entry(page, "issue-graph")).toMatch(/teaching step/i);
        expect(entry(page, "issue-graph")).not.toMatch(/#\d+ —/);
    });

    it("displays completely with no network, from files beside it", () => {
        const p: Planned = approved();
        const present: Set<string> = new Set(fs.readdirSync(workbookRoot(p.repo, "alpha")));

        const page: ReadPage = home(p);

        expect(page.assets.length).toBeGreaterThan(0);
        for (const url of page.assets) expect(present.has(url.replace(/^\.\//, ""))).toBe(true);
        expect(page.scripts.every((script) => !script.module)).toBe(true);
        expect(fs.readFileSync(path.join(workbookRoot(p.repo, "alpha"), HOME_PAGE_NAME), "utf8")).not.toMatch(/https?:\/\//);
    });

    it("is produced by every render path from the same inputs, and check mode covers it", () => {
        const p: Planned = approved();
        teachFirst(p);
        const checked = io(p.repo);
        expect(runWorkbookCli(["check", "alpha", "--root", p.repo], checked, p.run)).toBe(0);

        fs.rmSync(path.join(workbookRoot(p.repo, "alpha"), HOME_PAGE_NAME));
        const drifted = io(p.repo);
        expect(runWorkbookCli(["check", "alpha", "--root", p.repo], drifted, p.run)).toBe(1);
        expect(drifted.err.join("\n")).toContain(HOME_PAGE_NAME);

        expect(runWorkbookCli(["render", "alpha", "--root", p.repo], io(p.repo), p.run)).toBe(0);
        expect(runWorkbookCli(["check", "alpha", "--root", p.repo], io(p.repo), p.run)).toBe(0);
    });

    it("renders a plan with no written lesson yet, through the render verb as through approval", () => {
        const p: Planned = approved();
        fs.rmSync(path.join(workbookRoot(p.repo, "alpha"), HOME_PAGE_NAME));

        expect(runWorkbookCli(["render", "alpha", "--root", p.repo], io(p.repo), p.run)).toBe(0);

        expect(home(p).listItems).toHaveLength(5);
    });

    it("reserves the home page's name, so no lesson can render over it", () => {
        const plan: string = [
            "repo: acme/widgets",
            "suite: [a]",
            "grading: [b]",
            "slices:",
            "  - scaffold: index",
            "    builds: learner",
            "    lesson: index.md",
            "",
        ].join("\n");

        expect(() => parsePlan(plan)).toThrow(PlanError);
    });
});
