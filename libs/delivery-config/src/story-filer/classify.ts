/**
 * Classifying by issue type (story #368).
 *
 * In `types` mode the issue's GitHub type is what says what kind of issue this is, and no canonical
 * label is forced. The type is resolved once for the batch. A type that does not resolve, or a
 * repository in `types` mode with none configured, warns and files the issues untyped: classifying
 * is decoration, and failing a filing run over decoration is the worse outcome.
 */

import { type GhRunner } from "../gh.js";
import { lookupIssueTypeId } from "../gh.js";
import { type ToolkitIo } from "../io.js";
import { type FilerConfig } from "./configure.js";

export function resolveIssueTypeId(config: FilerConfig, run: GhRunner, io: ToolkitIo): string | null {
    if (config.classification !== "types") return null;
    if (config.classificationType === null || config.classificationType === "") {
        io.stderr("Warning: classification: types but no issue-type configured — issues filed untyped");
        return null;
    }
    const typeId: string | null = lookupIssueTypeId(config.classificationType, run, config.issuesRepo);
    if (typeId === null) {
        io.stderr(
            `Warning: classification: types but type '${config.classificationType}' not found — ` +
                "issues filed untyped",
        );
        return null;
    }
    io.stdout(`Classification: types — issue-type '${config.classificationType}'`);
    return typeId;
}
