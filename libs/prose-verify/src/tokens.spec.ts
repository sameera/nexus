import { describe, expect, it } from "vitest";
import { extractTracked, properNounVocabulary, type Scan, type TrackedItem } from "./tokens";

function keys(content: string): string[] {
    return extractTracked(content).items.map((item: TrackedItem) => item.key);
}

function keysOf(content: string, kind: string): string[] {
    return extractTracked(content)
        .items.filter((item: TrackedItem) => item.kind === kind)
        .map((item: TrackedItem) => item.key);
}

describe("extractTracked — numeric values", () => {
    it("reads a bare numeral", () => {
        expect(keysOf("The gate runs 3 times.\n", "numeric")).toEqual(["numeric:3"]);
    });

    it("reads a percentage as the value carrying its suffix", () => {
        expect(keysOf("Coverage is 95% of statements.\n", "numeric")).toEqual(["numeric:95%"]);
    });

    it("gives a spelled-out percentage the same key as the numeral form", () => {
        expect(keysOf("Coverage is ninety-five percent.\n", "numeric")).toEqual(["numeric:95%"]);
    });

    it("reads a two-word percentage suffix the same way", () => {
        expect(keysOf("Coverage is ninety-five per cent.\n", "numeric")).toEqual(["numeric:95%"]);
    });

    it("gives a numeral followed by the word percent the percentage key", () => {
        expect(keysOf("Coverage is 95 percent.\n", "numeric")).toEqual(["numeric:95%"]);
    });

    it("gives a spelled-out number the same key as its numeral", () => {
        expect(keysOf("There are forty words.\n", "numeric")).toEqual(keysOf("There are 40 words.\n", "numeric"));
    });

    it("leaves the following unit word out of the key, because an ordinary word is not tracked", () => {
        expect(keysOf("There are 40 words.\n", "numeric")).toEqual(keysOf("There are 40 sentences.\n", "numeric"));
    });

    it("keeps a suffix written against the numeral in the key", () => {
        expect(keysOf("It waits 10ms.\n", "numeric")).toEqual(["numeric:10ms"]);
    });

    it("reads a grouped numeral as its ungrouped value", () => {
        expect(keysOf("It holds 1,000 rows.\n", "numeric")).toEqual(["numeric:1000"]);
    });

    it("reads a decimal value", () => {
        expect(keysOf("It costs 2.5 units.\n", "numeric")).toEqual(["numeric:2.5"]);
    });

    it("multiplies a spelled-out scale word", () => {
        expect(keysOf("It holds two thousand rows.\n", "numeric")).toEqual(["numeric:2000"]);
    });

    it("does not read the article-like words one and zero as numbers", () => {
        expect(keysOf("One can go stale, and zero copies survive.\n", "numeric")).toEqual([]);
    });

    it("does not read the numerals 1 and 0 either, so the exclusion is symmetric", () => {
        expect(keysOf("There is 1 copy and 0 replicas.\n", "numeric")).toEqual([]);
    });

    it("does not read a suffixed one or zero", () => {
        expect(keysOf("It grew 1% in 0ms.\n", "numeric")).toEqual([]);
    });

    it("does not read one written with a decimal part", () => {
        expect(keysOf("The factor is 1.0 exactly.\n", "numeric")).toEqual([]);
    });

    it("still reads values that merely carry the digit one", () => {
        expect(keysOf("It holds 10 rows, 1000 keys and 1.5 units.\n", "numeric")).toEqual([
            "numeric:10",
            "numeric:1000",
            "numeric:1.5",
        ]);
    });
});

