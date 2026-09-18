// @vitest-environment jsdom
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type RunResult, type Runner, defaultRunner } from "@nexus/workspace/run";
import { type AuthoredProse, type LessonBrief } from "./lesson-writer";
import { type LiveStory } from "./teaching-plan";
import { runTeachingSession, type SessionResult } from "./teaching-session";
import { printPage, readPage } from "./workbook-page-fixtures";
import { PLAN_FILENAME } from "./workbook-plan";
import {
    LessonRenderError,
    renderStylesheet,
    renderWorkbook,
    renderWorkbookInto,
    type LessonSource,
    type RenderedFile,
} from "./workbook-render";
import { createWorkbook, planRenderOptions, readWorkbookPlan, workbookRoot } from "./workbook-store";

let tmpDirs: string[] = [];
function makeDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reference-pages-"));
    tmpDirs.push(dir);
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
    tmpDirs = [];
});

// ---------------------------------------------------------------------------------------------
// A teaching session over five learner-built slices, so a concept can come round to a second drill.
// ---------------------------------------------------------------------------------------------

const SUITE: string[] = ["fake-suite", "--all"];

const SLICES: { story: number; lesson: string; test: string; concepts: string[] }[] = [
    { story: 501, lesson: "01-drift.md", test: "tests/one.spec.ts", concepts: ["pinned state", "drift"] },
    { story: 502, lesson: "02-widget.md", test: "tests/two.spec.ts", concepts: ["predict then reveal"] },
    { story: 503, lesson: "03-drill.md", test: "tests/three.spec.ts", concepts: ["cold retrieval"] },
    { story: 504, lesson: "04-probe.md", test: "tests/four.spec.ts", concepts: ["the probe"] },
    { story: 505, lesson: "05-reference.md", test: "tests/five.spec.ts", concepts: ["reference pages"] },
    { story: 506, lesson: "06-glossary.md", test: "tests/six.spec.ts", concepts: ["glossary"] },
];

function makeRepo(): string {
    const dir = makeDir();
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
    fs.writeFileSync(path.join(dir, ".gitignore"), "");
    createWorkbook(dir, "rdl");
    const lines: string[] = ["repo: nexus", "epic: 481", `suite: ${JSON.stringify(SUITE)}`, 'grading: ["fake-grade"]', "slices:"];
    for (const slice of SLICES) {
        lines.push(
            `  - story: ${slice.story}`,
            `    lesson: ${slice.lesson}`,
            "    builds: learner",
            `    branch: feat/${slice.story}-slice`,
            `    concepts: [${slice.concepts.join(", ")}]`,
            "    pinning_test:",
            `      file: ${slice.test}`,
            "      text: |",
            `        it("pins #${slice.story}", () => {});`,
            "    pinned:",
            `      title: Story ${slice.story} teaches something`,
            `      body: As a learner, I want slice ${slice.story}.`,
        );
    }
    fs.writeFileSync(path.join(workbookRoot(dir, "rdl"), PLAN_FILENAME), lines.join("\n") + "\n");
    return dir;
}

const runner: Runner = (cmd, args, opts): RunResult =>
    cmd === SUITE[0] ? { status: 0, stdout: "", stderr: "" } : defaultRunner(cmd, args, opts);

const LIVE: Record<number, LiveStory> = Object.fromEntries(
    SLICES.map((slice) => [slice.story, { title: `Story ${slice.story} teaches something`, body: `As a learner, I want slice ${slice.story}.`, closed: false }]),
);

const REFERENCE_PROSE: string = "Drift is the gap between the state a story was pinned to and the state it is in now.";

function teach(repo: string, prose?: AuthoredProse): SessionResult {
    return runTeachingSession({ repoRoot: repo, slug: "rdl", read: (story) => LIVE[story] ?? null, prose, run: runner, now: () => "2026-09-18T00:00:00.000Z" });
}

/** The prose an agent writes back for a brief: the drill, every revisit, and the reference page when asked. */
function proseFor(brief: LessonBrief, withReference: boolean): AuthoredProse {
    return {
        theory: "The theory half.",
        ...(brief.drill === null ? {} : { drill: { question: `What is ${brief.drill}?`, answer: `${brief.drill}, answered.` } }),
        ...(brief.revisit.length === 0
            ? {}
            : { revisit: brief.revisit.map((concept) => ({ concept, question: `Again, ${concept}?`, answer: `${concept} again.` })) }),
        ...(withReference ? { reference: REFERENCE_PROSE } : {}),
    };
}

