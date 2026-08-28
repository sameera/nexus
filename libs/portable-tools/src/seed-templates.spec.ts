/**
 * Seeding the tool-agnostic templates the pipeline stages read (story #323).
 *
 * The stages read three templates out of the project's own configuration and nothing put them
 * there, so every stage worked only in a repository that happened to be a Nexus checkout. These
 * tests pin the arrival: the masters ship inside the release, a repo-bound verb places them, and a
 * template a project has tuned survives a re-run untouched.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runNexusCli, type CliIo } from "./nexus-cli";
import { listPayloadFiles } from "./release-payload";
import {
    authoredTemplateMasterDir,
    projectTemplateDir,
    seedTemplates,
    SEEDED_TEMPLATES,
    TEMPLATE_PAYLOAD_DIRNAME,
    type SeedTemplatesResult,
} from "./seed-templates";
import { authoredComponentRoot } from "./vendor-components";

const SRC_DIR: string = import.meta.dirname;
const REPO_ROOT: string = path.resolve(SRC_DIR, "..", "..", "..");
const MASTER_DIR: string = authoredTemplateMasterDir(SRC_DIR);

let tmpDirs: string[] = [];
function makeTmpDir(prefix: string): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
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

/** A master directory holding the shipped set, with distinguishable bytes per file. */
function makeMasters(): string {
    const dir: string = makeTmpDir("template-masters-");
    for (const name of SEEDED_TEMPLATES) {
        fs.writeFileSync(path.join(dir, name), `master ${name}\n`);
    }
    return dir;
}

/** A repository that has never been a Nexus checkout: no `.nexus/` at all. */
function makeAdopterRepo(): string {
    return makeTmpDir("adopter-repo-");
}

function componentBody(name: string): string {
    return fs.readFileSync(path.join(authoredComponentRoot(SRC_DIR), "commands", name), "utf8");
}

describe("the templates arrive in a repository that was never a Nexus checkout (AC1)", () => {
    it("places every template the stages read where they read it", () => {
        const repo: string = makeAdopterRepo();

        const result: SeedTemplatesResult = seedTemplates(makeMasters(), repo);

        expect(result.seeded.sort()).toEqual([...SEEDED_TEMPLATES].sort());
        for (const name of SEEDED_TEMPLATES) {
            expect(fs.existsSync(path.join(projectTemplateDir(repo), name)), name).toBe(true);
        }
    });

    it("is what the setup stage tells an adopter to run (AC3)", () => {
        const body: string = componentBody("nxs.setup.md");

        expect(body).toContain("nexus seed-templates");
        expect(body).not.toContain("install/update script");
    });
});

describe("a template the project has tuned survives (AC2)", () => {
    it("keeps an edited template and adds only the absent ones", () => {
        const repo: string = makeAdopterRepo();
        const masters: string = makeMasters();
        const tuned: string = SEEDED_TEMPLATES[0];
        fs.mkdirSync(projectTemplateDir(repo), { recursive: true });
        fs.writeFileSync(path.join(projectTemplateDir(repo), tuned), "tuned by the project\n");

        const result: SeedTemplatesResult = seedTemplates(masters, repo);

        expect(fs.readFileSync(path.join(projectTemplateDir(repo), tuned), "utf8")).toBe("tuned by the project\n");
        expect(result.kept).toEqual([tuned]);
        expect(result.seeded.sort()).toEqual(SEEDED_TEMPLATES.filter((n) => n !== tuned).sort());
    });

    it("changes nothing on a second run", () => {
        const repo: string = makeAdopterRepo();
        const masters: string = makeMasters();
        seedTemplates(masters, repo);

        const second: SeedTemplatesResult = seedTemplates(masters, repo);

        expect(second.seeded).toEqual([]);
        expect(second.kept.sort()).toEqual([...SEEDED_TEMPLATES].sort());
    });
});

describe("the seeded copy is the master's own bytes (AC4)", () => {
    it("is byte-identical to the master it came from on first seed", () => {
        const repo: string = makeAdopterRepo();

        seedTemplates(MASTER_DIR, repo);

        for (const name of SEEDED_TEMPLATES) {
            expect(fs.readFileSync(path.join(projectTemplateDir(repo), name)), name).toEqual(
                fs.readFileSync(path.join(MASTER_DIR, name)),
            );
        }
    });
});

