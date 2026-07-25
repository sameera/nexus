import { describe, expect, it } from "vitest";
import { assertScratchTarget, verifyDeleteGuard } from "./guard.js";
import { MARKER_SIGNATURE, SCRATCH_REPO_NAME, renderMarker, scratchIdentity } from "./names.js";

const goodMarker = renderMarker({
    nameWithOwner: `sameera/${SCRATCH_REPO_NAME}`,
    toolchainCommit: "c".repeat(40),
    provisionedAt: "2026-07-25",
});

const base = {
    owner: "sameera",
    name: SCRATCH_REPO_NAME,
    expectedOwner: "sameera",
    markerText: goodMarker as string | null,
};

describe("verifyDeleteGuard", () => {
    it("permits deletion only when name, owner, and marker all agree", () => {
        const r = verifyDeleteGuard(base);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.toolchainCommit).toBe("c".repeat(40));
    });

    it("refuses a repo whose name is not the deterministic scratch name", () => {
        const r = verifyDeleteGuard({ ...base, name: "nexus" });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("name-mismatch");
        expect(r.error.message).toContain("nexus");
    });

    it("refuses a repo under an owner the harness did not provision under", () => {
        const r = verifyDeleteGuard({ ...base, owner: "someone-else" });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("owner-mismatch");
    });

    it("refuses when no marker could be read — an unmarked repo is never ours", () => {
        const r = verifyDeleteGuard({ ...base, markerText: null });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("marker-mismatch");
    });

    it("refuses a marker that is not the harness's own", () => {
        const r = verifyDeleteGuard({ ...base, markerText: "signature: someone-elses-tool\n" });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("marker-mismatch");
    });

    it("refuses a marker that names a different repository", () => {
        const stolen = renderMarker({
            nameWithOwner: "other/repo",
            toolchainCommit: "d".repeat(40),
            provisionedAt: "2026-07-25",
        });
        const r = verifyDeleteGuard({ ...base, markerText: stolen });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("marker-mismatch");
        expect(r.error.message).toContain("other/repo");
    });

    it("names the signature it expected, so a refusal is diagnosable", () => {
        const r = verifyDeleteGuard({ ...base, markerText: "nothing here" });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.message).toContain(MARKER_SIGNATURE);
    });
});

describe("assertScratchTarget", () => {
    const scratch = scratchIdentity("sameera");

    it("accepts something created on the scratch repo", () => {
        const url = `https://github.com/${scratch.nameWithOwner}/issues/7`;
        const r = assertScratchTarget(url, scratch, "epic issue");
        expect(r.ok).toBe(true);
    });

    it("refuses when the harness filed against the Nexus repo itself", () => {
        const r = assertScratchTarget("https://github.com/sameera/nexus/issues/7", scratch, "epic issue");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("host-repo-mutation");
        expect(r.error.message).toContain("sameera/nexus");
    });

    it("refuses rather than guessing when the target repo cannot be read off the URL", () => {
        const r = assertScratchTarget("not-a-url", scratch, "pull request");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error.problem).toBe("host-repo-mutation");
    });
});
