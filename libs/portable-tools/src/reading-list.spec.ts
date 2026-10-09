/**
 * The reading-list builder (epic #896, story #897): which concept pages the epic stage proposes for
 * an intent, deterministically, with no model choosing pages.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applySelection, buildReadingList, loadStore, renderReadingGroup, runReadingList, type ReadingList, type StorePage } from "./reading-list";

let dirs: string[] = [];
afterEach(() => {
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
    dirs = [];
});

function page(name: string, title: string, aliases: string[] = [], touches: string[] = [], status = "active"): StorePage {
    return { name, title, aliases, touches, status };
}

function names(entries: ReadingList["listed"]): string[] {
    return entries.map((e) => e.page);
}

describe("buildReadingList", () => {
    const store: StorePage[] = [
        page("conformance-gate", "Conformance Gate", ["the receipt"], ["decision-record", "distiller"]),
        page("decision-record", "Decision Record", [], ["distiller"]),
        page("distiller", "Distiller", ["the drain"], ["decision-record"]),
        page("old-thing", "Old Thing", [], [], "archived"),
        page("stub", "Stub", [], [], "deprecated"),
    ];

    it("lists a page whose title appears as a whole phrase, ignoring case", () => {
        const list: ReadingList = buildReadingList(store, "tighten the CONFORMANCE GATE report");
        expect(names(list.listed)[0]).toBe("conformance-gate");
    });

    it("matches an alias but not a partial word", () => {
        expect(names(buildReadingList(store, "fix the receipt").listed)).toContain("conformance-gate");
        expect(names(buildReadingList(store, "the redistillery").listed)).toEqual([]);
    });

    it("adds neighbours one step away and not their neighbours", () => {
        const pages: StorePage[] = [page("a", "Alpha", [], ["b"]), page("b", "Beta", [], ["c"]), page("c", "Gamma")];
        expect(names(buildReadingList(pages, "alpha").listed)).toEqual(["a", "b"]);
    });

    it("puts direct matches before neighbours and orders matches by first appearance", () => {
        const list: ReadingList = buildReadingList(store, "the receipt feeds the drain");
        expect(names(list.listed)).toEqual(["conformance-gate", "distiller", "decision-record"]);
        expect(list.listed[2].reason).toMatch(/neighbour/);
    });

    it("never proposes archived or deprecated pages, even as neighbours or matches", () => {
        const pages: StorePage[] = [page("a", "Alpha", [], ["old-thing", "stub"]), ...store];
        const list: ReadingList = buildReadingList(pages, "alpha and old thing and stub");
        expect(names([...list.listed, ...list.overflow])).toEqual(["a"]);
    });

    it("caps at seven with direct matches first and the rest offered as overflow", () => {
        const many: StorePage[] = Array.from({ length: 9 }, (_, i) => page(`p${i}`, `Topic${i}`, [], i === 0 ? ["n1", "n2"] : []));
        many.push(page("n1", "N1"), page("n2", "N2"));
        const list: ReadingList = buildReadingList(many, many.slice(0, 9).map((p) => p.title).join(" "));
        expect(list.listed).toHaveLength(7);
        expect(names(list.listed).every((n) => n.startsWith("p"))).toBe(true);
        expect(names(list.overflow)).toEqual(["p7", "p8", "n1", "n2"]);
    });

    it("ranks neighbours named by more matches first, then by the order the matches named them", () => {
        const pages: StorePage[] = [page("a", "Alpha", [], ["x", "y"]), page("b", "Beta", [], ["y"]), page("x", "X"), page("y", "Y")];
        expect(names(buildReadingList(pages, "alpha beta").listed)).toEqual(["a", "b", "y", "x"]);
    });

    it("counts a page that is both a match and a neighbour once, as a match", () => {
        const pages: StorePage[] = [page("a", "Alpha", [], ["b"]), page("b", "Beta", [], ["a"])];
        const list: ReadingList = buildReadingList(pages, "alpha beta");
        expect(list.listed.map((e) => e.page)).toEqual(["a", "b"]);
        expect(list.listed[1].reason).toMatch(/Beta/);
    });

    it("gives the same list for the same input", () => {
        expect(buildReadingList(store, "the drain and the receipt")).toEqual(buildReadingList([...store].reverse(), "the drain and the receipt"));
    });

    it("returns an empty list when nothing matches", () => {
        expect(buildReadingList(store, "nothing relevant")).toEqual({ listed: [], overflow: [] });
    });
});

describe("applySelection", () => {
    const list: ReadingList = {
        listed: [{ page: "a", reason: "matched" }, { page: "b", reason: "matched" }],
        overflow: [{ page: "c", reason: "beyond the cap" }],
    };

    it("keeps the offered pages in offered order", () => {
        expect(applySelection(list, ["c", "a"])).toEqual({ ok: true, pages: ["a", "c"] });
    });

    it("refuses a page that was not offered", () => {
        expect(applySelection(list, ["zzz"])).toMatchObject({ ok: false });
    });

    it("refuses more than seven pages", () => {
        const wide: ReadingList = { listed: Array.from({ length: 8 }, (_, i) => ({ page: `p${i}`, reason: "r" })), overflow: [] };
        expect(applySelection(wide, wide.listed.map((e) => e.page))).toMatchObject({ ok: false });
    });
});

describe("renderReadingGroup", () => {
    it("numbers proposed pages ticked with a reason and overflow unticked, continuing the checklist numbering", () => {
        const lines: string[] = renderReadingGroup(
            { listed: [{ page: "a", reason: "matched \"alpha\"" }], overflow: [{ page: "c", reason: "beyond the cap of 7" }] },
            9,
        );
        expect(lines.join("\n")).toMatch(/Reading list/);
        expect(lines.join("\n")).toMatch(/\[x\]\s+9\. a/);
        expect(lines.join("\n")).toMatch(/\[ \]\s+10\. c/);
    });
});

describe("runReadingList", () => {
    function workspace(): { dir: string; draft: string; input: string; store: string } {
        const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "reading-list-"));
        dirs.push(dir);
        const store: string = path.join(dir, "concepts");
        fs.mkdirSync(path.join(store, "_archive"), { recursive: true });
        fs.writeFileSync(path.join(store, "distiller.md"), "---\ntitle: \"Distiller\"\naliases: [\"the drain\"]\ntouches: [\"decision-record\"]\nstatus: active\n---\n\n# Distiller\n");
        fs.writeFileSync(path.join(store, "decision-record.md"), "---\ntitle: \"Decision Record\"\naliases: []\ntouches: []\nstatus: active\n---\n");
        fs.writeFileSync(path.join(store, "README.md"), "# not a page\n");
        const draft: string = path.join(dir, "epic.md");
        fs.writeFileSync(draft, "---\nepic: \"Make the drain faster\"\nconcepts: []          # reading-list\nlink:\n---\n\n# Epic\n\n## Description\n\nSpeed up things.\n");
        const input: string = path.join(dir, "input.txt");
        fs.writeFileSync(input, "faster close");
        return { dir, draft, input, store };
    }

    function run(argv: string[], cwd: string): { code: number; out: string; err: string } {
        const out: string[] = [];
        const err: string[] = [];
        const code: number = runReadingList(argv, { cwd, stdout: (l) => out.push(l), stderr: (l) => err.push(l) });
        return { code, out: out.join("\n"), err: err.join("\n") };
    }

    it("loads only active store files that are pages", () => {
        const { store } = workspace();
        expect(loadStore(store).map((p) => p.name).sort()).toEqual(["decision-record", "distiller"]);
    });

    it("proposes from the title and description as well as the input, and writes the list into the draft", () => {
        const w = workspace();
        const result = run(["--draft", w.draft, "--input", w.input, "--store", w.store], w.dir);
        expect(result.code).toBe(0);
        expect(fs.readFileSync(w.draft, "utf8")).toMatch(/concepts: \["distiller", "decision-record"\]/);
        expect(fs.readFileSync(w.draft, "utf8")).toMatch(/^link:$/m);
        expect(result.out).toMatch(/distiller/);
    });

    it("keeps a list the draft already carries", () => {
        const w = workspace();
        fs.writeFileSync(w.draft, fs.readFileSync(w.draft, "utf8").replace("concepts: []          # reading-list", "concepts: [\"decision-record\"]"));
        run(["--draft", w.draft, "--input", w.input, "--store", w.store], w.dir);
        expect(fs.readFileSync(w.draft, "utf8")).toMatch(/concepts: \["decision-record"\]/);
    });

    it("applies a reviewer's selection and refuses an unoffered page", () => {
        const w = workspace();
        run(["--draft", w.draft, "--input", w.input, "--store", w.store], w.dir);
        expect(run(["--draft", w.draft, "--apply", "decision-record"], w.dir).code).toBe(0);
        expect(fs.readFileSync(w.draft, "utf8")).toMatch(/concepts: \["decision-record"\]/);
        expect(run(["--draft", w.draft, "--apply", "nope"], w.dir).code).toBe(1);
    });

    it("proposes nothing and writes an empty list when the store is absent", () => {
        const w = workspace();
        const result = run(["--draft", w.draft, "--input", w.input, "--store", path.join(w.dir, "missing")], w.dir);
        expect(result.code).toBe(0);
        expect(result.out).toMatch(/no pages/i);
    });
});

describe("razor-offer with a reading list", () => {
    it("appends the reading list as the last group of the numbered checklist", async () => {
        const { runNexusCli } = await import("./nexus-cli");
        const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "reading-offer-"));
        dirs.push(dir);
        fs.writeFileSync(path.join(dir, "epic.md"), "---\nepic: \"E\"\n---\n\n# Epic\n\n## Out of Scope\n\n- Nothing [inferred]\n");
        fs.writeFileSync(
            path.join(dir, "reading-list.json"),
            JSON.stringify({ listed: [{ page: "distiller", reason: "matched \"the drain\"" }], overflow: [{ page: "x", reason: "beyond the cap" }] }),
        );
        const out: string[] = [];
        expect(await runNexusCli(["razor-offer", "--draft", "epic.md"], { cwd: dir, stdout: (l: string) => out.push(l), stderr: () => undefined })).toBe(0);
        const text: string = out.join("\n");
        expect(text).toMatch(/\[x\]\s+2\. distiller/);
        expect(text).toMatch(/\[ \]\s+3\. x/);
    });
});
