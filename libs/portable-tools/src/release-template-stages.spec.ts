/**
 * The stages read their templates from the installed release (epic #1028).
 *
 * A stage's instructions are what decide where it reads a template, so they are asserted here: the
 * decision-record stage drafts through the template lookup and no longer checks a repository copy
 * for staleness (D4), and the Codex skill generated from the same instructions asks the same lookup
 * (G23). The release note says what a lead loses when the repository copy stops being read (D8).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { renderCodexComponents } from "./codex-components";
import { listPayloadFiles } from "./release-payload";
import { RELEASE_TEMPLATES, TEMPLATE_PAYLOAD_DIRNAME } from "./template-lookup";
import { authoredComponentRoot } from "./vendor-components";

const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");
const COMPONENT_ROOT: string = authoredComponentRoot(import.meta.dirname);
const REPOSITORY_TEMPLATE_FOLDER = ".nexus/config/templates";

function command(name: string): string {
    return fs.readFileSync(path.join(COMPONENT_ROOT, "commands", name), "utf8");
}

function flat(text: string): string {
    return text.replace(/\s+/g, " ");
}

/** Every template name the body asks the lookup for. */
function lookedUp(body: string): string[] {
    return [...body.matchAll(/nexus template-path ([\w.-]+)/g)].map((match: RegExpMatchArray) => match[1]);
}

/** The newest release entry of the changelog. */
function newestRelease(): { version: string; body: string } {
    const changelog: string = fs.readFileSync(path.join(REPO_ROOT, "CHANGELOG.md"), "utf8");
    const match: RegExpMatchArray | null = changelog.match(/^## (\d+\.\d+\.\d+)\n([\s\S]*?)(?=^## \d)/m);
    if (match === null) throw new Error("CHANGELOG.md has no release entry");
    return { version: match[1], body: match[2] };
}

describe("the decision-record stage drafts from the release templates (story #1030, D4)", () => {
    const stage: string = command("nxs.decision-record.md");

    it("asks the template lookup for the approval-first template (G7)", () => {
        expect(lookedUp(stage)).toContain("decision-record-template.md");
    });

    it("asks the template lookup for the old-format template on a revision of an old-format record (G8)", () => {
        expect(lookedUp(stage)).toContain("decision-record-template-v1.md");
        expect(flat(stage)).toMatch(/approved in the old format/i);
    });

    it("asks only for templates the release ships", () => {
        for (const name of lookedUp(stage)) {
            expect(RELEASE_TEMPLATES, name).toContain(name);
        }
    });

    it("names the repository's template folder nowhere as a place to read from (G11)", () => {
        expect(stage).not.toContain(REPOSITORY_TEMPLATE_FOLDER);
    });

    it("names the seeding command neither as a step nor as a remedy (G11)", () => {
        expect(stage).not.toContain("seed-templates");
    });

    it("no longer checks a template copy for staleness, so a copy without Guarantees cannot stop the draft (G9)", () => {
        expect(flat(stage)).not.toMatch(/verify it keeps the approval-first section order/);
        expect(flat(stage)).not.toMatch(/seeded before the approval-first format/);
        expect(flat(stage)).not.toMatch(/moves? (that|the old) copy aside/);
    });

    it("stops and reports when the lookup exits non-zero or prints nothing, instead of drafting (G10)", () => {
        expect(flat(stage)).toMatch(/exits non-zero or prints nothing, stop/i);
        expect(flat(stage)).toMatch(/draft nothing/i);
    });
});

describe("every stage finds the template it reads", () => {
    it("ships, in the release payload, each template the setup, decision-record and close bodies name", () => {
        const staged: string[] = listPayloadFiles(REPO_ROOT).map((f) => f.staged);
        const named: string[] = [];
        for (const component of ["nxs.setup.md", "nxs.decision-record.md", "nxs.close.md"]) {
            const body: string = command(component);
            named.push(...lookedUp(body));
            for (const match of body.matchAll(/\.nexus\/config\/templates\/([\w.-]+\.md)/g)) {
                named.push(match[1]);
            }
        }

        expect(named.length).toBeGreaterThanOrEqual(3);
        for (const name of new Set(named)) {
            expect(staged, name).toContain(`${TEMPLATE_PAYLOAD_DIRNAME}/${name}`);
        }
    });
});

describe("the Codex decision-record skill asks the same lookup (G23)", () => {
    const skill: string = (renderCodexComponents(COMPONENT_ROOT).get("skills/nxs-decision-record/SKILL.md") ?? "").toString();

    it("drafts through the template lookup, with no Codex-specific template path", () => {
        expect(lookedUp(skill)).toEqual(lookedUp(command("nxs.decision-record.md")));
        expect(skill).not.toContain(REPOSITORY_TEMPLATE_FOLDER);
    });
});

describe("the release note for the stage change (D8, G18)", () => {
    it("is the entry of the current version", () => {
        const pkg: { version: string } = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
        expect(fs.readFileSync(path.join(REPO_ROOT, "CHANGELOG.md"), "utf8")).toContain(`## ${pkg.version}\n`);
    });

    it("says that local edits in a repository's own template copies no longer apply", () => {
        const changelog: string = flat(fs.readFileSync(path.join(REPO_ROOT, "CHANGELOG.md"), "utf8"));
        expect(changelog).toMatch(/\/nxs\.decision-record[^.]*installed release/);
        expect(changelog).toMatch(/local edits[^.]*no longer apply/i);
    });

    it("leaves the newest entry naming the version the package carries", () => {
        const pkg: { version: string } = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
        expect(newestRelease().version).toBe(pkg.version);
    });
});
