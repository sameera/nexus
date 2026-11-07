/**
 * A member checkout uses the settings its hub declares and it leaves unset (story #1002).
 *
 * Every case builds a real workspace on disk — a hub checkout and a member checkout side by side
 * under one parent — and resolves through the same `config resolve` and `config write-github`
 * surfaces a stage calls, so the assertions are what a lead sees.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { runConfig } from "./config-cli";
import { type ToolkitIo } from "./io";
import { writeBackDecisions } from "./story-filer/writeback";

const HUB_REMOTE = "git@github.com:acme/docs-hub.git";

function recordingIo(cwd: string): ToolkitIo & { out: string[]; err: string[] } {
    const out: string[] = [];
    const err: string[] = [];
    return { cwd, stdout: (line) => out.push(line), stderr: (line) => err.push(line), out, err };
}

function write(root: string, rel: string, body: string): void {
    const file: string = path.join(root, ...rel.split("/"));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, body);
}

interface Workspace {
    hub: string;
    member: string;
}

interface WorkspaceSpec {
    /** The hub's own `settings.yml`, or undefined for none. */
    hubSettings?: string;
    /** The manifest's workspace-wide `github:` defaults. */
    defaults?: Record<string, string>;
    /** The member's own `settings.yml`, or undefined for none. */
    memberSettings?: string;
}

function workspace(spec: WorkspaceSpec = {}): Workspace {
    const parent: string = fs.mkdtempSync(path.join(os.tmpdir(), "hub-inheritance-"));
    const hub: string = path.join(parent, "docs-hub");
    const member: string = path.join(parent, "web-app");
    const manifest: string[] = [
        "hub:",
        "  name: docs-hub",
        `  remote: ${HUB_REMOTE}`,
        "members:",
        "  - name: web-app",
        "    remote: git@github.com:acme/web-app.git",
    ];
    const defaults: [string, string][] = Object.entries(spec.defaults ?? {});
    if (defaults.length > 0) manifest.push("github:", ...defaults.map(([k, v]) => `  ${k}: ${v}`));
    write(hub, ".nexus/config/workspace.yml", manifest.join("\n") + "\n");
    if (spec.hubSettings !== undefined) write(hub, ".nexus/config/settings.yml", spec.hubSettings);
    write(member, ".nexus/config/hub.yml", `hub:\n  name: docs-hub\n  remote: ${HUB_REMOTE}\n`);
    if (spec.memberSettings !== undefined) write(member, ".nexus/config/settings.yml", spec.memberSettings);
    return { hub, member };
}

function resolved(root: string, key: string): { code: number; value: string; err: string[] } {
    const io = recordingIo(root);
    const code: number = runConfig(["resolve", key, "--root", root], io);
    return { code, value: io.out.join("\n"), err: io.err };
}

