import type { ReactElement, ReactNode } from "react";

/*
 * Mock artifact files for the peek drawer (mockup's `artifacts` map). The epic
 * renders no real files; the drawer previews these local fixtures so it can
 * demonstrate rendering "the actual file Claude wrote" behind the placeholder.
 * Each artifact is a file path plus its rendered body. Bodies are authored as
 * JSX (not HTML strings) so they render through the theme tokens with no
 * dangerouslySetInnerHTML and flip cleanly between light and dark.
 */

export interface Artifact {
    path: string;
    body: ReactElement;
}

/* ── body primitives (mockup `.drawer-body` element styles) ──────────────── */

/* Front-matter block — a dim, rule-bordered pre region. */
function Fm({ children }: { children: ReactNode }): ReactElement {
    return (
        <div className="mb-[14px] whitespace-pre border-l-2 border-line pl-[10px] text-ink-faint">
            {children}
        </div>
    );
}

function H1({ children }: { children: ReactNode }): ReactElement {
    return <h1 className="mb-1 text-[15px] text-ink">{children}</h1>;
}

function H2({ children }: { children: ReactNode }): ReactElement {
    return (
        <h2 className="mb-[6px] mt-[18px] text-[13px] font-bold text-accent-soft">
            {children}
        </h2>
    );
}

/* List row — the mockup's dash-prefixed `.li`. */
function Li({ children }: { children: ReactNode }): ReactElement {
    return (
        <div className="relative pl-4 before:absolute before:left-0 before:text-ink-faint before:content-['—']">
            {children}
        </div>
    );
}

function Code({ children }: { children: ReactNode }): ReactElement {
    return <code className="text-blue">{children}</code>;
}

export const artifacts: Record<string, Artifact> = {
    epic: {
        path: ".nexus/temp/main/a3f9/epic.md",
        body: (
            <>
                <Fm>
                    {"epic: auth-refactor\n" +
                        "local_id: a3f9\n" +
                        "size: XL        # ← right-sizing gate target\n" +
                        "stories: 7"}
                </Fm>
                <H1>Epic — Passwordless &amp; SSO for Auth</H1>
                <p>
                    {"Replace password-primary auth with passwordless (magic " +
                        "link + passkey) and add SSO for org workspaces."}
                </p>
                <H2>Stories</H2>
                <Li>
                    <Code>S-1</Code>
                    {" (user) Sign in with a magic link sent to email."}
                </Li>
                <Li>
                    <Code>S-2</Code>
                    {" (user) Register a passkey (WebAuthn) on a device."}
                </Li>
                <Li>
                    <Code>S-3</Code>
                    {" (user) Sign in with a registered passkey."}
                </Li>
                <Li>
                    <Code>S-4</Code>
                    {" (user) Org admin enables SSO via SAML for a workspace."}
                </Li>
                <Li>
                    <Code>S-5</Code>
                    {" (system) Magic-link tokens expire ≤ 10 min, single-use."}
                </Li>
                <Li>
                    <Code>S-6</Code>
                    {" (system) Passkey assertion verified < 250ms p95."}
                </Li>
                <Li>
                    <Code>S-7</Code>
                    {" (system) SSO assertions validated against IdP cert chain."}
                </Li>
                <H2>Acceptance criteria</H2>
                <Li>
                    {"Each story’s AC is observable (user) or measurable " +
                        "(system) — no prose-only ACs."}
                </Li>
            </>
        ),
    },
    tasks: {
        path: ".nexus/temp/main/a3f9/task-index.md",
        body: (
            <>
                <Fm>
                    {"epic: auth-refactor\n" +
                        "tasks: 11\n" +
                        "gate: analyze (BLOCKED)"}
                </Fm>
                <H1>Task Index</H1>
                <Li>
                    <Code>T-1</Code>
                    {" magic-link issue endpoint — "}
                    <Code>story_ref: S-1</Code>
                </Li>
                <Li>
                    <Code>T-2</Code>
                    {" magic-link verify + session mint — "}
                    <Code>story_ref: S-1</Code>
                </Li>
                <Li>
                    <Code>T-7</Code>
                    {" add audit log table — "}
                    <Code>story_ref: —</Code>
                    {" ⚠ orphan"}
                </Li>
                <Li>
                    <Code>T-10</Code>
                    {" refactor token signer — "}
                    <Code>story_ref: —</Code>
                    {" ⚠ orphan"}
                </Li>
                <H2>Gate note</H2>
                <p>
                    {"analyze blocks issue creation: 2 orphan tasks, S-4 has " +
                        "no behavioral-AC task, S-6 AC is prose-only."}
                </p>
            </>
        ),
    },
    setup: {
        path: "docs/system/stack.md",
        body: (
            <>
                <Fm>{"maintained_by: human"}</Fm>
                <H1>Ground truth — setup</H1>
                <p>
                    {"nxs.setup established stack + standards (formerly " +
                        "nxs.init, now merged). Human-maintained; the pipeline " +
                        "reads it, never rewrites it."}
                </p>
            </>
        ),
    },
};

/*
 * Resolve an artifact by key, falling back to the epic (the "last artifact" the
 * tools peek button opens) — mirroring the mockup's `artifacts[key] || epic`.
 */
export function resolveArtifact(key: string | null): Artifact {
    return (key !== null && artifacts[key]) || artifacts.epic;
}
