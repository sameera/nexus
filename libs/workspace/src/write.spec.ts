/**
 * The workspace-artifact writers (STORY-60.02/60.04) — the write-side counterpart of the
 * manifest/pointer readers. These specs pin the epic's structural guarantees: everything a
 * writer emits is accepted by the resolver's own parsers with zero edits (the writer validates
 * its output before touching disk and writes nothing on a rejected candidate), and the
 * append-member mutation is a minimal structured edit that preserves every existing manifest
 * entry byte-for-byte.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadWorkspaceFromHub } from "./manifest";
import { loadWorkspaceFromMember } from "./pointer";
import { appendMemberToManifest, writeManifest, writePointer } from "./write";

let tmpDirs: string[] = [];

function makeParent(): string {
    const dir: string = fs.mkdtempSync(path.join(os.tmpdir(), "ws-write-"));
    tmpDirs.push(dir);
    return dir;
}

afterEach(() => {
    for (const dir of tmpDirs) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    tmpDirs = [];
});

const DECLARATION = {
    hub: { name: "docs-hub", remote: "git@github.com:acme/docs-hub.git" },
    members: [
        { name: "web-app", remote: "git@github.com:acme/web-app.git" },
        { name: "api", remote: "https://github.com/acme/api.git" },
    ],
};

describe("writeManifest", () => {
    it("emits a manifest the hub-side loader resolves with zero edits", () => {
        const hubRoot: string = path.join(makeParent(), "docs-hub");
        fs.mkdirSync(hubRoot, { recursive: true });

        const result = writeManifest(hubRoot, DECLARATION);

        expect(result.ok).toBe(true);
        const loaded = loadWorkspaceFromHub(hubRoot);
        expect(loaded.ok).toBe(true);
        if (loaded.ok) {
            expect(loaded.workspace.hub.name).toBe("docs-hub");
            expect(loaded.workspace.members.map((m) => m.name)).toEqual(["web-app", "api"]);
        }
    });

    it("rejects a colliding declaration through the resolver's rule and writes nothing", () => {
        const hubRoot: string = path.join(makeParent(), "docs-hub");
        fs.mkdirSync(hubRoot, { recursive: true });

        const result = writeManifest(hubRoot, {
            hub: DECLARATION.hub,
            members: [
                { name: "docs-mirror", remote: "https://github.com/acme/docs-hub" }, // hub's remote
            ],
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.problem).toBe("duplicate-member");
        }
        expect(fs.existsSync(path.join(hubRoot, ".nexus", "config", "workspace.yml"))).toBe(false);
    });
});

describe("writePointer", () => {
    it("emits a pointer the member-side loader resolves with zero edits", () => {
        const parent: string = makeParent();
        const hubRoot: string = path.join(parent, "docs-hub");
        const memberRoot: string = path.join(parent, "web-app");
        fs.mkdirSync(hubRoot, { recursive: true });
        fs.mkdirSync(memberRoot, { recursive: true });
        expect(writeManifest(hubRoot, DECLARATION).ok).toBe(true);

        const result = writePointer(memberRoot, DECLARATION.hub);

        expect(result.ok).toBe(true);
        const loaded = loadWorkspaceFromMember(memberRoot);
        expect(loaded.ok).toBe(true);
        if (loaded.ok) {
            expect(loaded.workspace.hub.name).toBe("docs-hub");
        }
    });

    it("rejects an invalid hub name and writes nothing", () => {
        const memberRoot: string = path.join(makeParent(), "web-app");
        fs.mkdirSync(memberRoot, { recursive: true });

        const result = writePointer(memberRoot, { name: "../escape", remote: "git@github.com:acme/hub.git" });

        expect(result.ok).toBe(false);
        expect(fs.existsSync(path.join(memberRoot, ".nexus", "config", "hub.yml"))).toBe(false);
    });
});

describe("appendMemberToManifest", () => {
    const EXISTING = `# hand-tuned workspace manifest — comments and order must survive
hub:
  name: docs-hub
  remote: git@github.com:acme/docs-hub.git
members:
  - name: web-app
    remote: git@github.com:acme/web-app.git # the first member
`;

    function makeHubWithManifest(): string {
        const hubRoot: string = path.join(makeParent(), "docs-hub");
        fs.mkdirSync(path.join(hubRoot, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(hubRoot, ".nexus", "config", "workspace.yml"), EXISTING);
        return hubRoot;
    }

    it("appends exactly one entry, preserving every existing line verbatim", () => {
        const hubRoot: string = makeHubWithManifest();

        const result = appendMemberToManifest(hubRoot, { name: "api", remote: "https://github.com/acme/api.git" });

        expect(result.ok).toBe(true);
        const after: string = fs.readFileSync(path.join(hubRoot, ".nexus", "config", "workspace.yml"), "utf8");
        // Structured minimal edit: every pre-existing line survives byte-for-byte.
        for (const line of EXISTING.trimEnd().split("\n")) {
            expect(after).toContain(line);
        }
        const loaded = loadWorkspaceFromHub(hubRoot);
        expect(loaded.ok).toBe(true);
        if (loaded.ok) {
            expect(loaded.workspace.members.map((m) => m.name)).toEqual(["web-app", "api"]);
        }
    });

    it("rejects a name collision with a declared member and leaves the manifest untouched", () => {
        const hubRoot: string = makeHubWithManifest();

        const result = appendMemberToManifest(hubRoot, { name: "web-app", remote: "git@github.com:acme/x.git" });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.problem).toBe("duplicate-member");
        }
        expect(fs.readFileSync(path.join(hubRoot, ".nexus", "config", "workspace.yml"), "utf8")).toBe(EXISTING);
    });

    it("rejects a remote collision (different spelling) and leaves the manifest untouched", () => {
        const hubRoot: string = makeHubWithManifest();

        const result = appendMemberToManifest(hubRoot, {
            name: "web-clone",
            remote: "https://github.com/acme/web-app",
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.problem).toBe("duplicate-member");
        }
        expect(fs.readFileSync(path.join(hubRoot, ".nexus", "config", "workspace.yml"), "utf8")).toBe(EXISTING);
    });

    it("fails with the resolver's diagnostic when the hub has no manifest", () => {
        const hubRoot: string = path.join(makeParent(), "docs-hub");
        fs.mkdirSync(hubRoot, { recursive: true });

        const result = appendMemberToManifest(hubRoot, { name: "api", remote: "https://github.com/acme/api.git" });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.problem).toBe("missing-manifest");
        }
    });

    it("appends into a manifest with no members list yet", () => {
        const hubRoot: string = path.join(makeParent(), "docs-hub");
        fs.mkdirSync(path.join(hubRoot, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(
            path.join(hubRoot, ".nexus", "config", "workspace.yml"),
            "hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n",
        );

        const result = appendMemberToManifest(hubRoot, { name: "api", remote: "https://github.com/acme/api.git" });

        expect(result.ok).toBe(true);
        const loaded = loadWorkspaceFromHub(hubRoot);
        expect(loaded.ok).toBe(true);
        if (loaded.ok) {
            expect(loaded.workspace.members.map((m) => m.name)).toEqual(["api"]);
        }
    });
});
