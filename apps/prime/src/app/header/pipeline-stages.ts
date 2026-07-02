/*
 * Mock pipeline-stage state for the rail (mockup `.rail`). The rail is a passive
 * read-out; this epic wires it to local fixtures, not a real pipeline. Seeded so
 * both gate variants are reachable from the shell: `setup` done, `epic` at its
 * right-sizing (judgment) gate — the headline moment — and `analyze` at its
 * consistency (validation) gate so that variant can be surfaced and reviewed
 * (Story 5 has no scene switcher). The rest are upcoming. Kept local to
 * `header/`. Stage transitions (and the `active` status appearing live) arrive
 * with Story 7; the drawer/gate the interactive stages point at land with
 * Stories 5 and 6.
 */

export type StageStatus = "done" | "active" | "gate" | "upcoming";

export interface Stage {
    id: string;
    label: string;
    status: StageStatus;
}

export const defaultStages: Stage[] = [
    { id: "setup", label: "setup", status: "done" },
    { id: "epic", label: "epic", status: "gate" },
    { id: "hld", label: "hld", status: "upcoming" },
    { id: "tasks", label: "tasks", status: "upcoming" },
    { id: "analyze", label: "analyze", status: "gate" },
    { id: "close", label: "close", status: "upcoming" },
];
