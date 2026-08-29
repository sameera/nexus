/**
 * Story #369 — pass 1 files each issue and records it before it decorates it.
 *
 * The ledger write ordering is asserted directly: the cases that link a parent read the ledger off
 * disk *from inside* the linking call, because "records it the moment it exists" is the property
 * that keeps a crashed batch from duplicating issues on the next run.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type RunResult } from "../gh";
import { OK, FAIL, checkoutWith, fakePlatform, recordingIo, scratch, story, writeItem } from "./fixtures";
import { LEDGER_NAME, type Ledger } from "./ledger";
import { runCreateStory } from "./run";

const REPO = "acme/tracker";

interface Platform {
    /** Every `issue create` call, as title → the labels and body it carried. */
    createdTitles: string[];
    createdBodies: string[];
    createdLabels: string[][];
}

/**
 * A platform that mints issue numbers in order and answers every probe the filer makes.
 * `overrides` gets first refusal on each call.
 */
function platform(overrides: (args: string[], seen: Platform) => RunResult | undefined = () => undefined) {
    const seen: Platform = { createdTitles: [], createdBodies: [], createdLabels: [] };
    let next = 100;
    const gh = fakePlatform((args: string[]): RunResult | undefined => {
        const override: RunResult | undefined = overrides(args, seen);
        if (override !== undefined) return override;
        if (args[0] === "issue" && args[1] === "create") {
            seen.createdTitles.push(args[args.indexOf("--title") + 1]);
            seen.createdBodies.push(fs.readFileSync(args[args.indexOf("--body-file") + 1], "utf8"));
            seen.createdLabels.push(args.filter((a, i) => args[i - 1] === "--label"));
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

function ledgerAt(root: string): Ledger {
    const file: string = path.join(scratch(root), LEDGER_NAME);
    return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Ledger) : {};
}

function repo(): string {
    return checkoutWith({ classification: "labels", "story-label": "story", "story-repo": REPO, project: "none" });
}

describe("filing one issue per work item", () => {
    it("carries the declared title, the body after the frontmatter, and the resolved labels", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1", { labels: "spike" }, "The issue body.\n"));
        const gh = platform();
        runCreateStory([scratch(root)], recordingIo(root), gh.env);
        expect(gh.seen.createdTitles).toEqual(["Story 1"]);
        expect(gh.seen.createdBodies).toEqual(["The issue body."]);
        expect(gh.seen.createdLabels).toEqual([["story", "spike"]]);
    });

    it("captures both the issue number and the issue's database id", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        runCreateStory([scratch(root), "--keep-manifest"], recordingIo(root), platform().env);
        expect(ledgerAt(root)["1"]).toMatchObject({ number: "100", db_id: "900100" });
    });

    it("warns and uses the filename stem when the work item declares no title", () => {
        const root: string = repo();
        writeItem(root, "STORY-untitled.md", "---\nref: STORY-9\n---\n\nBody\n");
        const io = recordingIo(root);
        const gh = platform();
        runCreateStory([scratch(root)], io, gh.env);
        expect(io.err.join("\n")).toContain("No title in frontmatter");
        expect(gh.seen.createdTitles).toEqual(["STORY-untitled"]);
    });
});

describe("the ledger is written before anything is decorated", () => {
    it("records the ref's number, database id, url and title before the parent is linked", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1", { parent: '"#353"' }));
        let atLinkTime: Ledger = {};
        const gh = platform((args) => {
            if (args[0] === "api" && args[1] === "graphql" && args.join(" ").includes("addSubIssue")) {
                atLinkTime = ledgerAt(root);
            }
            return undefined;
        });
        runCreateStory([scratch(root)], recordingIo(root), gh.env);
        expect(atLinkTime["1"]).toEqual({
            number: "100",
            db_id: "900100",
            url: `https://github.com/${REPO}/issues/100`,
            title: "Story 1",
        });
    });

    it("keeps the entry when the parent link fails, and warns without failing the run", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1", { parent: '"#353"' }));
        const io = recordingIo(root);
        const gh = platform((args) =>
            args.join(" ").includes("addSubIssue") ? FAIL("could not add sub-issue") : undefined,
        );
        runCreateStory([scratch(root), "--keep-manifest"], io, gh.env);
        expect(io.err.join("\n")).toContain("Failed to create sub-issue relationship");
        expect(io.err.join("\n")).toContain("Error creating sub-issue relationship: could not add sub-issue");
        expect(ledgerAt(root)["1"]).toMatchObject({ number: "100" });
    });

    it("tells an unresolvable issue id apart from a link the platform refused", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1", { parent: '"#353"' }));
        const io = recordingIo(root);
        // The node-id lookup for the parent is what fails, so the link never reaches the platform.
        const gh = platform((args) =>
            args[0] === "issue" && args[1] === "view" && args.includes("353") ? FAIL("no such issue") : undefined,
        );
        runCreateStory([scratch(root), "--keep-manifest"], io, gh.env);
        expect(io.err.join("\n")).toContain("Could not resolve issue IDs");
        expect(io.err.join("\n")).not.toContain("Error creating sub-issue relationship: Could not resolve");
    });

    it("sets the issue type in types mode, and warns without failing when it cannot", () => {
        const settings = { classification: "types", "story-type": "Story", "story-repo": REPO, project: "none" };
        const typesPayload: string = JSON.stringify({
            data: { repository: { issueTypes: { nodes: [{ id: "IT_story", name: "Story" }] } } },
        });
        for (const typeSetSucceeds of [true, false]) {
            const root: string = checkoutWith(settings);
            writeItem(root, "STORY-1.md", story("1"));
            const io = recordingIo(root);
            const gh = platform((args) => {
                if (args[0] === "repo" && args[1] === "view") return OK(`${REPO}\n`);
                if (args.join(" ").includes("updateIssue")) return typeSetSucceeds ? OK("{}") : FAIL("nope");
                if (args[0] === "api" && args[1] === "graphql") return OK(typesPayload);
                return undefined;
            });
            expect(runCreateStory([scratch(root)], io, gh.env)).toBe(0);
            expect(io.all()).toContain(typeSetSucceeds ? "Issue type set" : "could not set issue type on #100");
        }
    });
});

