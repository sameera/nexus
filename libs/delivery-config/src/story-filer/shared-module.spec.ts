/**
 * Invariant 10 — the filer reaches configuration, classification, project targets, label upsert,
 * the issue-type probe and the settings writer only through the shared module, and defines no
 * equivalent of its own.
 *
 * The point of the port was to stop a second copy existing. A private re-implementation would drift
 * from the epic filer and from `/nxs.epic` silently, which is exactly the failure the shared module
 * was extracted to end — so it is asserted structurally rather than left to review.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

const FILER_DIR: string = import.meta.dirname;

/** The capability, and the shared module that owns it. */
const SHARED: { symbol: string; module: string }[] = [
    { symbol: "ensureLabels", module: "../gh.js" },
    { symbol: "lookupIssueTypeId", module: "../gh.js" },
    { symbol: "setIssueType", module: "../gh.js" },
    { symbol: "resolveClassification", module: "../publishing.js" },
    { symbol: "resolveProjectTarget", module: "../publishing.js" },
    { symbol: "layersAt", module: "../resolve.js" },
    { symbol: "resolveKeyFromLayers", module: "../resolve.js" },
    { symbol: "writeGithubBlock", module: "../write.js" },
];

function filerSources(): { name: string; text: string }[] {
    return fs
        .readdirSync(FILER_DIR)
        .filter((name) => name.endsWith(".ts") && !name.endsWith(".spec.ts") && name !== "fixtures.ts")
        .map((name) => ({ name, text: fs.readFileSync(path.join(FILER_DIR, name), "utf8") }));
}

describe("the shared publishing module is the only implementation", () => {
    it("defines no function of its own for any capability the shared module owns", () => {
        for (const source of filerSources()) {
            for (const { symbol } of SHARED) {
                expect(source.text, `${source.name} defines its own ${symbol}`).not.toMatch(
                    new RegExp(`function\\s+${symbol}\\b`),
                );
            }
        }
    });

    it("imports each capability it uses from the shared module that owns it", () => {
        const text: string = filerSources()
            .map((source) => source.text)
            .join("\n");
        for (const { symbol, module } of SHARED) {
            if (!new RegExp(`\\b${symbol}\\b`).test(text)) continue;
            const imports: string[] = [...text.matchAll(/import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)]
                .filter((match) => new RegExp(`\\b${symbol}\\b`).test(match[1]))
                .map((match) => match[2]);
            expect(imports, `${symbol} is imported from somewhere other than ${module}`).toContain(module);
        }
    });

    it("reads no settings file of its own — the resolver is the only reader", () => {
        for (const source of filerSources()) {
            expect(source.text, `${source.name} reads settings directly`).not.toContain("settings.yml\"");
        }
    });
});
