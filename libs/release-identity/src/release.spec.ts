/**
 * The release identity (story #305): one semantic version covering the executable and the
 * component payload, declared exactly once — in the release's own package manifest — and reached
 * from wherever a toolkit file happens to sit.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { RELEASE_PACKAGE_NAME, releaseVersion, resolveReleaseVersion } from "./release";

let tmpDirs: string[] = [];

function makeTmpDir(prefix: string): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmpDirs.push(dir);
    return dir;
}

/** Writes a manifest naming the release itself, at `dir`. */
function writeReleaseManifest(dir: string, version: string): void {
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: RELEASE_PACKAGE_NAME, version }));
}

/** Writes a manifest for some other package — a workspace member, or an unrelated dependency. */
function writeOtherManifest(dir: string, name: string, version: string): void {
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name, version }));
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");

function rootManifestVersion(): string {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")).version;
}

describe("the release version declaration", () => {
    it("is one semantic version, declared in the release's own package manifest", () => {
        expect(rootManifestVersion()).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
    });

    it("is what the executable reports — the executable carries no version of its own", () => {
        expect(releaseVersion()).toBe(rootManifestVersion());
    });

    it("has no second declaration beside the manifest", () => {
        expect(fs.existsSync(path.join(REPO_ROOT, "VERSION"))).toBe(false);
    });
});

describe("resolving the declaration from a toolkit file's own position", () => {
    it("walks up from a nested directory to the nearest declaration", () => {
        const root: string = makeTmpDir("release-root-");
        writeReleaseManifest(root, "2.3.4");
        const nested: string = path.join(root, "a", "b", "c");
        fs.mkdirSync(nested, { recursive: true });
        expect(resolveReleaseVersion(nested)).toBe("2.3.4");
    });

    it("walks past a workspace member's own manifest to the release's", () => {
        const root: string = makeTmpDir("release-workspace-");
        writeReleaseManifest(root, "2.3.4");
        const member: string = path.join(root, "libs", "some-lib");
        fs.mkdirSync(path.join(member, "src"), { recursive: true });
        writeOtherManifest(member, "@nexus/some-lib", "0.0.1");
        expect(resolveReleaseVersion(path.join(member, "src"))).toBe("2.3.4");
    });

    it("reports the version as unresolved rather than guessing when no declaration is above it", () => {
        expect(resolveReleaseVersion(makeTmpDir("release-none-"))).toBeNull();
    });

    it("reports unresolved when only other packages' manifests are above it", () => {
        const root: string = makeTmpDir("release-foreign-");
        writeOtherManifest(root, "some-unrelated-package", "7.7.7");
        expect(resolveReleaseVersion(root)).toBeNull();
    });

    it("takes the nearest declaration, so a release installed inside another wins", () => {
        const outer: string = makeTmpDir("release-outer-");
        writeReleaseManifest(outer, "1.0.0");
        const inner: string = path.join(outer, "vendor", "nexus");
        fs.mkdirSync(inner, { recursive: true });
        writeReleaseManifest(inner, "9.9.9");
        expect(resolveReleaseVersion(inner)).toBe("9.9.9");
    });

    it("reports unresolved rather than raising when the manifest is unreadable", () => {
        const root: string = makeTmpDir("release-malformed-");
        fs.writeFileSync(path.join(root, "package.json"), "{ not json");
        expect(resolveReleaseVersion(root)).toBeNull();
    });

    it("keeps walking past a malformed manifest to a readable declaration above it", () => {
        const outer: string = makeTmpDir("release-malformed-outer-");
        writeReleaseManifest(outer, "3.2.1");
        const inner: string = path.join(outer, "broken");
        fs.mkdirSync(inner, { recursive: true });
        fs.writeFileSync(path.join(inner, "package.json"), "{ not json");
        expect(resolveReleaseVersion(inner)).toBe("3.2.1");
    });

    it("reports unresolved when the release manifest carries no version", () => {
        const root: string = makeTmpDir("release-versionless-");
        fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: RELEASE_PACKAGE_NAME }));
        expect(resolveReleaseVersion(root)).toBeNull();
    });
});

describe("no second version declaration exists (AC2 — one declaration, read by everything)", () => {
    it("no source module declares a release version literal of its own", () => {
        const libs: string = path.join(REPO_ROOT, "libs");
        const walk = (dir: string): string[] =>
            fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
                const abs: string = path.join(dir, entry.name);
                if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "out-tsc") return [];
                if (entry.name === "origin") return [];
                return entry.isDirectory() ? walk(abs) : entry.name.endsWith(".ts") ? [abs] : [];
            });
        for (const file of walk(libs)) {
            expect(fs.readFileSync(file, "utf8"), file).not.toMatch(/^\s*(export )?const RELEASE_VERSION\s*=\s*"/m);
        }
    });
});
