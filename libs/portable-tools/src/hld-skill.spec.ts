/**
 * `/nxs.hld` renders an epic's approved design as a high-level design page and references it from
 * the decision record.
 *
 * The page derives from the record and never replaces it: a choice the record left open is listed
 * for the lead, a decision the design cannot keep is a violation written in full. The page is one
 * self-contained HTML file with inline SVG diagrams, shown to the lead before any write. It is
 * published only through `nexus assets publish`, and referenced from the record by a comment, in
 * either state, so the hashed record body never changes.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
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

describe("/nxs.hld renders one self-contained page with inline SVG diagrams", () => {
    const render: string = section("# Phase 3 — Render the page");

    it("writes the page under the gitignored .nexus/tmp and no Markdown twin", () => {
        expect(render).toMatch(/\.nexus\/tmp\/hld\/<N>-<slug>\.html/);
        expect(render).toMatch(/Write no Markdown twin/);
    });

    it("allows no external host, no CDN and no diagram library", () => {
        expect(render).toMatch(/No external host of any kind/);
        expect(render).toMatch(/no Mermaid or diagram library/);
    });

    it("renders in both themes", () => {
        expect(render).toMatch(/prefers-color-scheme: dark/);
        expect(render).toMatch(/:root\[data-theme="dark"\]/);
    });

    it("requires an architecture diagram, a flow diagram per mechanism and a delivery diagram, as inline SVG", () => {
        expect(render).toMatch(/\*\*Architecture diagram\*\* \(required\)/);
        expect(render).toMatch(/\*\*Flow diagrams\*\* \(one per mechanism\)/);
        expect(render).toMatch(/\*\*Delivery diagram\*\* \(required\)/);
        expect(render).toMatch(/inline SVG with a `viewBox`, `role="img"` and an `aria-label`/);
    });

    it("animates only with a play control and honours reduced motion", () => {
        expect(render).toMatch(/\*Play\* control and starts still/);
        expect(render).toMatch(/prefers-reduced-motion: reduce/);
    });

    it("checks the store at the epic's target root and the size cap itself, before the preview", () => {
        expect(render).toMatch(/nexus assets check --asset <page> --root "<targetRoot>"/);
        expect(render).toMatch(/nexus config resolve asset-size-cap --root "<targetRoot>"/);
    });
});

describe("/nxs.hld's external-dependency check finds every remote load and nothing else", () => {
    const render: string = section("# Phase 3 — Render the page");
    const command: string | undefined = SKILL.split("\n").find((line) => /^grep .*<page>/.test(line));

    /** Runs the skill's own grep on a page; true when it reports something. */
    function flags(html: string): boolean {
        expect(command, "the external-dependency grep").toBeDefined();
        const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "hld-grep-"));
        const page: string = path.join(dir, "page.html");
        fs.writeFileSync(page, html);
        const result = spawnSync("bash", ["-c", (command as string).replace("<page>", `'${page}'`)]);
        fs.rmSync(dir, { recursive: true, force: true });
        expect(result.status, String(result.stderr)).not.toBe(2);
        return result.status === 0;
    }

    it.each([
        ['a Google Fonts stylesheet', '<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">'],
        ["a CDN script", '<script src="https://cdnjs.cloudflare.com/ajax/libs/x/1.0/x.js"></script>'],
        ["a single-quoted remote image", "<img src='http://example.com/a.png'>"],
        ["a protocol-relative image", '<img src="//cdn.example.com/a.png">'],
        ["a CSS url()", "body { background: url(https://example.com/a.png); }"],
        ["a CSS @import", '@import "https://example.com/a.css";'],
        ["a remote SVG image", '<image href="https://example.com/a.png" />'],
        ["a remote SVG sprite", '<use href="https://example.com/s.svg#icon" />'],
        ["a module imported from a CDN", '<script type="module">import * as d3 from "https://esm.sh/d3";</script>'],
        ["a module imported for its side effects", "<script type=\"module\">import 'https://esm.sh/x';</script>"],
        ["a remote video poster", '<video poster="https://example.com/p.png"></video>'],
        ["a remote later srcset entry", '<img srcset="a.png 1x, https://example.com/b.png 2x">'],
        ["a remote src with spaces around the equals sign", '<img src = "https://example.com/a.png">'],
    ])("flags %s", (_kind, html) => {
        expect(flags(html)).toBe(true);
    });

    it.each([
        ["a hyperlink to an issue", '<a href="https://github.com/acme/app/issues/12">acme/app#12</a>'],
        ["an issue link inside an SVG diagram", '<a xlink:href="https://github.com/acme/app/issues/12"><text>#12</text></a>'],
        ["a local srcset", '<img srcset="data:image/png;base64,AAAA 1x, data:image/png;base64,BBBB 2x">'],
        ["the SVG namespace", '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>'],
        ["a data URI", '<img src="data:image/png;base64,AAAA">'],
        ["an inline script and style", "<script>play()</script><style>:root { --a: #fff; }</style>"],
    ])("passes %s", (_kind, html) => {
        expect(flags(html)).toBe(false);
    });

    it("holds the page rules above the design skills' allowances", () => {
        expect(render).toMatch(/Google Fonts/);
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

    it("names the store, its visibility and the renderer before the lead approves", () => {
        expect(gate).toMatch(/its visibility, and whether an HTML renderer is configured/);
    });
});

describe("/nxs.hld publishes only through nexus assets and references the record by its state", () => {
    const publish: string = section("# Phase 5 — Publish and reference");

    it("publishes through nexus assets publish under the epic's feature", () => {
        expect(publish).toMatch(/nexus assets publish --file <page> --feature "<feature-slug>" --root "<targetRoot>" --json/);
        expect(publish).toMatch(/pins the commit the publish created/);
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
