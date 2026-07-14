import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    checkForbiddenContent,
    type Finding,
    parseArgs,
    parseFrontmatter,
    runCli,
    validatePage,
} from "./validate-concepts";

const REPO_ROOT: string = path.resolve(__dirname, "../../..");

const DEFAULT_FRONTMATTER = `title: "Alpha"
aliases: []
touches: ["beta"]
last_updated_by: "bootstrap"
status: active
verification: verified`;

const DEFAULT_SECTIONS = `## How It Works

Alpha behaves predictably under load.

## Key Invariants

1. Alpha never breaks.

## Integration Points

- [beta](beta.md) — interacts with beta.

## Decision Log

### 2026-07-04 — #1 — Seed
Why it exists.
`;

function page(opts: { frontmatter?: string; h1?: string; lead?: string; sections?: string } = {}): string {
    const frontmatter: string = opts.frontmatter ?? DEFAULT_FRONTMATTER;
    const h1: string = opts.h1 ?? "# Alpha";
    const lead: string = opts.lead ?? "Alpha does the thing well.";
    const sections: string = opts.sections ?? DEFAULT_SECTIONS;
    return `---\n${frontmatter}\n---\n\n${h1}\n\n${lead}\n\n${sections}`;
}

let tmpDirs: string[] = [];

function makeTmpDir(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "validate-concepts-"));
    tmpDirs.push(dir);
    return dir;
}

