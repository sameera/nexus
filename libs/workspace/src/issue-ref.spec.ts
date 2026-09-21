import { describe, expect, it } from "vitest";
import {
    formatIssueRef,
    issueRefsMatch,
    parseIssueRef,
    parseRepoIdentity,
    sameRepo,
    type PublicationContext,
} from "./issue-ref.js";

const DOCS = "geo-nexus/docs";
const CODE = "geo-nexus/giccp";

const into = (repo: string): PublicationContext => ({ kind: "repo", repo });
const nowhere: PublicationContext = { kind: "none" };

describe("parseIssueRef — the two legal forms", () => {
    it("reads the bare form, with or without the hash", () => {
        expect(parseIssueRef("#141")).toEqual({ repo: null, number: 141 });
        expect(parseIssueRef("141")).toEqual({ repo: null, number: 141 });
    });

    it("reads the qualified form and lowercases the repository", () => {
        expect(parseIssueRef("geo-nexus/docs#141")).toEqual({ repo: DOCS, number: 141 });
        expect(parseIssueRef("Geo-Nexus/Docs#141")).toEqual({ repo: DOCS, number: 141 });
    });

    it("tolerates surrounding whitespace", () => {
        expect(parseIssueRef("  geo-nexus/docs#141  ")).toEqual({ repo: DOCS, number: 141 });
    });

    it("rejects the full link form, which is not legal provenance", () => {
        expect(parseIssueRef("https://github.com/geo-nexus/docs/issues/141")).toBeNull();
    });

    it("rejects the literal markers and anything that is not a reference", () => {
        for (const token of ["bootstrap", "manual", "", "#", "#0", "0", "geo-nexus/docs#", "a/b/c#1", "#14a"]) {
            expect(parseIssueRef(token), token).toBeNull();
        }
    });
});

describe("sameRepo — repository identity is case-insensitive", () => {
    it("matches two spellings of one repository", () => {
        expect(sameRepo(DOCS, "Geo-Nexus/Docs")).toBe(true);
    });

    it("separates two repositories", () => {
        expect(sameRepo(DOCS, CODE)).toBe(false);
    });

    it("treats two unknowns as the same, and an unknown as never matching a known one", () => {
        expect(sameRepo(null, null)).toBe(true);
        expect(sameRepo(null, DOCS)).toBe(false);
        expect(sameRepo(DOCS, null)).toBe(false);
    });
});

describe("sameRepo — the host-qualified and bare forms name one repository (epic #747)", () => {
    const QUALIFIED = "github.com/geo-nexus/docs";

    it("matches a host-qualified identity against the bare one a reader expected", () => {
        expect(sameRepo(QUALIFIED, DOCS)).toBe(true);
        expect(sameRepo(DOCS, QUALIFIED)).toBe(true);
    });

    it("matches two host-qualified identities that agree", () => {
        expect(sameRepo(QUALIFIED, "GitHub.com/Geo-Nexus/Docs")).toBe(true);
    });

    it("separates two repositories however each is written", () => {
        expect(sameRepo(QUALIFIED, CODE)).toBe(false);
        expect(sameRepo(QUALIFIED, "github.com/" + CODE)).toBe(false);
        expect(sameRepo("github.com/other/docs", DOCS)).toBe(false);
    });

    it("treats a host stated on both sides as a fact that must agree", () => {
        expect(sameRepo(QUALIFIED, "gitlab.com/geo-nexus/docs")).toBe(false);
    });

    it("falls back to plain equality for a token that is not a repository identity at all", () => {
        expect(sameRepo("not a repo", "not a repo")).toBe(true);
        expect(sameRepo("a/b/c/d", DOCS)).toBe(false);
    });
});

describe("parseRepoIdentity — the two written forms of a repository", () => {
    it("reads the bare form, leaving the host unknown", () => {
        expect(parseRepoIdentity("geo-nexus/docs")).toEqual({ host: null, owner: "geo-nexus", name: "docs" });
    });

    it("reads the host-qualified form and lowercases every part", () => {
        expect(parseRepoIdentity("GitHub.com/Geo-Nexus/Docs")).toEqual({ host: "github.com", owner: "geo-nexus", name: "docs" });
    });

    it("rejects anything that is not one of the two forms", () => {
        for (const token of ["", "docs", "a/", "/docs", "a/b/c/d", "https://github.com/geo-nexus/docs"]) {
            expect(parseRepoIdentity(token), token).toBeNull();
        }
    });
});

describe("formatIssueRef — qualify only across a repository boundary", () => {
    it("writes the bare form when the reference is published into its own repository", () => {
        expect(formatIssueRef({ repo: DOCS, number: 141 }, into(DOCS))).toBe("#141");
    });

    it("ignores case when deciding the repositories are the same", () => {
        expect(formatIssueRef({ repo: DOCS, number: 141 }, into("Geo-Nexus/Docs"))).toBe("#141");
    });

    it("writes the qualified form when the reference crosses into another repository", () => {
        expect(formatIssueRef({ repo: DOCS, number: 141 }, into(CODE))).toBe("geo-nexus/docs#141");
    });

    it("writes the qualified form when there is no publishing repository at all", () => {
        expect(formatIssueRef({ repo: DOCS, number: 141 }, nowhere)).toBe("geo-nexus/docs#141");
    });

    it("writes the bare form whenever the reference's own repository is unknown", () => {
        expect(formatIssueRef({ repo: null, number: 141 }, into(CODE))).toBe("#141");
        expect(formatIssueRef({ repo: null, number: 141 }, nowhere)).toBe("#141");
    });
});

describe("formatIssueRef and parseIssueRef round-trip", () => {
    it("preserves the issue number through every context", () => {
        for (const context of [into(DOCS), into(CODE), nowhere]) {
            for (const repo of [DOCS, null]) {
                const written = formatIssueRef({ repo, number: 141 }, context);
                expect(parseIssueRef(written)?.number).toBe(141);
            }
        }
    });
});

describe("issueRefsMatch — a reader accepts either form", () => {
    it("matches a qualified reference against the bare one a reader expected", () => {
        expect(issueRefsMatch("geo-nexus/docs#114", "#114")).toBe(true);
        expect(issueRefsMatch("#114", "geo-nexus/docs#114")).toBe(true);
    });

    it("matches two references that are both bare, or both qualified alike", () => {
        expect(issueRefsMatch("#114", "#114")).toBe(true);
        expect(issueRefsMatch("geo-nexus/docs#114", "geo-nexus/docs#114")).toBe(true);
    });

    it("compares by number when both name a repository, so two resolvers cannot disagree", () => {
        expect(issueRefsMatch("geo-nexus/docs#114", "other/docs#114")).toBe(true);
    });

    it("separates two different issue numbers", () => {
        expect(issueRefsMatch("geo-nexus/docs#114", "#115")).toBe(false);
    });

    it("never matches when either side is not a reference at all", () => {
        expect(issueRefsMatch("bootstrap", "#114")).toBe(false);
        expect(issueRefsMatch("#114", "")).toBe(false);
    });
});
