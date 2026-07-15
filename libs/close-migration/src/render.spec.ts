import { describe, expect, it } from "vitest";
import { type MigrationDiagnostic } from "./diagnostic";
import { type MigrateOutcome } from "./migrate";
import { type ClosePreflight } from "./preflight";
import { renderMigrateOutcome, renderMigrationFailure, renderPreflight } from "./render";

describe("renderPreflight", () => {
    it("renders member mode with the repo identity, hub root, branch, and hub remote", () => {
        const preflight: ClosePreflight = {
            role: "member",
            repoRoot: "/ws/web-app",
            repo: { identity: "github.com/acme/web-app", source: "origin" },
            hub: {
                name: "docs-hub",
                normalizedRemote: "github.com/acme/docs-hub",
                root: "/ws/docs-hub",
                branch: "main",
            },
        };

        const text = renderPreflight(preflight);
        expect(text).toContain("member");
        expect(text).toContain("github.com/acme/web-app");
        expect(text).toContain("/ws/docs-hub");
        expect(text).toContain("main");
        expect(text).toContain("github.com/acme/docs-hub");
    });

    it("renders single-repo mode with the repo identity", () => {
        const preflight: ClosePreflight = {
            role: "single-repo",
            repoRoot: "/repo/solo",
            repo: { identity: "github.com/acme/solo", source: "origin" },
        };

        const text = renderPreflight(preflight);
        expect(text).toContain("single-repo");
        expect(text).toContain("github.com/acme/solo");
    });

    it("renders hub mode stating the entry stays (the hub drains its own queue)", () => {
        const preflight: ClosePreflight = {
            role: "hub",
            repoRoot: "/ws/docs-hub",
            repo: { identity: "github.com/acme/docs-hub", source: "origin" },
        };

        const text = renderPreflight(preflight);
        expect(text).toContain("hub");
        expect(text).toMatch(/drains its own queue/);
    });
});

describe("renderMigrationFailure", () => {
    it("names the problem, file, entry, and message", () => {
        const error: MigrationDiagnostic = {
            file: "/ws/web-app/.nexus/queue/demo-epic-ab12cd34",
            entry: "demo-epic-ab12cd34",
            problem: "entry-conflict",
            message: "the hub queue already holds this entry and it differs",
        };

        const text = renderMigrationFailure(error);
        expect(text).toContain("Close migration failed:");
        expect(text).toContain("entry-conflict");
        expect(text).toContain("file:");
        expect(text).toContain(error.file);
        expect(text).toContain("entry:");
        expect(text).toContain(error.entry);
        expect(text).toContain(error.message);
    });

    it("omits the entry line when entry is absent", () => {
        const error: MigrationDiagnostic = {
            file: "/repo",
            problem: "not-a-git-repo",
            message: "/repo is not inside a git checkout",
        };

        const text = renderMigrationFailure(error);
        expect(text).not.toContain("entry:");
    });
});

describe("renderMigrateOutcome", () => {
    it("contains the entry name, hub commit, hub branch, removal commit, and push instruction", () => {
        const outcome: MigrateOutcome = {
            entryName: "demo-epic-ab12cd34",
            hubRoot: "/ws/docs-hub",
            hubBranch: "main",
            hubCommit: "a".repeat(40),
            alreadyMigrated: false,
            removalCommit: "b".repeat(40),
        };

        const text = renderMigrateOutcome(outcome);
        expect(text).toContain("demo-epic-ab12cd34");
        expect(text).toContain("a".repeat(40));
        expect(text).toContain("main");
        expect(text).toContain("b".repeat(40));
        expect(text).toContain("git -C /ws/docs-hub push");
    });

    it("states no removal commit when the entry held no tracked files", () => {
        const outcome: MigrateOutcome = {
            entryName: "demo-epic-ab12cd34",
            hubRoot: "/ws/docs-hub",
            hubBranch: "main",
            hubCommit: "a".repeat(40),
            alreadyMigrated: false,
            removalCommit: null,
        };

        expect(renderMigrateOutcome(outcome)).toMatch(/nothing to commit/);
    });

    it("states when the hub already held the entry verbatim", () => {
        const outcome: MigrateOutcome = {
            entryName: "demo-epic-ab12cd34",
            hubRoot: "/ws/docs-hub",
            hubBranch: "main",
            hubCommit: "a".repeat(40),
            alreadyMigrated: true,
            removalCommit: null,
        };

        expect(renderMigrateOutcome(outcome)).toMatch(/already held/);
    });
});
