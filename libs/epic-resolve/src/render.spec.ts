import { describe, expect, it } from "vitest";
import { renderDiagnostic } from "./render.js";

describe("renderDiagnostic", () => {
    it("renders one line naming the problem and the message", () => {
        expect(renderDiagnostic({ problem: "epic-not-found", message: "gh issue view 9 failed" })).toBe(
            "epic-resolve epic-not-found: gh issue view 9 failed",
        );
    });
});
