import type { ReactNode } from "react";

/*
 * Mock gate content for the gate tray (mockup's `gateRightSizing` / `gateAnalyze`
 * plus their `storyRows` / `violations` sample data). The epic executes no real
 * gate decisions; the tray renders these local fixtures so both variants —
 * judgment (right-sizing) and validation (analyze) — demonstrate their full
 * visual range behind the placeholder.
 *
 * Gates are keyed by the stage id their rail segment carries, so the rail's
 * `onSurfaceGate(stageId)` resolves straight to a gate: the `epic` stage's
 * pending gate is the right-sizing judgment; the `analyze` stage's is the
 * consistency validation. Rationale is authored as JSX (not an HTML string) so it
 * renders through the theme tokens and flips cleanly between light and dark.
 */

export type GateVariant = "judgment" | "validation";

export interface Gate {
    variant: GateVariant;
    /* Badge label — the mockup's "Decision · judgment" / "Blocked · validation". */
    badge: string;
    title: string;
    /* Meta line — the command + short epic id (mockup `.gate-sub`). */
    sub: string;
    why: ReactNode;
    /* The artifact key the gate's peek action opens in the drawer. */
    artifact: string;
    /* Peek action label (mockup `.peek` button). */
    peekLabel: string;
}

/* Bold inline emphasis inside the "why" rationale (mockup `.gate-why .b`). */
function B({ children }: { children: ReactNode }): ReactNode {
    return <span className="text-ink">{children}</span>;
}

/* ── judgment: the inline decision slice (mockup `storyRows`) ─────────────── */

export interface StoryRow {
    id: string;
    text: string;
    type: "user" | "system";
    /* Marks Claude's suggested split boundary (mockup `.split-mark`). */
    split: boolean;
}

export const storyRows: StoryRow[] = [
    { id: "S-1", text: "User signs in with a magic link sent to email", type: "user", split: false },
    { id: "S-2", text: "User registers a passkey (WebAuthn) on a device", type: "user", split: true },
    { id: "S-3", text: "User signs in with a registered passkey", type: "user", split: true },
    { id: "S-4", text: "Org admin enables SSO via SAML for a workspace", type: "user", split: false },
    { id: "S-5", text: "Magic-link tokens expire ≤ 10 min, single-use", type: "system", split: false },
    { id: "S-6", text: "Passkey assertion verified < 250ms p95", type: "system", split: true },
    { id: "S-7", text: "SSO assertions validated against IdP cert chain", type: "system", split: false },
];

/* ── validation: the violation checklist (mockup `violations`) ───────────── */

export interface Violation {
    passed: boolean;
    rule: string;
    detail: string;
}

export const violations: Violation[] = [
    { passed: true, rule: "every task has a story_ref", detail: "9 / 11 tasks linked" },
    { passed: false, rule: "orphan task — no story_ref", detail: 'T-7 "add audit log table"' },
    { passed: false, rule: "orphan task — no story_ref", detail: 'T-10 "refactor token signer"' },
    { passed: false, rule: "user story lacks a behavioral-AC task", detail: 'S-4 "admin enables SSO"' },
    { passed: false, rule: "system story AC is prose-only", detail: "S-6 needs a measurable criterion" },
];

export const gates: Record<string, Gate> = {
    epic: {
        variant: "judgment",
        badge: "Decision · judgment",
        title: "Right-sizing gate",
        sub: "nxs.epic · a3f9",
        artifact: "epic",
        peekLabel: "Open epic.md ⧉",
        why: (
            <>
                Epic rated <B>XL</B> — <B>7 stories</B>, <B>4 system ACs</B>,
                touches 3 cross-cutting concepts. Nexus's earliest brake: split
                before any design is generated. Claude suggests a boundary at
                passkey vs. magic-link/SSO (marked <B>▸ B</B> below).
            </>
        ),
    },
    analyze: {
        variant: "validation",
        badge: "Blocked · validation",
        title: "Consistency gate",
        sub: "nxs.analyze · a3f9",
        artifact: "tasks",
        peekLabel: "Open task-index.md ⧉",
        why: (
            <>
                Story ↔ task traceability has drift. Issue creation is{" "}
                <B>blocked</B> until every row passes. Each violation links to
                its fix path — regenerate tasks, edit the story, or add a
                measurable AC.
            </>
        ),
    },
};

/*
 * Resolve a gate by the stage id the rail passes; `null` (no gate open) and any
 * stage without a pending gate resolve to `undefined`, leaving the tray collapsed.
 */
export function resolveGate(id: string | null): Gate | undefined {
    return id !== null ? gates[id] : undefined;
}
