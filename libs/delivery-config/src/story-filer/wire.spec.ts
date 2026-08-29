/**
 * Story #371 — the authored ordering arrives on GitHub as real dependency edges.
 *
 * The distinction the cases turn on is what a `blocked_by` entry *names*: a sibling in this batch,
 * an issue that already exists, or — for a bare number — a sibling that simply is not there.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type RunResult } from "../gh";
import { OK, FAIL, checkoutWith, fakePlatform, recordingIo, scratch, story, writeItem } from "./fixtures";
import { LEDGER_NAME } from "./ledger";
import { runCreateStory } from "./run";

const REPO = "acme/tracker";

/** Every `blocked_by` POST, as `dependent → blocker database id`. */
function edges(calls: string[][]): [string, string][] {
    return calls
        .filter((args) => args[0] === "api" && args[1] === "--method" && args[3].endsWith("/dependencies/blocked_by"))
        .map((args): [string, string] => [
            /issues\/(\d+)/.exec(args[3])?.[1] ?? "",
            args[args.indexOf("-F") + 1].replace("issue_id=", ""),
        ]);
}

/**
 * A platform minting issues from 100 up, whose database id is the number prefixed `900`.
 * `known` names the issues that already exist outside the batch; anything else 404s.
 */
function platform(options: { known?: string[]; alreadyBlockedBy?: Record<string, string[]> } = {}) {
    let next = 100;
    // Only the issues this batch minted, plus the ones named as already filed, exist.
    const known: Set<string> = new Set(options.known ?? []);
    return fakePlatform((args: string[]): RunResult | undefined => {
        if (args[0] === "issue" && args[1] === "create") {
            known.add(String(next));
            return OK(`https://github.com/${REPO}/issues/${next++}\n`);
        }
        if (args[0] === "issue" && args[1] === "view") return OK("I_node\n");
        if (args[0] === "api" && args[1] === "--method") return OK("{}");
        if (args[0] === "api" && args[1].endsWith("/dependencies/blocked_by")) {
            const dependent: string = /issues\/(\d+)/.exec(args[1])?.[1] ?? "";
            return OK((options.alreadyBlockedBy?.[dependent] ?? []).join("\n"));
        }
        if (args[0] === "api" && args[3] === ".id") {
            const number: string = /issues\/(\d+)/.exec(args[1])?.[1] ?? "";
            if (known.has(number)) return OK(`900${number}\n`);
            return FAIL("HTTP 404: Not Found");
        }
        return undefined;
    });
}

function repo(): string {
    return checkoutWith({ classification: "labels", "story-repo": REPO, project: "none" });
}

describe("wiring blocked_by from batch refs", () => {
    it("wires an edge from the dependent onto a sibling in the same batch", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        writeItem(root, "STORY-2.md", story("2", { blocked_by: "[STORY-1]" }));
        const io = recordingIo(root);
        const gh = platform();
        runCreateStory([scratch(root)], io, gh.env);
        expect(edges(gh.calls)).toEqual([["101", "900100"]]);
        expect(io.out.join("\n")).toContain("#101 blocked_by ref '1'");
    });

    it("treats a bare number as a batch ref, never as an issue reference", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1", { blocked_by: "[54]" }));
        const io = recordingIo(root);
        const gh = platform({ known: ["54"] });
        runCreateStory([scratch(root)], io, gh.env);
        expect(edges(gh.calls)).toEqual([]);
        expect(io.err.join("\n")).toContain("blocked_by ref '54' for #100 not among created issues");
    });

    it("resolves a blocker created by an earlier run through the ledger", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        runCreateStory([scratch(root), "--keep-manifest"], recordingIo(root), platform().env);
        writeItem(root, "STORY-2.md", story("2", { blocked_by: "[STORY-1]" }));
        const gh = platform();
        runCreateStory([scratch(root), "--keep-manifest"], recordingIo(root), gh.env);
        expect(edges(gh.calls)).toEqual([["100", "900100"]]);
    });
});

describe("wiring blocked_by from a literal issue reference", () => {
    it("resolves a `#<n>` against the platform and wires an edge onto that existing issue", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1", { blocked_by: "[#54]" }));
        const gh = platform({ known: ["54"] });
        runCreateStory([scratch(root)], recordingIo(root), gh.env);
        expect(edges(gh.calls)).toEqual([["100", "90054"]]);
    });

    it("reports a `#<n>` naming no issue as unresolved, and invents no edge", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1", { blocked_by: "[#999]" }));
        const io = recordingIo(root);
        const gh = platform();
        runCreateStory([scratch(root)], io, gh.env);
        expect(edges(gh.calls)).toEqual([]);
        expect(io.err.join("\n")).toContain("blocked_by ref '#999' for #100 not among created issues");
    });

    it("resolves each entry of a mixed list by its own rule, and wires both", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        writeItem(root, "STORY-2.md", story("2", { blocked_by: "[STORY-1, #54]" }));
        const gh = platform({ known: ["54"] });
        runCreateStory([scratch(root)], recordingIo(root), gh.env);
        expect(edges(gh.calls)).toEqual([
            ["101", "900100"],
            ["101", "90054"],
        ]);
    });
});

describe("re-running against a partly wired batch", () => {
    it("counts an edge the platform already carries as present, and does not re-add it", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        writeItem(root, "STORY-2.md", story("2", { blocked_by: "[STORY-1]" }));
        fs.writeFileSync(
            path.join(scratch(root), LEDGER_NAME),
            JSON.stringify({
                "1": { number: "100", db_id: "900100", url: "u", title: "Story 1" },
                "2": { number: "101", db_id: "900101", url: "u", title: "Story 2" },
            }),
        );
        const gh = platform({ alreadyBlockedBy: { "101": ["900100"] } });
        runCreateStory([scratch(root), "--keep-manifest"], recordingIo(root), gh.env);
        expect(edges(gh.calls)).toEqual([]);
    });

    it("records a failed edge rather than pretending it was wired", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        writeItem(root, "STORY-2.md", story("2", { blocked_by: "[STORY-1]" }));
        const io = recordingIo(root);
        const gh = fakePlatform((args: string[]): RunResult | undefined => {
            if (args[0] === "issue" && args[1] === "create") {
                return OK(`https://github.com/${REPO}/issues/${100 + gh.calls.filter((c) => c[1] === "create" && c[0] === "issue").length - 1}\n`);
            }
            if (args[0] === "api" && args[1] === "--method") return FAIL("HTTP 403: Forbidden");
            if (args[0] === "api" && args[3] === ".id") return OK(`900${/issues\/(\d+)/.exec(args[1])?.[1]}\n`);
            return undefined;
        });
        runCreateStory([scratch(root)], io, gh.env);
        expect(io.err.join("\n")).toContain("Error adding blocked_by for #101");
    });
});
