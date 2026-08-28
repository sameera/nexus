/**
 * The release identity (story #305): one semantic version covering the executable, the Python
 * toolkit and the component payload, declared exactly once and reached from wherever a toolkit
 * file happens to sit.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RELEASE_VERSION_FILE, releaseVersion, resolveReleaseVersion } from "./release";

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

const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");

describe("the release version declaration", () => {
    it("is one semantic version, declared at the release root", () => {
        const declared: string = fs.readFileSync(path.join(REPO_ROOT, RELEASE_VERSION_FILE), "utf8").trim();
        expect(declared).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
    });

    it("is what the executable reports — the executable carries no version of its own", () => {
        const declared: string = fs.readFileSync(path.join(REPO_ROOT, RELEASE_VERSION_FILE), "utf8").trim();
        expect(releaseVersion()).toBe(declared);
    });
});

describe("resolving the declaration from a toolkit file's own position", () => {
    it("walks up from a nested directory to the nearest declaration", () => {
        const root: string = makeTmpDir("release-root-");
        fs.writeFileSync(path.join(root, RELEASE_VERSION_FILE), "2.3.4\n");
        const nested: string = path.join(root, "a", "b", "c");
        fs.mkdirSync(nested, { recursive: true });
        expect(resolveReleaseVersion(nested)).toBe("2.3.4");
    });

    it("reports the version as unresolved rather than guessing when no declaration is above it", () => {
        expect(resolveReleaseVersion(makeTmpDir("release-none-"))).toBeNull();
    });

    it("takes the nearest declaration, so a release installed inside another wins", () => {
        const outer: string = makeTmpDir("release-outer-");
        fs.writeFileSync(path.join(outer, RELEASE_VERSION_FILE), "1.0.0\n");
        const inner: string = path.join(outer, "vendor", "nexus");
        fs.mkdirSync(inner, { recursive: true });
        fs.writeFileSync(path.join(inner, RELEASE_VERSION_FILE), "9.9.9\n");
        expect(resolveReleaseVersion(inner)).toBe("9.9.9");
    });
});

describe("no second version declaration exists (AC2 — neither half carries its own)", () => {
    it("the Python toolkit declares no version literal of its own", () => {
        const pkg: string = path.join(REPO_ROOT, "libs", "gh-toolkit", "nexus_gh");
        for (const entry of fs.readdirSync(pkg).filter((f) => f.endsWith(".py"))) {
            const source: string = fs.readFileSync(path.join(pkg, entry), "utf8");
            expect(source).not.toMatch(/^__version__\s*=/m);
        }
    });
});
