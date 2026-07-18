import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { type Diagnostic } from "./manifest";
import { type ResolveResult } from "./resolve";
import { renderWorkspaceStatus } from "./status";

const PARENT = path.join(path.sep, "ws");

function workspaceResult(hubDocsRoot = "."): ResolveResult {
    return {
        ok: true,
        workspace: {
            mode: "workspace",
            hubRoot: path.join(PARENT, "docs-hub"),
            parentDir: PARENT,
            hub: {
                name: "docs-hub",
                remote: "git@github.com:acme/docs-hub.git",
                normalizedRemote: "github.com/acme/docs-hub",
                path: path.join(PARENT, "docs-hub"),
                docsRoot: hubDocsRoot,
            },
            members: [
                {
                    name: "web-app",
                    remote: "git@github.com:acme/web-app.git",
                    normalizedRemote: "github.com/acme/web-app",
                    expectedPath: path.join(PARENT, "web-app"),
                    checkout: "present",
                    docsRoot: "docs",
                },
                {
                    name: "api",
                    remote: "https://github.com/acme/api.git",
                    normalizedRemote: "github.com/acme/api",
                    expectedPath: path.join(PARENT, "api"),
                    checkout: "missing",
                    docsRoot: "docs",
                },
            ],
        },
    };
}

// --- workspace mode (AC1) ---------------------------------------------------

describe("renderWorkspaceStatus — resolved workspace", () => {
    it("renders the hub, every declared member, and each member's checkout state", () => {
        const out = renderWorkspaceStatus(workspaceResult());

        // The hub is named.
        expect(out).toContain("docs-hub");

        // Every declared member appears.
        expect(out).toContain("web-app");
        expect(out).toContain("api");

        // Each member's checkout state is legible: one found, one missing.
        expect(out.toLowerCase()).toContain("present");
        expect(out.toLowerCase()).toContain("missing");
    });

    it("names a missing member's remote and expected checkout path", () => {
        const out = renderWorkspaceStatus(workspaceResult());

        // The missing 'api' member is fully identified so setup is self-diagnosable.
        expect(out).toContain("github.com/acme/api");
        expect(out).toContain(path.join(PARENT, "api"));
    });

    it("does not render a resolved workspace as an error", () => {
        const out = renderWorkspaceStatus(workspaceResult()).toLowerCase();
        expect(out).not.toContain("resolution failed");
    });

    it("renders a hub that declares no members yet", () => {
        const noMembers: ResolveResult = {
            ok: true,
            workspace: {
                mode: "workspace",
                hubRoot: path.join(PARENT, "docs-hub"),
                parentDir: PARENT,
                hub: {
                    name: "docs-hub",
                    remote: "git@github.com:acme/docs-hub.git",
                    normalizedRemote: "github.com/acme/docs-hub",
                    path: path.join(PARENT, "docs-hub"),
                    docsRoot: ".",
                },
                members: [],
            },
        };
        const out = renderWorkspaceStatus(noMembers).toLowerCase();
        expect(out).toContain("docs-hub");
        expect(out).toContain("none");
    });
});

// --- docs root (epic #74, STORY-74.01 AC5) ----------------------------------

describe("renderWorkspaceStatus — docs root", () => {
    it("reports the hub's docs root as the repo root", () => {
        const out = renderWorkspaceStatus(workspaceResult(".")).toLowerCase();
        expect(out).toContain("repo root");
    });

    it("reports an explicit hub docs-root override", () => {
        const out = renderWorkspaceStatus(workspaceResult("docs"));
        expect(out).toContain("docs");
    });

    it("reports each member's docs root", () => {
        const out = renderWorkspaceStatus(workspaceResult());
        // Both members default to "docs" — appears once per member line, distinct from the hub's ".".
        expect(out.match(/docs(?!-hub)/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    });

    it("reports the single-repo docs root", () => {
        const single: ResolveResult = {
            ok: true,
            workspace: { mode: "single-repo", root: path.join(PARENT, "solo"), docsRoot: "docs" },
        };
        const out = renderWorkspaceStatus(single);
        expect(out).toContain("docs");
    });
});

// --- single-repo mode (AC2) -------------------------------------------------

describe("renderWorkspaceStatus — single-repo mode", () => {
    const single: ResolveResult = {
        ok: true,
        workspace: { mode: "single-repo", root: path.join(PARENT, "solo"), docsRoot: "docs" },
    };

    it("states that no workspace is declared, not an error", () => {
        const out = renderWorkspaceStatus(single).toLowerCase();
        expect(out).toContain("no workspace");
        expect(out).toContain("single-repo");
        expect(out).not.toContain("failed");
        expect(out).not.toContain("error");
    });
});

// --- resolution failure (verification vehicle for Stories 1–3) --------------

describe("renderWorkspaceStatus — resolution failure", () => {
    const err: Diagnostic = {
        file: path.join(PARENT, "web-app", ".nexus", "config", "hub.yml"),
        entry: "hub (docs-hub)",
        problem: "missing-hub-checkout",
        message:
            "hub 'docs-hub' (git@github.com:acme/docs-hub.git) is not checked out at the expected location /ws/docs-hub",
    };
    const failure: ResolveResult = { ok: false, error: err };

    it("renders the diagnostic naming the file, the problem, and the message", () => {
        const out = renderWorkspaceStatus(failure);
        expect(out).toContain(err.file);
        expect(out).toContain(err.problem);
        expect(out).toContain(err.message);
    });

    it("names the offending entry when the diagnostic carries one", () => {
        const out = renderWorkspaceStatus(failure);
        expect(out).toContain("hub (docs-hub)");
    });

    it("renders a file-level diagnostic that carries no entry", () => {
        const fileLevel: ResolveResult = {
            ok: false,
            error: {
                file: path.join(PARENT, "docs-hub", ".nexus", "config", "workspace.yml"),
                problem: "malformed-yaml",
                message: "workspace.yml: could not parse YAML",
            },
        };
        const out = renderWorkspaceStatus(fileLevel);
        expect(out).toContain("malformed-yaml");
        expect(out).toContain("workspace.yml");
        expect(out).not.toContain("entry:");
    });
});
