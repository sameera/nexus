/**
 * Epic #889, story #891 — advisory agents ask for a stated justification, not reproduced reasoning.
 *
 * The decision record (#905, D5) replaces every request to show work or explain reasoning with a
 * request for a justification of a stated length, and turns the pre-reply self-checks into output
 * requirements. These assertions hold its guarantees: no component asks the model to think
 * carefully, think step by step, show its work or reproduce its reasoning (G13); the PM agent has
 * one line asking for a justification of a stated length (G14); and neither the PM agent nor the
 * council keeps a check to run before replying (G15).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const COMPONENTS: string = path.resolve(__dirname, "..", "..", "..", "components");

function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const abs: string = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(abs) : [abs];
    });
}

function read(rel: string): string {
    return fs.readFileSync(path.join(COMPONENTS, rel), "utf8");
}

/** Prose wraps at any space, so every phrase check reads the text with its whitespace collapsed. */
function flat(text: string): string {
    return text.replace(/\s+/g, " ");
}

/**
 * Requests to think in a stated way or to reproduce reasoning. Each one is bound to a verb or a
 * pronoun that addresses the model, so a record's recorded reasoning ("the decision plus its
 * reasoning") or a heading named Why never matches.
 */
const REASONING_REQUESTS: readonly RegExp[] = [
    /\bthink(ing)? (very |more )?(carefully|hard|harder|deeply)\b/i,
    /\b(think|thinking|reason|reasoning|work|go|proceed)\b[^.\n]{0,20}\bstep[- ]by[- ]step\b/i,
    /\bstep[- ]by[- ]step (reasoning|thinking|thought)/i,
    /\bshow (your|its|their|all|the) (own )?work(ing)?\b/i,
    /\b(explain|show|reproduce|share|outline|describe|narrate|spell out|write out|walk (me |us |the reader )?through|understand) (your|its|their) (own )?(reasoning|thinking|thoughts|thought process|chain of thought)\b/i,
    /\bchain[- ]of[- ]thought\b/i,
    /\bthink (aloud|out loud)\b/i,
];

function reasoningRequests(text: string): string[] {
    const body: string = flat(text);
    return REASONING_REQUESTS.flatMap((pattern) => {
        const hit: RegExpMatchArray | null = body.match(pattern);
        return hit ? [hit[0]] : [];
    });
}

describe("the reasoning-request check", () => {
    it("catches the ways a component could ask for careful thinking or reproduced reasoning", () => {
        for (const sample of [
            "Think carefully before you answer.",
            "Think hard about the trade-offs.",
            "Think step by step.",
            "Reason step-by-step through each story.",
            "- **Show your work**: Explain reasoning",
            "Explain your reasoning for each choice.",
            "Walk through your reasoning before the verdict.",
            "Others should understand your reasoning without a meeting.",
            "Use chain-of-thought.",
        ]) {
            expect(reasoningRequests(sample), sample).not.toEqual([]);
        }
    });

    it("leaves recorded reasoning and justification requests alone", () => {
        for (const sample of [
            "**Why** (one sentence per bullet):",
            "- **Why:** <the reasoning, copied from the ticket's resolution>",
            "the decision **plus its reasoning**, copied from the ticket files",
            "A gist that states a decision without its reasoning becomes an Open Clarification",
            "Justify each recommendation in at most three sentences.",
            "## Critical Thinking Mandate",
            "The closure finding is the one to read carefully.",
        ]) {
            expect(reasoningRequests(sample), sample).toEqual([]);
        }
    });
});

describe("no component asks the model to think carefully or reproduce its reasoning (G13)", () => {
    it("holds for every file under components/", () => {
        const files: string[] = walk(COMPONENTS);
        expect(files.length).toBeGreaterThan(0);
        for (const file of files) {
            const rel: string = path.relative(COMPONENTS, file);
            expect(reasoningRequests(fs.readFileSync(file, "utf8")), rel).toEqual([]);
        }
    });
});

describe("the PM agent asks for a justification of a stated length (G14)", () => {
    const pm: string = read("agents/nxs-pm.md");

    it("has exactly one line asking for a justification of a stated length", () => {
        const lines: string[] = pm
            .split("\n")
            .filter((line) => /justif/i.test(line) && /\b(one|two|three|four|five|\d+) sentences?\b/i.test(line));
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/at most three sentences/i);
    });

    it("heads the quick format's points Why, one sentence per bullet", () => {
        const quick: string = pm.slice(pm.indexOf("### Format A"), pm.indexOf("### Format B"));
        expect(quick).toMatch(/\*\*Why\*\*/);
        expect(quick).toMatch(/one sentence per bullet/i);
        expect(quick).not.toMatch(/\*\*Reasoning\*\*/);
    });

    it("asks for an analysis a reader can act on without a meeting", () => {
        expect(flat(pm)).toMatch(/act on without a meeting/i);
    });
});

describe("the PM agent and the council run no check before replying (G15)", () => {
    const PRE_REPLY: readonly RegExp[] = [
        /self-check/i,
        /before (responding|replying|answering|you (respond|reply|answer))/i,
        /^\s*- \[ \] (Did|Am|Is|Are|Have) I\b/m,
        /\b(Did|Am|Have) I\b/,
    ];

    it("keeps no self-check block in either file", () => {
        for (const rel of ["agents/nxs-pm.md", "commands/nxs.council.md"]) {
            const text: string = read(rel);
            for (const pattern of PRE_REPLY) {
                expect(text, `${rel} ${pattern}`).not.toMatch(pattern);
            }
        }
    });

    it("turns the PM agent's former checks into output requirements", () => {
        const pm: string = flat(read("agents/nxs-pm.md"));
        const section: string = pm.slice(pm.indexOf("# Every Reply States"));
        expect(section).not.toBe(pm);
        expect(section).toMatch(/confidence/i);
        expect(section).toMatch(/do not know/i);
        expect(section).toMatch(/assumption you challenged/i);
        expect(section).toMatch(/next steps/i);
    });

    it("keeps the council's recommendation format, with concrete next steps that name an owner", () => {
        const council: string = read("commands/nxs.council.md");
        const format: string = council.slice(council.indexOf("# Output Format"));
        for (const heading of ["## Summary", "## Perspectives", "## Recommendation", "## Next Steps"]) {
            expect(format).toContain(heading);
        }
        expect(format.slice(format.indexOf("## Next Steps"))).toMatch(/owner/i);
    });
});
