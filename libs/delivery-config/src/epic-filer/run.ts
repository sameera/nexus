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
import { Platform, extractIssueNumber } from "../story-filer/platform.js";
import { type EpicEnvironment, defaultEpicEnvironment } from "./environment.js";
import { withLink } from "./link.js";
import { throwingRunner } from "./platform.js";
import { type ClassificationPlan, type EpicConfig, planClassification, resolveEpicConfig } from "./configure.js";
import { type ParsedDraft, deriveFiledBody, parseDraft } from "./document.js";
import { type EpicOutput, epicOutput } from "./output.js";
import { type PreflightOutcome, preflight } from "./preflight.js";

export function runCreateEpic(argv: string[], io: ToolkitIo, env: EpicEnvironment = defaultEpicEnvironment): number {
    const parsed: ArgsOutcome = parseEpicArgs(argv);
    if (parsed.kind === "help") {
        io.stdout(epicUsage());
        return 0;
    }
    // Colour follows the terminal, never the stream's contents (Invariant 19).
    const out: EpicOutput = epicOutput(io, env.interactive());
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

    const run: GhRunner = ready.run;
    const platform: Platform = new Platform(throwingRunner(run), config.epicRepo);

    // `gh issue create --label X` fails outright when X is absent, so any label this run will pass
    // is upserted before creation (Invariant 11).
    if (classification.createLabel !== null) {
        if (!ensureLabel(classification.createLabel, run, config.epicRepo, "5319E7", "Epic (created by nxs-gh-create-epic)")) {
            out.warn(`Could not ensure '${classification.createLabel}' label — continuing (it may already exist)`);
        }
    }

    out.line("🚀 Creating GitHub issue...");
    const created = platform.createIssue(title, classification.createLabel === null ? [] : [classification.createLabel], filedBody);
    if (created.value === null || created.value === "") {
        out.error(`Failed to create GitHub issue: ${created.error ?? ""}`);
        return 1;
    }
    const issueUrl: string = created.value;
    const issueNumber: string | null = extractIssueNumber(issueUrl) ?? /(\d+)$/.exec(issueUrl.trim())?.[1] ?? null;
    if (issueNumber === null) {
        out.error(`Could not extract issue number from: ${issueUrl}`);
        return 1;
    }

    // Before anything else. Everything after this point is decoration, and a decoration failure
    // must never be able to lose the number and leave the lead filing a duplicate.
    out.line("📝 Updating epic frontmatter with link...");
    const linked = withLink(content, issueNumber);
    if (linked.content === null) out.error("Could not find frontmatter boundaries");
    else fs.writeFileSync(ready.draft, linked.content, "utf8");

    out.line("");
    out.success("GitHub Issue Created");
    out.line("");
    out.line(`   Issue:  #${issueNumber}`);
    out.line(`   Title:  ${title}`);
    out.line(`   URL:    ${issueUrl}`);
    out.line("");
    out.line(`   Epic frontmatter updated with: link: "#${issueNumber}"`);
    return 0;
}
