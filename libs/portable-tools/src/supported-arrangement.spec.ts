/**
 * The shipped components must not teach the arrangement `nexus migrate-components` exists to
 * delete (epic #253). Per-repository deployment still works as a verb, but a component that tells
 * an adopter to run it hands every adopter a second component set — and the duplicate-set
 * diagnostic then fires on the very instruction Nexus shipped them.
 *
 * The check is over the vendored payload, because that is what reaches an adopter's machine.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { listComponentFiles, liveClaudeDir } from "./vendor-components";

const CLAUDE_DIR: string = liveClaudeDir(import.meta.dirname);

describe("the shipped component payload", () => {
    it("never instructs an adopter into the per-repository arrangement", () => {
        const offenders: string[] = listComponentFiles(CLAUDE_DIR).filter((rel) =>
            fs.readFileSync(path.join(CLAUDE_DIR, ...rel.split("/")), "utf8").includes("nexus deploy"),
        );

        expect(offenders).toEqual([]);
    });
});