describe("extractTracked — modal verbs", () => {
    it("reads each modal in the closed list", () => {
        expect(keysOf("It may run, it should stop, and it must halt.\n", "modal")).toEqual([
            "modal:may",
            "modal:should",
            "modal:must",
        ]);
    });

    it("keeps a negated modal distinct from the bare modal", () => {
        expect(keysOf("The run must not proceed.\n", "modal")).toEqual(["modal:must not"]);
    });

    it("reads a negation the writer separated with an adverb", () => {
        expect(keysOf("The design can simply not have it.\n", "modal")).toEqual(["modal:can not"]);
    });

    it("reads a negation separated by several adverbs", () => {
        expect(keysOf("The gate must almost certainly not fire.\n", "modal")).toEqual(["modal:must not"]);
    });

    it("keeps a modal positive when too many adverbs stand before the not", () => {
        expect(keysOf("The gate must simply really quite certainly not fire.\n", "modal")).toEqual(["modal:must"]);
    });

    it("keeps a modal positive when the nearby not belongs to a later clause", () => {
        expect(keysOf("It can run the check, but the author does not read it.\n", "modal")).toEqual(["modal:can"]);
    });

    it("keeps a modal positive when a noun stands between it and a not", () => {
        expect(keysOf("It can stop runs that are not faithful.\n", "modal")).toEqual(["modal:can"]);
    });

    it("reads a contracted negation as the negated modal", () => {
        expect(keysOf("The run shouldn't proceed.\n", "modal")).toEqual(["modal:should not"]);
    });

    it("reads cannot as the negated can", () => {
        expect(keysOf("The run cannot proceed.\n", "modal")).toEqual(["modal:can not"]);
    });

    it("reads won't as the negated will", () => {
        expect(keysOf("The run won't proceed.\n", "modal")).toEqual(["modal:will not"]);
    });
});

describe("extractTracked — tier-one name-shaped tokens", () => {
    it("reads an inline-code span as one token", () => {
        expect(keysOf("Run `nexus prose-verify` first.\n", "name")).toEqual(["name:nexus prose-verify"]);
    });

    it("reads a quoted contract phrase as one token", () => {
        expect(keysOf('The phrase "needs design" is a label.\n', "name")).toEqual(['name:"needs design"']);
    });

    it("reads a curly-quoted phrase as one token", () => {
        expect(keysOf("The phrase “needs design” is a label.\n", "name")).toEqual([
            "name:“needs design”",
        ]);
    });

    it("reads an issue reference", () => {
        expect(keysOf("Closes #423 today.\n", "name")).toEqual(["name:#423"]);
    });

    it("reads a cross-repository reference", () => {
        expect(keysOf("See sameera/nexus#414 for the epic.\n", "name")).toEqual(["name:sameera/nexus#414"]);
    });

    it("reads a slash-command name", () => {
        expect(keysOf("Then /nxs.epic files the stories.\n", "name")).toEqual(["name:/nxs.epic"]);
    });

    it("reads a flag token", () => {
        expect(keysOf("Pass --before to the verb.\n", "name")).toEqual(["name:--before"]);
    });

    it("reads a path-shaped token", () => {
        expect(keysOf("It lives at libs/prose-verify/src/verify.ts today.\n", "name")).toEqual([
            "name:libs/prose-verify/src/verify.ts",
        ]);
    });

    it("reads an extension-bearing token", () => {
        expect(keysOf("The entry carries epic.md beside it.\n", "name")).toEqual(["name:epic.md"]);
    });

    it("reads a token carrying an underscore", () => {
        expect(keysOf("The blocked_by graph is native.\n", "name")).toEqual(["name:blocked_by"]);
    });

    it("reads a token carrying internal capitalisation", () => {
        expect(keysOf("It calls AskUserQuestion once.\n", "name")).toEqual(["name:AskUserQuestion"]);
    });

    it("reads a token mixing letters and digits", () => {
        expect(keysOf("The story is STORY-94 in the epic.\n", "name")).toEqual(["name:STORY-94"]);
    });

    it("leaves an ordinary lower-case word untracked", () => {
        expect(keys("The gate blocks the run because the record is unapproved.\n")).toEqual([]);
    });

    it("claims a span once, so a path inside a code span is not counted twice", () => {
        expect(keysOf("Read `libs/prose-verify/src/verify.ts` now.\n", "name")).toEqual([
            "name:libs/prose-verify/src/verify.ts",
        ]);
    });

    it("does not read a list marker as a flag token", () => {
        expect(keysOf("- The gate blocks the run.\n", "name")).toEqual([]);
    });
});

