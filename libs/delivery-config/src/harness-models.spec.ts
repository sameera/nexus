/**
 * Per-harness model settings (epic #1041, story #1043, decision record #1051, D10, D14): one section
 * per `--harness` value, each with a planning and an implementing model, declared in the one key
 * catalogue and resolved through the one precedence chain.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeHubDefaults, publishingKeysOnly } from "./hub.js";
import { harnessModels } from "./harness-models.js";
import { keyEntry } from "./keys.js";
import { readDeliveryConfig } from "./settings.js";
import { resolvePublishingKey } from "./resolve.js";

function repoWith(settings: string): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-models-"));
    fs.mkdirSync(path.join(root, ".nexus", "config"), { recursive: true });
    fs.writeFileSync(path.join(root, ".nexus", "config", "settings.yml"), settings);
    return root;
}

describe("harness model settings", () => {
    it("reads a planning and an implementing model from the harness's own section", () => {
        const root = repoWith("github:\n  epic-label: epic\nclaude:\n  planning-model: claude-opus-5-5\n  implementing-model: sonnet\n");
        expect(resolvePublishingKey(root, "claude.planning-model")).toBe("claude-opus-5-5");
        expect(resolvePublishingKey(root, "claude.implementing-model")).toBe("sonnet");
    });

    it("plans on Opus by default on Claude Code, and Codex has no built-in planning model", () => {
        const root = repoWith("github:\n  epic-label: epic\n");
        expect(resolvePublishingKey(root, "claude.planning-model")).toBe("opus");
        expect(resolvePublishingKey(root, "codex.planning-model")).toBe("");
        expect(resolvePublishingKey(root, "claude.implementing-model")).toBe("");
    });

    it("never lets one harness's section reach the other harness (G42)", () => {
        const root = repoWith("codex:\n  planning-model: gpt-x\n  implementing-model: gpt-y\n");
        expect(harnessModels(root, "claude").planning).toEqual({ value: "opus", layer: "built-in" });
        expect(harnessModels(root, "claude").implementing).toBeNull();
        expect(harnessModels(root, "codex").planning).toEqual({ value: "gpt-x", layer: "repository settings" });
    });

    it("never reads a model key from the github block", () => {
        const root = repoWith("github:\n  planning-model: sonnet\n");
        expect(readDeliveryConfig(root)["claudePlanningModel"]).toBeUndefined();
        expect(harnessModels(root, "claude").planning?.value).toBe("opus");
    });

    it("names the layer a model came from, and reports a declared empty value instead of dropping it (G46)", () => {
        const root = repoWith("claude:\n  implementing-model:\n");
        expect(harnessModels(root, "claude").implementing).toEqual({ value: "", layer: "repository settings" });
    });

    it("lists keys the catalogue does not declare in the selected harness's section (G47)", () => {
        const root = repoWith("claude:\n  planing-model: opus\n  implementing-model: sonnet\ncodex:\n  other: x\n");
        expect(harnessModels(root, "claude").unknownKeys).toEqual(["planing-model"]);
        expect(harnessModels(root, "codex").unknownKeys).toEqual(["other"]);
    });

    it("lets a member inherit the hub's own model settings, never the workspace manifest's defaults (G41)", () => {
        expect(keyEntry("claude.planning-model")?.repoSpecific).toBeUndefined();
        expect(publishingKeysOnly({ claudeImplementingModel: "sonnet" })).toEqual({ claudeImplementingModel: "sonnet" });
        expect(normalizeHubDefaults({ "claude.implementing-model": "sonnet", "implementing-model": "sonnet" })).toEqual({});
    });
});
