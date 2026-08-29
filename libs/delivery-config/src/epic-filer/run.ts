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
import { type EpicEnvironment, defaultEpicEnvironment } from "./environment.js";
import { deriveFiledBody } from "./document.js";
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
    const filedBody: string = deriveFiledBody(content);
    if (filedBody.trim() === "") {
        out.error("No content found after frontmatter");
        return 1;
    }
    return 0;
}
