/**
 * Story #380 — classification and the target repository resolve before the issue is filed.
 *
 * Both answers come from the shared resolver, so what is asserted here is the *decision* each mode
 * reaches, not the resolution rules underneath it: an epic filed after the port has to be
 * indistinguishable from one filed before it.
 */

import { describe, expect, it } from "vitest";
import { layersAt } from "../resolve";
import { planClassification, resolveEpicConfig } from "./configure";
import { checkoutWith, draft, fakeEnvironment, recordingIo, writeDraft } from "./fixtures";
import { runCreateEpic } from "./run";

function configFor(github: Record<string, string>, frontmatter: Record<string, string> = {}) {
    return resolveEpicConfig(layersAt(checkoutWith(github)), frontmatter);
}

describe("the classification each mode reaches", () => {
    it("applies a type after creation and passes no label, in types mode", () => {
        const plan = planClassification(configFor({ classification: "types", "epic-type": "Epic" }));
        expect(plan).toEqual({ issueType: "Epic", createLabel: null, warning: null });
    });

    it("warns and files untyped in types mode with no resolvable type, substituting no label", () => {
        const plan = planClassification(configFor({ classification: "types" }));
        expect(plan.issueType).toBeNull();
        expect(plan.createLabel).toBeNull();
        expect(plan.warning).toContain("filing untyped");
    });

    it("passes the epic classification label at creation, in labels mode", () => {
        const plan = planClassification(configFor({ classification: "labels" }));
        expect(plan).toEqual({ issueType: null, createLabel: "epic", warning: null });
    });

    it("prefers a type in legacy-auto, and falls back to the label when none resolves", () => {
        expect(planClassification(configFor({ "epic-type": "Epic" }))).toMatchObject({
            issueType: "Epic",
            createLabel: null,
        });
        expect(planClassification(configFor({}))).toMatchObject({ issueType: null, createLabel: "epic" });
    });

    it("lets the draft's own type outrank the configured epic type", () => {
        const config = configFor({ classification: "types", "epic-type": "Configured" }, { type: "Drafted" });
        expect(config.issueType).toBe("Drafted");
    });

    it("uses the repository's declared epic classification label", () => {
        expect(planClassification(configFor({ classification: "labels", "epic-label": "initiative" }))).toMatchObject({
            createLabel: "initiative",
        });
    });
});

describe("where the epic is filed", () => {
    it("reports the configured epic repository, and inherits the general target when it has none", () => {
        expect(configFor({ "epic-repo": "acme/epics" }).epicRepo).toBe("acme/epics");
        expect(configFor({ "issues-repo": "acme/tracker" }).epicRepo).toBe("acme/tracker");
        expect(configFor({}).epicRepo).toBeNull();
    });

    it("tells the lead which repository the run will target", () => {
        const root: string = checkoutWith({ "epic-repo": "acme/epics", project: "none" });
        const file: string = writeDraft(root, draft());
        const io = recordingIo(root);
        runCreateEpic([file], io, fakeEnvironment().env);
        expect(io.out.join("\n")).toContain("Epic repo (from config): acme/epics");
    });

    it("names the classification and the type or label it settled on", () => {
        const root: string = checkoutWith({ classification: "labels", project: "none" });
        const file: string = writeDraft(root, draft());
        const io = recordingIo(root);
        runCreateEpic([file], io, fakeEnvironment().env);
        const said: string = io.out.join("\n");
        expect(said).toContain("Epic Title: Demo Epic  (classification: labels)");
        expect(said).toContain("Label: epic");
    });
});
