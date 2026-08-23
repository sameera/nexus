#!/usr/bin/env tsx
/**
 * Live-acceptance harness for the `--pr` post-merge flow — the executable half of
 * `docs/features/pr-driven-delivery/live-acceptance-runbook.md`, beside the library it drives
 * (decision record #277: the harness sits with its own library, outside the vendored component
 * tree entirely — it gains no `nexus` verb, and stops being invocable by an agent).
 *
 * It provisions ONE deterministically named throwaway repository under the
 * maintainer's own GitHub owner, seeds independent PR scenarios into it, drives
 * the merge strategies and the range helper against them, asserts the mechanical
 * checks, and deletes the repository at teardown behind a name/owner/marker
 * triple guard.
 *
 * Subcommands (success prints one JSON object on stdout; a failure prints a named
 * diagnostic on stderr):
 *
 *   preflight              Read-only. Identity, scopes, and whether the credential can delete.
 *   provision              Create-or-reuse the scratch repo and the disposable clone.
 *   status                 Where everything is, and whether the scratch repo exists.
 *   seed --kind <k>        Seed a fresh scenario: chain | multi-commit | single-commit | unmerged.
 *   merge --pr <N> --strategy squash|merge|rebase --branch <b>
 *                          Merge by one strategy, delete the branch, prune locally.
 *   range --pr <N>         Derive the range through the helper CLI and verify it against
 *                          the PR's own changed-file set. Records evidence.
 *   receipt --pr <N>       Read the analyze receipt back the way close does; check currency.
 *   residue                Enumerate worktrees and branches left in the host checkout.
 *   note --stage <s> --verdict pass|fail|not-exercised [--detail k=v] [--diagnostic <text>]
 *                          Record an operator-judged outcome as evidence.
 *   evidence               Render the recorded evidence as markdown for the acceptance record.
 *   teardown [--keep-alive]
 *                          Always removes local residue; deletes the repo unless kept alive.
 *
 * Exit codes: 0 success · 1 a named diagnostic was printed · 2 usage error.
 *
 * NOTHING here may commit, push, branch, or file an issue against the Nexus repo
 * itself. Every live mutation lands on the scratch repo or its disposable clone,
 * and each created URL is checked back against the scratch identity.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { preflightCapabilities, resolveAuth } from "./capability.js";
import { type PrAcceptanceDiagnostic } from "./diagnostic.js";
import { type EvidenceRecord, type Verdict, readEvidence, renderEvidence, writeEvidence } from "./evidence.js";
import { MARKER_PATH, cloneDir, evidenceDir, parseMarker, scratchIdentity } from "./names.js";
import { MERGE_STRATEGIES, type MergeStrategy, mergeScenario } from "./merge.js";
import { provision, remoteState } from "./provision.js";
import { renderDiagnostic } from "./render.js";
import { defaultRunner, git } from "./run.js";
import { type ScenarioKind, seedScenario } from "./scenario.js";
import { teardown } from "./teardown.js";
import { deriveRangeViaHelper, prChangedFiles, prEndpoints, verifyRange, verifyReceipt, verifyResidue } from "./verify.js";

/** The Nexus checkout this script ships in — resolved from the script path, not the cwd. */
const TOOL_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

interface Flags {
    pr?: number;
    kind?: string;
    strategy?: string;
    branch?: string;
    stage?: string;
    verdict?: string;
    detail: string[];
    diagnostic: string[];
    keepAlive: boolean;
    positional: string[];
}

function parseFlags(argv: string[]): Flags {
    const f: Flags = { detail: [], diagnostic: [], keepAlive: false, positional: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--pr") f.pr = Number(argv[++i]);
        else if (a === "--kind") f.kind = argv[++i];
        else if (a === "--strategy") f.strategy = argv[++i];
        else if (a === "--branch") f.branch = argv[++i];
        else if (a === "--stage") f.stage = argv[++i];
        else if (a === "--verdict") f.verdict = argv[++i];
        else if (a === "--detail") f.detail.push(argv[++i]);
        else if (a === "--diagnostic") f.diagnostic.push(argv[++i]);
        else if (a === "--keep-alive") f.keepAlive = true;
        else f.positional.push(a);
    }
    return f;
}

function emit(obj: unknown): never {
    process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
    process.exit(0);
}

function die(d: PrAcceptanceDiagnostic): never {
    process.stderr.write(`${renderDiagnostic(d)}\n`);
    process.exit(1);
}

function usage(msg: string): never {
    process.stderr.write(`usage: cli.ts ${msg}\n`);
    process.exit(2);
}

interface Context {
    login: string;
    nameWithOwner: string;
    clonePath: string;
    evidencePath: string;
    /** The commit the scratch repo was seeded from — read off the marker it carries. */
    toolchainCommit: string;
    today: string;
}

