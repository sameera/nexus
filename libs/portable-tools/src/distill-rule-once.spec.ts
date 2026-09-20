/**
 * Epic #713 — state each distillation rule once, at the point it acts.
 *
 * /nxs.distill's mechanism is a command definition, so what a spec can hold it to is the rules
 * its body states. These assertions pin the *single* statement of each rule the epic consolidates,
 * and pin the absence of the second copy. They do not re-test the tooling the body invokes; that
 * tooling has its own specs.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components.js";
import { DERIVE_PROBLEMS } from "./derive-entry-diff.js";

const SRC_DIR: string = __dirname;

const DISTILL: string = fs.readFileSync(
    path.join(authoredComponentRoot(SRC_DIR), "commands", "nxs.distill.md"),
    "utf8",
);

/** The document's top-level sections, keyed by their `# ` heading line. */
function sections(doc: string): ReadonlyMap<string, string> {
    const out = new Map<string, string>();
    let heading = "(frontmatter)";
    let buffer: string[] = [];
    for (const line of doc.split("\n")) {
        if (/^# /.test(line)) {
            out.set(heading, buffer.join("\n"));
            heading = line.trim();
            buffer = [];
            continue;
        }
        buffer.push(line);
    }
    out.set(heading, buffer.join("\n"));
    return out;
}

function skill(name: string): string {
    return fs.readFileSync(path.join(authoredComponentRoot(SRC_DIR), "skills", name, "SKILL.md"), "utf8");
}

const HUB_CONTRACT: string = skill("nxs-distill-hub");
/**
 * Epic #714 moved the fix and intake rows, and the rules keyed to them, into the non-epic
 * entry-kind contract. Every assertion below that pinned one of those rules is rewritten against
 * its new owner rather than dropped: the rule is still stated exactly once.
 */
const NONEPIC_CONTRACT: string = skill("nxs-distill-nonepic-entries");

const SECTIONS: ReadonlyMap<string, string> = sections(DISTILL);
const DERIVE_SECTION: string = [...SECTIONS].find(([h]) => h.startsWith("# Phase 1"))?.[1] ?? "";

