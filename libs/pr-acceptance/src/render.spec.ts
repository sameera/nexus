import { describe, expect, it } from "vitest";
import { renderDiagnostic } from "./render.js";

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
