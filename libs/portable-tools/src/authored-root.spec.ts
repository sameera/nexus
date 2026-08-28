/**
 * The authored component tree and the path the harness loads are two different places (epic #256).
 *
 * This repository authored its components at `.claude/` — the very directory the harness reads —
 * so the file sitting at a loaded path was not the file that actually ran whenever the maintainer
 * had not pointed their install location at the checkout. The tree now lives at an ordinary tracked
 * directory the harness never loads, and the account's install location is the only way those
 * components ever run.
 *
 * Two properties are asserted here rather than observed once, because both are the kind that go
 * quiet when they break: where the authored root is (invariant 4 — one definition, and it is this
 * one), and that nothing Nexus owns has reappeared under the loaded path (invariant 2).
 */

import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { isNexusNamespacedPath } from "./nexus-namespace";
import {
    AUTHORED_ROOT_DIRNAME,
    authoredComponentRoot,
    COMPONENT_SUBTREES,
    listComponentFiles,
} from "./vendor-components";

const REPO_ROOT: string = path.resolve(import.meta.dirname, "..", "..", "..");
const LOADED_DIR: string = path.join(REPO_ROOT, ".claude");

describe("the authored component root", () => {
    it("is an ordinary tracked directory at the repository root, not one the harness reads", () => {
        expect(AUTHORED_ROOT_DIRNAME.startsWith(".")).toBe(false);
        expect(AUTHORED_ROOT_DIRNAME).not.toContain("/");
        expect(authoredComponentRoot(import.meta.dirname)).toBe(path.join(REPO_ROOT, AUTHORED_ROOT_DIRNAME));
    });

    it("carries the managed subtrees and the Nexus components", () => {
        const root: string = authoredComponentRoot(import.meta.dirname);
        for (const subtree of COMPONENT_SUBTREES) {
            expect(fs.existsSync(path.join(root, subtree)), `${root}/${subtree}`).toBe(true);
        }
        const files: string[] = listComponentFiles(root);
        expect(files).toContain("commands/nxs.setup.md");
        expect(files.some((rel) => rel.startsWith("skills/nxs-workspace-status/"))).toBe(true);
    });
});

describe("the path the harness loads in this repository", () => {
    it("carries no Nexus-namespaced component file", () => {
        const offenders: string[] = fs.existsSync(LOADED_DIR)
            ? listComponentFiles(LOADED_DIR).filter(isNexusNamespacedPath)
            : [];

        expect(offenders).toEqual([]);
    });

    it("has nothing tracked under it at all, so a fresh clone does not have one", () => {
        const tracked: string = execFileSync("git", ["ls-files", "--", ".claude"], {
            cwd: REPO_ROOT,
            encoding: "utf8",
        }).trim();

        expect(tracked).toBe("");
    });
});
