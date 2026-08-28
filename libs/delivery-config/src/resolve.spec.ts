/**
 * The shared resolver (story #357) — the behaviours the Python `test_delivery_config` suite
 * asserted, asserted here through the library surface and the CLI.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { runNexusGh } from "./dispatch";
import { normalizeHubDefaults } from "./hub";
import { type ToolkitIo } from "./io";
import { GITHUB_KEYS, githubKeyFor, normalizedKey } from "./keys";
import { PRECEDENCE, resolveSetting } from "./resolve";
import { readDeliveryConfig } from "./settings";

function recordingIo(cwd: string): ToolkitIo & { out: string[]; err: string[] } {
    const out: string[] = [];
    const err: string[] = [];
    return { cwd, stdout: (line) => out.push(line), stderr: (line) => err.push(line), out, err };
}

function repoWith(files: Record<string, string>): string {
    const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "delivery-config-"));
    for (const [rel, body] of Object.entries(files)) {
        const file: string = path.join(root, ...rel.split("/"));
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, body);
    }
    return root;
}

/**
 * A checkout that is its own workspace hub, declaring the `github:` defaults the hub layer reads.
 * The manifest is written for the workspace library to resolve — this toolkit never parses it.
 */
function hubRepoWith(github: Record<string, string>, settings?: string): string {
    const files: Record<string, string> = {
        ".nexus/config/workspace.yml": [
            "hub:",
            "  name: docs-hub",
            "  remote: git@github.com:acme/docs-hub.git",
            "members: []",
            "github:",
            ...Object.entries(github).map(([key, value]) => `  ${key}: ${value}`),
            "",
        ].join("\n"),
    };
    if (settings !== undefined) files[".nexus/config/settings.yml"] = settings;
    return repoWith(files);
}

function resolved(root: string, key: string): { code: number; value: string } {
    const io = recordingIo(root);
    const code: number = runNexusGh(["config", "resolve", key, "--root", root], io);
    return { code, value: io.out.join("\n") };
}

describe("reading a repository's declared settings", () => {
    it("returns the declared value for a github-block key", () => {
        const root: string = repoWith({ ".nexus/config/settings.yml": "github:\n  issues-repo: acme/tracker\n" });
        expect(resolved(root, "issues-repo")).toEqual({ code: 0, value: "acme/tracker" });
    });

    it("falls back to the legacy config.yml when no settings.yml exists", () => {
        const root: string = repoWith({ ".nexus/config/config.yml": "github:\n  issues-repo: acme/legacy\n" });
        expect(resolved(root, "issues-repo").value).toBe("acme/legacy");
    });

    it("populates every key the catalogue declares — none readable but left unset", () => {
        const block: string = GITHUB_KEYS.map((k, i) => `  ${k.githubKey}: value-${i}`).join("\n");
        const root: string = repoWith({ ".nexus/config/settings.yml": `github:\n${block}\n` });
        const config = readDeliveryConfig(root);
        GITHUB_KEYS.forEach((key, i) => {
            expect(config[key.normalized]).toBe(`value-${i}`);
            expect(resolved(root, key.githubKey).value).toBe(`value-${i}`);
        });
    });

    it("keeps the catalogue's inverse derived, so either spelling names the same key", () => {
        for (const key of GITHUB_KEYS) {
            expect(normalizedKey(key.githubKey)).toBe(key.normalized);
            expect(githubKeyFor(key.normalized)).toBe(key.githubKey);
        }
    });

    it("prints an empty line for a key declared at no layer and carrying no built-in", () => {
        const root: string = repoWith({ ".nexus/config/settings.yml": "github:\n  project: none\n" });
        expect(resolved(root, "worktree-path")).toEqual({ code: 0, value: "" });
    });
});

describe("the precedence chain", () => {
    it("resolves invocation, then frontmatter, then repo, then hub, then built-in", () => {
        expect(PRECEDENCE).toEqual(["invocation", "frontmatter", "repo", "hub", "builtin"]);
        const all = {
            invocation: { k: "invocation" },
            frontmatter: { k: "frontmatter" },
            repo: { k: "repo" },
            hub: { k: "hub" },
            builtin: "builtin",
        };
        expect(resolveSetting("k", all)).toBe("invocation");
        expect(resolveSetting("k", { ...all, invocation: null })).toBe("frontmatter");
        expect(resolveSetting("k", { ...all, invocation: null, frontmatter: null })).toBe("repo");
        expect(resolveSetting("k", { repo: {}, hub: { k: "hub" }, builtin: "builtin" })).toBe("hub");
        expect(resolveSetting("k", { repo: { k: "" }, builtin: "builtin" })).toBe("builtin");
        expect(resolveSetting("k", {})).toBeNull();
    });

    it("lets the repository's own value win over the hub's", () => {
        expect(resolveSetting("k", { repo: { k: "mine" }, hub: { k: "theirs" } })).toBe("mine");
    });
});

