import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_DOC_ROOT, getDocRoot, parseSimpleYaml, readSettings } from "./settings.js";

let tmpDirs: string[] = [];

function makeTmpDir(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "abs-doc-path-settings-"));
    tmpDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

describe("parseSimpleYaml", () => {
    it("parses a two-level nested document into sections of key/value pairs", () => {
        const parsed = parseSimpleYaml(["cross-ref:", "  docs-root: docs", "github:", "  project: acme"].join("\n"));
        expect(parsed).toEqual({ "cross-ref": { "docs-root": "docs" }, github: { project: "acme" } });
    });

    it("ignores blank lines and comment lines", () => {
        const parsed = parseSimpleYaml(["# a comment", "", "cross-ref:", "  docs-root: docs", ""].join("\n"));
        expect(parsed).toEqual({ "cross-ref": { "docs-root": "docs" } });
    });

    it("ignores an indented line before any section header", () => {
        const parsed = parseSimpleYaml(["  orphan: value", "cross-ref:", "  docs-root: docs"].join("\n"));
        expect(parsed).toEqual({ "cross-ref": { "docs-root": "docs" } });
    });
});

describe("readSettings", () => {
    it("returns {} when settings.yml does not exist", () => {
        expect(readSettings(makeTmpDir())).toEqual({});
    });

    it("reads cross-ref.docs-root, github.project, and github.epic-type", () => {
        const root: string = makeTmpDir();
        fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(
            path.join(root, ".nexus", "config", "settings.yml"),
            ["cross-ref:", "  docs-root: https://github.com/acme/app/blob/main/docs", "github:", "  project: acme/app", "  epic-type: Epic"].join(
                "\n",
            ),
        );
        expect(readSettings(root)).toEqual({
            docRoot: "https://github.com/acme/app/blob/main/docs",
            project: "acme/app",
            epicType: "Epic",
        });
    });

    it("returns {} when the settings file is present but unparsable garbage throws", () => {
        const root: string = makeTmpDir();
        fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
        // A directory where a file is expected — readFileSync throws, and readSettings must not.
        fs.mkdirSync(path.join(root, ".nexus", "config", "settings.yml"));
        expect(readSettings(root)).toEqual({});
    });
});

describe("getDocRoot", () => {
    it("falls back to the placeholder default when no setting is present, with a trailing slash", () => {
        expect(getDocRoot(makeTmpDir())).toBe(DEFAULT_DOC_ROOT.replace(/\/+$/, "") + "/");
    });

    it("reads the configured doc root and normalizes a trailing slash", () => {
        const root: string = makeTmpDir();
        fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(
            path.join(root, ".nexus", "config", "settings.yml"),
            ["cross-ref:", "  docs-root: https://github.com/acme/app/blob/main/docs/"].join("\n"),
        );
        expect(getDocRoot(root)).toBe("https://github.com/acme/app/blob/main/docs/");
    });
});
