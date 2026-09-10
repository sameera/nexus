import * as fs from "node:fs";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { parsePrReference, resolveAnalyzeTarget } from "./member-target.js";
import { defaultRunner } from "./run.js";
import { initRepo, makeParent, writeCommit } from "./git-fixtures.js";

const tracked: string[] = [];
afterAll(() => {
    for (const d of tracked) fs.rmSync(d, { recursive: true, force: true });
});

function buildHubWithMember(parent: string, opts: { checkoutMember: boolean }): { hub: string; memberPath: string } {
    const hub = path.join(parent, "hub");
    initRepo(hub, "git@github.com:acme/hub.git");
    fs.mkdirSync(path.join(hub, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(
        path.join(hub, ".nexus", "config", "workspace.yml"),
        "hub:\n  name: hub\n  remote: git@github.com:acme/hub.git\n" +
            "members:\n  - name: widget\n    remote: git@github.com:acme/widget.git\n",
    );
    writeCommit(hub, "base.txt", "base\n", "init");

    const memberPath = path.join(parent, "widget");
    if (opts.checkoutMember) {
        initRepo(memberPath, "git@github.com:acme/widget.git");
        writeCommit(memberPath, "base.txt", "base\n", "init");
    }
    return { hub, memberPath };
}

describe("parsePrReference", () => {
    it("parses a bare PR number", () => {
        expect(parsePrReference("492")).toEqual({ repo: null, number: 492 });
    });

    it("parses a repo-qualified reference", () => {
        expect(parsePrReference("acme/widget#492")).toEqual({ repo: "acme/widget", number: 492 });
    });

    it("parses a pull-request URL", () => {
        expect(parsePrReference("https://github.com/acme/widget/pull/492")).toEqual({ repo: "acme/widget", number: 492 });
    });

    it("rejects an unrecognized string", () => {
        expect(parsePrReference("not-a-reference")).toBeNull();
    });
});

describe("resolveAnalyzeTarget", () => {
    it("a bare number targets this checkout's own repository", () => {
        const repo = path.join(makeParent(tracked), "solo");
        initRepo(repo, "git@github.com:acme/solo.git");
        writeCommit(repo, "base.txt", "base\n", "init");

        const r = resolveAnalyzeTarget(repo, defaultRunner, "492");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.target.role).toBe("single-repo");
        expect(path.resolve(r.target.repoRoot)).toBe(path.resolve(repo));
        expect(r.target.repoIdentity).toContain("acme/solo");
    });

    it("a bare number run from inside a member checkout self-selects that member", () => {
        const parent = makeParent(tracked);
        const member = path.join(parent, "widget");
        initRepo(member, "git@github.com:acme/widget.git");
        fs.mkdirSync(path.join(member, ".nexus", "config"), { recursive: true });
        fs.writeFileSync(path.join(member, ".nexus", "config", "hub.yml"), "hub:\n  name: hub\n  remote: git@github.com:acme/hub.git\n");
        writeCommit(member, "base.txt", "base\n", "init");

        const r = resolveAnalyzeTarget(member, defaultRunner, "492");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.target.role).toBe("member");
        expect(path.resolve(r.target.repoRoot)).toBe(path.resolve(member));
    });

    it("a repo-qualified reference targets a declared, checked-out member", () => {
        const parent = makeParent(tracked);
        const { hub, memberPath } = buildHubWithMember(parent, { checkoutMember: true });

        const r = resolveAnalyzeTarget(hub, defaultRunner, "acme/widget#492");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.target.role).toBe("member");
        expect(path.resolve(r.target.repoRoot)).toBe(path.resolve(memberPath));
        expect(r.target.repoIdentity).toBe("github.com/acme/widget");
    });

    it("reads the member's own checkout, not the hub's", () => {
        const parent = makeParent(tracked);
        const { hub, memberPath } = buildHubWithMember(parent, { checkoutMember: true });
        writeCommit(memberPath, "only-in-member.txt", "x\n", "member-only commit");

        const r = resolveAnalyzeTarget(hub, defaultRunner, "acme/widget#492");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(fs.existsSync(path.join(r.target.repoRoot, "only-in-member.txt"))).toBe(true);
    });

    it("refuses a repository the workspace does not declare", () => {
        const parent = makeParent(tracked);
        const { hub } = buildHubWithMember(parent, { checkoutMember: true });

        const r = resolveAnalyzeTarget(hub, defaultRunner, "acme/unknown#1");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("undeclared-member");
        expect(r.error.message).toContain("acme/unknown");
    });

    it("stops and names the expected path when a declared member is not checked out", () => {
        const parent = makeParent(tracked);
        const { hub, memberPath } = buildHubWithMember(parent, { checkoutMember: false });

        const r = resolveAnalyzeTarget(hub, defaultRunner, "acme/widget#492");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("member-checkout-missing");
        expect(r.error.message).toContain(path.resolve(memberPath));
    });

    it("rejects a malformed PR reference", () => {
        const repo = path.join(makeParent(tracked), "solo2");
        initRepo(repo, "git@github.com:acme/solo2.git");
        writeCommit(repo, "base.txt", "base\n", "init");

        const r = resolveAnalyzeTarget(repo, defaultRunner, "not-a-reference");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("malformed-pr-reference");
    });
});