/** Resolve the run's context from the deterministic name; no provision state needed. */
function context(): Context {
    const auth = resolveAuth(defaultRunner, TOOL_ROOT);
    if (!auth.ok) die(auth.error);
    const id = scratchIdentity(auth.value.login);
    const clonePath = cloneDir(auth.value.login);
    const markerFile = path.join(clonePath, MARKER_PATH);
    const marker = fs.existsSync(markerFile) ? parseMarker(fs.readFileSync(markerFile, "utf8")) : null;
    return {
        login: auth.value.login,
        nameWithOwner: id.nameWithOwner,
        clonePath,
        evidencePath: evidenceDir(auth.value.login),
        toolchainCommit: marker?.toolchainCommit ?? git(defaultRunner, TOOL_ROOT, "rev-parse", "HEAD") ?? "",
        today: new Date().toISOString().slice(0, 10),
    };
}

function requireClone(ctx: Context): void {
    if (!fs.existsSync(path.join(ctx.clonePath, ".git"))) {
        die({
            problem: "scratch-repo-missing",
            message: `no disposable clone at ${ctx.clonePath}; run \`cli.ts provision\` first.`,
        });
    }
}

function record(ctx: Context, stage: string, verdict: Verdict, detail: Record<string, unknown>, diagnostics: string[]): string {
    const rec: EvidenceRecord = {
        stage,
        observedAt: ctx.today,
        toolchainCommit: ctx.toolchainCommit,
        scratchRepo: ctx.nameWithOwner,
        verdict,
        detail,
        diagnostics,
    };
    const written = writeEvidence(ctx.evidencePath, rec);
    if (!written.ok) die(written.error);
    return written.value;
}