describe("every stage finds the template it reads (AC5)", () => {
    it("seeds each path the setup, decision-record and close bodies name", () => {
        const repo: string = makeAdopterRepo();
        seedTemplates(MASTER_DIR, repo);
        const named: string[] = [];
        for (const component of ["nxs.setup.md", "nxs.decision-record.md", "nxs.close.md"]) {
            for (const match of componentBody(component).matchAll(/\.nexus\/config\/templates\/([\w.-]+\.md)/g)) {
                named.push(match[1]);
            }
        }

        expect(named.length).toBeGreaterThanOrEqual(3);
        for (const name of new Set(named)) {
            expect(fs.existsSync(path.join(projectTemplateDir(repo), name)), name).toBe(true);
        }
    });
});

describe("the masters travel inside the release", () => {
    it("ships every seeded template in the payload", () => {
        const staged: string[] = listPayloadFiles(REPO_ROOT).map((f) => f.staged);

        for (const name of SEEDED_TEMPLATES) {
            expect(staged, name).toContain(`${TEMPLATE_PAYLOAD_DIRNAME}/${name}`);
        }
    });
});

describe("a master set that cannot be found is an error, never a partial seed", () => {
    it("refuses rather than writing some of the set", () => {
        const repo: string = makeAdopterRepo();
        const missing: string = path.join(makeTmpDir("no-masters-"), "absent");

        expect(() => seedTemplates(missing, repo)).toThrow(missing);
        expect(fs.existsSync(projectTemplateDir(repo))).toBe(false);
    });

    it("refuses when the master set is incomplete", () => {
        const repo: string = makeAdopterRepo();
        const masters: string = makeMasters();
        fs.rmSync(path.join(masters, SEEDED_TEMPLATES[1]));

        expect(() => seedTemplates(masters, repo)).toThrow(SEEDED_TEMPLATES[1]);
        expect(fs.existsSync(projectTemplateDir(repo))).toBe(false);
    });
});

describe("nexus seed-templates", () => {
    it("seeds the invoking repository and reports what it placed", async () => {
        const repo: string = makeAdopterRepo();
        const io: CapturedIo = makeIo(repo);

        const code: number = await runNexusCli(["seed-templates", "--masters", makeMasters()], io);

        expect(code).toBe(0);
        for (const name of SEEDED_TEMPLATES) {
            expect(fs.existsSync(path.join(projectTemplateDir(repo), name)), name).toBe(true);
        }
        expect(io.out.join("\n")).toContain(projectTemplateDir(repo));
    });

    it("reports the templates it left alone rather than claiming to have written them", async () => {
        const repo: string = makeAdopterRepo();
        const masters: string = makeMasters();
        await runNexusCli(["seed-templates", "--masters", masters], makeIo(repo));

        const io: CapturedIo = makeIo(repo);
        const code: number = await runNexusCli(["seed-templates", "--masters", masters], io);

        expect(code).toBe(0);
        expect(io.out.join("\n")).toContain("kept");
    });

    it("seeds a repository named by --target rather than the invoking one", async () => {
        const target: string = makeAdopterRepo();
        const io: CapturedIo = makeIo(makeAdopterRepo());

        await runNexusCli(["seed-templates", "--masters", makeMasters(), "--target", target], io);

        expect(fs.existsSync(path.join(projectTemplateDir(target), SEEDED_TEMPLATES[0]))).toBe(true);
        expect(fs.existsSync(path.join(projectTemplateDir(io.cwd), SEEDED_TEMPLATES[0]))).toBe(false);
    });

    it("names the master set it could not find", async () => {
        const io: CapturedIo = makeIo(makeAdopterRepo());
        const missing: string = path.join(makeTmpDir("no-masters-"), "absent");

        const code: number = await runNexusCli(["seed-templates", "--masters", missing], io);

        expect(code).toBe(1);
        expect(io.err.join("\n")).toContain(missing);
    });

    it("rejects an argument it does not know", async () => {
        const io: CapturedIo = makeIo(makeAdopterRepo());

        const code: number = await runNexusCli(["seed-templates", "--nonsense"], io);

        expect(code).toBe(2);
    });

    it.each(["--target", "--masters"])("rejects %s with no value rather than guessing one", async (flag: string) => {
        const io: CapturedIo = makeIo(makeAdopterRepo());

        const code: number = await runNexusCli(["seed-templates", flag], io);

        expect(code).toBe(2);
        expect(fs.existsSync(projectTemplateDir(io.cwd))).toBe(false);
    });
});
