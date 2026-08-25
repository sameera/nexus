import { describe, expect, it } from "vitest";
import { TARGET_ROOT_FLAG, takeTargetRoot } from "./target-root.js";

describe("takeTargetRoot", () => {
    it("defaults to the working directory when the flag is absent", () => {
        const result = takeTargetRoot(["--epic", "1"], "/cwd");
        expect(result).toEqual({ root: "/cwd", rest: ["--epic", "1"] });
    });

    it("extracts the flag's value and strips both from the remaining argv", () => {
        const result = takeTargetRoot(["--epic", "1", TARGET_ROOT_FLAG, "/somewhere", "--out", "x"], "/cwd");
        expect(result.root).toBe("/somewhere");
        expect(result.rest).toEqual(["--epic", "1", "--out", "x"]);
    });

    it("falls back to cwd and drops only the flag when it carries no value", () => {
        const result = takeTargetRoot(["--epic", "1", TARGET_ROOT_FLAG], "/cwd");
        expect(result).toEqual({ root: "/cwd", rest: ["--epic", "1"] });
    });

    it("does not treat the working directory as a definition when the flag is present", () => {
        const result = takeTargetRoot([TARGET_ROOT_FLAG, "/explicit"], "/cwd");
        expect(result.root).toBe("/explicit");
        expect(result.root).not.toBe("/cwd");
    });
});