describe("re-running a batch the ledger already knows", () => {
    it("creates no second issue for a recorded ref, and reuses the recorded issue", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        writeItem(root, "STORY-2.md", story("2"));
        const first = platform();
        runCreateStory([scratch(root), "--keep-manifest"], recordingIo(root), first.env);
        expect(first.seen.createdTitles).toEqual(["Story 1", "Story 2"]);

        const io = recordingIo(root);
        const again = platform();
        runCreateStory([scratch(root), "--keep-manifest"], io, again.env);
        expect(again.seen.createdTitles).toEqual([]);
        expect(io.out.join("\n")).toContain("already created as #100");
        expect(io.out.join("\n")).toContain("Resuming from manifest (2 issue(s) already created)");
    });

    it("creates only the work items the ledger is missing", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        runCreateStory([scratch(root), "--keep-manifest"], recordingIo(root), platform().env);
        writeItem(root, "STORY-2.md", story("2"));
        const second = platform();
        runCreateStory([scratch(root), "--keep-manifest"], recordingIo(root), second.env);
        expect(second.seen.createdTitles).toEqual(["Story 2"]);
    });

    it("backfills a ledger entry that is missing its database id", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        fs.writeFileSync(
            path.join(scratch(root), LEDGER_NAME),
            JSON.stringify({ "1": { number: "42", url: "u", title: "t" } }),
        );
        runCreateStory([scratch(root), "--keep-manifest"], recordingIo(root), platform().env);
        expect(ledgerAt(root)["1"].db_id).toBe("90042");
    });

    it("warns and treats an unreadable ledger as empty rather than failing", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        fs.writeFileSync(path.join(scratch(root), LEDGER_NAME), "{not json");
        const io = recordingIo(root);
        const gh = platform();
        expect(runCreateStory([scratch(root)], io, gh.env)).toBe(0);
        expect(io.err.join("\n")).toContain("ignoring unreadable manifest");
        expect(gh.seen.createdTitles).toEqual(["Story 1"]);
    });
});

describe("retrying transient platform failures", () => {
    it("retries with exponential backoff up to the retry count, at the given base delay", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        let attempts = 0;
        const io = recordingIo(root);
        const gh = platform((args) => {
            if (args[0] === "issue" && args[1] === "create" && attempts++ < 2) return FAIL("HTTP 502 bad gateway");
            return undefined;
        });
        runCreateStory([scratch(root), "--retries", "3", "--retry-base-delay", "2"], io, gh.env);
        expect(gh.waits).toEqual([2, 4]);
        expect(gh.seen.createdTitles).toEqual(["Story 1"]);
        expect(io.err.join("\n")).toContain("Transient gh failure (attempt 1/4)");
    });

    it("gives up once the retry count is exhausted", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        const io = recordingIo(root);
        const gh = platform((args) =>
            args[0] === "issue" && args[1] === "create" ? FAIL("connection reset") : undefined,
        );
        runCreateStory([scratch(root), "--retries", "1"], io, gh.env);
        expect(gh.waits.length).toBe(1);
        expect(io.err.join("\n")).toContain("Failed to create issue");
    });

    it("never retries a deterministic failure", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", story("1"));
        const io = recordingIo(root);
        const gh = platform((args) =>
            args[0] === "issue" && args[1] === "create" ? FAIL("HTTP 422: Validation Failed") : undefined,
        );
        runCreateStory([scratch(root), "--retries", "5"], io, gh.env);
        expect(gh.waits).toEqual([]);
        expect(io.err.join("\n")).toContain("Error creating issue");
    });
});