function makeGitRepo(): string {
    const dir: string = makeTmpDir();
    execFileSync("git", ["init", "-q"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["config", "user.name", "Test"], { cwd: dir, stdio: "ignore" });
    return dir;
}

function commitAll(dir: string, message: string): string {
    execFileSync("git", ["add", "-A"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["commit", "-q", "-m", message], { cwd: dir, stdio: "ignore" });
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
}

function writeFile(dir: string, relPath: string, content: string): string {
    const file: string = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
    return file;
}

function validate(file: string, base: string | null = null, repoRoot: string = path.dirname(file)): Finding[] {
    const findings: Finding[] = [];
    validatePage(file, base, repoRoot, findings);
    return findings;
}

// gitShow (inside validatePage's --base branch) shells out with no explicit cwd, so it relies on
// the calling process's cwd already being inside the git repo under test — exactly how the real
// CLI behaves when invoked from anywhere inside a checkout. Mirror that here.
function validateWithCwd<T>(dir: string, fn: () => T): T {
    const original: string = process.cwd();
    process.chdir(dir);
    try {
        return fn();
    } finally {
        process.chdir(original);
    }
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

describe("parseArgs", () => {
    it("defaults to no base, .nexus/concepts, and no files", () => {
        expect(parseArgs([])).toEqual({ base: null, conceptsDir: ".nexus/concepts", files: [] });
    });

    it("parses --base", () => {
        expect(parseArgs(["--base", "HEAD"]).base).toBe("HEAD");
    });

    it("treats a trailing --base with no value as null", () => {
        expect(parseArgs(["--base"]).base).toBeNull();
    });

    it("parses --concepts-dir", () => {
        expect(parseArgs(["--concepts-dir", "foo/bar"]).conceptsDir).toBe("foo/bar");
    });

    it("collects positional args as files and ignores a bare --", () => {
        const options = parseArgs(["--", "a.md", "b.md"]);
        expect(options.files).toEqual(["a.md", "b.md"]);
    });
});

describe("parseFrontmatter", () => {
    it("returns null when the file doesn't open with ---", () => {
        expect(parseFrontmatter(["# Title", "body"])).toBeNull();
    });

    it("returns null when the block is never terminated", () => {
        expect(parseFrontmatter(["---", "title: x", "# no closing delimiter"])).toBeNull();
    });

    it("parses an inline list field", () => {
        const fm = parseFrontmatter(['---', 'touches: ["a", "b"]', "---", ""]);
        expect(fm?.fields.get("touches")).toEqual(["a", "b"]);
    });

    it("parses a block list field", () => {
        const fm = parseFrontmatter(["---", "aliases:", "  - one", "  - two", "---", ""]);
        expect(fm?.fields.get("aliases")).toEqual(["one", "two"]);
    });

    it("strips quotes from a scalar value", () => {
        const fm = parseFrontmatter(["---", 'title: "Hello World"', "---", ""]);
        expect(fm?.fields.get("title")).toBe("Hello World");
    });
});

describe("checkForbiddenContent (§8.3)", () => {
    function check(text: string): Finding[] {
        const findings: Finding[] = [];
        checkForbiddenContent("f.md", text, findings);
        return findings;
    }

    it("flags a fenced code block", () => {
        const findings = check("```js\nconst x = 1;\n```");
        expect(findings.some((f) => f.message.includes("fenced code block"))).toBe(true);
    });

    it("flags a tilde-fenced code block", () => {
        const findings = check("~~~\ncode\n~~~");
        expect(findings.some((f) => f.message.includes("fenced code block"))).toBe(true);
    });

    it.each([
        ["a leading ./ path", "See ./scripts/build.sh for details."],
        ["a leading ../ path", "Check ../config/settings.yml."],
        ["an absolute path", "The file /etc/hosts is different."],
        ["a path with 2+ slashes", "Lives under a/b/c in the tree."],
        ["a single-slash path with a file extension", "Edit config/settings.yml directly."],
    ])("flags %s", (_label, text) => {
        const findings = check(text);
        expect(findings.some((f) => f.message.includes("file path"))).toBe(true);
    });

    it("flags call-syntax identifiers", () => {
        const findings = check("Please call foo() now.");
        expect(findings.some((f) => f.message.includes('"foo()"'))).toBe(true);
    });

    it("flags snake_case identifiers", () => {
        const findings = check("The snake_case_var holds it.");
        expect(findings.some((f) => f.message.includes("snake_case_var"))).toBe(true);
    });

    it("flags camelCase identifiers", () => {
        const findings = check("The camelCaseVar holds it.");
        expect(findings.some((f) => f.message.includes("camelCaseVar"))).toBe(true);
    });

    it("does NOT flag bare PascalCase (documented gap)", () => {
        const findings = check("FooBarType is a proper noun like GitHub.");
        expect(findings).toEqual([]);
    });
});

describe("validatePage", () => {
    it("reports no findings for a well-formed page", () => {
        const dir = makeTmpDir();
        const file = writeFile(dir, "alpha.md", page());
        expect(validate(file)).toEqual([]);
    });

    it("flags a non-kebab-case slug", () => {
        const dir = makeTmpDir();
        const file = writeFile(dir, "Alpha_Bad.md", page());
        expect(validate(file).some((f) => f.message.includes("is not kebab-case"))).toBe(true);
    });

    it("flags missing/unterminated frontmatter and stops there", () => {
        const dir = makeTmpDir();
        const file = writeFile(dir, "alpha.md", "# Alpha\n\nNo frontmatter here.\n");
        const findings = validate(file);
        expect(findings).toHaveLength(1);
        expect(findings[0].message).toContain("missing or unterminated frontmatter block");
    });

    it("flags a missing title", () => {
        const dir = makeTmpDir();
        const fm = `aliases: []
touches: ["beta"]
last_updated_by: "bootstrap"
status: active
verification: verified`;
        const file = writeFile(dir, "alpha.md", page({ frontmatter: fm }));
        expect(validate(file).some((f) => f.message.includes("missing `title`"))).toBe(true);
    });

    it.each(["aliases", "touches"])("flags a missing list field `%s`", (field) => {
        const dir = makeTmpDir();
        const lines = DEFAULT_FRONTMATTER.split("\n").filter((line) => !line.startsWith(`${field}:`));
        const file = writeFile(dir, "alpha.md", page({ frontmatter: lines.join("\n") }));
        expect(validate(file).some((f) => f.message.includes(`missing list field \`${field}\``))).toBe(true);
    });

    it("flags a bad last_updated_by", () => {
        const dir = makeTmpDir();
        const fm = DEFAULT_FRONTMATTER.replace('last_updated_by: "bootstrap"', 'last_updated_by: "randomguy"');
        const file = writeFile(dir, "alpha.md", page({ frontmatter: fm }));
        expect(validate(file).some((f) => f.message.includes("`last_updated_by` must be"))).toBe(true);
    });

    it("flags a bad status", () => {
        const dir = makeTmpDir();
        const fm = DEFAULT_FRONTMATTER.replace("status: active", "status: wip");
        const file = writeFile(dir, "alpha.md", page({ frontmatter: fm }));
        expect(validate(file).some((f) => f.message.includes("`status` must be"))).toBe(true);
    });

    it("flags a bad verification value", () => {
        const dir = makeTmpDir();
        const fm = DEFAULT_FRONTMATTER.replace("verification: verified", "verification: maybe");
        const file = writeFile(dir, "alpha.md", page({ frontmatter: fm }));
        expect(validate(file).some((f) => f.message.includes("`verification` must be"))).toBe(true);
    });

    it.each(["slug", "id"])("flags a derived `%s` field in frontmatter", (field) => {
        const dir = makeTmpDir();
        const fm = `${DEFAULT_FRONTMATTER}\n${field}: alpha`;
        const file = writeFile(dir, "alpha.md", page({ frontmatter: fm }));
        expect(validate(file).some((f) => f.message.includes(`\`${field}\` is derived state`))).toBe(true);
    });

    it("flags a missing H1", () => {
        const dir = makeTmpDir();
        const file = writeFile(dir, "alpha.md", page({ h1: "" }));
        expect(validate(file).some((f) => f.message.includes("missing H1"))).toBe(true);
    });

    it("flags an H1 that doesn't mirror the title", () => {
        const dir = makeTmpDir();
        const file = writeFile(dir, "alpha.md", page({ h1: "# Beta" }));
        expect(validate(file).some((f) => f.message.includes("does not mirror title"))).toBe(true);
    });

    it("flags a missing Summary lead", () => {
        const dir = makeTmpDir();
        const file = writeFile(dir, "alpha.md", page({ lead: "" }));
        expect(validate(file).some((f) => f.message.includes("no Summary lead"))).toBe(true);
    });

    it.each(["How It Works", "Key Invariants", "Integration Points", "Decision Log"])(
        "flags a missing required section `## %s`",
        (heading) => {
            const dir = makeTmpDir();
            const sections = DEFAULT_SECTIONS
                .split("\n\n")
                .filter((block) => !block.startsWith(`## ${heading}`))
                .join("\n\n");
            const file = writeFile(dir, "alpha.md", page({ sections }));
            expect(validate(file).some((f) => f.message.includes(`missing required section \`## ${heading}\``))).toBe(true);
        }
    );

    it("flags a body exceeding the 400-word cap", () => {
        const dir = makeTmpDir();
        const filler = "filler ".repeat(450).trim();
        const sections = `## How It Works

${filler}

## Key Invariants

1. Alpha never breaks.

## Integration Points

- [beta](beta.md) — interacts with beta.

## Decision Log

### 2026-07-04 — #1 — Seed
Why it exists.
`;
        const file = writeFile(dir, "alpha.md", page({ sections }));
        expect(validate(file).some((f) => f.message.includes("exceeds the 400-word cap"))).toBe(true);
    });

    it("flags more than 7 numbered invariants", () => {
        const dir = makeTmpDir();
        const invariants = Array.from({ length: 8 }, (_, i) => `${i + 1}. Invariant ${i + 1}.`).join("\n");
        const sections = `## How It Works

Alpha behaves predictably under load.

## Key Invariants

${invariants}

## Integration Points

- [beta](beta.md) — interacts with beta.

## Decision Log

### 2026-07-04 — #1 — Seed
Why it exists.
`;
        const file = writeFile(dir, "alpha.md", page({ sections }));
        expect(validate(file).some((f) => f.message.includes("exceeds the cap of 7"))).toBe(true);
    });

    it("flags a touches entry with no matching Integration Points bullet", () => {
        const dir = makeTmpDir();
        const fm = DEFAULT_FRONTMATTER.replace('touches: ["beta"]', 'touches: ["beta", "gamma"]');
        const file = writeFile(dir, "alpha.md", page({ frontmatter: fm }));
        expect(validate(file).some((f) => f.message.includes('touches: "gamma" has no Integration Points bullet'))).toBe(true);
    });

    it("flags an Integration Points bullet missing from touches", () => {
        const dir = makeTmpDir();
        const sections = DEFAULT_SECTIONS.replace(
            "- [beta](beta.md) — interacts with beta.",
            "- [beta](beta.md) — interacts with beta.\n- [gamma](gamma.md) — interacts with gamma."
        );
        const file = writeFile(dir, "alpha.md", page({ sections }));
        expect(validate(file).some((f) => f.message.includes('Integration Points names "gamma" missing from touches'))).toBe(true);
    });

    it("flags a link label/target mismatch in Integration Points", () => {
        const dir = makeTmpDir();
        const sections = DEFAULT_SECTIONS.replace(
            "- [beta](beta.md) — interacts with beta.",
            "- [beta](gamma.md) — interacts with beta."
        );
        const file = writeFile(dir, "alpha.md", page({ sections }));
        expect(validate(file).some((f) => f.message.includes("disagree"))).toBe(true);
    });

    it("flags an Integration Points bullet not shaped as a [slug](slug.md) link", () => {
        const dir = makeTmpDir();
        const sections = DEFAULT_SECTIONS.replace(
            "- [beta](beta.md) — interacts with beta.",
            "- beta, without a link"
        );
        const file = writeFile(dir, "alpha.md", page({ sections }));
        expect(validate(file).some((f) => f.message.includes("does not lead with a [slug](slug.md) link"))).toBe(true);
    });

    it("flags an empty Decision Log section", () => {
        const dir = makeTmpDir();
        const sections = `## How It Works

Alpha behaves predictably under load.

## Key Invariants

1. Alpha never breaks.

## Integration Points

- [beta](beta.md) — interacts with beta.

## Decision Log
`;
        const file = writeFile(dir, "alpha.md", page({ sections }));
        expect(validate(file).some((f) => f.message.includes("Decision Log: empty"))).toBe(true);
    });

    it("flags a malformed Decision Log heading", () => {
        const dir = makeTmpDir();
        const sections = DEFAULT_SECTIONS.replace(
            "### 2026-07-04 — #1 — Seed",
            "### not a valid heading"
        );
        const file = writeFile(dir, "alpha.md", page({ sections }));
        expect(validate(file).some((f) => f.message.includes("malformed heading"))).toBe(true);
    });

    it("flags a bad provenance ref in a Decision Log heading", () => {
        const dir = makeTmpDir();
        const sections = DEFAULT_SECTIONS.replace(
            "### 2026-07-04 — #1 — Seed",
            "### 2026-07-04 — randomguy — Seed"
        );
        const file = writeFile(dir, "alpha.md", page({ sections }));
        expect(validate(file).some((f) => f.message.includes("bad provenance ref"))).toBe(true);
    });

    it("flags an H3 heading found outside the Decision Log", () => {
        const dir = makeTmpDir();
        const sections = `## How It Works

Alpha behaves predictably under load.

### Stray Heading

More prose.

## Key Invariants

1. Alpha never breaks.

## Integration Points

- [beta](beta.md) — interacts with beta.

## Decision Log

### 2026-07-04 — #1 — Seed
Why it exists.
`;
        const file = writeFile(dir, "alpha.md", page({ sections }));
        expect(validate(file).some((f) => f.message.includes("H3 headings found outside the Decision Log"))).toBe(true);
    });
});

describe("validatePage — --base append-only mode", () => {
    it("treats a base version with no Decision Log section as having zero prior entries", () => {
        const dir = makeGitRepo();
        const noLogSections = `## How It Works

Alpha behaves predictably under load.

## Key Invariants

1. Alpha never breaks.

## Integration Points

- [beta](beta.md) — interacts with beta.
`;
        const file = writeFile(dir, "alpha.md", page({ sections: noLogSections }));
        const sha = commitAll(dir, "seed");
        fs.writeFileSync(file, page());
        const findings = validateWithCwd(dir, () => validate(file, sha, dir));
        expect(findings.filter((f) => f.message.includes("Decision Log"))).toEqual([]);
    });

    it("enforces nothing when the page is unchanged against base", () => {
        const dir = makeGitRepo();
        const file = writeFile(dir, "alpha.md", page());
        const sha = commitAll(dir, "seed");
        const findings = validateWithCwd(dir, () => validate(file, sha, dir));
        expect(findings).toEqual([]);
    });

    it("passes when a changed page gains exactly one new Decision Log entry", () => {
        const dir = makeGitRepo();
        const file = writeFile(dir, "alpha.md", page());
        const sha = commitAll(dir, "seed");
        const sections = DEFAULT_SECTIONS.replace(
            "Why it exists.\n",
            `Why it exists.

### 2026-07-05 — #2 — Follow-up
More context.
`
        );
        fs.writeFileSync(file, page({ sections }));
        const findings = validateWithCwd(dir, () => validate(file, sha, dir));
        expect(findings.filter((f) => f.message.includes("Decision Log"))).toEqual([]);
    });

    it("flags a changed page that gained zero new Decision Log entries", () => {
        const dir = makeGitRepo();
        const file = writeFile(dir, "alpha.md", page());
        const sha = commitAll(dir, "seed");
        fs.writeFileSync(file, page({ lead: "Alpha does the thing well, updated." }));
        const findings = validateWithCwd(dir, () => validate(file, sha, dir));
        expect(findings.some((f) => f.message.includes("gained 0 entries"))).toBe(true);
    });

    it("flags a changed page that gained two new Decision Log entries", () => {
        const dir = makeGitRepo();
        const file = writeFile(dir, "alpha.md", page());
        const sha = commitAll(dir, "seed");
        const sections = DEFAULT_SECTIONS.replace(
            "Why it exists.\n",
            `Why it exists.

### 2026-07-05 — #2 — Follow-up
More.

### 2026-07-06 — #3 — Another
Even more.
`
        );
        fs.writeFileSync(file, page({ sections }));
        const findings = validateWithCwd(dir, () => validate(file, sha, dir));
        expect(findings.some((f) => f.message.includes("gained 2 entries"))).toBe(true);
    });

    it("flags an edited prior Decision Log entry even when exactly one entry was added", () => {
        const dir = makeGitRepo();
        const file = writeFile(dir, "alpha.md", page());
        const sha = commitAll(dir, "seed");
        const sections = DEFAULT_SECTIONS
            .replace("### 2026-07-04 — #1 — Seed", "### 2026-07-05 — #1 — Seed")
            .replace(
                "Why it exists.\n",
                `Why it exists.

### 2026-07-06 — #2 — Follow-up
More.
`
            );
        fs.writeFileSync(file, page({ sections }));
        const findings = validateWithCwd(dir, () => validate(file, sha, dir));
        expect(findings.some((f) => f.message.includes("append-only"))).toBe(true);
    });

    it("requires exactly one entry on a brand-new page not present at base", () => {
        const dir = makeGitRepo();
        writeFile(dir, "placeholder.md", page({ h1: "# Placeholder", frontmatter: DEFAULT_FRONTMATTER.replace("Alpha", "Placeholder") }));
        const sha = commitAll(dir, "seed");
        const file = writeFile(dir, "alpha.md", page());
        const findings = validateWithCwd(dir, () => validate(file, sha, dir));
        expect(findings.filter((f) => f.message.includes("Decision Log"))).toEqual([]);
    });

    it("flags a brand-new page that doesn't carry exactly one entry", () => {
        const dir = makeGitRepo();
        writeFile(dir, "placeholder.md", page({ h1: "# Placeholder", frontmatter: DEFAULT_FRONTMATTER.replace("Alpha", "Placeholder") }));
        const sha = commitAll(dir, "seed");
        const sections = DEFAULT_SECTIONS.replace(
            "Why it exists.\n",
            `Why it exists.

### 2026-07-05 — #2 — Follow-up
More.
`
        );
        const file = writeFile(dir, "alpha.md", page({ sections }));
        const findings = validateWithCwd(dir, () => validate(file, sha, dir));
        expect(findings.some((f) => f.message.includes("new page must carry exactly one entry"))).toBe(true);
    });

    it("finds the pre-archive content via the _archive fallback path", () => {
        const dir = makeGitRepo();
        const original = writeFile(dir, "concepts/alpha.md", page());
        const sha = commitAll(dir, "seed");
        fs.rmSync(original);
        const sections = DEFAULT_SECTIONS.replace(
            "Why it exists.\n",
            `Why it exists.

### 2026-07-05 — #2 — Archived
No longer active.
`
        );
        const archived = writeFile(dir, "concepts/_archive/alpha.md", page({ sections }));
        const findings = validateWithCwd(dir, () => validate(archived, sha, dir));
        // Gained exactly one entry relative to the pre-archive content found via the fallback —
        // if the fallback didn't work, `previous` would be null and this would instead fail as
        // "new page must carry exactly one entry (found 2)".
        expect(findings.filter((f) => f.message.includes("Decision Log"))).toEqual([]);
    });
});

describe("runCli", () => {
    it("returns 0 and reports the concept directory as absent when it doesn't exist", () => {
        const dir = makeTmpDir();
        const logs: string[] = [];
        const originalLog = console.log;
        console.log = (msg: string) => logs.push(msg);
        try {
            const status = runCli(["--concepts-dir", path.join(dir, "missing")]);
            expect(status).toBe(0);
            expect(logs.some((line) => line.includes("nothing to validate"))).toBe(true);
        } finally {
            console.log = originalLog;
        }
    });

    it("returns 1 when a listed file does not exist", () => {
        const dir = makeTmpDir();
        const status = runCli(["--concepts-dir", dir, path.join(dir, "missing.md")]);
        expect(status).toBe(1);
    });

    it("returns 0 for a clean concepts directory", () => {
        const dir = makeTmpDir();
        writeFile(dir, "alpha.md", page());
        expect(runCli(["--concepts-dir", dir])).toBe(0);
    });

    it("returns 1 when a page has findings", () => {
        const dir = makeTmpDir();
        writeFile(dir, "alpha.md", page({ h1: "# Mismatched Title" }));
        expect(runCli(["--concepts-dir", dir])).toBe(1);
    });
});

describe("CLI (subprocess)", () => {
    function runViaTsx(args: string[]): { status: number; stdout: string; stderr: string } {
        try {
            const stdout: string = execFileSync("npx", ["tsx", "libs/portable-tools/src/validate-concepts.ts", ...args], {
                cwd: REPO_ROOT,
                encoding: "utf8",
            });
            return { status: 0, stdout, stderr: "" };
        } catch (error) {
            const err = error as { status: number; stdout: string; stderr: string };
            return { status: err.status, stdout: err.stdout, stderr: err.stderr };
        }
    }

    it("exits 0 and prints the validated count for a clean directory", () => {
        const dir = makeTmpDir();
        writeFile(dir, "alpha.md", page());
        const result = runViaTsx(["--concepts-dir", dir]);
        expect(result.status).toBe(0);
        expect(result.stdout).toContain("OK: 1 page(s) validated.");
    });

    it("exits 1 and prints the finding count for a directory with findings", () => {
        const dir = makeTmpDir();
        writeFile(dir, "alpha.md", page({ h1: "# Mismatched Title" }));
        const result = runViaTsx(["--concepts-dir", dir]);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("finding(s) across");
    });
});
