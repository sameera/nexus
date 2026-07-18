import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type Diagnostic } from "./manifest";
import {
    PORTABLE_TOOLS_RELATIVE_PATH,
    type ResolveResult,
    type ResolvedWorkspace,
    type SingleRepoWorkspace,
    localDocsRoot,
    resolveWorkspace,
} from "./resolve";

// A hub manifest declaring two members.
const MANIFEST = `hub:
  name: docs-hub
  remote: git@github.com:acme/docs-hub.git
members:
  - name: web-app
    remote: git@github.com:acme/web-app.git
  - name: api
    remote: https://github.com/acme/api.git
`;

// web-app's pointer to the hub.
const POINTER = `hub:
  name: docs-hub
  remote: git@github.com:acme/docs-hub.git
`;

function asWorkspace(result: ResolveResult): ResolvedWorkspace {
    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(`expected ok result, got error: ${result.error.message}`);
    }
    if (result.workspace.mode !== "workspace") {
        throw new Error(`expected workspace mode, got '${result.workspace.mode}'`);
    }
    return result.workspace;
}

function asSingleRepo(result: ResolveResult): SingleRepoWorkspace {
    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(`expected ok result, got error: ${result.error.message}`);
    }
    if (result.workspace.mode !== "single-repo") {
        throw new Error(`expected single-repo mode, got '${result.workspace.mode}'`);
    }
    return result.workspace;
}

function asError(result: ResolveResult): Diagnostic {
    expect(result.ok).toBe(false);
    if (result.ok) {
        throw new Error("expected an error result, got ok");
    }
    return result.error;
}

