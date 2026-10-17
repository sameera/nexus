/**
 * Epic #889, story #894 — long-running stages keep a run checklist that survives a context summary.
 *
 * The decision record (#905, D7) gives analyze and distill one run folder each in the checkout's
 * ignored working area, with a checklist that is ticked only after an item's result is saved, read
 * again after a context summary, and guarded by one line for the run's final external write. The
 * rules live in one shared skill, `nxs-long-run`, which only those two stages load once they know
 * their items. No run can be watched from a spec, so these assertions hold the checkable halves:
 * the skill states G20–G26; only analyze and distill load it; each names a run-folder path under
 * `.nexus/tmp/` that distill's entry discovery cannot match; the stages' working files moved into
 * the folder; distill's load ceiling counts the skill; and the skill installs under Codex.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { renderCodexComponents } from "./codex-components.js";
import { SHARED_SKILLS } from "./distill-load-ceiling.js";
import { authoredComponentRoot, listComponentFiles } from "./vendor-components.js";

const ROOT: string = authoredComponentRoot(__dirname);
const SKILL_NAME = "nxs-long-run";

function read(rel: string): string {
    return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

/** Prose wraps at any space, so every phrase check reads the text with its whitespace collapsed. */
function flat(text: string): string {
    return text.replace(/\s+/g, " ");
}

const RAW_SKILL: string = read(`skills/${SKILL_NAME}/SKILL.md`);
const SKILL: string = flat(RAW_SKILL);
const ANALYZE: string = read("commands/nxs.analyze.md");
const DISTILL: string = read("commands/nxs.distill.md");
const LOADERS: Readonly<Record<string, string>> = { "commands/nxs.analyze.md": ANALYZE, "commands/nxs.distill.md": DISTILL };

