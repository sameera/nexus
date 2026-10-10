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
import { FAIL, OK, checkoutWith, fakePlatform, recordingIo, scratch, writeItem } from "./fixtures";
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

/** A stub work item asking to sit under `parent`. */
function stub(ref: string, parent: string | null): string {
    const lines: string[] = [`ref: "STUB-${ref}"`, `title: "Goal ${ref}"`, "blocked_by: none", "labels: [needs-refinement]"];
    if (parent !== null) lines.push(`parent: "${parent}"`);
    return `---\n${lines.join("\n")}\n---\n\nGoal ${ref}.\n`;
}

/** What the issues repository holds: issue number → the markers it carries. */
type Tracker = Record<string, { labels: string[]; issueType?: string }>;

const isKindRead = (args: string[]): boolean => args[0] === "api" && args[1] === "graphql" && args.join(" ").includes("labels(first:100)");
const isParentLink = (args: string[]): boolean => args.join(" ").includes("addSubIssue");
const isCreate = (args: string[]): boolean => args[0] === "issue" && args[1] === "create";

/** Answers the filer's read of a parent's markers from `tracker`; an absent issue reads as missing. */
function kindReads(tracker: Tracker): (args: string[]) => RunResult | undefined {
    return (args: string[]): RunResult | undefined => {
        if (!isKindRead(args)) return undefined;
        const number: string = args[args.indexOf("-F") + 1].replace("num=", "");
        const issue = tracker[number];
        if (issue === undefined) return OK(JSON.stringify({ data: { repository: { issue: null } } }));
        return OK(
            JSON.stringify({
                data: {
                    repository: {
                        issue: {
                            issueType: issue.issueType === undefined ? null : { name: issue.issueType },
                            labels: { nodes: issue.labels.map((name) => ({ name })) },
                        },
                    },
                },
            }),
        );
    };
}

const TRACKER: Tracker = {
    "50": { labels: ["initiative"] },
    "51": { labels: ["initiative"] },
    "60": { labels: ["epic"] },
    "61": { labels: ["story"] },
    "62": { labels: ["decision-record"] },
    "63": { labels: [] },
};

const AS_EPIC: string[] = ["--classification-label", "epic", "--classification-type", ""];

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

