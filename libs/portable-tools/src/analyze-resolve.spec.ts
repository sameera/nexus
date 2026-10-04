/**
 * Analyze records answers without judging unchanged code again (epic #829, story #861, decision
 * record #871, D8; G18–G24). What may be skipped, what changed and what must be judged again are the
 * toolkit's — `nexus verdict-scope` and `nexus verdict-items --scope` — so these cases pin what the
 * stage now says about them: it calls them, follows their mode, and never decides the scope itself.
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

const RESOLVE = (): string => between(ANALYZE, "## Phase 0.8 — Recording answers", "# Phase 1");

describe("the answer-recording run is a flag on the pull-request run", () => {
    it("is invoked as --pr <ref> --resolve, and the usage names it", () => {
        expect(RESOLVE()).toMatch(/`--resolve`/);
        expect(ANALYZE).toMatch(/\/nxs\.analyze --pr 123 --resolve/);
    });

    it("asks the toolkit for its scope, with every stamp the decision compares", () => {
        expect(RESOLVE()).toMatch(/nexus verdict-scope --pr <N> --repo <repoIdentity> --head <analyzedHead> --base <base> --stories <n,\.\.\.> --epic-level <epicLevel>/);
        expect(RESOLVE()).toMatch(/--record-hash "\$RECORD_HASH"/);
        expect(RESOLVE()).toMatch(/never\s+decide the mode yourself/i);
    });
});

describe("it follows the mode the toolkit printed (D8)", () => {
    it("stops and names a full run when there is no verdict with judgments to carry, publishing nothing (G23)", () => {
        expect(RESOLVE()).toMatch(/\*\*`stop`\*\*/);
        expect(RESOLVE()).toMatch(/publish\s+nothing/i);
        expect(RESOLVE()).toMatch(/`\/nxs\.analyze --pr <ref>` without `--resolve`/);
    });

    it("judges the whole pull request again, saying why, when the record or the story set changed or the verdict cannot say what a change affects (G21, G22)", () => {
        expect(RESOLVE()).toMatch(/\*\*`full`\*\*/);
        for (const reason of ["record-revised", "stories-changed", "file-lists-dropped", "earlier-head-unreadable"]) expect(RESOLVE()).toContain(`\`${reason}\``);
        expect(RESOLVE()).toMatch(/say\s+why/);
    });

    it("reads no code on an unchanged head and records the answers through the ID step's scope (G18)", () => {
        expect(RESOLVE()).toMatch(/\*\*`unchanged`\*\*/);
        expect(RESOLVE()).toMatch(/\*\*Read no code\*\*/);
        expect(RESOLVE()).toMatch(/nexus verdict-items --pr <N> --repo <repoIdentity> --scope "<scratch>\/scope\.json" --out "<scratch>\/judgments\.md"/);
    });

    it("on a moved head judges again only what the scope names, checks unlisted files against every guarantee, and carries the rest (G19, G20)", () => {
        expect(RESOLVE()).toMatch(/\*\*`moved`\*\*/);
        expect(RESOLVE()).toMatch(/a trunk merge or a rebase changes nothing by itself/);
        expect(RESOLVE()).toMatch(/`unlisted`[^]*new departures[^]*every guarantee/);
        expect(RESOLVE()).toMatch(/carried forward unchanged/);
        expect(RESOLVE()).toMatch(/--scope "<scratch>\/scope\.json" --draft "<scratch>\/items\.json"/);
    });

    it("publishes a complete verdict through the same publish check, which supersedes the earlier one (G24)", () => {
        expect(RESOLVE()).toMatch(/complete/);
        expect(RESOLVE()).toMatch(/nexus verdict-check/);
        expect(RESOLVE()).toMatch(/newest trusted/);
    });
});

describe("every full run records what a later answer run needs (D8)", () => {
    const IDS = (): string => between(ANALYZE, "## 2.5 Departures from the decision record", "## 2.6");

    it("drafts every criterion, guarantee and metric result with the files it was judged on, and the epic-level state", () => {
        expect(IDS()).toMatch(/"results": \[/);
        expect(IDS()).toMatch(/"kind":\s+"<criterion\|guarantee\|metric>"/);
        expect(IDS()).toMatch(/"epicLevel"/);
        expect(IDS()).toMatch(/An empty list\s+counts as affected by any change/);
    });
});

// close names the answer-recording run (G17): the stop that names `/nxs.analyze --pr <N> --resolve`
// is `nexus close`'s since story #869, pinned in libs/epic-verdicts/src/close-command.spec.ts
// ("stops on open critical or high items ... (G7)"). /nxs.close only relays to it.
