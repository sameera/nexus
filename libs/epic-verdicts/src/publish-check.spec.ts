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
import { TWO_VERDICT_REPO, TWO_VERDICT_STORY, verdictBody } from "@nexus/pr-acceptance/verdict-fixtures";
import { recordDigest } from "@nexus/record-digest/digest";
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

/** The story body the platform currently holds, per `owner/repo#n`; a string starting `!` fails the read. */
type Bodies = Record<string, string>;

const STORY_BODY = "As a lead\r\n\r\n- [ ] Given a story, when close reads it, then it sees it.  \r\n";

function ghRepo(nameWithOwner: string, bodies: Bodies = {}, seen: string[][] = []): Runner {
    return (cmd, args) => {
        seen.push([cmd, ...args]);
        if (cmd === "gh" && args[0] === "repo" && args[1] === "view") {
            return { status: 0, stdout: `${nameWithOwner}\n`, stderr: "" };
        }
        const issue = cmd === "gh" && args[0] === "api" ? /^repos\/(.+)\/issues\/(\d+)$/.exec(args[1] ?? "") : null;
        if (issue !== null) {
            const body = bodies[`${issue[1]}#${issue[2]}`];
            if (body === undefined) return { status: 1, stdout: "", stderr: "gh: Not Found (HTTP 404)" };
            if (body.startsWith("!")) return { status: 1, stdout: "", stderr: body.slice(1) };
            return { status: 0, stdout: JSON.stringify({ body, state: "open", state_reason: null }), stderr: "" };
        }
        return { status: 1, stdout: "", stderr: `unexpected: ${cmd} ${args.join(" ")}` };
    };
}

/** The live cross-repository checkout: code in giccp, issues in docs. */
const CROSS_REPO_SETTINGS = "github:\n  issues-repo: geo-nexus/docs\n";

const DIGEST = recordDigest(STORY_BODY);
const FP = `{ ${TWO_VERDICT_STORY}: ${DIGEST} }`;

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
        const body = verdictBody({ high: 0, issuesRepo: "geo-nexus/docs", storyFingerprints: FP });
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp", { [`geo-nexus/docs#${TWO_VERDICT_STORY}`]: STORY_BODY }), checkout(CROSS_REPO_SETTINGS), body);
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
        const body = verdictBody({ high: 0, issuesRepo: "geo-nexus/giccp", storyFingerprints: FP });
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp", { [`geo-nexus/giccp#${TWO_VERDICT_STORY}`]: STORY_BODY }), checkout(), body);
        expect(r.ok).toBe(true);
    });

    it("accepts the host-qualified written form the gate stamps, through the shared comparison rule", () => {
        const body = verdictBody({ high: 0, issuesRepo: TWO_VERDICT_REPO, storyFingerprints: FP });
        const r = checkVerdictPublish(ghRepo("geo-nexus/giccp", { [`geo-nexus/giccp#${TWO_VERDICT_STORY}`]: STORY_BODY }), checkout(), body);
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

describe("checkVerdictPublish — one current fingerprint per named story (epic #827, story #836)", () => {
    const STORY = TWO_VERDICT_STORY;
    const KEY = `geo-nexus/docs#${STORY}`;
    const draft = (fp?: string) => verdictBody({ high: 0, issuesRepo: "geo-nexus/docs", storyFingerprints: fp });
    const check = (fp: string | undefined, bodies: Bodies, seen: string[][] = []) =>
        checkVerdictPublish(ghRepo("geo-nexus/giccp", bodies, seen), checkout(CROSS_REPO_SETTINGS), draft(fp));

    it("approves a fingerprint equal to the record digest of the story body as fetched from the issues repository", () => {
        const seen: string[][] = [];
        const r = check(`{ ${STORY}: ${DIGEST} }`, { [KEY]: STORY_BODY }, seen);
        expect(r.ok).toBe(true);
        expect(seen.some((c) => c.includes(`repos/geo-nexus/docs/issues/${STORY}`))).toBe(true);
    });

    it("treats a line-ending or trailing-space change as no change, the record digest's own rule", () => {
        const r = check(`{ ${STORY}: ${DIGEST} }`, { [KEY]: STORY_BODY.replace(/\r\n/g, "\n").replace(/  \n/, "\n") });
        expect(r.ok).toBe(true);
    });

    it("refuses when the story was edited after its fingerprint was taken, telling the lead to run analyze again", () => {
        const r = check(`{ ${STORY}: ${DIGEST} }`, { [KEY]: STORY_BODY.replace("sees it", "sees all of it") });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("story-fingerprint-mismatch");
        expect(r.error.message).toContain(String(STORY));
        expect(r.error.message).toMatch(/analyze/);
    });

    it("refuses a named story with no fingerprint", () => {
        const r = check(undefined, { [KEY]: STORY_BODY });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("story-fingerprint-missing");
        expect(r.error.message).toContain(String(STORY));
    });

    it("refuses a fingerprint for a story the receipt does not name", () => {
        const r = check(`{ ${STORY}: ${DIGEST}, 99999: ${DIGEST} }`, { [KEY]: STORY_BODY });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("story-fingerprint-extra");
        expect(r.error.message).toContain("99999");
    });

    it("refuses a shortened fingerprint", () => {
        const r = check(`{ ${STORY}: ${DIGEST.slice(0, 12)} }`, { [KEY]: STORY_BODY });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("story-fingerprint-mismatch");
    });

    it("refuses when the story's current text cannot be fetched", () => {
        const r = check(`{ ${STORY}: ${DIGEST} }`, { [KEY]: "!HTTP 502: Bad Gateway" });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("story-unreadable");
        expect(r.error.message).toContain("502");
    });
});
