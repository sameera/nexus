import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveAbsDocPath } from "./resolve.js";

let tmpDirs: string[] = [];

function makeRepo(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "abs-doc-path-resolve-"));
    tmpDirs.push(dir);
    fs.mkdirSync(path.join(dir, ".git"));
    return dir;
}

function writeSettings(repo: string, content: string): void {
    fs.mkdirSync(path.join(repo, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(repo, ".nexus", "config", "settings.yml"), content);
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

describe("resolveAbsDocPath", () => {
    it("converts one relative path to an absolute URL under the configured docs root", () => {
        const repo: string = makeRepo();
        writeSettings(repo, ["cross-ref:", "  docs-root: https://github.com/acme/app/blob/main/docs"].join("\n"));

        const result = resolveAbsDocPath(repo, ["docs/features/tagging/README.md"]);

        expect(result).toEqual({ ok: true, urls: ["https://github.com/acme/app/blob/main/docs/features/tagging/README.md"] });
    });

    it("converts multiple relative paths, one URL per input", () => {
        const repo: string = makeRepo();
        writeSettings(repo, ["cross-ref:", "  docs-root: https://github.com/acme/app/blob/main/docs"].join("\n"));

        const result = resolveAbsDocPath(repo, ["docs/a.md", "docs/b.md"]);

        expect(result).toEqual({
            ok: true,
            urls: ["https://github.com/acme/app/blob/main/docs/a.md", "https://github.com/acme/app/blob/main/docs/b.md"],
        });
    });

    it("falls back to the placeholder doc root when settings.yml is absent", () => {
        const repo: string = makeRepo();

        const result = resolveAbsDocPath(repo, ["docs/a.md"]);

        expect(result.ok).toBe(true);
        expect(result.ok && result.urls[0]).toContain("{username|orgname}/{reponame}");
    });

    it("fails when the cross-ref URL disagrees with the resolved docs root", () => {
        const repo: string = makeRepo();
        // No workspace override present, so the resolved docs root is "docs" (single-repo), but
        // the configured cross-ref URL points at "other" — a real operator misconfiguration.
        writeSettings(repo, ["cross-ref:", "  docs-root: https://github.com/acme/app/blob/main/other"].join("\n"));

        const result = resolveAbsDocPath(repo, ["docs/a.md"]);

        expect(result).toEqual({
            ok: false,
            message:
                "cross-ref.docs-root URL disagrees with the resolved docs root: the URL points at 'other' but the " +
                "resolved docs root is 'docs'. Fix .nexus/config/settings.yml's cross-ref.docs-root (or the " +
                "workspace docs-root override) so they agree.",
        });
    });
});
