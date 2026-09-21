/**
 * Which verdict a pull request carries is decided by a command, not by prose a model executes
 * (epic #747, decision record #750, invariants 8 and 9).
 *
 * The defect this pins was not a wording defect: the close gate's instruction already said to take
 * the newest block, and a live close reported the older one's severity counts anyway. A rule whose
 * executor is a model is a rule no test can fail, so the gate must invoke the command and report
 * what it returns — and keep no hand-selection path as a fallback.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components.js";
import { DISPATCH_NAMES } from "./nexus-cli.js";

const CLOSE: string = fs.readFileSync(path.join(authoredComponentRoot(__dirname), "commands", "nxs.close.md"), "utf8");

describe("the close gate reaches the rule through the command", () => {
    it("invokes a registered command to read the pull request's verdict", () => {
        expect(CLOSE).toContain("nexus pr-verdict --pr");
        expect(DISPATCH_NAMES).toContain("pr-verdict");
    });

    it("tells the command which repository it is reading, so the trust check is live", () => {
        expect(CLOSE).toMatch(/nexus pr-verdict --pr \S+ --repo \S+/);
    });

    it("no longer restates the selection rule for a model to carry out", () => {
        expect(CLOSE).not.toMatch(/take the newest body containing/i);
        expect(CLOSE).not.toMatch(/authorAssociation/);
    });

    it("keeps no hand-selection fallback for the same question", () => {
        expect(CLOSE).not.toMatch(/gh pr view <N> --json reviews,comments/);
    });
});
