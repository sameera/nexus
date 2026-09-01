import { describe, expect, it } from "vitest";
import { renderDiagnostic, renderManualTeardownNotice } from "./render.js";

describe("renderDiagnostic", () => {
    it("names the problem and the fix on one line, like the sibling helpers do", () => {
        const line = renderDiagnostic({
            problem: "missing-delete-scope",
            message: "grant it with `gh auth refresh -h github.com -s delete_repo`.",
        });
        expect(line).toBe(
            "pr-acceptance missing-delete-scope: grant it with `gh auth refresh -h github.com -s delete_repo`.",
        );
    });
});

describe("renderManualTeardownNotice", () => {
    const notice = () =>
        renderManualTeardownNotice({
            nameWithOwner: "sameera/nexus-pr-acceptance-scratch",
            url: "https://github.com/sameera/nexus-pr-acceptance-scratch",
        });

    it("states that the repository still exists, in words that cannot be skimmed past", () => {
        expect(notice()).toContain("MANUAL CLEANUP REQUIRED");
        expect(notice()).toContain("NOT deleted");
    });

    it("names the surviving repository and its url, so cleanup needs nothing else on screen", () => {
        expect(notice()).toContain("sameera/nexus-pr-acceptance-scratch");
        expect(notice()).toContain("https://github.com/sameera/nexus-pr-acceptance-scratch");
    });

    it("carries the exact command that deletes it, scope grant included", () => {
        expect(notice()).toContain("gh auth refresh -h github.com -s delete_repo");
        expect(notice()).toContain("gh repo delete sameera/nexus-pr-acceptance-scratch --yes");
    });

    it("renders without a url when the remote never reported one", () => {
        const n = renderManualTeardownNotice({ nameWithOwner: "sameera/nexus-pr-acceptance-scratch", url: null });
        expect(n).toContain("sameera/nexus-pr-acceptance-scratch");
        expect(n).not.toContain("null");
    });
});
