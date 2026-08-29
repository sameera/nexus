/**
 * The `create-epic` capability: file a GitHub issue from an epic draft.
 *
 * This is the seam every story's tests drive — the handler, not the registry row — which is what
 * makes the eventual cut-over from the retained Python implementation a one-line change with
 * nothing left to re-assert (decision record #387).
 *
 * The shape is a pure derivation core surrounded by a short effectful spine: refuse everything
 * refusable before the first remote call, resolve what will be filed and where, create or promote,
 * record the number on the draft immediately, then decorate best-effort, persist what was decided,
 * and report.
 */

import * as fs from "node:fs";
import { type ToolkitIo } from "../io.js";
import { programName } from "../registry.js";
import { CAPABILITY, type ArgsOutcome, type EpicArgs, epicUsage, parseEpicArgs } from "./args.js";
import { type GhRunner, ensureLabel } from "../gh.js";
import { type Outcome, Platform, extractIssueNumber } from "../story-filer/platform.js";
import { type EpicEnvironment, defaultEpicEnvironment } from "./environment.js";
import { withLink } from "./link.js";
import { lookupIssueTypeId, setIssueType } from "../gh.js";
import { EpicPlatform, throwingRunner } from "./platform.js";
import { type ProjectPlan, planProject } from "./projects.js";
import { type WriteReport } from "../write.js";
import { writeBackDecisions } from "../story-filer/writeback.js";
import { type ClassificationPlan, type EpicConfig, planClassification, resolveEpicConfig } from "./configure.js";
import { type DesignDecision, applyNeedsDesign, designDecision } from "./design.js";
import { type ParsedDraft, deriveFiledBody, parseDraft } from "./document.js";
import { type EpicOutput, epicOutput } from "./output.js";
import { type PreflightOutcome, preflight } from "./preflight.js";

