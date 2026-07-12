import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
    type Diagnostic,
    type LoadResult,
    type WorkspaceDescription,
    loadWorkspaceFromHub,
} from "./manifest";
import {
    type HubPointer,
    type PointerResult,
    loadWorkspaceFromMember,
    parseAndValidatePointer,
} from "./pointer";

// A synthetic member checkout path for the pure (no-FS) pointer cases.
const MEMBER = path.join(path.sep, "ws", "web-app");
const PFILE = path.join(MEMBER, ".nexus", "config", "hub.yml");

// A member's hub pointer: names ONLY the hub (bare sibling name + remote identity).
const POINTER = `# this member's pointer to its workspace hub
hub:
  name: docs-hub
  remote: git@github.com:acme/docs-hub.git
`;

// A hub manifest declaring this member (web-app) and one other (api).
const MANIFEST = `hub:
  name: docs-hub
  remote: git@github.com:acme/docs-hub.git
members:
  - name: web-app
    remote: git@github.com:acme/web-app.git
  - name: api
    remote: https://github.com/acme/api.git
`;

function asOkPointer(result: PointerResult): HubPointer {
    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(`expected ok pointer, got error: ${result.error.message}`);
    }
    return result.pointer;
}

function asPointerError(result: PointerResult): Diagnostic {
    expect(result.ok).toBe(false);
    if (result.ok) {
        throw new Error("expected a pointer error result, got ok");
    }
    return result.error;
}

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

// --- parseAndValidatePointer: valid ----------------------------------------

describe("parseAndValidatePointer — valid pointer", () => {
    it("reads the hub name and normalizes the hub remote", () => {
        const p = asOkPointer(parseAndValidatePointer(POINTER, PFILE));
        expect(p.hubName).toBe("docs-hub");
        expect(p.hubRemote).toBe("git@github.com:acme/docs-hub.git");
        expect(p.normalizedHubRemote).toBe("github.com/acme/docs-hub");
    });
});

// --- parseAndValidatePointer: structural defects (named, non-partial) -------

describe("parseAndValidatePointer — structural defects", () => {
    it("reports a missing hub section", () => {
        const err = asPointerError(parseAndValidatePointer("{}\n", PFILE));
        expect(err.problem).toBe("missing-field");
        expect(err.message).toContain("hub");
    });

    it("reports an empty pointer", () => {
        const err = asPointerError(parseAndValidatePointer("", PFILE));
        expect(err.problem).toBe("missing-field");
        expect(err.message).toContain("hub");
    });

    it("reports a hub missing its name", () => {
        const err = asPointerError(parseAndValidatePointer(`hub:\n  remote: r\n`, PFILE));
        expect(err.problem).toBe("missing-field");
        expect(err.message).toContain("name");
    });

    it("reports a hub missing its remote", () => {
        const err = asPointerError(parseAndValidatePointer(`hub:\n  name: docs-hub\n`, PFILE));
        expect(err.problem).toBe("missing-field");
        expect(err.message).toContain("remote");
    });

    it("reports an unknown key on the hub", () => {
        const raw = `hub:\n  name: docs-hub\n  remote: r\n  branch: main\n`;
        const err = asPointerError(parseAndValidatePointer(raw, PFILE));
        expect(err.problem).toBe("unknown-key");
        expect(err.message).toContain("branch");
    });

    it("rejects a members key — a pointer never redeclares membership", () => {
        const err = asPointerError(parseAndValidatePointer(POINTER + `members: []\n`, PFILE));
        expect(err.problem).toBe("unknown-key");
        expect(err.message).toContain("members");
    });

    it("reports unparseable YAML", () => {
        const err = asPointerError(parseAndValidatePointer(`hub:\n  name: x\nfoo: [\n`, PFILE));
        expect(err.problem).toBe("malformed-yaml");
        expect(err.message).toContain("hub.yml");
    });

    it("reports hub declared as a scalar instead of a map", () => {
        const err = asPointerError(parseAndValidatePointer(`hub: docs-hub\n`, PFILE));
        expect(err.problem).toBe("wrong-type");
        expect(err.entry).toContain("hub");
    });

    it("reports a pointer that is a bare scalar", () => {
        const err = asPointerError(parseAndValidatePointer("just a string", PFILE));
        expect(err.problem).toBe("wrong-type");
        expect(err.message).toContain("hub.yml");
    });

    it("reports a pointer that is a top-level list", () => {
        const err = asPointerError(parseAndValidatePointer("- a\n- b\n", PFILE));
        expect(err.problem).toBe("wrong-type");
        expect(err.message).toContain("hub.yml");
    });

    it("rejects a hub name that traverses out of the shared parent", () => {
        const raw = `hub:\n  name: ../../elsewhere\n  remote: git@github.com:acme/docs-hub.git\n`;
        const err = asPointerError(parseAndValidatePointer(raw, PFILE));
        expect(err.problem).toBe("unsafe-name");
        expect(err.message).toContain("../../elsewhere");
    });

    it("rejects a hub name containing a path separator", () => {
        const raw = `hub:\n  name: a/b\n  remote: git@github.com:acme/docs-hub.git\n`;
        const err = asPointerError(parseAndValidatePointer(raw, PFILE));
        expect(err.problem).toBe("unsafe-name");
    });
});