function main(): void {
    const [subcommand, ...rest] = process.argv.slice(2);
    const flags = parseFlags(rest);

    if (subcommand === "preflight") {
        const caps = preflightCapabilities(defaultRunner, TOOL_ROOT);
        if (!caps.ok) die(caps.error);
        const id = scratchIdentity(caps.value.login);
        emit({ command: "preflight", ...caps.value, scratchRepo: id.nameWithOwner, toolRoot: TOOL_ROOT });
    }

    if (subcommand === "provision") {
        const r = provision(defaultRunner, { sourceRepoRoot: TOOL_ROOT });
        if (!r.ok) die(r.error);
        const ctx = context();
        record(
            ctx,
            "provision",
            "pass",
            {
                scratchRepo: r.value.nameWithOwner,
                url: r.value.url,
                clonePath: r.value.clonePath,
                toolchainCommit: r.value.toolchainCommit,
                reused: r.value.reused,
                dependencyClosure: r.value.dependencyClosure,
            },
            r.value.dependencyClosure === "absent"
                ? ["the clone could not borrow a resolved dependency closure; helpers must be invoked from the primary checkout by absolute path"]
                : [],
        );
        emit({ command: "provision", ...r.value, evidencePath: ctx.evidencePath });
    }

    if (subcommand === "status") {
        const ctx = context();
        const state = remoteState(defaultRunner, TOOL_ROOT, ctx.nameWithOwner);
        if (!state.ok) die(state.error);
        emit({
            command: "status",
            ...ctx,
            toolRoot: TOOL_ROOT,
            remote: { exists: state.value.exists, url: state.value.url, markerPresent: state.value.markerText !== null },
            cloneExists: fs.existsSync(path.join(ctx.clonePath, ".git")),
        });
    }

    if (subcommand === "seed") {
        const kinds: ScenarioKind[] = ["chain", "multi-commit", "single-commit", "unmerged"];
        if (!flags.kind || !kinds.includes(flags.kind as ScenarioKind)) usage(`seed --kind <${kinds.join("|")}>`);
        const ctx = context();
        requireClone(ctx);
        const r = seedScenario(
            {
                run: defaultRunner,
                clonePath: ctx.clonePath,
                toolRoot: TOOL_ROOT,
                scratch: scratchIdentity(ctx.login),
                today: ctx.today,
            },
            flags.kind as ScenarioKind,
        );
        if (!r.ok) die(r.error);
        emit({ command: "seed", ...r.value });
    }

    if (subcommand === "merge") {
        if (flags.pr === undefined || Number.isNaN(flags.pr)) usage("merge --pr <N> --strategy <s> --branch <b>");
        if (!flags.strategy || !MERGE_STRATEGIES.includes(flags.strategy as MergeStrategy)) {
            usage(`merge --pr <N> --strategy <${MERGE_STRATEGIES.join("|")}> --branch <b>`);
        }
        if (!flags.branch) usage("merge --pr <N> --strategy <s> --branch <b>");
        const ctx = context();
        requireClone(ctx);
        const r = mergeScenario(
            { run: defaultRunner, clonePath: ctx.clonePath },
            flags.pr,
            flags.strategy as MergeStrategy,
            flags.branch,
        );
        if (!r.ok) die(r.error);
        emit({ command: "merge", ...r.value });
    }

    if (subcommand === "range") {
        if (flags.pr === undefined || Number.isNaN(flags.pr)) usage("range --pr <N> [--branch <distill/...>]");
        const ctx = context();
        requireClone(ctx);
        const branch = flags.branch ?? `distill/${ctx.today}-acceptance-pr-${flags.pr}`;

        const endpoints = prEndpoints(defaultRunner, ctx.clonePath, flags.pr);
        if (!endpoints.ok) die(endpoints.error);

        const derived = deriveRangeViaHelper(
            { run: defaultRunner, clonePath: ctx.clonePath, toolRoot: TOOL_ROOT },
            flags.pr,
            branch,
        );
        if (!derived.ok) {
            // A refusal is a legitimate outcome: the helper never prints a range it could
            // not verify. Record it verbatim and exit non-zero so the runbook stops here.
            record(
                ctx,
                `range:pr-${flags.pr}`,
                "fail",
                { pr: flags.pr, mergeCommit: endpoints.value.mergeCommitOid, commitCount: endpoints.value.commitCount },
                [derived.error.message],
            );
            die(derived.error);
        }

        const ghFiles = prChangedFiles(defaultRunner, ctx.clonePath, flags.pr);
        const verdict = verifyRange(defaultRunner, derived.value.wtPath || ctx.clonePath, {
            prNumber: flags.pr,
            base: derived.value.base,
            head: derived.value.head,
            prBase: endpoints.value.base,
            prHead: endpoints.value.head,
            ghFiles: ghFiles.ok ? ghFiles.value : undefined,
        });
        if (!verdict.ok) die(verdict.error);

        const evidence = record(
            ctx,
            `range:pr-${flags.pr}`,
            verdict.value.pass ? "pass" : "fail",
            {
                pr: flags.pr,
                commitCount: endpoints.value.commitCount,
                mergeCommit: endpoints.value.mergeCommitOid,
                base: verdict.value.base,
                head: verdict.value.head,
                fullShas: verdict.value.fullShas,
                baseIsAncestorOfHead: verdict.value.baseIsAncestorOfHead,
                baseReachableOnTrunk: verdict.value.baseReachableOnTrunk,
                headReachableOnTrunk: verdict.value.headReachableOnTrunk,
                fileSetsEqual: verdict.value.fileSetsEqual,
                ghFileSetsEqual: verdict.value.ghFileSetsEqual,
                derivedFiles: verdict.value.derivedFiles,
                authoritativeFiles: verdict.value.authoritativeFiles,
            },
            verdict.value.notes,
        );
        emit({ command: "range", worktree: derived.value.wtPath, ...verdict.value, evidence });
    }

    if (subcommand === "receipt") {
        if (flags.pr === undefined || Number.isNaN(flags.pr)) usage("receipt --pr <N>");
        const ctx = context();
        requireClone(ctx);
        const r = verifyReceipt(defaultRunner, ctx.clonePath, flags.pr);
        if (!r.ok) die(r.error);
        const evidence = record(
            ctx,
            `receipt:pr-${flags.pr}`,
            r.value.found && r.value.current ? "pass" : "fail",
            {
                pr: flags.pr,
                found: r.value.found,
                publishedAs: r.value.source ?? "(none)",
                analyzedHead: r.value.receipt?.head ?? "(none)",
                prHead: r.value.prHead,
                current: r.value.current,
                mode: r.value.receipt?.mode ?? "(none)",
                findings: JSON.stringify(r.value.receipt?.findings ?? {}),
            },
            r.value.staleNote ? [r.value.staleNote] : [],
        );
        emit({ command: "receipt", ...r.value, evidence });
    }

    if (subcommand === "residue") {
        const ctx = context();
        const r = verifyResidue(defaultRunner, TOOL_ROOT, ctx.clonePath);
        if (!r.ok) die(r.error);
        const evidence = record(ctx, "residue", r.value.clean ? "pass" : "fail", { ...r.value }, []);
        emit({ command: "residue", ...r.value, evidence });
    }

    if (subcommand === "note") {
        const verdicts: Verdict[] = ["pass", "fail", "not-exercised"];
        if (!flags.stage) usage("note --stage <s> --verdict pass|fail|not-exercised [--detail k=v] [--diagnostic <text>]");
        if (!flags.verdict || !verdicts.includes(flags.verdict as Verdict)) {
            usage(`note --stage <s> --verdict <${verdicts.join("|")}>`);
        }
        const ctx = context();
        const detail: Record<string, unknown> = {};
        for (const kv of flags.detail) {
            const i = kv.indexOf("=");
            if (i < 0) usage("--detail expects key=value");
            detail[kv.slice(0, i)] = kv.slice(i + 1);
        }
        const evidence = record(ctx, flags.stage, flags.verdict as Verdict, detail, flags.diagnostic);
        emit({ command: "note", stage: flags.stage, verdict: flags.verdict, evidence });
    }

    if (subcommand === "evidence") {
        const ctx = context();
        process.stdout.write(renderEvidence(readEvidence(ctx.evidencePath)));
        process.exit(0);
    }

    if (subcommand === "teardown") {
        const r = teardown(defaultRunner, { sourceRepoRoot: TOOL_ROOT, keepAlive: flags.keepAlive });
        if (!r.ok) die(r.error);
        emit({ command: "teardown", ...r.value });
    }

    usage(
        "<preflight|provision|status|seed --kind <k>|merge --pr <N> --strategy <s> --branch <b>|" +
            "range --pr <N>|receipt --pr <N>|residue|note --stage <s> --verdict <v>|evidence|teardown [--keep-alive]>",
    );
}

main();
