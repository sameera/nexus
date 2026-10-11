/**
 * Epic #889, story #890 — every stage names its finish line and follows one continue rule.
 *
 * The continue rule is a prose rule a model follows, so no spec can watch a run. What these
 * assertions hold are the checkable halves the decision record (#905, D1–D3) names: the rule lives
 * in one shared skill; every stage command except /nxs.close loads it and none restates it; each
 * stage's opening names its finish line and the gates where it stops; the setup interview's closing
 * question is a named gate; and nothing tells a stage to bypass a permission prompt.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { renderCodexComponents } from "./codex-components.js";
import { authoredComponentRoot, listComponentFiles } from "./vendor-components.js";

const ROOT: string = authoredComponentRoot(__dirname);
const SKILL_NAME = "nxs-run-discipline";

function read(rel: string): string {
    return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

/** Prose wraps at any space, so every phrase check reads the text with its whitespace collapsed. */
function flat(text: string): string {
    return text.replace(/\s+/g, " ");
}

const SKILL: string = flat(read(`skills/${SKILL_NAME}/SKILL.md`));

/**
 * Each stage command that loads the skill, with the gates its opening must name. Each gate name is
 * the one the stage's own phases use, so the opening and the phase it points at say the same thing.
 */
const STAGES: Readonly<Record<string, readonly string[]>> = {
    "nxs.setup.md": ["proceed-or-stop question", "stack confirmation", "interview's questions", "review gate"],
    "nxs.discover.md": ["destination", "feature", "resume-or-new", "interview", "surface sketch", "outcome confirmation"],
    "nxs.epic.md": ["resume-or-new", "feature-name confirmation", "right-size gate", "open-questions gate", "approval digest"],
    "nxs.decision-record.md": ["no-record confirmation", "clarification gate", "pre-filing checkpoint", "approval gate"],
    "nxs.analyze.md": ["no approval gate", "asks for the epic", "unapproved record"],
    "nxs.distill.md": ["not-merged waiver", "provenance question", "taxonomy gate", "final checkpoint"],
    "nxs.fix.md": ["range question", "why question"],
    "nxs.intake.md": ["range question", "unexplained decisions", "checkpoint"],
    "nxs.council.md": ["clarifying questions"],
};

const CLOSE = "nxs.close.md";

/** Phrases only the skill may state. A command carrying one is restating the rule. */
const RULE_PROBES: readonly string[] = [
    "summarize without acting",
    "offer to continue",
    "list choices that block nothing",
    "same message as your next action",
    "deleting data this run did not create",
];

/**
 * A command's opening: everything after the frontmatter and before its first phase, step, input or
 * process section. Setup and the council have no Role heading, so their opening paragraphs serve.
 */
