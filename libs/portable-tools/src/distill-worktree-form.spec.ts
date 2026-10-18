/**
 * Story #945 — `/nxs.distill <worktree-path>` from another checkout (epic #909, decision record
 * #946: D10, D11, D12; G22–G26; R2).
 *
 * The stage is prose a model executes, so these specs hold what the text commits the model to: how
 * a path argument is classified, what a refusal names, and that every phase works through the
 * named worktree rather than a directory change that would not last.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { BASE_STAGE, contract, selectionRows } from "./distill-exceptional-paths.spec.js";
import { authoredComponentRoot } from "./vendor-components.js";

const CONTINUATION: string = contract("nxs-distill-continuation");
const WORKTREE_FORM: string = CONTINUATION.slice(CONTINUATION.indexOf("## The worktree form"), CONTINUATION.indexOf("## Input Resolution"));

describe("a path argument is classified by what is at the path (D11, G22, G25)", () => {
    it("classifies the path before any run-shape value, refusing anything else before any entry is read", () => {
        const front = BASE_STAGE.slice(BASE_STAGE.indexOf("## Run-shape resolution"), BASE_STAGE.indexOf("1. **Run mode.**"));
        expect(front).toMatch(/path argument/i);
        expect(front).toContain("worktree form");
        expect(front).toMatch(/run mode is\s+\*\*continuation\*\*/);
        expect(front).toMatch(/resolved against that worktree/);
        expect(front).toMatch(/refused before any entry is read/);
        for (const found of ["no such\n   directory", "not a worktree", "another repository's worktree", "not a distillation branch", "commits beyond close's"]) {
            expect(front).toContain(found);
        }
        // The worktree form reads its rules through the continuation row the table already has.
        expect(selectionRows()).toContainEqual(["run mode is `continuation`", "`nxs-distill-continuation`", "Input Resolution, after the entry list"]);
    });

    it("refuses a queue-entry path inside another checkout at classification, naming that checkout's root (D11)", () => {
        const front = BASE_STAGE.slice(BASE_STAGE.indexOf("## Run-shape resolution"), BASE_STAGE.indexOf("1. **Run mode.**"));
        expect(front).toMatch(/queue-entry path\s+inside another checkout is refused,\s+naming that checkout's root/);
    });

    it("drains the worktree's one entry when the path names a close worktree (#945 AC1)", () => {
        const discovery = BASE_STAGE.slice(BASE_STAGE.indexOf("## Entry discovery"), BASE_STAGE.indexOf("2. **No arguments**"));
        expect(discovery).toMatch(/worktree form/);
        expect(discovery).toMatch(/one entry/);
    });

    it("requires the worktree's root, this repository's git folder, a distill branch and the continuation test", () => {
        expect(WORKTREE_FORM).toContain("--show-toplevel");
        expect(WORKTREE_FORM).toContain("--git-common-dir");
        expect(WORKTREE_FORM).toContain("distill/*");
        expect(WORKTREE_FORM).toMatch(/continuation test/);
    });

    it("states the checks behind each refusal, naming each thing it can find", () => {
        expect(WORKTREE_FORM).toMatch(/refuse before reading any entry/i);
        for (const found of ["no such directory", "not a worktree", "a worktree of another repository", "not a distillation branch", "commits beyond close's"]) {
            expect(WORKTREE_FORM).toContain(found);
        }
        expect(WORKTREE_FORM).toMatch(/inside another checkout is refused/);
    });

    it("resolves the workspace shape against the worktree, so a member worktree is still refused", () => {
        expect(WORKTREE_FORM).toContain('"$WT/.nexus/config/hub.yml"');
        expect(WORKTREE_FORM).toMatch(/member rule/);
    });
});

describe("every phase works through the pinned root (D12, G23, G24, R2)", () => {
    it("names the worktree in every git command and every other command, and uses absolute paths inside it", () => {
        expect(WORKTREE_FORM).toContain('git -C "$WT"');
        expect(WORKTREE_FORM).toContain('(cd "$WT" && <command>)');
        expect(WORKTREE_FORM).toMatch(/absolute path inside `\$WT`/);
        expect(WORKTREE_FORM).toContain("$WT/.nexus/tmp/runs/distill-<subject>/");
    });

    it("opens the run folder inside the worktree before the continuation contract loads (G23)", () => {
        const front = BASE_STAGE.slice(BASE_STAGE.indexOf("## Run-shape resolution"), BASE_STAGE.indexOf("1. **Run mode.**"));
        expect(front).toMatch(/run folder included/);
        const openRunFolder = BASE_STAGE.slice(BASE_STAGE.indexOf("**Open the run folder.**"), BASE_STAGE.indexOf("All drainable entries"));
        expect(openRunFolder).toMatch(/worktree form[^.]*`\$WT\/\.nexus\/tmp\/runs\/`/);
    });

    it("checks the worktree's tree, never the lead's checkout", () => {
        expect(WORKTREE_FORM).toContain('git -C "$WT" status --porcelain');
        expect(WORKTREE_FORM).toMatch(/lead's own checkout may\s+carry uncommitted work/);
    });

    it("never tells the model to change directory in one command and rely on it in the next", () => {
        const root = authoredComponentRoot(__dirname);
        const docs = [
            path.join(root, "commands", "nxs.distill.md"),
            ...fs
                .readdirSync(path.join(root, "skills"))
                .filter((d) => d.startsWith("nxs-distill-") || d === "nxs-long-run" || d === "nxs-run-discipline")
                .map((d) => path.join(root, "skills", d, "SKILL.md")),
        ];
        const lasting: string[] = [];
        for (const doc of docs) {
            let fenced = false;
            for (const line of fs.readFileSync(doc, "utf8").split("\n")) {
                if (line.trim().startsWith("```")) fenced = !fenced;
                else if (fenced && /^\s*cd\s/.test(line) && !/&&/.test(line)) lasting.push(`${path.basename(path.dirname(doc))}: ${line.trim()}`);
            }
        }
        expect(lasting).toEqual([]);
    });
});

describe("the report names the worktree and one cleanup command (D10, G26, decision record #956 D7)", () => {
    it("names nexus distill cleanup, never a raw git worktree removal", () => {
        const phase8 = CONTINUATION.slice(CONTINUATION.indexOf("## Phase 8"));
        expect(phase8).toContain("Worktree: <wtPath>");
        expect(phase8).toContain("nexus distill cleanup <epic>");
        expect(CONTINUATION).not.toContain("git worktree remove");
        expect(phase8).toMatch(/inside it or named it by path/);
    });

    it("tells the run to write the drained epic's number into the cleanup line, not the placeholder (G19)", () => {
        const phase8 = CONTINUATION.slice(CONTINUATION.indexOf("## Phase 8"));
        expect(phase8).toMatch(/Replace `<epic>` with the number N of the closed queue entry folder `epic-<N>` this run drains/);
    });
});
