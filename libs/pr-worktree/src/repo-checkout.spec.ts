import * as fs from "node:fs";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { initRepo, makeParent, writeCommit } from "./git-fixtures.js";
import { resolveRepoCheckout } from "./repo-checkout.js";
import { defaultRunner } from "./run.js";

const tracked: string[] = [];
afterAll(() => {
    for (const d of tracked) fs.rmSync(d, { recursive: true, force: true });
});

function buildHub(parent: string, opts: { checkoutMember: boolean }): { hub: string; memberPath: string } {
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

describe("resolveRepoCheckout (epic #828, story #841)", () => {
    it("a pull request merged in this single-repo checkout's own repository resolves to it", () => {
        const repo = path.join(makeParent(tracked), "solo");
        initRepo(repo, "git@github.com:acme/solo.git");
        writeCommit(repo, "base.txt", "base\n", "init");

        const r = resolveRepoCheckout(repo, defaultRunner, "acme/solo");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(path.resolve(r.checkout)).toBe(path.resolve(repo));
    });

    it("a single-repo checkout names a repository it is not, and offers no other checkout", () => {
        const repo = path.join(makeParent(tracked), "solo");
        initRepo(repo, "git@github.com:acme/solo.git");
        writeCommit(repo, "base.txt", "base\n", "init");

        const r = resolveRepoCheckout(repo, defaultRunner, "acme/elsewhere");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("repo-checkout-unknown");
        expect(r.error.message).toContain("acme/elsewhere");
    });

    it("in a hub, the hub's own repository resolves to the hub checkout", () => {
        const { hub } = buildHub(makeParent(tracked), { checkoutMember: true });
        const r = resolveRepoCheckout(hub, defaultRunner, "acme/hub");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(path.resolve(r.checkout)).toBe(path.resolve(hub));
    });

    it("in a hub, a declared member resolves to its own checkout, never the hub's", () => {
        const { hub, memberPath } = buildHub(makeParent(tracked), { checkoutMember: true });
        const r = resolveRepoCheckout(hub, defaultRunner, "github.com/acme/widget");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(path.resolve(r.checkout)).toBe(path.resolve(memberPath));
    });

    it("in a hub, a member with no checkout stops and names the expected path", () => {
        const { hub, memberPath } = buildHub(makeParent(tracked), { checkoutMember: false });
        const r = resolveRepoCheckout(hub, defaultRunner, "acme/widget");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("member-checkout-missing");
        expect(r.error.message).toContain(path.resolve(memberPath));
        expect(r.expectedPath && path.resolve(r.expectedPath)).toBe(path.resolve(memberPath));
        expect(fs.existsSync(memberPath)).toBe(false);
    });

    it("in a hub, a repository the manifest does not declare is named", () => {
        const { hub } = buildHub(makeParent(tracked), { checkoutMember: true });
        const r = resolveRepoCheckout(hub, defaultRunner, "acme/unknown");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("repo-checkout-unknown");
        expect(r.error.message).toContain("acme/unknown");
    });
});