describe("the hub layer", () => {
    it("contributes nothing, and reads no workspace, when the checkout declares none", () => {
        const root: string = repoWith({ ".nexus/config/settings.yml": "github:\n  project: none\n" });
        expect(resolved(root, "issues-repo").value).toBe("");
    });

    it("keeps a declared key whose normalized name is its own github spelling", () => {
        expect(
            normalizeHubDefaults({ "issues-repo": " acme/hub ", project: " Delivery Board ", classification: "types" }),
        ).toEqual({ issuesRepo: "acme/hub", project: "Delivery Board", classification: "types" });
    });

    it("carries the whole catalogue, so no key is declarable at a hub but unlayerable from one", () => {
        const block: Record<string, string> = Object.fromEntries(
            GITHUB_KEYS.map((key, i) => [key.githubKey, `value-${i}`]),
        );
        const defaults = normalizeHubDefaults(block);
        GITHUB_KEYS.forEach((key, i) => expect(defaults[key.normalized]).toBe(`value-${i}`));
    });

    it("drops an undeclared key, a blank value, and a value that is not a string", () => {
        expect(normalizeHubDefaults({ nonsense: "x", project: "   ", classification: 7 })).toEqual({});
    });

    it("contributes nothing, rather than failing the resolution, when the workspace is unresolvable", () => {
        const root: string = repoWith({
            ".nexus/config/workspace.yml": "hub:\n  name: docs-hub\nmembers: []\n",
            ".nexus/config/settings.yml": "github:\n  issues-repo: acme/local\n",
        });
        expect(resolved(root, "issues-repo")).toEqual({ code: 0, value: "acme/local" });
        expect(resolved(root, "project")).toEqual({ code: 0, value: "" });
    });

    it("layers a hub's declared defaults under the repository's own, for every key alike", () => {
        const root: string = hubRepoWith(
            { project: "Delivery Board", classification: "types", "issues-repo": "acme/hub" },
            "github:\n  project: Local Board\n",
        );
        expect(resolved(root, "project").value).toBe("Local Board");
        expect(resolved(root, "classification").value).toBe("types");
        expect(resolved(root, "issues-repo").value).toBe("acme/hub");
    });
});

describe("the config root", () => {
    it("uses the nearest ancestor holding a config directory when --root is below it", () => {
        const root: string = repoWith({
            ".nexus/config/settings.yml": "github:\n  issues-repo: acme/tracker\n",
            "src/deep/keep.txt": "",
        });
        const io = recordingIo(root);
        expect(runNexusGh(["config", "resolve", "issues-repo", "--root", path.join(root, "src", "deep")], io)).toBe(0);
        expect(io.out.join("\n")).toBe("acme/tracker");
    });

    it("reads as empty rather than climbing into an unrelated repository above it", () => {
        const outer: string = repoWith({ ".nexus/config/settings.yml": "github:\n  issues-repo: acme/outer\n" });
        const inner: string = path.join(outer, "unrelated");
        fs.mkdirSync(inner, { recursive: true });
        const io = recordingIo(inner);
        // The walk is keyed to the config directory, so the inner root only inherits when it has
        // no ancestor of its own — which is exactly the outer repository here.
        expect(runNexusGh(["config", "resolve", "issues-repo", "--root", inner], io)).toBe(0);
        expect(io.out.join("\n")).toBe("acme/outer");

        const detached: string = fs.mkdtempSync(path.join(os.tmpdir(), "delivery-config-bare-"));
        const bare = recordingIo(detached);
        expect(runNexusGh(["config", "resolve", "issues-repo", "--root", detached], bare)).toBe(0);
        expect(bare.out.join("\n")).toBe("");
    });
});

describe("the config capability's own argument handling", () => {
    it("writes usage and exits 2 when no command is given", () => {
        const io = recordingIo("/tmp");
        expect(runNexusGh(["config"], io)).toBe(2);
        expect(io.err.join("\n")).toContain("usage: nexus-gh config");
    });

    it("writes its usage to stdout and exits 0 for --help", () => {
        const io = recordingIo("/tmp");
        expect(runNexusGh(["config", "--help"], io)).toBe(0);
        expect(io.out.join("\n")).toContain("usage: nexus-gh config");
    });

    it("requires a key for resolve", () => {
        const io = recordingIo("/tmp");
        expect(runNexusGh(["config", "resolve"], io)).toBe(2);
    });
});
