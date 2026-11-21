/**
 * Retiring template seeding (epic #1028, story #1032).
 *
 * The seeding command stays only as a named refusal that exits non-zero (D6). The release template
 * set is declared once and two build-time checks tie the stages to it: every template a shipped
 * stage asks the lookup for ships, and no shipped component reads a release template from the
 * repository's template folder (D7). The Nexus repository deletes its own stale copies of the three
 * stage templates and keeps the folder's other files (D9).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runNexusCli, type CliIo } from "./nexus-cli";
import { listPayloadFiles } from "./release-payload";
import { RELEASE_TEMPLATES, TEMPLATE_PAYLOAD_DIRNAME } from "./template-lookup";
import {
    assertReleaseTemplates,
    REPOSITORY_TEMPLATE_PATH,
    releaseTemplateFindings,
    repositoryTemplateReads,
    unshippedTemplateLookups,
} from "./template-master-reads";
import { authoredComponentRoot, listComponentFiles } from "./vendor-components";

const SRC_DIR: string = import.meta.dirname;
const REPO_ROOT: string = path.resolve(SRC_DIR, "..", "..", "..");
const COMPONENT_ROOT: string = authoredComponentRoot(SRC_DIR);

let tmpDirs: string[] = [];
function makeTmpDir(prefix: string): string {
    const dir: string = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
    tmpDirs.push(dir);
    return dir;
}
afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

interface CapturedIo extends CliIo {
    out: string[];
    err: string[];
}
function makeIo(cwd: string): CapturedIo {
    const out: string[] = [];
    const err: string[] = [];
    return {
        cwd,
        out,
        err,
        stdout: (s: string): void => {
            out.push(s);
        },
        stderr: (s: string): void => {
            err.push(s);
        },
    };
}

/** Every file under `dir`, relative to it; empty when `dir` does not exist. */
function filesUnder(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    return (fs.readdirSync(dir, { recursive: true }) as string[]).sort();
}

/** A component tree holding one command body with the given text. */
function componentTree(body: string): string {
    const dir: string = makeTmpDir("components-");
    fs.mkdirSync(path.join(dir, "commands"), { recursive: true });
    fs.writeFileSync(path.join(dir, "commands", "nxs.demo.md"), body);
    return dir;
}

describe("the retired seeding command (D6)", () => {
    it.each([
        ["no arguments", []],
        ["a target", ["--target", "elsewhere"]],
        ["a master set", ["--masters", "masters"]],
        ["an unknown flag", ["--nonsense"]],
    ])("with %s, writes nothing, says templates come from the installed release, and exits non-zero (G15)", async (_label: string, args: string[]) => {
        const repo: string = makeTmpDir("adopter-repo-");
        fs.mkdirSync(path.join(repo, "masters"));
        fs.writeFileSync(path.join(repo, "masters", RELEASE_TEMPLATES[0]), "a master\n");
        const before: string[] = filesUnder(repo);
        const io: CapturedIo = makeIo(repo);

        const code: number = await runNexusCli(["seed-templates", ...args], io);

        expect(code).not.toBe(0);
        expect(filesUnder(repo)).toEqual(before);
        const said: string = [...io.out, ...io.err].join("\n");
        expect(said).toMatch(/read from the installed release/);
        expect(said).toContain("nexus template-path");
    });

    it("leaves a template folder the repository already holds exactly as it is", async () => {
        const repo: string = makeTmpDir("adopter-repo-");
        const folder: string = path.join(repo, REPOSITORY_TEMPLATE_PATH);
        fs.mkdirSync(folder, { recursive: true });
        fs.writeFileSync(path.join(folder, RELEASE_TEMPLATES[0]), "tuned\n");

        await runNexusCli(["seed-templates"], makeIo(repo));

        expect(filesUnder(folder)).toEqual([RELEASE_TEMPLATES[0]]);
        expect(fs.readFileSync(path.join(folder, RELEASE_TEMPLATES[0]), "utf8")).toBe("tuned\n");
    });

    it("is named as a step or a remedy by no shipped component (G16)", () => {
        for (const rel of listComponentFiles(COMPONENT_ROOT)) {
            const text: string = fs.readFileSync(path.join(COMPONENT_ROOT, ...rel.split("/")), "utf8");
            expect(text, rel).not.toContain("seed-templates");
        }
    });

    it("is described in the README as retired, with templates read from the installed release", () => {
        const readme: string = fs.readFileSync(path.join(REPO_ROOT, "README.md"), "utf8");

        expect(readme).not.toMatch(/^nexus seed-templates/m);
        expect(readme).toContain("nexus template-path");
        expect(readme.replace(/\s+/g, " ")).toMatch(/read from the installed release/);
    });
});