describe("a stub's parent is an initiative, or the batch is refused (story #708, D8)", () => {
    it("files every stub of a set as a child of the initiative it names (G12)", () => {
        const root: string = repo();
        writeItem(root, "STORY-STUB-01.md", stub("01", "#50"));
        writeItem(root, "STORY-STUB-02.md", stub("02", "#50"));
        const gh = platform(kindReads(TRACKER));
        const io = recordingIo(root);
        expect(runCreateStory([scratch(root), ...AS_EPIC], io, gh.env)).toBe(0);
        expect(gh.seen.createdLabels).toEqual([["epic", "needs-refinement"], ["epic", "needs-refinement"]]);
        expect(gh.calls.filter(isParentLink)).toHaveLength(2);
        expect(io.out.filter((line) => line.includes("Linked as sub-issue of: #50"))).toHaveLength(2);
    });

    it.each([
        ["an epic", "#60"],
        ["a story", "#61"],
        ["a decision record", "#62"],
        ["an unmarked issue", "#63"],
        ["a number that does not resolve", "#999"],
        ["a reference that is not an issue number", "the-initiative"],
    ])("refuses the whole batch, creating nothing, when a stub names %s as its parent (G13)", (_what, parent) => {
        const root: string = repo();
        writeItem(root, "STORY-STUB-01.md", stub("01", "#50"));
        writeItem(root, "STORY-STUB-02.md", stub("02", parent));
        const gh = platform(kindReads(TRACKER));
        const io = recordingIo(root);
        expect(runCreateStory([scratch(root), ...AS_EPIC], io, gh.env)).not.toBe(0);
        const errors: string = io.err.join("\n");
        expect(errors).toContain("STORY-STUB-02.md");
        expect(errors).toContain(parent);
        expect(errors).toContain("Nothing was created.");
        expect(gh.calls.filter(isCreate)).toEqual([]);
        expect(gh.calls.filter(isParentLink)).toEqual([]);
        expect(gh.calls.some((args) => args[0] === "label")).toBe(false);
    });

    it("refuses the batch when the parent's markers cannot be read at all", () => {
        const root: string = repo();
        writeItem(root, "STORY-STUB-01.md", stub("01", "#50"));
        const gh = platform((args) => (isKindRead(args) ? FAIL("HTTP 502") : undefined));
        const io = recordingIo(root);
        expect(runCreateStory([scratch(root), ...AS_EPIC], io, gh.env)).not.toBe(0);
        expect(io.err.join("\n")).toContain("Nothing was created.");
        expect(gh.calls.filter(isCreate)).toEqual([]);
    });

    it("reads each distinct parent once, however many stubs name it", () => {
        const root: string = repo();
        writeItem(root, "STORY-STUB-01.md", stub("01", "#50"));
        writeItem(root, "STORY-STUB-02.md", stub("02", "#50"));
        writeItem(root, "STORY-STUB-03.md", stub("03", "#51"));
        const gh = platform(kindReads(TRACKER));
        expect(runCreateStory([scratch(root), ...AS_EPIC], recordingIo(root), gh.env)).toBe(0);
        expect(gh.calls.filter(isKindRead)).toHaveLength(2);
    });

    it("makes no additional read for a batch in which no stub names a parent (G14)", () => {
        const root: string = repo();
        writeItem(root, "STORY-STUB-01.md", stub("01", null));
        writeItem(root, "STORY-STUB-02.md", stub("02", null));
        const gh = platform(kindReads(TRACKER));
        expect(runCreateStory([scratch(root), ...AS_EPIC], recordingIo(root), gh.env)).toBe(0);
        expect(gh.calls.filter(isKindRead)).toEqual([]);
        expect(gh.calls.filter(isParentLink)).toEqual([]);
    });

    it("makes no read for a story under its epic, which was never part of this rule", () => {
        const root: string = repo();
        writeItem(root, "STORY-1.md", `---\nref: STORY-1\ntitle: "A story"\nparent: "#60"\n---\n\nA story.\n`);
        const gh = platform(kindReads(TRACKER));
        expect(runCreateStory([scratch(root)], recordingIo(root), gh.env)).toBe(0);
        expect(gh.calls.filter(isKindRead)).toEqual([]);
        expect(gh.calls.filter(isParentLink)).toHaveLength(1);
    });

    it("reads the initiative's issue type where the repository classifies by type", () => {
        const root: string = checkoutWith({
            classification: "types",
            "epic-type": "Epic",
            "story-type": "Story",
            "initiative-type": "Initiative",
            "story-repo": REPO,
            project: "none",
        });
        writeItem(root, "STORY-STUB-01.md", stub("01", "#70"));
        const typed: Tracker = { "70": { labels: [], issueType: "Initiative" } };
        const gh = platform(kindReads(typed));
        expect(runCreateStory([scratch(root), "--classification-type", "Epic"], recordingIo(root), gh.env)).toBe(0);
        expect(gh.calls.filter(isKindRead)[0].join(" ")).toContain("issueType");

        const labelled: Tracker = { "70": { labels: ["initiative"] } };
        const refused = platform(kindReads(labelled));
        expect(runCreateStory([scratch(root), "--classification-type", "Epic"], recordingIo(root), refused.env)).not.toBe(0);
        expect(refused.calls.filter(isCreate)).toEqual([]);
    });
});

describe("a parent link that failed is retried when the same command is repeated (story #708, D9)", () => {
    it("attaches the stub on the repeat without filing a second copy of it (G15)", () => {
        const root: string = repo();
        writeItem(root, "STORY-STUB-01.md", stub("01", "#50"));
        let failing = true;
        const gh = platform((args) => kindReads(TRACKER)(args) ?? (isParentLink(args) && failing ? FAIL("HTTP 502") : undefined));
        const first = recordingIo(root);
        runCreateStory([scratch(root), ...AS_EPIC, "--keep-manifest"], first, gh.env);
        expect(first.err.join("\n")).toContain("Failed to create sub-issue relationship");
        expect(gh.calls.filter(isCreate)).toHaveLength(1);

        failing = false;
        const second = recordingIo(root);
        expect(runCreateStory([scratch(root), ...AS_EPIC, "--keep-manifest"], second, gh.env)).toBe(0);
        expect(gh.calls.filter(isCreate)).toHaveLength(1);
        expect(second.out.join("\n")).toContain("Linked as sub-issue of: #50");
    });

    it("counts a link that already exists as attached", () => {
        const root: string = repo();
        writeItem(root, "STORY-STUB-01.md", stub("01", "#50"));
        const gh = platform(kindReads(TRACKER));
        runCreateStory([scratch(root), ...AS_EPIC, "--keep-manifest"], recordingIo(root), gh.env);
        const again = platform((args) => kindReads(TRACKER)(args) ?? (isParentLink(args) ? FAIL("Sub-issue already exists") : undefined));
        const io = recordingIo(root);
        expect(runCreateStory([scratch(root), ...AS_EPIC, "--keep-manifest"], io, again.env)).toBe(0);
        expect(again.calls.filter(isCreate)).toEqual([]);
        expect(io.out.join("\n")).toContain("Linked as sub-issue of: #50");
    });
});
