/**
 * Story #368 — the run establishes what it will publish, and every label it will apply, before it
 * creates anything. Nothing here contacts GitHub.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { OK, FAIL, checkout, checkoutWith, filingPlatform, recordingIo, scratch, story, writeItem } from "./fixtures";
import { runCreateStory } from "./run";

/** The `label create` calls, as name → the flags it was created with. */
function labelCreates(calls: string[][]): Record<string, string[]> {
    const created: Record<string, string[]> = {};
    for (const args of calls) if (args[0] === "label" && args[1] === "create") created[args[2]] = args;
    return created;
}

function issueCreates(calls: string[][]): string[][] {
    return calls.filter((args) => args[0] === "issue" && args[1] === "create");
}

const TYPES_PAYLOAD: string = JSON.stringify({
    data: { repository: { issueTypes: { nodes: [{ id: "IT_story", name: "Story" }] } } },
});

function typesAnswers(args: string[]) {
    if (args[0] === "repo" && args[1] === "view") return OK("acme/tracker\n");
    if (args[0] === "api" && args[1] === "graphql") return OK(TYPES_PAYLOAD);
    return undefined;
}

describe("resolving what this run publishes", () => {
    it("reads the configuration through the shared resolver, a repository value outranking the hub", () => {
        const root: string = checkout({
            ".nexus/config/workspace.yml":
                "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\nmembers: []\n" +
                "github:\n  story-label: hub-story\n",
            ".nexus/config/settings.yml": "github:\n  classification: labels\n  story-label: local-story\n",
        });
        writeItem(root, "STORY-1.md", story("1"));
        const gh = filingPlatform();
        expect(runCreateStory([scratch(root)], recordingIo(root), gh.env)).toBe(0);
        expect(Object.keys(labelCreates(gh.calls))).toContain("local-story");
    });

    it("falls through an empty repository value to the hub's", () => {
        const root: string = checkout({
            ".nexus/config/workspace.yml":
                "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\nmembers: []\n" +
                "github:\n  story-label: hub-story\n",
            ".nexus/config/settings.yml": "github:\n  classification: labels\n  story-label:\n",
        });
        writeItem(root, "STORY-1.md", story("1"));
        const gh = filingPlatform();
        runCreateStory([scratch(root)], recordingIo(root), gh.env);
        expect(Object.keys(labelCreates(gh.calls))).toContain("hub-story");
    });

    it("reports the resolved story repository, and every command it issues targets it", () => {
        const root: string = checkoutWith({ classification: "labels", "story-repo": "acme/tracker" });
        writeItem(root, "STORY-1.md", story("1"));
        const io = recordingIo(root);
        const gh = filingPlatform();
        runCreateStory([scratch(root)], io, gh.env);
        expect(io.out.join("\n")).toContain("Story repo (from config): acme/tracker");
        // The repository probe behind project auto-discovery asks about *this* checkout, so it is
        // deliberately untargeted; everything acting on an issue or a label carries the target.
        const targeted: string[][] = gh.calls.filter(
            (args) => args[0] === "issue" || args[0] === "label" || (args[0] === "api" && args[1] !== "graphql"),
        );
        expect(targeted.length).toBeGreaterThan(0);
        // Named as the repo flag, or as the repository in the api path — never left to the checkout.
        for (const args of targeted) {
            expect(args.join(" ")).toMatch(/-R acme\/tracker|repos\/acme\/tracker\//);
        }
    });

    it("binds every platform call to the resolved target root", () => {
        const root: string = checkoutWith({ classification: "labels" });
        writeItem(root, "STORY-1.md", story("1"));
        const gh = filingPlatform();
        runCreateStory([scratch(root)], recordingIo(root), gh.env);
        expect(gh.roots).toEqual([root]);
    });
});

describe("the canonical classification", () => {
    it("uses the resolved story label when the caller passes no classification", () => {
        const root: string = checkoutWith({ classification: "labels", "story-label": "user-story" });
        writeItem(root, "STORY-1.md", story("1"));
        const gh = filingPlatform();
        runCreateStory([scratch(root)], recordingIo(root), gh.env);
        expect(Object.keys(labelCreates(gh.calls))).toContain("user-story");
    });

    it("lets --classification-label outrank the resolved default", () => {
        const root: string = checkoutWith({ classification: "labels", "story-label": "user-story" });
        writeItem(root, "STORY-1.md", story("1"));
        const gh = filingPlatform();
        runCreateStory([scratch(root), "--classification-label", "epic"], recordingIo(root), gh.env);
        const created: string[] = Object.keys(labelCreates(gh.calls));
        expect(created).toContain("epic");
        expect(created).not.toContain("user-story");
    });

    it("reports the issue type it will apply when the repository is in types mode", () => {
        const root: string = checkoutWith({ classification: "types", "story-type": "Story" });
        writeItem(root, "STORY-1.md", story("1"));
        const io = recordingIo(root);
        const gh = filingPlatform(typesAnswers);
        runCreateStory([scratch(root)], io, gh.env);
        expect(io.out.join("\n")).toContain("Classification: types — issue-type 'Story'");
        expect(Object.keys(labelCreates(gh.calls))).not.toContain("story");
    });

    it("lets --classification-type outrank the resolved story type", () => {
        const root: string = checkoutWith({ classification: "types", "story-type": "Story" });
        writeItem(root, "STORY-1.md", story("1"));
        const io = recordingIo(root);
        runCreateStory([scratch(root), "--classification-type", "Task"], io, filingPlatform(typesAnswers).env);
        expect(io.all()).toContain("'Task'");
    });

    it("warns and files untyped when the configured type does not resolve", () => {
        const root: string = checkoutWith({ classification: "types", "story-type": "Nonexistent" });
        writeItem(root, "STORY-1.md", story("1"));
        const io = recordingIo(root);
        expect(runCreateStory([scratch(root)], io, filingPlatform(typesAnswers).env)).toBe(0);
        expect(io.err.join("\n")).toContain("'Nonexistent' not found");
        expect(io.err.join("\n")).toContain("untyped");
    });

    it("warns and files untyped when types mode configures no type at all", () => {
        const root: string = checkoutWith({ classification: "types" });
        writeItem(root, "STORY-1.md", story("1"));
        const io = recordingIo(root);
        expect(runCreateStory([scratch(root)], io, filingPlatform(typesAnswers).env)).toBe(0);
        expect(io.err.join("\n")).toContain("no issue-type configured");
    });
});

describe("every label exists before the first issue", () => {
    it("upserts the canonical classification and every label declared across the batch", () => {
        const root: string = checkoutWith({ classification: "labels", "story-label": "story" });
        writeItem(root, "STORY-1.md", story("1", { labels: "[needs-design, spike]" }));
        writeItem(root, "STORY-2.md", story("2", { labels: "chore" }));
        const gh = filingPlatform();
        runCreateStory([scratch(root)], recordingIo(root), gh.env);
        expect(Object.keys(labelCreates(gh.calls)).sort()).toEqual(["chore", "needs-design", "spike", "story"]);
    });

    it("creates the story label with its established styling and everything else with the default", () => {
        const root: string = checkoutWith({ classification: "labels", "story-label": "story" });
        writeItem(root, "STORY-1.md", story("1", { labels: "spike" }));
        const gh = filingPlatform();
        runCreateStory([scratch(root)], recordingIo(root), gh.env);
        const created = labelCreates(gh.calls);
        expect(created["story"]).toContain("BFD4F2");
        expect(created["story"].join(" ")).toContain("User story");
        expect(created["spike"]).toContain("EDEDED");
    });

    it("refuses the batch naming every label it can neither create nor find, creating nothing", () => {
        const root: string = checkoutWith({ classification: "labels", "story-label": "story" });
        writeItem(root, "STORY-1.md", story("1", { labels: "[locked-a, locked-b]" }));
        const io = recordingIo(root);
        const gh = filingPlatform((args) => {
            if (args[0] === "label" && args[1] === "create" && args[2].startsWith("locked")) return FAIL("no scope");
            if (args[0] === "label" && args[1] === "list") return OK("story\n");
            return undefined;
        });
        expect(runCreateStory([scratch(root)], io, gh.env)).not.toBe(0);
        expect(io.err.join("\n")).toContain("locked-a");
        expect(io.err.join("\n")).toContain("locked-b");
        expect(issueCreates(gh.calls)).toEqual([]);
    });
});

describe("persisting the decisions this run reached", () => {
    it("seeds the settings block and says the file should be reviewed and committed", () => {
        const root: string = checkout();
        writeItem(root, "STORY-1.md", story("1"));
        const io = recordingIo(root);
        expect(runCreateStory([scratch(root)], io, filingPlatform().env)).toBe(0);
        const settings: string = fs.readFileSync(path.join(root, ".nexus/config/settings.yml"), "utf8");
        expect(settings).toContain("classification: labels");
        expect(io.out.join("\n")).toContain("Seeded github config");
        expect(io.out.join("\n")).toContain("review and commit");
    });

    it("never overwrites a key the repository already declares, and re-reads it on the next run", () => {
        const root: string = checkoutWith({ classification: "legacy-auto", project: "none" });
        writeItem(root, "STORY-1.md", story("1"));
        const before: string = fs.readFileSync(path.join(root, ".nexus/config/settings.yml"), "utf8");
        const io = recordingIo(root);
        runCreateStory([scratch(root)], io, filingPlatform().env);
        expect(fs.readFileSync(path.join(root, ".nexus/config/settings.yml"), "utf8")).toBe(before);
        expect(io.out.join("\n")).not.toContain("Seeded github config");
    });
});

describe("the dry run", () => {
    it("previews each work item with the caller's canonical classification, and creates nothing", () => {
        const root: string = checkoutWith({ classification: "labels", "story-label": "story" });
        writeItem(root, "STORY-1.md", story("1", { labels: "spike", parent: '"#353"', blocked_by: "[STORY-0]" }));
        const io = recordingIo(root);
        const gh = filingPlatform();
        expect(runCreateStory([scratch(root), "--dry-run", "--classification-label", "epic"], io, gh.env)).toBe(0);
        const preview: string = io.out.find((line) => line.includes("STORY-1.md:")) ?? "";
        expect(preview).toContain("ref='STORY-1'");
        expect(preview).toContain("title='Story 1'");
        expect(preview).toContain("['epic', 'spike']");
        expect(preview).toContain("parent='#353'");
        expect(preview).toContain("blocked_by=['STORY-0']");
        expect(gh.calls).toEqual([]);
    });

    it("shows the project a work item declares, and `(auto)` when it declares none", () => {
        const root: string = checkoutWith({ classification: "labels" });
        writeItem(root, "STORY-1.md", story("1", { project: '"acme/4"' }));
        writeItem(root, "STORY-2.md", story("2"));
        const io = recordingIo(root);
        runCreateStory([scratch(root), "--dry-run"], io, filingPlatform().env);
        expect(io.out.find((l) => l.includes("STORY-1.md:"))).toContain("project='acme/4'");
        expect(io.out.find((l) => l.includes("STORY-2.md:"))).toContain("project='(auto)'");
    });
});
