/**
 * The pre-publish check the conformance gate hands its drafted verdict to (epic #751, story #757,
 * decision record #764, key decision "The repository-identity rule moves out of stage prose and
 * behind a callable pre-publish check").
 *
 * The case that has to fail is the live one: the verdicts on `geo-nexus/giccp#665` stamp the code
 * repository, name no issues repository, and carry bare story numbers that exist in both
 * repositories. The check judges the exact bytes that would have been published.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { TWO_VERDICT_REPO, verdictBody } from "@nexus/pr-acceptance/verdict-fixtures";
import { checkVerdictPublish } from "./publish-check.js";
import { type Runner } from "./run.js";

const made: string[] = [];

function checkout(settings?: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "publish-check-"));
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

/** The live cross-repository checkout: code in giccp, issues in docs. */
const CROSS_REPO_SETTINGS = "github:\n  issues-repo: geo-nexus/docs\n";

afterEach(() => {
    for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe("checkVerdictPublish — the drafted verdict names the repository its story numbers resolve against", () => {
    it("refuses the live body, which stamps the code repository and names no issues repository", () => {
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(CROSS_REPO_SETTINGS), verdictBody({ high: 0 }));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("issues-repo-missing");
    });

    it("names the value the refused block should have carried, so correcting it is mechanical", () => {
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(CROSS_REPO_SETTINGS), verdictBody({ high: 0 }));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.message).toContain("geo-nexus/docs");
    });

    it("approves a body that names the resolved issues repository", () => {
        const body = verdictBody({ high: 0, issuesRepo: "geo-nexus/docs" });
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(CROSS_REPO_SETTINGS), body);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.repos).toEqual({ issuesRepo: "geo-nexus/docs", repo: "geo-nexus/giccp" });
    });

    it("still requires the key when the issues and code repositories are the same repository", () => {
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(), verdictBody({ high: 0 }));
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("issues-repo-missing");
        expect(r.error.message).toContain("geo-nexus/giccp");
    });

    it("approves a same-repository body naming that one repository twice", () => {
        const body = verdictBody({ high: 0, issuesRepo: "geo-nexus/giccp" });
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(), body);
        expect(r.ok).toBe(true);
    });

    it("accepts the host-qualified written form the gate stamps, through the shared comparison rule", () => {
        const body = verdictBody({ high: 0, issuesRepo: TWO_VERDICT_REPO });
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(), body);
        expect(r.ok).toBe(true);
    });

    it("refuses a body naming some other repository's issues", () => {
        const body = verdictBody({ high: 0, issuesRepo: "someone-else/docs" });
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(CROSS_REPO_SETTINGS), body);
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("issues-repo-mismatch");
        expect(r.error.message).toContain("geo-nexus/docs");
    });

    it("refuses a drafted body carrying no machine block at all", () => {
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp"), checkout(), "Conformance: clean. No block here.");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("block-missing");
    });
});
