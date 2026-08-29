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

import { type GhRunner } from "../gh.js";
import { type ToolkitIo } from "../io.js";
import { programName } from "../registry.js";
import { CAPABILITY, type ArgsOutcome, type FilerArgs, filerUsage, parseFilerArgs } from "./args.js";
import { resolveIssueTypeId } from "./classify.js";
import { type FilerConfig, reportIssuesRepo, resolveFilerConfig } from "./configure.js";
import { type FilerEnvironment, defaultEnvironment } from "./environment.js";
import { ensureBatchLabels } from "./labels.js";
import { type PreflightOutcome, preflight } from "./preflight.js";
import { previewLine } from "./preview.js";
import { writeBackDecisions } from "./writeback.js";

export function runCreateStory(
    argv: string[],
    io: ToolkitIo,
    env: FilerEnvironment = defaultEnvironment,
): number {
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

    const config: FilerConfig = resolveFilerConfig(ready.layers, args);
    reportIssuesRepo(config, io);

    if (args.dryRun) {
        // A rehearsal reaches nothing: no type probe, no label upsert, no write-back.
        io.stdout("");
        io.stdout("Dry run - would process:");
        const canonical: string | null = config.classification === "types" ? null : config.classificationLabel;
        for (const item of ready.items) io.stdout(previewLine(item, canonical));
        return 0;
    }

    // Bound once to the resolved target root, so every call this run makes targets the repository
    // the run resolved (Invariant 11).
    const run: GhRunner = env.runnerFor(ready.projectRoot);

    resolveIssueTypeId(config, run, io);
    if (!ensureBatchLabels(ready.items, config, run, io)) return 1;

    writeBackDecisions(ready.projectRoot, { classification: config.classification }, io);
    return 0;
}
