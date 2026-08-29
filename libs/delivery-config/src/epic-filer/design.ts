/**
 * The needs-design gate at filing (story #383).
 *
 * The label is the declarative gate every downstream stage reads: it says "this epic warrants a
 * decision record" from the issue graph alone, with nothing remembered off the issue — which is why
 * an epic filed by hand outside Nexus, carrying no label, reads as an epic without a record rather
 * than as an error. The exemption rule and the label's name resolve through the shared module; this
 * only applies the decision, on the creation path and the promotion path alike.
 */

import { type GhRunner, ensureLabel } from "../gh.js";
import { epicNeedsDesign } from "../publishing.js";
import { type EpicConfig } from "./configure.js";
import { type EpicOutput } from "./output.js";
import { type EpicPlatform } from "./platform.js";

/** The style the label has always been created with. */
const NEEDS_DESIGN_STYLE: [string, string] = [
    "D4C5F9",
    "Epic warrants a decision record (nxs.decision-record files it as a sub-issue)",
];

export interface DesignDecision {
    /** Whether this epic warrants a decision record. */
    needed: boolean;
    /** The declared complexity that exempted it — what the report names, rather than a fixed size. */
    rollup: string;
}

export function designDecision(complexity: string | undefined): DesignDecision {
    return { needed: epicNeedsDesign(complexity), rollup: (complexity ?? "").trim() || "unstated" };
}

/**
 * Upsert the label, then apply it.
 *
 * Creating it first means a repository that has never seen it never fails a run half-way and never
 * leaves the epic mislabelled. A failure warns and the run continues: an issue that exists is never
 * abandoned over a label (Invariant 8).
 */
export function applyNeedsDesign(
    issueNumber: string,
    config: EpicConfig,
    platform: EpicPlatform,
    run: GhRunner,
    out: EpicOutput,
    rollup: string,
): void {
    ensureLabel(config.needsDesignLabel, run, config.epicRepo, ...NEEDS_DESIGN_STYLE);
    if (platform.addLabel(issueNumber, config.needsDesignLabel)) {
        out.line(`🏷️  Labeled '${config.needsDesignLabel}' (complexity ${rollup})`);
    } else {
        out.warn(
            `Could not apply '${config.needsDesignLabel}' to issue #${issueNumber} — ` +
                "apply it by hand before /nxs.decision-record",
        );
    }
}
