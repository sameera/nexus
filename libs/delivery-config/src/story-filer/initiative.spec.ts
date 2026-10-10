/**
 * Epic #705 — the batch filer files an initiative, and stubs under one (decision record #786).
 *
 * An initiative is filed through the same capability as a batch of stories or stubs: a one-item
 * batch classified by the repository's initiative marker. The cases here drive the filer the way
 * `/nxs.epic` does, so what the command's instructions promise about the filed issues is asserted
 * against the calls the filer actually makes.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type RunResult } from "../gh";
import { OK, checkoutWith, fakePlatform, recordingIo, scratch, writeItem } from "./fixtures";
import { LEDGER_NAME, type Ledger } from "./ledger";
import { runCreateStory } from "./run";

const REPO = "acme/tracker";

const INITIATIVE = `---
ref: "INITIATIVE"
title: "A lead can tell what a decomposition adds up to"
---

A lead can tell what a decomposition adds up to.

## Execution order

1. STUB-01 Group the stubs — the set has a parent.
2. STUB-02 State the order — the objective is reached.
`;

interface Seen {
    createdLabels: string[][];
    createdBodies: string[];
}

function platform(overrides: (args: string[]) => RunResult | undefined = () => undefined) {
    const seen: Seen = { createdLabels: [], createdBodies: [] };
    let next = 100;
    const gh = fakePlatform((args: string[]): RunResult | undefined => {
        const override: RunResult | undefined = overrides(args);
        if (override !== undefined) return override;
        if (args[0] === "issue" && args[1] === "create") {
            seen.createdLabels.push(args.filter((_a, i) => args[i - 1] === "--label"));
            seen.createdBodies.push(fs.readFileSync(args[args.indexOf("--body-file") + 1], "utf8"));
            return OK(`https://github.com/${REPO}/issues/${next++}\n`);
        }
        if (args[0] === "api" && args[2] === "-q" && args[3] === ".id") {
            return OK(`900${/issues\/(\d+)/.exec(args[1])?.[1] ?? "0"}\n`);
        }
        if (args[0] === "issue" && args[1] === "view") return OK("I_node\n");
        return undefined;
    });
    return { ...gh, seen };
}

function repo(): string {
    return checkoutWith({ classification: "labels", "story-repo": REPO, project: "none" });
}

function ledgerAt(root: string): Ledger {
    const file: string = path.join(scratch(root), LEDGER_NAME);
    return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Ledger) : {};
}

const AS_INITIATIVE: string[] = ["--classification-label", "initiative", "--classification-type", "", "--keep-manifest"];

describe("filing the initiative as its own one-item batch (story #707)", () => {
    it("files one issue carrying the initiative label and nothing else, with no parent link (G7, G11)", () => {
        const root: string = repo();
        writeItem(root, "STORY-INITIATIVE.md", INITIATIVE);
        const gh = platform();
        expect(runCreateStory([scratch(root), ...AS_INITIATIVE], recordingIo(root), gh.env)).toBe(0);
        expect(gh.seen.createdLabels).toEqual([["initiative"]]);
        expect(gh.calls.some((args) => args.join(" ").includes("addSubIssue"))).toBe(false);
    });

    it("leaves the stubs' draft names in the body, for the run to replace once the stubs exist (D6)", () => {
        const root: string = repo();
        writeItem(root, "STORY-INITIATIVE.md", INITIATIVE);
        const gh = platform();
        const io = recordingIo(root);
        expect(runCreateStory([scratch(root), ...AS_INITIATIVE], io, gh.env)).toBe(0);
        expect(gh.seen.createdBodies[0]).toContain("1. STUB-01 Group the stubs");
        expect(gh.calls.some((args) => args[0] === "issue" && args[1] === "edit")).toBe(false);
    });

    it("records the initiative's number in the run folder, and a repeat files no second one (G16)", () => {
        const root: string = repo();
        writeItem(root, "STORY-INITIATIVE.md", INITIATIVE);
        const gh = platform();
        runCreateStory([scratch(root), ...AS_INITIATIVE], recordingIo(root), gh.env);
        expect(ledgerAt(root)["initiative"]).toMatchObject({ number: "100", url: `https://github.com/${REPO}/issues/100` });

        expect(runCreateStory([scratch(root), ...AS_INITIATIVE], recordingIo(root), gh.env)).toBe(0);
        expect(gh.seen.createdLabels).toHaveLength(1);
        expect(ledgerAt(root)["initiative"]).toMatchObject({ number: "100" });
    });
});