describe("extractTracked — structure counted by shape", () => {
    it("keys a heading by its level", () => {
        expect(keysOf("## Phase 4\n", "heading")).toEqual(["heading:h2"]);
    });

    it("keys a bulleted and a numbered item alike", () => {
        expect(keysOf("- first\n2. second\n", "list-item")).toEqual(["list-item:", "list-item:"]);
    });

    it("keys a table row", () => {
        expect(keysOf("| a | b |\n| c | d |\n", "table-row")).toEqual(["table-row:", "table-row:"]);
    });

    it("ignores the prose inside a list item when keying the item itself", () => {
        expect(keysOf("- The gate blocks the run.\n", "list-item")).toEqual(
            keysOf("- The gate blocks the run. It stops there.\n", "list-item"),
        );
    });
});

describe("extractTracked — machine-read regions are another check's territory", () => {
    it("reads nothing out of frontmatter", () => {
        expect(keys("---\nepic: 414\nslug: AskUserQuestion\n---\n")).toEqual([]);
    });

    it("reads nothing out of a fenced block", () => {
        expect(keys("```\nCoverage is 95% and it must halt.\n```\n")).toEqual([]);
    });

    it("reads nothing out of an HTML comment", () => {
        expect(keys("<!-- nexus:meta n: 95% -->\n")).toEqual([]);
    });

    it("reads nothing out of an acceptance-criteria line", () => {
        expect(keys("- [ ] **Given** 3 copies, **when** it runs, **then** it must stop.\n")).toEqual([]);
    });

    it("still reads the prose around a region", () => {
        expect(keysOf("---\na: 1\n---\n\nCoverage is 95%.\n", "numeric")).toEqual(["numeric:95%"]);
    });
});

describe("extractTracked — lines", () => {
    it("carries the 1-indexed line each item stood on", () => {
        const scan: Scan = extractTracked("intro\n\nCoverage is 95%.\n");
        expect(scan.items[0].line).toBe(3);
    });
});

describe("extractTracked — input shapes", () => {
    it("reads a curly apostrophe as a straight one, so a contraction still resolves", () => {
        expect(keysOf("The run shouldn\u2019t proceed.\n", "modal")).toEqual(["modal:should not"]);
    });

    it("reads a body that ends without a trailing newline", () => {
        expect(keysOf("Coverage is 95%.", "numeric")).toEqual(["numeric:95%"]);
    });

    it("finds nothing in an empty body", () => {
        expect(keys("")).toEqual([]);
    });
});

describe("properNounVocabulary — the conservative second tier", () => {
    it("admits a capitalised word that is not sentence-initial", () => {
        expect([...properNounVocabulary(extractTracked("The store is Nexus today.\n"))]).toEqual(["nexus"]);
    });

    it("refuses a sentence-initial capitalised word", () => {
        expect([...properNounVocabulary(extractTracked("Nexus is the store.\n"))]).toEqual([]);
    });

    it("refuses a capitalised English function word", () => {
        expect([...properNounVocabulary(extractTracked("It ran. But The gate held.\n"))]).toEqual([]);
    });

    it("refuses a lower-case word", () => {
        expect([...properNounVocabulary(extractTracked("The store is nexus today.\n"))]).toEqual([]);
    });

    it("collects a capitalised word after a line break as sentence-initial", () => {
        expect([...properNounVocabulary(extractTracked("the store is\nNexus today.\n"))]).toEqual([]);
    });
});

describe("extractTracked — capitalised occurrences are position-blind", () => {
    it("records the same word at the start of a sentence and in the middle", () => {
        const scan: Scan = extractTracked("Nexus holds it. The store is Nexus.\n");
        expect(scan.capitalised.map((word) => word.word)).toEqual(["nexus", "nexus"]);
        expect(scan.capitalised.map((word) => word.sentenceInitial)).toEqual([true, false]);
    });

    it("does not treat a word following an inline-code span as sentence-initial", () => {
        const scan: Scan = extractTracked("run `nexus deploy` Nexus holds it.\n");
        expect(scan.capitalised[0].sentenceInitial).toBe(false);
    });
});
