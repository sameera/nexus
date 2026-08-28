/**
 * The template-master gate (story #324): no shipped component sends a stage to read a template out
 * of the Nexus repository's own master directory.
 *
 * `common/templates/` is part of the Nexus source checkout and ships in no payload, so a component
 * that reads it — or falls back to it — names a path that cannot resolve for any adopter. Story
 * #323 gave the templates a way to arrive in the project, so the fallback that hid this now has
 * nothing left to do.
 *
 * The gate distinguishes a read from a mention: a passage that names the master directory only to
 * say it is *not* what a stage reads is the shape the decision-record body already uses, and it is
 * not a violation.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { classifyMasterMention, scanTemplateMasterMentions, templateMasterReads, type MasterMention } from "./template-master-reads";
import { PROJECT_TEMPLATE_SEGMENTS, TEMPLATE_MASTER_SEGMENTS } from "./seed-templates";
import { authoredComponentRoot } from "./vendor-components";

const AUTHORED_ROOT: string = authoredComponentRoot(import.meta.dirname);
const MASTER_PATH: string = TEMPLATE_MASTER_SEGMENTS.join("/");
const PROJECT_PATH: string = PROJECT_TEMPLATE_SEGMENTS.join("/");

function closeBody(): string {
    return fs.readFileSync(path.join(AUTHORED_ROOT, "commands", "nxs.close.md"), "utf8");
}

/** The close body's step that reads the template: its numbered item through the blank line after it. */
function templateReadingStep(body: string): string {
    const start: number = body.indexOf("# Phase 4 — Write the close record");
    expect(start, "the close record phase is missing").toBeGreaterThanOrEqual(0);
    const phase: string = body.slice(start);
    const end: number = phase.search(/\n2\. /);
    return end < 0 ? phase : phase.slice(0, end);
}

describe("the close stage reads only the project's own configuration (AC1)", () => {
    it("names no template path outside the project's template directory", () => {
        const named: string[] = [...closeBody().matchAll(/[\w./-]*templates\/[\w.-]+\.md/g)].map((m) => m[0]);

        expect(named.length).toBeGreaterThan(0);
        for (const templatePath of named) {
            expect(templatePath, templatePath).toContain(PROJECT_PATH);
        }
    });
});

describe("a missing template is diagnosable, not a silent reach into a checkout (AC2)", () => {
    it("names the absent template by path and the remedy that places it", () => {
        const step: string = templateReadingStep(closeBody());

        expect(step).toContain(`${PROJECT_PATH}/close-record-template.md`);
        expect(step).toContain("nexus seed-templates");
    });

    it("offers no fallback to read instead", () => {
        const step: string = templateReadingStep(closeBody());

        expect(step).not.toContain("fall back");
        expect(step).not.toContain(MASTER_PATH);
    });
});

describe("the whole component payload reads no master (AC3)", () => {
    it("holds no read or fallback resolving under the master directory", () => {
        const reads: MasterMention[] = templateMasterReads(AUTHORED_ROOT);

        expect(reads.map((r) => `${r.file}:${r.line} — ${r.excerpt}`)).toEqual([]);
    });

    it("still sees the mentions that exist, so an empty result is a verdict and not a blind scan", () => {
        const mentions: MasterMention[] = scanTemplateMasterMentions(AUTHORED_ROOT);

        expect(mentions.length).toBeGreaterThan(0);
        expect(mentions.every((m) => m.excluded)).toBe(true);
    });
});

describe("naming the master to rule it out is not a read (AC3)", () => {
    it("exempts a passage that says the master is not what the stage reads", () => {
        const contrast = `1. Read the seeded project template: \`${PROJECT_PATH}/x.md\` (the\n   project copy, not the \`${MASTER_PATH}/\` master).`;

        expect(classifyMasterMention(contrast, contrast.indexOf(MASTER_PATH)).excluded).toBe(true);
    });

    it.each(["never", "rather than", "instead of", "no longer"])("exempts a passage ruling the master out with '%s'", (marker: string) => {
        const passage = `Read the project copy, ${marker} the \`${MASTER_PATH}/x.md\` master.`;

        expect(classifyMasterMention(passage, passage.indexOf(MASTER_PATH)).excluded).toBe(true);
    });

    it("flags a fallback onto the master", () => {
        const fallback = `1. Read the seeded project template: \`${PROJECT_PATH}/x.md\`. (If the\n   seeded copy is absent, fall back to the toolkit master \`${MASTER_PATH}/x.md\`.)`;

        expect(classifyMasterMention(fallback, fallback.indexOf(MASTER_PATH)).excluded).toBe(false);
    });

    it("flags a plain read of the master", () => {
        const read = `Read the toolkit master \`${MASTER_PATH}/x.md\`.`;

        expect(classifyMasterMention(read, read.indexOf(MASTER_PATH)).excluded).toBe(false);
    });

    it("does not let a negation from an earlier sentence exempt a read", () => {
        const stale = `The seeded copy is not optional. Read \`${MASTER_PATH}/x.md\`.`;

        expect(classifyMasterMention(stale, stale.indexOf(MASTER_PATH)).excluded).toBe(false);
    });

    it("reports where a read sits, so a failure names the body and the line", () => {
        const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "master-scan-"));
        try {
            fs.mkdirSync(path.join(dir, "commands"), { recursive: true });
            fs.writeFileSync(path.join(dir, "commands", "nxs.demo.md"), `intro\n\nfall back to \`${MASTER_PATH}/x.md\`.\n`);

            const reads: MasterMention[] = templateMasterReads(dir);

            expect(reads).toHaveLength(1);
            expect(reads[0].file).toBe("commands/nxs.demo.md");
            expect(reads[0].line).toBe(3);
            expect(reads[0].excerpt).toContain(MASTER_PATH);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