function opening(body: string): string {
    const afterFrontmatter: string = body.replace(/^---\n[\s\S]*?\n---\n/, "");
    const end: number = afterFrontmatter.search(/^#{1,2} (User Input|Phase|Step|Core Mandate)\b/m);
    return end === -1 ? afterFrontmatter : afterFrontmatter.slice(0, end);
}

function frontmatterTools(body: string): string[] {
    const line: string | undefined = body.split("\n").find((l) => l.startsWith("tools: "));
    return (line ?? "").replace("tools: ", "").split(",").map((t) => t.trim());
}

describe("the continue rule has one shared home", () => {
    it("is a skill with the frontmatter a skill needs", () => {
        const raw: string = read(`skills/${SKILL_NAME}/SKILL.md`);
        expect(raw).toMatch(new RegExp(`^---\\nname: ${SKILL_NAME}\\n`));
        expect(raw).toMatch(/^description: .+/m);
    });

    it("keeps going between gates and puts a status note with the next action", () => {
        expect(SKILL).toMatch(/between two gates, keep going/i);
        expect(SKILL).toMatch(/same message as your next action/i);
    });

    it("allows a stop in exactly four places, and every stop names what it needs", () => {
        expect(SKILL).toMatch(/at one of your gates/i);
        expect(SKILL).toMatch(/at your finish line/i);
        expect(SKILL).toMatch(/cannot finish without the lead/i);
        expect(SKILL).toMatch(/before a destructive act that no gate or command argument already approved/i);
        expect(SKILL).toMatch(/every stop names what it needs/i);
    });

    it("defines a destructive act as deleting data the run did not create, force-pushing or rewriting history", () => {
        expect(SKILL).toMatch(/deleting data this run did not create/i);
        expect(SKILL).toMatch(/force-pushing/i);
        expect(SKILL).toMatch(/rewriting history/i);
    });

    it("names the three things a stage must not do between gates", () => {
        for (const probe of ["summarize without acting", "offer to continue", "list choices that block nothing"]) {
            expect(SKILL.toLowerCase()).toContain(probe);
        }
    });

    it("keeps every gate where it is, with the same choices", () => {
        expect(SKILL).toMatch(/adds no gate and removes none/i);
        expect(SKILL).toMatch(/same choices/i);
    });

    it("lets a GitHub write that follows an approved gate or an explicit argument go ahead, as today", () => {
        expect(SKILL).toMatch(/follows an approved gate or an explicit command argument goes ahead without a fresh confirmation/i);
    });

    it("leaves permission prompts alone and leaves unattended runs to the stage's own rules", () => {
        expect(SKILL).toMatch(/permission prompts/i);
        expect(SKILL).toMatch(/unattended rules decide what each gate does/i);
        expect(SKILL).toMatch(/adds no stop and removes none/i);
    });
});

describe("every stage command except /nxs.close loads the rule and none restates it", () => {
    it("loads the skill in each stage's opening, before any phase", () => {
        for (const name of Object.keys(STAGES)) {
            expect(opening(read(`commands/${name}`)), name).toMatch(
                new RegExp(`load the \\*\\*\`${SKILL_NAME}\`\\*\\* skill`, "i"),
            );
        }
    });

    it("gives every loading stage the tool that loads a skill", () => {
        for (const name of Object.keys(STAGES)) {
            expect(frontmatterTools(read(`commands/${name}`)), name).toContain("Skill");
        }
    });

    it("covers every stage command", () => {
        const commands: string[] = listComponentFiles(ROOT)
            .filter((rel) => rel.startsWith("commands/"))
            .map((rel) => path.basename(rel));
        expect(new Set(commands)).toEqual(new Set([...Object.keys(STAGES), CLOSE]));
    });

    it("leaves /nxs.close and the advisory agents without it", () => {
        expect(read(`commands/${CLOSE}`)).not.toContain(SKILL_NAME);
        for (const agent of listComponentFiles(ROOT).filter((rel) => rel.startsWith("agents/"))) {
            expect(read(agent), agent).not.toContain(SKILL_NAME);
        }
    });

    it("states the rule in no command or agent", () => {
        const bodies: string[] = listComponentFiles(ROOT).filter(
            (rel) => rel.startsWith("commands/") || rel.startsWith("agents/"),
        );
        for (const rel of bodies) {
            const text: string = flat(read(rel)).toLowerCase();
            for (const probe of RULE_PROBES) {
                expect(text.includes(probe), `${rel} restates "${probe}"`).toBe(false);
            }
        }
    });
});

describe("each stage's opening names its finish line and its gates", () => {
    it("states the finish line and names the gates before any phase begins", () => {
        for (const [name, gates] of Object.entries(STAGES)) {
            const open: string = flat(opening(read(`commands/${name}`)));
            expect(open, name).toMatch(/\*\*Finish line:\*\* \S/);
            const gateLine: string = open.slice(open.indexOf("**Finish line:**"));
            expect(gateLine, name).toMatch(/\*\*Gates:\*\* \S/);
            for (const gate of gates) {
                expect(gateLine.toLowerCase(), `${name} names its ${gate} gate`).toContain(gate);
            }
        }
    });

    it("gives /nxs.close one finish-line sentence and leaves it a relay", () => {
        const open: string = flat(opening(read(`commands/${CLOSE}`)));
        expect(open).toMatch(/\*\*Finish line:\*\* [^\n.]+\./);
        expect(open).not.toMatch(/\*\*Gates:\*\*/);
        expect(read(`commands/${CLOSE}`)).toMatch(/shows? (its|the) output unchanged/i);
    });
});

describe("the setup interview's closing question is a named review gate", () => {
    it("names the review gate and stops there before the file is written", () => {
        const interview: string = flat(read("skills/nxs-setup/SKILL.md"));
        expect(interview).toMatch(/\*\*Review gate/);
        expect(interview).toMatch(/Want me to adjust any section\?/);
        expect(interview).toMatch(/Write the file after the lead (approves|answers)/i);
    });
});

describe("no component tells a stage to bypass a permission prompt", () => {
    it("carries no bypass flag, mode or instruction", () => {
        for (const rel of listComponentFiles(ROOT).filter((r) => r.endsWith(".md"))) {
            const text: string = flat(read(rel));
            expect(text, rel).not.toMatch(/dangerously-skip-permissions|bypassPermissions|--permission-mode/);
            expect(text, rel).not.toMatch(/\b(bypass|disable|turn off|skip|auto-approve)\b[^.\n]{0,40}permission/i);
        }
    });
});

describe("the shared skill works under Codex", () => {
    it("installs as its own skill, and the stages that load it can find it", () => {
        const files: Map<string, Buffer> = renderCodexComponents(ROOT);
        expect(files.get(`skills/${SKILL_NAME}/SKILL.md`)?.toString("utf8")).toMatch(/keep going/i);
        expect(files.get("skills/nxs-analyze/SKILL.md")?.toString("utf8")).toContain(SKILL_NAME);
    });
});