export function runCreateEpic(argv: string[], io: ToolkitIo, env: EpicEnvironment = defaultEpicEnvironment): number {
    const parsed: ArgsOutcome = parseEpicArgs(argv);
    if (parsed.kind === "help") {
        io.stdout(epicUsage());
        return 0;
    }
    // Colour follows each stream's own terminal, never the input's and never the contents
    // (Invariant 19): a run whose output is redirected leaves no escape sequence in the file.
    const out: EpicOutput = epicOutput(io, {
        stdout: env.isTerminal("stdout"),
        stderr: env.isTerminal("stderr"),
    });
    if (parsed.kind === "error") {
        io.stderr(epicUsage());
        out.error(`${programName(CAPABILITY)}: ${parsed.message}`);
        return 2;
    }
    const args: EpicArgs = parsed.args;

    const ready: PreflightOutcome = preflight(args, io, env, out);
    if (ready.kind === "refused") return 1;

    out.line(`📄 Processing: ${args.draft}`);

    const content: string = fs.readFileSync(ready.draft, "utf8");
    const { frontmatter }: ParsedDraft = parseDraft(content);
    const filedBody: string = deriveFiledBody(content);

    const title: string = frontmatter["epic"] ?? "";
    if (title === "") {
        out.error("No 'epic' field found in frontmatter");
        out.line("Expected format in frontmatter:");
        out.line('  epic: "Your Epic Title"');
        return 1;
    }

    const config: EpicConfig = resolveEpicConfig(ready.layers, frontmatter);
    if (config.epicRepo !== null) out.line(`📦 Epic repo (from config): ${config.epicRepo}`);

    const epic: EpicPlatform = new EpicPlatform(ready.run, config.epicRepo);

    // `--promote` states the operation; the unplanned label answers whether the operation applies
    // to an epic in that state. Both are read before any write (Invariant 10).
    if (args.promote !== null) {
        const labels: string[] | null = epic.issueLabels(args.promote);
        if (labels === null) {
            out.error(`Cannot promote #${args.promote}: no such issue in the target repository.`);
            return 1;
        }
        if (!labels.includes(config.unplannedLabel)) {
            out.error(
                `Cannot promote #${args.promote}: it does not carry the '${config.unplannedLabel}' label, ` +
                    "so it is not an unplanned epic. Nothing was written. To load an already-planned " +
                    `epic instead, use \`/nxs.epic --from #${args.promote}\`.`,
            );
            return 1;
        }
        out.line(`⬆️  Promoting unplanned epic #${args.promote} in place (no new issue is created)`);
    }

    const classification: ClassificationPlan = planClassification(config);
    if (classification.warning !== null) out.warn(classification.warning);

    // The one interactive point in the capability. A run that cannot receive an answer refuses
    // rather than blocking on a prompt nobody can answer (Invariant 18).
    const existingLink: string = frontmatter["link"] ?? "";
    if (existingLink !== "" && !args.yes) {
        out.warn(`Epic already has a link: ${existingLink}`);
        const answer: string | null = env.interactive()
            ? env.prompt("Do you want to create a new issue anyway? (y/N) ")
            : null;
        if (answer === null) {
            out.error(
                `Epic already has a link: ${existingLink}, and there is no terminal to confirm on. ` +
                    "Re-run with --yes to file anyway.",
            );
            return 1;
        }
        if (answer.trim().toLowerCase() !== "y") {
            out.line("Aborted.");
            return 0;
        }
    }

    out.line(`📋 Epic Title: ${title}  (classification: ${config.classification})`);
    if (classification.issueType !== null) out.line(`🏷️  Type: ${classification.issueType}`);
    else if (classification.createLabel !== null) out.line(`🏷️  Label: ${classification.createLabel}`);

    if (filedBody.trim() === "") {
        out.error("No content found after frontmatter");
        return 1;
    }

    const project: ProjectPlan = planProject(ready.layers, args, ready.run, out);

    const run: GhRunner = ready.run;
    const platform: Platform = new Platform(throwingRunner(run), config.epicRepo);

    // `gh issue create --label X` fails outright when X is absent, so any label this run will pass
    // is upserted before creation (Invariant 11).
    if (classification.createLabel !== null) {
        if (!ensureLabel(classification.createLabel, run, config.epicRepo, "5319E7", "Epic (created by nxs-gh-create-epic)")) {
            out.warn(`Could not ensure '${classification.createLabel}' label — continuing (it may already exist)`);
        }
    }

    let issueUrl: string;
    let issueNumber: string;
    if (args.promote !== null) {
        // The stub's own issue becomes the epic, so every reference written when the scope was
        // deferred survives the promotion.
        out.line(`🚀 Populating GitHub issue #${args.promote}...`);
        const populated = epic.populateIssue(
            args.promote,
            title,
            filedBody,
            config.unplannedLabel,
            classification.createLabel,
        );
        if (populated.url === null) {
            out.error(`Failed to populate GitHub issue #${args.promote}: ${populated.error ?? ""}`);
            return 1;
        }
        issueUrl = populated.url;
        issueNumber = args.promote;
    } else {
        out.line("🚀 Creating GitHub issue...");
        const created = platform.createIssue(
            title,
            classification.createLabel === null ? [] : [classification.createLabel],
            filedBody,
        );
        if (created.value === null || created.value === "") {
            out.error(`Failed to create GitHub issue: ${created.error ?? ""}`);
            return 1;
        }
        issueUrl = created.value;
        const number: string | null = extractIssueNumber(issueUrl) ?? /(\d+)$/.exec(issueUrl.trim())?.[1] ?? null;
        if (number === null) {
            out.error(`Could not extract issue number from: ${issueUrl}`);
            return 1;
        }
        issueNumber = number;
    }

    // Before anything else. Everything after this point is decoration, and a decoration failure
    // must never be able to lose the number and leave the lead filing a duplicate.
    out.line("📝 Updating epic frontmatter with link...");
    const linked = withLink(content, issueNumber);
    if (linked.content === null) out.error("Could not find frontmatter boundaries");
    else fs.writeFileSync(ready.draft, linked.content, "utf8");

    // Every step from here is decoration: a failure warns and the run still exits zero.
    // The gate is made and applied the same way on both paths.
    const design: DesignDecision = designDecision(frontmatter["complexity"]);
    if (design.needed) applyNeedsDesign(issueNumber, config, epic, ready.run, out, design.rollup);

    let appliedLabel: string | null = classification.createLabel;
    const nodeId: string | null =
        project.projectId !== null || classification.issueType !== null ? issueNodeId(issueNumber, platform, out) : null;

    if (project.projectId !== null && nodeId !== null && nodeId !== "") {
        const added: Outcome<true> = platform.addToProject(project.projectId, nodeId);
        // Both lines, in this order: what the platform said, then the step that did not happen.
        // The second alone leaves the lead with a failure and no reason for it (Invariant 16).
        if (added.error !== null) out.warn(`Error adding issue to project: ${added.error}`);
        if (added.value === true) out.line("📊 Added to project");
        else out.warn("Failed to add issue to project");
    }

    let typeApplied = false;
    if (classification.issueType !== null) {
        out.line(`🏷️  Setting issue type: ${classification.issueType}...`);
        const typeId: string | null = lookupIssueTypeId(classification.issueType, run, config.epicRepo);
        typeApplied = typeId !== null && nodeId !== null && nodeId !== "" && setIssueType(nodeId, typeId, run);
        if (typeApplied) {
            out.line(`🏷️  Issue type set: ${classification.issueType}`);
        } else if (config.classification === "types") {
            // The repository declared that it types its issues, so a type it cannot apply is a
            // configuration error to surface — never papered over with a label (Invariant 11).
            out.warn(
                typeId !== null
                    ? `Failed to set issue type '${classification.issueType}' on issue #${issueNumber}`
                    : `Issue type '${classification.issueType}' not found in repository — type not set (classification: types)`,
            );
        } else {
            out.warn(
                typeId !== null
                    ? `Failed to set issue type '${classification.issueType}' on issue #${issueNumber} — falling back to label`
                    : `Issue type '${classification.issueType}' not found in repository — falling back to label '${config.epicLabel}'`,
            );
            appliedLabel = config.epicLabel;
            ensureLabel(appliedLabel, run, config.epicRepo, "5319E7", "Epic (created by nxs-gh-create-epic)");
            if (epic.addLabel(issueNumber, appliedLabel)) out.line(`🏷️  Fallback label added: ${appliedLabel}`);
            else out.warn(`Could not add fallback label '${appliedLabel}' to issue #${issueNumber}`);
        }
    }

    // The first run on a repository that declares nothing persists what it just decided, so the
    // fragile probe and the discovery run at most once per repository. The shared writer is
    // add-only, and no repository target is ever written: an absent one means "the current
    // repository", and pinning it would freeze what is meant to stay inherited (Invariant 13).
    const seeded: WriteReport = writeBackDecisions(ready.projectRoot, {
        classification:
            config.classification === "types" || (config.classification === "legacy-auto" && typeApplied)
                ? "types"
                : "labels",
        // Only the auto-discovery path has a concrete project value to freeze.
        discoveredProject: project.ranAutoDiscovery ? project.discoveredRef : undefined,
    });
    if (seeded.added.length > 0) {
        out.warn(
            `Seeded github config (${seeded.added.join(", ")}) into ` +
                ".nexus/config/settings.yml — review and commit",
        );
    }

    out.line("");
    out.success(args.promote !== null ? "Unplanned Epic Promoted" : "GitHub Issue Created");
    out.line("");
    out.line(`   Issue:  #${issueNumber}`);
    out.line(`   Title:  ${title}`);
    if (typeApplied) out.line(`   Type:   ${classification.issueType}`);
    else if (appliedLabel !== null) out.line(`   Label:  ${appliedLabel}`);
    out.line(
        `   Design: ${design.needed ? `needs a decision record (${config.needsDesignLabel})` : `no record needed (${design.rollup} epic)`}`,
    )
    out.line(`   URL:    ${issueUrl}`);
    if (project.projectId !== null) out.line("   Project: Added ✓");
    out.line("");
    out.line(`   Epic frontmatter updated with: link: "#${issueNumber}"`);
    if (args.promote !== null) out.line(`   Identity: #${issueNumber} kept — no second issue, nothing closed`);
    return 0;
}

/** The node id of `issueNumber`, with a failed lookup reported in this filer's own wording. */
function issueNodeId(issueNumber: string, platform: Platform, out: EpicOutput): string | null {
    const found: Outcome<string> = platform.issueNodeId(issueNumber);
    if (found.error !== null) out.warn(`Error getting issue ID: ${found.error}`);
    return found.value;
}
