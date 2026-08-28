/**
 * The named keys and the decisions they carry (story #358) — the cases the Python
 * `test_delivery_config` and `test_needs_design_label` suites asserted.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { runNexusGh } from "./dispatch";
import { type ToolkitIo } from "./io";
import { epicNeedsDesign, resolveClassification, resolveProjectTarget } from "./publishing";
import { resolvePublishingKey } from "./resolve";

function repoWith(settings: string | null): string {
    const root: string = fs.mkdtempSync(path.join(os.tmpdir(), "publishing-"));
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    if (settings !== null) fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), settings);
    return root;
}

function cliValue(root: string, key: string): string {
    const out: string[] = [];
    const io: ToolkitIo = { cwd: root, stdout: (line) => out.push(line), stderr: () => undefined };
    expect(runNexusGh(["config", "resolve", key, "--root", root], io)).toBe(0);
    return out.join("\n");
}

describe("classification", () => {
    it("returns the declared mode, and legacy-auto when none is declared", () => {
        expect(resolveClassification({ classification: "types" })).toBe("types");
        expect(resolveClassification({ classification: "labels" })).toBe("labels");
        expect(resolveClassification({})).toBe("legacy-auto");
        expect(resolveClassification({ classification: "nonsense" })).toBe("legacy-auto");
    });
});

describe("the marker labels and types", () => {
    it("defaults epic-label and story-label rather than resolving them empty", () => {
        const root: string = repoWith("github:\n  project: none\n");
        expect(cliValue(root, "epic-label")).toBe("epic");
        expect(cliValue(root, "story-label")).toBe("story");
    });

    it.each([
        ["unplanned-label", "backlog"],
        ["record-label", "decision-record"],
        ["record-type", "Decision Record"],
        ["needs-design-label", "needs-design"],
        ["in-progress-label", "in-progress"],
    ])("%s falls back to its built-in and yields to a declared value", (key, builtin) => {
        expect(cliValue(repoWith("github:\n  project: none\n"), key)).toBe(builtin);
        expect(cliValue(repoWith(`github:\n  ${key}: declared-value\n`), key)).toBe("declared-value");
    });
});

describe("the needs-design decision", () => {
    it.each(["S", "s", "XS", " xs "])("is false for a rollup of %s", (complexity) => {
        expect(epicNeedsDesign(complexity)).toBe(false);
    });

    it.each(["M", "L", "XL", "", null, undefined, "nonsense"])("is true for a rollup of %s", (complexity) => {
        expect(epicNeedsDesign(complexity)).toBe(true);
    });
});

describe("the project target", () => {
    it("targets no project, and performs no discovery, when the repository declares none", () => {
        expect(resolveProjectTarget({ project: "none" })).toEqual({ mode: "none" });
        expect(resolveProjectTarget({ project: "NONE" })).toEqual({ mode: "none" });
    });

    it("is auto when nothing is declared, and the declared target when one is", () => {
        expect(resolveProjectTarget({})).toEqual({ mode: "auto" });
        expect(resolveProjectTarget({ project: "auto" })).toEqual({ mode: "auto" });
        expect(resolveProjectTarget({ project: "acme/7" })).toEqual({ mode: "explicit", value: "acme/7" });
        expect(resolveProjectTarget({ project: "My Project" })).toEqual({ mode: "explicit", value: "My Project" });
    });
});

describe("repository targeting", () => {
    it("lets the specific epic-repo and story-repo win over the general issues-repo", () => {
        const root: string = repoWith("github:\n  issues-repo: acme/general\n  epic-repo: acme/epics\n");
        expect(cliValue(root, "epic-repo")).toBe("acme/epics");
        expect(cliValue(root, "story-repo")).toBe("acme/general");
    });

    it("returns the general issues-repo when neither specific key is declared", () => {
        const root: string = repoWith("github:\n  issues-repo: acme/general\n");
        expect(cliValue(root, "epic-repo")).toBe("acme/general");
        expect(cliValue(root, "story-repo")).toBe("acme/general");
    });
});

describe("the worktree path", () => {
    it("prints a declared value verbatim, and an empty line when none is declared", () => {
        expect(cliValue(repoWith('github:\n  worktree-path: "~/wt"\n'), "worktree-path")).toBe('"~/wt"');
        expect(cliValue(repoWith("github:\n  project: none\n"), "worktree-path")).toBe("");
        expect(resolvePublishingKey(repoWith(null), "worktree-path")).toBe("");
    });
});
