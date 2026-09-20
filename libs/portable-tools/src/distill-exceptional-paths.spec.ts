/**
 * Epic #714 — load the distillation stage's exceptional paths only when they apply.
 *
 * The stage is a prose document executed by a model, so no spec here can watch a run. What these
 * assertions hold are the two mechanically checkable halves the decision record names: the declared
 * selection table (which contract a resolved run would read), and residency (that each moved rule
 * lives in its contract and nowhere in the base stage).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { authoredComponentRoot } from "./vendor-components.js";

const COMPONENTS: string = authoredComponentRoot(__dirname);

export const BASE_STAGE: string = fs.readFileSync(path.join(COMPONENTS, "commands", "nxs.distill.md"), "utf8");

/** A contract's authored body, read from the skill the base stage names. */
export function contract(name: string): string {
    return fs.readFileSync(path.join(COMPONENTS, "skills", name, "SKILL.md"), "utf8");
}

/** The rows of the base stage's contract selection table, as `[condition, contract, gate]`. */
export function selectionRows(): ReadonlyArray<readonly [string, string, string]> {
    return BASE_STAGE.split("\n")
        .map((l) => l.trim())
        .filter((l) => /^\| .* \| `nxs-distill-[a-z-]+` \| /.test(l))
        .map((l) => l.split("|").slice(1, -1).map((c) => c.trim()) as unknown as readonly [string, string, string]);
}

