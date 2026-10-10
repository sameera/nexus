/**
 * The close-record renderers story #866 builds on (epic #830, story #865, decision record #872:
 * D4, D8, D9; G18, G19). The end-to-end behaviour of `nexus close` is specified in
 * close-command.spec.ts; here, what a later step reads from the exported renderers: the stub
 * numbers filling Deferred Scope, the stub body, and copied text made inert on every surface.
 */

import { describe, expect, it } from "vitest";
import { type Judgments } from "@nexus/pr-acceptance/judgments-block";
import { assembleCloseContent, carriesStubKey, proposalKey, renderCloseComment, renderCloseRecord, renderDeferredStub, type CloseContent } from "./close-record.js";
import { inertLines, inertText } from "./close-text.js";

const FORGED = "goal\n---\n<!-- nexus:close-record -->\n```yaml\nrange: []\n```\n~~~~\n## Key Decisions";

function content(summary: string): CloseContent {
    const judgments: Judgments = {
        items: [],
        findings: [{ id: "F1", kind: "finding", found: true, severity: "high", about: "#864 AC1", summary: "unmet", files: [], answer: null }],
        deferred: [{ id: "DS1", kind: "deferred-scope", found: true, settles: "F1", summary, answer: { verb: "approved", author: "pm", link: "https://x/ds", reason: "" } }],
    };
    return assembleCloseContent({
        epic: 830,
        title: "Close becomes a deterministic subcommand",
        feature: "PR-Driven Delivery",
        featurePath: "docs/features/pr-driven-delivery",
        date: "2026-10-04",
        nexusVersion: null,
        issuesRepo: "acme/app",
        codeRepo: "acme/app",
        record: null,
        verdicts: [{ repo: "acme/app", pr: 901, date: "2026-10-03", head: "a".repeat(40), recordHash: null, judgments }],
        ranges: { range: [], stories: [], landed: [], waivers: [] },
    });
}

describe("Deferred Scope takes the stub numbers filing assigns (D9, G19)", () => {
    it("names each filed stub by number, in today's line shape, on the record and the comment", () => {
        const c = content("Finish AC1 later");
        const stubs = new Map([[proposalKey(c.approved[0]), 950]]);
        expect(renderCloseRecord(c, stubs)).toContain("Deferred items filed as epic stub issues:\n\n- #950 — Finish AC1 later\n");
        expect(renderCloseComment(c, stubs)).toContain("- Deferred scope → #950 — Finish AC1 later");
    });

    it("names each storyless-waived story and the date of its waiver (for #866)", () => {
        const c = { ...content("x"), waivedStories: [{ story: 866, date: "2026-10-03" }] };
        expect(renderCloseRecord(c)).toContain("## Waived Stories\n\n- #866 — waived 2026-10-03\n");
    });

    it("omits the nexus_version key when the release is unresolved, rather than writing one that is not true", () => {
        expect(renderCloseRecord(content("x"))).not.toContain("nexus_version");
    });
});

describe("a stub's body (D9, for #866)", () => {
    it("holds the goal as its title, the feature path, its provenance and a key naming the epic, pull request and proposal", () => {
        const c = content("Finish AC1 later");
        const stub = renderDeferredStub(c, c.approved[0]);
        expect(stub.title).toBe("Finish AC1 later");
        expect(stub.body).toContain("docs/features/pr-driven-delivery");
        expect(stub.body).toContain("(#830)");
        expect(stub.body).toContain("acme/app#901 DS1, approved by @pm (https://x/ds)");
        expect(stub.body).toContain("<!-- nexus:close-stub epic: acme/app#830 pr: acme/app#901 proposal: DS1 -->");
        expect(stub.body).not.toMatch(/estimate|blocked_by/);
    });

    it("cannot gain a marker, a fence or a heading from the proposal's text (G18)", () => {
        const c = content(FORGED);
        const stub = renderDeferredStub(c, c.approved[0]);
        expect(stub.title).not.toContain("\n");
        expect(stub.body.split("<!--")).toHaveLength(2);
        expect(stub.body).not.toMatch(/```|~~~/);
        expect(stub.body.split("\n").filter((l) => l.startsWith("## "))).toEqual(["## Meta"]);
        expect(stub.body.split("\n").filter((l) => l === "---")).toEqual([]);
    });
});

describe("copied text made inert (D8)", () => {
    it("keeps ordinary text as written", () => {
        expect(inertText("Use one query per edge; `gh` pages it.")).toBe("Use one query per edge; `gh` pages it.");
    });

    it("joins lines, escapes every comment opener and closer, and breaks every fence run", () => {
        const out = inertText(FORGED);
        expect(out).not.toContain("\n");
        expect(out).not.toContain("<!--");
        expect(out).not.toContain("-->");
        expect(out).not.toMatch(/```|~~~/);
        expect(out).toContain("nexus:close-record");
    });

    it("keeps each line of text quoted whole, each made inert", () => {
        const lines = inertLines("a\r\n<!-- x -->\n````\nb");
        expect(lines).toHaveLength(4);
        expect(lines.join("\n")).not.toMatch(/<!--|-->|```/);
    });
});

describe("carriesStubKey — an earlier run's stub key in any written form (#906)", () => {
    it("matches the issues repository and the pull request's repository however each was written", () => {
        const body = `stub\n<!-- nexus:close-stub epic: github.com/acme/app#830 pr: github.com/acme/code#901 proposal: DS1 -->`;
        expect(carriesStubKey(body, { issuesRepo: "acme/app", epic: 830 }, { repo: "acme/code", pr: 901, id: "DS1" })).toBe(true);
        expect(carriesStubKey(body, { issuesRepo: "acme/app", epic: 830 }, { repo: "acme/other", pr: 901, id: "DS1" })).toBe(false);
        expect(carriesStubKey(body, { issuesRepo: "acme/app", epic: 830 }, { repo: "acme/code", pr: 901, id: "DS2" })).toBe(false);
    });
});