/** Every run-folder path a stage names: `.nexus/tmp/runs/<name>/`. */
function runFolderPaths(text: string): string[] {
    return [...text.matchAll(/\.nexus\/tmp\/runs\/[^\s`/]+\//g)].map((m) => m[0]);
}

/**
 * Distill's own statement of which `.nexus/tmp/` directories are ephemeral entries: the
 * `.nexus/tmp/<kind>-<n>/` forms its entry-discovery step names, read from its text so the check
 * follows the stage if the set ever changes.
 */
function ephemeralEntryShape(): RegExp {
    const discovery: string = DISTILL.slice(DISTILL.indexOf("**Also scan `.nexus/tmp/`**"));
    const kinds: string[] = [...discovery.slice(0, 400).matchAll(/`\.nexus\/tmp\/([a-z]+)-<n>\/`/g)].map((m) => m[1]!);
    expect(kinds.sort()).toEqual(["epic", "fix", "intake"]);
    return new RegExp(`^\\.nexus/tmp/(${kinds.join("|")})-[^/]+/$`);
}

describe("the long-run skill is the one home of the run folder and the checklist", () => {
    it("is a skill with the frontmatter a skill needs, in numbered sections a later story can extend", () => {
        expect(RAW_SKILL).toMatch(new RegExp(`^---\\nname: ${SKILL_NAME}\\n`));
        expect(RAW_SKILL).toMatch(/^description: .+/m);
        const sections: string[] = [...RAW_SKILL.matchAll(/^## (\d+)\. /gm)].map((m) => m[1]!);
        expect(sections).toEqual(sections.map((_s, i) => String(i + 1)));
        expect(sections.length).toBeGreaterThanOrEqual(4);
    });

    it("writes one checklist in the run folder once the items are known, one line per item (G20)", () => {
        expect(SKILL).toContain("<run>/checklist.md");
        expect(SKILL).toMatch(/one line per item/i);
        expect(SKILL).toMatch(/header/i);
        expect(SKILL).toMatch(/starting commit|commit the run started from/i);
    });

    it("ticks a finished item and appends a new one (G21)", () => {
        expect(SKILL).toMatch(/append a line for an item found during the run/i);
        expect(SKILL).toMatch(/never rewrite or drop a line/i);
    });

    it("ticks a line only after the item's result is saved in the run folder (G22)", () => {
        expect(SKILL).toMatch(/tick a line only after the item's result is saved in the run folder/i);
    });

    it("reads the checklist again after a context summary and repeats no ticked item (G23)", () => {
        expect(SKILL).toMatch(/after a context summary/i);
        expect(SKILL).toMatch(/read `<run>\/checklist\.md` again/i);
        expect(SKILL).toMatch(/skip every ticked line/i);
        expect(SKILL).toMatch(/second verdict/i);
        expect(SKILL).toMatch(/second delta/i);
        expect(SKILL).toMatch(/from the saved files, not from the conversation/i);
    });

    it("guards the final external write with its own line, so no second review or pull request goes out (G24)", () => {
        expect(SKILL).toMatch(/one line for the run's final external write/i);
        expect(SKILL).toMatch(/publishing analyze's review/i);
        expect(SKILL).toMatch(/opening the distillation pull request/i);
        expect(SKILL).toMatch(/never make the final external write twice/i);
        expect(SKILL).toMatch(/check whether the write already landed/i);
    });

    it("starts every run with a fresh folder and never reads an earlier run's checklist (G25)", () => {
        expect(SKILL).toMatch(/opening the folder replaces it/i);
        expect(SKILL).toMatch(/never reads what an earlier run left, its checklist included/i);
        expect(SKILL).toMatch(/do not replace the folder after a context summary/i);
    });

    it("keeps the folder in the ignored working area, out of distill's entry discovery, and removes it at the finish line (G26)", () => {
        expect(SKILL).toContain(".nexus/tmp/runs/<stage>-<subject>/");
        expect(SKILL).toMatch(/one level below `\.nexus\/tmp\/`/);
        expect(SKILL).toMatch(/never reads a run folder as one/i);
        expect(SKILL).toMatch(/at the finish line, remove the run folder/i);
        expect(SKILL).toMatch(/a finished run leaves no file behind/i);
        expect(SKILL).toMatch(/a run that stops early leaves the folder/i);
    });

    it("keeps no diff in the folder (G36)", () => {
        expect(SKILL).toMatch(/never a copy of an input the stage derives again, such as an entry's diff/i);
        expect(DISTILL).toMatch(/It is never written anywhere/);
    });
});

describe("only analyze and distill load the long-run skill, once they know their items", () => {
    it.each(Object.keys(LOADERS))("%s loads it after its items are resolved", (rel) => {
        const text: string = flat(LOADERS[rel]!);
        const load: number = text.search(new RegExp(`Load the \\*\\*\`${SKILL_NAME}\`\\*\\* skill`));
        expect(load, rel).toBeGreaterThan(-1);
        expect(load, `${rel} loads it after the run-discipline skill`).toBeGreaterThan(text.indexOf("`nxs-run-discipline`"));
    });

    it("analyze loads it past both block states, before its first working file", () => {
        const load: number = ANALYZE.indexOf(`\`${SKILL_NAME}\``);
        expect(load).toBeGreaterThan(ANALYZE.indexOf("On either block state, emit nothing at all"));
        expect(load).toBeLessThan(ANALYZE.indexOf("<run>/record-body.md"));
    });

    it("distill loads it once entry discovery has found the drainable entries", () => {
        const load: number = DISTILL.indexOf(`\`${SKILL_NAME}\``);
        expect(load).toBeGreaterThan(DISTILL.indexOf("If nothing is drainable, report that and stop."));
        expect(load).toBeLessThan(DISTILL.indexOf("# Phase 0 — Preflight"));
    });

    it("no other component names it", () => {
        for (const rel of listComponentFiles(ROOT)) {
            if (rel in LOADERS || rel.startsWith(`skills/${SKILL_NAME}/`)) continue;
            expect(read(rel), rel).not.toContain(SKILL_NAME);
        }
    });

    it("is counted in distill's load ceiling as a shared skill", () => {
        expect(SHARED_SKILLS).toContain(SKILL_NAME);
    });
});