describe("the build-time template checks (D7)", () => {
    it("pass on the shipped component payload, which does ask the lookup for templates", () => {
        expect(releaseTemplateFindings(COMPONENT_ROOT)).toEqual([]);
        expect(() => assertReleaseTemplates(COMPONENT_ROOT)).not.toThrow();
    });

    it("flag a stage that asks the lookup for a template the release does not ship (G17)", () => {
        const root: string = componentTree('TEMPLATE="$(nexus template-path close-record-template.md)"\n');

        const found = unshippedTemplateLookups(root);

        expect(found).toHaveLength(1);
        expect(found[0].file).toBe("commands/nxs.demo.md");
        expect(found[0].excerpt).toContain("close-record-template.md");
        expect(() => assertReleaseTemplates(root)).toThrow(/close-record-template\.md/);
    });

    it("accept a stage that asks for a shipped template", () => {
        const root: string = componentTree(`Run \`nexus template-path ${RELEASE_TEMPLATES[2]}\`.\n`);

        expect(unshippedTemplateLookups(root)).toEqual([]);
    });

    it("flag a stage that reads a release template from the repository's template folder (G11)", () => {
        const root: string = componentTree(`intro\n\nRead \`${REPOSITORY_TEMPLATE_PATH}/${RELEASE_TEMPLATES[0]}\`.\n`);

        const found = repositoryTemplateReads(root);

        expect(found).toHaveLength(1);
        expect(found[0].line).toBe(3);
        expect(() => assertReleaseTemplates(root)).toThrow(/nxs\.demo\.md:3/);
    });

    it("exempt wording that names the repository's folder only to rule it out", () => {
        const root: string = componentTree(`Read the release template, never the copy in \`${REPOSITORY_TEMPLATE_PATH}/\`.\n`);

        expect(repositoryTemplateReads(root)).toEqual([]);
    });

    it("leave the folder's other files, such as the workspace template, alone (G20)", () => {
        const root: string = componentTree(`Read \`${REPOSITORY_TEMPLATE_PATH}/workspace-template.yml\`.\n`);

        expect(repositoryTemplateReads(root)).toEqual([]);
    });
});

describe("what a release ships (G17)", () => {
    it("ships every template in the release template set", () => {
        const staged: string[] = listPayloadFiles(REPO_ROOT).map((f) => f.staged);

        for (const name of RELEASE_TEMPLATES) {
            expect(staged, name).toContain(`${TEMPLATE_PAYLOAD_DIRNAME}/${name}`);
        }
    });

    it("ships no close-record template, whose shape lives in code (#872 D4)", () => {
        const staged: string[] = listPayloadFiles(REPO_ROOT).map((f) => f.staged);

        expect(RELEASE_TEMPLATES).not.toContain("close-record-template.md");
        expect(staged).not.toContain(`${TEMPLATE_PAYLOAD_DIRNAME}/close-record-template.md`);
    });
});

describe("the Nexus repository's own template folder (D9)", () => {
    const folder: string = path.join(REPO_ROOT, REPOSITORY_TEMPLATE_PATH);

    it("holds no copy of the three stage templates (G19)", () => {
        for (const name of RELEASE_TEMPLATES) {
            expect(fs.existsSync(path.join(folder, name)), name).toBe(false);
        }
    });

    it("keeps its other files, the workspace and hub templates among them (G19, G20)", () => {
        expect(fs.existsSync(path.join(folder, "workspace-template.yml"))).toBe(true);
        expect(fs.existsSync(path.join(folder, "hub-template.yml"))).toBe(true);
    });
});

describe("the release note for the retirement (D8)", () => {
    it("says the seeding command is retired and existing template folders are left in place, no longer read, and may be deleted", () => {
        const changelog: string = fs.readFileSync(path.join(REPO_ROOT, "CHANGELOG.md"), "utf8");
        // The note belongs to the release that retired the command, not to whichever release is current.
        const entry: string = changelog.slice(changelog.indexOf("## 0.137.0\n")).split(/\n## \d/)[0].replace(/\s+/g, " ");

        expect(entry).toMatch(/`nexus seed-templates` is retired/);
        expect(entry).toMatch(/left in place/);
        expect(entry).toMatch(/no longer read/);
        expect(entry).toMatch(/may be deleted/);
    });
});