function briefOf(result: SessionResult): LessonBrief {
    if (result.outcome.kind !== "brief") throw new Error(`expected a brief, got ${result.outcome.kind}: ${result.outcome.report}`);
    return result.outcome.brief;
}

/** Brief, write and finish one lesson. Returns the brief it was written from and the written outcome. */
function teachOne(repo: string, withReference = false): { brief: LessonBrief; written: SessionResult } {
    const brief: LessonBrief = briefOf(teach(repo));
    const written: SessionResult = teach(repo, proseFor(brief, withReference));
    if (written.outcome.kind !== "written") throw new Error(`expected a written lesson, got ${written.outcome.kind}: ${written.outcome.report}`);
    const slice = SLICES.find((s) => s.lesson === brief.lesson);
    fs.mkdirSync(path.join(repo, "tests"), { recursive: true });
    fs.writeFileSync(path.join(repo, slice!.test), "it('pins', () => {});\n");
    return { brief, written };
}

/**
 * The hint log ranks drift above everything cold, so drift is drilled at the third lesson and — once
 * it is cold again — a second time at the fifth. The log only ranks; earning is counted over the
 * committed lessons.
 */
function hintDrift(repo: string): void {
    const log = path.join(repo, ".nexus", "workbook", ".learner", "hint-log", "hints.json");
    fs.mkdirSync(path.dirname(log), { recursive: true });
    fs.writeFileSync(log, JSON.stringify({ drift: 5 }));
}

/** Four lessons written and finished: drift introduced, revisited, drilled once. */
function fourLessonsIn(repo: string): LessonBrief[] {
    hintDrift(repo);
    return [teachOne(repo).brief, teachOne(repo).brief, teachOne(repo).brief, teachOne(repo).brief];
}

function page(repo: string, name: string): string {
    return fs.readFileSync(path.join(workbookRoot(repo, "rdl"), name), "utf8");
}

