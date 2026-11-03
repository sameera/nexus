/**
 * `/nxs.hld` renders an epic's approved design as a high-level design page and references it from
 * the decision record.
 *
 * The page derives from the record and never replaces it: a choice the record left open is listed
 * for the lead, a decision the design cannot keep is a violation written in full. The page is one
 * Markdown file whose diagrams are Mermaid blocks, so people read it rendered by GitHub and an
 * implementing agent reads the same text. It is shown to the lead before any write, published only
 * through `nexus assets publish`, and referenced from the record by a comment, in either state, so
 * the hashed record body never changes.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components.js";

const ROOT: string = authoredComponentRoot(__dirname);
const SKILL_PATH: string = path.join(ROOT, "skills", "nxs.hld", "SKILL.md");
const SKILL: string = fs.readFileSync(SKILL_PATH, "utf8");

const FRONTMATTER: string = SKILL.slice(0, SKILL.indexOf("\n---", 3));
const BODY: string = SKILL.slice(FRONTMATTER.length);

/** One `# ` or `## ` section's body, up to the next heading of that level or higher, with line wraps folded to spaces. */
function section(heading: string): string {
    const start: number = BODY.indexOf(heading);
    expect(start, `missing section ${heading}`).toBeGreaterThan(-1);
    const level: string = heading.slice(0, heading.indexOf(" ") + 1);
    const rest: string = BODY.slice(start + heading.length);
    const next: RegExpMatchArray | null = rest.match(new RegExp(`\\n#{1,${level.length - 1}} `));
    return (next === null ? rest : rest.slice(0, next.index)).replace(/\s+/g, " ");
}

