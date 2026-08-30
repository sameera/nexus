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
import { NO_PROJECT, createPass } from "./create.js";
import { ensureBatchLabels } from "./labels.js";
import { type Ledger, ledgerPathFor, loadLedger, removeLedger } from "./ledger.js";
import { type RunOutcome, printFinalReport } from "./report.js";
import { Platform } from "./platform.js";
import { type ProjectPlan, ProjectLookup, planProjects, projectAssignment } from "./projects.js";
import { type RetryingRunner, retryingRunner } from "./retry.js";
import { type CreatePassResult } from "./create.js";
import { type RewriteResult, refToNumber, rewritePass } from "./rewrite.js";
import { type WireResult, refToDbId, wirePass } from "./wire.js";
import { type PreflightOutcome, preflight } from "./preflight.js";
import { previewLine } from "./preview.js";
import { type WriteReport } from "../write.js";
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

    const issueTypeId: string | null = resolveIssueTypeId(config, run, io);
    if (!ensureBatchLabels(ready.items, config, run, io)) return 1;

    // The retrying tier wraps exactly the calls that carry it today; the shared helpers above keep
    // the plain runner, so a permission gap is still reported before anything is created.
    const gh: RetryingRunner = retryingRunner(
        run,
        { retries: args.retries, baseDelay: args.retryBaseDelay },
        env,
        io,
    );
    const platform: Platform = new Platform(gh, config.issuesRepo);

    // Resolved once for the whole batch. The lookups take the plain runner: they are the calls that
    // deliberately do not retry, and that is observable as latency and as warning lines.
    const lookup: ProjectLookup = new ProjectLookup(run);
    const plan: ProjectPlan = planProjects(ready.layers, args, lookup, io);

    const ledgerPath: string = ledgerPathFor(ready.targetFolder);
    const ledger: Ledger = loadLedger(ledgerPath, io);
    const carried: number = Object.keys(ledger).length;
    if (carried > 0) io.stdout(`Resuming from manifest (${carried} issue(s) already created): ${ledgerPath}`);

    const pass1: CreatePassResult = createPass(
        ready.items,
        config,
        {
            platform,
            plainRun: run,
            issueTypeId,
            ledger,
            ledgerPath,
            projects: args.noProject ? NO_PROJECT : projectAssignment(plan, lookup, platform, io),
        },
        io,
    );

    const pass2: WireResult = wirePass(pass1.created, refToDbId(pass1.created, ledger), platform, io);
    const pass3: RewriteResult = rewritePass(pass1.created, refToNumber(pass1.created, ledger), platform, io);

    const seeded: WriteReport = writeBackDecisions(ready.projectRoot, {
        classification: config.classification,
        // Only the discovery path found something this repository had not been told.
        discoveredProject: plan.ranAutoDiscovery ? plan.discoveredRef : undefined,
    });
    if (seeded.added.length > 0) {
        io.stdout("");
        io.stdout(
            `🌱 Seeded github config (${seeded.added.join(", ")}) into ` +
                ".nexus/config/settings.yml — review and commit",
        );
    }

    const reused: number = pass1.created.filter((record) => record.reused).length;
    const outcome: RunOutcome = {
        total: ready.items.length,
        created: pass1.created.length - reused,
        reused,
        createFailed: pass1.failed,
        depWired: pass2.wired,
        depPresent: pass2.present,
        depUnresolved: pass2.unresolved,
        depFailed: pass2.failed,
        bodyRewritten: pass3.rewritten,
        bodyUnresolved: pass3.unresolved,
        bodyFailed: pass3.failed,
    };
    const complete: boolean = printFinalReport(outcome, args, ready.targetFolder, ledgerPath, io);
    if (!complete) return 1;
    // A clean run has nothing left to resume from.
    if (!args.keepManifest) removeLedger(ledgerPath, io);
    return 0;
}
