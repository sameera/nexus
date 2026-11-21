/**
 * The template lookup (epic #1028, story #1029): a stage asks the installed release for a template
 * by name and reads it from where the answer points, never from a copy in the repository.
 *
 * The lookup has two sources and never a third. An ordinary install answers from the travelling
 * copy that ships beside the running executable (D1). A pointer install answers from the checkout
 * the pointers name, so a maintainer's template edit is live on the next request (D2). The request
 * takes only a name and reads no repository state, and every failure is loud: nothing falls back
 * (D3).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runNexusCli, type CliIo } from "./nexus-cli";
import { RELEASE_TEMPLATES, lookupTemplate, type TemplateLookupResult } from "./template-lookup";

let tmpDirs: string[] = [];
function makeTmpDir(prefix: string): string {
    const dir: string = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
    tmpDirs.push(dir);
    return dir;
}

let savedConfigDir: string | undefined;
let configDirTouched = false;
function setConfigDir(value: string): void {
    if (!configDirTouched) {
        savedConfigDir = process.env["CLAUDE_CONFIG_DIR"];
        configDirTouched = true;
    }
    process.env["CLAUDE_CONFIG_DIR"] = value;
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
    if (configDirTouched) {
        if (savedConfigDir === undefined) delete process.env["CLAUDE_CONFIG_DIR"];
        else process.env["CLAUDE_CONFIG_DIR"] = savedConfigDir;
        configDirTouched = false;
    }
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

/** An installed release: a directory holding the executable and the travelling template copy. */
function makeRelease(omit: string[] = []): string {
    const dir: string = makeTmpDir("nexus-release-");
    fs.mkdirSync(path.join(dir, "templates"));
    for (const name of RELEASE_TEMPLATES) {
        if (omit.includes(name)) continue;
        fs.writeFileSync(path.join(dir, "templates", name), `release ${name}\n`);
    }
    return dir;
}

/** An install location holding a copied release: plain files, no pointers. */
function makeCopiedInstall(): string {
    const dir: string = makeTmpDir("install-copy-");
    fs.mkdirSync(path.join(dir, "commands"), { recursive: true });
    fs.writeFileSync(path.join(dir, "commands", "nxs.demo.md"), "copied\n");
    return dir;
}

/** A Nexus checkout with its authored components and its template sources. */
function makeCheckout(omit: string[] = []): string {
    const dir: string = makeTmpDir("nexus-checkout-");
    fs.mkdirSync(path.join(dir, "components", "commands"), { recursive: true });
    fs.writeFileSync(path.join(dir, "components", "commands", "nxs.demo.md"), "authored\n");
    fs.mkdirSync(path.join(dir, "common", "templates"), { recursive: true });
    for (const name of RELEASE_TEMPLATES) {
        if (omit.includes(name)) continue;
        fs.writeFileSync(path.join(dir, "common", "templates", name), `checkout ${name}\n`);
    }
    return dir;
}

/** An install location whose components are pointers into `checkout`. */
function makePointerInstall(checkout: string): string {
    const dir: string = makeTmpDir("install-pointer-");
    if (process.platform === "win32") {
        // Directory junctions exercise a real pointer without Windows file-symlink privileges.
        const skill: string = path.join(checkout, "components", "skills", "nxs-demo");
        fs.mkdirSync(skill, { recursive: true });
        fs.writeFileSync(path.join(skill, "SKILL.md"), "authored\n");
        fs.mkdirSync(path.join(dir, "skills"), { recursive: true });
        fs.symlinkSync(skill, path.join(dir, "skills", "nxs-demo"), "junction");
    } else {
        fs.mkdirSync(path.join(dir, "commands"), { recursive: true });
        fs.symlinkSync(path.join(checkout, "components", "commands", "nxs.demo.md"), path.join(dir, "commands", "nxs.demo.md"));
    }
    return dir;
}

/** A repository that holds its own template folder, with a copy of every release template. */
function makeRepoWithTemplateFolder(): string {
    const dir: string = makeTmpDir("adopter-repo-");
    const folder: string = path.join(dir, ".nexus", "config", "templates");
    fs.mkdirSync(folder, { recursive: true });
    for (const name of RELEASE_TEMPLATES) {
        fs.writeFileSync(path.join(folder, name), `repository copy ${name}\n`);
    }
    return dir;
}

function located(result: TemplateLookupResult): string {
    if (!result.ok) throw new Error(`lookup failed: ${result.message}`);
    return result.path;
}

