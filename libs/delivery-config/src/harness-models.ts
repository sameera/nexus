/**
 * A coding-agent harness's planning and implementing models (decision record #1051, D10, D14).
 *
 * The values come only from the one key catalogue and the one layer reader: the repository's own
 * settings, then the hub's own settings, then the built-in. Each value carries the layer it came
 * from, so a refusal can name it, and a declared empty value is kept rather than dropped.
 */

import { HARNESS_KEYS, keyEntry, nameInSection } from "./keys.js";
import { layersAt } from "./resolve.js";
import { readRawSettings } from "./settings.js";

export interface ModelSetting {
    value: string;
    layer: string;
}

export interface HarnessModels {
    planning: ModelSetting | null;
    implementing: ModelSetting | null;
    /** Keys in the harness's section that the catalogue does not declare. */
    unknownKeys: string[];
}

function modelFor(start: string, harness: string, name: string): ModelSetting | null {
    const entry = keyEntry(`${harness}.${name}`);
    if (entry === undefined) return null;
    const layers = layersAt(start);
    const repo = layers.repo[entry.normalized];
    if (repo !== undefined) return { value: repo, layer: "repository settings" };
    const hub = layers.hub[entry.normalized];
    if (hub !== undefined) return { value: hub, layer: "hub settings" };
    return entry.builtin === undefined ? null : { value: entry.builtin, layer: "built-in" };
}

/** The models `harness` resolves to at `start`, with the layer each came from. */
export function harnessModels(start: string, harness: string): HarnessModels {
    const declared = new Set(HARNESS_KEYS.filter((k) => k.section === harness).map(nameInSection));
    const raw = readRawSettings(layersAt(start).root);
    const unknownKeys = Object.keys(raw?.[harness] ?? {}).filter((k) => !declared.has(k));
    return { planning: modelFor(start, harness, "planning-model"), implementing: modelFor(start, harness, "implementing-model"), unknownKeys };
}