function settingsOf(root: string): string {
    const file: string = path.join(root, ".nexus", "config", "settings.yml");
    return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

describe("a member resolving a setting the hub declares", () => {
    it("returns the hub's own value for a setting the member leaves unset", () => {
        const ws = workspace({ hubSettings: "github:\n  project: acme/7\n  classification: types\n" });
        expect(resolved(ws.member, "project").value).toBe("acme/7");
        expect(resolved(ws.member, "classification").value).toBe("types");
    });

    it("treats a member's empty value as unset and falls through to the hub", () => {
        const ws = workspace({
            hubSettings: "github:\n  project: acme/7\n",
            memberSettings: "github:\n  project:\n",
        });
        expect(resolved(ws.member, "project").value).toBe("acme/7");
    });

    it("returns the member's own value when both declare the setting", () => {
        const ws = workspace({
            hubSettings: "github:\n  project: acme/7\n",
            defaults: { project: "acme/9" },
            memberSettings: "github:\n  project: acme/3\n",
        });
        expect(resolved(ws.member, "project").value).toBe("acme/3");
    });

    it("prefers the hub's own setting over the workspace-wide default, matching the hub checkout", () => {
        const ws = workspace({
            hubSettings: "github:\n  epic-label: feature\n  record-label: adr\n",
            defaults: { "epic-label": "initiative-epic", "story-label": "user-story" },
        });
        expect(resolved(ws.member, "epic-label").value).toBe("feature");
        expect(resolved(ws.member, "epic-label").value).toBe(resolved(ws.hub, "epic-label").value);
        expect(resolved(ws.member, "record-label").value).toBe("adr");
        expect(resolved(ws.member, "story-label").value).toBe("user-story");
    });

    it("lets a specific repository target from any source win over a general one", () => {
        const ws = workspace({
            hubSettings: "github:\n  issues-repo: acme/hub-issues\n",
            defaults: { "epic-repo": "acme/epics" },
            memberSettings: "github:\n  issues-repo: acme/mine\n",
        });
        expect(resolved(ws.member, "epic-repo").value).toBe("acme/epics");
        expect(resolved(ws.member, "story-repo").value).toBe("acme/mine");
    });

    it("never takes the test command or the docs location from the hub", () => {
        const ws = workspace({
            hubSettings: "cross-ref:\n  docs-root: hub-docs\ngithub:\n  test-command: pnpm hub-test\n",
        });
        expect(resolved(ws.member, "test-command").value).toBe("");
        expect(resolved(ws.hub, "test-command").value).toBe("pnpm hub-test");
    });
});

describe("a member whose hub cannot be read", () => {
    it("resolves to its own value or the built-in, exit 0, when the hub checkout is missing", () => {
        const ws = workspace({ hubSettings: "github:\n  epic-label: hub-epic\n", memberSettings: "github:\n  project: acme/3\n" });
        fs.rmSync(ws.hub, { recursive: true, force: true });
        const project = resolved(ws.member, "project");
        const label = resolved(ws.member, "epic-label");
        expect([project.code, project.value, project.err]).toEqual([0, "acme/3", []]);
        expect([label.code, label.value, label.err]).toEqual([0, "epic", []]);
    });

    it("keeps the workspace-wide defaults when only the hub's settings file is unreadable", () => {
        const ws = workspace({ defaults: { project: "acme/9" } });
        // A directory where the settings file belongs cannot be read as one.
        fs.mkdirSync(path.join(ws.hub, ".nexus", "config", "settings.yml"));
        const result = resolved(ws.member, "project");
        expect([result.code, result.value, result.err]).toEqual([0, "acme/9", []]);
    });
});

describe("writing settings in a member", () => {
    it("never records a hub-supplied decision into the member's settings file", () => {
        const ws = workspace({ hubSettings: "github:\n  classification: types\n  project: acme/7\n" });
        const report = writeBackDecisions(ws.member, { classification: "types", discoveredProject: "acme/7" });
        expect(report.added).toEqual([]);
        expect(settingsOf(ws.member)).not.toMatch(/classification|project/);
    });

    it("still records a decision the hub does not supply", () => {
        const ws = workspace({ hubSettings: "github:\n  project: acme/7\n" });
        writeBackDecisions(ws.member, { classification: "labels" });
        expect(resolved(ws.member, "classification").value).toBe("labels");
        expect(settingsOf(ws.member)).toMatch(/classification: labels/);
    });

    it("leaves a hub-supplied setting unset when setup seeds the member", () => {
        const ws = workspace({ defaults: { classification: "types" }, hubSettings: "github:\n  project: acme/7\n" });
        const io = recordingIo(ws.member);
        const code: number = runConfig(
            ["write-github", "--root", ws.member, "--classification", "labels", "--project", "none"],
            io,
        );
        expect(code).toBe(0);
        expect(settingsOf(ws.member)).toBe("");
        expect(resolved(ws.member, "classification").value).toBe("types");
        expect(resolved(ws.member, "project").value).toBe("acme/7");
    });
});

describe("checkouts this change must leave alone", () => {
    it("resolves a single-repo checkout from its own settings and built-ins only", () => {
        const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "hub-inheritance-single-"));
        write(root, ".nexus/config/settings.yml", "github:\n  project: acme/1\n");
        expect(resolved(root, "project").value).toBe("acme/1");
        expect(resolved(root, "epic-label").value).toBe("epic");
        const io = recordingIo(root);
        runConfig(["write-github", "--root", root, "--classification", "labels"], io);
        expect(settingsOf(root)).toMatch(/classification: labels/);
    });

    it("resolves the hub checkout from its own settings over its workspace-wide defaults", () => {
        const ws = workspace({
            hubSettings: "github:\n  project: acme/7\n",
            defaults: { project: "acme/9", "epic-label": "hub-epic" },
        });
        expect(resolved(ws.hub, "project").value).toBe("acme/7");
        expect(resolved(ws.hub, "epic-label").value).toBe("hub-epic");
    });
});
