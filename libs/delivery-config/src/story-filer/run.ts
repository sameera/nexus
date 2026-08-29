/**
 * The `create-story` capability: file one GitHub issue per `STORY-*.md` work item.
 *
 * This is the seam every story's tests drive — the handler, not the registry row — which is what
 * makes the eventual cut-over from the retained Python implementation a one-line change with
 * nothing left to re-assert (decision record #375).
 *
 * The run is a preflight that decides the batch is legal, then three passes over it. It is
 * synchronous end to end: the dispatcher's capability contract is a synchronous call returning an
 * exit code, and the write ordering that makes the resume ledger safe is easier to hold — and to
 * assert — without concurrency.
 */

import { type ToolkitIo } from "../io.js";
import { type ArgsOutcome, type FilerArgs, filerUsage, parseFilerArgs, CAPABILITY } from "./args.js";
import { programName } from "../registry.js";
import { type PreflightOutcome, preflight } from "./preflight.js";
import { previewLine } from "./preview.js";

export function runCreateStory(argv: string[], io: ToolkitIo): number {
    const parsed: ArgsOutcome = parseFilerArgs(argv);
    if (parsed.kind === "help") {
        io.stdout(filerUsage());
        return 0;
    }
    if (parsed.kind === "error") {
        io.stderr(filerUsage());
        io.stderr(`${programName(CAPABILITY)}: ${parsed.message}`);
        return 2;
    }
    const args: FilerArgs = parsed.args;

    const ready: PreflightOutcome = preflight(args, io);
    if (ready.kind === "refused") return 1;
    if (ready.kind === "empty") return 0;

    if (args.dryRun) {
        io.stdout("");
        io.stdout("Dry run - would process:");
        for (const item of ready.items) io.stdout(previewLine(item, args.classificationLabel));
        return 0;
    }

    return 0;
}