function isInside(child: string, parent: string): boolean {
    const rel: string = path.relative(parent, child);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

describe("the release template set", () => {
    it("is the three stage templates the release ships", () => {
        expect([...RELEASE_TEMPLATES].sort()).toEqual(
            ["decision-record-template-v1.md", "decision-record-template.md", "standard.template.md"].sort(),
        );
    });
});

describe("asking an ordinary install for a template (D1)", () => {
    it.each([...RELEASE_TEMPLATES])("answers %s with its location inside the installed release (G1)", (name: string) => {
        const release: string = makeRelease();
        const install: string = makeCopiedInstall();

        const where: string = located(lookupTemplate(name, { executableDir: release, env: { CLAUDE_CONFIG_DIR: install } }));

        expect(isInside(where, release)).toBe(true);
        expect(fs.readFileSync(where, "utf8")).toBe(`release ${name}\n`);
    });

    it("answers from the release when the install location holds nothing yet", () => {
        const release: string = makeRelease();
        const empty: string = makeTmpDir("install-empty-");

        const where: string = located(lookupTemplate(RELEASE_TEMPLATES[0], { executableDir: release, env: { CLAUDE_CONFIG_DIR: empty } }));

        expect(isInside(where, release)).toBe(true);
    });

    it("refuses, naming where it looked, when the release's own copy lacks the template (G5)", () => {
        const missing: string = RELEASE_TEMPLATES[1];
        const release: string = makeRelease([missing]);
        const install: string = makeCopiedInstall();

        const result: TemplateLookupResult = lookupTemplate(missing, { executableDir: release, env: { CLAUDE_CONFIG_DIR: install } });

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.message).toContain(missing);
        expect(result.message).toContain(path.join(release, "templates"));
    });
});

describe("asking a pointer install for a template (D2)", () => {
    it("answers with the pointed-at checkout's template (G3)", () => {
        const checkout: string = makeCheckout();
        const release: string = makeRelease();
        const install: string = makePointerInstall(checkout);

        const where: string = located(lookupTemplate(RELEASE_TEMPLATES[0], { executableDir: release, env: { CLAUDE_CONFIG_DIR: install } }));

        expect(isInside(where, checkout)).toBe(true);
        expect(fs.readFileSync(where, "utf8")).toBe(`checkout ${RELEASE_TEMPLATES[0]}\n`);
    });

    it("shows an edit to the checkout's template on the next request, with no rebuild or install (G3)", () => {
        const checkout: string = makeCheckout();
        const install: string = makePointerInstall(checkout);
        const scope = { executableDir: makeRelease(), env: { CLAUDE_CONFIG_DIR: install } };
        const first: string = located(lookupTemplate(RELEASE_TEMPLATES[2], scope));

        fs.writeFileSync(first, "edited by the maintainer\n");

        const second: string = located(lookupTemplate(RELEASE_TEMPLATES[2], scope));
        expect(fs.readFileSync(second, "utf8")).toBe("edited by the maintainer\n");
    });

    it("refuses, naming the checkout, when the pointed-at checkout lacks the template, and does not fall back to the release (G6)", () => {
        const missing: string = RELEASE_TEMPLATES[0];
        const checkout: string = makeCheckout([missing]);
        const install: string = makePointerInstall(checkout);

        const result: TemplateLookupResult = lookupTemplate(missing, { executableDir: makeRelease(), env: { CLAUDE_CONFIG_DIR: install } });

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.message).toContain(checkout);
        expect(result.message).toContain(missing);
    });
});

describe("the lookup ignores the repository and refuses instead of falling back (D3)", () => {
    it("never answers inside the repository, even when it holds its own template folder (G4)", async () => {
        const repo: string = makeRepoWithTemplateFolder();
        setConfigDir(makeCopiedInstall());

        for (const name of RELEASE_TEMPLATES) {
            const io: CapturedIo = makeIo(repo);
            const code: number = await runNexusCli(["template-path", name], io);

            expect(code, io.err.join("\n")).toBe(0);
            const where: string = io.out.join("\n").trim();
            expect(path.isAbsolute(where)).toBe(true);
            expect(isInside(where, repo)).toBe(false);
            expect(fs.readFileSync(where, "utf8")).not.toContain("repository copy");
        }
    });

    it("exits non-zero for a name the release does not ship and names every template it ships (G2)", async () => {
        const io: CapturedIo = makeIo(makeTmpDir("cwd-"));

        const code: number = await runNexusCli(["template-path", "close-record-template.md"], io);

        expect(code).not.toBe(0);
        expect(io.out).toEqual([]);
        for (const name of RELEASE_TEMPLATES) {
            expect(io.err.join("\n")).toContain(name);
        }
    });

    it("exits non-zero naming the cause when the install location cannot be read (G6)", async () => {
        setConfigDir("relative/config");
        const io: CapturedIo = makeIo(makeTmpDir("cwd-"));

        const code: number = await runNexusCli(["template-path", RELEASE_TEMPLATES[0]], io);

        expect(code).not.toBe(0);
        expect(io.out).toEqual([]);
        expect(io.err.join("\n")).toContain("CLAUDE_CONFIG_DIR");
    });

    it("answers from the pointed-at checkout through the command, for a maintainer (G3)", async () => {
        const checkout: string = makeCheckout();
        setConfigDir(makePointerInstall(checkout));
        const io: CapturedIo = makeIo(makeTmpDir("cwd-"));

        const code: number = await runNexusCli(["template-path", RELEASE_TEMPLATES[1]], io);

        expect(code, io.err.join("\n")).toBe(0);
        expect(io.out.join("\n").trim()).toBe(path.join(checkout, "common", "templates", RELEASE_TEMPLATES[1]));
    });

    it("is a usage error without exactly one template name", async () => {
        expect(await runNexusCli(["template-path"], makeIo(makeTmpDir("cwd-")))).toBe(2);
        expect(await runNexusCli(["template-path", RELEASE_TEMPLATES[0], RELEASE_TEMPLATES[1]], makeIo(makeTmpDir("cwd-")))).toBe(2);
    });
});
