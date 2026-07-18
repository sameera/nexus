import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    type Diagnostic,
    type LoadResult,
    type WorkspaceDescription,
    loadWorkspaceFromHub,
    parseAndValidateManifest,
} from "./manifest";

// A synthetic hub checkout path for the pure (no-FS) cases. parentDir is its dirname.
const HUB = path.join(path.sep, "ws", "docs-hub");
const PARENT = path.dirname(HUB);
const FILE = path.join(HUB, ".nexus", "config", "workspace.yml");

const VALID = `# a hand-authored workspace manifest
hub:
  name: docs-hub
  remote: git@github.com:acme/docs-hub.git
members:
  - name: web-app
    remote: git@github.com:acme/web-app.git
  - name: api
    remote: https://github.com/acme/api.git
`;

function asOk(result: LoadResult): WorkspaceDescription {
    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(`expected ok result, got error: ${result.error.message}`);
    }
    return result.workspace;
}

function asError(result: LoadResult): Diagnostic {
    expect(result.ok).toBe(false);
    if (result.ok) {
        throw new Error("expected an error result, got ok");
    }
    return result.error;
}

// --- AC1: a valid manifest is recognized ------------------------------------

describe("parseAndValidateManifest — valid manifest (AC1)", () => {
    it("recognizes the hub and every declared member", () => {
        const ws = asOk(parseAndValidateManifest(VALID, FILE, HUB));

        expect(ws.hub.name).toBe("docs-hub");
        expect(ws.hub.path).toBe(HUB);
        expect(ws.parentDir).toBe(PARENT);
        expect(ws.hub.normalizedRemote).toBe("github.com/acme/docs-hub");

        expect(ws.members.map((m) => m.name)).toEqual(["web-app", "api"]);
    });

    it("places each member at its expected sibling checkout path", () => {
        const ws = asOk(parseAndValidateManifest(VALID, FILE, HUB));

        const web = ws.members.find((m) => m.name === "web-app");
        expect(web?.expectedPath).toBe(path.join(PARENT, "web-app"));
        expect(web?.normalizedRemote).toBe("github.com/acme/web-app");
    });

    it("treats SSH and HTTPS member remotes by their normalized identity", () => {
        const ws = asOk(parseAndValidateManifest(VALID, FILE, HUB));
        const api = ws.members.find((m) => m.name === "api");
        expect(api?.normalizedRemote).toBe("github.com/acme/api");
    });

    it("permits a hub with no members yet", () => {
        const raw = `hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\nmembers: []\n`;
        const ws = asOk(parseAndValidateManifest(raw, FILE, HUB));
        expect(ws.members).toEqual([]);
    });

    it("permits an omitted members key as an empty member set", () => {
        const raw = `hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n`;
        const ws = asOk(parseAndValidateManifest(raw, FILE, HUB));
        expect(ws.members).toEqual([]);
    });
});

// --- docs root (epic #74, STORY-74.01) --------------------------------------

describe("parseAndValidateManifest — docs root", () => {
    it("defaults the hub's docs root to the repo root when no override is given", () => {
        const ws = asOk(parseAndValidateManifest(VALID, FILE, HUB));
        expect(ws.hub.docsRoot).toBe(".");
    });

    it("defaults every member's docs root to 'docs' — the hub role, not membership, moves the default", () => {
        const ws = asOk(parseAndValidateManifest(VALID, FILE, HUB));
        expect(ws.members.map((m) => m.docsRoot)).toEqual(["docs", "docs"]);
    });

    it("accepts an explicit hub docs-root override, which wins over the role default", () => {
        const raw = `hub:\n  name: docs-hub\n  remote: r\n  docs-root: docs\nmembers: []\n`;
        const ws = asOk(parseAndValidateManifest(raw, FILE, HUB));
        expect(ws.hub.docsRoot).toBe("docs");
    });

    it("accepts a nested explicit hub docs-root override", () => {
        const raw = `hub:\n  name: docs-hub\n  remote: r\n  docs-root: docs/handbook\nmembers: []\n`;
        const ws = asOk(parseAndValidateManifest(raw, FILE, HUB));
        expect(ws.hub.docsRoot).toBe("docs/handbook");
    });

    it("rejects an absolute docs-root override", () => {
        const raw = `hub:\n  name: docs-hub\n  remote: r\n  docs-root: /etc\nmembers: []\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("unsafe-name");
        expect(err.entry).toContain("hub");
        expect(err.message).toContain("/etc");
    });

    it("rejects a docs-root override carrying a '..' traversal segment", () => {
        const raw = `hub:\n  name: docs-hub\n  remote: r\n  docs-root: ../escape\nmembers: []\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("unsafe-name");
        expect(err.message).toContain("../escape");
    });
});