describe("each stage's run folder sits under .nexus/tmp/ where distill never finds an entry (G26)", () => {
    it.each(Object.keys(LOADERS))("%s names its run folder one level below .nexus/tmp/, prefixed by its stage", (rel) => {
        const paths: string[] = runFolderPaths(LOADERS[rel]!);
        expect(paths.length, rel).toBeGreaterThan(0);
        const stage: string = rel.includes("analyze") ? "analyze" : "distill";
        const shape: RegExp = ephemeralEntryShape();
        for (const p of paths) {
            expect(p, rel).toMatch(new RegExp(`^\\.nexus/tmp/runs/${stage}-`));
            expect(shape.test(p), `${p} looks like a queue entry`).toBe(false);
        }
    });

    describe("on disk, distill's discovery rule passes over a run folder", () => {
        let root: string;
        afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

        /** Distill's stated rule: a directory directly under `.nexus/tmp/` of an entry shape, holding both files. */
        function discover(checkout: string): string[] {
            const tmp: string = path.join(checkout, ".nexus", "tmp");
            const shape: RegExp = ephemeralEntryShape();
            return fs
                .readdirSync(tmp, { withFileTypes: true })
                .filter((d) => d.isDirectory())
                .map((d) => `.nexus/tmp/${d.name}/`)
                .filter((rel) => shape.test(rel))
                .filter((rel) => ["epic.md", "close-record.md"].every((f) => fs.existsSync(path.join(checkout, rel, f))));
        }

        it("finds the real entry and not a run folder holding the same files", () => {
            root = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-long-run-"));
            const entry: string = path.join(root, ".nexus", "tmp", "epic-7");
            const runs: string[] = [...runFolderPaths(ANALYZE), ...runFolderPaths(DISTILL)].map((p) =>
                path.join(root, p.replace(/<[^>]+>/g, "42")),
            );
            for (const dir of [entry, ...runs]) {
                fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(path.join(dir, "epic.md"), "---\nentry_kind: epic\n---\n");
                fs.writeFileSync(path.join(dir, "close-record.md"), "---\n---\n");
            }
            expect(discover(root)).toEqual([".nexus/tmp/epic-7/"]);
        });
    });
});

describe("the stages' working files moved into the run folder", () => {
    it("leaves no unplaced scratch path in analyze or distill", () => {
        expect(ANALYZE).not.toContain("<scratch>");
        expect(DISTILL).not.toContain("<scratch>");
        expect(DISTILL).not.toMatch(/the scratchpad/);
    });

    it("puts analyze's record body, scope, judgments and review body in the run folder", () => {
        for (const file of ["record-body.md", "scope.json", "items.json", "facts.json", "analyze-review.md"]) {
            expect(ANALYZE, file).toContain(`<run>/${file}`);
        }
    });

    it("puts distill's per-entry files, deltas, run summary and pull-request body in the run folder", () => {
        for (const file of ["<entry-slug>/entry-kind", "<entry-slug>/record-body.md", "<entry-slug>/deltas.md", "run-summary.md", "pr-body.md"]) {
            expect(DISTILL, file).toContain(`<run>/${file}`);
        }
    });

    it("ticks a distill entry when its commit is on the distill branch, and the final line once the pull request is open", () => {
        expect(flat(DISTILL)).toMatch(/tick its line once its commit is on the distill branch/i);
        expect(flat(DISTILL)).toMatch(/tick the final line/i);
    });

    it("ticks an analyze story once its results are saved, and the final line once the review is published", () => {
        expect(flat(ANALYZE)).toMatch(/save each story's results to `<run>\/story-<n>\.md`, then tick its line/i);
        expect(flat(ANALYZE)).toMatch(/tick the final line/i);
    });

    it("keeps the run summary the one source of the checkpoint, the pull-request body and the report (G36)", () => {
        expect(flat(DISTILL)).toMatch(/written to `<run>\/run-summary\.md`/);
        expect(flat(DISTILL)).toMatch(/The checkpoint below, the pull request body \(Phase 7\) and the completion report \(Phase 8\) are \*layouts\* over these fields/);
    });
});

describe("the long-run skill works under Codex", () => {
    it("installs as its own skill, and the stages that load it can find it", () => {
        const files: Map<string, Buffer> = renderCodexComponents(ROOT);
        expect(files.get(`skills/${SKILL_NAME}/SKILL.md`)?.toString("utf8")).toMatch(/checklist/i);
        for (const stage of ["nxs-analyze", "nxs-distill"]) {
            expect(files.get(`skills/${stage}/SKILL.md`)?.toString("utf8"), stage).toContain(SKILL_NAME);
        }
    });
});