describe("/nxs.hld ships as a Nexus skill under its own name", () => {
    it("is authored at skills/nxs.hld with a name and a description", () => {
        expect(fs.existsSync(SKILL_PATH)).toBe(true);
        expect(FRONTMATTER).toMatch(/^name: nxs\.hld$/m);
        expect(FRONTMATTER).toMatch(/^description: .+$/m);
    });

    it("is invoked with the epic issue number and nothing else", () => {
        const input: string = section("# User Input");
        expect(input).toMatch(/epic's issue number/);
        expect(input).toMatch(/bare number only/);
        expect(section("# Usage")).toMatch(/\/nxs\.hld 348/);
    });
});

describe("/nxs.hld's scope matches when each write happens", () => {
    const scope: string = section("# Scope");

    it("writes its scratch files under .nexus/tmp before the gate, and everything else after it", () => {
        expect(scope).toMatch(/under the gitignored `\.nexus\/tmp\/`.{0,200}before the preview gate/);
        expect(scope).toMatch(/Outside `\.nexus\/tmp\/` it writes exactly two things, both after the preview gate/);
        expect(scope).not.toMatch(/all after the preview gate/);
    });
});

describe("/nxs.hld resolves the epic through the shared resolver and refuses without a record", () => {
    const resolve: string = section("# Phase 0 — Resolve the epic, the record and the repositories");

    it("materializes the epic with nexus epic-resolve", () => {
        expect(resolve).toMatch(/nexus epic-resolve --epic <N>/);
    });

    it("stops when the epic has no decision record", () => {
        expect(resolve).toMatch(/`record` is `null`, stop/);
        expect(resolve).toMatch(/\/nxs\.decision-record N/);
    });

    it("reads the record's digest through the one digest program", () => {
        expect(resolve).toMatch(/nexus record-digest --issue <RECORD>/);
        expect(resolve).toMatch(/never a shell hash/);
    });

    it("resolves the issues repository before it reads the record from it", () => {
        expect(resolve.indexOf("ISSUES_REPO=")).toBeGreaterThan(-1);
        expect(resolve.indexOf("ISSUES_REPO=")).toBeLessThan(resolve.indexOf("nexus record-digest"));
    });

    it("names every gh call's repository through a guard that stays empty for the current repository", () => {
        expect(resolve).toMatch(/REPO_ARG=""; \[ -n "\$ISSUES_REPO" \] && REPO_ARG="-R \$ISSUES_REPO"/);
        expect(SKILL).not.toMatch(/-R <ISSUES_REPO>/);
        const ghCalls: string[] = SKILL.split("\n").filter((line) => /\bgh (issue|api|label) /.test(line));
        expect(ghCalls.length).toBeGreaterThan(0);
        for (const call of ghCalls) {
            expect(call, call).toMatch(/\$REPO_ARG/);
        }
    });

    it("reads from the resolver only the fields it prints, and resolves no repository it never uses", () => {
        expect(resolve).not.toMatch(/issuesRepo/);
        expect(resolve).not.toMatch(/STORY_REPO/);
    });

    it("treats a record closed as not planned as withdrawn", () => {
        expect(resolve).toMatch(/not planned\* is withdrawn, not approved/);
    });

    it("refuses to be the first design step while the epic still carries the needs-design label", () => {
        expect(resolve).toMatch(/nexus config resolve needs-design-label/);
        expect(resolve).toMatch(/label is on the epic, stop/);
        expect(resolve.indexOf("needs-design-label")).toBeLessThan(resolve.indexOf("nexus record-digest"));
    });
});

describe("/nxs.hld is the step between the decision record and implementation", () => {
    it("says the page refines the record toward implementation and never feeds back into it", () => {
        const intro: string = BODY.slice(0, BODY.indexOf("# User Input")).replace(/\s+/g, " ");
        expect(intro).toMatch(/after the decision record and before implementation/);
        expect(intro).toMatch(/never feeds back into the record/);
        expect(FRONTMATTER).toMatch(/needs-design/);
    });
});

describe("/nxs.hld derives the design from the record and reports what does not hold", () => {
    const design: string = section("# Phase 2 — Derive the design and check it");

    it("ranks the record above the stories, the epic, the concept pages and the code", () => {
        const sources: string = section("# Phase 1 — Read the sources, in order of authority");
        const order: number[] = ["The decision record", "The stories", "The epic", "The concept pages", "The code"].map((s) =>
            sources.indexOf(s),
        );
        for (let i = 1; i < order.length; i += 1) {
            expect(order[i], `source order at ${i}`).toBeGreaterThan(order[i - 1]);
        }
    });

    it("keeps the page at HLD altitude: no SQL, no line numbers, no test catalogue", () => {
        expect(design).toMatch(/Full SQL, DDL or migration scripts/);
        expect(design).toMatch(/Per-call-site tables with line numbers/);
        expect(design).toMatch(/A catalogue of named tests/);
    });

    it("lists a choice the record left open for the lead instead of filing it as a decision", () => {
        expect(design).toMatch(/Choices the record left open/);
        expect(design).toMatch(/never given a D-ID/);
        expect(design).toMatch(/\/nxs\.decision-record --revise/);
    });

    it("requires a full traceability matrix with no blank cell", () => {
        expect(design).toMatch(/no blank cell/);
        expect(design).toMatch(/Achievable with accepted gap/);
        expect(design).toMatch(/\*Kept\* or \*Violated\*/);
    });

    it("writes every violation in full and never hides one as an assumption", () => {
        expect(design).toMatch(/A silent one is a failure of the run/);
        for (const field of ["What is violated", "Why it cannot be avoided", "Impact", "Options", "Recommendation"]) {
            expect(design).toContain(field);
        }
    });
});

describe("/nxs.hld renders one Markdown page whose diagrams are Mermaid blocks", () => {
    const render: string = section("# Phase 3 — Render the page");

    it("writes one Markdown page under the gitignored .nexus/tmp and no second copy", () => {
        expect(render).toMatch(/\.nexus\/tmp\/hld\/<N>-<slug>\.md/);
        expect(render).not.toMatch(/<N>-<slug>\.html/);
        expect(render).toMatch(/Write no second copy/);
    });

    it("draws every diagram as a Mermaid block, by the kind of thing it shows", () => {
        expect(render).toMatch(/\*\*Architecture diagram\*\* \(required\).{0,200}`flowchart`.{0,200}`subgraph`/);
        expect(render).toMatch(/\*\*Flow diagrams\*\* \(one per mechanism\).{0,200}`sequenceDiagram`.{0,300}`flowchart`/);
        expect(render).toMatch(/\*\*Data diagram\*\*.{0,200}`erDiagram`/);
        expect(render).toMatch(/\*\*Delivery diagram\*\* \(required\).{0,200}`gantt`.{0,200}`flowchart`/);
        expect(render).not.toMatch(/inline SVG/);
    });

    it("keeps a legend under each diagram, solid and dotted edges with meaning, and the central components highlighted", () => {
        expect(render).toMatch(/legend line/);
        expect(render).toMatch(/dotted/);
        expect(render).toMatch(/`classDef`/);
        expect(render).toMatch(/No picture decorates/);
    });

    it("writes issue references in the qualified form, because the page lives in the store", () => {
        expect(render).toMatch(/`owner\/repo#N`/);
    });

    it("loads no page-design or diagramming skill, and carries no theme, layout or animation rule", () => {
        expect(render).not.toMatch(/artifact-design|artifact-diagramming/);
        expect(render).not.toMatch(/prefers-color-scheme|prefers-reduced-motion|\*Play\* control/);
    });

    it("checks every Mermaid block parses, the size cap and the store, before the preview", () => {
        expect(render).toMatch(/nexus mermaid-check --file <page> --root "<targetRoot>"/);
        expect(render).toMatch(/nexus assets check --asset <page> --root "<targetRoot>"/);
        expect(render).toMatch(/nexus config resolve asset-size-cap --root "<targetRoot>"/);
    });

    it("fixes an invalid block before the preview, and says so at the preview when the parser is not installed", () => {
        expect(render).toMatch(/`invalid`.{0,300}[Ff]ix/);
        expect(render).toMatch(/`unchecked`.{0,400}preview/);
    });

    it("keeps no external-load grep: a Markdown page loads nothing", () => {
        expect(SKILL.split("\n").some((line) => /^grep .*<page>/.test(line))).toBe(false);
    });
});

describe("/nxs.hld shows the page to the lead before any write outside .nexus/tmp", () => {
    const gate: string = section("# Phase 4 — Preview gate (MANDATORY STOP)");

    it("is a mandatory stop that shows the path and the verdict", () => {
        expect(gate).toMatch(/Before any write outside `\.nexus\/tmp\/`/);
        expect(gate).toMatch(/All acceptance criteria achievable, no decision violated/);
    });

    it("offers publish, revise and keep-local through AskUserQuestion", () => {
        expect(gate).toMatch(/`AskUserQuestion`/);
        expect(gate).toMatch(/\*\*Publish and reference it from the record\*\*/);
        expect(gate).toMatch(/\*\*Revise\*\*/);
        expect(gate).toMatch(/\*\*Keep it local\*\*/);
    });

    it("offers no publish when no asset store is declared", () => {
        expect(gate).toMatch(/`unsupported`.{0,200}leave out \*\*Publish and reference it from the record\*\*/);
    });

    it("names the store and its visibility, and says the reference is the plain link, before the lead approves", () => {
        expect(gate).toMatch(/the store and its visibility/);
        expect(gate).toMatch(/plain link/);
        expect(gate).not.toMatch(/HTML renderer/);
    });

    it("says at the gate when the diagrams were not checked", () => {
        expect(gate).toMatch(/`unchecked`/);
    });
});

describe("/nxs.hld publishes only through nexus assets and references the record by its state", () => {
    const publish: string = section("# Phase 5 — Publish and reference");

    it("publishes through nexus assets publish under the epic's feature", () => {
        expect(publish).toMatch(/nexus assets publish --file <page> --feature "<feature-slug>" --root "<targetRoot>" --json/);
        expect(publish).toMatch(/pins the commit the publish created/);
    });

    it("files the plain link to the pinned blob, which GitHub renders with its diagrams", () => {
        expect(publish).toMatch(/plain link/);
        expect(publish).not.toMatch(/`assets renderer:`/);
    });

    it("never edits the record body, in either state", () => {
        expect(SKILL).not.toMatch(/gh issue edit/);
        expect(SKILL).not.toMatch(/nxs\.hld:start|nxs\.hld:end/);
        expect(publish).toMatch(/gh issue comment <RECORD> \$REPO_ARG --body-file <scratch>\/hld-reference\.md/);
        expect(publish).toMatch(/whether the record is open or closed/);
    });

    it("reads the record again after the gate, before anything is published", () => {
        const reread: number = publish.indexOf("nexus record-digest");
        expect(reread).toBeGreaterThan(-1);
        expect(reread).toBeLessThan(publish.indexOf("nexus assets publish"));
    });

    it("stops before publishing when the record was withdrawn during the run", () => {
        expect(publish).toMatch(/\*\*Withdrawn\*\*.{0,300}stop.{0,200}Nothing is published/);
    });

    it("stops before publishing when the record was reopened for a revision during the run", () => {
        expect(publish).toMatch(/\*\*Reopened\*\*.{0,300}stop/);
        expect(publish).toMatch(/\/nxs\.decision-record --revise/);
    });

    it("stops before publishing when the record body changed during the run", () => {
        expect(publish).toMatch(/\*\*Changed\*\*.{0,300}`digest` differs from `RECORD_DIGEST`.{0,300}stop/);
    });

    it("tells the lead when the record was approved during the run, and goes on", () => {
        expect(publish).toMatch(/\*\*Approved during the run\*\*.{0,300}tell the lead/);
    });

    it("states the digest the page was derived from in the reference", () => {
        const block: string = publish.slice(publish.indexOf("## High-level design"), publish.indexOf("- Choices the record left open"));
        expect(block).toMatch(/at digest `<RECORD_DIGEST>`/);
    });

    it("confirms the record's digest is unchanged after the comment", () => {
        expect(publish).toMatch(/confirm it still equals `RECORD_DIGEST`/);
    });

    it("states in the constraints that the epic and the stories are never edited", () => {
        const constraints: string = section("# Constraints");
        expect(constraints).toMatch(/The epic and its stories are never edited/);
        expect(constraints).toMatch(/The record's body is never edited and the record is never reopened or closed by this skill/);
        expect(constraints).toMatch(/Never link the materialized `epic\.md`/);
    });
});

describe("/nxs.hld loads the shared discipline, reference and asset skills", () => {
    it("names nxs-run-discipline, nxs-issue-reference and nxs-assets", () => {
        expect(BODY).toMatch(/Load the `nxs-run-discipline` skill at the start/);
        expect(BODY).toMatch(/Load the `nxs-issue-reference` skill/);
        expect(BODY).toMatch(/Load the `nxs-assets` skill/);
    });

    it("ends with the run-discipline report layout", () => {
        const report: string = section("# Phase 6 — Report");
        for (const heading of ["Blocked on me", "Changed", "Found"]) {
            expect(report).toContain(heading);
        }
    });
});