// --- AC3: adding a member is recognized with no other change ----------------

describe("parseAndValidateManifest — adding a member (AC3)", () => {
    it("recognizes an added member entry", () => {
        const before = asOk(parseAndValidateManifest(VALID, FILE, HUB));
        const withThird =
            VALID + `  - name: worker\n    remote: git@github.com:acme/worker.git\n`;
        const after = asOk(parseAndValidateManifest(withThird, FILE, HUB));

        expect(after.members.length).toBe(before.members.length + 1);
        expect(after.members.map((m) => m.name)).toContain("worker");
    });
});

// --- AC2: every structural defect is a named, non-partial diagnostic --------

describe("parseAndValidateManifest — structural defects (AC2)", () => {
    it("names the file, the member, and the missing field", () => {
        const raw = `hub:\n  name: docs-hub\n  remote: r\nmembers:\n  - name: web-app\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("missing-field");
        expect(err.file).toBe(FILE);
        expect(err.message).toContain("workspace.yml");
        expect(err.message).toContain("web-app");
        expect(err.message).toContain("remote");
    });

    it("reports a member missing its name", () => {
        const raw = `hub:\n  name: docs-hub\n  remote: r\nmembers:\n  - remote: git@github.com:acme/web-app.git\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("missing-field");
        expect(err.entry).toContain("members[0]");
        expect(err.message).toContain("name");
    });

    it("reports a missing required hub field", () => {
        const raw = `hub:\n  remote: git@github.com:acme/docs-hub.git\nmembers: []\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("missing-field");
        expect(err.entry).toContain("hub");
        expect(err.message).toContain("name");
    });

    it("reports a missing hub section", () => {
        const raw = `members: []\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("missing-field");
        expect(err.message).toContain("hub");
    });

    it("reports an unknown key on the hub", () => {
        const raw = `hub:\n  name: docs-hub\n  remote: r\n  url: extra\nmembers: []\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("unknown-key");
        expect(err.message).toContain("url");
    });

    it("reports an unknown key on a member", () => {
        const raw = `hub:\n  name: docs-hub\n  remote: r\nmembers:\n  - name: web-app\n    remote: r\n    branch: main\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("unknown-key");
        expect(err.message).toContain("branch");
    });

    it("reports an unknown top-level key", () => {
        const raw = VALID + `foo: bar\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("unknown-key");
        expect(err.message).toContain("foo");
    });

    it("reports a duplicate member by name", () => {
        const raw = `hub:\n  name: docs-hub\n  remote: r\nmembers:\n  - name: web-app\n    remote: git@github.com:acme/web-app.git\n  - name: web-app\n    remote: git@github.com:acme/other.git\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("duplicate-member");
        expect(err.message).toContain("web-app");
    });

    it("reports a duplicate member by remote identity across SSH/HTTPS spellings", () => {
        const raw = `hub:\n  name: docs-hub\n  remote: r\nmembers:\n  - name: web\n    remote: git@github.com:acme/web-app.git\n  - name: webapp\n    remote: https://github.com/acme/web-app\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("duplicate-member");
        expect(err.message).toContain("github.com/acme/web-app");
    });

    it("reports a member that shares the hub's remote identity, across spellings", () => {
        const raw = `hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\nmembers:\n  - name: docs-copy\n    remote: https://github.com/acme/docs-hub\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("duplicate-member");
        expect(err.message).toContain("hub");
        expect(err.message).toContain("github.com/acme/docs-hub");
    });

    it("reports a member that shares the hub's name", () => {
        const raw = `hub:\n  name: docs-hub\n  remote: r\nmembers:\n  - name: docs-hub\n    remote: git@github.com:acme/other.git\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("duplicate-member");
        expect(err.message).toContain("docs-hub");
    });

    it("reports unparseable YAML", () => {
        const raw = `hub:\n  name: docs-hub\nmembers: [\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("malformed-yaml");
        expect(err.message).toContain("workspace.yml");
    });

    it("reports an empty manifest", () => {
        const err = asError(parseAndValidateManifest("", FILE, HUB));
        expect(err.problem).toBe("missing-field");
        expect(err.message).toContain("hub");
    });

    it("reports members declared as a map instead of a list", () => {
        const raw = `hub:\n  name: docs-hub\n  remote: r\nmembers:\n  name: web-app\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("wrong-type");
        expect(err.entry).toContain("members");
    });

    it("reports hub declared as a scalar instead of a map", () => {
        const raw = `hub: docs-hub\nmembers: []\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("wrong-type");
        expect(err.entry).toContain("hub");
    });

    it("reports a member declared as a scalar instead of a map", () => {
        const raw = `hub:\n  name: docs-hub\n  remote: r\nmembers:\n  - web-app\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("wrong-type");
        expect(err.entry).toContain("members");
    });

    it("reports a manifest that is a bare scalar", () => {
        const err = asError(parseAndValidateManifest("just a string", FILE, HUB));
        expect(err.problem).toBe("wrong-type");
        expect(err.message).toContain("workspace.yml");
    });

    it("reports a manifest that is a top-level list", () => {
        const err = asError(parseAndValidateManifest("- a\n- b\n", FILE, HUB));
        expect(err.problem).toBe("wrong-type");
        expect(err.message).toContain("workspace.yml");
    });

    it("rejects a member name that traverses out of the shared parent", () => {
        const raw = `hub:\n  name: docs-hub\n  remote: r\nmembers:\n  - name: ../evil\n    remote: git@github.com:acme/evil.git\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("unsafe-name");
        expect(err.entry).toContain("members[0]");
        expect(err.message).toContain("../evil");
    });

    it("rejects a member name containing a path separator", () => {
        const raw = `hub:\n  name: docs-hub\n  remote: r\nmembers:\n  - name: nested/app\n    remote: git@github.com:acme/app.git\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("unsafe-name");
        expect(err.message).toContain("nested/app");
    });

    it("rejects a hub name that is not a bare directory segment", () => {
        const raw = `hub:\n  name: ../../hub\n  remote: r\nmembers: []\n`;
        const err = asError(parseAndValidateManifest(raw, FILE, HUB));
        expect(err.problem).toBe("unsafe-name");
        expect(err.entry).toContain("hub");
    });
});

// --- loadWorkspaceFromHub: the filesystem wrapper ---------------------------

describe("loadWorkspaceFromHub", () => {
    let tmpDirs: string[] = [];

    afterEach(() => {
        for (const dir of tmpDirs) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
        tmpDirs = [];
    });

    function makeHub(contents: string | null): string {
        const parent = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-ws-"));
        tmpDirs.push(parent);
        const hub = path.join(parent, "docs-hub");
        fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
        if (contents !== null) {
            fs.writeFileSync(path.join(hub, ".nexus", "config", "workspace.yml"), contents);
        }
        return hub;
    }

    it("reads and resolves the manifest from the hub checkout", () => {
        const hub = makeHub(VALID);
        const ws = asOk(loadWorkspaceFromHub(hub));

        expect(ws.hub.path).toBe(hub);
        expect(ws.parentDir).toBe(path.dirname(hub));
        expect(ws.members.map((m) => m.name)).toEqual(["web-app", "api"]);
        expect(ws.members[0]?.expectedPath).toBe(path.join(path.dirname(hub), "web-app"));
    });

    it("returns a named diagnostic when the hub has no manifest", () => {
        const hub = makeHub(null);
        const err = asError(loadWorkspaceFromHub(hub));
        expect(err.problem).toBe("missing-manifest");
        expect(err.message).toContain("workspace.yml");
    });

    it("surfaces a validation diagnostic from a defective on-disk manifest", () => {
        const hub = makeHub(`hub:\n  name: docs-hub\nmembers: []\n`);
        const err = asError(loadWorkspaceFromHub(hub));
        expect(err.problem).toBe("missing-field");
        expect(err.message).toContain("remote");
    });
});
