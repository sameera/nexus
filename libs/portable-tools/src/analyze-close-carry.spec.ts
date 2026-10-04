/**
 * The pull request's verdict carries what close writes into its record (epic #829, story #862,
 * decision record #871, D5–D7; G24–G29, G40, G41). Building the block — the record decisions by ID,
 * the DS numbering, the open counts an approval changes, the size budget and the hostile-text
 * rendering — is the toolkit's and pinned by its own specs; these cases pin what the stage now says
 * about it: which scope may be proposed, which stubs are key decisions, and what to do with each
 * refusal the publish check can now give.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components";

const COMMANDS = path.join(authoredComponentRoot(import.meta.dirname), "commands");
const ANALYZE: string = fs.readFileSync(path.join(COMMANDS, "nxs.analyze.md"), "utf8");

function between(text: string, from: string, to: string): string {
    const start = text.indexOf(from);
    expect(start).toBeGreaterThan(-1);
    const end = text.indexOf(to, start + from.length);
    expect(end).toBeGreaterThan(start);
    return text.slice(start, end);
}

const CARRY = (): string => between(ANALYZE, "## 2.7 What the verdict carries for close", "# Phase 3");
const ID_STEP = (): string => between(ANALYZE, "## 2.5 Departures from the decision record", "## 2.6 Answers on the pull request");
const PUBLISH = (): string => between(ANALYZE, "## PR mode — publish a review, not a file", "## Asking an epic what it has shipped");
const RESOLVE = (): string => between(ANALYZE, "## Phase 0.8 — Recording answers", "# Phase 1");

describe("the key decisions are the record's decisions by ID plus confirmed stubs (D5, D6; G25)", () => {
    it("hands the record body and the stamped digest to the ID step, which lists the decisions itself", () => {
        expect(ID_STEP()).toContain('--record-body "<scratch>/record-body.md" --record-hash "$RECORD_HASH"');
        expect(CARRY()).toMatch(/\*\*You never list\s+the record's decisions yourself\*\*/);
        expect(CARRY()).toMatch(/by\s+its ID \(by title in an old-format record\), tied to the digest the verdict stamps/);
        expect(CARRY()).toMatch(/Only a record in\s+neither format is carried in full/);
    });

    it("carries each confirmed stub with its choice, reason and refuted alternative, and never a contradicted one", () => {
        expect(ID_STEP()).toMatch(/"choice": "<what was chosen>", "reason": "<why>", "refuted":/);
        expect(CARRY()).toMatch(/\*\*A stub the code contradicts is not a\s+key decision\*\*/);
        expect(ANALYZE).toMatch(/A stub whose choice the diff actually implements is a \*\*confirmed stub\*\*/);
    });

    it("reports the key decisions in the verdict", () => {
        expect(ANALYZE).toMatch(/Key decisions:\s+<record decisions, by ID or title, @ <RECORD_HASH>>/);
    });
});

describe("deferred scope belongs to the item it would settle (D7; G26, G27)", () => {
    it("proposes scope from exactly two places, each on the finding or departure it would settle", () => {
        expect(CARRY()).toMatch(/unmet or partial criterion in a story this pull request covers/);
        expect(CARRY()).toMatch(/record scope the epic's stories, as delivered, leave out/);
        expect(CARRY()).toMatch(/names the `F<n>` or\s+`DV<n>` it would settle/);
        expect(ID_STEP()).toMatch(/"deferred": "<the missing part of the criterion>" \|\s+null/);
    });

    it("never proposes scope a sibling story will deliver", () => {
        expect(CARRY()).toMatch(/\*\*Never propose scope another live story of the epic will deliver\*\*/);
        expect(ID_STEP()).toMatch(/a sibling's scope is never a\s+departure here and never proposed/);
        expect(CARRY()).toContain("`deferred-scope-sibling`");
    });

    it("lets a trusted approval mark a proposal for filing and stop its item blocking, and files nothing on a bare waiver", () => {
        expect(CARRY()).toMatch(/`to-file` — a trusted `approved` answer marked it for filing by close; it names the approver,\s+and the item it settles no longer blocks/);
        expect(CARRY()).toMatch(/`not-filed` — its item was accepted or waived without approving it\. \*\*Nothing is filed\*\*, and\s+the verdict says so/);
        expect(ANALYZE).toMatch(/not filed: <ID> was <accepted\|waived> by @<who> without approving it/);
    });
});

describe("the judgments block is the one place the verdict carries it, and it is safe to copy into (D5; G28, G40, G41)", () => {
    it("names the one parser the publish check and close read, and keeps the verdict block's keys as they are", () => {
        expect(CARRY()).toMatch(/Its one parser is what\s+`nexus verdict-check` runs on the exact bytes to be published, and what close reads/);
        expect(PUBLISH()).toMatch(/never\s+fold its content into the verdict block above, whose keys stay as they are/);
    });

    it("says copied answer text cannot change how either block parses, and a pre-change verdict reads as no judgments", () => {
        expect(CARRY()).toMatch(/it cannot change how either block parses/);
        expect(CARRY()).toMatch(/reads as having no judgments, never as an error, for close and the merge pre-check/);
        expect(PUBLISH()).toMatch(/`marker-repeated` means text copied into the summary/);
    });

    it("drops the results' file lists to fit the platform, never an item's, publishes the bytes the check wrote back, and publishes nothing when still too large (G29)", () => {
        expect(PUBLISH()).toMatch(/the check drops the results' file lists,/);
        expect(PUBLISH()).toMatch(/keep their IDs\s+and answers/);
        expect(PUBLISH()).toMatch(/never drops a departure's or a\s+finding's file list/);
        expect(PUBLISH()).toMatch(/\*\*writes the result back to the body file\*\*: those are the bytes\s+to publish/);
        expect(PUBLISH()).toMatch(/`verdict-too-large`, naming the size: \*\*publish nothing\*\*/);
    });

    it("refuses key decisions tied to another record revision, naming the fix", () => {
        for (const refusal of ["key-decisions-missing", "key-decisions-stale"]) expect(PUBLISH()).toContain(`\`${refusal}\``);
    });
});

describe("an answer-recording run carries them forward (G24)", () => {
    it("passes the record to the ID step and carries proposals and confirmed stubs", () => {
        expect(RESOLVE()).toContain('--record-body "<scratch>/record-body.md" --record-hash "$RECORD_HASH"');
        expect(RESOLVE()).toMatch(/each\s+deferred-scope proposal travels with the item it would settle/);
        expect(RESOLVE()).toMatch(/hand the whole\s+`confirmedStubs` list again/);
    });
});
