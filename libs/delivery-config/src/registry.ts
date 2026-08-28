/**
 * The capability registry — the whole of the name `nexus-gh` (story #355).
 *
 * Nexus keeps two toolkits. The one answering to `nexus` is the executable's own verbs; this is
 * the other name, and a component body or a pipeline stage reaches a capability by naming the two
 * of them together, never by encoding a path to a file. A capability cannot exist without a row
 * here, because both surfaces are rendered from this one table: the human usage text and the
 * machine listing the build gate reads. There is never a second list.
 *
 * Rows whose handler delegates are the two issue filers, still Python until epics #352 and #353
 * port them. Which language a row is implemented in is invisible from here — that is what lets a
 * filer move without the dispatcher changing again.
 */

import { delegateToPython } from "./delegate.js";
import { type ToolkitIo } from "./io.js";
import { runConfig } from "./config-cli.js";
import { runVersion } from "./version.js";

/** The one literal the toolkit answers to, fixed by story #297. */
export const TOOLKIT_NAME = "nexus-gh";

/** The program name a capability reports in its own usage and error text. */
export function programName(capability: string): string {
    return `${TOOLKIT_NAME} ${capability}`;
}

/** A capability's implementation: its own arguments, its own output, its own exit code. */
export type CapabilityHandler = (args: string[], io: ToolkitIo) => number;

export interface Capability {
    name: string;
    summary: string;
    run: CapabilityHandler;
}

/** Every declared capability, in the order the usage text lists them. */
export const CAPABILITIES: readonly Capability[] = [
    {
        name: "version",
        summary: "Report the release this toolkit is part of.",
        run: runVersion,
    },
    {
        name: "config",
        summary: "Resolve delivery configuration (the shared publishing resolver).",
        run: runConfig,
    },
    {
        name: "create-epic",
        summary: "File a GitHub issue from an epic document.",
        run: (args, io) => delegateToPython("create-epic", args, io),
    },
    {
        name: "create-story",
        summary: "File one GitHub issue per STORY-*.md work item.",
        run: (args, io) => delegateToPython("create-story", args, io),
    },
];

/** The declared capability names, sorted — the surface a reader outside this module sees. */
export const CAPABILITY_NAMES: readonly string[] = CAPABILITIES.map((c) => c.name).sort();

/** The row for `name`, or undefined when the toolkit declares no such capability. */
export function findCapability(name: string): Capability | undefined {
    return CAPABILITIES.find((capability) => capability.name === name);
}

/**
 * The declared capability names, shaped for a machine reader.
 *
 * The human usage text is prose and its wording is free to change, so a reader that scraped it
 * would break on every rewording. This is the second answer beside it: one JSON object carrying
 * names and nothing anyone would reword.
 */
export function capabilityListing(): string {
    return JSON.stringify({ capabilities: [...CAPABILITY_NAMES] });
}

/** The human usage text, rendered from the same registry the machine listing is rendered from. */
export function usage(): string {
    const width: number = Math.max(...CAPABILITIES.map((capability) => capability.name.length));
    return [
        `usage: ${TOOLKIT_NAME} <capability> [args...]`,
        "",
        "capabilities:",
        ...CAPABILITIES.map((c) => `  ${c.name.padEnd(width)}  ${c.summary}`),
        "",
        `Run \`${TOOLKIT_NAME} <capability> --help\` for a capability's own arguments.`,
    ].join("\n");
}