describe("a concept's second drill earns it a reference page", () => {
    it("names the concept as having earned a page when it is chosen for a drill a second time", () => {
        const repo = makeRepo();
        fourLessonsIn(repo);

        const briefed = teach(repo);

        const brief = briefOf(briefed);
        expect(brief.drill).toBe("drift");
        expect(brief.earned).toEqual({ concept: "drift", written: false });
        expect(briefed.outcome.report).toContain("drift");
        expect(briefed.outcome.report).toMatch(/reference page/);
    });

    it("earns nothing for a concept met only once, introduced, or asked about again after a hint", () => {
        const repo = makeRepo();
        const briefs = fourLessonsIn(repo);

        // Lesson two revisited drift after a hint, and lesson three drilled it for the first time.
        expect(briefs[1].revisit).toContain("drift");
        expect(briefs[2].drill).toBe("drift");
        for (const brief of briefs) expect(brief.earned).toBeNull();
    });

    it("earns nothing at the session a workbook opens with", () => {
        const repo = makeRepo();

        expect(briefOf(teach(repo)).earned).toBeNull();
    });

    it("writes the page and links it from the lesson whose warm-up drilled the concept", () => {
        const repo = makeRepo();
        fourLessonsIn(repo);

        const { written } = teachOne(repo, true);

        const lesson = readPage(page(repo, "05-reference.html"));
        const link = lesson.links.find((l) => l.label.includes("drift") && !l.href.startsWith("#"));
        expect(link).toBeDefined();
        const reference = readPage(page(repo, link!.href.replace(/^\.\//, "")));
        expect(reference.text).toContain(REFERENCE_PROSE);
        // The session that named the concept says where its page is.
        expect(written.outcome.report).toContain(path.join(workbookRoot(repo, "rdl"), link!.href.replace(/^\.\//, "")));
    });

    it("links every lesson that drilled the concept, including one written before the page existed", () => {
        const repo = makeRepo();
        fourLessonsIn(repo);

        teachOne(repo, true);

        const earlier = readPage(page(repo, "03-drill.html"));
        expect(earlier.links.some((l) => l.label.includes("drift") && l.href.includes("drift"))).toBe(true);
    });

    it("still writes the lesson when the page is not written, and links nothing that is not there", () => {
        const repo = makeRepo();
        fourLessonsIn(repo);

        const { written } = teachOne(repo, false);

        expect(written.outcome.kind).toBe("written");
        const lesson = readPage(page(repo, "05-reference.html"));
        const pages = fs.readdirSync(workbookRoot(repo, "rdl"));
        for (const link of lesson.links) {
            if (link.href.startsWith("#")) continue;
            expect(pages).toContain(link.href.replace(/^\.\//, ""));
        }
        expect(written.outcome.report).toContain("drift");
    });

    it("names a page still owed on the next run, and asks for prose only for a concept earned in that sitting", () => {
        const repo = makeRepo();
        fourLessonsIn(repo);
        teachOne(repo, false);

        const next = teach(repo);

        const brief = briefOf(next);
        expect(brief.earned).toBeNull();
        expect(next.notes.join(" ")).toContain("drift");
        expect(next.outcome.report).not.toMatch(/reference page/);
    });

    it("never overwrites another concept's page that holds the file this one would be written to", () => {
        const repo = makeRepo();
        fourLessonsIn(repo);
        const clash = path.join(workbookRoot(repo, "rdl"), "reference", "drift.md");
        fs.mkdirSync(path.dirname(clash), { recursive: true });
        fs.writeFileSync(clash, "---\nconcept: Drift!\n---\n\nAnother page.\n");
        const brief = briefOf(teach(repo));

        expect(() => teach(repo, proseFor(brief, true))).toThrow(/drift/);

        expect(fs.readFileSync(clash, "utf8")).toContain("Another page.");
    });

    it("stops naming the concept once its page is written", () => {
        const repo = makeRepo();
        fourLessonsIn(repo);
        teachOne(repo, true);

        const next = teach(repo);

        expect(next.notes.join(" ")).not.toMatch(/drift.*reference page|reference page.*drift/);
    });
});

// ---------------------------------------------------------------------------------------------
// The render: one concept, taught content, one page's budget, and a page that prints whole.
// ---------------------------------------------------------------------------------------------

function lesson(file: string, title: string, front: string, body: string): LessonSource {
    return { file, source: `---\ntitle: ${title}\n${front}---\n\n${body}` };
}

function reference(file: string, front: string, body: string): LessonSource {
    return { file, source: `---\n${front}---\n\n${body}` };
}

const LESSONS: LessonSource[] = [
    lesson("01-drift.md", "First lesson", "concepts: [drift, pinned state]\n", "Drift is what happens.\n"),
    lesson("02-drill.md", "Second lesson", "concepts: [cold retrieval]\ndrill: drift\n", "## Warm-up\n\nBefore anything new, a question about drift.\n\n## Theory\n\nMore.\n"),
    lesson("03-other.md", "Third lesson", "concepts: [the probe]\ndrill: pinned state\n", "## Warm-up\n\nA question about pinned state.\n"),
];

const DRIFT_REFERENCE: LessonSource = reference(
    "reference/drift.md",
    "concept: drift\n",
    "Drift is the gap between the pinned state and the live one.\n\n```\nconst aVeryLongLineOfCodeThatRunsWellPastTheEdgeOfAnyPrintedPageUnlessSomethingWrapsIt = true;\n```\n",
);

function named(files: readonly RenderedFile[], name: string): string {
    const found = files.find((f) => f.name === name);
    if (found === undefined) throw new Error(`no page named ${name}; have ${files.map((f) => f.name).join(", ")}`);
    return found.contents;
}

function referencePageName(files: readonly RenderedFile[], concept: string): string {
    const lessonPages = new Set(LESSONS.map((l) => l.file.replace(/\.md$/, ".html")));
    const candidates = files
        .filter((f) => f.name.endsWith(".html") && !lessonPages.has(f.name))
        .filter((f) => readPage(f.contents).title.includes(concept));
    if (candidates.length !== 1) throw new Error(`expected one reference page on ${concept}`);
    return candidates[0].name;
}

function refusal(render: () => unknown): LessonRenderError {
    try {
        render();
    } catch (error) {
        if (error instanceof LessonRenderError) return error;
        throw error;
    }
    throw new Error("expected the render to refuse");
}

describe("a written reference page renders beside the lessons", () => {
    it("renders one page for the concept, carrying the authored prose", () => {
        const files = renderWorkbook({ lessons: LESSONS, references: [DRIFT_REFERENCE] });

        const read = readPage(named(files, referencePageName(files, "drift")));
        expect(read.text).toContain("Drift is the gap between the pinned state and the live one.");
        expect(read.provenance).toContain("reference/drift.md");
    });

    it("carries the same chrome as a lesson page, so a learner can get back", () => {
        const files = renderWorkbook({ lessons: LESSONS, references: [DRIFT_REFERENCE] });

        const ref = readPage(named(files, referencePageName(files, "drift")));
        const lessonPage = readPage(named(files, "01-drift.html"));
        expect(ref.chrome.navigation).toEqual(lessonPage.chrome.navigation);
        expect(ref.chrome.stylesheets).toEqual(lessonPage.chrome.stylesheets);
        expect(ref.chrome.scripts).toEqual(lessonPage.chrome.scripts);
        expect(ref.links.some((l) => l.href === "./01-drift.html")).toBe(true);
    });

    it("is not listed in the teaching navigation", () => {
        const files = renderWorkbook({ lessons: LESSONS, references: [DRIFT_REFERENCE] });

        expect(readPage(named(files, "01-drift.html")).navigation).toEqual(["First lesson", "Second lesson", "Third lesson"]);
    });

    it("is linked from the warm-up of a lesson that drilled the concept, and from no other lesson", () => {
        const files = renderWorkbook({ lessons: LESSONS, references: [DRIFT_REFERENCE] });
        const target = `./${referencePageName(files, "drift")}`;

        expect(readPage(named(files, "02-drill.html")).links.some((l) => l.href === target)).toBe(true);
        expect(readPage(named(files, "01-drift.html")).links.some((l) => l.href === target)).toBe(false);
        expect(readPage(named(files, "03-other.html")).links.some((l) => l.href === target)).toBe(false);
    });

    it("links nothing from a drilled lesson whose concept has no page yet", () => {
        const files = renderWorkbook({ lessons: LESSONS, references: [] });

        const pages = new Set(files.map((f) => f.name));
        for (const link of readPage(named(files, "03-other.html")).links) {
            expect(pages.has(link.href.replace(/^\.\//, ""))).toBe(true);
        }
    });

    it("renders byte-identical output from identical input", () => {
        const one = renderWorkbook({ lessons: LESSONS, references: [DRIFT_REFERENCE] });
        const two = renderWorkbook({ lessons: LESSONS, references: [DRIFT_REFERENCE] });

        expect(two).toEqual(one);
    });
});

describe("the render refuses a reference file that is not one taught concept on one page", () => {
    it("refuses a file that names no concept", () => {
        const error = refusal(() => renderWorkbook({ lessons: LESSONS, references: [reference("reference/none.md", "title: Nothing\n", "Prose.\n")] }));

        expect(error.lesson).toBe("reference/none.md");
    });

    it("refuses a file that names two concepts", () => {
        const error = refusal(() =>
            renderWorkbook({ lessons: LESSONS, references: [reference("reference/two.md", "concept: [drift, pinned state]\n", "Prose.\n")] }),
        );

        expect(error.lesson).toBe("reference/two.md");
    });

    it("refuses a concept no written lesson introduced or drilled", () => {
        const error = refusal(() =>
            renderWorkbook({ lessons: LESSONS, references: [reference("reference/glossary.md", "concept: glossary\n", "Prose.\n")] }),
        );

        expect(error.lesson).toBe("reference/glossary.md");
        expect(error.message).toContain("glossary");
    });

    it("refuses a second file covering a concept another already covers", () => {
        const again = reference("reference/drift-again.md", "concept: drift\n", "Prose.\n");

        const error = refusal(() => renderWorkbook({ lessons: LESSONS, references: [DRIFT_REFERENCE, again] }));

        expect(error.lesson).toBe("reference/drift-again.md");
    });

    it("refuses prose past five hundred words, and accepts it at five hundred", () => {
        const words = (n: number): string => Array.from({ length: n }, () => "word").join(" ") + "\n";

        expect(() => renderWorkbook({ lessons: LESSONS, references: [reference("reference/drift.md", "concept: drift\n", words(500))] })).not.toThrow();
        const error = refusal(() => renderWorkbook({ lessons: LESSONS, references: [reference("reference/drift.md", "concept: drift\n", words(501))] }));
        expect(error.lesson).toBe("reference/drift.md");
    });

    it("refuses markup in a reference file, exactly as it refuses it in a lesson", () => {
        const error = refusal(() =>
            renderWorkbook({ lessons: LESSONS, references: [reference("reference/drift.md", "concept: drift\n", "<div>Prose.</div>\n")] }),
        );

        expect(error.problem).toBe("markup-in-lesson");
    });

    it("refuses a lesson that would render under the name reference pages are given", () => {
        const files = renderWorkbook({ lessons: LESSONS, references: [DRIFT_REFERENCE] });
        const reserved = referencePageName(files, "drift").replace(/\.html$/, ".md");

        const error = refusal(() => renderWorkbook({ lessons: [...LESSONS, lesson(reserved, "Squatter", "", "Prose.\n")] }));

        expect(error.lesson).toBe(reserved);
    });

    it("leaves no output behind when a reference file fails the render", () => {
        const dir = makeDir();
        renderWorkbookInto(dir, { lessons: LESSONS, references: [DRIFT_REFERENCE] });

        expect(() =>
            renderWorkbookInto(dir, { lessons: LESSONS, references: [reference("reference/x.md", "concept: glossary\n", "Prose.\n")] }),
        ).toThrow(LessonRenderError);

        expect(fs.readdirSync(dir).filter((f) => f.endsWith(".html"))).toEqual([]);
    });
});

describe("a printed reference page carries all of its content", () => {
    it("puts every element of its content on the paper, with nothing clipped or hidden, and no navigation", () => {
        const files = renderWorkbook({ lessons: LESSONS, references: [DRIFT_REFERENCE] });
        const html = named(files, referencePageName(files, "drift"));

        const printed = printPage(html, renderStylesheet());

        expect(printed.withheld()).toEqual([]);
        expect(printed.shows("Drift is the gap between the pinned state and the live one.")).toBe(true);
        expect(printed.shows("aVeryLongLineOfCodeThatRunsWellPastTheEdgeOfAnyPrintedPageUnlessSomethingWrapsIt")).toBe(true);
        for (const item of readPage(html).navigation ?? []) expect(printed.shows(item)).toBe(false);
    });

    it("catches a print rule that would clip a code block, so a green assertion means something", () => {
        const files = renderWorkbook({ lessons: LESSONS, references: [DRIFT_REFERENCE] });
        const html = named(files, referencePageName(files, "drift"));

        const clipping = `${renderStylesheet()}\n@media print {\n    .lesson pre { overflow-x: hidden; }\n}\n`;

        expect(printPage(html, clipping).withheld().map((w) => w.by)).toContain("clipped");
    });

    it("catches a print rule that bounds or hides content", () => {
        const files = renderWorkbook({ lessons: LESSONS, references: [DRIFT_REFERENCE] });
        const html = named(files, referencePageName(files, "drift"));

        const bounding = `${renderStylesheet()}\n@media print {\n    .lesson { max-height: 20cm; }\n    .lesson p { visibility: hidden; }\n}\n`;

        const by = printPage(html, bounding).withheld().map((w) => w.by);
        expect(by).toContain("bounded");
        expect(by).toContain("hidden");
    });
});

describe("a workbook with a teaching plan renders its reference pages in every render", () => {
    it("includes the authored reference folder in the plan's render options", () => {
        const repo = makeRepo();
        fourLessonsIn(repo);
        teachOne(repo, true);

        const options = planRenderOptions(repo, "rdl", readWorkbookPlan(repo, "rdl")!);

        expect(options.references?.map((r) => r.file)).toEqual(["reference/drift.md"]);
    });
});
