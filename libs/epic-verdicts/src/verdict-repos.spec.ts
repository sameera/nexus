/**
 * The two repositories a published verdict names, resolved by the toolkit rather than handed to it
 * (epic #751, decision record #764, invariants 3 and 4).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveVerdictRepos } from "./verdict-repos.js";
import { type Runner } from "./run.js";

const made: string[] = [];

function checkout(settings?: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "verdict-repos-"));
    made.push(dir);
    if (settings !== undefined) {
        fs.mkdirSync(path.join(dir, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(dir, ".nexus", "config", "settings.yml"), settings);
    }
    return dir;
}

function ghRepo(nameWithOwner: string): Runner {
    return (cmd, args) => {
        if (cmd === "gh" && args[0] === "repo" && args[1] === "view") {
            return { status: 0, stdout: `${nameWithOwner}\n`, stderr: "" };
        }
        return { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
    };
}

const ghBroken: Runner = () => ({ status: 1, stdout: "", stderr: "could not determine the repository" });

afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("resolveVerdictRepos", () => {
    it("reads the issues repository the checkout declares, beside the code repository it sits in", () => {
        const dir = checkout("github:\n  epic-repo: geo-nexus/docs\n");
        const r = resolveVerdictRepos(ghRepo("geo-nexus/giccp"), dir);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.repos).toEqual({ issuesRepo: "geo-nexus/docs", repo: "geo-nexus/giccp" });
    });

    it("falls back to the checkout's own repository when nothing declares an issues repository", () => {
        const r = resolveVerdictRepos(ghRepo("sameera/nexus"), checkout());
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.repos).toEqual({ issuesRepo: "sameera/nexus", repo: "sameera/nexus" });
    });

    it("never resolves an empty issues repository, even when the declared value is blank", () => {
        const r = resolveVerdictRepos(ghRepo("sameera/nexus"), checkout("github:\n  issues-repo:\n"));
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.repos.issuesRepo).toBe("sameera/nexus");
    });

    it("stops the run when the repository cannot be resolved at all", () => {
        const r = resolveVerdictRepos(ghBroken, checkout());
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("repo-unresolved");
    });
});