describe("the run's shape is resolved before any instruction that varies on it (story #727)", () => {
    it("resolves run mode, workspace shape and entry kind at one named point, ahead of entry discovery", () => {
        const front: string = BASE_STAGE.slice(
            BASE_STAGE.indexOf("## Run-shape resolution"),
            BASE_STAGE.indexOf("## Entry discovery"),
        );
        expect(front).toMatch(/\*\*Run mode\.\*\*/);
        expect(front).toMatch(/\*\*Workspace shape\*\*/);
        expect(front).toMatch(/entry's kind/);
        expect(front).toMatch(/resolved \*\*once\*\*/);
    });

    it("re-derives neither run mode nor workspace shape in a later phase", () => {
        const preflight: string = BASE_STAGE.slice(BASE_STAGE.indexOf("# Phase 0 — Preflight"));
        expect(preflight).toMatch(/already resolved\*\* at run-shape resolution/);
        expect(preflight).not.toContain("test -f .nexus/config/workspace.yml");
    });

    it("names every contract it selects in the selection table, and each one exists as an installed skill", () => {
        const rows = selectionRows();
        expect(rows.length).toBeGreaterThan(0);
        for (const [, cell] of rows) {
            const name: string = cell.replaceAll("`", "");
            expect(fs.existsSync(path.join(COMPONENTS, "skills", name, "SKILL.md"))).toBe(true);
        }
    });

    it("declares that the ordinary shape selects no contract at all", () => {
        expect(BASE_STAGE).toMatch(/ordinary shape\*\* —[^.]*selects no contract at all/s);
    });
});

describe("the recovery contract is read only in recovery mode (story #727)", () => {
    it("selects it from the resolved run mode, naming the condition and the contract and nothing else", () => {
        expect(selectionRows()).toContainEqual(["run mode is `recovery`", "`nxs-distill-recovery`", "Input Resolution 4"]);
        expect(BASE_STAGE).toMatch(/run mode resolved at run-shape\n\s*resolution is \*\*recovery\*\*\. Load the \*\*`nxs-distill-recovery`\*\* skill and follow it\./);
    });

    it("leaves the recovery procedure in the contract and nowhere in the base stage", () => {
        const body: string = contract("nxs-distill-recovery");
        for (const rule of ["no-close-comment", "nexus:close-record", "never a discovery source", "epic-resolve --epic <n>"]) {
            expect(body).toContain(rule);
            expect(BASE_STAGE).not.toContain(rule);
        }
    });

    it("describes itself by this stage and its selecting condition only", () => {
        expect(contract("nxs-distill-recovery")).toMatch(/description: .*\/nxs\.distill.*recovery/);
    });
});

describe("the continuation contract is read only in continuation mode (story #727)", () => {
    it("selects it from the resolved run mode, after the entry list", () => {
        expect(selectionRows()).toContainEqual([
            "run mode is `continuation`",
            "`nxs-distill-continuation`",
            "Input Resolution, after the entry list",
        ]);
        expect(BASE_STAGE).toMatch(/run mode resolved at run-shape resolution is \*\*continuation\*\*, load the\n\*\*`nxs-distill-continuation`\*\* skill and follow it\./);
    });

    it("keeps every continuation exception in the contract, keyed to the base stage's phase numbers", () => {
        const body: string = contract("nxs-distill-continuation");
        for (const phase of ["Phase 0.2", "Phase 0.4", "Phase 4.1", "Phase 7", "Phase 8"]) {
            expect(body).toContain(`## ${phase}`);
        }
        for (const rule of [
            "Drain exactly the one entry this branch carries",
            "range-head-reachability",
            "Do not run `git checkout -`",
            "git worktree remove --force <wtPath>",
            "add-then-deleted within the branch",
        ]) {
            expect(body).toContain(rule);
            expect(BASE_STAGE).not.toContain(rule);
        }
    });

    it("states no continuation exception anywhere in the base stage's phases", () => {
        const phases: string = BASE_STAGE.slice(BASE_STAGE.indexOf("# Phase 0 — Preflight"), BASE_STAGE.indexOf("# Usage"));
        expect(phases).not.toMatch(/continuation/i);
    });

    it("describes itself by this stage and its selecting condition only", () => {
        expect(contract("nxs-distill-continuation")).toMatch(/description: .*\/nxs\.distill.*continuation/);
    });
});

describe("the hub contract is read only in a hub workspace (story #728)", () => {
    it("selects it from the resolved workspace shape, at run-shape resolution", () => {
        expect(selectionRows()).toContainEqual(["workspace shape is `hub`", "`nxs-distill-hub`", "run-shape resolution"]);
        expect(BASE_STAGE).toMatch(/\*\*hub\*\* \(`\.nexus\/config\/workspace\.yml` present\): load the \*\*`nxs-distill-hub`\*\* skill and\n\s*follow it\./);
    });

    it("keeps every hub-only rule in the contract, keyed to the base stage's phase numbers", () => {
        const body: string = contract("nxs-distill-hub");
        for (const phase of ["Input Resolution 3", "Phase 0.4", "Phase 0.6", "Phase 1", "Phase 5.2", "Phase 7"]) {
            expect(body).toContain(`## ${phase}`);
        }
        for (const rule of [
            "attributed to every distinct repo its `range:` list names",
            "migration-lag is a drain-SLO concern",
            "form is **never emitted** here",
            '--hub "<hub-root>"',
            "per-repo mapping",
            "anchor sidecars are validated alongside the pages",
            "originating repo",
        ]) {
            expect(body).toContain(rule);
            expect(BASE_STAGE).not.toContain(rule);
        }
    });

    it("states no hub instruction in any phase of the base stage", () => {
        const phases: string = BASE_STAGE.slice(BASE_STAGE.indexOf("# Phase 0 — Preflight"), BASE_STAGE.indexOf("# Usage"));
        // `member-unsupported` is one of the diff reader's closed class tokens, not a hub instruction.
        expect(phases.replace(/`member-unsupported`/g, "")).not.toMatch(/\bhub\b|\bmember\b/i);
    });

    it("names hub only where the workspace shape is resolved", () => {
        const front: string = BASE_STAGE.slice(0, BASE_STAGE.indexOf("## Entry discovery"));
        expect(front).toMatch(/workspace\.yml/);
        expect(BASE_STAGE.slice(BASE_STAGE.indexOf("## Entry discovery"))).not.toContain("workspace.yml");
    });

    it("describes itself by this stage and its selecting condition only", () => {
        expect(contract("nxs-distill-hub")).toMatch(/description: .*\/nxs\.distill.*hub/);
    });
});

describe("the non-epic entry-kind contract is read only when such an entry drains (story #729)", () => {
    it("selects it from each discovered entry's resolved kind, at kind resolution", () => {
        expect(selectionRows()).toContainEqual([
            "any discovered entry's kind is `fix` or `intake`",
            "`nxs-distill-nonepic-entries`",
            "entry discovery, at kind resolution",
        ]);
        expect(BASE_STAGE).toMatch(/recorded kind is \*\*`fix`\*\* or \*\*`intake`\*\*, load the\n\s*\*\*`nxs-distill-nonepic-entries`\*\* skill and follow it\./);
    });

    it("keeps the axis names and the epic row in the base stage, and the other two rows in the contract", () => {
        const kindRow = (text: string, kind: string): boolean =>
            text.split("\n").some((l) => l.trim().startsWith(`| \`${kind}\``));
        expect(BASE_STAGE).toContain("| Kind | *Why* verified against |");
        expect(kindRow(BASE_STAGE, "epic")).toBe(true);
        for (const kind of ["fix", "intake"]) {
            expect(kindRow(BASE_STAGE, kind)).toBe(false);
            expect(kindRow(contract("nxs-distill-nonepic-entries"), kind)).toBe(true);
        }
    });

    it("keeps every fix and intake rule in the contract, keyed to the base stage's phase numbers", () => {
        const body: string = contract("nxs-distill-nonepic-entries");
        for (const phase of ["Phase 0.1", "Phase 3", "Phase 5.5", "Phase 6", "Phase 7"]) {
            expect(body).toContain(`## ${phase}`);
        }
        for (const rule of [
            "pr_digest",
            "no-existing-page",
            "--append-only-log",
            "mode-unavailable",
            "changed outside the entry it gained",
            "Fix entries — the page each one changes",
            "Intake entries — every page created",
            "From an intake entry:",
        ]) {
            expect(body).toContain(rule);
            expect(BASE_STAGE).not.toContain(rule);
        }
    });

    it("still reports the run's per-kind counts from the base stage, so an all-epic run omits the tally", () => {
        expect(BASE_STAGE).toMatch(/\| `by_kind` \| `<n> epic, <n> fix, <n> intake` \| omitted when every drained entry is an epic/);
        expect(BASE_STAGE).toMatch(/Entries drained:\s*<n>\s*\(<local-ids>\) — <n> epic, <n> fix, <n> intake/);
    });

    it("describes itself by this stage and its selecting condition only", () => {
        expect(contract("nxs-distill-nonepic-entries")).toMatch(/description: .*\/nxs\.distill.*fix or intake/);
    });
});

describe("the taxonomy contract is read only where a registry exists (story #730)", () => {
    it("selects it from the store survey's registry-presence check, and from nothing else", () => {
        expect(selectionRows()).toContainEqual(["the concept store has a domain registry", "`nxs-distill-taxonomy`", "Phase 2, the store survey"]);
        expect(BASE_STAGE).toMatch(/When it is present, load the \*\*`nxs-distill-taxonomy`\*\* skill and follow it\./);
    });

    it("leaves a store with no registry behaving exactly as it does today", () => {
        expect(BASE_STAGE).toMatch(/If absent, domain filing is inert for this drain/);
        expect(BASE_STAGE).toMatch(/the Phase 6 taxonomy gate never fires/);
    });

    it("keeps every classification, gate and advisory rule in the contract and none in the base stage", () => {
        const body: string = contract("nxs-distill-taxonomy");
        for (const phase of ["Phase 2", "Phase 3", "Phase 4", "Phase 6.1", "Phase 6.2", "Phase 6.3", "Phase 7"]) {
            expect(body).toContain(`## ${phase}`);
        }
        for (const rule of ["domain_fit", "New Subdomain Draft", "nexus drift-advisory", "forced fit(s) resolved", "filing rubric"]) {
            expect(body).toContain(rule);
            expect(BASE_STAGE).not.toContain(rule);
        }
    });

    it("leaves the base stage's phase numbering untouched, 6.3 included", () => {
        expect(BASE_STAGE).toContain("## Phase 6.3 — Final checkpoint");
        expect(BASE_STAGE).not.toContain("## Phase 6.1");
        expect(BASE_STAGE).not.toContain("## Phase 6.2");
    });

    it("describes itself by this stage and its selecting condition only", () => {
        expect(contract("nxs-distill-taxonomy")).toMatch(/description: .*\/nxs\.distill.*domain registry/);
    });
});