describe("resolveWorkspace", () => {
    let tmpDirs: string[] = [];

    afterEach(() => {
        for (const dir of tmpDirs) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
        tmpDirs = [];
    });

    function makeParent(): string {
        const parent = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-ws-resolve-"));
        tmpDirs.push(parent);
        return parent;
    }

    /** Write a checkout under <parent>/<dir> with an optional file at .nexus/config/<name>. */
    function writeCheckout(parent: string, dir: string, file?: { name: string; contents: string }): string {
        const root = path.join(parent, dir);
        fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
        if (file) {
            fs.writeFileSync(path.join(root, ".nexus", "config", file.name), file.contents);
        }
        return root;
    }

    // --- single-repo fallback (AC3: neither artifact → today's behavior) -----

    it("reports single-repo mode when neither manifest nor pointer is present", () => {
        const parent = makeParent();
        const repo = writeCheckout(parent, "solo"); // bare .nexus/config, no workspace files

        const single = asSingleRepo(resolveWorkspace(repo));
        expect(single.root).toBe(repo);
        expect(single.docsRoot).toBe("docs");
    });

    it("reports single-repo mode when only unrelated Nexus settings are present", () => {
        const parent = makeParent();
        const repo = writeCheckout(parent, "solo", {
            name: "settings.yml",
            contents: "github:\n  project: x\n",
        });

        expect(asSingleRepo(resolveWorkspace(repo)).root).toBe(repo);
    });

    it("reports single-repo mode for a directory with no .nexus at all", () => {
        const parent = makeParent();
        const bare = path.join(parent, "bare");
        fs.mkdirSync(bare, { recursive: true });

        expect(asSingleRepo(resolveWorkspace(bare)).root).toBe(bare);
    });

    // --- hub-entry resolution + member checkout state ------------------------

    it("resolves from the hub and marks each member's checkout state", () => {
        const parent = makeParent();
        const hub = writeCheckout(parent, "docs-hub", { name: "workspace.yml", contents: MANIFEST });
        writeCheckout(parent, "web-app", { name: "hub.yml", contents: POINTER }); // present
        // 'api' is intentionally not checked out.

        const ws = asWorkspace(resolveWorkspace(hub));
        expect(ws.hub.name).toBe("docs-hub");
        expect(ws.hubRoot).toBe(hub);
        expect(ws.parentDir).toBe(parent);

        const web = ws.members.find((m) => m.name === "web-app");
        const api = ws.members.find((m) => m.name === "api");
        expect(web?.checkout).toBe("present");
        expect(api?.checkout).toBe("missing");
    });

    // --- AC2: a declared member with no checkout is named, not a silent gap --

    it("names a missing member's repo, remote, and expected path, distinct from not-a-workspace", () => {
        const parent = makeParent();
        const hub = writeCheckout(parent, "docs-hub", { name: "workspace.yml", contents: MANIFEST });
        writeCheckout(parent, "web-app", { name: "hub.yml", contents: POINTER });

        const ws = asWorkspace(resolveWorkspace(hub));
        const api = ws.members.find((m) => m.name === "api");
        expect(api?.checkout).toBe("missing");
        expect(api?.normalizedRemote).toBe("github.com/acme/api");
        expect(api?.expectedPath).toBe(path.join(parent, "api"));

        // Distinguished from single-repo: this is still a resolved workspace.
        expect(ws.mode).toBe("workspace");
    });

    // --- Story 2 (#46): hub-vendored portable-tools directory --------------

    it("resolves the hub's vendored portable-tools directory as a sibling of .nexus/config", () => {
        const parent = makeParent();
        const hub = writeCheckout(parent, "docs-hub", { name: "workspace.yml", contents: MANIFEST });

        const ws = asWorkspace(resolveWorkspace(hub));
        expect(ws.portableToolsDir).toBe(path.join(hub, ...PORTABLE_TOOLS_RELATIVE_PATH));
    });

    it("does not resolve a portable-tools directory in single-repo mode", () => {
        const parent = makeParent();
        const repo = writeCheckout(parent, "solo");

        expect(asSingleRepo(resolveWorkspace(repo))).not.toHaveProperty("portableToolsDir");
    });

    // --- AC1: parity — hub-entry and member-entry yield identical descriptions

    it("yields an identical workspace description from the hub and from a member", () => {
        const parent = makeParent();
        const hub = writeCheckout(parent, "docs-hub", { name: "workspace.yml", contents: MANIFEST });
        const web = writeCheckout(parent, "web-app", { name: "hub.yml", contents: POINTER });
        writeCheckout(parent, "api"); // both members checked out → all present

        const fromHub = asWorkspace(resolveWorkspace(hub));
        const fromMember = asWorkspace(resolveWorkspace(web));

        expect(fromMember).toEqual(fromHub);
        expect(fromHub.members.map((m) => m.checkout)).toEqual(["present", "present"]);
        // AC4: the deep-equal parity guarantee extends to docs root (epic #74).
        expect(fromHub.hub.docsRoot).toBe(".");
        expect(fromHub.members.map((m) => m.docsRoot)).toEqual(["docs", "docs"]);
        expect(fromMember.hub.docsRoot).toBe(fromHub.hub.docsRoot);
    });

    it("keeps parity even when a sibling member is missing, from either entry point", () => {
        const parent = makeParent();
        const hub = writeCheckout(parent, "docs-hub", { name: "workspace.yml", contents: MANIFEST });
        const web = writeCheckout(parent, "web-app", { name: "hub.yml", contents: POINTER });
        // 'api' missing from both perspectives.

        expect(asWorkspace(resolveWorkspace(web))).toEqual(asWorkspace(resolveWorkspace(hub)));
    });

    // --- error passthrough: hard failures stay named diagnostics -------------

    it("passes through a malformed-manifest diagnostic from the hub", () => {
        const parent = makeParent();
        const hub = writeCheckout(parent, "docs-hub", {
            name: "workspace.yml",
            contents: "hub:\n  name: docs-hub\nmembers: [\n", // malformed
        });

        const err = asError(resolveWorkspace(hub));
        expect(err.problem).toBe("malformed-yaml");
    });

    it("passes through missing-hub-checkout when a member's hub sibling is absent", () => {
        const parent = makeParent();
        const web = writeCheckout(parent, "web-app", { name: "hub.yml", contents: POINTER });

        const err = asError(resolveWorkspace(web));
        expect(err.problem).toBe("missing-hub-checkout");
        expect(err.message).toContain("docs-hub");
    });

    it("passes through undeclared-member when this checkout is not in the manifest", () => {
        const parent = makeParent();
        writeCheckout(parent, "docs-hub", { name: "workspace.yml", contents: MANIFEST });
        const worker = writeCheckout(parent, "worker", { name: "hub.yml", contents: POINTER });

        const err = asError(resolveWorkspace(worker));
        expect(err.problem).toBe("undeclared-member");
        expect(err.message).toContain("worker");
    });

    // --- role tiebreak: a checkout holding both files is the hub -------------

    it("treats a checkout holding both a manifest and a pointer as the hub", () => {
        const parent = makeParent();
        const both = writeCheckout(parent, "docs-hub", { name: "workspace.yml", contents: MANIFEST });
        fs.writeFileSync(path.join(both, ".nexus", "config", "hub.yml"), POINTER);

        const ws = asWorkspace(resolveWorkspace(both));
        expect(ws.hub.name).toBe("docs-hub");
        expect(ws.hubRoot).toBe(both);
    });

    // --- localDocsRoot: the docs-root-only selector Stories 2 & 3 consume ----

    describe("localDocsRoot", () => {
        it("returns 'docs' for a single-repo checkout", () => {
            const parent = makeParent();
            const repo = writeCheckout(parent, "solo");

            const result = localDocsRoot(repo);
            expect(result).toEqual({ ok: true, docsRoot: "docs" });
        });

        it("returns the hub's resolved docs root when called from the hub checkout", () => {
            const parent = makeParent();
            const hub = writeCheckout(parent, "docs-hub", { name: "workspace.yml", contents: MANIFEST });

            expect(localDocsRoot(hub)).toEqual({ ok: true, docsRoot: "." });
        });

        it("returns an explicit hub docs-root override when called from the hub checkout", () => {
            const parent = makeParent();
            const withOverride = `hub:\n  name: docs-hub\n  remote: git@github.com:acme/docs-hub.git\n  docs-root: docs\nmembers: []\n`;
            const hub = writeCheckout(parent, "docs-hub", { name: "workspace.yml", contents: withOverride });

            expect(localDocsRoot(hub)).toEqual({ ok: true, docsRoot: "docs" });
        });

        it("returns 'docs' when called from a member checkout, regardless of the hub's docs root", () => {
            const parent = makeParent();
            writeCheckout(parent, "docs-hub", { name: "workspace.yml", contents: MANIFEST });
            const web = writeCheckout(parent, "web-app", { name: "hub.yml", contents: POINTER });

            expect(localDocsRoot(web)).toEqual({ ok: true, docsRoot: "docs" });
        });

        it("passes through a resolution failure as a named diagnostic", () => {
            const parent = makeParent();
            const web = writeCheckout(parent, "web-app", { name: "hub.yml", contents: POINTER });
            // hub sibling 'docs-hub' is not checked out.

            const result = localDocsRoot(web);
            expect(result.ok).toBe(false);
            if (result.ok) {
                throw new Error("expected a resolution failure");
            }
            expect(result.error.problem).toBe("missing-hub-checkout");
        });
    });
});