// --- loadWorkspaceFromMember: the filesystem resolver -----------------------

describe("loadWorkspaceFromMember", () => {
    let tmpDirs: string[] = [];

    afterEach(() => {
        for (const dir of tmpDirs) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
        tmpDirs = [];
    });

    function makeParent(): string {
        const parent = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-ws-member-"));
        tmpDirs.push(parent);
        return parent;
    }

    /** Write a hub checkout with a manifest under <parent>/<dir>. Returns the hub path. */
    function writeManifest(parent: string, dir: string, contents: string): string {
        const hub = path.join(parent, dir);
        fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(hub, ".nexus", "config", "workspace.yml"), contents);
        return hub;
    }

    /** Write a member checkout under <parent>/<dir> with (or without) a hub pointer. */
    function writeMember(parent: string, dir: string, pointer: string | null): string {
        const member = path.join(parent, dir);
        fs.mkdirSync(path.join(member, ".nexus", "config"), { recursive: true });
        if (pointer !== null) {
            fs.writeFileSync(path.join(member, ".nexus", "config", "hub.yml"), pointer);
        }
        return member;
    }

    // AC1: locate the hub, read its manifest — identical to hub-side resolution.
    it("resolves the workspace from a member and matches hub-side resolution", () => {
        const parent = makeParent();
        const hub = writeManifest(parent, "docs-hub", MANIFEST);
        const member = writeMember(parent, "web-app", POINTER);

        const fromMember = asOk(loadWorkspaceFromMember(member));
        const fromHub = asOk(loadWorkspaceFromHub(hub));

        expect(fromMember).toEqual(fromHub);
        expect(fromMember.hub.name).toBe("docs-hub");
        expect(fromMember.members.map((m) => m.name)).toEqual(["web-app", "api"]);
        expect(fromMember.members[0]?.expectedPath).toBe(path.join(parent, "web-app"));
    });

    // AC2: the pointer names a hub that is not checked out at the expected location.
    it("reports missing-hub-checkout when the hub sibling is absent", () => {
        const parent = makeParent();
        const member = writeMember(parent, "web-app", POINTER); // no docs-hub sibling

        const err = asError(loadWorkspaceFromMember(member));
        expect(err.problem).toBe("missing-hub-checkout");
        expect(err.message).toContain("docs-hub");
        expect(err.message).toContain("git@github.com:acme/docs-hub.git");
        expect(err.message).toContain(path.join(parent, "docs-hub"));
    });

    it("reports missing-hub-checkout when the sibling exists but is not a hub", () => {
        const parent = makeParent();
        fs.mkdirSync(path.join(parent, "docs-hub"), { recursive: true }); // exists, no manifest
        const member = writeMember(parent, "web-app", POINTER);

        const err = asError(loadWorkspaceFromMember(member));
        expect(err.problem).toBe("missing-hub-checkout");
        expect(err.message).toContain(path.join(parent, "docs-hub"));
    });

    // AC3: the member is not declared in the hub manifest — report both sides.
    it("reports undeclared-member when this checkout is not listed in the manifest", () => {
        const parent = makeParent();
        writeManifest(parent, "docs-hub", MANIFEST); // declares web-app, api
        const member = writeMember(parent, "worker", POINTER); // 'worker' is not declared

        const err = asError(loadWorkspaceFromMember(member));
        expect(err.problem).toBe("undeclared-member");
        expect(err.message).toContain("worker"); // this checkout
        expect(err.message).toContain("web-app"); // the declared members
        expect(err.message).toContain("api");
    });

    it("reports undeclared-member against a hub that declares no members yet", () => {
        const parent = makeParent();
        const emptyHub = `hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\nmembers: []\n`;
        writeManifest(parent, "docs-hub", emptyHub);
        const member = writeMember(parent, "web-app", POINTER);

        const err = asError(loadWorkspaceFromMember(member));
        expect(err.problem).toBe("undeclared-member");
        expect(err.message).toContain("web-app");
        expect(err.message).toContain("(none)");
    });

    it("reports missing-pointer when the member has no hub.yml", () => {
        const parent = makeParent();
        writeManifest(parent, "docs-hub", MANIFEST);
        const member = writeMember(parent, "web-app", null);

        const err = asError(loadWorkspaceFromMember(member));
        expect(err.problem).toBe("missing-pointer");
        expect(err.message).toContain("hub.yml");
    });

    it("reports hub-remote-mismatch when the located hub's remote differs from the pointer's", () => {
        const parent = makeParent();
        const otherHub = `hub:\n  name: docs-hub\n  remote: git@github.com:other-org/docs-hub.git\nmembers:\n  - name: web-app\n    remote: git@github.com:acme/web-app.git\n`;
        writeManifest(parent, "docs-hub", otherHub);
        const member = writeMember(parent, "web-app", POINTER); // pointer expects acme/docs-hub

        const err = asError(loadWorkspaceFromMember(member));
        expect(err.problem).toBe("hub-remote-mismatch");
        expect(err.message).toContain("github.com/acme/docs-hub"); // pointer side
        expect(err.message).toContain("github.com/other-org/docs-hub"); // manifest side
    });

    it("does not flag a mismatch when pointer and manifest spell the same hub remote differently", () => {
        const parent = makeParent();
        const httpsHub = `hub:\n  name: docs-hub\n  remote: https://github.com/acme/docs-hub\nmembers:\n  - name: web-app\n    remote: git@github.com:acme/web-app.git\n`;
        writeManifest(parent, "docs-hub", httpsHub);
        const member = writeMember(parent, "web-app", POINTER); // SSH spelling of the same hub

        const ws = asOk(loadWorkspaceFromMember(member));
        expect(ws.hub.name).toBe("docs-hub");
    });

    it("surfaces a validation diagnostic from a defective on-disk pointer", () => {
        const parent = makeParent();
        writeManifest(parent, "docs-hub", MANIFEST);
        const member = writeMember(parent, "web-app", `hub:\n  name: docs-hub\n`); // no remote

        const err = asError(loadWorkspaceFromMember(member));
        expect(err.problem).toBe("missing-field");
        expect(err.message).toContain("remote");
    });

    it("passes through a manifest defect from the located hub", () => {
        const parent = makeParent();
        writeManifest(parent, "docs-hub", `hub:\n  name: docs-hub\nmembers: [\n`); // malformed
        const member = writeMember(parent, "web-app", POINTER);

        const err = asError(loadWorkspaceFromMember(member));
        expect(err.problem).toBe("malformed-yaml");
    });

    it("refuses to redirect resolution outside the parent via a traversal hub name", () => {
        const parent = makeParent();
        writeManifest(parent, "docs-hub", MANIFEST);
        const member = writeMember(
            parent,
            "web-app",
            `hub:\n  name: ../../etc\n  remote: git@github.com:acme/docs-hub.git\n`,
        );

        const err = asError(loadWorkspaceFromMember(member));
        expect(err.problem).toBe("unsafe-name");
    });
});
