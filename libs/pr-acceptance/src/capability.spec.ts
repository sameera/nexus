import { describe, expect, it } from "vitest";
import {
    preflightCapabilities,
    remoteTeardownMode,
    requireAllMergeMethods,
    resolveAuth,
    resolveMergeMethods,
} from "./capability.js";
import { fakeRunner } from "./harness-fixtures.js";

const LOGIN = { match: "gh api user", result: { stdout: "sameera\n" } };
const scopesLine = (scopes: string) => ({
    match: "gh auth status",
    result: { stdout: `github.com\n  ✓ Logged in to github.com account sameera\n  - Token scopes: ${scopes}\n` },
});

describe("resolveAuth", () => {
    it("reports the login and the token's scopes", () => {
        const run = fakeRunner([LOGIN, scopesLine("'gist', 'repo', 'delete_repo'")]);
        const r = resolveAuth(run, "/tmp");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.login).toBe("sameera");
        expect(r.value.scopes).toEqual(["gist", "repo", "delete_repo"]);
    });

    it("reads scopes gh printed on stderr as well as stdout", () => {
        const run = fakeRunner([
            LOGIN,
            { match: "gh auth status", result: { stderr: "  - Token scopes: 'repo', 'delete_repo'\n" } },
        ]);
        const r = resolveAuth(run, "/tmp");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.scopes).toContain("delete_repo");
    });

    it("fails when gh cannot report an identity", () => {
        const run = fakeRunner([{ match: "gh api user", result: { status: 1, stderr: "not logged in" } }]);
        const r = resolveAuth(run, "/tmp");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-unauthenticated");
    });

    it("fails when gh reports an empty login", () => {
        const run = fakeRunner([{ match: "gh api user", result: { stdout: "\n" } }]);
        const r = resolveAuth(run, "/tmp");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-unauthenticated");
    });

    it("reports no scopes when gh prints none, rather than inventing them", () => {
        const run = fakeRunner([LOGIN, { match: "gh auth status", result: { stdout: "logged in\n" } }]);
        const r = resolveAuth(run, "/tmp");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.scopes).toEqual([]);
    });
});

describe("preflightCapabilities", () => {
    it("passes when the credential can delete a repository", () => {
        const run = fakeRunner([LOGIN, scopesLine("'repo', 'delete_repo'")]);
        const r = preflightCapabilities(run, "/tmp");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value).toMatchObject({ login: "sameera", canDelete: true });
    });

    it("refuses before creating anything when the credential cannot delete", () => {
        const run = fakeRunner([LOGIN, scopesLine("'repo', 'workflow'")]);
        const r = preflightCapabilities(run, "/tmp");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("missing-delete-scope");
        // The message must carry the exact remedy — this is a runbook-driven, on-demand exercise.
        expect(r.error.message).toContain("delete_repo");
    });

    it("propagates an authentication failure rather than reporting a capability", () => {
        const run = fakeRunner([{ match: "gh api user", result: { status: 1, stderr: "no auth" } }]);
        const r = preflightCapabilities(run, "/tmp");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-unauthenticated");
    });
});

describe("resolveMergeMethods", () => {
    const json = (s: boolean, m: boolean, rb: boolean) => ({
        match: "gh repo view",
        result: {
            stdout: JSON.stringify({ squashMergeAllowed: s, mergeCommitAllowed: m, rebaseMergeAllowed: rb }),
        },
    });

    it("reads all three merge methods off the repo", () => {
        const r = resolveMergeMethods(fakeRunner([json(true, true, false)]), "/tmp", "o/r");
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value).toEqual({ squash: true, merge: true, rebase: false });
    });

    it("fails on a gh error", () => {
        const run = fakeRunner([{ match: "gh repo view", result: { status: 1, stderr: "boom" } }]);
        const r = resolveMergeMethods(run, "/tmp", "o/r");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-failed");
    });

    it("fails on unparseable gh output", () => {
        const run = fakeRunner([{ match: "gh repo view", result: { stdout: "not json" } }]);
        const r = resolveMergeMethods(run, "/tmp", "o/r");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("gh-failed");
    });
});

describe("requireAllMergeMethods", () => {
    it("passes when squash, merge, and rebase are all enabled", () => {
        expect(requireAllMergeMethods({ squash: true, merge: true, rebase: true }, "o/r").ok).toBe(true);
    });

    it("names exactly the disabled methods, since each is a strategy under test", () => {
        const r = requireAllMergeMethods({ squash: true, merge: false, rebase: false }, "o/r");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("merge-methods-disabled");
        expect(r.error.message).toContain("merge");
        expect(r.error.message).toContain("rebase");
    });
});

describe("preflightCapabilities — the manual-teardown opt-in", () => {
    it("proceeds without the delete scope once the maintainer has opted in, and still reports it absent", () => {
        const run = fakeRunner([LOGIN, scopesLine("'repo', 'workflow'")]);
        const r = preflightCapabilities(run, "/tmp", { manualTeardown: true });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value).toMatchObject({ login: "sameera", canDelete: false });
    });

    it("does not claim a delete capability the credential actually has when opting in", () => {
        const run = fakeRunner([LOGIN, scopesLine("'repo', 'delete_repo'")]);
        const r = preflightCapabilities(run, "/tmp", { manualTeardown: true });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.canDelete).toBe(true);
    });

    it("names the opt-in in the refusal, so the escape hatch is discoverable from the failure", () => {
        const run = fakeRunner([LOGIN, scopesLine("'repo'")]);
        const r = preflightCapabilities(run, "/tmp");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.message).toContain("--manual-teardown");
    });
});

describe("remoteTeardownMode", () => {
    it("is automatic only when the credential can delete and the maintainer did not opt out", () => {
        expect(remoteTeardownMode({ login: "s", scopes: [], canDelete: true }, false)).toBe("automatic");
    });

    it("is manual when the maintainer opted in, even with a credential that could delete", () => {
        expect(remoteTeardownMode({ login: "s", scopes: [], canDelete: true }, true)).toBe("manual");
    });

    it("is manual whenever the credential cannot delete, opt-in or not", () => {
        expect(remoteTeardownMode({ login: "s", scopes: [], canDelete: false }, false)).toBe("manual");
    });
});