describe("one contract for an unreachable range SHA (story #715)", () => {
    it("states the unreachable-revision outcome only where the diff is derived", () => {
        const stating = [...SECTIONS]
            .filter(([, text]) => /unreachable/i.test(text))
            .map(([heading]) => heading);
        expect(stating).toEqual([expect.stringMatching(/^# Phase 1 /)]);
    });

    it("takes exactly one action on a derivation failure: it blocks that entry and drains the rest", () => {
        expect(DERIVE_SECTION).toMatch(/mark the entry\s*\n?\s*\*\*blocked\*\*/);
        expect(DERIVE_SECTION).toMatch(/There is no second diff source/);
    });

    it("carries no introducing-commit fallback for an entry whose recorded range is unreachable", () => {
        expect(DISTILL).not.toContain("--diff-filter=A");
        expect(DISTILL).not.toMatch(/introducing-commit (diff|path)/);
        expect(DISTILL).not.toMatch(/legacy fallback/i);
    });

    it("never asks the operator for a replacement range", () => {
        expect(DISTILL).toMatch(/never ask the user for a replacement range/);
        expect(DISTILL).not.toMatch(/ask the\s*\n?\s*user for a base\/head range/);
    });

    it("names every derivation failure class as a machine-readable token, so a caller never reads prose to tell them apart", () => {
        for (const token of DERIVE_PROBLEMS) {
            expect(DERIVE_SECTION).toContain(`\`${token}\``);
        }
    });

    it("names both operator remedies for an unreachable recorded revision", () => {
        expect(DERIVE_SECTION).toMatch(/update that checkout/);
        expect(DERIVE_SECTION).toMatch(/correct the recorded range stamp/);
    });
});

const INPUT_RESOLUTION: string = [...SECTIONS].find(([h]) => h.startsWith("# Input Resolution"))?.[1] ?? "";

describe("one entry-kind contract for epic, fix and intake (story #716)", () => {
    it("resolves the entry kind once, at discovery, and records it for every later phase to read", () => {
        expect(INPUT_RESOLUTION).toMatch(/Resolve the kind once/);
        expect(INPUT_RESOLUTION).toMatch(/entry-kind/);
        expect(INPUT_RESOLUTION).toMatch(/never re-derive/i);
    });

    it("answers every axis the kinds differ on from one table covering all three", () => {
        const rows = (text: string): string[] => text.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("| `"));
        const header = INPUT_RESOLUTION.split("\n").map((l) => l.trim()).find((l) => l.startsWith("| Kind")) ?? "";
        for (const axis of [/\*why\* verified against/i, /delta vocabulary/i, /validation mode/i, /committed removal target/i]) {
            expect(header).toMatch(axis);
        }
        // The axes are defined once, for all three kinds; the two non-epic rows are the contract's.
        expect(rows(INPUT_RESOLUTION).some((r) => r.startsWith("| `epic`"))).toBe(true);
        for (const kind of ["fix", "intake"]) {
            expect(rows(NONEPIC_CONTRACT).some((r) => r.startsWith(`| \`${kind}\``))).toBe(true);
            expect(rows(INPUT_RESOLUTION).some((r) => r.startsWith(`| \`${kind}\``))).toBe(false);
        }
    });

    it("states what holds for all three kinds once, with no per-kind copy", () => {
        expect(INPUT_RESOLUTION).toMatch(/true of all three kinds/);
        expect(DISTILL).not.toContain("drainable on exactly the same terms");
    });

    it("states the cross-kind non-interference rule once, for all three kinds at once", () => {
        const stating = [...SECTIONS]
            .filter(([, text]) => /no kind drained in the same run alters another kind's drain/.test(text))
            .map(([heading]) => heading);
        expect(stating).toEqual([expect.stringMatching(/^# Input Resolution/)]);
        expect(DISTILL).not.toMatch(/Draining an epic entry is unchanged by this/);
        expect(DISTILL).not.toMatch(/Draining an epic entry or a fix entry is/);
    });

    it("restates no kind's own behaviour in a later phase or in the closing recap", () => {
        expect(DISTILL).not.toContain("A fix entry has no committed removal target at all");
        expect(DISTILL).not.toMatch(/An intake entry \(#483\) gets the full epic vocabulary/);
        expect(DISTILL).not.toMatch(/An intake entry is validated the same unbounded way/);
        expect(DISTILL).not.toMatch(/empty by construction, not by a special case/);
        expect(DISTILL).not.toMatch(/Apply the mode only to a fix entry's pages/);
        expect(DISTILL).not.toMatch(/\n- \*\*Fix entries \(#263\)/);
        expect(DISTILL).not.toMatch(/\n- \*\*Intake entries \(#483, record #504\)/);
        expect(DISTILL).not.toMatch(/\n- \*\*Ephemeral entries \(#173\)/);
    });

    it("keeps each kind's own action steps where the stage acts on them", () => {
        expect(NONEPIC_CONTRACT).toContain("nexus validate-concepts --append-only-log --base HEAD");
        expect(NONEPIC_CONTRACT).toContain("no-existing-page");
        expect(DISTILL).toContain("entry-kind-mismatch");
    });
});

function count(haystack: string, needle: RegExp): number {
    return haystack.match(new RegExp(needle.source, needle.flags.includes("g") ? needle.flags : `${needle.flags}g`))?.length ?? 0;
}

const CHECKPOINT: string = [...SECTIONS].find(([h]) => h.startsWith("# Phase 6"))?.[1] ?? "";
const PR_BODY: string = [...SECTIONS].find(([h]) => h.startsWith("# Phase 7"))?.[1] ?? "";
const REPORT: string = [...SECTIONS].find(([h]) => h.startsWith("# Phase 8"))?.[1] ?? "";

describe("one run summary rendered at three surfaces (story #717)", () => {
    it("writes one run summary to scratch, never staged and never committed", () => {
        expect(CHECKPOINT).toMatch(/run-summary/);
        expect(CHECKPOINT).toMatch(/never\s+committed/);
        expect(CHECKPOINT).toMatch(/not a state file/);
    });

    it("defines each rendered value once, with the omission rule that belongs to it", () => {
        expect(count(DISTILL, /omitted when every drained entry is an epic/)).toBe(1);
        expect(count(DISTILL, /omit the by-kind tally/)).toBe(0);
        expect(count(DISTILL, /every queue entry drained; no drain-SLO breaches/)).toBe(1);
        expect(count(DISTILL, /when Phase 6\.1 found no forced fits/)).toBe(1);
    });

    it("renders the three surfaces as layouts over that one summary", () => {
        for (const surface of [CHECKPOINT, PR_BODY, REPORT]) {
            expect(surface).toMatch(/run summary/i);
        }
    });

    it("names the unqualified zero-case label each surface renders when nothing was skipped or blocked", () => {
        const cell = /\| `skipped` \/ `blocked` \|[^\n]*\n/.exec(DISTILL)?.[0] ?? "";
        expect(cell).toMatch(/`Skipped:`/);
        expect(cell).toMatch(/`Entries skipped:`/);
    });

    it("keeps the three surfaces in the shapes they take today", () => {
        expect(CHECKPOINT).toMatch(/Skipped \(not closed\):/);
        expect(REPORT).toMatch(/Entries skipped \(not closed\):/);
        expect(NONEPIC_CONTRACT).toMatch(/Intake entries — every page created/);
        expect(REPORT).toMatch(/Entries drained:\s*<n>\s*\(<local-ids>\) — <n> epic, <n> fix, <n> intake/);
        expect(PR_BODY).toMatch(/Drained queue entries:[^\n]*<n> epic, <n> fix, <n> intake/);
    });
});

describe("the tool-internal explanations go (story #718)", () => {
    it("describes each delegated step by invocation, consumed output and failure action", () => {
        expect(DERIVE_SECTION).toContain("nexus derive-entry-diff --entry");
        expect(DERIVE_SECTION).toMatch(/\*\*Exit 0:\*\*/);
        expect(DERIVE_SECTION).toMatch(/\*\*Exit 1/);
        expect(DISTILL).toContain("nexus generate-atlas");
        expect(DISTILL).toMatch(/Atlas written: <path> \(<N> concepts\)/);
        expect(DISTILL).toContain("nexus validate-concepts --base HEAD");
        expect(DISTILL).toContain("nexus drift-advisory");
    });

    it("states none of a delegated step's internal ordering, parsing, checking or formatting", () => {
        expect(DISTILL).not.toMatch(/orders a repo's entries by ancestry/);
        expect(DISTILL).not.toMatch(/The first checks frontmatter completeness/);
        expect(DISTILL).not.toMatch(/checked as an anchor sidecar instead/);
        expect(DISTILL).not.toMatch(/reads the unrecognised mode as one more page to check/);
        expect(DISTILL).not.toMatch(/so the generator resolves its own location/);
        expect(DISTILL).not.toMatch(/slug-ordered, integer thresholds/);
        expect(DISTILL).not.toMatch(/Each diff is computed as `git diff <base>\.\.\.<head>`/);
    });

    it("keeps the two validator contracts the stage itself branches on", () => {
        expect(DISTILL).toMatch(/A non-zero exit from any of these blocks the PR/);
        expect(DISTILL).toMatch(/\[ADVISORY\]/);
        expect(NONEPIC_CONTRACT).toContain("nexus --help | grep -q -- --append-only-log");
        expect(NONEPIC_CONTRACT).toMatch(/mode-unavailable → refuse that entry/);
        expect(NONEPIC_CONTRACT).toMatch(/changed outside the entry it gained/);
    });
});

describe("the Constraints recap goes (story #719)", () => {
    it("ends with no section that restates rules stated beside the actions they govern", () => {
        expect([...SECTIONS.keys()].filter((h) => /constraints|recap/i.test(h))).toEqual([]);
    });

    it("leaves no replacement index of rules at the end of the document", () => {
        expect([...SECTIONS.keys()].pop()).toMatch(/^# Usage/);
    });

    it("relocates a whole-run safety property no action point states, still stated exactly once", () => {
        const role = SECTIONS.get("# Role") ?? "";
        expect(role).toMatch(/libs\/origin\/v2\/\.nexus\//);
        expect(count(DISTILL, /libs\/origin\/v2\/\.nexus\//)).toBe(1);
        expect(role).toMatch(/no recipe or template files, no state file, no marker\s+file/);
        expect(count(DISTILL, /no recipe or template files/)).toBe(1);
    });

    it("finds every rule the recap stated at the action it governs", () => {
        expect(INPUT_RESOLUTION).toMatch(/Do NOT search when a path is given/);
        // Epic #714 moved the hub-only half of the drain-SLO report into the hub contract; the rule
        // is still stated exactly once, at the action it governs, in its new owner.
        expect(HUB_CONTRACT).toMatch(/Never scan member checkouts/);
        expect(DISTILL).not.toMatch(/Never scan member checkouts/);
        expect(INPUT_RESOLUTION).toMatch(/--recover <epic-issue>/);
        expect(SECTIONS.get("# Role") ?? "").toMatch(/never\s+write `\.nexus\/concepts\/` on main/i);
        expect(DISTILL).toMatch(/Hashes differ\*\* → \*\*hard-error this entry/);
        expect(DISTILL).toMatch(/§8\.3 hard boundary/);
        expect(DISTILL).toMatch(/Engineer\s+scratch is not a distill input/);
        expect(DISTILL).toMatch(/\*\*append\s+exactly one\*\* Decision Log entry\. Never edit, reorder, or delete prior entries/);
        expect(DISTILL).toMatch(/If absent, domain filing is inert for this drain/);
    });
});
