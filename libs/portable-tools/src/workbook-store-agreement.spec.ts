/**
 * The pipeline's store register and the teaching library's own workbook location must agree.
 *
 * Epic #677 separates two facts that used to be one constant: the register names the directories a
 * Nexus stage withholds from every diff it derives (decision record #450), and the teaching library
 * names where it writes a workbook. They are different facts held by different packages, and after
 * the teaching stage ships separately nothing can compare them. While both live in this workspace,
 * this spec does — so the separation is provably behaviour-preserving, and a drift between the two
 * is caught here rather than as a workbook's generated markup arriving in a conformance verdict.
 *
 * This file leaves with the teaching library (#692). Its job is to make the split safe, not to
 * outlive it.
 */

import { describe, expect, it } from "vitest";
import { WORKBOOK_STORE_PATH as TEACHING_WORKBOOK_PATH } from "@nexus/teaching/workbook-location";
import { EXCLUDED_STORE_PATHS, WORKBOOK_STORE_PATH, isExcludedStorePath } from "./pipeline-stores";

describe("the workbook store, named twice", () => {
    it("resolves to the same path on both sides of the package boundary", () => {
        expect(TEACHING_WORKBOOK_PATH).toBe(WORKBOOK_STORE_PATH);
    });

    it("is still withheld from every diff a stage derives", () => {
        expect(EXCLUDED_STORE_PATHS).toContain(TEACHING_WORKBOOK_PATH);
        expect(isExcludedStorePath(`${TEACHING_WORKBOOK_PATH}/some-roadmap/lessons/01.md`)).toBe(true);
    });
});
