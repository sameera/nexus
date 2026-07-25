import * as os from "node:os";
import { describe, expect, it } from "vitest";
import {
    MARKER_PATH,
    MARKER_SIGNATURE,
    SCRATCH_REPO_NAME,
    cloneDir,
    evidenceDir,
    parseMarker,
    renderMarker,
    scenarioBranch,
    scratchIdentity,
} from "./names.js";

describe("scratchIdentity", () => {
    it("names one deterministic repo per owner, so teardown always has a single target", () => {
        expect(scratchIdentity("sameera")).toEqual({
            owner: "sameera",
            name: SCRATCH_REPO_NAME,
            nameWithOwner: `sameera/${SCRATCH_REPO_NAME}`,
        });
        // Same owner, same name — a second provision cannot mint a look-alike.
        expect(scratchIdentity("sameera")).toEqual(scratchIdentity("sameera"));
    });
});

describe("marker", () => {
    it("round-trips the fields the delete guard cross-checks", () => {
        const text = renderMarker({
            nameWithOwner: "sameera/scratch",
            toolchainCommit: "a".repeat(40),
            provisionedAt: "2026-07-25",
        });
        const parsed = parseMarker(text);
        expect(parsed).toEqual({
            signature: MARKER_SIGNATURE,
            nameWithOwner: "sameera/scratch",
            toolchainCommit: "a".repeat(40),
            provisionedAt: "2026-07-25",
        });
    });

    it("renders the signature so a human reading the repo knows what wrote it", () => {
        const text = renderMarker({
            nameWithOwner: "o/r",
            toolchainCommit: "b".repeat(40),
            provisionedAt: "2026-07-25",
        });
        expect(text).toContain(MARKER_SIGNATURE);
        expect(text).toContain("o/r");
    });

    it("rejects text that is not a harness marker", () => {
        expect(parseMarker("")).toBeNull();
        expect(parseMarker("# just a readme\n")).toBeNull();
        expect(parseMarker("signature: something-else\nnameWithOwner: o/r\n")).toBeNull();
    });

    it("rejects a marker missing the fields the guard needs", () => {
        expect(parseMarker(`signature: ${MARKER_SIGNATURE}\n`)).toBeNull();
        expect(parseMarker(`signature: ${MARKER_SIGNATURE}\nnameWithOwner: o/r\n`)).toBeNull();
    });

    it("has a fixed path so the guard can fetch it without provision state", () => {
        expect(MARKER_PATH).toBe(".nexus-acceptance-harness");
    });
});

describe("local paths", () => {
    it("puts the disposable clone under the temp dir, never inside the Nexus checkout", () => {
        const dir = cloneDir("sameera");
        expect(dir.startsWith(os.tmpdir())).toBe(true);
        expect(dir).toContain("sameera");
    });

    it("keeps evidence beside the clone but not inside it, so teardown of the clone spares it", () => {
        const clone = cloneDir("sameera");
        const evidence = evidenceDir("sameera");
        expect(evidence.startsWith(os.tmpdir())).toBe(true);
        expect(evidence.startsWith(clone + "/")).toBe(false);
    });
});

describe("scenarioBranch", () => {
    it("derives a git-safe branch from the scenario id", () => {
        expect(scenarioBranch("chain-a1b2c3d4")).toBe("acceptance/chain-a1b2c3d4");
    });
});
